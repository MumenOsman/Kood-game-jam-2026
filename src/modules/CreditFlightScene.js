/**
 * CreditFlightScene.js
 * Controls the interactive spaceship flight sequence and playable credits dodge minigame.
 *
 * Sequence:
 * 1. HANGAR_TAKEOFF: Player controls the spaceship inside Level_12 hangar using WASD.
 *    Forward/right movement only (cannot reverse past parked position into previous rooms).
 * 2. FLIGHT_RUNNER: Exits the hangar into high-speed flight against scrolling factory background.
 *    Full canvas WASD maneuverability with banking tilt and dynamic thruster animations.
 * 3. CREDIT_OBSTACLES: Floating UI frames scroll leftwards, each displaying a fragment of credits.
 *    Non-lethal collision feedback (sparks, audio bump, camera shake).
 * 4. HYPERDRIVE_EXIT: Once all credits pass, ship hyperdrives offscreen and opens CreditsScreen.
 */

export const FLIGHT_STATE = {
    INACTIVE: 'INACTIVE',
    HANGAR_TAKEOFF: 'HANGAR_TAKEOFF',
    FLIGHT_RUNNER: 'FLIGHT_RUNNER',
    HYPERDRIVE_EXIT: 'HYPERDRIVE_EXIT',
    COMPLETED: 'COMPLETED'
};

export class CreditFlightScene {
    constructor({ assetLoader, audioManager, uiTheme, eventBus, onComplete }) {
        this.assetLoader = assetLoader;
        this.audio = audioManager;
        this.uiTheme = uiTheme;
        this.eventBus = eventBus;
        this.onComplete = onComplete;

        this.state = FLIGHT_STATE.INACTIVE;

        // Ship transform in world / screen space
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.width = 148;
        this.height = 72;
        this.parkedX = 0;
        this.hangarRoom = null;

        // Flight runner properties (1280x720 screen space)
        this.screenWidth = 1280;
        this.screenHeight = 720;
        this.bgScrollX = 0;
        this.bgSpeed = 320; // pixels per second scrolling
        this.tiltAngle = 0; // banking tilt in radians

        // Thruster and sprite animation
        this.animTimer = 0;
        this.frameIndex = 0;
        this.thrustFrame = 0;

        // Spark particles for collision feedback
        this.particles = [];
        this.screenShake = 0;
        this.hitCooldown = 0;

        // Credits Sequence Definition (max 3 words per obstacle, or title)
        this.creditList = [
            { text: 'HEY!', isTitle: true },
            { text: 'THANKS FOR PLAYING', isTitle: false },
            { text: 'THIS GAME...', isTitle: false },
            { text: 'WAS MADE FOR...', isTitle: false },
            { text: 'KOOD JAM [Platformers]', isTitle: true },
            { text: 'SOLO DEVELOPED BY:', isTitle: false },
            { text: 'MUMEN OSMAN', isTitle: true },
            { text: 'MUMEN.DEV', isTitle: false },
            { text: 'DESIGN & CODE', isTitle: false },
            { text: 'CUSTOM PIXEL ART', isTitle: false },
            { text: 'CRAFTPIX.NET ASSETS', isTitle: false },
            { text: 'CUSTOM ENGINE', isTitle: false },
            { text: 'MADE WITH LDTK', isTitle: false },
            { text: 'YOU ARE AWESOME!', isTitle: true },
            { text: 'MISSION COMPLETE', isTitle: true }
        ];

        this.activeObstacles = [];
        this.spawnIndex = 0;
        this.spawnTimer = 1.2; // initial delay before first obstacle
        this.spawnInterval = 2.6; // seconds between obstacles

        // Hyperdrive exit state
        this.hyperdriveTimer = 0;

        this._bindEvents();
    }

    _bindEvents() {
        if (this.eventBus) {
            this.eventBus.on('SPACESHIP_BOARDED', (data) => {
                this.startHangarTakeoff(data);
            });
        }
    }

    startHangarTakeoff(data) {
        this.state = FLIGHT_STATE.HANGAR_TAKEOFF;
        this.x = data.x;
        this.y = data.y;
        this.parkedX = data.x;
        this.width = data.width || 148;
        this.height = data.height || 72;
        this.vx = 60;
        this.vy = 0;

        // Switch to special level music
        if (this.audio) {
            this.audio.playMusic('special_level', true);
            this.audio.playFx('start_game', 0.9);
        }
    }

