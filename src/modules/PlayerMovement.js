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

        // Kinematics tuning in grid squares (32px per square)
        this.jumpHeightSquares = 1.5; // Strictly 1.5 squares (48px) apex
        this.jumpSpanSquares = 2.5;   // Strictly 2.5 squares (80px) horizontal landing span
        this.walkSpeedSquares = 8.0;  // 8 squares/sec = 256 px/s
        this.runSpeedSquares = 11.5;  // 11.5 squares/sec = 368 px/s
        this.crawlSpeedSquares = 2.5; // Emergency depleted speed = 80 px/s
        this.wallJumpUpSquares = 2.0;
        this.wallJumpOutSquares = 3.0;
        this.tetherJumpUpSquares = 2.0;
        this.tetherJumpOutSquares = 2.0;

        // Kinematics flags (Option 1 Arcade deterministic mode)
        this.instantLocomotion = true;   // Instant ground response (0 accel ramp, 0 slide) & deterministic jump span
        this.variableJumpHeight = false; // Fixed deterministic jump height
        this.GRAVITY = 1400;
        this.MAX_FALL_SPEED = 850;
        this.GROUND_ACCEL = 2500;
        this.AIR_ACCEL = 1400;
        this.GROUND_FRICTION = 0.82;
        this.AIR_DRAG = 0.985;

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

        // Modular Wall Run & Wall Jump constants
        this.MAX_WALL_SLIDE_SPEED = 60; // Steady, controlled descent speed while sliding (px/s)
        this.FAST_WALL_SLIDE_SPEED = 280; // Fast slide descent speed when holding S (px/s)
        this.WALL_CUSHION_SPEED = 30; // Momentary grip cushion upon initial wall contact (px/s)
        this.WALL_CUSHION_TIME = 0.09; // 90ms initial contact cushion duration
        this.WALL_COYOTE_TIME = 0.10; // 100ms grace window after leaving wall
        this.WALL_JUMP_LOCK_TIME = 0.12; // 120ms directional lock to preserve jump arc
    }

    get TILE_SIZE() { return 32; }

    get WALK_SPEED() { return this.walkSpeedSquares * 32; }
    set WALK_SPEED(v) { this.walkSpeedSquares = Math.round((v / 32) * 10) / 10; }

    get RUN_SPEED() { return this.runSpeedSquares * 32; }
    set RUN_SPEED(v) { this.runSpeedSquares = Math.round((v / 32) * 10) / 10; }

    get CRAWL_SPEED() { return this.crawlSpeedSquares * 32; }
    set CRAWL_SPEED(v) { this.crawlSpeedSquares = Math.round((v / 32) * 10) / 10; }

    /**
     * Discrete Euler jump launch velocity required to reach exactly jumpHeightSquares apex
     */
    get JUMP_SPEED() {
        const h = this.jumpHeightSquares * 32;
        const dt = 1 / 60;
        const term = (this.GRAVITY * dt) / 2;
        return -(term + Math.sqrt(term * term + 2 * this.GRAVITY * h));
    }
    set JUMP_SPEED(v) {
        const u = Math.abs(v);
        const dt = 1 / 60;
        const h = (u * u - this.GRAVITY * dt * u) / (2 * this.GRAVITY);
        this.jumpHeightSquares = Math.max(0.5, Math.round((h / 32) * 10) / 10);
    }

    /**
     * Estimated airborne hang time from ground to ground apex and back
     */
    get JUMP_AIR_TIME() {
        return (2 * Math.abs(this.JUMP_SPEED)) / this.GRAVITY;
    }

    /**
     * Horizontal air speed required so full jump spans exactly jumpSpanSquares
     */
    get JUMP_HORIZONTAL_SPEED() {
        return (this.jumpSpanSquares * 32) / Math.max(0.01, this.JUMP_AIR_TIME);
    }

    get WALL_JUMP_UP() {
        const h = this.wallJumpUpSquares * 32;
        const dt = 1 / 60;
        const term = (this.GRAVITY * dt) / 2;
        return -(term + Math.sqrt(term * term + 2 * this.GRAVITY * h));
    }
    set WALL_JUMP_UP(v) {
        const u = Math.abs(v);
        const dt = 1 / 60;
        const h = (u * u - this.GRAVITY * dt * u) / (2 * this.GRAVITY);
        this.wallJumpUpSquares = Math.max(0.5, Math.round((h / 32) * 10) / 10);
    }

    get WALL_JUMP_OUTWARD() {
        const airTime = (2 * Math.abs(this.WALL_JUMP_UP)) / this.GRAVITY;
        return (this.wallJumpOutSquares * 32) / Math.max(0.01, airTime);
    }
    set WALL_JUMP_OUTWARD(v) {
        const airTime = (2 * Math.abs(this.WALL_JUMP_UP)) / this.GRAVITY;
        this.wallJumpOutSquares = Math.round(((v * airTime) / 32) * 10) / 10;
    }

    get TETHER_JUMP_UP() {
        return this.JUMP_SPEED;
    }

    get TETHER_JUMP_HORIZONTAL() {
        return this.JUMP_HORIZONTAL_SPEED;
    }

    init(engine) {
        this.engine = engine;

        // Listen for electric hazard shock events
        this.eventBus.on('PLAYER_SHOCKED', ({ damage, knockbackX, knockbackY }) => {
            const p = this.player;
            p.drainBattery(damage);
            p.vx = knockbackX;
            p.vy = knockbackY;
            p.isWallSliding = false;
            p.isWallHolding = false;
            p.wallCoyoteTimer = 0;
            this.eventBus.emit('BATTERY_CHANGED', p.battery);
        });
    }

    update(dt) {
        const p = this.player;
        const prevWallSliding = p.isWallSliding;
        const prevWallDir = p.wallSlideDirection;

        // 1. Process Timers
        if (p.isGrounded) {
            p.coyoteTimer = this.COYOTE_TIME;
            p.groundJumpWallGraceTimer = 0;
        } else {
            p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
            if (p.groundJumpWallGraceTimer > 0) {
                p.groundJumpWallGraceTimer -= dt;
            }
        }

        // Jump buffer from Space ONLY (wall jump is executed solely via Space)
        if (this.input.jumpPressed) {
            p.jumpBufferTimer = this.JUMP_BUFFER_TIME;
        } else {
            p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
        }

        if (p.wallCatchTimer > 0) {
            p.wallCatchTimer -= dt;
        }
        if (p.wallJumpLockTimer > 0) {
            p.wallJumpLockTimer -= dt;
        }
        if (p.shockInvulnTimer > 0) {
            p.shockInvulnTimer -= dt;
        }
        if (p.respawnBlinkTimer > 0) {
            p.respawnBlinkTimer -= dt;
        }

        // 2. Tether Mid-Air Jump Handling
        if (p.isTethered && !p.isGrounded && p.jumpBufferTimer > 0) {
            this._performTetherJump();
            p.jumpBufferTimer = 0;
        }

        // 3. Wall Slide & Wall Jump Handling (Continuous Controlled Slide)
        p.isWallSliding = false;
        p.isWallHolding = false;

        if (!p.isGrounded && !p.isTethered && p.shockInvulnTimer <= 0) {
            const wallRunners = this.level ? this.level.getWallRunColliders() : [];
            for (const col of wallRunners) {
                if (col.isElectrified) continue; // Cannot wall-slide on electrified surface

                const verticalOverlap = (p.y + p.height > col.y + 4) && (p.y < col.y + col.height - 4);
                if (!verticalOverlap) continue;

                const face = col.wallRunFace || 'both';

                // Right face of collider (wall is to player's left: player is at col.x + col.width)
                const canTouchRightFace = (face === 'right' || face === 'both');
                const touchingRightFace = canTouchRightFace && Math.abs(p.x - (col.x + col.width)) <= 10;

                // Left face of collider (wall is to player's right: player is at col.x - player.width)
                const canTouchLeftFace = (face === 'left' || face === 'both');
                const touchingLeftFace = canTouchLeftFace && Math.abs((p.x + p.width) - col.x) <= 10;

                // Prevent immediate re-latching to the exact SAME wall face during wallJumpLockTimer
                // (Touching opposite wall latches immediately to allow rhythmic chimney scaling!)
                if (p.wallJumpLockTimer > 0) {
                    if (touchingRightFace && p.wallJumpOriginFace === -1) continue;
                    if (touchingLeftFace && p.wallJumpOriginFace === 1) continue;
                }

                // Ground jump ascent grace: standing on ground next to a wall and jumping must NOT stick to the wall!
                if (p.groundJumpWallGraceTimer > 0 && p.vy < 0) {
                    continue;
                }

                if (touchingRightFace) {
                    const isFreshContact = !prevWallSliding || prevWallDir !== -1;
                    p.isWallSliding = true;
                    p.wallSlideDirection = -1; // Wall is to the player's left
                    p.wallCoyoteTimer = this.WALL_COYOTE_TIME;
                    p.wallJumpLockTimer = 0; // Clear jump lock upon catching wall
                    p.wallJumpOriginFace = 0;
                    p.vx = 0;
                    p.x = col.x + col.width;
                    p.facing = -1;

                    // When first contacting a wall from mid-air:
                    // 1. Clear pre-contact airborne jump buffer so player does not bounce immediately!
                    // 2. Start momentary wall catch cushion timer
                    if (isFreshContact) {
                        p.jumpBufferTimer = 0;
                        p.wallCatchTimer = this.WALL_CUSHION_TIME;
                    }

                    // Continuous slide:
                    if (this.input.moveDown) {
                        p.vy = this.FAST_WALL_SLIDE_SPEED;
                    } else if (p.wallCatchTimer > 0) {
                        p.vy = this.WALL_CUSHION_SPEED; // Initial tactile cushion
                    } else {
                        p.vy = this.MAX_WALL_SLIDE_SPEED; // Steady downward slide (90 px/s)
                    }
                    break;
                } else if (touchingLeftFace) {
                    const isFreshContact = !prevWallSliding || prevWallDir !== 1;
                    p.isWallSliding = true;
                    p.wallSlideDirection = 1; // Wall is to the player's right
                    p.wallCoyoteTimer = this.WALL_COYOTE_TIME;
                    p.wallJumpLockTimer = 0; // Clear jump lock upon catching wall
                    p.wallJumpOriginFace = 0;
                    p.vx = 0;
                    p.x = col.x - p.width;
                    p.facing = 1;

                    // When first contacting a wall from mid-air:
                    // 1. Clear pre-contact airborne jump buffer so player does not bounce immediately!
                    // 2. Start momentary wall catch cushion timer
                    if (isFreshContact) {
                        p.jumpBufferTimer = 0;
                        p.wallCatchTimer = this.WALL_CUSHION_TIME;
                    }

                    // Continuous slide:
                    if (this.input.moveDown) {
                        p.vy = this.FAST_WALL_SLIDE_SPEED;
                    } else if (p.wallCatchTimer > 0) {
                        p.vy = this.WALL_CUSHION_SPEED; // Initial tactile cushion
                    } else {
                        p.vy = this.MAX_WALL_SLIDE_SPEED; // Steady downward slide (90 px/s)
                    }
                    break;
                }
            }
        }

        if (!p.isWallSliding) {
            p.wallCoyoteTimer = Math.max(0, p.wallCoyoteTimer - dt);
        }

        // Wall Jump Execution
        if (p.jumpBufferTimer > 0 && p.wallCoyoteTimer > 0 && !p.isGrounded && !p.isTethered) {
            this._performWallJump();
            p.jumpBufferTimer = 0;
            return;
        }

        // 4. Resting / Docking & Idle State
        let horizontalIntent = 0;
        // Direction keys A/D are completely locked out while holding/sliding on a wall.
        // The player is securely clinging to the wall and can leave ONLY via Space (wall jump) or Down (slide down).
        if (p.wallJumpLockTimer <= 0 && !p.isWallSliding) {
            if (this.input.moveLeft) horizontalIntent -= 1;
            if (this.input.moveRight) horizontalIntent += 1;
        }

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

        // Recharging battery strictly when connected to CHARGER socket
        if (p.isTethered && p.tetherSocket && p.tetherSocket.type === 'CHARGER') {
            const wasCharging = p.isCharging;
            p.isCharging = true;
            if (!wasCharging) {
                this.eventBus.emit('CHARGER_CONNECTED');
            }
            if (p.battery < p.maxBattery) {
                p.addBattery(this.CHARGER_RATE * dt);
                this.eventBus.emit('BATTERY_CHANGED', p.battery);
            }
        } else {
            p.isCharging = false;
        }

        // If resting, dampen movement
        if (p.isResting) {
            p.vx *= 0.5;
            this._applyGravity(dt);
            this._resolveCollisions(dt);
            return;
        }

        // 4. Horizontal Locomotion & Max Speed
        // Battery loss does NOT reduce or degrade player movement speed
        const targetSpeed = this.WALK_SPEED * horizontalIntent;

        if (this.instantLocomotion) {
            // ARCADE DETERMINISTIC LOCOMOTION (Brawlhalla style)
            if (p.isGrounded) {
                // Instant crisp response, 0 lag, instant stop
                p.vx = targetSpeed;
                if (horizontalIntent !== 0) {
                    p.drainBattery(this.DRAIN_WALK * dt);
                    this.eventBus.emit('BATTERY_CHANGED', p.battery);
                }
            } else if (!p.isTethered) {
                // In air (NOT tethered): horizontal aerial steering
                if (p.wallJumpLockTimer <= 0) {
                    if (horizontalIntent !== 0) {
                        // If player already has high momentum in intended direction (e.g. from swing release or wall jump),
                        // preserve high momentum rather than clamping down!
                        if (Math.sign(p.vx) === horizontalIntent && Math.abs(p.vx) > this.JUMP_HORIZONTAL_SPEED) {
                            p.vx *= Math.pow(this.AIR_DRAG, dt * 60);
                        } else {
                            p.vx = horizontalIntent * this.JUMP_HORIZONTAL_SPEED;
                        }
                    } else {
                        // In mid-air with no directional key, decay cleanly
                        p.vx *= Math.pow(this.AIR_DRAG, dt * 60);
                        if (Math.abs(p.vx) < 5) p.vx = 0;
                    }
                }
            }
        } else {
            // Classical momentum & acceleration ramp mode
            const accel = p.isGrounded ? this.GROUND_ACCEL : this.AIR_ACCEL;
            if (horizontalIntent !== 0) {
                if (p.isGrounded) {
                    p.drainBattery(this.DRAIN_WALK * dt);
                    this.eventBus.emit('BATTERY_CHANGED', p.battery);
                }

                if (Math.sign(p.vx) !== horizontalIntent) {
                    p.vx += horizontalIntent * accel * 1.5 * dt;
                } else {
                    p.vx += horizontalIntent * accel * dt;
                }

                if (Math.abs(p.vx) > Math.abs(targetSpeed)) {
                    p.vx = Math.sign(p.vx) * Math.max(Math.abs(targetSpeed), Math.abs(p.vx) * 0.95);
                }
            } else {
                if (p.isGrounded) {
                    p.vx *= Math.pow(this.GROUND_FRICTION, dt * 60);
                    if (Math.abs(p.vx) < 2) p.vx = 0;
                } else {
                    p.vx *= Math.pow(this.AIR_DRAG, dt * 60);
                }
            }
        }

        // Rhythmic footstep emission on ground locomotion
        if (p.isGrounded && Math.abs(p.vx) > 30 && !p.isWallSliding && !p.isWallRunning) {
            this.stepTimer = (this.stepTimer || 0) + dt;
            const stepInterval = Math.abs(p.vx) > 160 ? 0.28 : 0.40;
            if (this.stepTimer >= stepInterval) {
                this.stepTimer = 0;
                this.eventBus.emit('PLAYER_FOOTSTEP');
            }
        } else {
            this.stepTimer = 0.2;
        }

        // 5. Normal Ground Jump
        if (p.jumpBufferTimer > 0 && p.coyoteTimer > 0) {
            p.vy = this.JUMP_SPEED;
            p.coyoteTimer = 0;
            p.jumpBufferTimer = 0;
            p.isGrounded = false;
            p.groundJumpWallGraceTimer = 0.28; // Grace timer: ascending from ground jump does not stick to adjacent wall

            // In arcade locomotion mode, clamp initial horizontal velocity to JUMP_HORIZONTAL_SPEED
            // so jumping while sprinting does not overshoot the 2-tile span!
            if (this.instantLocomotion) {
                if (horizontalIntent !== 0) {
                    p.vx = horizontalIntent * this.JUMP_HORIZONTAL_SPEED;
                } else if (Math.abs(p.vx) > this.JUMP_HORIZONTAL_SPEED) {
                    p.vx = Math.sign(p.vx) * this.JUMP_HORIZONTAL_SPEED;
                }
            }

            // Deduct jump energy cost
            p.drainBattery(this.COST_JUMP);
            this.eventBus.emit('BATTERY_CHANGED', p.battery);
            this.eventBus.emit('PLAYER_JUMP', { x: p.x, y: p.y });
        }

        // Variable jump height cut ONLY when variableJumpHeight is enabled
        const isJumpHeld = this.input.isActionDown ? this.input.isActionDown('jump') : this.input.isKeyDown('Space');
        if (this.variableJumpHeight && !isJumpHeld && p.vy < -150) {
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
        p.vx = dir * this.TETHER_JUMP_HORIZONTAL;
        p.facing = dir;
        p.isGrounded = false;

        this.eventBus.emit('PLAYER_TETHER_JUMP', { x: p.x, y: p.y, dir });
    }

    _performWallJump() {
        const p = this.player;
        const jumpDir = -p.wallSlideDirection; // Leap outward away from wall

        p.vx = jumpDir * this.WALL_JUMP_OUTWARD;
        p.vy = this.WALL_JUMP_UP;
        p.facing = jumpDir;
        p.wallJumpLockTimer = this.WALL_JUMP_LOCK_TIME;
        p.wallJumpOriginFace = p.wallSlideDirection; // Track origin face to prevent re-latching to same face
        p.wallCoyoteTimer = 0;
        p.isWallSliding = false;
        p.isWallHolding = false;
        p.groundJumpWallGraceTimer = 0;

        p.drainBattery(this.COST_JUMP);
        this.eventBus.emit('BATTERY_CHANGED', p.battery);
        this.eventBus.emit('PLAYER_WALL_JUMP', { x: p.x, y: p.y, dir: jumpDir });
    }

    _applyGravity(dt) {
        const p = this.player;
        if (p.isWallSliding) {
            if (this.input.moveDown) {
                p.vy = this.FAST_WALL_SLIDE_SPEED;
            } else if (p.wallCatchTimer > 0) {
                p.vy = this.WALL_CUSHION_SPEED;
            } else {
                p.vy = this.MAX_WALL_SLIDE_SPEED;
            }
            return;
        }
        p.vy += this.GRAVITY * dt;
        if (p.vy > this.MAX_FALL_SPEED) {
            p.vy = this.MAX_FALL_SPEED;
        }
    }

    _resolveCollisions(dt) {
        const p = this.player;
        p.wasGrounded = p.isGrounded;

        const colliders = this.level ? this.level.getSolidColliders() : [];

        // 1. Move X & check horizontal collisions (swept with vertical overlap check)
        const prevX = p.x;
        p.x += p.vx * dt;

        if (p.vx > 0) {
            for (const col of colliders) {
                if (col.x > p.x + 160 || col.x + col.width < p.x - 160 || col.y > p.y + 160 || col.y + col.height < p.y - 160) continue;
                if (p.y < col.y + col.height && p.y + p.height > col.y) {
                    if (prevX + p.width <= col.x && p.x + p.width > col.x) {
                        p.x = col.x - p.width;
                        p.vx = 0;
                    }
                }
            }
        } else if (p.vx < 0) {
            for (const col of colliders) {
                if (col.x > p.x + 160 || col.x + col.width < p.x - 160 || col.y > p.y + 160 || col.y + col.height < p.y - 160) continue;
                if (p.y < col.y + col.height && p.y + p.height > col.y) {
                    if (prevX >= col.x + col.width && p.x < col.x + col.width) {
                        p.x = col.x + col.width;
                        p.vx = 0;
                    }
                }
            }
        }

        // 2. Move Y & check vertical collisions (swept with horizontal overlap check)
        const prevY = p.y;
        p.y += p.vy * dt;
        p.isGrounded = false;

        if (p.vy > 0) {
            for (const col of colliders) {
                if (col.x > p.x + 160 || col.x + col.width < p.x - 160 || col.y > p.y + 160 || col.y + col.height < p.y - 160) continue;
                if (p.x < col.x + col.width && p.x + p.width > col.x) {
                    if (prevY + p.height <= col.y && p.y + p.height > col.y) {
                        p.y = col.y - p.height;
                        p.vy = 0;
                        p.isGrounded = true;
                    }
                }
            }
        } else if (p.vy < 0) {
            for (const col of colliders) {
                if (col.x > p.x + 160 || col.x + col.width < p.x - 160 || col.y > p.y + 160 || col.y + col.height < p.y - 160) continue;
                if (p.x < col.x + col.width && p.x + p.width > col.x) {
                    if (prevY >= col.y + col.height && p.y < col.y + col.height) {
                        p.y = col.y + col.height;
                        p.vy = 0;
                    }
                }
            }
        }

        // 3. Fallback: resolve any remaining deep penetration along minimum translation vector (MTV)
        let bounds = p.getBounds();
        for (const col of colliders) {
            if (col.x > p.x + 160 || col.x + col.width < p.x - 160 || col.y > p.y + 160 || col.y + col.height < p.y - 160) continue;
            if (this._checkAABB(bounds, col)) {
                const overlapLeft = (p.x + p.width) - col.x;
                const overlapRight = (col.x + col.width) - p.x;
                const overlapTop = (p.y + p.height) - col.y;
                const overlapBottom = (col.y + col.height) - p.y;
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapTop) {
                    p.y = col.y - p.height;
                    p.vy = 0;
                    p.isGrounded = true;
                } else if (minOverlap === overlapBottom) {
                    p.y = col.y + col.height;
                    if (p.vy < 0) p.vy = 0;
                } else if (minOverlap === overlapLeft) {
                    p.x = col.x - p.width;
                    p.vx = 0;
                } else {
                    p.x = col.x + col.width;
                    p.vx = 0;
                }
                bounds = p.getBounds();
            }
        }

        // 4. Ceiling boundary clamp:
        // Inside And_gate_3_above and Level_7, row 0 is solid across all columns (ceiling at -288)
        const activeRoom = (this.level && this.level.rooms && this.level.rooms[this.level.activeRoomIndex]) || null;
        const facilityCeilingY = (this.level && this.level.rooms && this.level.rooms.length > 0)
            ? Math.min(...this.level.rooms.map(r => r.worldY))
            : -320;

        if (activeRoom && (activeRoom.id === 'And_gate_3_above' || activeRoom.id === 'Level_7' || activeRoom.worldY < 0)) {
            if (p.y < activeRoom.worldY + 32) {
                p.y = activeRoom.worldY + 32;
                if (p.vy < 0) p.vy = 0;
            }
        } else if (p.y < facilityCeilingY) {
            p.y = facilityCeilingY;
            if (p.vy < 0) p.vy = 0;
        }

        if (!p.wasGrounded && p.isGrounded) {
            this.eventBus.emit('PLAYER_LAND');
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

