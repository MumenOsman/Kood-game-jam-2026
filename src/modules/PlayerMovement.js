/**
 * PlayerMovement.js
 * Physics-driven 2D platformer movement module:
 * A/D walk, Shift run, S docking/rest, W climbing, Space jumping,
 * mid-air tether jumps, platform collisions, and battery charging.
 */
export class PlayerMovement {
    constructor(eventBus, inputManager, player, level) {
        this.name = 'PlayerMovement';
        this.eventBus = eventBus;
        this.input = inputManager;
        this.player = player;
        this.level = level;

        // Kinematics tuning constants
        this.WALK_SPEED = 190;
        this.RUN_SPEED = 330;
        this.CRAWL_SPEED = 110; // Emergency depleted speed
        this.GROUND_ACCEL = 1800;
        this.AIR_ACCEL = 1200;
        this.GROUND_FRICTION = 0.82;
        this.AIR_DRAG = 0.985;
        this.GRAVITY = 1400;
        this.MAX_FALL_SPEED = 850;
        this.JUMP_SPEED = -520;
        this.LOW_POWER_JUMP_SPEED = -470;
        this.HOP_SPEED = -280; // Emergency hop when battery is 0%
        this.TETHER_JUMP_UP = -460;
        this.TETHER_JUMP_HORIZONTAL = 280;

        // Energy consumption tuning constants (subtle rates)
        this.DRAIN_WALK = 0.5; // % per second while walking
        this.DRAIN_RUN = 1.2;  // % per second while running
        this.COST_JUMP = 1.5;  // % per ground jump
        this.COST_TETHER_JUMP = 2.0; // % per mid-air tether jump
        this.CHARGER_RATE = 30.0; // % per second at wall charger
        this.REST_TRICKLE_RATE = 1.0; // % per second emergency trickle charge while resting
        this.REST_TRICKLE_THRESHOLD = 20.0; // Max % emergency trickle restores

        // Timers for responsive feel
        this.COYOTE_TIME = 0.12; // 120ms
        this.JUMP_BUFFER_TIME = 0.12; // 120ms
        this.IDLE_REST_THRESHOLD = 3.5; // 3.5s before resting
    }

    init(engine) {
        this.engine = engine;
    }

    update(dt) {
        const p = this.player;

        // 1. Process Timers
        if (p.isGrounded) {
            p.coyoteTimer = this.COYOTE_TIME;
        } else {
            p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
        }

        if (this.input.jumpPressed) {
            p.jumpBufferTimer = this.JUMP_BUFFER_TIME;
        } else {
            p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
        }

        // 2. Tether Mid-Air Jump Handling
        // If player is tethered in mid-air and presses Space:
        // Jump and unplug at the same time toward the direction they are facing or steering (A/D)
        if (p.isTethered && !p.isGrounded && p.jumpBufferTimer > 0) {
            this._performTetherJump();
            p.jumpBufferTimer = 0;
            return;
        }

        // 3. Resting / Docking & Idle State
        let horizontalIntent = 0;
        if (this.input.moveLeft) horizontalIntent -= 1;
        if (this.input.moveRight) horizontalIntent += 1;

        if (horizontalIntent !== 0) {
            p.facing = horizontalIntent;
            p.idleTimer = 0;
            if (p.isResting) {
                p.isResting = false;
                this.eventBus.emit('PLAYER_REST_END');
            }
        } else if (p.isGrounded && Math.abs(p.vx) < 5) {
            p.idleTimer += dt;
            if (p.idleTimer >= this.IDLE_REST_THRESHOLD && !p.isResting) {
                p.isResting = true;
                this.eventBus.emit('PLAYER_REST_START');
            }
        } else {
            p.idleTimer = 0;
        }

        // Holding 'S' forces resting / docking on ground
        if (this.input.moveDown && p.isGrounded && Math.abs(p.vx) < 30) {
            if (!p.isResting) {
                p.isResting = true;
                this.eventBus.emit('PLAYER_REST_START');
            }
        }

        // Recharging battery when connected to CHARGER socket
        if (p.isTethered && p.tetherSocket && p.tetherSocket.type === 'CHARGER') {
            p.isCharging = true;
            if (p.battery < p.maxBattery) {
                p.addBattery(this.CHARGER_RATE * dt);
                this.eventBus.emit('BATTERY_CHANGED', p.battery);
            }
        } else {
            p.isCharging = false;
        }

        // Emergency trickle recharge while resting if battery is under safety threshold
        if (p.isResting && p.battery < this.REST_TRICKLE_THRESHOLD && !p.isCharging) {
            p.addBattery(this.REST_TRICKLE_RATE * dt);
            this.eventBus.emit('BATTERY_CHANGED', p.battery);
        }

        // If resting, dampen movement
        if (p.isResting) {
            p.vx *= 0.5;
            this._applyGravity(dt);
            this._resolveCollisions(dt);
            return;
        }

        // 4. Horizontal Acceleration & Max Speed
        // Low power disables sprinting; depleted power reduces to emergency crawl
        const canRun = !p.isLowPower && !p.isDepleted;
        const isRunning = canRun && this.input.isRunning;

        let baseWalkSpeed = this.WALK_SPEED;
        if (p.isDepleted) {
            baseWalkSpeed = this.CRAWL_SPEED;
        }

        const targetSpeed = (isRunning ? this.RUN_SPEED : baseWalkSpeed) * horizontalIntent;
        const accel = p.isGrounded ? this.GROUND_ACCEL : this.AIR_ACCEL;

        if (horizontalIntent !== 0) {
            // Subtle continuous locomotion battery drain while moving
            if (p.isGrounded) {
                const drainRate = isRunning ? this.DRAIN_RUN : this.DRAIN_WALK;
                p.drainBattery(drainRate * dt);
                this.eventBus.emit('BATTERY_CHANGED', p.battery);
            }

            if (Math.sign(p.vx) !== horizontalIntent) {
                // Snappy turn-around
                p.vx += horizontalIntent * accel * 1.5 * dt;
            } else {
                p.vx += horizontalIntent * accel * dt;
            }

            // Cap at target speed
            if (Math.abs(p.vx) > Math.abs(targetSpeed)) {
                p.vx = Math.sign(p.vx) * Math.max(Math.abs(targetSpeed), Math.abs(p.vx) * 0.95);
            }
        } else {
            // Apply friction
            if (p.isGrounded) {
                p.vx *= Math.pow(this.GROUND_FRICTION, dt * 60);
                if (Math.abs(p.vx) < 2) p.vx = 0;
            } else {
                p.vx *= Math.pow(this.AIR_DRAG, dt * 60);
            }
        }

        // 5. Normal Ground Jump
        if (p.jumpBufferTimer > 0 && p.coyoteTimer > 0) {
            let jumpVel = this.JUMP_SPEED;
            if (p.isDepleted) {
                jumpVel = this.HOP_SPEED;
            } else if (p.isLowPower) {
                jumpVel = this.LOW_POWER_JUMP_SPEED;
            }

            p.vy = jumpVel;
            p.coyoteTimer = 0;
            p.jumpBufferTimer = 0;
            p.isGrounded = false;

            // Deduct jump energy cost
            p.drainBattery(this.COST_JUMP);
            this.eventBus.emit('BATTERY_CHANGED', p.battery);
            this.eventBus.emit('PLAYER_JUMP', { x: p.x, y: p.y });
        }

        // Variable jump height cut when Space is released while moving upwards
        if (!this.input.isKeyDown('Space') && p.vy < -150) {
            p.vy *= 0.65;
        }

        // 6. Gravity (only if not swinging with zero radial freedom)
        this._applyGravity(dt);

        // 7. Resolve Collisions against Level
        this._resolveCollisions(dt);
    }

