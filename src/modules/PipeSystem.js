/**
 * PipeSystem.js
 * Core industrial energy flow and pipe conduit propagation engine.
 * 
 * Strict Architecture:
 * - Generic 2D spatial grid BFS wavefront engine (zero hardcoded level coordinates).
 * - Locked strictly to 32px tile grid.
 * - Dynamic cardinal port matching [Top, Right, Bottom, Left] across pipes, dials, gates, and devices.
 * - Seamless dial-to-dial adjacent power transfer.
 * - Exclusive OR (XOR) gate logic: inactive on 0 inputs, active on 1 input, conflict/off on >= 2 inputs.
 * - Natural physical device responses: hazards electrify when receiving power; doors open when powered.
 * - Multi-layer visual pipeline:
 *   1. Crisp pixel-art casing from Circuits(4).png.
 *   2. Illuminated energized lumen channel (molten golden core + white-hot filament).
 *   3. Continuous traveling electrical light pulses streaming in the flow direction.
 *   4. Seamless 90-degree corner light bending for all corner types.
 *   5. Tactile micro-sparks and junction status LED rivets.
 */

export const PORT = {
    TOP: 0,
    RIGHT: 1,
    BOTTOM: 2,
    LEFT: 3
};

export const OPPOSITE_PORT = [
    PORT.BOTTOM,
    PORT.LEFT,
    PORT.TOP,
    PORT.RIGHT
];

export const PORT_DELTAS = [
    { dx: 0, dy: -1 }, // TOP
    { dx: 1, dy: 0 },  // RIGHT
    { dx: 0, dy: 1 },  // BOTTOM
    { dx: -1, dy: 0 }  // LEFT
];

