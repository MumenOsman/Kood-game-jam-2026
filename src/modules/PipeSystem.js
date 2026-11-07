/**
 * PipeSystem.js
 * Core industrial energy flow and pipe conduit propagation engine.
 * 
 * Strict Architecture:
 * - Locked strictly to 32px tile grid.
 * - Parses and renders the authentic metallic pipes layer from map.ldtk (circuits_sheet).
 * - Multi-layer visual pipeline:
 *   1. Crisp pixel-art casing from Circuits(4).png.
 *   2. Illuminated energized lumen channel (molten golden core + white-hot filament).
 *   3. Continuous traveling electrical light pulses streaming in the flow direction.
 *   4. Seamless 90-degree corner light bending.
 *   5. Tactile micro-sparks and junction status LED rivets.
 *   6. Dynamic power propagation connecting ceiling feed -> dials -> logic gates -> door & status light box.
 */

const PORT = {
    TOP: 0,
    RIGHT: 1,
    BOTTOM: 2,
    LEFT: 3
};

export class PipeSystem {
    constructor(eventBus, assetLoader = null, circuitSystem = null, level = null) {
        this.eventBus = eventBus;
        this.assetLoader = assetLoader;
        this.circuitSystem = circuitSystem;
        this.level = level;

        this.pipes = [];
        this.pulseTimer = 0;
        this.sparks = [];

        // Wall conduit bridge between Room 2 Chamber 1 and Chamber 2
        this.wallConduit = {
            x1: 1536,
            y: 144,
            x2: 1760,
            isPowered: false
        };

        this._bindEvents();
    }

    _bindEvents() {
        if (this.eventBus) {
            this.eventBus.on('CIRCUIT_UPDATED', () => {
                this.recalculatePower();
            });
            this.eventBus.on('ROOM_CHANGED', () => {
                this.recalculatePower();
            });
        }
    }

    init(assetLoader, level, circuitSystem) {
        if (assetLoader) this.assetLoader = assetLoader;
        if (level) this.level = level;
        if (circuitSystem) this.circuitSystem = circuitSystem;

        if (this.level && this.level.pipes && this.level.pipes.length > 0) {
            this.loadPipes(this.level.pipes);
        }
        this.recalculatePower();
    }

    loadPipes(rawPipes) {
        this.pipes = [];
        for (const p of rawPipes) {
            const type = this._classifyPipeType(p.srcX, p.srcY);
            this.pipes.push({
                id: `pipe_${p.x}_${p.y}`,
                x: p.x,
                y: p.y,
                gridX: Math.round(p.x / 32),
                gridY: Math.round(p.y / 32),
                srcX: p.srcX,
                srcY: p.srcY,
                tileId: p.tileId,
                type: type,
                isPowered: false,
                flowDir: { dx: 0, dy: 1 }
            });
        }
        this.recalculatePower();
    }

    _classifyPipeType(srcX, srcY) {
        if (srcX === 96 && srcY === 64) return 'VERT';
        if ((srcX === 0 && srcY === 64) || (srcX === 32 && srcY === 96)) return 'HORZ';
        if (srcX === 64 && srcY === 128) return 'CR_R'; // Right & Bottom
        if (srcX === 0 && srcY === 128) return 'CR_L';  // Left & Bottom
        return 'VERT';
    }

