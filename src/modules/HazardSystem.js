/**
 * HazardSystem.js
 * Independent modular system managing electrified hazards, surfaces, objects, and traps.
 * Communicates via EventBus: listens for ACTIVATE_DEVICE / DEACTIVATE_DEVICE / TOGGLE_DEVICE
 * to toggle hazard electrification, detects player contact, and emits PLAYER_SHOCKED.
 * 
 * Modular by design:
 * Any collider across any level with `isElectrified: true` acts as an active hazard.
 * Supports directional electrification ('left', 'right', 'top', 'bottom', 'all'), custom damage,
 * and custom knockback forces.
 */
export class HazardSystem {
    constructor(eventBus, player, level) {
        this.name = 'HazardSystem';
        this.eventBus = eventBus;
        this.player = player;
        this.level = level;

        this.pulseTime = 0;

        this._bindEvents();
    }

    init(engine) {
        this.engine = engine;
    }

    setLevel(level) {
        this.level = level;
    }

    _bindEvents() {
        this.eventBus.on('ACTIVATE_DEVICE', (deviceId) => {
            this._setDeviceElectrified(deviceId, true);
        });

        this.eventBus.on('DEACTIVATE_DEVICE', (deviceId) => {
            this._setDeviceElectrified(deviceId, false);
        });

        this.eventBus.on('TOGGLE_DEVICE', (deviceId) => {
            this._toggleDeviceElectrified(deviceId);
        });
    }

    _getHazards() {
        if (!this.level) return [];
        if (typeof this.level.getHazardColliders === 'function') {
            return this.level.getHazardColliders();
        }
        return (this.level.colliders || []).filter(c => c.isHazard === true);
    }

    _setDeviceElectrified(deviceId, state) {
        if (!this.level) return;
        const hazards = this._getHazards();
        for (const col of hazards) {
            if (col.deviceId === deviceId) {
                col.isElectrified = state;
            }
        }
    }

    _toggleDeviceElectrified(deviceId) {
        if (!this.level) return;
        const hazards = this._getHazards();
        for (const col of hazards) {
            if (col.deviceId === deviceId) {
                this._setDeviceElectrified(deviceId, !col.isElectrified);
            }
        }
    }

    update(dt) {
        this.pulseTime += dt * 12;

        if (!this.level || !this.player) return;

        const p = this.player;
        if (p.shockInvulnTimer > 0) {
            p.shockInvulnTimer -= dt;
            return;
        }

        const pBounds = p.getBounds();
        const hazards = this._getHazards().filter(c => c.isElectrified);

        for (const col of hazards) {
            // Check lethal contact with active electrified hazard
            if (this._checkHazardContact(p, pBounds, col)) {
                this._triggerShock(col);
                break;
            }
        }
    }

    _checkHazardContact(p, pBounds, col) {
        const rawFace = col.electrifiedFace || 'all';
        const face = rawFace.toLowerCase();
        const isCorridorBeam = Boolean(col.isCorridorBeam) || 
                               face === 'beam' ||
                               ((face === 'all' || face === 'all_sides') && col.width > col.height && col.width <= 128);

        if (isCorridorBeam) {
            // Horizontal laser beam spanning across a corridor or shaft
            const midY = col.y + col.height / 2;
            const beamLeft = col.x;
            const beamRight = col.x + col.width;
            return (
                pBounds.x < beamRight &&
                pBounds.x + pBounds.width > beamLeft &&
                pBounds.y < midY + 10 &&
                pBounds.y + pBounds.height > midY - 10
            );
        }

        if (face === 'top' || face === 'up') {
            // Floor laser: lethal threshold extends 10px above the floor into the player's feet
            return (
                pBounds.x < col.x + col.width &&
                pBounds.x + pBounds.width > col.x &&
                pBounds.y < col.y + col.height &&
                pBounds.y + pBounds.height >= col.y - 10
            );
        }

        if (face === 'bottom' || face === 'down') {
            // Ceiling laser: extends 10px below ceiling
            return (
                pBounds.x < col.x + col.width &&
                pBounds.x + pBounds.width > col.x &&
                pBounds.y <= col.y + col.height + 10 &&
                pBounds.y + pBounds.height > col.y
            );
        }

        if (face === 'right') {
            // Right-facing wall hazard (e.g. wall runner in Room 5)
            // Extends 8px to the right of the wall face
            return (
                pBounds.x < col.x + col.width + 8 &&
                pBounds.x + pBounds.width > col.x &&
                pBounds.y < col.y + col.height &&
                pBounds.y + pBounds.height > col.y
            );
        }

        if (face === 'left') {
            // Left-facing wall hazard
            return (
                pBounds.x < col.x + col.width &&
                pBounds.x + pBounds.width > col.x - 8 &&
                pBounds.y < col.y + col.height &&
                pBounds.y + pBounds.height > col.y
            );
        }

        // Standard 4-sided bounding box contact
        return (
            pBounds.x < col.x + col.width &&
            pBounds.x + pBounds.width > col.x &&
            pBounds.y < col.y + col.height &&
            pBounds.y + pBounds.height > col.y
        );
    }

