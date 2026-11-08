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

    setRoomMode(roomParam = 640, roomHeight = 320, totalRooms = 3) {
        this.isRoomMode = true;
        this.currentRoomIndex = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.x = 0;
        this.y = 0;

        if (Array.isArray(roomParam) && roomParam.length > 0) {
            this.rooms = roomParam;
            this.roomWidth = this.rooms[0].pxWid || 640;
            this.roomHeight = this.rooms[0].pxHei || 320;
            this.totalRooms = this.rooms.length;
        } else {
            this.roomWidth = typeof roomParam === 'number' ? roomParam : 640;
            this.roomHeight = roomHeight;
            this.totalRooms = totalRooms;
            this.rooms = [];
            for (let i = 0; i < this.totalRooms; i++) {
                this.rooms.push({
                    index: i,
                    id: `Room_${i}`,
                    worldX: i * this.roomWidth,
                    worldY: 0,
                    pxWid: this.roomWidth,
                    pxHei: this.roomHeight
                });
            }
        }

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

        // Fit room width x height inside canvas maintaining aspect ratio
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
     * Follow player across room boundaries with Instant Room Cut
     */
    follow(target) {
        if (!this.isRoomMode) {
            // Free follow mode
            this.targetX = target.x - this.viewportWidth / 2;
            this.targetY = target.y - this.viewportHeight / 2;
            return;
        }

        const px = target.x + (target.width || 32) / 2;
        const py = target.y + (target.height || 32) / 2;

        let found = this.rooms ? this.rooms.find(r =>
            px >= r.worldX && px < r.worldX + r.pxWid &&
            py >= r.worldY && py < r.worldY + r.pxHei
        ) : null;

        if (!found && this.rooms && this.rooms.length > 0) {
            // Fallback: pick closest room by distance to center
            let closest = this.rooms[0];
            let minDist = Infinity;
            for (const r of this.rooms) {
                const cx = r.worldX + r.pxWid / 2;
                const cy = r.worldY + r.pxHei / 2;
                const d = Math.hypot(cx - px, cy - py);
                if (d < minDist) {
                    minDist = d;
                    closest = r;
                }
            }
            found = closest;
        }

        if (found) {
            if (this.currentRoomIndex !== found.index) {
                this.currentRoomIndex = found.index;
                this.targetX = found.worldX;
                this.targetY = found.worldY;
                // Instant Room Cut: zero lerp delay on room transition
                this.x = this.targetX;
                this.y = this.targetY;
            }
        }
    }

    snapTo(x, y) {
        if (this.isRoomMode) {
            let found = this.rooms ? this.rooms.find(r =>
                x >= r.worldX && x < r.worldX + r.pxWid &&
                y >= r.worldY && y < r.worldY + r.pxHei
            ) : null;

            if (!found && this.rooms && this.rooms.length > 0) {
                // Fallback: pick closest room by distance to center instead of blindly jumping to room 0
                let closest = this.rooms[0];
                let minDist = Infinity;
                for (const r of this.rooms) {
                    const cx = r.worldX + r.pxWid / 2;
                    const cy = r.worldY + r.pxHei / 2;
                    const d = Math.hypot(cx - x, cy - y);
                    if (d < minDist) {
                        minDist = d;
                        closest = r;
                    }
                }
                found = closest;
            }

            if (found) {
                this.currentRoomIndex = found.index;
                this.targetX = found.worldX;
                this.targetY = found.worldY;
                this.x = this.targetX;
                this.y = this.targetY;
                return;
            }
        }

        this.x = x - this.viewportWidth / 2;
        this.y = y - this.viewportHeight / 2;
        this.targetX = this.x;
        this.targetY = this.y;
    }

    update() {
        if (this.isRoomMode) {
            this.x = this.targetX;
            this.y = this.targetY;
        } else {
            this.x += (this.targetX - this.x) * this.smoothness;
            this.y += (this.targetY - this.y) * this.smoothness;
        }
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

    getVisibleBounds(padding = 32) {
        const w = this.isRoomMode ? this.roomWidth : this.viewportWidth;
        const h = this.isRoomMode ? this.roomHeight : this.viewportHeight;
        return {
            left: this.x - padding,
            top: this.y - padding,
            right: this.x + w + padding,
            bottom: this.y + h + padding
        };
    }

    isVisible(x, y, width, height, padding = 32) {
        const b = this.getVisibleBounds(padding);
        return (
            x + width >= b.left &&
            x <= b.right &&
            y + height >= b.top &&
            y <= b.bottom
        );
    }
}