    /**
     * Complete physical and logical power evaluation across the entire facility network.
     */
    recalculatePower() {
        if (!this.circuitSystem) return;

        const nodes = this.circuitSystem.nodes;
        const node0 = nodes.get('dial_node_1488_144');
        const node1 = nodes.get('dial_node_1776_144');
        const node2 = nodes.get('dial_node_1808_144');
        const node3 = nodes.get('dial_node_1840_144');
        const node4 = nodes.get('dial_node_1872_144');

        // 1. Ceiling Power Feed: (1472, 0..96) is ALWAYS energized from the facility generator
        for (const p of this.pipes) {
            if (p.x === 1472 && p.y <= 96) {
                p.isPowered = true;
                p.flowDir = { dx: 0, dy: 1 };
            }
        }

        // 2. Dial 0 (CORNER at 1488, 144)
        let dial0Powered = false;
        let dial0OutputsRight = false;
        if (node0) {
            // Power enters from TOP port (touching pipe at 1472, 96)
            if (node0.ports[PORT.TOP]) {
                dial0Powered = true;
                if (node0.ports[PORT.RIGHT]) {
                    dial0OutputsRight = true;
                }
            }
            node0.isPowered = dial0Powered;
        }

        // 3. Horizontal Exit Pipe (1504, 128) & Wall Conduit Bridge
        const p1504 = this.pipes.find(p => p.x === 1504 && p.y === 128);
        if (p1504) {
            p1504.isPowered = dial0OutputsRight;
            p1504.flowDir = { dx: 1, dy: 0 };
        }
        this.wallConduit.isPowered = dial0OutputsRight;

        // 4. Dial 1 (T_SHAPE at 1776, 144)
        let dial1Powered = false;
        let dial1FeedsRight = false;
        let dial1FeedsTop = false;
        if (node1) {
            if (this.wallConduit.isPowered && node1.ports[PORT.LEFT]) {
                dial1Powered = true;
                if (node1.ports[PORT.RIGHT]) dial1FeedsRight = true;
                if (node1.ports[PORT.TOP]) dial1FeedsTop = true;
            }
            node1.isPowered = dial1Powered;
        }

        // 5. Dial 2 (T_SHAPE at 1808, 144)
        let dial2Powered = false;
        let dial2FeedsRight = false;
        let dial2FeedsTop = false;
        if (node2) {
            if (dial1FeedsRight && node2.ports[PORT.LEFT]) {
                dial2Powered = true;
                if (node2.ports[PORT.RIGHT]) dial2FeedsRight = true;
                if (node2.ports[PORT.TOP]) dial2FeedsTop = true;
            }
            node2.isPowered = dial2Powered;
        }

        // 6. Dial 3 (T_SHAPE at 1840, 144)
        let dial3Powered = false;
        let dial3FeedsRight = false;
        let dial3FeedsTop = false;
        if (node3) {
            if (dial2FeedsRight && node3.ports[PORT.LEFT]) {
                dial3Powered = true;
                if (node3.ports[PORT.RIGHT]) dial3FeedsRight = true;
                if (node3.ports[PORT.TOP]) dial3FeedsTop = true;
            }
            node3.isPowered = dial3Powered;
        }

        // 7. Dial 4 (CORNER at 1872, 144)
        let dial4Powered = false;
        let dial4FeedsTop = false;
        if (node4) {
            if (dial3FeedsRight && node4.ports[PORT.LEFT]) {
                dial4Powered = true;
                if (node4.ports[PORT.TOP]) dial4FeedsTop = true;
            }
            node4.isPowered = dial4Powered;
        }

        // 8. Gate Input Pipes & Logic Gates
        // Dial 1 feed into OR Gate 1 left: pipe (1760, 96) and corner (1760, 64)
        const p1760_96 = this.pipes.find(p => p.x === 1760 && p.y === 96);
        const p1760_64 = this.pipes.find(p => p.x === 1760 && p.y === 64);
        if (p1760_96) {
            p1760_96.isPowered = dial1FeedsTop;
            p1760_96.flowDir = { dx: 0, dy: -1 };
        }
        if (p1760_64) {
            p1760_64.isPowered = dial1FeedsTop;
            p1760_64.flowDir = { dx: 1, dy: 0 };
        }

        // Dial 2 feed into OR Gate 1 bottom: pipe (1792, 96)
        const p1792_96 = this.pipes.find(p => p.x === 1792 && p.y === 96);
        if (p1792_96) {
            p1792_96.isPowered = dial2FeedsTop;
            p1792_96.flowDir = { dx: 0, dy: -1 };
        }

        // OR Gate 1 at (1792, 64)
        const orGate1Active = dial1FeedsTop || dial2FeedsTop;
        if (this.level && this.level.logicGates) {
            const g1 = this.level.logicGates.find(g => g.x === 1792 && g.y === 64);
            if (g1) g1.isPowered = orGate1Active;
        }

        // OR Gate 1 output pipe: corner (1792, 32)
        const p1792_32 = this.pipes.find(p => p.x === 1792 && p.y === 32);
        if (p1792_32) {
            p1792_32.isPowered = orGate1Active;
            p1792_32.flowDir = { dx: 1, dy: 0 };
        }

        // Dial 3 feed into OR Gate 2 left: pipe (1824, 96) and corner (1824, 64)
        const p1824_96 = this.pipes.find(p => p.x === 1824 && p.y === 96);
        const p1824_64 = this.pipes.find(p => p.x === 1824 && p.y === 64);
        if (p1824_96) {
            p1824_96.isPowered = dial3FeedsTop;
            p1824_96.flowDir = { dx: 0, dy: -1 };
        }
        if (p1824_64) {
            p1824_64.isPowered = dial3FeedsTop;
            p1824_64.flowDir = { dx: 1, dy: 0 };
        }

        // Dial 4 feed into OR Gate 2 bottom: pipe (1856, 96)
        const p1856_96 = this.pipes.find(p => p.x === 1856 && p.y === 96);
        if (p1856_96) {
            p1856_96.isPowered = dial4FeedsTop;
            p1856_96.flowDir = { dx: 0, dy: -1 };
        }

        // OR Gate 2 at (1856, 64)
        const orGate2Active = dial3FeedsTop || dial4FeedsTop;
        if (this.level && this.level.logicGates) {
            const g2 = this.level.logicGates.find(g => g.x === 1856 && g.y === 64);
            if (g2) g2.isPowered = orGate2Active;
        }

        // OR Gate 2 output pipe: corner (1856, 32)
        const p1856_32 = this.pipes.find(p => p.x === 1856 && p.y === 32);
        if (p1856_32) {
            p1856_32.isPowered = orGate2Active;
            p1856_32.flowDir = { dx: -1, dy: 0 };
        }

        // AND Gate at (1824, 32)
        const andGateActive = orGate1Active && orGate2Active;
        if (this.level && this.level.logicGates) {
            const gAnd = this.level.logicGates.find(g => g.x === 1824 && g.y === 32);
            if (gAnd) gAnd.isPowered = andGateActive;
        }

        // 9. Output Trunk Pipes to Blast Door
        // Corner (1824, 0)
        const p1824_0 = this.pipes.find(p => p.x === 1824 && p.y === 0);
        if (p1824_0) {
            p1824_0.isPowered = andGateActive;
            p1824_0.flowDir = { dx: 1, dy: 0 };
        }

        // Horizontal crossbar (1856, 0)
        const p1856_0 = this.pipes.find(p => p.x === 1856 && p.y === 0);
        if (p1856_0) {
            p1856_0.isPowered = andGateActive;
            p1856_0.flowDir = { dx: 1, dy: 0 };
        }

        // Corner (1888, 0)
        const p1888_0 = this.pipes.find(p => p.x === 1888 && p.y === 0);
        if (p1888_0) {
            p1888_0.isPowered = andGateActive;
            p1888_0.flowDir = { dx: 0, dy: 1 };
        }

        // Vertical trunk line: (1888, 32), (1888, 64), (1888, 96)
        for (const y of [32, 64, 96]) {
            const p = this.pipes.find(pipe => pipe.x === 1888 && pipe.y === y);
            if (p) {
                p.isPowered = andGateActive;
                p.flowDir = { dx: 0, dy: 1 };
            }
        }

        // 10. Status Light Box at (1888, 128)
        if (this.level && this.level.lightBoxes) {
            for (const box of this.level.lightBoxes) {
                box.isPowered = andGateActive;
            }
        }

        // 11. Facility Blast Door at (1888, 160)
        if (this.level && this.level.door) {
            if (andGateActive) {
                if (!this.level.door.isOpen) {
                    this.level.door.isOpen = true;
                    if (this.eventBus) this.eventBus.emit('ACTIVATE_DEVICE', 'exit_door');
                }
            } else {
                if (this.level.door.isOpen) {
                    this.level.door.isOpen = false;
                    if (this.eventBus) this.eventBus.emit('DEACTIVATE_DEVICE', 'exit_door');
                }
            }
        }
    }

