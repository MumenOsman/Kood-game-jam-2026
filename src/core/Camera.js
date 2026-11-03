/**
 * Camera.js
 * 2D tracking camera with smooth interpolation (lerping), bounds clamping,
 * and coordinate transform utilities.
 */
export class Camera {
    constructor(viewportWidth, viewportHeight) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;

        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;

        this.smoothness = 0.08; // Higher = tighter, lower = smoother

        // Bounds
        this.bounds = {
            minX: 0,
            minY: 0,
            maxX: 5000,
            maxY: 1200
        };
    }

    setBounds(minX, minY, maxX, maxY) {
        this.bounds.minX = minX;
        this.bounds.minY = minY;
        this.bounds.maxX = maxX;
        this.bounds.maxY = maxY;
    }

    resize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    /**
     * Follow an entity target (e.g. player)
     * @param {{x: number, y: number, width?: number, height?: number}} target 
     * @param {number} offsetX 
     * @param {number} offsetY 
     */
    follow(target, offsetX = 0, offsetY = 0) {
        const targetCenterX = target.x + (target.width ? target.width / 2 : 0) + offsetX;
        const targetCenterY = target.y + (target.height ? target.height / 2 : 0) + offsetY;

        this.targetX = targetCenterX - this.viewportWidth / 2;
        this.targetY = targetCenterY - this.viewportHeight / 2;

        this._clampTarget();
    }

    snapTo(x, y) {
        this.targetX = x - this.viewportWidth / 2;
        this.targetY = y - this.viewportHeight / 2;
        this._clampTarget();
        this.x = this.targetX;
        this.y = this.targetY;
    }

    _clampTarget() {
        const maxScrollX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewportWidth);
        const maxScrollY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewportHeight);

        this.targetX = Math.max(this.bounds.minX, Math.min(this.targetX, maxScrollX));
        this.targetY = Math.max(this.bounds.minY, Math.min(this.targetY, maxScrollY));
    }

    update() {
        this.x += (this.targetX - this.x) * this.smoothness;
        this.y += (this.targetY - this.y) * this.smoothness;
    }

    applyTransform(ctx) {
        ctx.save();
        ctx.translate(-Math.round(this.x), -Math.round(this.y));
    }

    restoreTransform(ctx) {
        ctx.restore();
    }

    screenToWorld(sx, sy) {
        return { x: sx + this.x, y: sy + this.y };
    }

    worldToScreen(wx, wy) {
        return { x: wx - this.x, y: wy - this.y };
    }
}

