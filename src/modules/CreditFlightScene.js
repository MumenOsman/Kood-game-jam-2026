/**
 * CreditFlightScene.js
 * Controls the interactive spaceship flight sequence and playable credits dodge minigame.
 *
 * Architecture (Option 1 - Cinematic Transmission Banner):
 * 1. HANGAR_TAKEOFF: Player controls the spaceship inside Level_12 hangar using WASD.
 *    Forward/right movement only (cannot reverse past parked position into previous rooms).
 * 2. FLIGHT_RUNNER: Exits the hangar into high-speed flight against scrolling factory background.
 *    Full canvas WASD maneuverability with banking tilt and dynamic thruster animations.
 * 3. TRANSMISSION BANNER: Stationed, easy-to-read comm link banner at the top of the screen
 *    broadcasting each credit transmission clearly without moving text distractions.
 * 4. RELAY BUOYS: Sleek, compact physical obstacle buoys scroll leftwards for the player
 *    to dodge with WASD. Non-lethal arcade deflection feedback (audio bump, soft shake, zero sparks).
 * 5. HYPERDRIVE_EXIT: Once all credit transmissions complete and buoys clear, ship hyperdrives
 *    offscreen and seamlessly transitions into the credits screen.
 */

export const FLIGHT_STATE = {
    INACTIVE: 'INACTIVE',
    HANGAR_TAKEOFF: 'HANGAR_TAKEOFF',
    FLIGHT_RUNNER: 'FLIGHT_RUNNER',
    HYPERDRIVE_EXIT: 'HYPERDRIVE_EXIT',
    COMPLETED: 'COMPLETED'
};

export class CreditFlightScene {
    constructor({ assetLoader, audioManager, uiTheme, eventBus, camera, player, onComplete }) {
        this.assetLoader = assetLoader;
        this.audio = audioManager;
        this.uiTheme = uiTheme;
        this.eventBus = eventBus;
        this.camera = camera || null;
        this.player = player || null;
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

        // Non-lethal collision feedback
        this.screenShake = 0;
        this.hitCooldown = 0;

        // Transmission Banner Credit List (Stationary top comms)
        this.creditList = [
            { sender: 'MISSION CONTROL', text: 'HEY!', isTitle: true },
            { sender: 'MISSION CONTROL', text: 'THANKS FOR PLAYING', isTitle: false },
            { sender: 'MISSION LOG', text: 'THIS GAME...', isTitle: false },
            { sender: 'MISSION LOG', text: 'WAS MADE FOR...', isTitle: false },
            { sender: 'GAME JAM 2026', text: 'KOOD JAM [Platformers]', isTitle: true },
            { sender: 'PRODUCTION', text: 'SOLO DEVELOPED BY:', isTitle: false },
            { sender: 'LEAD DEVELOPER', text: 'MUMEN OSMAN', isTitle: true },
            { sender: 'PORTFOLIO', text: 'MUMEN.DEV', isTitle: false },
            { sender: 'PRODUCTION', text: 'GAME DESIGN & CODE', isTitle: false },
            { sender: 'ART & ASSETS', text: 'CUSTOM PIXEL ART', isTitle: false },
            { sender: 'ART & ASSETS', text: 'CRAFTPIX.NET ASSETS', isTitle: false },
            { sender: 'TECH STACK', text: 'CUSTOM 2D JS ENGINE', isTitle: false },
            { sender: 'TECH STACK', text: 'LEVELS MADE WITH LDTK', isTitle: false },
            { sender: 'MISSION CONTROL', text: 'YOU ARE AWESOME!', isTitle: true },
            { sender: 'SYSTEM STATUS', text: 'MISSION COMPLETE', isTitle: true }
        ];

        this.creditIndex = 0;
        this.creditTimer = 0;
        this.creditDuration = 3.0; // Seconds per transmission
        this.creditsDone = false;

        // Dodgeable Obstacle Buoys
        this.activeObstacles = [];
        this.spawnTimer = 1.2;
        this.buoyTypes = ['RELAY BUOY', 'DATA PROBE', 'SENSOR ARRAY', 'NAV BEACON'];
        this.buoyCounter = 1;

        // Hyperdrive exit state
        this.hyperdriveTimer = 0;

        this._bindEvents();
    }

