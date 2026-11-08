/**
 * Spaceship.js
 * Interactive spaceship entity parked in the secret hangar (Level_12).
 * Allows the player to board via LMB click or [E] interact, initiating the flight credits sequence.
 */
export class Spaceship {
    constructor({ x, y, width = 148, height = 72, roomIndex = 12, assetLoader = null, eventBus = null }) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.roomIndex = roomIndex;
        this.assetLoader = assetLoader;
        this.eventBus = eventBus;

        this.isBoarded = false;
        this.isHovered = false;
        this.isPlayerNear = false;
        this.hoverOffset = 0;
        this.hoverTime = 0;
    }

    update(dt, player, input = null) {
        if (this.isBoarded) return;

        this.hoverTime += dt * 3;
        this.hoverOffset = Math.sin(this.hoverTime) * 3;

        // 1. Proximity check with player
        if (player) {
            const px = player.x + (player.width || 32) / 2;
            const py = player.y + (player.height || 32) / 2;
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            const dist = Math.hypot(cx - px, cy - py);
            this.isPlayerNear = (dist < 110);
        } else {
            this.isPlayerNear = false;
        }

        // 2. Mouse hover check
        this.isHovered = false;
        if (input && input.mouseWorld) {
            const mx = input.mouseWorld.x;
            const my = input.mouseWorld.y;
            if (mx >= this.x - 10 && mx <= this.x + this.width + 10 &&
                my >= this.y - 10 && my <= this.y + this.height + 10) {
                this.isHovered = true;
            }
        }

        // 3. Boarding interaction check: LMB click while hovered, or interact key [E] when player is near
        const isClick = input && input.leftPressedThisFrame && (this.isHovered || this.isPlayerNear);
        const isInteract = input && input.interactPressed && this.isPlayerNear;

        if (isClick || isInteract) {
            this.board();
        }
    }

    board() {
        if (this.isBoarded) return;
        this.isBoarded = true;
        if (this.eventBus) {
            this.eventBus.emit('SPACESHIP_BOARDED', {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
                roomIndex: this.roomIndex
            });
        }
    }

    render(ctx, camera = null) {
        if (this.isBoarded) return; // Hidden once player controls it in flight scene

        const drawX = Math.round(this.x);
        const drawY = Math.round(this.y + this.hoverOffset);

        if (camera && typeof camera.isVisible === 'function') {
            if (!camera.isVisible(drawX - 20, drawY - 20, this.width + 40, this.height + 40, 32)) {
                return;
            }
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        const img = this.assetLoader ? this.assetLoader.getImage('vehicle_static') : null;
        if (img && img.complete) {
            ctx.drawImage(img, drawX, drawY, this.width, this.height);
        } else {
            // High-contrast pixel placeholder
            ctx.fillStyle = '#25354d';
            ctx.fillRect(drawX, drawY, this.width, this.height);
            ctx.strokeStyle = '#f4b03c';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, drawY, this.width, this.height);
        }

        // Interaction Prompt when player is near or mouse is hovering
        if (this.isHovered || this.isPlayerNear) {
            const promptText = '[LMB] / [E] BOARD SHIP';
            ctx.font = '11px CyberpunkPixel, monospace';
            const textWidth = ctx.measureText(promptText).width;
            const bubbleW = textWidth + 16;
            const bubbleH = 22;
            const bubbleX = Math.round(drawX + (this.width - bubbleW) / 2);
            const bubbleY = Math.round(drawY - 28);

            // Dark matte frame with golden border
            ctx.fillStyle = 'rgba(8, 12, 18, 0.92)';
            ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);
            ctx.strokeStyle = '#f4b03c';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH);

            // Drop shadow text
            ctx.fillStyle = '#030508';
            ctx.fillText(promptText, bubbleX + 9, bubbleY + 15);
            ctx.fillStyle = '#f4b03c';
            ctx.fillText(promptText, bubbleX + 8, bubbleY + 14);
        }

        ctx.restore();
    }
}
