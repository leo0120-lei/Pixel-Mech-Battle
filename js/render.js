const Render = {
    ctx: null,
    trails: [],
    hitEffects: [],
    
    init(canvas) {
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
    },
    
    clear() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, 500);
        gradient.addColorStop(0, '#0a0a2a');
        gradient.addColorStop(0.5, '#1a1a3a');
        gradient.addColorStop(1, '#0a0a1a');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, 800, 500);
        
        this.drawStars();
        
        this.cleanupEffects();
        this.drawTrails();
        this.drawHitEffects();
    },
    
    drawStars() {
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            const x = (i * 137) % 800;
            const y = (i * 73) % 350;
            const size = (i % 3) + 1;
            this.ctx.fillRect(x, y, size, size);
        }
    },
    
    drawGround() {
        this.ctx.fillStyle = '#2a2a4a';
        this.ctx.fillRect(0, 440, 800, 60);
        
        this.ctx.fillStyle = '#3a3a5a';
        for (let i = 0; i < 40; i++) {
            this.ctx.fillRect(i * 20, 440, 15, 8);
        }
        
        this.ctx.fillStyle = '#4a4a6a';
        this.ctx.fillRect(0, 440, 800, 4);
    },
    
    drawMech(mech) {
        const ctx = this.ctx;
        const x = mech.x;
        const y = mech.y;
        
        if (mech.invincible > 0 && Math.floor(mech.invincible / 4) % 2 === 0) {
            return;
        }
        
        ctx.save();
        
        if (mech.facing === 'left') {
            ctx.translate(x + mech.width, y);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(x, y);
        }
        
        const colors = mech.isPlayer1 ? 
            { main: '#00aaff', dark: '#0066aa', light: '#66ddff' } :
            { main: '#ff4444', dark: '#aa2222', light: '#ff8888' };
        
        if (mech.isDefending) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.fillRect(-10, 0, mech.width + 20, mech.height);
        }
        
        ctx.fillStyle = colors.dark;
        ctx.fillRect(12, 20, 40, 30);
        
        ctx.fillStyle = colors.main;
        ctx.fillRect(16, 24, 32, 22);
        
        ctx.fillStyle = colors.main;
        ctx.fillRect(20, 4, 24, 20);
        
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(34, 10, 8, 6);
        
        ctx.fillStyle = colors.dark;
        const legOffset = Math.sin(mech.animFrame * 0.8) * 4;
        ctx.fillRect(18, 50, 10, 14 + (mech.vx !== 0 ? legOffset : 0));
        ctx.fillRect(36, 50, 10, 14 - (mech.vx !== 0 ? legOffset : 0));
        
        ctx.fillStyle = colors.light;
        ctx.fillRect(16, 60, 14, 6);
        ctx.fillRect(34, 60, 14, 6);
        
        this.drawArmAndWeapon(mech, ctx, colors);
        
        ctx.fillStyle = colors.dark;
        ctx.fillRect(4, 28, 10, 16);
        
        ctx.restore();
        
        if (mech.isAttacking) {
            const hitbox = this.getWeaponHitbox(mech);
            if (hitbox) {
                this.drawAttackEffect(hitbox, colors, mech.weapon);
            }
        }
        
        if (mech.isAttacking && mech.weapon.id !== 'fist') {
            this.addTrail(mech);
        }
    },
    
    getWeaponHitbox(mech) {
        if (!mech.isAttacking) return null;
        
        const progress = 1 - (mech.attackDuration / mech.weapon.attackDuration);
        let weaponHitbox = { x: 0, y: 0, width: 0, height: 0 };
        
        switch (mech.weapon.id) {
            case 'knife':
                const knifeX = progress * 45;
                weaponHitbox = {
                    x: mech.facing === 'right' ? mech.x + mech.width + knifeX - 5 : 
                       mech.x - knifeX - 30,
                    y: mech.y + 24,
                    width: 35,
                    height: 20
                };
                break;
            case 'nunchaku':
                const nunPhase = progress * Math.PI * 2;
                const nunX = Math.sin(nunPhase) * 40;
                weaponHitbox = {
                    x: mech.facing === 'right' ? mech.x + mech.width + nunX - 20 : 
                       mech.x - nunX - 40,
                    y: mech.y + 15,
                    width: 50,
                    height: 40
                };
                break;
            case 'sword':
                const swordPhase = progress * Math.PI;
                const swordX = Math.sin(swordPhase) * 60;
                const swordY = Math.sin(swordPhase * 2) * 15;
                weaponHitbox = {
                    x: mech.facing === 'right' ? mech.x + mech.width + swordX - 10 : 
                       mech.x - swordX - 55,
                    y: mech.y + 5 + swordY,
                    width: 65,
                    height: 55
                };
                break;
            case 'axe':
                const axePhase = progress * Math.PI;
                const axeX = Math.sin(axePhase) * 50;
                const axeY = Math.sin(axePhase * 1.5) * 12;
                weaponHitbox = {
                    x: mech.facing === 'right' ? mech.x + mech.width + axeX - 8 : 
                       mech.x - axeX - 50,
                    y: mech.y + 8 + axeY,
                    width: 58,
                    height: 50
                };
                break;
            case 'fist':
            case 'pistol':
            default:
                const baseRange = mech.weapon.range || 50;
                weaponHitbox = {
                    x: mech.facing === 'right' ? mech.x + mech.width : 
                       mech.x - baseRange,
                    y: mech.y + 24,
                    width: baseRange,
                    height: 40
                };
                break;
            case 'ironSword':
                const ironPhase = progress * Math.PI;
                const ironX = Math.sin(ironPhase) * 55;
                const ironY = Math.sin(ironPhase * 2) * 12;
                weaponHitbox = {
                    x: mech.facing === 'right' ? mech.x + mech.width + ironX - 10 : 
                       mech.x - ironX - 55,
                    y: mech.y + 8 + ironY,
                    width: 60,
                    height: 52
                };
        }
        
        if (weaponHitbox.width > 0) {
            weaponHitbox = this.clampHitboxToMech(weaponHitbox, mech);
        }
        
        return weaponHitbox;
    },

    clampHitboxToMech(hitbox, mech) {
        if (mech.facing === 'left') {
            if (hitbox.x < 0) hitbox.x = 0;
        }
        return hitbox;
    },
    
    drawArmAndWeapon(mech, ctx, colors) {
        const isAttacking = mech.isAttacking;
        
        if (isAttacking) {
            const progress = 1 - (mech.attackDuration / mech.weapon.attackDuration);
            const armX = 52 + Math.sin(progress * Math.PI) * 25;
            ctx.fillStyle = colors.light;
            ctx.fillRect(armX, 28, 30, 10);
            
            if (mech.weapon.id !== 'fist') {
                this.drawAttackingWeapon(mech, ctx, progress);
            }
        } else {
            ctx.fillStyle = colors.main;
            ctx.fillRect(50, 28, 10, 16);
            
            if (mech.weapon.id !== 'fist') {
                this.drawWeapon(mech, ctx);
            }
        }
    },
    
    drawWeapon(mech, ctx) {
        switch (mech.weapon.id) {
            case 'knife':
                ctx.fillStyle = '#6a5a4a';
                ctx.fillRect(56, 32, 8, 8);
                ctx.fillStyle = '#a0a0a0';
                ctx.fillRect(62, 26, 10, 24);
                ctx.fillStyle = '#c0c0c0';
                ctx.fillRect(63, 28, 8, 20);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(64, 30, 4, 8);
                break;
                
            case 'nunchaku':
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(54, 24, 8, 18);
                ctx.fillRect(68, 24, 8, 18);
                ctx.fillStyle = '#707070';
                ctx.fillRect(61, 32, 8, 4);
                ctx.fillRect(62, 36, 6, 4);
                ctx.fillRect(63, 40, 4, 4);
                break;
                
            case 'sword':
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(58, 14, 12, 10);
                ctx.fillStyle = '#808080';
                ctx.fillRect(55, 22, 18, 6);
                ctx.fillStyle = '#a8a8a8';
                ctx.fillRect(60, 26, 10, 36);
                ctx.fillStyle = '#c8c8c8';
                ctx.fillRect(61, 28, 8, 32);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(62, 30, 4, 14);
                break;
                
            case 'axe':
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(62, 16, 6, 36);
                ctx.fillStyle = '#808080';
                ctx.fillRect(50, 20, 18, 16);
                ctx.fillStyle = '#a8a8a8';
                ctx.fillRect(52, 22, 14, 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(54, 24, 4, 4);
                break;

            case 'pistol':
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(54, 26, 20, 12);
                ctx.fillStyle = '#555555';
                ctx.fillRect(56, 28, 16, 8);
                ctx.fillStyle = '#222222';
                ctx.fillRect(50, 30, 10, 6);
                ctx.fillStyle = '#666666';
                ctx.fillRect(68, 30, 6, 4);
                break;

            case 'ironSword':
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(56, 16, 14, 10);
                ctx.fillStyle = '#707070';
                ctx.fillRect(54, 24, 18, 6);
                ctx.fillStyle = '#909090';
                ctx.fillRect(60, 28, 10, 32);
                ctx.fillStyle = '#b0b0b0';
                ctx.fillRect(61, 30, 8, 28);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(62, 32, 4, 12);
                break;
        }
    },
    
    drawAttackingWeapon(mech, ctx, progress) {
        const weaponId = mech.weapon.id;
        
        switch (weaponId) {
            case 'knife':
                const knifeX = progress * 45;
                ctx.fillStyle = '#6a5a4a';
                ctx.fillRect(60 + knifeX, 28, 8, 8);
                ctx.fillStyle = '#a0a0a0';
                ctx.fillRect(66 + knifeX, 22, 10, 24);
                ctx.fillStyle = '#c0c0c0';
                ctx.fillRect(67 + knifeX, 24, 8, 20);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(68 + knifeX, 26, 4, 8);
                break;
                
            case 'nunchaku':
                const nunAngle = progress * Math.PI * 2;
                const nun1X = Math.sin(nunAngle) * 35;
                const nun2X = Math.sin(nunAngle + Math.PI / 2) * 35;
                const nun1Y = Math.cos(nunAngle) * 15;
                const nun2Y = Math.cos(nunAngle + Math.PI / 2) * 15;
                
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(55 + nun1X, 20 + nun1Y, 8, 18);
                ctx.fillRect(69 + nun2X, 20 + nun2Y, 8, 18);
                ctx.fillStyle = '#707070';
                ctx.fillRect(62 + (nun1X + nun2X) / 2, 
                    28 + (nun1Y + nun2Y) / 2, 8, 4);
                break;
                
            case 'sword':
                const swordPhase = progress * Math.PI;
                const swordX = Math.sin(swordPhase) * 60;
                const swordY = Math.sin(swordPhase * 2) * 15;
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(62 + swordX, 8 + swordY, 12, 10);
                ctx.fillStyle = '#808080';
                ctx.fillRect(59 + swordX, 16 + swordY, 18, 6);
                ctx.fillStyle = '#a8a8a8';
                ctx.fillRect(64 + swordX, 20 + swordY, 10, 36);
                ctx.fillStyle = '#c8c8c8';
                ctx.fillRect(65 + swordX, 22 + swordY, 8, 32);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(66 + swordX, 24 + swordY, 4, 14);
                break;
                
            case 'axe':
                const axePhase = progress * Math.PI;
                const axeX = Math.sin(axePhase) * 50;
                const axeY = Math.sin(axePhase * 1.5) * 12;
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(66 + axeX, 12 + axeY, 6, 36);
                ctx.fillStyle = '#808080';
                ctx.fillRect(54 + axeX, 16 + axeY, 18, 16);
                ctx.fillStyle = '#a8a8a8';
                ctx.fillRect(56 + axeX, 18 + axeY, 14, 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(58 + axeX, 20 + axeY, 4, 4);
                break;

            case 'pistol':
                const pistolX = Math.sin(progress * Math.PI) * 15;
                ctx.fillStyle = '#3a3a3a';
                ctx.fillRect(58 + pistolX, 24, 20, 12);
                ctx.fillStyle = '#555555';
                ctx.fillRect(60 + pistolX, 26, 16, 8);
                ctx.fillStyle = '#222222';
                ctx.fillRect(54 + pistolX, 28, 10, 6);
                ctx.fillStyle = '#666666';
                ctx.fillRect(72 + pistolX, 28, 6, 4);
                break;

            case 'ironSword':
                const ironX = Math.sin(progress * Math.PI) * 55;
                const ironY = Math.sin(progress * Math.PI * 2) * 12;
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(61 + ironX, 10 + ironY, 14, 10);
                ctx.fillStyle = '#707070';
                ctx.fillRect(59 + ironX, 18 + ironY, 18, 6);
                ctx.fillStyle = '#909090';
                ctx.fillRect(65 + ironX, 22 + ironY, 10, 32);
                ctx.fillStyle = '#b0b0b0';
                ctx.fillRect(66 + ironX, 24 + ironY, 8, 28);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(67 + ironX, 26 + ironY, 4, 12);
                break;
        }
    },
    
    drawAttackEffect(hitbox, colors, weapon) {
        const ctx = this.ctx;
        
        const gradient = ctx.createRadialGradient(
            hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2,
            0,
            hitbox.x + hitbox.width / 2, hitbox.y + hitbox.height / 2,
            Math.max(hitbox.width, hitbox.height) * 0.8
        );
        
        if (weapon.id === 'sword' || weapon.id === 'axe') {
            gradient.addColorStop(0, 'rgba(255, 220, 100, 0.5)');
            gradient.addColorStop(1, 'rgba(255, 150, 50, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(100, 255, 255, 0.4)');
            gradient.addColorStop(1, 'rgba(50, 200, 255, 0)');
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(
            hitbox.x + hitbox.width / 2, 
            hitbox.y + hitbox.height / 2, 
            Math.max(hitbox.width, hitbox.height) * 0.7,
            0,
            Math.PI * 2
        );
        ctx.fill();
    },
    
    addTrail(mech) {
        if (mech.isAttacking) {
            const trail = {
                x: mech.x + mech.width / 2,
                y: mech.y + 30,
                color: mech.isPlayer1 ? '#66ddff' : '#ff8888',
                life: 18
            };
            this.trails.push(trail);
        }
    },
    
    drawTrails() {
        const ctx = this.ctx;
        for (let i = this.trails.length - 1; i >= 0; i--) {
            const trail = this.trails[i];
            const alpha = trail.life / 18;
            const size = 7 + (18 - trail.life) * 0.6;
            
            ctx.fillStyle = trail.color.replace(')', `, ${alpha * 0.6})`).replace('rgb', 'rgba');
            ctx.beginPath();
            ctx.arc(trail.x, trail.y, size, 0, Math.PI * 2);
            ctx.fill();
            
            trail.life--;
            if (trail.life <= 0) {
                this.trails.splice(i, 1);
            }
        }
    },
    
    addHitEffect(x, y, color) {
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const speed = 2.5 + Math.random() * 5;
            this.hitEffects.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 28,
                color: color,
                size: 2.5 + Math.random() * 3.5
            });
        }
    },
    
    drawHitEffects() {
        const ctx = this.ctx;
        for (let i = this.hitEffects.length - 1; i >= 0; i--) {
            const effect = this.hitEffects[i];
            const alpha = effect.life / 28;
            
            ctx.fillStyle = effect.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
            ctx.fillRect(effect.x - effect.size / 2, effect.y - effect.size / 2, effect.size, effect.size);
            
            effect.x += effect.vx;
            effect.y += effect.vy;
            effect.vy += 0.25;
            effect.life--;
            
            if (effect.life <= 0) {
                this.hitEffects.splice(i, 1);
            }
        }
    },
    
    cleanupEffects() {
        if (this.trails.length > 100) this.trails.splice(0, this.trails.length - 100);
        if (this.hitEffects.length > 250) this.hitEffects.splice(0, this.hitEffects.length - 250);
    },
    
    drawThrownWeapon(mech) {
        if (!mech.thrownWeapon || !mech.thrownWeapon.active) return;

        const ctx = this.ctx;
        const tw = mech.thrownWeapon;
        const weaponId = tw.weapon.id;

        ctx.save();

        if (tw.groundTimer > 0) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(tw.x - 2, tw.y - 2, tw.width + 4, tw.height + 4);
        }
        
        const time = Date.now() / 90;
        const rotation = tw.groundTimer > 0 ? 0 : (tw.vx > 0 ? time : -time);
        ctx.translate(tw.x + tw.width / 2, tw.y + tw.height / 2);
        ctx.rotate(rotation);

        switch (weaponId) {
            case 'knife':
                ctx.fillStyle = '#6a5a4a';
                ctx.fillRect(-4, -4, 8, 8);
                ctx.fillStyle = '#a0a0a0';
                ctx.fillRect(-5, -14, 10, 24);
                ctx.fillStyle = '#c0c0c0';
                ctx.fillRect(-4, -12, 8, 20);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-3, -10, 4, 8);
                break;
                
            case 'axe':
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(-3, -18, 6, 36);
                ctx.fillStyle = '#808080';
                ctx.fillRect(-9, -14, 18, 16);
                ctx.fillStyle = '#a8a8a8';
                ctx.fillRect(-7, -12, 14, 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-5, -10, 4, 4);
                break;
        }

        ctx.restore();
        
        if (tw.groundTimer <= 0) {
            this.trails.push({
                x: tw.x + tw.width / 2,
                y: tw.y + tw.height / 2,
                color: mech.isPlayer1 ? '#66ddff' : '#ff8888',
                life: 14
            });
        }
    },

    drawBullets(mech) {
        const ctx = this.ctx;
        if (!mech.bullets) return;
        
        for (const b of mech.bullets) {
            if (!b.active) continue;
            
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(b.x, b.y, b.width, b.height);
            
            ctx.fillStyle = '#ff8800';
            ctx.fillRect(b.x + (b.vx > 0 ? -2 : b.width), b.y + 1, 4, 2);
            
            ctx.fillStyle = 'rgba(255, 255, 100, 0.4)';
            ctx.fillRect(b.x - 2, b.y - 1, b.width + 4, b.height + 2);
        }
    },
    
    updateHealthBars(players) {
        if (players[0]) {
            const healthPercent = (players[0].hp / players[0].maxHp) * 100;
            document.querySelector('#player1-health .health-bar').style.width = healthPercent + '%';
        }
        if (players[1]) {
            const healthPercent = (players[1].hp / players[1].maxHp) * 100;
            document.querySelector('#player2-health .health-bar').style.width = healthPercent + '%';
        }
    }
};