    _bindEvents() {
        if (this.eventBus) {
            this.eventBus.on('SPACESHIP_BOARDED', (data) => {
                this.startHangarTakeoff(data, this.camera);
            });
        }
    }

    startHangarTakeoff(data, camera = null) {
        this.state = FLIGHT_STATE.HANGAR_TAKEOFF;
        this.x = data.x;
        this.y = data.y;
        this.parkedX = data.x;
        this.width = data.width || 148;
        this.height = data.height || 72;
        this.vx = 60;
        this.vy = 0;

        if (this.player) {
            this.player.x = data.x;
            this.player.y = data.y;
            this.player.isVisible = false;
        }

        const cam = camera || this.camera;
        if (cam) {
            cam.snapTo(this.x + this.width / 2, this.y + this.height / 2);
        }

        // Switch to special level music
        try {
            if (this.audio) {
                this.audio.playMusic('special_level', true);
                this.audio.playFx('start_game', 0.9);
            }
        } catch (e) {
            console.warn('[CreditFlightScene] Audio start error:', e);
        }
    }

    startFlightRunnerDirectly() {
        this._transitionToFlightRunner();
        try {
            if (this.audio) {
                this.audio.playMusic('special_level', true);
                this.audio.playFx('start_game', 0.9);
            }
        } catch (e) {
            console.warn('[CreditFlightScene] Audio start error:', e);
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

        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - dt * 15);
        }
        if (this.hitCooldown > 0) {
            this.hitCooldown = Math.max(0, this.hitCooldown - dt);
        }