    update(dt, input, camera = null, level = null) {
        if (this.state === FLIGHT_STATE.INACTIVE || this.state === FLIGHT_STATE.COMPLETED) {
            return;
        }

        // Animate thruster flames & vehicle hover frames
        this.animTimer += dt;
        if (this.animTimer >= 0.1) {
            this.animTimer = 0;
            this.frameIndex = (this.frameIndex + 1) % 3;
            this.thrustFrame = (this.thrustFrame + 1) % 3;
        }

        // Particle updates
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - dt * 15);
        }
        if (this.hitCooldown > 0) {
            this.hitCooldown = Math.max(0, this.hitCooldown - dt);
        }

        // State Machine Handling
        switch (this.state) {
            case FLIGHT_STATE.HANGAR_TAKEOFF:
                this._updateHangarTakeoff(dt, input, camera, level);
                break;
            case FLIGHT_STATE.FLIGHT_RUNNER:
                this._updateFlightRunner(dt, input);
                break;
            case FLIGHT_STATE.HYPERDRIVE_EXIT:
                this._updateHyperdrive(dt);
                break;
        }
    }

    _updateHangarTakeoff(dt, input, camera, level) {
        const moveSpeed = 260;
        const accel = 600;

        // WASD controls inside the hangar
        let moveX = 0;
        let moveY = 0;
        if (input) {
            if (input.keys['KeyD'] || input.keys['ArrowRight']) moveX += 1;
            if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveX -= 0.6; // slower reverse
            if (input.keys['KeyW'] || input.keys['ArrowUp']) moveY -= 1;
            if (input.keys['KeyS'] || input.keys['ArrowDown']) moveY += 1;
        }

        // Idle forward drift
        if (moveX === 0) moveX = 0.2;

        this.vx += (moveX * moveSpeed - this.vx) * Math.min(1, dt * 4);
        this.vy += (moveY * moveSpeed - this.vy) * Math.min(1, dt * 6);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // INVARIANT: Player cannot move backwards past parked position in first room
        if (this.x < this.parkedX) {
            this.x = this.parkedX;
            if (this.vx < 0) this.vx = 0;
        }

        // Room bounds clamp in hangar (Level_12)
        const rm = level && level.rooms ? level.rooms[level.rooms.length - 1] : null;
        if (rm) {
            const minY = rm.worldY + 16;
            const maxY = rm.worldY + rm.pxHei - this.height - 32;
            this.y = Math.max(minY, Math.min(maxY, this.y));

            // Exit hangar threshold: flying past the runway opening to the right
            const exitX = rm.worldX + rm.pxWid - 48;
            if (this.x >= exitX) {
                this._transitionToFlightRunner();
            }
        }

        // Smooth camera follow in hangar
        if (camera) {
            camera.snapTo(this.x + this.width / 2, this.y + this.height / 2);
        }
    }

    _transitionToFlightRunner() {
        this.state = FLIGHT_STATE.FLIGHT_RUNNER;
        // Transition to screen coordinates (1280x720)
        this.width = 180;
        this.height = 88;
        this.x = 160;
        this.y = 320;
        this.vx = 0;
        this.vy = 0;
        this.tiltAngle = 0;
        this.spawnTimer = 1.0;
        this.spawnIndex = 0;
        this.activeObstacles = [];

        if (this.audio) {
            this.audio.playFx('room_transition', 0.8);
        }
    }

    _updateFlightRunner(dt, input) {
        // 1. Continuous Parallax Background Scrolling
        this.bgScrollX = (this.bgScrollX + this.bgSpeed * dt) % this.screenWidth;

        // 2. Full Canvas WASD Steering
        const speed = 420;
        let inputX = 0;
        let inputY = 0;

        if (input) {
            if (input.keys['KeyD'] || input.keys['ArrowRight']) inputX += 1;
            if (input.keys['KeyA'] || input.keys['ArrowLeft']) inputX -= 1;
            if (input.keys['KeyW'] || input.keys['ArrowUp']) inputY -= 1;
            if (input.keys['KeyS'] || input.keys['ArrowDown']) inputY += 1;
        }

        this.vx += (inputX * speed - this.vx) * Math.min(1, dt * 5);
        this.vy += (inputY * speed - this.vy) * Math.min(1, dt * 5);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Screen boundary clamping
        const marginX = 60;
        const marginY = 50;
        this.x = Math.max(marginX, Math.min(this.screenWidth - this.width - marginX, this.x));
        this.y = Math.max(marginY, Math.min(this.screenHeight - this.height - marginY, this.y));

        // Smooth banking tilt
        const targetTilt = (this.vy / speed) * 0.14; // +/- 8 degrees
        this.tiltAngle += (targetTilt - this.tiltAngle) * Math.min(1, dt * 6);

        // 3. Spawning Credit Obstacles
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.spawnIndex < this.creditList.length) {
            this._spawnObstacle(this.creditList[this.spawnIndex]);
            this.spawnIndex++;
            this.spawnTimer = this.spawnInterval;
        }

        // 4. Update Active Obstacles & Collision Check
        const shipBox = {
            x: this.x + 20,
            y: this.y + 15,
            width: this.width - 35,
            height: this.height - 30
        };

        for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
            const obs = this.activeObstacles[i];
            obs.x -= obs.speed * dt;

            // Collision detection with vehicle
            if (this.hitCooldown <= 0 && this._boxOverlap(shipBox, obs)) {
                this._onObstacleHit(obs);
            }

            // Remove when offscreen to the left
            if (obs.x + obs.width < -40) {
                this.activeObstacles.splice(i, 1);
            }
        }

        // 5. Completion Check: All obstacles spawned and scrolled offscreen
        if (this.spawnIndex >= this.creditList.length && this.activeObstacles.length === 0) {
            this.state = FLIGHT_STATE.HYPERDRIVE_EXIT;
            this.hyperdriveTimer = 0;
            if (this.audio) {
                this.audio.playFx('circuit_solved', 0.9);
            }
        }
    }

    _spawnObstacle(creditItem) {
        // Estimate obstacle box width based on text length
        const baseW = Math.max(200, Math.min(340, creditItem.text.length * 14 + 50));
        const baseH = 68;

        // Randomized vertical position in reachable flight zone
        const minY = 80;
        const maxY = this.screenHeight - baseH - 80;
        const spawnY = Math.round(minY + Math.random() * (maxY - minY));

        this.activeObstacles.push({
            text: creditItem.text,
            isTitle: creditItem.isTitle,
            x: this.screenWidth + 40,
            y: spawnY,
            width: baseW,
            height: baseH,
            speed: this.bgSpeed * 0.95,
            hit: false
        });
    }

    _boxOverlap(a, b) {
        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    _onObstacleHit(obs) {
        obs.hit = true;
        this.hitCooldown = 0.45;
        this.screenShake = 5;

        if (this.audio) {
            this.audio.playFx('bump', 0.8);
        }

        // Spawn gold/cyan impact spark particles
        const contactX = this.x + this.width - 20;
        const contactY = this.y + this.height / 2;
        for (let i = 0; i < 14; i++) {
            const angle = (Math.PI * 2 * Math.random());
            const speed = 120 + Math.random() * 200;
            this.particles.push({
                x: contactX,
                y: contactY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.35 + Math.random() * 0.25,
                color: (i % 2 === 0) ? '#ffcc00' : '#4deeea'
            });
        }
    }

    _updateHyperdrive(dt) {
        this.hyperdriveTimer += dt;
        // Exponential hyperdrive boost off right screen
        this.vx += 1800 * dt;
        this.x += this.vx * dt;

        // Extra thruster exhaust particles
        if (Math.random() < 0.6) {
            this.particles.push({
                x: this.x - 20,
                y: this.y + this.height / 2 + (Math.random() - 0.5) * 20,
                vx: -800 - Math.random() * 400,
                vy: (Math.random() - 0.5) * 100,
                life: 0.4,
                color: '#ffaa00'
            });
        }

        if (this.x > this.screenWidth + 300) {
            this.state = FLIGHT_STATE.COMPLETED;
            if (typeof this.onComplete === 'function') {
                this.onComplete();
            }
        }
    }

    render(ctx, camera = null) {
        if (this.state === FLIGHT_STATE.INACTIVE || this.state === FLIGHT_STATE.COMPLETED) {
            return;
        }

        if (this.state === FLIGHT_STATE.HANGAR_TAKEOFF) {
            this._renderHangarShip(ctx, camera);
        } else {
            this._renderFlightScene(ctx);
        }
    }

    _renderHangarShip(ctx, camera) {
        const drawX = Math.round(this.x);
        const drawY = Math.round(this.y);

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Animated flight frame
        const frameKeys = ['vehicle_f1', 'vehicle_f2', 'vehicle_f3'];
        const shipImg = this.assetLoader ? this.assetLoader.getImage(frameKeys[this.frameIndex]) : null;

        if (shipImg && shipImg.complete) {
            ctx.drawImage(shipImg, drawX, drawY, this.width, this.height);
        }

        // Active rear thrusters in hangar
        const thrustImg = this.assetLoader ? this.assetLoader.getImage(`thrust_back${this.thrustFrame + 1}`) : null;
        if (thrustImg && thrustImg.complete) {
            const tx = drawX - 16;
            const ty = drawY + 24;
            ctx.drawImage(thrustImg, tx, ty, 22, 30);
        }

        ctx.restore();
    }

    _renderFlightScene(ctx) {
        ctx.save();

        // Screen shake offset
        let shakeX = 0;
        let shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake * 2;
            shakeY = (Math.random() - 0.5) * this.screenShake * 2;
            ctx.translate(shakeX, shakeY);
        }

        // 1. Render Endless Parallax Factory Background
        const bgImg = this.assetLoader ? this.assetLoader.getImage('factory_bg') : null;
        if (bgImg && bgImg.complete) {
            const startX = -Math.round(this.bgScrollX);
            ctx.drawImage(bgImg, startX, 0, this.screenWidth, this.screenHeight);
            ctx.drawImage(bgImg, startX + this.screenWidth, 0, this.screenWidth, this.screenHeight);
            if (startX + this.screenWidth < this.screenWidth) {
                ctx.drawImage(bgImg, startX + this.screenWidth * 2, 0, this.screenWidth, this.screenHeight);
            }
        } else {
            // Dark industrial starry sky fallback
            ctx.fillStyle = '#0c1017';
            ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
        }

        // Semi-transparent atmospheric flight vignette
        ctx.fillStyle = 'rgba(6, 10, 16, 0.45)';
        ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);

        // 2. Render Credit Obstacles
        for (const obs of this.activeObstacles) {
            this._renderObstacle(ctx, obs);
        }

        // 3. Render Spark Particles
        for (const p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
        }

        // 4. Render Spaceship with Banking Tilt
        ctx.save();
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(this.tiltAngle);

        ctx.imageSmoothingEnabled = false;

        // Vehicle frame
        const frameKeys = ['vehicle_f1', 'vehicle_f2', 'vehicle_f3'];
        const shipImg = this.assetLoader ? this.assetLoader.getImage(frameKeys[this.frameIndex]) : null;
        if (shipImg && shipImg.complete) {
            ctx.drawImage(shipImg, -this.width / 2, -this.height / 2, this.width, this.height);
        }

        // Rear Thruster (Boosted size during flight)
        const thrustImg = this.assetLoader ? this.assetLoader.getImage(`thrust_back${this.thrustFrame + 1}`) : null;
        if (thrustImg && thrustImg.complete) {
            const tw = 28;
            const th = 40;
            const tx = -this.width / 2 - tw + 6;
            const ty = -th / 2 + 6;
            ctx.drawImage(thrustImg, tx, ty, tw, th);
        }

        // Bottom Thrusters when ascending (pressing W)
        if (this.vy < -30) {
            const bThrustImg = this.assetLoader ? this.assetLoader.getImage(`thrust_bottom${this.thrustFrame + 1}`) : null;
            if (bThrustImg && bThrustImg.complete) {
                const bw = 38;
                const bh = 28;
                const bx = -bw / 2 + 6;
                const by = this.height / 2 - 12;
                ctx.drawImage(bThrustImg, bx, by, bw, bh);
            }
        }

        ctx.restore();

        // 5. High-speed flight lines during hyperdrive
        if (this.state === FLIGHT_STATE.HYPERDRIVE_EXIT) {
            ctx.strokeStyle = 'rgba(255, 220, 100, 0.6)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 20; i++) {
                const ly = Math.random() * this.screenHeight;
                const lx = Math.random() * this.screenWidth;
                const len = 100 + Math.random() * 200;
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(lx - len, ly);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    _renderObstacle(ctx, obs) {
        const ox = Math.round(obs.x);
        const oy = Math.round(obs.y);
        const ow = Math.round(obs.width);
        const oh = Math.round(obs.height);

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // 1. Authentic UI Frame Container via UITheme
        if (this.uiTheme && typeof this.uiTheme.drawFrame === 'function') {
            this.uiTheme.drawFrame(ctx, ox, oy, ow, oh, 0);
        }

        // 2. Dark inner obsidian backing for ultra-crisp typography
        ctx.fillStyle = obs.hit ? 'rgba(230, 80, 50, 0.45)' : 'rgba(8, 12, 18, 0.88)';
        ctx.fillRect(ox + 12, oy + 12, ow - 24, oh - 24);

        // 3. Drop Shadow & Credit Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fontSize = obs.isTitle ? '17px' : '14px';
        ctx.font = `${fontSize} CyberpunkPixel, monospace`;

        const textX = ox + ow / 2;
        const textY = oy + oh / 2;

        // Drop shadow
        ctx.fillStyle = '#030508';
        ctx.fillText(obs.text, textX + 1.5, textY + 1.5);

        // Foreground text (golden for titles, crisp white for body)
        ctx.fillStyle = obs.isTitle ? '#f4b03c' : '#ffffff';
        ctx.fillText(obs.text, textX, textY);

        ctx.restore();
    }
}
