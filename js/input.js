const Input = {
    keys1: { left: false, right: false, up: false, attack: false, defend: false, throw: false },
    keys2: { left: false, right: false, up: false, attack: false, defend: false, throw: false },
    
    init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    },
    
    handleKeyDown(e) {
        if (!e.key) return;
        switch (e.key.toLowerCase()) {
            case 'a': this.keys1.left = true; break;
            case 'd': this.keys1.right = true; break;
            case 'w': this.keys1.up = true; break;
            case ' ': this.keys1.attack = true; break;
            case 's': this.keys1.throw = true; break;

            case 'arrowleft': this.keys2.left = true; break;
            case 'arrowright': this.keys2.right = true; break;
            case 'arrowup': this.keys2.up = true; break;
            case 'arrowdown': this.keys2.attack = true; break;
            case 'control': this.keys2.throw = true; break;
        }
    },

    handleKeyUp(e) {
        if (!e.key) return;
        switch (e.key.toLowerCase()) {
            case 'a': this.keys1.left = false; break;
            case 'd': this.keys1.right = false; break;
            case 'w': this.keys1.up = false; break;
            case ' ': this.keys1.attack = false; break;
            case 's': this.keys1.throw = false; break;

            case 'arrowleft': this.keys2.left = false; break;
            case 'arrowright': this.keys2.right = false; break;
            case 'arrowup': this.keys2.up = false; break;
            case 'arrowdown': this.keys2.attack = false; break;
            case 'control': this.keys2.throw = false; break;
        }
    },
    
    getKeys(playerNum) {
        return playerNum === 1 ? this.keys1 : this.keys2;
    }
};