    _performTetherJump() {
        const p = this.player;
        let dir = p.facing;
        if (this.input.moveLeft) dir = -1;
        if (this.input.moveRight) dir = 1;

        // Disconnect tether wire
        this.eventBus.emit('REQUEST_WIRE_DETACH');

        // Deduct tether jump energy cost
        p.drainBattery(this.COST_TETHER_JUMP);
        this.eventBus.emit('BATTERY_CHANGED', p.battery);

        // Apply upward and horizontal leap
        p.vy = this.TETHER_JUMP_UP;
        p.vx = dir * this.TETHER_JUMP_HORIZONTAL + p.vx * 0.4;
        p.facing = dir;
        p.isGrounded = false;

        this.eventBus.emit('PLAYER_TETHER_JUMP', { x: p.x, y: p.y, dir });
    }

    _applyGravity(dt) {
        const p = this.player;
        p.vy += this.GRAVITY * dt;
        if (p.vy > this.MAX_FALL_SPEED) {
            p.vy = this.MAX_FALL_SPEED;
        }
    }

    _resolveCollisions(dt) {
        const p = this.player;
        p.wasGrounded = p.isGrounded;

        // 1. Move X & check horizontal collisions
        p.x += p.vx * dt;
        let bounds = p.getBounds();
        const colliders = this.level ? this.level.getSolidColliders() : [];

        for (const col of colliders) {
            if (this._checkAABB(bounds, col)) {
                if (p.vx > 0) {
                    p.x = col.x - p.width;
                    p.vx = 0;
                } else if (p.vx < 0) {
                    p.x = col.x + col.width;
                    p.vx = 0;
                }
                bounds = p.getBounds();
            }
        }

        // 2. Move Y & check vertical collisions
        p.y += p.vy * dt;
        bounds = p.getBounds();
        p.isGrounded = false;

        for (const col of colliders) {
            if (this._checkAABB(bounds, col)) {
                if (p.vy > 0) { // Landing on top of a platform
                    p.y = col.y - p.height;
                    p.vy = 0;
                    p.isGrounded = true;
                } else if (p.vy < 0) { // Hitting ceiling
                    p.y = col.y + col.height;
                    p.vy = 0;
                }
                bounds = p.getBounds();
            }
        }
    }

    _checkAABB(rectA, rectB) {
        return (
            rectA.x < rectB.x + rectB.width &&
            rectA.x + rectA.width > rectB.x &&
            rectA.y < rectB.y + rectB.height &&
            rectA.y + rectA.height > rectB.y
        );
    }
}

