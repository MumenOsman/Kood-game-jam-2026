/**
 * DevTools.js
 * Comprehensive in-engine development, inspection, and physics calibration suite.
 * 
 * Completely decoupled from production:
 * - Dynamically imported only when IS_DEV is true (localhost or ?debug=true).
 * - Observes entities and EventBus without mutating core game architecture.
 * - Zero footprint when shipped to itch.io or production.
 */
export class DevTools {
    constructor(ctx) {
        this.engine = ctx.engine;
        this.eventBus = ctx.eventBus;
        this.input = ctx.input;
        this.player = ctx.player;
        this.camera = ctx.camera;
        this.movement = ctx.movement;
        this.wireSystem = ctx.wireSystem;
        this.circuitSystem = ctx.circuitSystem;
        this.hazardSystem = ctx.hazardSystem;
        this.level = ctx.level;
        this.hud = ctx.hud;
        this.canvas = ctx.canvas;

        // Toggle state
        this.isEnabled = true;
        this.showTelemetry = true;
        this.showHitboxes = true;
        this.showTrajectory = true;
        this.showRuler = true;
        this.showTuningPanel = false;

        // Trajectory recording buffer (3 seconds at 60Hz = 180 samples)
        this.trajectoryHistory = [];
        this.maxTrajectorySamples = 180;
        this.currentApex = null;
        this.lastJumpOrigin = null;
        this.lastJumpLanding = null;

        // Interactive Ruler State
        this.isRulerActive = false;
        this.rulerStart = null;
        this.rulerEnd = null;

        // Original default values for reset capability
        this.defaults = this._captureDefaults();

        // Mouse tracking for ruler
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;

        // DOM elements
        this.panelEl = null;
        this.styleEl = null;

        this._bindEvents();
    }

    _captureDefaults() {
        const m = this.movement;
        const w = this.wireSystem;
        return {
            WALK_SPEED: m.WALK_SPEED,
            RUN_SPEED: m.RUN_SPEED,
            GROUND_ACCEL: m.GROUND_ACCEL,
            AIR_ACCEL: m.AIR_ACCEL,
            GROUND_FRICTION: m.GROUND_FRICTION,
            AIR_DRAG: m.AIR_DRAG,
            GRAVITY: m.GRAVITY,
            MAX_FALL_SPEED: m.MAX_FALL_SPEED,
            JUMP_SPEED: m.JUMP_SPEED,
            TETHER_JUMP_UP: m.TETHER_JUMP_UP,
            TETHER_JUMP_HORIZONTAL: m.TETHER_JUMP_HORIZONTAL,
            WALL_JUMP_UP: m.WALL_JUMP_UP,
            WALL_JUMP_OUTWARD: m.WALL_JUMP_OUTWARD,
            MAX_WALL_SLIDE_SPEED: m.MAX_WALL_SLIDE_SPEED,
            FAST_WALL_SLIDE_SPEED: m.FAST_WALL_SLIDE_SPEED,
            MIN_THROW_SPEED: w.MIN_THROW_SPEED,
            MAX_THROW_SPEED: w.MAX_THROW_SPEED,
            PROJECTILE_GRAVITY: w.PROJECTILE_GRAVITY,
            REEL_SPEED: w.REEL_SPEED,
            MAX_WIRE_LENGTH: w.MAX_WIRE_LENGTH
        };
    }

    init() {
        if (typeof document !== 'undefined') {
            this._injectStyles();
            this._buildDOMPanel();
        }
        console.log('[DevTools] Initialized! Press [~] (Tilde) or [F1] to toggle DevTools overlay.');
    }

