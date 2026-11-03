/**
 * AnimationController.js
 * Drives player sprite animations using Hero-sprites.json frames,
 * with horizontal flipping, frame timing, and procedural fallback rendering.
 */
export class AnimationController {
    constructor(assetLoader) {
        this.assetLoader = assetLoader;
        this.currentAnim = 'idle';
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.fps = 10;

        // Custom FPS configuration per state
        this.animFps = {
            idle: 6,
            walk: 10,
            run: 14,
            jump: 10,
            rest: 5,
            throw_ground: 12,
            throw_windup: 12,
            throw_air: 10
        };

        this.chargePulse = 0;
    }

    update(dt, player) {
        // Choose animation based on player physics & state
        let targetAnim = 'idle';

        if (player.isAiming) {
            targetAnim = player.isGrounded ? 'throw_ground' : 'throw_air';
        } else if (!player.isGrounded) {
            targetAnim = 'jump';
        } else if (player.isResting || player.isCharging) {
            targetAnim = 'rest';
        } else if (Math.abs(player.vx) > 190) {
            targetAnim = 'run';
        } else if (Math.abs(player.vx) > 10) {
            targetAnim = 'walk';
        } else {
            targetAnim = 'idle';
        }

        if (this.currentAnim !== targetAnim) {
            this.currentAnim = targetAnim;
            this.frameIndex = 0;
            this.frameTimer = 0;
        }

        player.currentState = this.currentAnim;

        // Frame update
        const fps = this.animFps[this.currentAnim] || 10;
        const frameDuration = 1 / fps;
        this.frameTimer += dt;

        const spriteData = this.assetLoader.getJSON('hero_meta');
        const frames = spriteData ? spriteData[this.currentAnim] : null;

        if (frames && frames.length > 0) {
            if (this.currentAnim === 'jump') {
                // Map jump frames dynamically to vertical velocity
                // Frame 0-1: lift off, 2: ascending, 3: apex, 4: falling, 5: landing
                if (player.vy < -250) this.frameIndex = 1;
                else if (player.vy < -50) this.frameIndex = 2;
                else if (Math.abs(player.vy) <= 50) this.frameIndex = 3;
                else if (player.vy > 50 && player.vy < 350) this.frameIndex = 4;
                else this.frameIndex = 5;
            } else if (this.currentAnim === 'rest' && this.frameIndex >= frames.length - 1) {
                // Hold last resting frame once sat down
                this.frameIndex = frames.length - 1;
            } else {
                while (this.frameTimer >= frameDuration) {
                    this.frameTimer -= frameDuration;
                    this.frameIndex = (this.frameIndex + 1) % frames.length;
                }
            }
        }

        if (player.isCharging) {
            this.chargePulse += dt * 8;
        }
    }

    render(ctx, player) {
        const spriteImg = this.assetLoader.getImage('hero_sheet');
        const spriteMeta = this.assetLoader.getJSON('hero_meta');

        ctx.save();

        // Render charging energy aura if recharging
        if (player.isCharging) {
            const head = player.getHeadSocket();
            const glowRadius = 38 + Math.sin(this.chargePulse) * 8;
            const gradient = ctx.createRadialGradient(head.x, head.y, 4, head.x, head.y, glowRadius);
            gradient.addColorStop(0, 'rgba(255, 240, 100, 0.7)');
            gradient.addColorStop(0.5, 'rgba(0, 240, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(0, 240, 255, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(head.x, head.y, glowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Energy sparks
            for (let i = 0; i < 3; i++) {
                const angle = this.chargePulse + i * 2.1;
                const dist = 14 + Math.cos(this.chargePulse * 1.5 + i) * 10;
                const sx = head.x + Math.cos(angle) * dist;
                const sy = head.y + Math.sin(angle) * dist;
                ctx.fillStyle = '#fffa65';
                ctx.fillRect(sx - 2, sy - 2, 4, 4);
            }
        }

        // Render sprite if image and metadata exist
        if (spriteImg && spriteMeta && spriteMeta[this.currentAnim]) {
            const animFrames = spriteMeta[this.currentAnim];
            const frame = animFrames[Math.min(this.frameIndex, animFrames.length - 1)];

            const targetHeight = player.height * 1.15;
            const aspect = frame.w / frame.h;
            const targetWidth = targetHeight * aspect;

            const drawX = player.x + (player.width - targetWidth) / 2;
            const drawY = player.y + player.height - targetHeight;

            ctx.save();
            if (player.facing === -1) {
                // Flip horizontally across player center
                ctx.translate(player.x + player.width / 2, 0);
                ctx.scale(-1, 1);
                ctx.translate(-(player.x + player.width / 2), 0);
            }

            ctx.drawImage(
                spriteImg,
                frame.x, frame.y, frame.w, frame.h,
                drawX, drawY, targetWidth, targetHeight
            );
            ctx.restore();
        } else {
            // High-quality procedural robot fallback
            this._renderProceduralRobot(ctx, player);
        }

        ctx.restore();
    }

    _renderProceduralRobot(ctx, player) {
        const cx = player.x + player.width / 2;
        const cy = player.y + player.height / 2;

        ctx.save();
        if (player.facing === -1) {
            ctx.translate(cx, 0);
            ctx.scale(-1, 1);
            ctx.translate(-cx, 0);
        }

        // Pumpkin Head
        ctx.fillStyle = '#ff8811';
        ctx.beginPath();
        ctx.ellipse(cx, player.y + 24, 18, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b85d00';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Head antenna plug connector
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - 3, player.y + 4, 6, 8);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(cx - 2, player.y + 2, 4, 3);

        // Eyes & smile
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx + 6, player.y + 22, 3, 0, Math.PI * 2);
        ctx.fill();

        // Robotic Body
        ctx.fillStyle = '#443b35';
        ctx.fillRect(player.x + 12, player.y + 40, player.width - 24, 20);

        // Robotic Legs
        ctx.fillStyle = '#2b231e';
        if (player.isResting) {
            // Sitting legs
            ctx.fillRect(player.x + 8, player.y + 60, 28, 10);
        } else {
            ctx.fillRect(player.x + 12, player.y + 60, 6, 12);
            ctx.fillRect(player.x + player.width - 18, player.y + 60, 6, 12);
        }

        ctx.restore();
    }
}

