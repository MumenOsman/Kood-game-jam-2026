/**
 * Drone.js
 * Hovering tutorial guide and facility drone entity.
 * Uses authentic 32x32 animated pixel-art sprites from "Drones +.png":
 * - Row 0: Light_Drone (4 frames)
 * - Row 1: Heavy_Drone (4 frames)
 * - Row 2: Tutorial_Drone (4 frames)
 * - Row 3: Worker_Type0 (4 frames)
 * - Row 4: Worker_Type1 (4 frames)
 * 
 * Floats with subtle thruster bobbing, turns to face the player, and displays
 * contextual speech prompts when the player is nearby.
 */

const DRONE_ROW_MAP = {
    'Light_Drone': 0,
    'Heavy_Drone': 1,
    'Tutorial_Drone': 2,
    'Worker_Type0': 3,
    'Worker_Type1': 4
};

export class Drone {
    constructor(id, x, y, options = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = options.width || 32;
        this.height = options.height || 32;
        this.type = options.type || 'Tutorial_Drone';
        this.message = options.message || '';
        this.assetLoader = options.assetLoader || null;

        // Visual animation & hover state
        this.hoverTimer = Math.random() * Math.PI * 2;
        this.hoverOffset = 0;
        this.frameTimer = 0;
        this.frameIndex = Math.floor(Math.random() * 4);
        this.fps = 8; // 8 FPS for smooth 4-frame thruster/sensor cycle
        this.facing = 1; // 1 = right, -1 = left

        // Proximity dialogue state
        this.isPlayerNear = false;
        this.talkRadius = 90;
        this.speechBubbleAlpha = 0;
    }

    update(dt, player) {
        // 1. Hover thruster oscillation
        this.hoverTimer += dt * 3.2;
        this.hoverOffset = Math.sin(this.hoverTimer) * 3;

        // 2. Cycle animation frames (4 frames per row)
        this.frameTimer += dt;
        const frameDuration = 1 / this.fps;
        while (this.frameTimer >= frameDuration) {
            this.frameTimer -= frameDuration;
            this.frameIndex = (this.frameIndex + 1) % 4;
        }

        // 3. Proximity detection and facing direction
        if (player) {
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;
            const pCenterX = player.x + player.width / 2;
            const pCenterY = player.y + player.height / 2;

            const dist = Math.hypot(centerX - pCenterX, centerY - pCenterY);
            this.isPlayerNear = dist < this.talkRadius;

            // Turn towards player when nearby
            if (this.isPlayerNear) {
                this.facing = pCenterX < centerX ? -1 : 1;
            }
        }

        // 4. Smooth speech bubble fade
        const targetAlpha = this.isPlayerNear ? 1 : 0;
        this.speechBubbleAlpha += (targetAlpha - this.speechBubbleAlpha) * 0.15;
    }

    render(ctx) {
        ctx.save();
        const drawY = Math.round(this.y + this.hoverOffset);
        const spriteSheet = this.assetLoader ? this.assetLoader.getImage('drones_sheet') : null;

        if (spriteSheet) {
            // Authentic 32x32 Pixel-Art Sprite Rendering
            const row = DRONE_ROW_MAP[this.type] !== undefined ? DRONE_ROW_MAP[this.type] : 2;
            const sx = this.frameIndex * 32;
            const sy = row * 32;

            ctx.save();
            ctx.imageSmoothingEnabled = false; // Strict pixel-art crispness

            // Flip horizontally if facing left
            if (this.facing === -1) {
                ctx.translate(this.x + this.width / 2, 0);
                ctx.scale(-1, 1);
                ctx.translate(-(this.x + this.width / 2), 0);
            }

            ctx.drawImage(
                spriteSheet,
                sx, sy, 32, 32,
                Math.round(this.x), drawY, 32, 32
            );
            ctx.restore();

            // Subtle thruster glow underneath
            const thrusterColor = this.type === 'Heavy_Drone'
                ? 'rgba(255, 140, 0, 0.35)'
                : 'rgba(0, 229, 255, 0.35)';
            const pulse = 0.8 + Math.sin(this.hoverTimer * 6) * 0.2;
            ctx.fillStyle = thrusterColor;
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, drawY + 30, 6 * pulse, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Minimalist procedural fallback if asset not yet loaded
            ctx.fillStyle = '#1e2632';
            ctx.strokeStyle = this.type === 'Heavy_Drone' ? '#ff9100' : '#00e5ff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(this.x, drawY, this.width, this.height);
        }

        // Speech Bubble when Player Approaches
        if (this.speechBubbleAlpha > 0.05 && this.message) {
            ctx.globalAlpha = this.speechBubbleAlpha;
            this._renderSpeechBubble(ctx, drawY);
        }

        ctx.restore();
    }

    _renderSpeechBubble(ctx, drawY) {
        ctx.font = '10px monospace';
        const metrics = ctx.measureText(this.message);
        const padding = 8;
        const boxWidth = metrics.width + padding * 2;
        const boxHeight = 22;
        const boxX = Math.round(this.x + this.width / 2 - boxWidth / 2);
        const boxY = Math.round(drawY - boxHeight - 12);

        // Background box
        ctx.fillStyle = 'rgba(10, 16, 24, 0.94)';
        ctx.strokeStyle = this.type === 'Heavy_Drone' ? '#ffaa00' : '#00e5ff';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
        ctx.fill();
        ctx.stroke();

        // Pointer triangle
        ctx.fillStyle = 'rgba(10, 16, 24, 0.94)';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2 - 4, boxY + boxHeight);
        ctx.lineTo(this.x + this.width / 2 + 4, boxY + boxHeight);
        ctx.lineTo(this.x + this.width / 2, boxY + boxHeight + 5);
        ctx.closePath();
        ctx.fill();

        // Text
        ctx.fillStyle = '#e0f7fa';
        ctx.fillText(this.message, boxX + padding, boxY + 14);
    }
}