    _bindEvents() {
        if (typeof window !== 'undefined') {
            // Global toggle hotkeys: Backquote (~) or F1
            window.addEventListener('keydown', (e) => {
                if (e.code === 'Backquote' || e.code === 'F1') {
                    e.preventDefault();
                    this.toggle();
                }
            });
        }

        // EventBus listeners for trajectory apex tracking
        this.eventBus.on('PLAYER_JUMP', ({ x, y }) => {
            this.lastJumpOrigin = { x, y };
            this.currentApex = { x, y };
            this.lastJumpLanding = null;
        });

        this.eventBus.on('PLAYER_WALL_JUMP', ({ x, y }) => {
            this.lastJumpOrigin = { x, y };
            this.currentApex = { x, y };
            this.lastJumpLanding = null;
        });

        this.eventBus.on('PLAYER_TETHER_JUMP', ({ x, y }) => {
            this.lastJumpOrigin = { x, y };
            this.currentApex = { x, y };
            this.lastJumpLanding = null;
        });

        // Interactive Distance Ruler via Shift + Right-Click Drag
        if (typeof window !== 'undefined' && this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => {
                if (!this.isEnabled || !this.showRuler) return;
                if (e.shiftKey && e.button === 2) {
                    e.preventDefault();
                    this.isRulerActive = true;
                    this.rulerStart = { x: this.mouseWorldX, y: this.mouseWorldY };
                    this.rulerEnd = { x: this.mouseWorldX, y: this.mouseWorldY };
                }
            });

            window.addEventListener('mousemove', (e) => {
                if (this.camera && this.canvas) {
                    const rect = this.canvas.getBoundingClientRect();
                    const scaleX = this.canvas.width / rect.width;
                    const scaleY = this.canvas.height / rect.height;
                    const sx = (e.clientX - rect.x) * scaleX;
                    const sy = (e.clientY - rect.y) * scaleY;
                    this.mouseWorldX = sx + this.camera.x;
                    this.mouseWorldY = sy + this.camera.y;

                    if (this.isRulerActive && this.rulerStart) {
                        this.rulerEnd = { x: this.mouseWorldX, y: this.mouseWorldY };
                    }
                }
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button === 2 && this.isRulerActive) {
                    // Keep ruler visible until clicked again or Esc
                }
            });

