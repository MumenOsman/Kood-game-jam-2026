/**
 * Camera.js
 * 2D tracking camera supporting:
 * - Room-by-room transitions (Celeste / Metroid style smooth panning).
 * - Responsive aspect-ratio scaling fitting any display resolution.
 * - Exact screen-to-world and world-to-screen matrix transformations.
 */
export class Camera {
    constructor(viewportWidth, viewportHeight) {
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;

        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;

        this.smoothness = 0.10; // Glide speed during room transition

        // Room-by-room mode
        this.isRoomMode = false;
        this.roomWidth = 640;
        this.roomHeight = 320;
        this.totalRooms = 1;
        this.currentRoomIndex = 0;

        // Viewport scaling & letterboxing
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this._computeScale();
    }

    setRoomMode(roomWidth = 640, roomHeight = 320, totalRooms = 3) {
        this.isRoomMode = true;
        this.roomWidth = roomWidth;
        this.roomHeight = roomHeight;
        this.totalRooms = totalRooms;
        this.currentRoomIndex = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.x = 0;
        this.y = 0;
        this._computeScale();
    }

    resize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
        this._computeScale();
    }

    _computeScale() {
        if (!this.isRoomMode) {
            this.scale = 1;
            this.offsetX = 0;
            this.offsetY = 0;
            return;
        }

        // Fit 640x320 room inside current canvas maintaining aspect ratio
        const scaleX = this.viewportWidth / this.roomWidth;
        const scaleY = this.viewportHeight / this.roomHeight;
        this.scale = Math.min(scaleX, scaleY);

        // Center on screen
        const renderW = this.roomWidth * this.scale;
        const renderH = this.roomHeight * this.scale;
        this.offsetX = Math.max(0, (this.viewportWidth - renderW) / 2);
        this.offsetY = Math.max(0, (this.viewportHeight - renderH) / 2);
    }

    /**
     * Follow player across room boundaries with Celeste-style smooth slide
     */
    follow(target) {
        if (!this.isRoomMode) {
            // Free follow mode
            this.targetX = target.x - this.viewportWidth / 2;
            this.targetY = target.y - this.viewportHeight / 2;
            return;
        }

        // Room tracking: determine which 640x320 room player is in
        const room = Math.max(0, Math.min(this.totalRooms - 1, Math.floor(target.x / this.roomWidth)));
        this.currentRoomIndex = room;
        this.targetX = room * this.roomWidth;
        this.targetY = 0;
    }

    snapTo(x, y) {
        if (this.isRoomMode) {
            const room = Math.max(0, Math.min(this.totalRooms - 1, Math.floor(x / this.roomWidth)));
            this.currentRoomIndex = room;
            this.targetX = room * this.roomWidth;
            this.targetY = 0;
            this.x = this.targetX;
            this.y = this.targetY;
            return;
        }

        this.x = x - this.viewportWidth / 2;
        this.y = y - this.viewportHeight / 2;
        this.targetX = this.x;
        this.targetY = this.y;
    }

    update() {
        this.x += (this.targetX - this.x) * this.smoothness;
        this.y += (this.targetY - this.y) * this.smoothness;
    }

    applyTransform(ctx) {
        ctx.save();
        if (this.isRoomMode) {
            ctx.translate(this.offsetX, this.offsetY);
            ctx.scale(this.scale, this.scale);
        }
        ctx.translate(-Math.round(this.x), -Math.round(this.y));
    }

    restoreTransform(ctx) {
        ctx.restore();
    }

    screenToWorld(sx, sy) {
        if (!this.isRoomMode) {
            return { x: sx + this.x, y: sy + this.y };
        }
        return {
            x: (sx - this.offsetX) / this.scale + this.x,
            y: (sy - this.offsetY) / this.scale + this.y
        };
    }

    worldToScreen(wx, wy) {
        if (!this.isRoomMode) {
            return { x: wx - this.x, y: wy - this.y };
        }
        return {
            x: (wx - this.x) * this.scale + this.offsetX,
            y: (wy - this.y) * this.scale + this.offsetY
        };
    }
}
