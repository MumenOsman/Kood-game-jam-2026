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
        this.eventBus = options.eventBus || null;

        // Visual animation & hover state
        this.hoverTimer = Math.random() * Math.PI * 2;
        this.hoverOffset = 0;
        this.frameTimer = 0;
        this.frameIndex = Math.floor(Math.random() * 4);
        this.fps = 8; // 8 FPS for smooth 4-frame thruster/sensor cycle
        this.facing = 1; // 1 = right, -1 = left

        // Proximity & interaction state
        this.isPlayerNear = false;
        this.talkRadius = 90;
        this.speechBubbleAlpha = 0;
        this.isOpen = false;
        this.isHovered = false;
    }

    update(dt, player, input = null) {
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
            } else if (dist > this.talkRadius * 1.6) {
                // Auto-dismiss tip if player walks away
                this.isOpen = false;
            }
        }

        // 4. Click detection to toggle tip
        const drawY = Math.round(this.y + this.hoverOffset);
        if (input) {
            const mx = input.mouseWorld.x;
            const my = input.mouseWorld.y;
            this.isHovered = (
                mx >= this.x - 6 &&
                mx <= this.x + this.width + 6 &&
                my >= drawY - 6 &&
                my <= drawY + this.height + 6
            );

            if (input.leftPressedThisFrame && this.isHovered) {
                this.isOpen = !this.isOpen;
                if (this.eventBus) {
                    this.eventBus.emit('DRONE_INTERACT', { isOpen: this.isOpen });
                }
            }
        }

        // 5. Smooth tip fade (only appears when drone is clicked/open)
        const targetAlpha = (this.isOpen && this.message) ? 1 : 0;
        this.speechBubbleAlpha += (targetAlpha - this.speechBubbleAlpha) * 0.2;
    }

    render(ctx, camera = null) {
        if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(this.x - 32, this.y - 64, this.width + 64, this.height + 96, 32)) {
            return;
        }
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
        } else {
            // Minimalist procedural fallback if asset not yet loaded
            ctx.fillStyle = '#1e2632';
            ctx.strokeStyle = this.type === 'Heavy_Drone' ? '#ffaa00' : '#37446e';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(this.x, drawY, this.width, this.height);
        }

        // Subtle hover indicator when clickable and closed
        if (this.isHovered && !this.isOpen && this.speechBubbleAlpha < 0.1) {
            ctx.save();
            ctx.font = '10px CyberpunkPixel, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#05070a';
            ctx.fillText('[CLICK]', Math.round(this.x + this.width / 2) + 1, Math.round(drawY - 6) + 1);
            ctx.fillStyle = '#f4b03c';
            ctx.fillText('[CLICK]', Math.round(this.x + this.width / 2), Math.round(drawY - 6));
            ctx.restore();
        }

        // Speech Bubble when Clicked
        if (this.speechBubbleAlpha > 0.05 && this.message) {
            ctx.globalAlpha = this.speechBubbleAlpha;
            this._renderSpeechBubble(ctx, drawY, camera);
        }

        ctx.restore();
    }

    _renderSpeechBubble(ctx, drawY, camera = null) {
        ctx.save();
        ctx.font = '12px CyberpunkPixel, monospace';

        // Split message by explicit newlines first, then wrap lines if needed
        const rawLines = this.message.split('\n');
        const lines = [];
        const maxLineWidth = 280;

        for (const rawLine of rawLines) {
            const words = rawLine.split(' ').filter(w => w.length > 0);
            let curLine = '';
            for (const w of words) {
                const test = curLine ? curLine + ' ' + w : w;
                if (ctx.measureText(test).width > maxLineWidth && curLine) {
                    lines.push(curLine);
                    curLine = w;
                } else {
                    curLine = test;
                }
            }
            if (curLine) lines.push(curLine);
        }

        // Tokenize each line into buttons [SPACE], [A], etc. and plain text
        const parsedLines = lines.map(line => {
            const tokens = [];
            const regex = /(\[[^\]]+\])/g;
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    tokens.push({ text: line.substring(lastIndex, match.index), isButton: false });
                }
                tokens.push({ text: match[0], isButton: true });
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) {
                tokens.push({ text: line.substring(lastIndex), isButton: false });
            }

            let lineWidth = 0;
            for (const t of tokens) {
                t.width = ctx.measureText(t.text).width;
                lineWidth += t.width;
            }
            return { tokens, width: lineWidth };
        });

        let maxW = 0;
        for (const pl of parsedLines) {
            if (pl.width > maxW) maxW = pl.width;
        }

        const lineHeight = 16;
        const padX = 10;
        const padY = 7;
        const boxWidth = Math.round(maxW + padX * 2);
        const boxHeight = Math.round(parsedLines.length * lineHeight + padY * 2 - 4);

        // Screen boundary clamping (ensures window never extends beyond screen bounds)
        const cam = camera || window.__GAME__?.camera;
        const curRoom = (cam && cam.rooms) ? cam.rooms[cam.currentRoomIndex] : null;
        const roomLeft = curRoom ? curRoom.worldX : (cam ? cam.x : Math.floor(this.x / 640) * 640);
        const roomRight = curRoom ? curRoom.worldX + curRoom.pxWid : (cam ? cam.x + (cam.roomWidth || 640) : roomLeft + 640);
        const roomTop = curRoom ? curRoom.worldY : (cam ? cam.y : Math.floor(this.y / 320) * 320);
        const roomBottom = curRoom ? curRoom.worldY + curRoom.pxHei : (cam ? cam.y + (cam.roomHeight || 320) : roomTop + 320);

        const margin = 8;
        const screenLeft = roomLeft + margin;
        const screenRight = roomRight - margin;
        const screenTop = roomTop + margin;
        const screenBottom = roomBottom - margin;

        let boxX = Math.round(this.x + this.width / 2 - boxWidth / 2);
        if (boxX < screenLeft) boxX = screenLeft;
        if (boxX + boxWidth > screenRight) boxX = screenRight - boxWidth;

        let boxY = Math.round(drawY - boxHeight - 8);
        let isBelow = false;
        if (boxY < screenTop) {
            boxY = Math.round(drawY + this.height + 8);
            isBelow = true;
        }
        if (boxY + boxHeight > screenBottom) {
            boxY = Math.max(screenTop, screenBottom - boxHeight);
        }

        // Minimalist dark slate backdrop (NO neon border)
        ctx.fillStyle = '#0a0e16';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Clean subtle dark border
        ctx.strokeStyle = '#273449';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Small 2px pointer notch pointing to drone
        const droneCenterX = Math.round(this.x + this.width / 2);
        const notchX = Math.max(boxX + 6, Math.min(boxX + boxWidth - 8, droneCenterX - 1));
        ctx.fillStyle = '#273449';
        if (isBelow) {
            ctx.fillRect(notchX, boxY - 4, 2, 4);
        } else {
            ctx.fillRect(notchX, boxY + boxHeight, 2, 4);
        }

        // Text rendering with yellow button highlights & 1px drop shadow
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        for (let i = 0; i < parsedLines.length; i++) {
            const lineY = boxY + padY + i * lineHeight;
            let currentX = boxX + padX;

            for (const token of parsedLines[i].tokens) {
                // 1px drop shadow
                ctx.fillStyle = '#05070a';
                ctx.fillText(token.text, currentX + 1, lineY + 1);

                // Front text: yellow for [buttons], off-white for regular text
                ctx.fillStyle = token.isButton ? '#f4b03c' : '#dce5f0';
                ctx.fillText(token.text, currentX, lineY);

                currentX += token.width;
            }
        }

        ctx.restore();
    }
}

