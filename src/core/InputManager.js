/**
 * InputManager.js
 * Captures keyboard and mouse events, coordinates screen/world mouse mappings,
 * tracks single-frame edge triggers, and provides configurable keybindings
 * with persistence in localStorage.
 */
export class InputManager {
    constructor(canvas, camera = null) {
        this.canvas = canvas;
        this.camera = camera;
        this.STORAGE_KEY = 'tether_keybindings_v1';

        // Key states
        this.keysDown = new Set();
        this.keysPressedThisFrame = new Set();
        this.keysReleasedThisFrame = new Set();

        // Mouse states
        this.mouseScreen = { x: 0, y: 0 };
        this.mouseWorld = { x: 0, y: 0 };
        this.isLeftDown = false;
        this.isRightDown = false;
        this.leftPressedThisFrame = false;
        this.rightPressedThisFrame = false;
        this.leftReleasedThisFrame = false;
        this.rightReleasedThisFrame = false;

        // Default configurable bindings
        this.defaultBindings = {
            moveLeft: ['KeyA', 'ArrowLeft'],
            moveRight: ['KeyD', 'ArrowRight'],
            moveUp: ['KeyW', 'ArrowUp'],
            moveDown: ['KeyS', 'ArrowDown'],
            jump: ['Space'],
            dock: ['KeyS', 'ArrowDown'],
            interact: ['KeyE'],
            shootWire: ['Mouse0'],
            cutWire: ['Mouse2']
        };

        this.bindings = JSON.parse(JSON.stringify(this.defaultBindings));
        this._loadBindings();

        this._bindEvents();
    }

    setCamera(camera) {
        this.camera = camera;
    }

    _loadBindings() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                for (const act of Object.keys(this.defaultBindings)) {
                    if (Array.isArray(parsed[act]) && parsed[act].length > 0) {
                        this.bindings[act] = parsed[act];
                    }
                }
            }
        } catch (e) {
            console.warn('[InputManager] Could not load custom bindings:', e);
        }
    }

    _saveBindings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.bindings));
        } catch (e) {
            console.warn('[InputManager] Could not save custom bindings:', e);
        }
    }

    rebind(action, code) {
        if (!this.bindings[action] || !code) return false;
        this.bindings[action] = [code];
        this._saveBindings();
        return true;
    }

    resetDefaults() {
        this.bindings = JSON.parse(JSON.stringify(this.defaultBindings));
        this._saveBindings();
    }

    getBindingDisplayName(action) {
        const codes = this.bindings[action] || this.defaultBindings[action] || [];
        if (!codes.length) return 'NONE';

        const formatCode = (c) => {
            if (c === 'Mouse0') return 'LMB';
            if (c === 'Mouse2') return 'RMB';
            if (c === 'Mouse1') return 'MMB';
            if (c === 'Space') return 'SPACE';
            if (c.startsWith('Key')) return c.substring(3);
            if (c.startsWith('Digit')) return c.substring(5);
            if (c.startsWith('Arrow')) return c.substring(5).toUpperCase();
            if (c.startsWith('Shift')) return 'SHIFT';
            if (c.startsWith('Control')) return 'CTRL';
            if (c.startsWith('Alt')) return 'ALT';
            return c;
        };

        return codes.map(formatCode).join(' / ');
    }

    _bindEvents() {
        window.addEventListener('keydown', (e) => {
            const code = e.code;
            if (!this.keysDown.has(code)) {
                this.keysPressedThisFrame.add(code);
            }
            this.keysDown.add(code);

            // Prevent scroll on Space / Arrows
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            const code = e.code;
            this.keysDown.delete(code);
            this.keysReleasedThisFrame.add(code);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this._updateMouseCoordinates(e);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this._updateMouseCoordinates(e);
            if (e.button === 0) { // Left click
                this.isLeftDown = true;
                this.leftPressedThisFrame = true;
            } else if (e.button === 2) { // Right click
                this.isRightDown = true;
                this.rightPressedThisFrame = true;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                if (this.isLeftDown) this.leftReleasedThisFrame = true;
                this.isLeftDown = false;
            } else if (e.button === 2) {
                if (this.isRightDown) this.rightReleasedThisFrame = true;
                this.isRightDown = false;
            }
        });

        // Prevent browser context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    _updateMouseCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        this.mouseScreen.x = (e.clientX - rect.x) * scaleX;
        this.mouseScreen.y = (e.clientY - rect.y) * scaleY;

        this._syncWorldMouse();
    }

    _syncWorldMouse() {
        if (this.camera && typeof this.camera.screenToWorld === 'function') {
            const world = this.camera.screenToWorld(this.mouseScreen.x, this.mouseScreen.y);
            this.mouseWorld.x = world.x;
            this.mouseWorld.y = world.y;
        } else if (this.camera) {
            this.mouseWorld.x = this.mouseScreen.x + this.camera.x;
            this.mouseWorld.y = this.mouseScreen.y + this.camera.y;
        } else {
            this.mouseWorld.x = this.mouseScreen.x;
            this.mouseWorld.y = this.mouseScreen.y;
        }
    }

    /**
     * Call at the end of the frame to clear edge-triggered events.
     */
    postUpdate() {
        this.keysPressedThisFrame.clear();
        this.keysReleasedThisFrame.clear();
        this.leftPressedThisFrame = false;
        this.rightPressedThisFrame = false;
        this.leftReleasedThisFrame = false;
        this.rightReleasedThisFrame = false;

        this._syncWorldMouse();
    }

    // Helper query methods
    isKeyDown(code) {
        if (code === 'Mouse0') return this.isLeftDown;
        if (code === 'Mouse2') return this.isRightDown;
        return this.keysDown.has(code);
    }

    isKeyPressed(code) {
        if (code === 'Mouse0') return this.leftPressedThisFrame;
        if (code === 'Mouse2') return this.rightPressedThisFrame;
        return this.keysPressedThisFrame.has(code);
    }

    isKeyReleased(code) {
        if (code === 'Mouse0') return this.leftReleasedThisFrame;
        if (code === 'Mouse2') return this.rightReleasedThisFrame;
        return this.keysReleasedThisFrame.has(code);
    }

    isActionDown(action) {
        const codes = this.bindings[action] || this.defaultBindings[action] || [];
        return codes.some(c => this.isKeyDown(c));
    }

    isActionPressed(action) {
        const codes = this.bindings[action] || this.defaultBindings[action] || [];
        return codes.some(c => this.isKeyPressed(c));
    }

    // High-level action getters
    get moveLeft() {
        return this.isActionDown('moveLeft');
    }

    get moveRight() {
        return this.isActionDown('moveRight');
    }

    get moveUp() {
        return this.isActionDown('moveUp');
    }

    get moveDown() {
        return this.isActionDown('moveDown');
    }

    get isRunning() {
        return false;
    }

    get jumpPressed() {
        return this.isActionPressed('jump');
    }

    get downPressed() {
        return this.isActionPressed('dock');
    }

    get interactPressed() {
        return this.isActionPressed('interact');
    }

    /**
     * Map-like access proxy for keys: e.g. input.keys['KeyD'] -> input.isKeyDown('KeyD')
     */
    get keys() {
        return new Proxy(this, {
            get: (target, prop) => (typeof prop === 'string' ? target.isKeyDown(prop) : false)
        });
    }
}