    update(dt) {
        this.pulseTimer += dt * 3.6;

        // Update micro-sparks along active conduits
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const sp = this.sparks[i];
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.life -= dt;
            if (sp.life <= 0) {
                this.sparks.splice(i, 1);
            }
        }

        // Occasionally spawn subtle tactile micro-sparks on powered pipes
        if (Math.random() < dt * 6) {
            const powered = this.pipes.filter(p => p.isPowered);
            if (powered.length > 0) {
                const target = powered[Math.floor(Math.random() * powered.length)];
                this._spawnSpark(target.x + 16, target.y + 16);
            }
        }
    }

    _spawnSpark(x, y) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 15 + Math.random() * 35;
        this.sparks.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: Math.random() > 0.3 ? '#ffe066' : '#ffffff',
            life: 0.15 + Math.random() * 0.15
        });
    }

    render(ctx) {
        ctx.save();

        const sheet = this.assetLoader ? this.assetLoader.getImage('circuits_sheet') : null;

        // 1. Render recessed wall conduit bridge across Chamber 1 and 2
        this._renderWallConduit(ctx);

        // 2. Render base metallic pipe tiles
        if (sheet) {
            ctx.imageSmoothingEnabled = false;
            for (const p of this.pipes) {
                ctx.drawImage(sheet, p.srcX, p.srcY, 32, 32, Math.round(p.x), Math.round(p.y), 32, 32);
            }
        }

        // 3. Render powered internal conduit lumens & traveling light pulses
        for (const p of this.pipes) {
            if (p.isPowered) {
                this._renderPoweredPipe(ctx, p);
            }
        }

        // 4. Render micro-sparks
        for (const sp of this.sparks) {
            ctx.fillStyle = sp.color;
            ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 2, 2);
        }

        ctx.restore();
    }

    _renderWallConduit(ctx) {
        const c = this.wallConduit;
        const y = c.y;

        ctx.save();
        // Recessed armored conduit casing behind platforms
        ctx.fillStyle = '#121720';
        ctx.fillRect(c.x1, y - 2, c.x2 - c.x1, 4);
        ctx.strokeStyle = '#222d3d';
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x1, y - 2, c.x2 - c.x1, 4);

        // Mounting clamps every 32px
        ctx.fillStyle = '#313d52';
        for (let cx = c.x1 + 16; cx < c.x2; cx += 32) {
            ctx.fillRect(cx - 2, y - 4, 4, 8);
        }

        if (c.isPowered) {
            // Molten golden conduit core
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 6;
            ctx.strokeStyle = '#ffbb00';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(c.x1, y);
            ctx.lineTo(c.x2, y);
            ctx.stroke();

            // High-voltage traveling pulse packets
            ctx.shadowBlur = 0;
            ctx.setLineDash([8, 16]);
            ctx.lineDashOffset = -this.pulseTimer * 38;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(c.x1, y);
            ctx.lineTo(c.x2, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    _renderPoweredPipe(ctx, pipe) {
        const x = Math.round(pipe.x);
        const y = Math.round(pipe.y);
        const dir = pipe.flowDir;

        ctx.save();

        // 1. Build geometry path according to pipe type
        ctx.beginPath();
        if (pipe.type === 'VERT') {
            ctx.moveTo(x + 16, y);
            ctx.lineTo(x + 16, y + 32);
        } else if (pipe.type === 'HORZ') {
            ctx.moveTo(x, y + 16);
            ctx.lineTo(x + 32, y + 16);
        } else if (pipe.type === 'CR_R') {
            // Right to bottom corner (turns from bottom to right or right to bottom)
            ctx.moveTo(x + 16, y + 32);
            ctx.lineTo(x + 16, y + 16);
            ctx.lineTo(x + 32, y + 16);
        } else if (pipe.type === 'CR_L') {
            // Left to bottom corner (turns from left to bottom or bottom to left)
            ctx.moveTo(x, y + 16);
            ctx.lineTo(x + 16, y + 16);
            ctx.lineTo(x + 16, y + 32);
        } else {
            ctx.moveTo(x + 16, y);
            ctx.lineTo(x + 16, y + 32);
        }

        // 2. Molten Amber / Gold Lumen Channel
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#ffba00';
        ctx.lineWidth = 3.6;
        ctx.stroke();

        // 3. Radiant White Filament Core
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff8cc';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // 4. Continuous Traveling Light Energy Pulses in Flow Direction
        const isForward = (dir.dx > 0 || dir.dy > 0);
        ctx.setLineDash([7, 13]);
        ctx.lineDashOffset = isForward ? -this.pulseTimer * 38 : this.pulseTimer * 38;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = '#ffe066';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.setLineDash([]);

        // 5. Status Coupling Indicator LEDs
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00ffaa';
        if (pipe.type === 'VERT') {
            ctx.fillRect(x + 15, y + 2, 2, 2);
            ctx.fillRect(x + 15, y + 28, 2, 2);
        } else if (pipe.type === 'HORZ') {
            ctx.fillRect(x + 2, y + 15, 2, 2);
            ctx.fillRect(x + 28, y + 15, 2, 2);
        } else {
            ctx.fillRect(x + 15, y + 15, 2, 2);
        }

        ctx.restore();
    }
}

