const AuthManager = {
    async checkSession() {
        try {
            const res = await fetch('/api/check-session');
            const data = await res.json();
            if (data.success && data.username) {
                return data.username;
            }
            return null;
        } catch (e) {
            console.warn('检查会话失败:', e);
            return null;
        }
    },

    setSession(username) {
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `mech_username=${encodeURIComponent(username)};expires=${expires};path=/`;
    },

    clearSession() {
        document.cookie = 'mech_username=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
    }
};

const Game = {
    canvas: null,
    players: [],
    running: false,
    gameMode: 'local',
    networkManager: null,
    localPlayerIndex: 0,
    remotePlayers: [],
    groundY: 440,
    username: '',
    paused: false,
    readyPlayers: [],
    
    // 回合制比分
    scores: [0, 0],
    maxScore: 5,
    currentRound: 1,
    roundOver: false,
    
    // 武器配置
    player1Weapon: 'fist',
    player2Weapon: 'fist',
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        Render.init(this.canvas);
        Input.init();
        this.setupLogin();
        this.setupMenu();
        this.setupUserCenter();
        this.setupPauseMenu();
        
        // 检查 Cookie 会话
        this.checkAutoLogin();
        
        this.setupWeaponScreen();
   },

    async checkAutoLogin() {
        const sessionUser = await AuthManager.checkSession();
        if (sessionUser) {
            this.username = sessionUser;
            this.enterMenu();
        } else {
            AuthManager.clearSession();
            document.getElementById('login-screen').classList.remove('hidden');
        }
    },
    
    setupLogin() {
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        tabLogin.addEventListener('click', () => {
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        });
        
        tabRegister.addEventListener('click', () => {
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        });
        
        document.getElementById('btn-login').addEventListener('click', () => this.doLogin());
        document.getElementById('btn-register').addEventListener('click', () => this.doRegister());
        
        document.getElementById('login-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.doLogin();
        });
        document.getElementById('reg-password2').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.doRegister();
        });
    },
    
    setupUserCenter() {
        // 头像点击切换下拉菜单
        document.getElementById('user-logged').addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('user-dropdown').classList.toggle('hidden');
        });
        
        // 点击页面其他区域关闭下拉
        document.addEventListener('click', () => {
            document.getElementById('user-dropdown').classList.add('hidden');
        });
        
        // 下拉菜单项事件
        document.getElementById('btn-edit-username').addEventListener('click', () => {
            this.showEditUsernameModal();
        });
        
        document.getElementById('btn-change-password').addEventListener('click', () => {
            this.showChangePasswordModal();
        });
        
        document.getElementById('btn-logout').addEventListener('click', () => {
            this.doLogout();
        });
    },
    
    updateUserCenterUI() {
        if (this.username) {
            document.getElementById('user-not-logged').classList.add('hidden');
            document.getElementById('user-logged').classList.remove('hidden');
            document.getElementById('user-display-name').textContent = this.username;
        } else {
            document.getElementById('user-not-logged').classList.remove('hidden');
            document.getElementById('user-logged').classList.add('hidden');
        }
    },
    
    showEditUsernameModal() {
        const newUsername = prompt('请输入新用户名:');
        if (!newUsername) return;
        if (newUsername.length > 12) { alert('用户名最多12个字符'); return; }
        
        const password = prompt('请输入当前密码确认:');
        if (!password) return;
        
        fetch('/api/update-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: this.username, newUsername, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('用户名修改成功！');
                this.username = newUsername;
                AuthManager.setSession(newUsername);
                this.updateUserCenterUI();
            } else {
                alert(data.message || '修改失败');
            }
        })
        .catch(() => alert('连接服务器失败'));
    },
    
    showChangePasswordModal() {
        const oldPassword = prompt('请输入旧密码:');
        if (!oldPassword) return;
        
        const newPassword = prompt('请输入新密码:');
        if (!newPassword) return;
        
        const newPassword2 = prompt('请再次输入新密码:');
        if (newPassword !== newPassword2) { alert('两次密码不一致'); return; }
        
        fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: this.username, oldPassword, newPassword })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('密码修改成功！');
            } else {
                alert(data.message || '修改失败');
            }
        })
        .catch(() => alert('连接服务器失败'));
    },
    
    doLogout() {
        AuthManager.clearSession();
        this.username = '';
        this.updateUserCenterUI();
        
        // 如果在联机模式，断开连接
        if (this.networkManager) {
            this.networkManager.disconnect();
            this.networkManager = null;
        }
        
        this.backToMenu();
    },
    
    async doLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        if (!username || !password) {
            errorEl.textContent = '请输入用户名和密码';
            return;
        }
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (data.success) {
                this.username = username;
                AuthManager.setSession(username);
                this.enterMenu();
            } else {
                errorEl.textContent = data.message;
            }
        } catch (e) {
            errorEl.textContent = '连接服务器失败';
        }
    },
    
    async doRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const password2 = document.getElementById('reg-password2').value;
        const errorEl = document.getElementById('reg-error');
        
        if (!username || !password) {
            errorEl.textContent = '请输入用户名和密码';
            return;
        }
        if (password !== password2) {
            errorEl.textContent = '两次密码不一致';
            return;
        }
        
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (data.success) {
                this.username = username;
                AuthManager.setSession(username);
                this.enterMenu();
            } else {
                errorEl.textContent = data.message;
            }
        } catch (e) {
            errorEl.textContent = '连接服务器失败';
        }
    },
    
    enterMenu() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('welcome-user').textContent = `欢迎, ${this.username}`;
        this.updateUserCenterUI();
    },
    
    setupLoginModal() {
      const tabLogin = document.getElementById('modal-tab-login');
      const tabRegister = document.getElementById('modal-tab-register');
      const loginForm = document.getElementById('modal-login-form');
      const registerForm = document.getElementById('modal-register-form');
      
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      });
      
      tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
      });
      
      document.getElementById('modal-btn-login').addEventListener('click', () => {
        this.doModalLogin();
      });
      
      document.getElementById('modal-btn-register').addEventListener('click', () => {
        this.doModalRegister();
      });
      
      document.getElementById('modal-btn-close').addEventListener('click', () => {
        document.getElementById('login-modal').classList.add('hidden');
      });
    },
    
    async doModalLogin() {
      const username = document.getElementById('modal-login-username').value.trim();
      const password = document.getElementById('modal-login-password').value;
      const errorEl = document.getElementById('modal-login-error');
      
      if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        return;
      }
      
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
          this.username = username;
          document.getElementById('login-modal').classList.add('hidden');
          this.enterLobby();
        } else {
          errorEl.textContent = data.message;
        }
      } catch (e) {
        errorEl.textContent = '连接服务器失败';
      }
    },
    
    async doModalRegister() {
      const username = document.getElementById('modal-reg-username').value.trim();
      const password = document.getElementById('modal-reg-password').value;
      const password2 = document.getElementById('modal-reg-password2').value;
      const errorEl = document.getElementById('modal-reg-error');
      
      if (!username || !password) {
        errorEl.textContent = '请输入用户名和密码';
        return;
      }
      if (password !== password2) {
        errorEl.textContent = '两次密码不一致';
        return;
      }
      
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
          this.username = username;
          document.getElementById('login-modal').classList.add('hidden');
          this.enterLobby();
        } else {
          errorEl.textContent = data.message;
        }
      } catch (e) {
        errorEl.textContent = '连接服务器失败';
      }
    },
    
    setupMenu() {
      // 武器配置
      document.getElementById('btn-weapons').addEventListener('click', () => {
        this.showWeaponScreen();
      });
      
      // 本地双人模式 - 直接开始游戏
      document.getElementById('btn-local').addEventListener('click', () => {
        this.startLocalGame();
      });
      
      // 联机模式 - 检查登录状态
      document.getElementById('btn-online').addEventListener('click', () => {
        this.enterLobby();
      });
      
      // 联机大厅功能
      document.getElementById('btn-create-room').addEventListener('click', () => {
        this.createAndEnterRoom();
      });

      document.getElementById('btn-show-join').addEventListener('click', () => {
        document.getElementById('join-room-container').classList.toggle('hidden');
      });

      document.getElementById('btn-back-to-menu').addEventListener('click', () => {
        this.leaveLobby();
      });
      
      document.getElementById('btn-join-by-id').addEventListener('click', () => {
        const roomId = document.getElementById('join-room-input').value.trim();
        if (roomId) {
          this.joinRoom(roomId);
        }
      });
      
      // 登录弹窗（联机模式按需登录）
      this.setupLoginModal();
      
      // 游戏结束按钮
      document.getElementById('btn-restart').addEventListener('click', () => {
        this.restartGame();
      });
      
      document.getElementById('btn-menu').addEventListener('click', () => {
        this.backToMenu();
      });
    },
    
    startLocalGame() {
        this.gameMode = 'local';
        this.localPlayerIndex = 0;
        this.scores = [0, 0];
        this.currentRound = 1;
        this.roundOver = false;
        this.updateScoreboard();
        
        this.players = [
            new Mech(100, 376, 'player1', true, this.username),
            new Mech(636, 376, 'player2', false, '玩家2')
        ];
        
        // 应用武器配置
        this.players[0].setWeapon(this.player1Weapon);
        this.players[1].setWeapon(this.player2Weapon);
        
        this.hideMenu();
        this.showModeLabel('本地双人');
        this.showControlsInfo('玩家1: A/D移动 W跳跃 空格攻击 S投掷 | 玩家2: ←/→移动 ↑跳跃 ↓攻击 CTRL投掷');
        this.updatePlayerLabels();
        this.running = true;
        this.gameLoop();
    },

    enterLobby() {
      if (!this.username) {
        // 未登录，显示登录弹窗
        document.getElementById('login-modal').classList.remove('hidden');
        return;
      }

      // 已登录，进入大厅
      document.getElementById('menu-screen').classList.add('hidden');
      document.getElementById('lobby-screen').classList.remove('hidden');
      // 重置加入房间输入框为隐藏
      document.getElementById('join-room-container').classList.add('hidden');
      document.getElementById('join-room-input').value = '';
    },
    
    async fetchRoomList() {
      try {
        const res = await fetch('/api/rooms');
        const data = await res.json();
        
        const roomListEl = document.getElementById('room-list');
        roomListEl.innerHTML = '';
        
        if (!data.rooms || data.rooms.length === 0) {
          roomListEl.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">暂无房间</div>';
          return;
        }
        
        data.rooms.forEach(room => {
          const roomItem = document.createElement('div');
          roomItem.className = 'room-item';
          roomItem.innerHTML = `
            <span class="room-creator">${room.creatorUsername || '未知'}</span>
            <span class="room-number">房间 ${room.roomId}</span>
            <span class="room-count">${room.playerCount}/2</span>
          `;
          roomItem.addEventListener('click', () => {
            if (room.playerCount < 2) {
              this.joinRoom(room.roomId);
            } else {
              alert('房间已满！');
            }
          });
          roomListEl.appendChild(roomItem);
        });
      } catch (e) {
        console.error('获取房间列表失败:', e);
      }
    },
    
    createAndEnterRoom() {
      this.gameMode = 'host';
      this.localPlayerIndex = 0;
      this.networkManager = new NetworkManager(this);
      this.networkManager.connect();
      
      setTimeout(() => {
        this.networkManager.createRoom();
        this.networkManager.setUsername(this.username);
      }, 500);
      
      this.players = [
        new Mech(100, 376, 'local', true, this.username),
        null
      ];

      // 联机模式使用玩家一武器
      if (this.players[0]) {
        this.players[0].setWeapon(this.player1Weapon);
      }
    },
    
    onRoomCreated(roomId) {
      document.getElementById('lobby-screen').classList.remove('hidden');
      const actionsDiv = document.getElementById('lobby-actions');
      let roomInfo = document.getElementById('room-info-display');
      if (!roomInfo) {
        roomInfo = document.createElement('div');
        roomInfo.id = 'room-info-display';
        roomInfo.style.cssText = 'color:#00ffff;font-size:1.2rem;margin:15px 0;text-align:center;';
        actionsDiv.parentNode.insertBefore(roomInfo, actionsDiv);
      }
      roomInfo.innerHTML = `房间号: <strong style="font-size:1.5rem">${roomId}</strong><br><span style="color:#888;font-size:0.9rem">等待玩家加入...</span>`;
    },

    joinRoom(roomId) {
        this.gameMode = 'client';
        this.localPlayerIndex = 1;
        this.networkManager = new NetworkManager(this);
        this.networkManager.connect();
        
        setTimeout(() => {
            this.networkManager.joinRoom(roomId);
            this.networkManager.setUsername(this.username);
        }, 500);
        
        this.players = [
            null,
            new Mech(636, 376, 'local', false, this.username)
        ];

        // 联机模式使用玩家一武器
        if (this.players[1]) {
            this.players[1].setWeapon(this.player1Weapon);
        }
    },
    
    onRoomJoined(roomId) {
    },

    onGameStart() {
        this.networkManager.joinGame(this.localPlayerIndex === 0, this.username);
        document.getElementById('lobby-screen').classList.add('hidden');
        this.scores = [0, 0];
        this.currentRound = 1;
        this.roundOver = false;
        this.updateScoreboard();
        this.hideMenu();
        this.showModeLabel('联机对战');
        this.showControlsInfo('A/D移动 W跳跃 空格攻击 S投掷(可投掷武器)');
        this.running = true;
        this.gameLoop();
    },
    
    showError(message) {
        alert(message);
        this.backToMenu();
    },
    
    onPlayerLeft() {
        alert('对方玩家已离开！');
        this.backToMenu();
    },
    
    leaveLobby() {
      if (this.networkManager) {
        this.networkManager.disconnect();
        this.networkManager = null;
      }
      this.players = [];
      const roomInfo = document.getElementById('room-info-display');
      if (roomInfo) roomInfo.remove();
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('join-room-container').classList.add('hidden');
      this.showMenu();
      this.updateUserCenterUI();
    },
    
    setupWeaponScreen() {
        // 返回按钮
        document.getElementById('btn-back-from-weapons').addEventListener('click', () => {
            this.showMainMenu();
        });
        
        // 初始化武器列表
        this.renderWeaponList('p1', this.player1Weapon);
        this.renderWeaponList('p2', this.player2Weapon);
    },
    
    renderWeaponList(playerKey, selectedWeaponId) {
        const container = document.getElementById(`weapon-list-${playerKey}`);
        container.innerHTML = '';
        
        Object.values(Weapons).forEach(weapon => {
            const item = document.createElement('div');
            item.className = `weapon-item${weapon.id === selectedWeaponId ? ' selected' : ''}`;
            item.dataset.weaponId = weapon.id;
            item.innerHTML = `
                <span class="weapon-icon-lg">${weapon.icon}</span>
                <span class="weapon-name-sm">${weapon.name}</span>
            `;
            
            item.addEventListener('click', () => {
                // 更新选中状态
                container.querySelectorAll('.weapon-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                
                // 更新配置
                if (playerKey === 'p1') {
                    this.player1Weapon = weapon.id;
                } else {
                    this.player2Weapon = weapon.id;
                }
                
                // 更新显示信息
                this.updateWeaponDisplay(playerKey, weapon);
            });
            
            container.appendChild(item);
        });
        
        // 显示当前选中武器的信息
        const selectedWeapon = Weapons[selectedWeaponId];
        this.updateWeaponDisplay(playerKey, selectedWeapon);
    },
    
    updateWeaponDisplay(playerKey, weapon) {
        document.querySelector(`#${playerKey}-weapon-info .weapon-name`).textContent = weapon.name;
        document.querySelector(`#${playerKey}-weapon-info .weapon-icon`).textContent = weapon.icon;
        
        // 更新属性显示（转换为友好文字）
        const damageText = weapon.damage + (weapon.canShoot ? `(近战)` : '');
        const speedText = weapon.attackCD <= 12 ? '快' : (weapon.attackCD <= 18 ? '中' : '慢');
        const rangeText = weapon.range <= 55 ? '近' : (weapon.range <= 80 ? '较近' : (weapon.range <= 95 ? '远' : '极远'));
        let specialText = '-';
        if (weapon.canThrow) specialText = '可投掷';
        if (weapon.canShoot) specialText = `子弹:${weapon.bulletDamage}伤害`;
        
        document.getElementById(`${playerKey}-damage`).textContent = damageText;
        document.getElementById(`${playerKey}-speed`).textContent = speedText;
        document.getElementById(`${playerKey}-range`).textContent = rangeText;
        document.getElementById(`${playerKey}-special`).textContent = specialText;
    },
    
    showWeaponScreen() {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('weapon-screen').classList.remove('hidden');
        
        // 检查是否是联机模式提示
        if (this.gameMode !== 'local') {
            document.getElementById('online-mode-tip').classList.remove('hidden');
            const p1Weapon = Weapons[this.player1Weapon];
            document.getElementById('online-mode-tip').innerHTML = 
                `⚠️ 联机模式使用玩家一武器配置：<strong>${p1Weapon.icon} ${p1Weapon.name}</strong>`;
        } else {
            document.getElementById('online-mode-tip').classList.add('hidden');
        }
    },
    
    showMainMenu() {
        document.getElementById('weapon-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
    },
    
    setupPauseMenu() {
      document.getElementById('btn-resume').addEventListener('click', () => {
        this.togglePauseMenu();
      });
      
      document.getElementById('btn-quit-pause').addEventListener('click', () => {
        this.backToMenu();
      });
      
      // 全局 ESC 键监听
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.running) {
          e.preventDefault();
          this.togglePauseMenu();
        }
      });
    },
    
    togglePauseMenu() {
      const pauseMenu = document.getElementById('pause-menu');
      const isHidden = pauseMenu.classList.contains('hidden');
      
      if (isHidden) {
        // 打开菜单
        pauseMenu.classList.remove('hidden');
        
        // 根据模式设置标题
        const title = document.getElementById('pause-title');
        title.textContent = this.gameMode === 'local' ? '游戏暂停' : '菜单';
        
        // 本地模式才暂停
        if (this.gameMode === 'local') {
          this.paused = true;
        }
      } else {
        // 关闭菜单
        pauseMenu.classList.add('hidden');
        this.paused = false;
      }
    },
    
    handleRemotePlayers(players) {
        this.remotePlayers = players.filter(p => p.id !== this.networkManager.playerId);
        
        if (this.remotePlayers.length > 0) {
            const remote = this.remotePlayers[0];
            const remoteIndex = this.localPlayerIndex === 0 ? 1 : 0;
            
            if (!this.players[remoteIndex]) {
                this.players[remoteIndex] = new Mech(remote.x, remote.y, remote.id, remoteIndex === 0, remote.username);
            } else {
                this.players[remoteIndex].username = remote.username || '未知';
            }
            
            this.updatePlayerLabels();
        }
    },
    
    updateRemotePlayer(data) {
        const remoteIndex = this.localPlayerIndex === 0 ? 1 : 0;
        const mech = this.players[remoteIndex];
        if (!mech) return;
        
        mech.x = data.x;
        mech.y = data.y;
        mech.facing = data.facing;
        mech.isAttacking = data.isAttacking;
        mech.isDefending = data.isDefending;
        mech.attackCooldown = data.attackCooldown;
        mech.animFrame = data.animFrame;
        if (data.invincible !== undefined) mech.invincible = data.invincible;
        if (data.hitDealt !== undefined) mech.hitDealt = data.hitDealt;
        
        // 更新武器
        if (data.weaponId && Weapons[data.weaponId]) {
            mech.weapon = Weapons[data.weaponId];
        }
        
        // 更新投掷武器
        if (data.thrownWeapon && Weapons[data.thrownWeapon.weaponId]) {
            mech.thrownWeapon = {
                weapon: Weapons[data.thrownWeapon.weaponId],
                x: data.thrownWeapon.x,
                y: data.thrownWeapon.y,
                vx: data.thrownWeapon.vx,
                vy: data.thrownWeapon.vy,
                width: data.thrownWeapon.width,
                height: data.thrownWeapon.height,
                groundTimer: data.thrownWeapon.groundTimer || 0,
                active: true
            };
        } else {
            if (mech.thrownWeapon) {
                if (mech.thrownWeapon.groundTimer && mech.thrownWeapon.groundTimer > 0) {
                } else {
                    mech.thrownWeapon.active = false;
                    mech.thrownWeapon = null;
                }
            }
        }
        
        if (data.bullets && Array.isArray(data.bullets)) {
            mech.bullets = data.bullets.map(b => ({
                x: b.x,
                y: b.y,
                vx: b.vx,
                vy: b.vy || 0,
                width: b.width || 8,
                height: b.height || 4,
                active: b.active,
                damage: b.damage || 45
            }));
        }
    },
    
    onRemoteHit(newHp) {
        const localPlayer = this.players[this.localPlayerIndex];
        if (localPlayer) {
            localPlayer.hp = newHp;
        }
    },
    
    handleRemoteAttack(data) {
    },
    
    showModeLabel(text) {
        const el = document.getElementById('mode-label');
        el.textContent = text;
        el.classList.remove('hidden');
    },
    
    showControlsInfo(text) {
        document.getElementById('controls-info').textContent = text;
    },
    
    updatePlayerLabels() {
        if (this.players[0]) {
            document.getElementById('player1-label').textContent = this.players[0].username;
        }
        if (this.players[1]) {
            document.getElementById('player2-label').textContent = this.players[1].username;
        }
    },
    
    hideMenu() {
        document.getElementById('menu-screen').classList.add('hidden');
    },
    
    showMenu() {
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('mode-label').classList.add('hidden');
        document.getElementById('pause-menu').classList.add('hidden');
        const roomInfo = document.getElementById('room-info-display');
        if (roomInfo) roomInfo.remove();
    },
    
    restartGame() {
        document.getElementById('game-over-screen').style.display = 'none';
        
        this.scores = [0, 0];
        this.currentRound = 1;
        this.roundOver = false;
        this.updateScoreboard();
        
        if (this.gameMode === 'local') {
            this.players = [
                new Mech(100, 376, 'player1', true, this.username),
                new Mech(636, 376, 'player2', false, '玩家2')
            ];
            
            // 本地模式应用武器配置
            this.players[0].setWeapon(this.player1Weapon);
            this.players[1].setWeapon(this.player2Weapon);
        } else {
            if (this.localPlayerIndex === 0) {
                this.players[0] = new Mech(100, 376, 'local', true, this.username);
                if (this.players[1]) {
                    this.players[1].hp = 100;
                    this.players[1].x = 636;
                    this.players[1].y = 376;
                }
                
                // 联机模式统一使用玩家一武器
                this.players[0].setWeapon(this.player1Weapon);
            } else {
                this.players[1] = new Mech(636, 376, 'local', false, this.username);
                if (this.players[0]) {
                    this.players[0].hp = 100;
                    this.players[0].x = 100;
                    this.players[0].y = 376;
                }
                
                // 联机模式统一使用玩家一武器
                this.players[1].setWeapon(this.player1Weapon);
            }
        }
        
        this.updatePlayerLabels();
        this.running = true;
        this.gameLoop();
    },
    
    backToMenu() {
        this.running = false;
        this.scores = [0, 0];
        this.currentRound = 1;
        this.roundOver = false;
        this.updateScoreboard();
        document.getElementById('round-label').classList.add('hidden');
        if (this.networkManager) {
            this.networkManager.disconnect();
            this.networkManager = null;
        }
        this.players = [];
        this.remotePlayers = [];
        this.showMenu();
    },
    
    gameLoop() {
        if (!this.running) return;
        if (this.paused) {
            requestAnimationFrame(() => this.gameLoop());
            return;
        }
        
        this.update();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    },
    
    update() {
        const groundY = 440;
        
        if (this.gameMode === 'local') {
            this.players[0].update(Input.getKeys(1), groundY);
            this.players[1].update(Input.getKeys(2), groundY);
            this.checkPlayerOverlapLocal();
        } else {
            const localKeys = Input.getKeys(1);
            const localPlayer = this.players[this.localPlayerIndex];
            if (localPlayer) {
                localPlayer.update(localKeys, groundY);
                this.blockLocalPlayer(localPlayer);
            }
        }
        
        this.checkCollisions();
        this.checkGameOver();
        
        if (this.gameMode !== 'local' && this.networkManager) {
            const localPlayer = this.players[this.localPlayerIndex];
            if (localPlayer) {
                this.networkManager.sendState(localPlayer);
            }
        }
    },
    
    checkPlayerOverlapLocal() {
        const p1 = this.players[0];
        const p2 = this.players[1];
        
        if (!p1 || !p2) return;
        
        if (p1.x < p2.x + p2.width &&
            p1.x + p1.width > p2.x &&
            p1.y < p2.y + p2.height &&
            p1.y + p1.height > p2.y) {
            
            const overlapX = Math.min(p1.x + p1.width - p2.x, p2.x + p2.width - p1.x);
            const overlapY = Math.min(p1.y + p1.height - p2.y, p2.y + p2.height - p1.y);
            
            if (overlapX < overlapY) {
                if (p1.x < p2.x) {
                    p1.x -= overlapX / 2;
                    p2.x += overlapX / 2;
                } else {
                    p1.x += overlapX / 2;
                    p2.x -= overlapX / 2;
                }
            } else {
                if (p1.y < p2.y) {
                    p1.y -= overlapY;
                    p1.vy = 0;
                } else {
                    p2.y -= overlapY;
                    p2.vy = 0;
                    p2.isGrounded = true;
                }
            }
            
            p1.x = Math.max(0, Math.min(800 - p1.width, p1.x));
            p2.x = Math.max(0, Math.min(800 - p2.width, p2.x));
        }
    },
    
    blockLocalPlayer(localPlayer) {
        const remoteIndex = this.localPlayerIndex === 0 ? 1 : 0;
        const remotePlayer = this.players[remoteIndex];
        if (!remotePlayer) return;
        
        if (localPlayer.x < remotePlayer.x + remotePlayer.width &&
            localPlayer.x + localPlayer.width > remotePlayer.x &&
            localPlayer.y < remotePlayer.y + remotePlayer.height &&
            localPlayer.y + localPlayer.height > remotePlayer.y) {
            
            const overlapX = Math.min(
                localPlayer.x + localPlayer.width - remotePlayer.x,
                remotePlayer.x + remotePlayer.width - localPlayer.x
            );
            const overlapY = Math.min(
                localPlayer.y + localPlayer.height - remotePlayer.y,
                remotePlayer.y + remotePlayer.height - localPlayer.y
            );
            
            if (overlapX < overlapY) {
                if (localPlayer.x < remotePlayer.x) {
                    localPlayer.x = remotePlayer.x - localPlayer.width;
                } else {
                    localPlayer.x = remotePlayer.x + remotePlayer.width;
                }
            } else {
                if (localPlayer.y < remotePlayer.y) {
                    localPlayer.y = remotePlayer.y - localPlayer.height;
                    localPlayer.vy = 0;
                } else {
                    localPlayer.y = remotePlayer.y + remotePlayer.height;
                    localPlayer.vy = 0;
                    localPlayer.isGrounded = true;
                }
            }
            
            localPlayer.x = Math.max(0, Math.min(800 - localPlayer.width, localPlayer.x));
        }
    },
    
    checkCollisions() {
        const p1 = this.players[0];
        const p2 = this.players[1];
        
        if (!p1 || !p2) return;
        
        if (this.gameMode === 'local') {
            if (p1.isAttacking && !p1.hitDealt) {
                const hitbox = Render.getWeaponHitbox(p1);
                if (hitbox && this.checkHitboxOverlap(hitbox, p2)) {
                    if (p2.takeDamage(p1.weapon.damage, p1.facing)) {
                        Render.addHitEffect(p2.x + p2.width / 2, p2.y + p2.height / 2, 
                            p1.isPlayer1 ? '#ff4444' : '#00aaff');
                        p1.hitDealt = true;
                    }
                }
            }
            
            if (p2.isAttacking && !p2.hitDealt) {
                const hitbox = Render.getWeaponHitbox(p2);
                if (hitbox && this.checkHitboxOverlap(hitbox, p1)) {
                    if (p1.takeDamage(p2.weapon.damage, p2.facing)) {
                        Render.addHitEffect(p1.x + p1.width / 2, p1.y + p1.height / 2, 
                            p2.isPlayer1 ? '#ff4444' : '#00aaff');
                        p2.hitDealt = true;
                    }
                }
            }

            this.checkThrownWeaponCollision(p1, p2);
            this.checkThrownWeaponCollision(p2, p1);
            this.checkBulletCollision(p1, p2);
            this.checkBulletCollision(p2, p1);
        } else {
            const localPlayer = this.players[this.localPlayerIndex];
            const remotePlayer = this.players[this.localPlayerIndex === 0 ? 1 : 0];
            
            if (!localPlayer || !remotePlayer) return;
            
            if (localPlayer.isAttacking && !localPlayer.hitDealt) {
                const hitbox = Render.getWeaponHitbox(localPlayer);
                if (hitbox && this.checkHitboxOverlap(hitbox, remotePlayer)) {
                    const damaged = remotePlayer.takeDamage(localPlayer.weapon.damage, localPlayer.facing);
                    localPlayer.hitDealt = true;
                    if (damaged) {
                        if (this.networkManager) {
                            this.networkManager.sendHit(remotePlayer.hp);
                        }
                        Render.addHitEffect(remotePlayer.x + remotePlayer.width / 2, remotePlayer.y + remotePlayer.height / 2, 
                            localPlayer.isPlayer1 ? '#ff4444' : '#00aaff');
                    }
                }
            }
            
            this.checkThrownWeaponCollision(localPlayer, remotePlayer);
            this.checkBulletCollision(localPlayer, remotePlayer);
        }
    },
    
    checkHitboxOverlap(hitbox, mech) {
        return hitbox.x < mech.x + mech.width &&
               hitbox.x + hitbox.width > mech.x &&
               hitbox.y < mech.y + mech.height &&
               hitbox.y + hitbox.height > mech.y;
    },

    checkThrownWeaponCollision(attacker, defender) {
        const thrownHitbox = attacker.getThrownWeaponHitbox();
        if (!thrownHitbox) return;

        if (this.checkHitboxOverlap(thrownHitbox, defender)) {
            if (defender.takeDamage(thrownHitbox.weapon.damage * 0.8, attacker.facing)) {
                attacker.thrownWeapon.active = false;
                attacker.thrownWeapon = null;
                
                Render.addHitEffect(defender.x + defender.width / 2, defender.y + defender.height / 2, 
                    attacker.isPlayer1 ? '#ff4444' : '#00aaff');
                
                if (this.gameMode !== 'local' && this.networkManager) {
                    this.networkManager.sendHit(defender.hp);
                }
            }
        }
    },

    checkBulletCollision(attacker, defender) {
        if (!attacker.bullets) return;
        for (let i = attacker.bullets.length - 1; i >= 0; i--) {
            const b = attacker.bullets[i];
            if (!b.active) continue;
            if (this.checkHitboxOverlap(b, defender)) {
                b.active = false;
                attacker.bullets.splice(i, 1);
                if (defender.takeDamage(b.damage, defender.facing)) {
                    Render.addHitEffect(defender.x + defender.width / 2, defender.y + defender.height / 2,
                        attacker.isPlayer1 ? '#ff4444' : '#00aaff');
                    if (this.gameMode !== 'local' && this.networkManager) {
                        this.networkManager.sendHit(defender.hp);
                    }
                }
            }
        }
    },

    checkGameOver() {
        if (!this.players[0] || !this.players[1]) return;
        if (this.roundOver) return;
        
        let winner = -1;
        if (this.players[0].hp <= 0) {
            winner = 1;
        } else if (this.players[1].hp <= 0) {
            winner = 0;
        }
        
        if (winner === -1) return;
        
        this.roundOver = true;
        this.scores[winner]++;
        this.updateScoreboard();
        
        if (this.gameMode !== 'local') {
            if (this.networkManager) {
                this.networkManager.sendRoundEnd(winner, this.scores);
            }
            this.running = false;
            if (this.scores[winner] >= this.maxScore) {
                const winnerName = this.players[winner].username;
                this.showGameOver(winnerName);
            } else {
                this.showRoundLabel(this.players[winner].username);
                setTimeout(() => {
                    this.resetRound();
                }, 1500);
            }
            return;
        }
        
        if (this.scores[winner] >= this.maxScore) {
            const winnerName = this.players[winner].username;
            this.running = false;
            this.showGameOver(winnerName);
        } else {
            this.running = false;
            this.showRoundLabel(this.players[winner].username);
            setTimeout(() => {
                this.resetRound();
            }, 1500);
        }
    },

    onRemoteRoundEnd(winnerIndex, newScores) {
        if (this.roundOver) return;
        this.roundOver = true;
        this.scores = newScores;
        this.updateScoreboard();
        
        const winnerName = this.players[winnerIndex] ? this.players[winnerIndex].username : '未知';
        if (this.scores[winnerIndex] >= this.maxScore) {
            this.running = false;
            this.showGameOver(winnerName);
        } else {
            this.running = false;
            this.showRoundLabel(winnerName);
            setTimeout(() => {
                this.resetRound();
            }, 1500);
        }
    },

    onRemoteGameOver(winnerName) {
        if (!this.running) return;
        this.running = false;
        this.showGameOver(winnerName);
    },

    resetRound() {
        document.getElementById('round-label').classList.add('hidden');
        this.roundOver = false;
        
        this.players.forEach((player, i) => {
            if (player) {
                player.hp = player.maxHp;
                player.x = i === 0 ? 100 : 636;
                player.y = 376;
                player.vx = 0;
                player.vy = 0;
                player.isAttacking = false;
                player.isDefending = false;
                player.attackCooldown = 0;
                player.invincible = 0;
                player.hitDealt = false;
                player.isThrowing = false;
                player.throwCooldown = 0;
                player.thrownWeapon = null;
                player.bullets = [];
            }
        });
        
        this.currentRound++;
        this.running = true;
        this.gameLoop();
    },

    showRoundLabel(winnerName) {
        const label = document.getElementById('round-label');
        label.textContent = `第 ${this.currentRound} 回合 - ${winnerName} 胜!`;
        label.classList.remove('hidden');
    },

    updateScoreboard() {
        document.getElementById('score-p1').textContent = this.scores[0];
        document.getElementById('score-p2').textContent = this.scores[1];
    },

    showGameOver(winnerName) {
        document.getElementById('round-label').classList.add('hidden');
        document.getElementById('winner-text').textContent = `${winnerName} 最终胜利! 🏆`;
        document.getElementById('game-over-screen').style.display = 'flex';
    },
    
    render() {
        Render.clear();
        Render.drawGround();
        
        this.players.forEach(player => {
            if (player) {
                Render.drawMech(player);
                Render.drawThrownWeapon(player);
                Render.drawBullets(player);
            }
        });
        
        Render.updateHealthBars(this.players);
    }
};

window.addEventListener('load', () => {
    Game.init();
});