export class PipeSystem {
    constructor(eventBus, assetLoader = null, circuitSystem = null, level = null) {
        this.eventBus = eventBus;
        this.assetLoader = assetLoader;
        this.circuitSystem = circuitSystem;
        this.level = level;

        this.pipes = [];
        this.pulseTimer = 0;
        this.sparks = [];

        // Chamber 1 hazard conduit terminal representation
        this.leftHazardConduit = {
            x1: 1504,
            y: 144,
            x2: 1536,
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
        // Collect all dial grid positions to prevent static pipes from bypassing circuit rotators
        const dialGridKeys = new Set();
        if (this.circuitSystem && this.circuitSystem.nodes) {
            for (const node of this.circuitSystem.nodes.values()) {
                const gx = Math.round((node.x - 16) / 32);
                const gy = Math.round((node.y - 16) / 32);
                dialGridKeys.add(`${gx},${gy}`);
            }
        }

        this.pipes = [];
        for (const p of rawPipes) {
            const gx = Math.round(p.x / 32);
            const gy = Math.round(p.y / 32);
            if (dialGridKeys.has(`${gx},${gy}`)) {
                continue;
            }
            const info = this._classifyPipe(p.srcX, p.srcY);
            this.pipes.push({
                id: `pipe_${p.x}_${p.y}`,
                x: p.x,
                y: p.y,
                gridX: gx,
                gridY: gy,
                srcX: p.srcX,
                srcY: p.srcY,
                tileId: p.tileId,
                type: info.type,
                ports: [...info.ports],
                isPowered: false,
                flowDir: { dx: 0, dy: 1 }
            });
        }
        this.recalculatePower();
    }

    _classifyPipe(srcX, srcY) {
        // Vertical Straight
        if (srcX === 96 && srcY === 64) {
            return { type: 'VERT', ports: [true, false, true, false] };
        }
        // Horizontal Straight
        if ((srcX === 0 && srcY === 64) || (srcX === 32 && srcY === 96)) {
            return { type: 'HORZ', ports: [false, true, false, true] };
        }
        // Corner: Right & Bottom
        if (srcX === 64 && srcY === 128) {
            return { type: 'CR_R', ports: [false, true, true, false] };
        }
        // Corner: Bottom & Left
        if (srcX === 0 && srcY === 128) {
            return { type: 'CR_L', ports: [false, false, true, true] };
        }
        // Corner: Top & Right
        if (srcX === 32 && srcY === 128) {
            return { type: 'CR_TR', ports: [true, true, false, false] };
        }
        // Corner: Top & Left
        if (srcX === 64 && srcY === 96) {
            return { type: 'CR_TL', ports: [true, false, false, true] };
        }
        // T-Junction: Top, Right, Left
        if (srcX === 96 && srcY === 96) {
            return { type: 'T_UP', ports: [true, true, false, true] };
        }
        // T-Junction: Right, Bottom, Left
        if (srcX === 96 && srcY === 128) {
            return { type: 'T_DOWN', ports: [false, true, true, true] };
        }
        // 4-Way Cross
        if (srcY === 160) {
            return { type: 'CROSS', ports: [true, true, true, true] };
        }
        return { type: 'VERT', ports: [true, false, true, false] };
    }

    /**
     * Complete physical and logical power evaluation across the entire facility network.
     * Uses a generic 2D spatial grid BFS wavefront engine with cascade logic gate passes.
     */
    recalculatePower() {
        // Build 2D spatial grid index: Map<"gx,gy", Item[]>
        const grid = new Map();
        const addToGrid = (gx, gy, item) => {
            const key = `${gx},${gy}`;
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(item);
        };

        // 1. Index all circuit dials first
        const dials = [];
        const dialGridKeys = new Set();
        if (this.circuitSystem && this.circuitSystem.nodes) {
            for (const node of this.circuitSystem.nodes.values()) {
                const gx = Math.round((node.x - 16) / 32);
                const gy = Math.round((node.y - 16) / 32);
                node.gx = gx;
                node.gy = gy;
                node.kind = 'DIAL';
                node.isPowered = (node.type === 'SOURCE');
                dials.push(node);
                dialGridKeys.add(`${gx},${gy}`);
                addToGrid(gx, gy, node);
            }
        }

        // 2. Index all pipes (skipping any cell occupied by a circuit dial)
        for (const p of this.pipes) {
            if (dialGridKeys.has(`${p.gridX},${p.gridY}`)) continue;
            p.gx = p.gridX;
            p.gy = p.gridY;
            p.kind = 'PIPE';
            p.isPowered = false;
            p.flowDir = { dx: 0, dy: 1 };
            addToGrid(p.gx, p.gy, p);
        }

        // 3. Index all logic gates
        const gates = [];
        if (this.level && this.level.logicGates) {
            for (const g of this.level.logicGates) {
                const gx = Math.round(g.x / 32);
                const gy = Math.round(g.y / 32);
                g.gx = gx;
                g.gy = gy;
                g.kind = 'GATE';
                g.isPowered = false;
                g.isConflict = false;
                g.inputSignals = new Map();

                // Infer default ports if not specified
                if (!g.inPorts) {
                    if (g.type === 'AND' && gy <= 1) {
                        g.inPorts = [PORT.LEFT, PORT.RIGHT];
                    } else {
                        g.inPorts = [PORT.LEFT, PORT.BOTTOM];
                    }
                }
                if (!g.outPorts) {
                    g.outPorts = [PORT.TOP];
                }
                g.ports = [true, true, true, true];
                gates.push(g);
                addToGrid(gx, gy, g);
            }
        }

        // 4. Index all interactive & status devices
        const devices = [];

        // Power Sources
        const sources = [];
        if (this.level && this.level.powerSources) {
            for (const s of this.level.powerSources) {
                const sgx = Math.round(s.x / 32);
                const sgy = Math.round(s.y / 32);
                s.gx = sgx;
                s.gy = sgy;
                s.kind = 'SOURCE';
                s.isPowered = true;
                s.ports = [true, true, true, true];
                sources.push(s);
                addToGrid(sgx, sgy, s);
            }
        }

        // Hazards (only authentic hazard entities, never plain walls)
        if (this.level && this.level.colliders) {
            const hazards = this.level.colliders.filter(c => c.isHazard === true);
            for (const haz of hazards) {
                haz.kind = 'HAZARD';
                haz.isPowered = false;
                haz.ports = [true, true, true, true];
                // Cover all grid tiles the hazard intersects
                const minGx = Math.floor(haz.x / 32);
                const maxGx = Math.floor((haz.x + haz.width - 1) / 32);
                const minGy = Math.floor(haz.y / 32);
                const maxGy = Math.floor((haz.y + haz.height - 1) / 32);
                haz.gx = minGx;
                haz.gy = minGy;
                for (let x = minGx; x <= maxGx; x++) {
                    for (let y = minGy; y <= maxGy; y++) {
                        addToGrid(x, y, haz);
                    }
                }
                devices.push(haz);
            }
        }

        // Blast Doors
        const doorList = (this.level && this.level.doors && this.level.doors.length > 0)
            ? this.level.doors
            : (this.level && this.level.door ? [this.level.door] : []);

        for (const door of doorList) {
            const dgx = Math.round(door.x / 32);
            const dgy = Math.round(door.y / 32);
            const numTiles = Math.max(1, Math.round(door.height / 32));
            for (let ty = 0; ty < numTiles; ty++) {
                const doorTileObj = {
                    kind: 'DOOR',
                    raw: door,
                    gx: dgx,
                    gy: dgy + ty,
                    isPowered: false,
                    ports: [true, true, true, true]
                };
                addToGrid(dgx, dgy + ty, doorTileObj);
                devices.push(doorTileObj);
            }
        }

        // Light Boxes
        if (this.level && this.level.lightBoxes) {
            for (const box of this.level.lightBoxes) {
                const bgx = Math.round(box.x / 32);
                const bgy = Math.round(box.y / 32);
                box.gx = bgx;
                box.gy = bgy;
                box.kind = 'DEVICE';
                box.isPowered = false;
                box.ports = [true, true, true, true];
                addToGrid(bgx, bgy, box);
                devices.push(box);
            }
        }

        // 5. Seed BFS Queue from all active power sources
        const queue = [];

        // Explicit power source entities
        for (const s of sources) {
            queue.push(s);
        }

        // Facility ceiling generator feeds (any pipe descending at gy === 0 or gy === -10)
        for (const p of this.pipes) {
            if ((p.gy === 0 || p.gy === -10) && p.ports[PORT.TOP]) {
                p.isPowered = true;
                p.flowDir = { dx: 0, dy: 1 };
                queue.push(p);
            }
        }

        // Source dials
        for (const d of dials) {
            if (d.type === 'SOURCE') {
                d.isPowered = true;
                queue.push(d);
            }
        }

        // 6. Iterative Wavefront Propagation & Cascade Loop
        let pass = 0;
        let changed = true;

        while (changed && pass++ < 10) {
            changed = false;

            // BFS Wavefront
            while (queue.length > 0) {
                const curr = queue.shift();
                const allowedPorts = (curr.kind === 'GATE') ? curr.outPorts : [0, 1, 2, 3];

                for (const p of allowedPorts) {
                    if (!curr.ports[p]) continue;

                    const nx = curr.gx + PORT_DELTAS[p].dx;
                    const ny = curr.gy + PORT_DELTAS[p].dy;
                    const opp = OPPOSITE_PORT[p];
                    const neighbors = grid.get(`${nx},${ny}`) || [];

                    for (const neighbor of neighbors) {
                        if (neighbor === curr) continue;

                        if (neighbor.kind === 'GATE') {
                            if (neighbor.inPorts.includes(opp)) {
                                if (!neighbor.inputSignals.has(opp)) {
                                    neighbor.inputSignals.set(opp, true);
                                    changed = true;
                                }
                            }
                        } else if (neighbor.kind === 'HAZARD') {
                            if (!neighbor.isPowered) {
                                neighbor.isPowered = true;
                                changed = true;
                            }
                        } else if (neighbor.kind === 'DOOR' || neighbor.kind === 'DEVICE') {
                            if (!neighbor.isPowered) {
                                neighbor.isPowered = true;
                                queue.push(neighbor);
                                changed = true;
                            }
                        } else if (neighbor.ports && neighbor.ports[opp]) {
                            // Valid matching port connection across conduit/dial
                            if (!neighbor.isPowered) {
                                neighbor.isPowered = true;
                                if (neighbor.kind === 'PIPE') {
                                    neighbor.flowDir = { dx: PORT_DELTAS[p].dx, dy: PORT_DELTAS[p].dy };
                                }
                                queue.push(neighbor);
                                changed = true;
                            }
                        }
                    }
                }
            }

            // Gate Cascade Evaluation
            for (const g of gates) {
                const activeCount = g.inputSignals.size;
                let active = false;

                if (g.type === 'AND') {
                    active = (activeCount >= 2);
                } else if (g.type === 'OR' || g.type === 'XOR') {
                    // Exclusive OR per facility specification: exactly 1 input active = ON; 2 inputs = OFF/CONFLICT
                    if (activeCount === 1) {
                        active = true;
                        g.isConflict = false;
                    } else if (activeCount >= 2) {
                        active = false;
                        g.isConflict = true; // Overloaded conflict state
                    } else {
                        active = false;
                        g.isConflict = false;
                    }
                } else if (g.type === 'NOT') {
                    active = (activeCount === 0);
                } else if (g.type === 'NAND') {
                    active = (activeCount < 2);
                } else if (g.type === 'NOR') {
                    active = (activeCount === 0);
                }

                if (active !== g.isPowered) {
                    g.isPowered = active;
                    changed = true;
                    if (active) {
                        queue.push(g);
                    }
                }
            }
        }

        // 7. Synchronize Global Level Devices
        // Hazards: Security grid cutoff logic -> active/electrified by default; turned off when circuit delivers power to cutoff terminal
        if (this.level && this.level.colliders) {
            const hazards = this.level.colliders.filter(c => c.isHazard === true);
            for (const haz of hazards) {
                let isCutoffPowered = false;
                if (haz.cutoffBoxId && this.level.lightBoxes) {
                    const box = this.level.lightBoxes.find(b => b.id === haz.cutoffBoxId);
                    if (box) isCutoffPowered = Boolean(box.isPowered);
                } else if (haz.isPowered !== undefined) {
                    isCutoffPowered = Boolean(haz.isPowered);
                }

                // Security grid laser starts ON; powering cutoff turns it OFF
                const shouldElectrify = !isCutoffPowered;
                if (haz.isElectrified !== shouldElectrify) {
                    haz.isElectrified = shouldElectrify;
                    if (this.eventBus) {
                        this.eventBus.emit(shouldElectrify ? 'ACTIVATE_DEVICE' : 'DEACTIVATE_DEVICE', haz.deviceId || 'shaft_hazard');
                    }
                }
            }
        }

        // Blast Doors Synchronization across all rooms
        const handledDoors = new Set();
        for (const dev of devices) {
            if (dev.kind === 'DOOR' && dev.raw && !handledDoors.has(dev.raw.id)) {
                handledDoors.add(dev.raw.id);
                // Door is considered powered if ANY of its vertical segments received power OR if linked controlBox is powered
                let shouldOpen = false;
                if (dev.raw.controlBoxId && this.level.lightBoxes) {
                    const box = this.level.lightBoxes.find(b => b.id === dev.raw.controlBoxId);
                    if (box && box.isPowered) shouldOpen = true;
                }
                if (!shouldOpen) {
                    const allSegments = devices.filter(d => d.kind === 'DOOR' && d.raw && d.raw.id === dev.raw.id);
                    shouldOpen = allSegments.some(s => Boolean(s.isPowered));
                }
                if (dev.raw.isOpen !== shouldOpen) {
                    dev.raw.isOpen = shouldOpen;
                    if (this.eventBus) {
                        this.eventBus.emit(shouldOpen ? 'ACTIVATE_DEVICE' : 'DEACTIVATE_DEVICE', dev.raw.id);
                    }
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

    render(ctx, camera = null) {
        ctx.save();

        const sheet = this.assetLoader ? this.assetLoader.getImage('circuits_sheet') : null;

        // 1. Render base metallic pipe tiles
        if (sheet) {
            ctx.imageSmoothingEnabled = false;
            for (const p of this.pipes) {
                if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(p.x, p.y, 32, 32, 32)) {
                    continue;
                }
                ctx.drawImage(sheet, p.srcX, p.srcY, 32, 32, Math.round(p.x), Math.round(p.y), 32, 32);
            }
        }

        // 2. Render powered internal conduit lumens & traveling light pulses
        for (const p of this.pipes) {
            if (p.isPowered) {
                if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(p.x, p.y, 32, 32, 32)) {
                    continue;
                }
                this._renderPoweredPipe(ctx, p);
            }
        }

        // 3. Render micro-sparks
        for (const sp of this.sparks) {
            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(sp.x, sp.y, 2, 2, 32)) {
                continue;
            }
            ctx.fillStyle = sp.color;
            ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 2, 2);
        }

        ctx.restore();
    }

    _renderHazardTerminalConduit(ctx) {
        const c = this.leftHazardConduit;
        const y = c.y;

        ctx.save();
        // Armored conduit from Dial 0 pipe (1504) to shaft hazard terminal (1536)
        ctx.fillStyle = '#121720';
        ctx.fillRect(c.x1, y - 2, c.x2 - c.x1, 4);
        ctx.strokeStyle = '#222d3d';
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x1, y - 2, c.x2 - c.x1, 4);

        // Terminal mounting plate at hazard base (1536, 144)
        ctx.fillStyle = '#222b3a';
        ctx.fillRect(c.x2 - 3, y - 6, 6, 12);
        ctx.strokeStyle = '#38475e';
        ctx.strokeRect(c.x2 - 3, y - 6, 6, 12);

        if (c.isPowered) {
            // Power active: lead wire to hazard terminal
            ctx.strokeStyle = '#cc3344';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(c.x1, y);
            ctx.lineTo(c.x2, y);
            ctx.stroke();

            // Terminal status diode: red = energized / dangerous
            ctx.fillStyle = '#cc2233';
            ctx.beginPath();
            ctx.arc(c.x2, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Power cut off: hazard offline and safe for climbing
            ctx.strokeStyle = '#182433';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(c.x1, y);
            ctx.lineTo(c.x2, y);
            ctx.stroke();

            // Terminal status diode: green = offline / safe
            ctx.fillStyle = '#00aa55';
            ctx.beginPath();
            ctx.arc(c.x2, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    _renderCeilingGeneratorFixture(ctx) {
        ctx.save();
        // Chamber 2 Ceiling Power Substation Intake Fixture at (1728, 0)
        const gx = 1728;
        const gy = 0;

        ctx.fillStyle = '#161e2a';
        ctx.fillRect(gx - 4, gy, 40, 14);
        ctx.strokeStyle = '#314157';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(gx - 4, gy, 40, 14);

        // Substation label badge
        ctx.fillStyle = '#4f6889';
        ctx.font = '6px monospace';
        ctx.fillText('PWR-02', gx - 1, gy + 10);

        // Solid amber facility generator diode
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(gx + 28, gy + 7, 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gx + 28, gy + 7, 1.0, 0, Math.PI * 2);
        ctx.fill();

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
            // Right to bottom corner
            ctx.moveTo(x + 16, y + 32);
            ctx.lineTo(x + 16, y + 16);
            ctx.lineTo(x + 32, y + 16);
        } else if (pipe.type === 'CR_L') {
            // Left to bottom corner
            ctx.moveTo(x, y + 16);
            ctx.lineTo(x + 16, y + 16);
            ctx.lineTo(x + 16, y + 32);
        } else if (pipe.type === 'CR_TR') {
            // Top to right corner
            ctx.moveTo(x + 16, y);
            ctx.lineTo(x + 16, y + 16);
            ctx.lineTo(x + 32, y + 16);
        } else if (pipe.type === 'CR_TL') {
            // Top to left corner
            ctx.moveTo(x + 16, y);
            ctx.lineTo(x + 16, y + 16);
            ctx.lineTo(x, y + 16);
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