            window.addEventListener('keydown', (e) => {
                if (e.code === 'Escape' && this.isRulerActive) {
                    this.isRulerActive = false;
                    this.rulerStart = null;
                    this.rulerEnd = null;
                }
            });
        }
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        if (this.panelEl) {
            this.panelEl.style.display = this.isEnabled ? 'block' : 'none';
        }
    }

    update(dt) {
        if (!this.isEnabled) return;

        const p = this.player;
        if (!p) return;

        // 1. Record Trajectory Point
        const px = p.x + p.width / 2;
        const py = p.y + p.height;
        this.trajectoryHistory.push({
            x: px,
            y: py,
            isGrounded: p.isGrounded,
            isWallSliding: p.isWallSliding,
            isTethered: p.isTethered
        });

        if (this.trajectoryHistory.length > this.maxTrajectorySamples) {
            this.trajectoryHistory.shift();
        }

        // 2. Track Apex
        if (this.lastJumpOrigin && !p.isGrounded) {
            if (!this.currentApex || py < this.currentApex.y) {
                this.currentApex = { x: px, y: py };
            }
        } else if (p.isGrounded && this.lastJumpOrigin && !this.lastJumpLanding) {
            this.lastJumpLanding = { x: px, y: py };
        }

        // 3. Update DOM Telemetry if visible
        this._updateDOMTelemetry();
    }

    /**
     * Render world-space gizmos (hitboxes, trajectory, constraint circles, ruler)
     * Called inside camera.applyTransform(ctx)
     */
    renderWorld(ctx) {
        if (!this.isEnabled) return;

        ctx.save();

        // 1. Render Trajectory Trail
        if (this.showTrajectory) {
            this._renderTrajectory(ctx);
        }

        // 2. Render Hitbox & Constraint Gizmos
        if (this.showHitboxes) {
            this._renderHitboxes(ctx);
            this._renderSocketGizmos(ctx);
            this._renderPendulumConstraint(ctx);
        }

        // 3. Render Measuring Ruler
        if (this.showRuler && this.rulerStart && this.rulerEnd) {
            this._renderRuler(ctx);
        }

        ctx.restore();
    }

    /**
     * Render screen-space telemetry overlay (text readouts, timer gauges)
     * Called outside camera transforms
     */
    renderScreen(ctx) {
        if (!this.isEnabled || !this.showTelemetry) return;

        ctx.save();
        this._renderTelemetryHUD(ctx);
        ctx.restore();
    }

    _renderTrajectory(ctx) {
        if (this.trajectoryHistory.length < 2) return;

        ctx.save();
        ctx.lineWidth = 2.5;

        for (let i = 1; i < this.trajectoryHistory.length; i++) {
            const p1 = this.trajectoryHistory[i - 1];
            const p2 = this.trajectoryHistory[i];
            const alpha = (i / this.trajectoryHistory.length) * 0.75;

            ctx.strokeStyle = p2.isTethered
                ? `rgba(255, 170, 0, ${alpha})`
                : p2.isWallSliding
                ? `rgba(0, 229, 255, ${alpha})`
                : `rgba(0, 255, 120, ${alpha})`;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        // Apex marker
        if (this.currentApex && this.lastJumpOrigin) {
            const apex = this.currentApex;
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(apex.x - 14, apex.y);
            ctx.lineTo(apex.x + 14, apex.y);
            ctx.stroke();

            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 10px monospace';
            const jumpHeight = Math.round(this.lastJumpOrigin.y - apex.y);
            ctx.fillText(`APEX: ${jumpHeight}px`, apex.x + 18, apex.y + 4);
        }

        // Jump distance span marker
        if (this.lastJumpOrigin && this.lastJumpLanding) {
            const span = Math.round(Math.abs(this.lastJumpLanding.x - this.lastJumpOrigin.x));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(this.lastJumpOrigin.x, this.lastJumpLanding.y + 8);
            ctx.lineTo(this.lastJumpLanding.x, this.lastJumpLanding.y + 8);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#ffffff';
            ctx.font = '9px monospace';
            const midX = (this.lastJumpOrigin.x + this.lastJumpLanding.x) / 2;
            ctx.fillText(`SPAN: ${span}px`, midX - 25, this.lastJumpLanding.y + 22);
        }

        ctx.restore();
    }

    _renderHitboxes(ctx) {
        ctx.save();
        ctx.lineWidth = 1.5;

        // 1. Level Solid Colliders
        if (this.level) {
            const colliders = this.level.getSolidColliders();
            for (const col of colliders) {
                if (col.isElectrified) {
                    // Electrified Hazard Hitbox
                    ctx.strokeStyle = '#ff1744';
                    ctx.strokeRect(col.x, col.y, col.width, col.height);
                    ctx.fillStyle = 'rgba(255, 23, 68, 0.08)';
                    ctx.fillRect(col.x, col.y, col.width, col.height);

                    // Electrified face tag
                    ctx.fillStyle = '#ff1744';
                    ctx.font = 'bold 9px monospace';
                    ctx.fillText(`HAZARD [${col.electrifiedFace || 'all'}]`, col.x + 4, col.y + 14);
                } else if (col.isWallRunnable) {
                    // Wall-Runnable Strip Hitbox
                    ctx.strokeStyle = '#00e5ff';
                    ctx.strokeRect(col.x, col.y, col.width, col.height);
                    ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
                    ctx.fillRect(col.x, col.y, col.width, col.height);

                    // 10px grab threshold indicators
                    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
                    ctx.setLineDash([3, 3]);
                    const face = col.wallRunFace || 'both';
                    if (face === 'right' || face === 'both') {
                        ctx.strokeRect(col.x + col.width, col.y, 10, col.height);
                    }
                    if (face === 'left' || face === 'both') {
                        ctx.strokeRect(col.x - 10, col.y, 10, col.height);
                    }
                    ctx.setLineDash([]);

                    ctx.fillStyle = '#00e5ff';
                    ctx.font = 'bold 9px monospace';
                    ctx.fillText(`WALL RUN [${face}]`, col.x + 4, col.y + 14);
                } else {
                    // Standard Platform Collider
                    ctx.strokeStyle = 'rgba(80, 140, 220, 0.5)';
                    ctx.strokeRect(col.x, col.y, col.width, col.height);
                }
            }
        }

        // 2. Player AABB Hitbox
        const p = this.player;
        if (p) {
            const b = p.getBounds();
            let boxColor = '#00e676'; // Grounded green
            if (p.shockInvulnTimer > 0) {
                boxColor = '#ff4081'; // Shock magenta
            } else if (p.isWallSliding) {
                boxColor = '#00e5ff'; // Wall sliding cyan
            } else if (p.isTethered) {
                boxColor = '#ffaa00'; // Tether amber
            } else if (!p.isGrounded) {
                boxColor = '#ffff00'; // Airborne yellow
            }

            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(b.x, b.y, b.width, b.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(b.x, b.y, b.width, b.height);

            // Center anchor dot
            ctx.fillStyle = boxColor;
            ctx.beginPath();
            ctx.arc(p.x + p.width / 2, p.y + p.height / 2, 3, 0, Math.PI * 2);
            ctx.fill();

            // Head socket point
            const head = p.getHeadSocket();
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(head.x, head.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    _renderSocketGizmos(ctx) {
        if (!this.level) return;
        ctx.save();

        const sockets = this.level.getSockets();
        for (const sock of sockets) {
            // Magnetic capture snap radius (30px)
            ctx.strokeStyle = 'rgba(0, 230, 118, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(sock.x, sock.y, 30, 0, Math.PI * 2);
            ctx.stroke();

            // Wire proximity highlight boundary (280px)
            ctx.strokeStyle = 'rgba(77, 166, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(sock.x, sock.y, 280, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    _renderPendulumConstraint(ctx) {
        const p = this.player;
        if (!p || !p.isTethered || !p.tetherSocket) return;

        ctx.save();
        const sock = p.tetherSocket;
        const radius = p.tetherLength;

        // Radial constraint perimeter ring
        ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(sock.x, sock.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Radial vector from anchor to player head
        const head = p.getHeadSocket();
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sock.x, sock.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();

        ctx.restore();
    }

    _renderRuler(ctx) {
        ctx.save();
        const s = this.rulerStart;
        const e = this.rulerEnd;

        const dx = Math.round(e.x - s.x);
        const dy = Math.round(e.y - s.y);
        const dist = Math.round(Math.hypot(dx, dy));

        // Right triangle guide lines
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Main hypotenuse measurement line
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();

        // End points
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Measurement badge
        const midX = (s.x + e.x) / 2;
        const midY = (s.y + e.y) / 2;
        const label = `DX: ${dx}px | DY: ${dy}px | DIST: ${dist}px`;

        ctx.font = 'bold 11px monospace';
        const tw = ctx.measureText(label).width;

        ctx.fillStyle = 'rgba(15, 20, 26, 0.9)';
        ctx.fillRect(midX - tw / 2 - 8, midY - 20, tw + 16, 22);
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 1;
        ctx.strokeRect(midX - tw / 2 - 8, midY - 20, tw + 16, 22);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, midX - tw / 2, midY - 5);

        ctx.restore();
    }

    _renderTelemetryHUD(ctx) {
        const p = this.player;
        if (!p) return;

        ctx.save();
        const boxX = 14;
        const boxY = 14;
        const boxW = 270;
        const boxH = 210;

        // Background card
        ctx.fillStyle = 'rgba(14, 18, 24, 0.92)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Header
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('DEVTOOLS TELEMETRY [~] TOGGLE', boxX + 10, boxY + 18);

        ctx.font = '10px monospace';
        let lineY = boxY + 36;
        const step = 15;

        // State string
        let stateStr = 'AIRBORNE';
        if (p.isGrounded) stateStr = p.isResting ? 'RESTING / DOCKED' : 'GROUNDED';
        else if (p.isWallSliding) stateStr = `WALL SLIDING [${p.wallSlideDirection === -1 ? 'LEFT' : 'RIGHT'}]`;
        else if (p.isTethered) stateStr = 'TETHERED / SWINGING';

        ctx.fillStyle = '#b0bec5';
        ctx.fillText('STATE:', boxX + 10, lineY);
        ctx.fillStyle = '#00ffcc';
        ctx.fillText(stateStr, boxX + 75, lineY);
        lineY += step;

        // Velocities
        ctx.fillStyle = '#b0bec5';
        ctx.fillText('VELOCITY:', boxX + 10, lineY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`vx: ${p.vx.toFixed(1)}  vy: ${p.vy.toFixed(1)}`, boxX + 75, lineY);
        lineY += step;

        // Position
        ctx.fillStyle = '#b0bec5';
        ctx.fillText('POS (X,Y):', boxX + 10, lineY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`x: ${Math.round(p.x)}  y: ${Math.round(p.y)}`, boxX + 75, lineY);
        lineY += step;

        // Timers
        ctx.fillStyle = '#b0bec5';
        ctx.fillText('TIMERS:', boxX + 10, lineY);
        const coyoteMs = Math.round(p.coyoteTimer * 1000);
        const wallCoyoteMs = Math.round(p.wallCoyoteTimer * 1000);
        const lockMs = Math.round(p.wallJumpLockTimer * 1000);
        ctx.fillStyle = coyoteMs > 0 ? '#00e676' : '#78909c';
        ctx.fillText(`coy:${coyoteMs}ms`, boxX + 75, lineY);
        ctx.fillStyle = wallCoyoteMs > 0 ? '#00e5ff' : '#78909c';
        ctx.fillText(`wcoy:${wallCoyoteMs}ms`, boxX + 140, lineY);
        ctx.fillStyle = lockMs > 0 ? '#ffaa00' : '#78909c';
        ctx.fillText(`lock:${lockMs}ms`, boxX + 215, lineY);
        lineY += step;

        // Wire status
        ctx.fillStyle = '#b0bec5';
        ctx.fillText('WIRE:', boxX + 10, lineY);
        if (p.isTethered && p.tetherSocket) {
            ctx.fillStyle = '#ffaa00';
            ctx.fillText(`L:${Math.round(p.tetherLength)}px (${p.tetherSocket.id})`, boxX + 75, lineY);
        } else {
            ctx.fillStyle = '#78909c';
            ctx.fillText('DISCONNECTED', boxX + 75, lineY);
        }
        lineY += step;

        // Battery
        ctx.fillStyle = '#b0bec5';
        ctx.fillText('BATTERY:', boxX + 10, lineY);
        ctx.fillStyle = p.battery > 50 ? '#00e676' : p.battery > 25 ? '#ffaa00' : '#ff1744';
        ctx.fillText(`${p.battery.toFixed(1)}%`, boxX + 75, lineY);
        lineY += step;

        // Cursor world coordinates
        ctx.fillStyle = '#b0bec5';
        ctx.fillText('MOUSE (W):', boxX + 10, lineY);
        ctx.fillStyle = '#ffff00';
        ctx.fillText(`x: ${Math.round(this.mouseWorldX)}  y: ${Math.round(this.mouseWorldY)}`, boxX + 75, lineY);
        lineY += step;

        // Quick tip
        ctx.fillStyle = '#78909c';
        ctx.font = '9px monospace';
        ctx.fillText('Shift+RMB Drag: Measure distance', boxX + 10, lineY + 6);
        ctx.fillText('F1 / ~: Toggle | Sliders on left', boxX + 10, lineY + 18);

        ctx.restore();
    }

    _updateDOMTelemetry() {
        // Keeps real-time numeric badges in sync on the tuning sliders panel
    }

    _injectStyles() {
        if (document.getElementById('devtools-style')) return;

        this.styleEl = document.createElement('style');
        this.styleEl.id = 'devtools-style';
        this.styleEl.textContent = `
            #devToolsSidebar {
                position: fixed;
                top: 12px;
                left: 12px;
                width: 320px;
                max-height: calc(100vh - 24px);
                background: rgba(14, 18, 24, 0.95);
                border: 1px solid #2a3442;
                border-radius: 6px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.85);
                color: #d8e2ec;
                font-family: monospace;
                font-size: 11px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .dt-header {
                padding: 10px 14px;
                background: #18202c;
                border-bottom: 1px solid #2a3442;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
            }
            .dt-title {
                font-weight: bold;
                color: #00bcd4;
                letter-spacing: 1px;
            }
            .dt-close {
                background: transparent;
                border: none;
                color: #8c9ba5;
                font-size: 13px;
                cursor: pointer;
                font-family: monospace;
                font-weight: bold;
            }
            .dt-close:hover { color: #ff5252; }
            .dt-body {
                padding: 12px 14px;
                overflow-y: auto;
                flex: 1;
            }
            .dt-section {
                margin-bottom: 14px;
                border-bottom: 1px solid #202834;
                padding-bottom: 10px;
            }
            .dt-section-title {
                font-weight: bold;
                color: #ffaa00;
                margin-bottom: 8px;
                text-transform: uppercase;
                font-size: 10px;
                letter-spacing: 0.8px;
            }
            .dt-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }
            .dt-label {
                color: #a0aec0;
                width: 140px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .dt-val {
                width: 45px;
                text-align: right;
                color: #00e5ff;
                font-weight: bold;
            }
            .dt-slider {
                flex: 1;
                margin: 0 8px;
                accent-color: #00bcd4;
                cursor: pointer;
            }
            .dt-btn-group {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }
            .dt-btn {
                flex: 1;
                padding: 6px 10px;
                background: #242e3d;
                border: 1px solid #364459;
                color: #ffffff;
                font-family: monospace;
                font-size: 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.15s;
            }
            .dt-btn:hover { background: #2f3c4e; border-color: #00bcd4; }
            .dt-btn.primary { background: #00838f; border-color: #00acc1; }
            .dt-btn.primary:hover { background: #0097a7; }
            .dt-checkbox-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
                cursor: pointer;
            }
            .dt-checkbox-row input { cursor: pointer; accent-color: #00bcd4; }
            .dt-copy-toast {
                color: #00e676;
                text-align: center;
                margin-top: 6px;
                font-size: 10px;
                display: none;
            }
        `;
        document.head.appendChild(this.styleEl);
    }

    _buildDOMPanel() {
        if (document.getElementById('devToolsSidebar')) return;

        this.panelEl = document.createElement('div');
        this.panelEl.id = 'devToolsSidebar';

        this.panelEl.innerHTML = `
            <div class="dt-header">
                <span class="dt-title">DEVTOOLS PHYSICS CALIBRATOR</span>
                <button class="dt-close" id="dtCloseBtn">[X]</button>
            </div>
            <div class="dt-body">
                <div class="dt-section">
                    <div class="dt-section-title">Visual Overlays</div>
                    <label class="dt-checkbox-row">
                        <input type="checkbox" id="dtToggleHitboxes" checked />
                        <span>Hitboxes & Sockets</span>
                    </label>
                    <label class="dt-checkbox-row">
                        <input type="checkbox" id="dtToggleTrajectory" checked />
                        <span>Trajectory Arc & Apex</span>
                    </label>
                    <label class="dt-checkbox-row">
                        <input type="checkbox" id="dtToggleTelemetry" checked />
                        <span>Telemetry HUD Box</span>
                    </label>
                    <label class="dt-checkbox-row">
                        <input type="checkbox" id="dtToggleRuler" checked />
                        <span>Shift+RMB Measuring Ruler</span>
                    </label>
                </div>

                <div class="dt-section">
                    <div class="dt-section-title">Horizontal Locomotion</div>
                    <div class="dt-row">
                        <span class="dt-label">Walk Speed</span>
                        <input type="range" class="dt-slider" id="dt_WALK_SPEED" min="60" max="400" step="10" />
                        <span class="dt-val" id="val_WALK_SPEED"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Run Speed</span>
                        <input type="range" class="dt-slider" id="dt_RUN_SPEED" min="150" max="600" step="10" />
                        <span class="dt-val" id="val_RUN_SPEED"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Ground Accel</span>
                        <input type="range" class="dt-slider" id="dt_GROUND_ACCEL" min="400" max="4000" step="100" />
                        <span class="dt-val" id="val_GROUND_ACCEL"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Ground Friction</span>
                        <input type="range" class="dt-slider" id="dt_GROUND_FRICTION" min="0.5" max="0.98" step="0.02" />
                        <span class="dt-val" id="val_GROUND_FRICTION"></span>
                    </div>
                </div>

                <div class="dt-section">
                    <div class="dt-section-title">Jump & Wall Jump Kinematics</div>
                    <div class="dt-row">
                        <span class="dt-label">Jump Force</span>
                        <input type="range" class="dt-slider" id="dt_JUMP_SPEED" min="200" max="800" step="10" />
                        <span class="dt-val" id="val_JUMP_SPEED"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Wall Jump Up</span>
                        <input type="range" class="dt-slider" id="dt_WALL_JUMP_UP" min="200" max="800" step="10" />
                        <span class="dt-val" id="val_WALL_JUMP_UP"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Wall Jump Out</span>
                        <input type="range" class="dt-slider" id="dt_WALL_JUMP_OUTWARD" min="150" max="600" step="10" />
                        <span class="dt-val" id="val_WALL_JUMP_OUTWARD"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Slide Speed</span>
                        <input type="range" class="dt-slider" id="dt_MAX_WALL_SLIDE_SPEED" min="40" max="300" step="10" />
                        <span class="dt-val" id="val_MAX_WALL_SLIDE_SPEED"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Fast Slide (S)</span>
                        <input type="range" class="dt-slider" id="dt_FAST_WALL_SLIDE_SPEED" min="150" max="600" step="10" />
                        <span class="dt-val" id="val_FAST_WALL_SLIDE_SPEED"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Gravity</span>
                        <input type="range" class="dt-slider" id="dt_GRAVITY" min="600" max="3000" step="50" />
                        <span class="dt-val" id="val_GRAVITY"></span>
                    </div>
                </div>

                <div class="dt-section">
                    <div class="dt-section-title">Wire & Swing Physics</div>
                    <div class="dt-row">
                        <span class="dt-label">Min Throw Speed</span>
                        <input type="range" class="dt-slider" id="dt_MIN_THROW_SPEED" min="300" max="1500" step="50" />
                        <span class="dt-val" id="val_MIN_THROW_SPEED"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Max Throw Speed</span>
                        <input type="range" class="dt-slider" id="dt_MAX_THROW_SPEED" min="600" max="2200" step="50" />
                        <span class="dt-val" id="val_MAX_THROW_SPEED"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Max Wire Length</span>
                        <input type="range" class="dt-slider" id="dt_MAX_WIRE_LENGTH" min="200" max="800" step="20" />
                        <span class="dt-val" id="val_MAX_WIRE_LENGTH"></span>
                    </div>
                    <div class="dt-row">
                        <span class="dt-label">Reel Speed</span>
                        <input type="range" class="dt-slider" id="dt_REEL_SPEED" min="60" max="500" step="20" />
                        <span class="dt-val" id="val_REEL_SPEED"></span>
                    </div>
                </div>

                <div class="dt-btn-group">
                    <button class="dt-btn primary" id="dtCopyBtn">Copy Config</button>
                    <button class="dt-btn" id="dtResetBtn">Reset Defaults</button>
                </div>
                <div class="dt-copy-toast" id="dtCopyToast">Config copied to clipboard!</div>
            </div>
        `;

        document.body.appendChild(this.panelEl);

        // Bind DOM interactions
        document.getElementById('dtCloseBtn').addEventListener('click', () => {
            this.toggle();
        });

        // Overlay checkboxes
        document.getElementById('dtToggleHitboxes').addEventListener('change', (e) => {
            this.showHitboxes = e.target.checked;
        });
        document.getElementById('dtToggleTrajectory').addEventListener('change', (e) => {
            this.showTrajectory = e.target.checked;
        });
        document.getElementById('dtToggleTelemetry').addEventListener('change', (e) => {
            this.showTelemetry = e.target.checked;
        });
        document.getElementById('dtToggleRuler').addEventListener('change', (e) => {
            this.showRuler = e.target.checked;
        });

        // Sliders binding
        this._bindSlider('WALK_SPEED', this.movement);
        this._bindSlider('RUN_SPEED', this.movement);
        this._bindSlider('GROUND_ACCEL', this.movement);
        this._bindSlider('GROUND_FRICTION', this.movement);

        this._bindSlider('JUMP_SPEED', this.movement, true); // negative magnitude
        this._bindSlider('WALL_JUMP_UP', this.movement, true);
        this._bindSlider('WALL_JUMP_OUTWARD', this.movement);
        this._bindSlider('MAX_WALL_SLIDE_SPEED', this.movement);
        this._bindSlider('FAST_WALL_SLIDE_SPEED', this.movement);
        this._bindSlider('GRAVITY', this.movement);

        this._bindSlider('MIN_THROW_SPEED', this.wireSystem);
        this._bindSlider('MAX_THROW_SPEED', this.wireSystem);
        this._bindSlider('MAX_WIRE_LENGTH', this.wireSystem);
        this._bindSlider('REEL_SPEED', this.wireSystem);

        // Copy button
        document.getElementById('dtCopyBtn').addEventListener('click', () => {
            this._exportConfigToClipboard();
        });

        // Reset button
        document.getElementById('dtResetBtn').addEventListener('click', () => {
            this._resetToDefaults();
        });
    }

    _bindSlider(propName, targetObj, isNegative = false) {
        const slider = document.getElementById(`dt_${propName}`);
        const valSpan = document.getElementById(`val_${propName}`);
        if (!slider || !valSpan || !targetObj) return;

        const currentVal = targetObj[propName];
        slider.value = isNegative ? Math.abs(currentVal) : currentVal;
        valSpan.textContent = isNegative ? -slider.value : slider.value;

        slider.addEventListener('input', (e) => {
            const rawVal = parseFloat(e.target.value);
            const appliedVal = isNegative ? -rawVal : rawVal;
            targetObj[propName] = appliedVal;
            valSpan.textContent = appliedVal;
        });
    }

    _exportConfigToClipboard() {
        const m = this.movement;
        const w = this.wireSystem;
        const config = {
            WALK_SPEED: m.WALK_SPEED,
            RUN_SPEED: m.RUN_SPEED,
            GROUND_ACCEL: m.GROUND_ACCEL,
            GROUND_FRICTION: m.GROUND_FRICTION,
            JUMP_SPEED: m.JUMP_SPEED,
            WALL_JUMP_UP: m.WALL_JUMP_UP,
            WALL_JUMP_OUTWARD: m.WALL_JUMP_OUTWARD,
            MAX_WALL_SLIDE_SPEED: m.MAX_WALL_SLIDE_SPEED,
            FAST_WALL_SLIDE_SPEED: m.FAST_WALL_SLIDE_SPEED,
            GRAVITY: m.GRAVITY,
            MIN_THROW_SPEED: w.MIN_THROW_SPEED,
            MAX_THROW_SPEED: w.MAX_THROW_SPEED,
            MAX_WIRE_LENGTH: w.MAX_WIRE_LENGTH,
            REEL_SPEED: w.REEL_SPEED
        };

        const str = `// Calibrated Physics Preset\nconst TUNED_PHYSICS = ${JSON.stringify(config, null, 4)};`;
        navigator.clipboard.writeText(str).then(() => {
            const toast = document.getElementById('dtCopyToast');
            if (toast) {
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 2500);
            }
        }).catch(() => {
            console.log(str);
            alert('Config printed to browser developer console!');
        });
    }

    _resetToDefaults() {
        const def = this.defaults;
        for (const [key, val] of Object.entries(def)) {
            if (this.movement && this.movement[key] !== undefined) {
                this.movement[key] = val;
            }
            if (this.wireSystem && this.wireSystem[key] !== undefined) {
                this.wireSystem[key] = val;
            }
            if (typeof document !== 'undefined') {
                const slider = document.getElementById(`dt_${key}`);
                const valSpan = document.getElementById(`val_${key}`);
                if (slider && valSpan) {
                    const isNeg = val < 0;
                    slider.value = isNeg ? Math.abs(val) : val;
                    valSpan.textContent = val;
                }
            }
        }
    }
}
