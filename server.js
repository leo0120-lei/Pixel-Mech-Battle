const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = 1001;
const USERS_FILE = 'users.json';

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
        }
    } catch (e) {}
    return {};
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (e) { reject(e); }
        });
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/register') {
        try {
            const { username, password } = await parseBody(req);
            if (!username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '用户名和密码不能为空' }));
                return;
            }
            if (username.length > 12) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '用户名最多12个字符' }));
                return;
            }
            const users = loadUsers();
            if (users[username]) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '用户名已存在' }));
                return;
            }
            users[username] = password;
            saveUsers(users);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '注册成功' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '服务器错误' }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/login') {
        try {
            const { username, password } = await parseBody(req);
            if (!username || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '用户名和密码不能为空' }));
                return;
            }
            const users = loadUsers();
            if (!users[username] || users[username] !== password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '用户名或密码错误' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '登录成功', username }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '服务器错误' }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/api/check-session') {
        try {
            const cookie = req.headers.cookie || '';
            const match = cookie.match(/mech_username=([^;]+)/);
            if (match) {
                const username = decodeURIComponent(match[1]);
                const users = loadUsers();
                if (users[username]) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, username }));
                    return;
                }
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '服务器错误' }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/update-username') {
        try {
            const { username, newUsername, password } = await parseBody(req);
            if (!username || !newUsername || !password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '字段不能为空' }));
                return;
            }
            if (newUsername.length > 12) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '新用户名最多12个字符' }));
                return;
            }
            const users = loadUsers();
            if (!users[username] || users[username] !== password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '密码错误或用户不存在' }));
                return;
            }
            if (users[newUsername] && newUsername !== username) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '新用户名已被使用' }));
                return;
            }
            const pwd = users[username];
            delete users[username];
            users[newUsername] = pwd;
            saveUsers(users);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '用户名修改成功', username: newUsername }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '服务器错误' }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/change-password') {
        try {
            const { username, oldPassword, newPassword } = await parseBody(req);
            if (!username || !oldPassword || !newPassword) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '字段不能为空' }));
                return;
            }
            const users = loadUsers();
            if (!users[username] || users[username] !== oldPassword) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: '旧密码错误或用户不存在' }));
                return;
            }
            users[username] = newPassword;
            saveUsers(users);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '密码修改成功' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '服务器错误' }));
        }
        return;
    }

    if (req.method === 'GET' && req.url === '/api/rooms') {
        try {
            const roomList = [];
            for (const roomId of Object.keys(rooms)) {
                const room = rooms[roomId];
                const creatorPlayer = players.find(p => p.id === room.players[0]);
                roomList.push({
                    roomId,
                    creatorUsername: creatorPlayer ? creatorPlayer.username : '未知',
                    playerCount: room.players.length
                });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, rooms: roomList }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: '服务器错误' }));
        }
        return;
    }

    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    }[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code + '\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const wss = new WebSocket.Server({ server });

let players = [];
let rooms = {};

function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function broadcastToRoom(roomId, message, excludeId) {
    const room = rooms[roomId];
    if (!room) return;
    room.players.forEach(pid => {
        if (excludeId && pid === excludeId) return;
        const player = players.find(p => p.id === pid);
        if (player && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(message));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('New player connected');
    const playerId = Date.now().toString();
    players.push({ id: playerId, ws: ws, roomId: null, username: null });

    ws.send(JSON.stringify({
        type: 'init',
        data: { playerId: playerId }
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'setUsername':
                    const sp = players.find(p => p.id === playerId);
                    if (sp) sp.username = data.data.username;
                    break;

                case 'createRoom':
                    const roomId = generateRoomId();
                    rooms[roomId] = {
                        players: [playerId],
                        readyPlayers: [],
                        gameState: { players: [] }
                    };
                    const creatorPlayer = players.find(p => p.id === playerId);
                    if (creatorPlayer) creatorPlayer.roomId = roomId;

                    ws.send(JSON.stringify({
                        type: 'roomCreated',
                        data: { roomId: roomId }
                    }));
                    console.log(`Room ${roomId} created by ${creatorPlayer ? creatorPlayer.username : playerId}`);
                    break;

                case 'joinRoom':
                    const joinRoomId = data.data.roomId;
                    const joinRoom = rooms[joinRoomId];

                    if (!joinRoom) {
                        ws.send(JSON.stringify({ type: 'error', data: { message: '房间不存在!' } }));
                        break;
                    }
                    if (joinRoom.players.length >= 2) {
                        ws.send(JSON.stringify({ type: 'error', data: { message: '房间已满!' } }));
                        break;
                    }

                    joinRoom.players.push(playerId);
                    const joiningPlayer = players.find(p => p.id === playerId);
                    if (joiningPlayer) joiningPlayer.roomId = joinRoomId;

                    ws.send(JSON.stringify({
                        type: 'roomJoined',
                        data: { roomId: joinRoomId }
                    }));
                    console.log(`${joiningPlayer ? joiningPlayer.username : playerId} joined room ${joinRoomId}`);

                    if (joinRoom.players.length === 2) {
                        broadcastToRoom(joinRoomId, { type: 'gameStart', data: {} });
                        console.log(`Game started in room ${joinRoomId}`);
                    }
                    break;

                case 'joinGame':
                    const playerRoom = players.find(p => p.id === playerId);
                    if (!playerRoom || !playerRoom.roomId) break;
                    const room = rooms[playerRoom.roomId];
                    if (!room) break;

                    const existingIdx = room.gameState.players.findIndex(p => p.id === data.data.playerId);
                    if (existingIdx === -1) {
                        room.gameState.players.push({
                            id: data.data.playerId,
                            username: data.data.username || '未知',
                            x: data.data.x,
                            y: data.data.y,
                            hp: 100,
                            maxHp: 100,
                            facing: data.data.facing,
                            isAttacking: false,
                            isDefending: false,
                            attackCooldown: 0,
                            animFrame: 0
                        });
                    } else {
                        room.gameState.players[existingIdx].x = data.data.x;
                        room.gameState.players[existingIdx].y = data.data.y;
                    }

                    broadcastToRoom(playerRoom.roomId, {
                        type: 'players',
                        data: room.gameState.players
                    });
                    break;

                case 'state':
                    const statePlayer = players.find(p => p.id === playerId);
                    if (!statePlayer || !statePlayer.roomId) break;
                    const stateRoom = rooms[statePlayer.roomId];
                    if (!stateRoom) break;

                    const pidx = stateRoom.gameState.players.findIndex(p => p.id === data.data.id);
                    if (pidx !== -1) {
                        stateRoom.gameState.players[pidx] = {
                            ...stateRoom.gameState.players[pidx],
                            ...data.data
                        };
                    }

                    broadcastToRoom(statePlayer.roomId, {
                        type: 'state',
                        data: data.data
                    }, playerId);
                    break;

                case 'attack':
                    const attackPlayer = players.find(p => p.id === playerId);
                    if (!attackPlayer || !attackPlayer.roomId) break;
                    broadcastToRoom(attackPlayer.roomId, {
                        type: 'attack',
                        data: data.data
                    }, playerId);
                    break;

                case 'gameOver':
                    const goPlayer = players.find(p => p.id === playerId);
                    if (!goPlayer || !goPlayer.roomId) break;
                    broadcastToRoom(goPlayer.roomId, {
                        type: 'gameOver',
                        data: data.data
                    }, playerId);
                    break;

                case 'hit':
                    const hitPlayer = players.find(p => p.id === playerId);
                    if (!hitPlayer || !hitPlayer.roomId) break;
                    broadcastToRoom(hitPlayer.roomId, {
                        type: 'hit',
                        data: data.data
                    }, playerId);
                    break;

                case 'ready':
                    const readyPlayer = players.find(p => p.id === playerId);
                    if (!readyPlayer || !readyPlayer.roomId) break;
                    const readyRoom = rooms[readyPlayer.roomId];
                    if (!readyRoom) break;
                    if (!readyRoom.readyPlayers.includes(playerId)) {
                        readyRoom.readyPlayers.push(playerId);
                    }
                    broadcastToRoom(readyPlayer.roomId, {
                        type: 'playerReady',
                        data: { playerId, username: readyPlayer.username, readyPlayers: readyRoom.readyPlayers }
                    });
                    if (readyRoom.players.length === 2 && readyRoom.readyPlayers.length === 2) {
                        broadcastToRoom(readyPlayer.roomId, { type: 'gameStart', data: {} });
                        console.log(`Game started in room ${readyPlayer.roomId} (both players ready)`);
                    }
                    break;
                case 'roundEnd':
                    const rePlayer = players.find(p => p.id === playerId);
                    if (!rePlayer || !rePlayer.roomId) break;
                    broadcastToRoom(rePlayer.roomId, {
                        type: 'roundEnd',
                        data: { winner: msg.data.winner, scores: msg.data.scores }
                    });
                    break;
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Player disconnected');
        const disconnectPlayer = players.find(p => p.id === playerId);
        if (disconnectPlayer && disconnectPlayer.roomId) {
            const rid = disconnectPlayer.roomId;
            const rm = rooms[rid];
            if (rm) {
                rm.players = rm.players.filter(p => p !== playerId);
                rm.gameState.players = rm.gameState.players.filter(p => p.id !== playerId);
                broadcastToRoom(rid, { type: 'playerLeft', data: {} });
                if (rm.players.length === 0) {
                    delete rooms[rid];
                    console.log(`Room ${rid} deleted`);
                }
            }
        }
        players = players.filter(p => p.id !== playerId);
    });
});

function getLocalIP() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

server.listen(PORT, () => {
    const localIP = getLocalIP();
    console.log('====================================');
    console.log('  机甲对战游戏服务器已启动!');
    console.log('====================================');
    console.log(`  本地访问: http://localhost:${PORT}`);
    console.log(`  局域网访问: http://${localIP}:${PORT}`);
    console.log('====================================');
    console.log('  按 Ctrl+C 停止服务器');
    console.log('====================================');
});
