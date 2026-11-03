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
        this.sparkParticles = [];

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

    _setDeviceElectrified(deviceId, state) {
        if (!this.level) return;
        const colliders = this.level.getSolidColliders();
        for (const col of colliders) {
            if (col.deviceId === deviceId) {
                col.isElectrified = state;
                const cx = col.x + col.width / 2;
                const cy = col.y + col.height / 2;
                this._spawnSparks(cx, cy, state ? '#ff4081' : '#00e5ff', 16);
            }
        }
    }

    _toggleDeviceElectrified(deviceId) {
        if (!this.level) return;
        const colliders = this.level.getSolidColliders();
        for (const col of colliders) {
            if (col.deviceId === deviceId) {
                this._setDeviceElectrified(deviceId, !col.isElectrified);
            }
        }
    }

    update(dt) {
        this.pulseTime += dt * 12;
        this._updateSparks(dt);

        if (!this.level || !this.player) return;

        const p = this.player;
        if (p.shockInvulnTimer > 0) {
            p.shockInvulnTimer -= dt;
            return;
        }

        const pBounds = p.getBounds();
        const colliders = this.level.getSolidColliders();

        for (const col of colliders) {
            if (!col.isElectrified) continue;

            // Check collision with the electrified hazard
            if (this._checkAABB(pBounds, col)) {
                this._triggerShock(col);
                break;
            }
        }
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

        // Spawn high-voltage shock burst particles
        this._spawnSparks(playerCenterX, playerCenterY, '#ff4081', 20);
        this._spawnSparks(playerCenterX, playerCenterY, '#00e5ff', 12);

        this.eventBus.emit('PLAYER_SHOCKED', {
            damage,
            knockbackX: kbX,
            knockbackY: kbY,
            deviceId: col.deviceId
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

    _spawnSparks(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 70 + Math.random() * 160;
            this.sparkParticles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 0.25 + Math.random() * 0.25
            });
        }
    }

    _updateSparks(dt) {
        for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
            const sp = this.sparkParticles[i];
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.life -= dt;
            if (sp.life <= 0) {
                this.sparkParticles.splice(i, 1);
            }
        }
    }

    render(ctx) {
        ctx.save();

        if (this.level) {
            const colliders = this.level.getSolidColliders();
            for (const col of colliders) {
                if (col.isElectrified) {
                    this._renderElectrifiedSurface(ctx, col);
                } else if (col.deviceId && col.isElectrified === false) {
                    this._renderDeElectrifiedSurface(ctx, col);
                }
            }
        }

        // Render spark particles
        for (const sp of this.sparkParticles) {
            ctx.fillStyle = sp.color;
            ctx.fillRect(sp.x - 1.5, sp.y - 1.5, 3, 3);
        }

        ctx.restore();
    }

    _renderElectrifiedSurface(ctx, col) {
        ctx.save();
        const face = col.electrifiedFace || 'all';

        // Helper to draw electric arc along any segment
        const drawArc = (x1, y1, x2, y2) => {
            this._renderArcSegment(ctx, x1, y1, x2, y2);
        };

        if (face === 'right') {
            drawArc(col.x + col.width, col.y, col.x + col.width, col.y + col.height);
        } else if (face === 'left') {
            drawArc(col.x, col.y, col.x, col.y + col.height);
        } else if (face === 'top') {
            drawArc(col.x, col.y, col.x + col.width, col.y);
        } else if (face === 'bottom') {
            drawArc(col.x, col.y + col.height, col.x + col.width, col.y + col.height);
        } else {
            // 'all': render perimeter box
            drawArc(col.x, col.y, col.x + col.width, col.y);
            drawArc(col.x + col.width, col.y, col.x + col.width, col.y + col.height);
            drawArc(col.x + col.width, col.y + col.height, col.x, col.y + col.height);
            drawArc(col.x, col.y + col.height, col.x, col.y);
        }

        ctx.restore();
    }

    _renderArcSegment(ctx, x1, y1, x2, y2) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (len < 4) return;

        const dx = (x2 - x1) / len;
        const dy = (y2 - y1) / len;
        // Normal vector pointing perpendicular to segment
        const nx = -dy;
        const ny = dx;

        // 1. Hazard glow backdrop along line
        ctx.strokeStyle = 'rgba(255, 64, 129, 0.4)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 2. High-voltage animated electric crackle arcs (squiggly lightning)
        const segments = Math.max(5, Math.floor(len / 18));
        const segLen = len / segments;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let i = 1; i <= segments; i++) {
            const currentDist = i * segLen;
            const baseX = x1 + dx * currentDist;
            const baseY = y1 + dy * currentDist;
            const jitter = Math.sin(this.pulseTime + i * 1.8) * 6 + Math.cos(this.pulseTime * 2 + i) * 3;
            ctx.lineTo(baseX + nx * jitter, baseY + ny * jitter);
        }
        ctx.strokeStyle = '#ff4081';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner white/cyan core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Secondary counter-phase lightning arc
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let i = 1; i <= segments; i++) {
            const currentDist = i * segLen;
            const baseX = x1 + dx * currentDist;
            const baseY = y1 + dy * currentDist;
            const jitter = Math.cos(this.pulseTime * 1.5 + i * 2.2) * 5;
            ctx.lineTo(baseX + nx * jitter, baseY + ny * jitter);
        }
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // 3. Hazard warning status lights at ends
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(x1 + dx * 10, y1 + dy * 10, 4, 0, Math.PI * 2);
        ctx.arc(x2 - dx * 10, y2 - dy * 10, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    _renderDeElectrifiedSurface(ctx, col) {
        ctx.save();
        const face = col.electrifiedFace || 'all';

        const drawSafeLights = (x1, y1, x2, y2) => {
            const len = Math.hypot(x2 - x1, y2 - y1);
            if (len < 4) return;
            const dx = (x2 - x1) / len;
            const dy = (y2 - y1) / len;

            ctx.fillStyle = '#00e676';
            ctx.beginPath();
            ctx.arc(x1 + dx * 12, y1 + dy * 12, 3.5, 0, Math.PI * 2);
            ctx.arc(x2 - dx * 12, y2 - dy * 12, 3.5, 0, Math.PI * 2);
            ctx.fill();
        };

        if (face === 'right') {
            drawSafeLights(col.x + col.width, col.y, col.x + col.width, col.y + col.height);
        } else if (face === 'left') {
            drawSafeLights(col.x, col.y, col.x, col.y + col.height);
        } else if (face === 'top') {
            drawSafeLights(col.x, col.y, col.x + col.width, col.y);
        } else if (face === 'bottom') {
            drawSafeLights(col.x, col.y + col.height, col.x + col.width, col.y + col.height);
        } else {
            drawSafeLights(col.x, col.y, col.x + col.width, col.y);
            drawSafeLights(col.x, col.y + col.height, col.x + col.width, col.y + col.height);
        }

        ctx.restore();
    }
}
