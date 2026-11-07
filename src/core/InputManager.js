/**
 * InputManager.js
 * Captures keyboard and mouse events, coordinates screen/world mouse mappings,
 * and tracks single-frame edge triggers (pressed / released this frame).
 */
export class InputManager {
    constructor(canvas, camera = null) {
        this.canvas = canvas;
        this.camera = camera;

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

        this._bindEvents();
    }

    setCamera(camera) {
        this.camera = camera;
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

        // Keep mouseWorld synced with moving camera
        this._syncWorldMouse();
    }

    // Helper query methods
    isKeyDown(code) {
        return this.keysDown.has(code);
    }

    isKeyPressed(code) {
        return this.keysPressedThisFrame.has(code);
    }

    isKeyReleased(code) {
        return this.keysReleasedThisFrame.has(code);
    }

    // High-level action checks
    get moveLeft() {
        return this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft');
    }

    get moveRight() {
        return this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight');
    }

    get moveUp() {
        return this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp');
    }

    get moveDown() {
        return this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown');
    }

    get isRunning() {
        return this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight');
    }

    get jumpPressed() {
        return this.isKeyPressed('Space');
    }

    get downPressed() {
        return this.isKeyPressed('KeyS') || this.isKeyPressed('ArrowDown');
    }

    get interactPressed() {
        return this.isKeyPressed('KeyE');
    }
}