    _triggerShock(col) {
        const p = this.player;
        const damage = col.shockDamage !== undefined ? col.shockDamage : 8.0;
        const knockbackForce = col.knockbackForce !== undefined ? col.knockbackForce : 360;

        const playerCenterX = p.x + p.width / 2;
        const playerCenterY = p.y + p.height / 2;
        const colCenterX = col.x + col.width / 2;
        const colCenterY = col.y + col.height / 2;

        let kbX = 0;
        let kbY = -220;

        const face = col.electrifiedFace || 'all';

        if (face === 'left') {
            // Electrified on the left face; push player to the left
            kbX = -knockbackForce;
            kbY = -220;
        } else if (face === 'right') {
            // Electrified on the right face; push player to the right
            kbX = knockbackForce;
            kbY = -220;
        } else if (face === 'top') {
            // Electrified floor surface; blast player upward
            kbY = -knockbackForce * 0.95;
            kbX = playerCenterX >= colCenterX ? 140 : -140;
        } else if (face === 'bottom') {
            // Electrified ceiling; blast player downward
            kbY = knockbackForce * 0.85;
            kbX = playerCenterX >= colCenterX ? 140 : -140;
        } else {
            // 'all' faces / omnidirectional repulsion from collider center
            const dx = playerCenterX - colCenterX;
            const dy = playerCenterY - colCenterY;
            const dist = Math.hypot(dx, dy) || 1;
            kbX = (dx / dist) * knockbackForce;
            kbY = Math.min(-200, (dy / dist) * knockbackForce);
        }

        p.shockInvulnTimer = 0.45; // 450ms invulnerability window

        // Security grid laser contact triggers immediate respawn at sector entrance (zero energy drain)
        this.eventBus.emit('PLAYER_LASER_CONTACT', {
            deviceId: col.deviceId,
            x: playerCenterX,
            y: playerCenterY
        });
    }

    _checkAABB(rectA, rectB) {
        return (
            rectA.x < rectB.x + rectB.width &&
            rectA.x + rectA.width > rectB.x &&
            rectA.y < rectB.y + rectB.height &&
            rectA.y + rectA.height > rectB.y
        );
    }

    render(ctx, camera = null) {
        ctx.save();

        if (this.level) {
            const hazards = this._getHazards().filter(c => c.isElectrified);
            for (const col of hazards) {
                if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(col.x, col.y, col.width, col.height, 32)) {
                    continue;
                }

                const rawFace = col.electrifiedFace || 'all';
                const face = rawFace.toLowerCase();

                const segments = [];
                // Check if this is a corridor laser beam (e.g. spanning wall-run shaft or doorway corridor)
                const isCorridorBeam = Boolean(col.isCorridorBeam) || 
                                       face === 'beam' ||
                                       ((face === 'all' || face === 'all_sides') && ((col.width > col.height && col.width <= 128) || (col.height > col.width && col.height <= 128)));

                if (isCorridorBeam) {
                    if (col.height > col.width) {
                        const midX = col.x + col.width / 2;
                        segments.push({ x1: midX, y1: col.y, x2: midX, y2: col.y + col.height, isHoriz: false });
                    } else {
                        const midY = col.y + col.height / 2;
                        segments.push({ x1: col.x, y1: midY, x2: col.x + col.width, y2: midY, isHoriz: true });
                    }
                } else if (face === 'top' || face === 'up') {
                    segments.push({ x1: col.x, y1: col.y, x2: col.x + col.width, y2: col.y, isHoriz: true });
                } else if (face === 'bottom' || face === 'down') {
                    segments.push({ x1: col.x, y1: col.y + col.height, x2: col.x + col.width, y2: col.y + col.height, isHoriz: true });
                } else if (face === 'left') {
                    segments.push({ x1: col.x, y1: col.y, x2: col.x, y2: col.y + col.height, isHoriz: false });
                } else if (face === 'right') {
                    segments.push({ x1: col.x + col.width, y1: col.y, x2: col.x + col.width, y2: col.y + col.height, isHoriz: false });
                } else {
                    // all sides
                    segments.push({ x1: col.x, y1: col.y, x2: col.x + col.width, y2: col.y, isHoriz: true });
                    segments.push({ x1: col.x + col.width, y1: col.y, x2: col.x + col.width, y2: col.y + col.height, isHoriz: false });
                    segments.push({ x1: col.x, y1: col.y + col.height, x2: col.x + col.width, y2: col.y + col.height, isHoriz: true });
                    segments.push({ x1: col.x, y1: col.y, x2: col.x, y2: col.y + col.height, isHoriz: false });
                }

                for (const seg of segments) {
                    this._renderLaserBeam(ctx, seg.x1, seg.y1, seg.x2, seg.y2, seg.isHoriz);
                }
            }
        }

        ctx.restore();
    }

    _renderLaserBeam(ctx, x1, y1, x2, y2, isHoriz) {
        const length = isHoriz ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
        if (length <= 0) return;

        // 1. Emitter Node End-Caps (Industrial dark metal chassis with laser diode)
        const drawEmitter = (x, y) => {
            ctx.fillStyle = '#1c2430';
            ctx.fillRect(x - 3, y - 3, 6, 6);
            ctx.fillStyle = '#d62828';
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        };
        drawEmitter(x1, y1);
        drawEmitter(x2, y2);

        // 2. Outer Solid High-Contrast Red Laser Line
        ctx.strokeStyle = '#d62828';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 3. Inner White-Pink High-Intensity Core Line
        ctx.strokeStyle = '#fff0f3';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}
