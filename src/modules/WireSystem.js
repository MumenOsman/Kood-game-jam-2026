/**
 * WireSystem.js
 * Manages the physical tether wire: aiming arc, plug projectile launch,
 * mid-air pendulum swinging physics (radial distance constraint),
 * auto-unplug on ground overrun, and right-click manual cut (no boost).
 */
export class WireSystem {
    constructor(eventBus, inputManager, player, level) {
        this.name = 'WireSystem';
        this.eventBus = eventBus;
        this.input = inputManager;
        this.player = player;
        this.level = level;

        // Constants (Calibrated to 2.5 squares = 80px)
        this.wireLengthSquares = 2.5; // 2.5 squares (2.5 x 32px)
        this.MIN_WIRE_LENGTH = 20;
        this.MIN_THROW_SPEED = 1400;
        this.MAX_THROW_SPEED = 1400; // Straight, snappy projectile speed towards mouse cursor
        this.PROJECTILE_GRAVITY = 0; // Pure straight trajectory matching mouse aim
        this.REEL_SPEED = 120; // px/s for climbing W/S

        // Plug projectile state
        this.projectile = null; // { x, y, vx, vy, life }

        // Visual effects
        this.electricPhase = 0;

        // Listen for detach requests (e.g. Tether Jump from PlayerMovement)
        this.eventBus.on('REQUEST_WIRE_DETACH', () => {
            this.disconnectWire();
        });
    }

    get MAX_WIRE_LENGTH() {
        return this.wireLengthSquares * 32;
    }
    set MAX_WIRE_LENGTH(v) {
        this.wireLengthSquares = Math.round((v / 32) * 10) / 10;
        if (this.player) this.player.tetherMaxDist = this.wireLengthSquares * 32;
    }

    init(engine) {
        this.engine = engine;
    }

    update(dt) {
        const p = this.player;
        const head = p.getHeadSocket();
        this.electricPhase += dt * 15;

        // 1. Highlight sockets within range
        this._updateSocketHighlights(head);

        // 2. Aiming & Power Charging (Left-Click hold)
        this._handleAiming(dt, head);

        // 3. Projectile in flight physics
        this._updateProjectile(dt, head);

        // 4. Mid-air pendulum swinging & Ground tension constraint
        if (p.isTethered && p.tetherSocket) {
            this._updateTetherPhysics(dt, head);
        }

        // 5. Manual wire cut (RMB / custom cut binding)
        const cutTriggered = this.input.isActionPressed ? this.input.isActionPressed('cutWire') : this.input.rightPressedThisFrame;
        if (cutTriggered && (p.isTethered || this.projectile)) {
            this.disconnectWire();
        }
    }

    _updateSocketHighlights(head) {
        const sockets = this.level ? this.level.getSockets() : [];
        for (const sock of sockets) {
            const dist = Math.hypot(sock.x - head.x, sock.y - head.y);
            sock.isHighlighted = (dist <= this.MAX_WIRE_LENGTH);
        }
    }

    _handleAiming(dt, head) {
        const p = this.player;

        // Count down shooting recoil animation timer
        if (p.shootTimer > 0) {
            p.shootTimer = Math.max(0, p.shootTimer - dt);
        }

        // Single click LMB (or custom shoot binding) fires wire projectile immediately (unless clicking an interactive drone)
        const shootTriggered = this.input.isActionPressed ? this.input.isActionPressed('shootWire') : this.input.leftPressedThisFrame;
        const isHoveringDrone = this.level && this.level.drones && this.level.drones.some(d => d.isHovered);
        if (shootTriggered && !p.isTethered && !this.projectile && !isHoveringDrone) {
            const dx = this.input.mouseWorld.x - (p.x + p.width / 2);
            if (Math.abs(dx) > 4) {
                p.facing = dx >= 0 ? 1 : -1;
            }

            const muzzle = p.getHeadSocket();
            const angle = Math.atan2(this.input.mouseWorld.y - muzzle.y, this.input.mouseWorld.x - muzzle.x);
            p.aimAngle = angle;
            p.shootTimer = 0.25;

            this._launchPlug(muzzle, angle);
        }
    }