        // State Machine Handling
        switch (this.state) {
            case FLIGHT_STATE.HANGAR_TAKEOFF:
                this._updateHangarTakeoff(dt, input, camera || this.camera, level);
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

        // WASD controls inside the hangar
        let moveX = 0;
        let moveY = 0;
        if (input) {
            const isRight = input.isKeyDown ? (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) : false;
            const isLeft = input.isKeyDown ? (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) : false;
            const isUp = input.isKeyDown ? (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) : false;
            const isDown = input.isKeyDown ? (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) : false;

            if (isRight) moveX += 1;
            if (isLeft) moveX -= 0.6; // slower reverse
            if (isUp) moveY -= 1;
            if (isDown) moveY += 1;
        }

        // Idle forward drift
        if (moveX === 0) moveX = 0.2;

        this.vx += (moveX * moveSpeed - this.vx) * Math.min(1, dt * 4);
        this.vy += (moveY * moveSpeed - this.vy) * Math.min(1, dt * 6);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Keep player model anchor pinned to ship position to prevent room-index drift
        if (this.player) {
            this.player.x = this.x;
            this.player.y = this.y;
            this.player.isVisible = false;
        }

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
                return;
            }
        }

        // Smooth camera follow in hangar
        if (camera && rm) {
            const camTargetX = Math.min(rm.worldX + rm.pxWid - 320, Math.max(rm.worldX + 320, this.x + this.width / 2));
            const camTargetY = rm.worldY + rm.pxHei / 2;
            camera.snapTo(camTargetX, camTargetY);
        }
    }

    _transitionToFlightRunner() {
        this.state = FLIGHT_STATE.FLIGHT_RUNNER;

        // Transition to screen coordinates (1280x720)
        this.width = 180;
        this.height = 88;
        this.x = 160;
        this.y = 360;
        this.vx = 0;
        this.vy = 0;
        this.tiltAngle = 0;

        // Transmission Banner state reset
        this.creditIndex = 0;
        this.creditTimer = 0;
        this.creditDuration = 3.0;
        this.creditsDone = false;

        // Obstacles state reset
        this.activeObstacles = [];
        this.spawnTimer = 1.0;
        this.buoyCounter = 1;

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
            const isRight = input.isKeyDown ? (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) : false;
            const isLeft = input.isKeyDown ? (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) : false;
            const isUp = input.isKeyDown ? (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) : false;
            const isDown = input.isKeyDown ? (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) : false;

            if (isRight) inputX += 1;
            if (isLeft) inputX -= 1;
            if (isUp) inputY -= 1;
            if (isDown) inputY += 1;
        }

        this.vx += (inputX * speed - this.vx) * Math.min(1, dt * 5);
        this.vy += (inputY * speed - this.vy) * Math.min(1, dt * 5);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Screen boundary clamping (keep clear of top transmission banner)
        const marginX = 60;
        const minY = 108; // clear space below top transmission banner
        const maxY = this.screenHeight - this.height - 40;
        this.x = Math.max(marginX, Math.min(this.screenWidth - this.width - marginX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));

        // Smooth banking tilt
        const targetTilt = (this.vy / speed) * 0.14; // +/- 8 degrees
        this.tiltAngle += (targetTilt - this.tiltAngle) * Math.min(1, dt * 6);

        // 3. Sequential Credit Transmission Progression
        if (!this.creditsDone) {
            this.creditTimer += dt;
            if (this.creditTimer >= this.creditDuration) {
                this.creditTimer = 0;
                this.creditIndex++;
                if (this.creditIndex >= this.creditList.length) {
                    this.creditsDone = true;
                }
            }
        }

        // 4. Spawning Dodgeable Relay Buoys
        if (!this.creditsDone) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this._spawnObstacle();
                this.spawnTimer = 2.0 + Math.random() * 0.8;
            }
        }

        // 5. Update Active Obstacles & Collision Check
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

        // 6. Completion Check: All credits transmitted and all buoys cleared
        if (this.creditsDone && this.activeObstacles.length === 0) {
            this.state = FLIGHT_STATE.HYPERDRIVE_EXIT;
            this.hyperdriveTimer = 0;
            if (this.audio) {
                this.audio.playFx('circuit_solved', 0.9);
            }
        }
    }

    _spawnObstacle() {
        // Compact, sleek physical relay buoy
        const baseW = 140;
        const baseH = 48;

        // Randomized vertical position below banner
        const minY = 116;
        const maxY = this.screenHeight - baseH - 44;
        const spawnY = Math.round(minY + Math.random() * (maxY - minY));

        const labelText = `${this.buoyTypes[(this.buoyCounter - 1) % this.buoyTypes.length]} #${String(this.buoyCounter).padStart(2, '0')}`;
        this.buoyCounter++;

        this.activeObstacles.push({
            label: labelText,
            x: this.screenWidth + 40,
            y: spawnY,
            width: baseW,
            height: baseH,
            speed: this.bgSpeed * 0.92,
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
        this.screenShake = 3.5;

        if (this.audio) {
            this.audio.playFx('bump', 0.85);
        }
    }

    _updateHyperdrive(dt) {
        this.hyperdriveTimer += dt;
        // Exponential hyperdrive boost off right screen
        this.vx += 1800 * dt;
        this.x += this.vx * dt;

        if (this.x > this.screenWidth + 300) {
            this.state = FLIGHT_STATE.COMPLETED;
            if (this.onComplete) {
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

        // Animated flight frame with static fallback
        const frameKeys = ['vehicle_f1', 'vehicle_f2', 'vehicle_f3'];
        let shipImg = this.assetLoader ? this.assetLoader.getImage(frameKeys[this.frameIndex]) : null;
        if (!shipImg || !shipImg.complete) {
            shipImg = this.assetLoader ? this.assetLoader.getImage('vehicle_static') : null;
        }

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

        // 2. Render Relay Buoy Obstacles
        for (const obs of this.activeObstacles) {
            this._renderObstacle(ctx, obs);
        }

        // 3. Render Spaceship with Banking Tilt
        ctx.save();
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(this.tiltAngle);

        ctx.imageSmoothingEnabled = false;

        // Vehicle frame with static fallback
        const frameKeys = ['vehicle_f1', 'vehicle_f2', 'vehicle_f3'];
        let shipImg = this.assetLoader ? this.assetLoader.getImage(frameKeys[this.frameIndex]) : null;
        if (!shipImg || !shipImg.complete) {
            shipImg = this.assetLoader ? this.assetLoader.getImage('vehicle_static') : null;
        }
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

        // 4. Render Stationary Cinematic Transmission Banner at Top
        this._renderTransmissionBanner(ctx);

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

    _renderTransmissionBanner(ctx) {
        if (this.creditIndex >= this.creditList.length) {
            return;
        }

        const item = this.creditList[this.creditIndex];
        const bw = 740;
        const bh = 76;
        const bx = Math.round((this.screenWidth - bw) / 2);
        const by = 18;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // 1. Authentic UI Frame Container via UITheme
        if (this.uiTheme && typeof this.uiTheme.drawFrame === 'function') {
            this.uiTheme.drawFrame(ctx, bx, by, bw, bh, 0);
        }

        // 2. High-contrast inner dark backing
        ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
        ctx.fillRect(bx + 10, by + 10, bw - 20, bh - 20);

        // 3. Top Header: Blinking Comm Indicator, Channel Sender, and Log Counter
        const isBlinkOn = Math.floor(Date.now() / 380) % 2 === 0;
        ctx.fillStyle = isBlinkOn ? '#00e5a3' : '#047857';
        ctx.fillRect(bx + 20, by + 16, 7, 7);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = "bold 11px 'CyberpunkPixel', 'Courier New', monospace";
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(`COMM LINK // ${item.sender || 'TRANSMISSION'}`, bx + 34, by + 20);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        const logNum = String(this.creditIndex + 1).padStart(2, '0');
        const logTot = String(this.creditList.length).padStart(2, '0');
        ctx.fillText(`LOG [${logNum} / ${logTot}]`, bx + bw - 20, by + 20);

        // 4. Large, Crystal-Clear Credit Text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const fontSize = item.isTitle ? '22px' : '18px';
        ctx.font = `bold ${fontSize} 'CyberpunkPixel', 'Courier New', monospace`;

        const textX = bx + bw / 2;
        const textY = by + 50;

        // Razor-sharp drop shadow
        ctx.fillStyle = '#000000';
        ctx.fillText(item.text, textX + 2, textY + 2);

        // Foreground text (golden for titles/highlights, crisp white for body)
        ctx.fillStyle = item.isTitle ? '#f4b03c' : '#ffffff';
        ctx.fillText(item.text, textX, textY);

        // 5. Subtle transmission duration progress line at bottom of banner
        const progress = Math.min(1, Math.max(0, this.creditTimer / this.creditDuration));
        const barW = (bw - 24) * progress;
        ctx.fillStyle = item.isTitle ? 'rgba(244, 176, 60, 0.7)' : 'rgba(0, 229, 163, 0.6)';
        ctx.fillRect(bx + 12, by + bh - 7, barW, 2);

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

        // 2. High-contrast inner dark backing (momentary red tint when bumped)
        ctx.fillStyle = obs.hit ? 'rgba(230, 80, 50, 0.45)' : 'rgba(10, 16, 24, 0.92)';
        ctx.fillRect(ox + 8, oy + 8, ow - 16, oh - 16);

        // 3. Status diode on the left of buoy
        const isBlink = Math.floor(Date.now() / 300) % 2 === 0;
        ctx.fillStyle = obs.hit ? '#ef4444' : (isBlink ? '#f59e0b' : '#b45309');
        ctx.fillRect(ox + 16, oy + oh / 2 - 3, 6, 6);

        // 4. Compact tactical label
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "bold 12px 'CyberpunkPixel', 'Courier New', monospace";

        const textX = ox + ow / 2 + 6;
        const textY = oy + oh / 2;

        // Drop shadow
        ctx.fillStyle = '#000000';
        ctx.fillText(obs.label, textX + 1, textY + 1);

        // Label foreground
        ctx.fillStyle = obs.hit ? '#fca5a5' : '#cbd5e1';
        ctx.fillText(obs.label, textX, textY);

        ctx.restore();
    }
}
