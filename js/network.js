class NetworkManager {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.playerId = null;
        this.roomId = null;
        this.connected = false;
        this.lastSendTime = 0;
        this.sendInterval = 50;
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port || '1001';
        const wsUrl = `${protocol}//${host}:${port}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to server');
                this.connected = true;
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from server');
                this.connected = false;
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (e) {
            console.error('Connection failed:', e);
        }
    }
    
    createRoom() {
        this.send('createRoom', {});
    }
    
    joinRoom(roomId) {
        this.send('joinRoom', { roomId: roomId });
    }
    
    setUsername(username) {
        this.send('setUsername', { username: username });
    }
    
    send(type, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        }
    }
    
    handleMessage(msg) {
        switch (msg.type) {
            case 'init':
                this.playerId = msg.data.playerId;
                break;
            case 'roomCreated':
                this.roomId = msg.data.roomId;
                this.game.onRoomCreated(msg.data.roomId);
                break;
            case 'roomJoined':
                this.roomId = msg.data.roomId;
                this.game.onRoomJoined(msg.data.roomId);
                break;
            case 'gameStart':
                this.game.onGameStart();
                break;
            case 'players':
                this.game.handleRemotePlayers(msg.data);
                break;
            case 'state':
                this.game.updateRemotePlayer(msg.data);
                break;
            case 'attack':
                this.game.handleRemoteAttack(msg.data);
                break;
            case 'playerLeft':
                this.game.onPlayerLeft();
                break;
            case 'error':
                this.game.showError(msg.data.message);
                break;
            case 'gameOver':
                this.game.onRemoteGameOver(msg.data.winnerName);
                break;
            case 'hit':
                this.game.onRemoteHit(msg.data.hp);
                break;
            case 'playerReady':
                this.game.onPlayerReady(msg.data.playerId);
                break;
            case 'roomFull':
                console.log('房间已满，等待双方准备就绪...');
                break;
            case 'roundEnd':
                this.game.onRemoteRoundEnd(msg.data.winner, msg.data.scores);
                break;
        }
    }
    
    joinGame(isPlayer1, username) {
        const x = isPlayer1 ? 100 : 636;
        const facing = isPlayer1 ? 'right' : 'left';
        
        this.send('joinGame', {
            playerId: this.playerId,
            username: username,
            x: x,
            y: 376,
            facing: facing
        });
    }
    
    sendState(mech) {
        const now = Date.now();
        if (now - this.lastSendTime < this.sendInterval) return;
        this.lastSendTime = now;
        
        // 同步武器信息
        const state = {
            id: this.playerId,
            x: mech.x,
            y: mech.y,
            hp: mech.hp,
            facing: mech.facing,
            isAttacking: mech.isAttacking,
            isDefending: mech.isDefending,
            attackCooldown: mech.attackCooldown,
            animFrame: mech.animFrame,
            invincible: mech.invincible,
            hitDealt: mech.hitDealt,
            weaponId: mech.weapon.id
        };
        
        // 同步投掷武器信息
        if (mech.thrownWeapon && mech.thrownWeapon.active) {
            state.thrownWeapon = {
                weaponId: mech.thrownWeapon.weapon.id,
                x: mech.thrownWeapon.x,
                y: mech.thrownWeapon.y,
                vx: mech.thrownWeapon.vx,
                vy: mech.thrownWeapon.vy,
                width: mech.thrownWeapon.width,
                height: mech.thrownWeapon.height,
                groundTimer: mech.thrownWeapon.groundTimer
            };
        } else {
            state.thrownWeapon = null;
        }
        
        if (mech.bullets.length > 0) {
            state.bullets = mech.bullets.map(b => ({
                x: b.x,
                y: b.y,
                vx: b.vx,
                vy: b.vy,
                width: b.width,
                height: b.height,
                active: b.active,
                damage: b.damage
            }));
        } else {
            state.bullets = [];
        }
        
        this.send('state', state);
    }
    
    sendGameOver() {
        const localPlayer = this.game.players[this.game.localPlayerIndex];
        const winnerName = localPlayer.username;
        this.send('gameOver', { winnerName: winnerName });
    }
    
    sendHit(newHp) {
        this.send('hit', { hp: newHp });
    }
    
    sendReady() {
        this.send('ready', {});
    }

    sendRoundEnd(winner, scores) {
        this.send('roundEnd', { winner: winner, scores: scores });
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
