const Weapons = {
    fist: {
        id: 'fist',
        name: '拳头',
        attackCD: 10,
        attackDuration: 12,
        damage: 15,
        range: 50,
        rangeHeight: 40,
        canThrow: false,
        icon: '👊'
    },
    knife: {
        id: 'knife',
        name: '小刀',
        attackCD: 12,
        attackDuration: 14,
        damage: 18,
        range: 70,
        rangeHeight: 38,
        canThrow: true,
        icon: '🔪'
    },
    nunchaku: {
        id: 'nunchaku',
        name: '双截棍',
        attackCD: 16,
        attackDuration: 16,
        damage: 22,
        range: 85,
        rangeHeight: 50,
        canThrow: false,
        icon: '🥢'
    },
    sword: {
        id: 'sword',
        name: '大刀',
        attackCD: 28,
        attackDuration: 22,
        damage: 30,
        range: 115,
        rangeHeight: 60,
        canThrow: false,
        icon: '⚔️'
    },
    axe: {
        id: 'axe',
        name: '斧头',
        attackCD: 22,
        attackDuration: 18,
        damage: 35,
        range: 100,
        rangeHeight: 55,
        canThrow: true,
        icon: '🪓'
    },
    pistol: {
        id: 'pistol',
        name: '手枪',
        attackCD: 18,
        attackDuration: 14,
        damage: 10,
        range: 60,
        rangeHeight: 40,
        canThrow: false,
        canShoot: true,
        bulletCD: 180,
        bulletDamage: 45,
        icon: '🔫'
    },
    ironSword: {
        id: 'ironSword',
        name: '铁剑',
        attackCD: 18,
        attackDuration: 18,
        damage: 30,
        range: 110,
        rangeHeight: 55,
        canThrow: false,
        icon: '🗡️'
    }
};

class Mech {
    constructor(x, y, playerId, isPlayer1, username) {
        this.id = playerId;
        this.username = username || (isPlayer1 ? '玩家1' : '玩家2');
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 64;
        this.height = 64;
        this.hp = 100;
        this.maxHp = 100;
        this.facing = isPlayer1 ? 'right' : 'left';
        this.isAttacking = false;
        this.isDefending = false;
        this.attackCooldown = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.isGrounded = true;
        this.isPlayer1 = isPlayer1;
        this.attackDuration = 0;
        this.invincible = 0;
        this.hitDealt = false;

        // 武器系统
        this.weapon = Weapons.fist;
        this.isThrowing = false;
        this.throwCooldown = 0;
        this.thrownWeapon = null;
        this.shootCooldown = 0;
        this.bullets = [];
    }

    update(keys, groundY) {
        const speed = 4;
        const gravity = 0.6;
        const jumpForce = -12;

        if (keys.left) {
            this.vx = -speed;
            this.facing = 'left';
        } else if (keys.right) {
            this.vx = speed;
            this.facing = 'right';
        } else {
            this.vx *= 0.7;
            if (Math.abs(this.vx) < 0.5) this.vx = 0;
        }

        if (keys.up && this.isGrounded) {
            this.vy = jumpForce;
            this.isGrounded = false;
        }

        this.vy += gravity;

        this.x += this.vx;
        this.y += this.vy;

        if (this.y + this.height > groundY) {
            this.y = groundY - this.height;
            this.vy = 0;
            this.isGrounded = true;
        }

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > 800) this.x = 800 - this.width;

        if (keys.attack && this.attackCooldown <= 0 && !this.isAttacking && !this.isThrowing) {
            this.isAttacking = true;
            this.attackDuration = this.weapon.attackDuration;
            this.attackCooldown = this.weapon.attackCD;
            this.hitDealt = false;
        }

        // 投掷武器（仅可投掷武器）
        if (keys.throw && this.throwCooldown <= 0 && this.weapon.canThrow && !this.thrownWeapon) {
            const throwSpeed = 11;
            this.thrownWeapon = {
                weapon: { ...this.weapon },
                x: this.x + (this.facing === 'right' ? this.width : -10),
                y: this.y + 20,
                vx: (this.facing === 'right' ? throwSpeed : -throwSpeed),
                vy: -3,
                width: 20,
                height: 12,
                active: true,
                groundTimer: 0
            };
            this.weapon = Weapons.fist;
            this.throwCooldown = 60;
        }

        if (keys.throw && this.weapon.canShoot && this.shootCooldown <= 0) {
            this.bullets.push({
                x: this.x + (this.facing === 'right' ? this.width : 0),
                y: this.y + 30,
                vx: this.facing === 'right' ? 10 : -10,
                vy: 0,
                width: 8,
                height: 4,
                active: true,
                damage: this.weapon.bulletDamage || 45
            });
            this.shootCooldown = this.weapon.bulletCD || 180;
        }

        this.isDefending = keys.defend;

        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.throwCooldown > 0) this.throwCooldown--;
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (this.attackDuration > 0) {
            this.attackDuration--;
            if (this.attackDuration <= 0) {
                this.isAttacking = false;
            }
        }
        if (this.invincible > 0) this.invincible--;

        if (this.thrownWeapon && this.thrownWeapon.active) {
            if (this.thrownWeapon.groundTimer > 0) {
                this.thrownWeapon.groundTimer--;
                if (this.thrownWeapon.groundTimer <= 0) {
                    this.weapon = Weapons[this.thrownWeapon.weapon.id] || Weapons.fist;
                    this.thrownWeapon = null;
                }
            } else {
                this.thrownWeapon.x += this.thrownWeapon.vx;
                this.thrownWeapon.y += this.thrownWeapon.vy;
                this.thrownWeapon.vy += 0.3;

                if (this.thrownWeapon.y + this.thrownWeapon.height > groundY) {
                    this.thrownWeapon.y = groundY - this.thrownWeapon.height;
                    this.thrownWeapon.vx = 0;
                    this.thrownWeapon.vy = 0;
                    this.thrownWeapon.groundTimer = 180;
                }

                if (this.thrownWeapon.x < -50 || this.thrownWeapon.x > 850) {
                    this.thrownWeapon.active = false;
                    this.thrownWeapon = null;
                }
            }
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            if (b.x < -20 || b.x > 820 || b.y < 0 || b.y > groundY) {
                this.bullets.splice(i, 1);
            }
        }

        this.animTimer++;
        if (this.animTimer >= 8) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
    }

    takeDamage(amount, attackerFacing) {
        if (this.invincible > 0) return false;
        if (this.isDefending) {
            amount = Math.floor(amount * 0.3);
        }
        this.hp -= amount;
        this.invincible = 30;

        const knockbackX = this.isDefending ? 3 : 8;
        const knockbackY = this.isDefending ? -2 : -6;
        const dir = attackerFacing === 'right' ? 1 : -1;
        this.vx += knockbackX * dir;
        this.vy += knockbackY;

        if (this.hp < 0) this.hp = 0;
        return true;
    }

    setWeapon(weaponId) {
        if (Weapons[weaponId]) {
            this.weapon = Weapons[weaponId];
        }
    }

    getThrownWeaponHitbox() {
        if (!this.thrownWeapon || !this.thrownWeapon.active) return null;
        return this.thrownWeapon;
    }

    getBullets() {
        return this.bullets.filter(b => b.active);
    }
}