    _launchPlug(muzzle, angle) {
        const speed = this.MAX_THROW_SPEED;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        this.projectile = {
            x: muzzle.x,
            y: muzzle.y,
            vx: vx,
            vy: vy,
            distanceTraveled: 0
        };

        this.eventBus.emit('WIRE_LAUNCHED', { x: muzzle.x, y: muzzle.y, vx, vy });
    }

    _updateProjectile(dt, head) {
        if (!this.projectile) return;

        const proj = this.projectile;
        // Fly straight in the aimed direction (zero gravity drop)
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        const distFromHead = Math.hypot(proj.x - head.x, proj.y - head.y);

        // Check max wire range exceeded
        if (distFromHead > this.MAX_WIRE_LENGTH) {
            this.projectile = null;
            return;
        }

        // Check collision with sockets
        const sockets = this.level ? this.level.getSockets() : [];
        for (const sock of sockets) {
            const distToSocket = Math.hypot(proj.x - sock.x, proj.y - sock.y);
            if (distToSocket <= sock.radius + 16) {
                // Latched!
                this._connectWire(sock);
                this.projectile = null;
                return;
            }
        }

        // Check collision with solid platforms (projectile bounces or snaps back)
        const colliders = this.level ? this.level.getSolidColliders() : [];
        for (const col of colliders) {
            if (
                proj.x >= col.x && proj.x <= col.x + col.width &&
                proj.y >= col.y && proj.y <= col.y + col.height
            ) {
                // Hit wall -> retract wire
                this.projectile = null;
                return;
            }
        }
    }

    _connectWire(socket) {
        const p = this.player;
        const head = p.getHeadSocket();

        p.isTethered = true;
        p.tetherSocket = socket;
        p.tetherLength = Math.hypot(socket.x - head.x, socket.y - head.y);
        socket.isPlugged = true;

        this.eventBus.emit('WIRE_CONNECTED', socket);
    }

    disconnectWire() {
        const p = this.player;
        if (p.tetherSocket) {
            p.tetherSocket.isPlugged = false;
            this.eventBus.emit('WIRE_DISCONNECTED', p.tetherSocket);
        }

        p.isTethered = false;
        p.tetherSocket = null;
        this.projectile = null;
    }

