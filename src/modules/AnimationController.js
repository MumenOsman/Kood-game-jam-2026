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
            idle: 8,
            walk: 10,
            run: 14,
            jump: 12,
            swing: 12,
            hurt: 10,
            shoot: 16,
            rest: 5,
            throw_ground: 12,
            throw_windup: 12,
            throw_air: 12
        };

        this.chargePulse = 0;
        this._cachedHeroMeta = null;
        this._cachedHeroSheet = null;
    }

    _getHeroMeta() {
        if (!this._cachedHeroMeta && this.assetLoader) {
            this._cachedHeroMeta = this.assetLoader.getJSON('hero_meta');
        }
        return this._cachedHeroMeta;
    }

    _getHeroSheet() {
        if (!this._cachedHeroSheet && this.assetLoader) {
            this._cachedHeroSheet = this.assetLoader.getImage('hero_sheet');
        }
        return this._cachedHeroSheet;
    }

    update(dt, player) {
        // Choose animation based on player physics & state
        let targetAnim = 'idle';

        if (player.shockInvulnTimer > 0) {
            targetAnim = 'hurt';
        } else if (player.shootTimer > 0) {
            targetAnim = 'shoot';
        } else if (player.isTethered && !player.isGrounded) {
            targetAnim = 'swing';
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

        const spriteData = this._getHeroMeta();
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
    }

    render(ctx, player) {
        const spriteImg = this._getHeroSheet();
        const spriteMeta = this._getHeroMeta();

        ctx.save();

        // Calm 3-blink respawn sequence (0.4s per cycle: 0.2s dim / 0.2s visible x 3 cycles)
        if (player.respawnBlinkTimer > 0) {
            const elapsed = 1.2 - player.respawnBlinkTimer;
            const cyclePhase = (elapsed / 0.4) % 1;
            if (cyclePhase < 0.5) {
                ctx.globalAlpha = 0.35;
            }
        }

        // Render wall friction sparks if wall sliding (only when actively descending)
        if (player.isWallSliding && player.vy > 10) {
            const wallX = player.wallSlideDirection === -1 ? player.x : player.x + player.width;
            ctx.fillStyle = '#ffaa00';
            for (let i = 0; i < 2; i++) {
                const sy = player.y + 10 + Math.random() * 16;
                ctx.fillRect(wallX - 1.5, sy, 3, 3);
            }
        }

        // Render sprite if image and metadata exist
        if (spriteImg && spriteMeta && spriteMeta[this.currentAnim]) {
            const animFrames = spriteMeta[this.currentAnim];
            const frame = animFrames[Math.min(this.frameIndex, animFrames.length - 1)];

            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            if (player.facing === -1) {
                // Flip horizontally across player center (16px)
                ctx.translate(player.x + player.width / 2, 0);
                ctx.scale(-1, 1);
                ctx.translate(-(player.x + player.width / 2), 0);
            }

            // Cell size 192px has a 128px core (32 world px) and 32px padding (8 world px)
            // Destination rect is [player.x - 8, player.y - 8, 48, 48]
            // Core character body sits strictly within [player.x, player.y, 32, 32]
            ctx.drawImage(
                spriteImg,
                frame.x, frame.y, frame.w, frame.h,
                player.x - 8, player.y - 8, 48, 48
            );
            ctx.restore();
        } else {
            // High-quality procedural robot fallback (strictly 32x32)
            this._renderProceduralRobot(ctx, player);
        }

        ctx.restore();
    }

    _renderProceduralRobot(ctx, player) {
        const cx = player.x + player.width / 2;

        ctx.save();
        if (player.facing === -1) {
            ctx.translate(cx, 0);
            ctx.scale(-1, 1);
            ctx.translate(-cx, 0);
        }

        // Robot Head (14x12)
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(player.x + 9, player.y + 4, 14, 11);
        ctx.fillStyle = '#222';
        ctx.fillRect(player.x + 17, player.y + 8, 4, 3);

        // Robot Body (18x10)
        ctx.fillStyle = '#3a4454';
        ctx.fillRect(player.x + 7, player.y + 15, 18, 10);

        // Robot Legs (4x7 each)
        ctx.fillStyle = '#1c222b';
        ctx.fillRect(player.x + 8, player.y + 25, 5, 7);
        ctx.fillRect(player.x + 19, player.y + 25, 5, 7);

        ctx.restore();
    }
}