    _updateTetherPhysics(dt, head) {
        const p = this.player;
        const sock = p.tetherSocket;

        // Distance from socket to head
        const rx = head.x - sock.x;
        const ry = head.y - sock.y;
        const currentDist = Math.hypot(rx, ry);

        // 1. Reel in/out with W / S keys
        if (this.input.moveUp) {
            const minAllowed = (sock.type === 'CIRCUIT' || sock.isInsideSolid) ? 36 : this.MIN_WIRE_LENGTH;
            if (p.isGrounded) {
                // Ground safety: tether length cannot shrink below current physical distance
                p.tetherLength = Math.max(currentDist, p.tetherLength - this.REEL_SPEED * dt);
            } else {
                p.tetherLength = Math.max(minAllowed, p.tetherLength - this.REEL_SPEED * dt);
            }
        }
        if (this.input.moveDown && !p.isGrounded) {
            p.tetherLength = Math.min(this.MAX_WIRE_LENGTH, p.tetherLength + this.REEL_SPEED * dt);
        }

        // 2. Ground Tension: walking past max wire length snaps plug out automatically
        if (p.isGrounded) {
            if (currentDist > this.MAX_WIRE_LENGTH) {
                this.disconnectWire();
                return;
            }
        } else {
            // Directional swing pumping (Brawlhalla / SpeedRunners feel):
            // Holding directional key accelerates / pumps the swing along the circular tangent!
            let horizontalIntent = 0;
            if (this.input.moveLeft) horizontalIntent -= 1;
            if (this.input.moveRight) horizontalIntent += 1;

            if (horizontalIntent !== 0 && currentDist > 0.001 && ry > 0) {
                // Unit normal from socket to player
                const nx = rx / currentDist;
                const ny = ry / currentDist;

                // Tangent vector pointing in positive horizontal direction (clockwise when hanging below)
                // Note: ny > 0 when player is below socket
                const pumpX = horizontalIntent * ny;
                const pumpY = horizontalIntent * (-nx);

                // Additive pump acceleration
                const SWING_PUMP_ACCEL = 420; // px/s² (smooth and controlled)
                p.vx += pumpX * SWING_PUMP_ACCEL * dt;
                p.vy += pumpY * SWING_PUMP_ACCEL * dt;

                p.facing = horizontalIntent;

                // Speed cap for natural control
                const MAX_SWING_SPEED = 400; // px/s
                const currentSpeed = Math.hypot(p.vx, p.vy);
                if (currentSpeed > MAX_SWING_SPEED) {
                    p.vx = (p.vx / currentSpeed) * MAX_SWING_SPEED;
                    p.vy = (p.vy / currentSpeed) * MAX_SWING_SPEED;
                }
            }

            // 3. Mid-air Pendulum Distance Constraint
            if (currentDist > p.tetherLength && currentDist > 0.001) {
                const nx = rx / currentDist;
                const ny = ry / currentDist;

                // Position correction to stay on circular arc
                const desiredHeadX = sock.x + nx * p.tetherLength;
                const desiredHeadY = sock.y + ny * p.tetherLength;

                const headOffset = p.getHeadSocket();
                const deltaX = desiredHeadX - headOffset.x;
                const deltaY = desiredHeadY - headOffset.y;

                // Collision-safe position resolution against solid tiles
                const colliders = this.level ? this.level.getSolidColliders() : [];

                // 1. Move X with genuine vertical overlap check
                const prevX = p.x;
                p.x += deltaX;
                if (deltaX > 0) {
                    for (const col of colliders) {
                        if (p.y < col.y + col.height && p.y + p.height > col.y) {
                            if (prevX + p.width <= col.x && p.x + p.width > col.x) {
                                p.x = col.x - p.width;
                            }
                        }
                    }
                } else if (deltaX < 0) {
                    for (const col of colliders) {
                        if (p.y < col.y + col.height && p.y + p.height > col.y) {
                            if (prevX >= col.x + col.width && p.x < col.x + col.width) {
                                p.x = col.x + col.width;
                            }
                        }
                    }
                }

                // 2. Move Y with genuine horizontal overlap check
                const prevY = p.y;
                p.y += deltaY;
                if (deltaY > 0) {
                    for (const col of colliders) {
                        if (p.x < col.x + col.width && p.x + p.width > col.x) {
                            if (prevY + p.height <= col.y && p.y + p.height > col.y) {
                                p.y = col.y - p.height;
                            }
                        }
                    }
                } else if (deltaY < 0) {
                    for (const col of colliders) {
                        if (p.x < col.x + col.width && p.x + p.width > col.x) {
                            if (prevY >= col.y + col.height && p.y < col.y + col.height) {
                                p.y = col.y + col.height;
                            }
                        }
                    }
                }

                // 3. Fallback MTV for any residual penetration
                let bounds = p.getBounds();
                for (const col of colliders) {
                    if (this._checkAABB(bounds, col)) {
                        const overlapLeft = (p.x + p.width) - col.x;
                        const overlapRight = (col.x + col.width) - p.x;
                        const overlapTop = (p.y + p.height) - col.y;
                        const overlapBottom = (col.y + col.height) - p.y;
                        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
                        if (minOverlap === overlapTop) p.y = col.y - p.height;
                        else if (minOverlap === overlapBottom) p.y = col.y + col.height;
                        else if (minOverlap === overlapLeft) p.x = col.x - p.width;
                        else p.x = col.x + col.width;
                        bounds = p.getBounds();
                    }
                }

                // If player was stopped by solid geometry, clamp tetherLength to actual contact distance
                // so the rope doesn't keep pulling the player through the wall
                const finalHead = p.getHeadSocket();
                const actualDist = Math.hypot(sock.x - finalHead.x, sock.y - finalHead.y);
                if (actualDist > p.tetherLength) {
                    p.tetherLength = Math.max(p.tetherLength, actualDist);
                }

                // Velocity constraint: eliminate outward radial velocity
                const vRadial = p.vx * nx + p.vy * ny;
                if (vRadial > 0) {
                    p.vx -= vRadial * nx;
                    p.vy -= vRadial * ny;
                }

                // Gentle angular damping to simulate realistic rope tension
                p.vx *= 0.998;
                p.vy *= 0.998;
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

    render(ctx) {
        const p = this.player;
        const head = p.getHeadSocket();

        // 1. Draw Flying Plug Projectile
        if (this.projectile) {
            this._renderProjectile(ctx, head);
        }

        // 2. Draw Connected Tether Wire
        if (p.isTethered && p.tetherSocket) {
            this._renderTetherWire(ctx, head, p.tetherSocket);
        }
    }

    _renderAimArc(ctx, head) {
        const p = this.player;
        const speed = this.MIN_THROW_SPEED + p.aimPower * (this.MAX_THROW_SPEED - this.MIN_THROW_SPEED);
        const vx = Math.cos(p.aimAngle) * speed;
        const vy = Math.sin(p.aimAngle) * speed;

        ctx.save();
        ctx.beginPath();
        const steps = 22;
        const dtStep = 0.024;

        let simX = head.x;
        let simY = head.y;
        let simVy = vy;

        ctx.moveTo(simX, simY);

        for (let i = 1; i <= steps; i++) {
            simX += vx * dtStep;
            simVy += this.PROJECTILE_GRAVITY * dtStep;
            simY += simVy * dtStep;

            const dist = Math.hypot(simX - head.x, simY - head.y);
            if (dist > this.MAX_WIRE_LENGTH) break;

            ctx.lineTo(simX, simY);
        }

        // Render trajectory as dotted glowing orange arc
        ctx.strokeStyle = 'rgba(255, 170, 0, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    _renderSpinningPlug(ctx, head) {
        const p = this.player;
        const spinRadius = 26;
        const px = head.x + Math.cos(p.spinAngle) * spinRadius;
        const py = head.y + Math.sin(p.spinAngle) * spinRadius;

        ctx.save();
        // Wire between head and spinning plug
        ctx.strokeStyle = '#ff9900';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Plug tip
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _renderProjectile(ctx, head) {
        const proj = this.projectile;

        ctx.save();
        // Cable following projectile
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(head.x, head.y);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();

        // Glowing plug head
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    _renderTetherWire(ctx, head, socket) {
        const p = this.player;
        const dist = Math.hypot(socket.x - head.x, socket.y - head.y);
        const isTaut = dist >= p.tetherLength - 2;

        ctx.save();

        if (isTaut) {
            // Taut wire: straight glowing industrial cable
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(head.x, head.y);
            ctx.lineTo(socket.x, socket.y);
            ctx.stroke();

            // Inner electric core
            ctx.strokeStyle = '#fff5a0';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        } else {
            // Slack wire: quadratic Bezier curve with gravity sag
            const midX = (head.x + socket.x) / 2;
            const slackAmount = Math.min(45, (p.tetherLength - dist) * 0.45 + 10);
            const controlY = Math.max(head.y, socket.y) + slackAmount;

            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(head.x, head.y);
            ctx.quadraticCurveTo(midX, controlY, socket.x, socket.y);
            ctx.stroke();
        }

        ctx.restore();
    }
}

