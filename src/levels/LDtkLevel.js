/**
 * LDtkLevel.js
 * Multi-room LDtk Level Loader supporting room-by-room transitions (Celeste / Metroid style),
 * greedy collider merging, responsive canvas scaling, and interactive entities:
 * Drones, Sockets, Wall-runs, Hazards, and Blast Doors.
 */
import { Level } from './Level.js?v=20261107_v6';
import { Socket } from '../entities/Socket.js?v=20261107_v6';
import { Drone } from '../entities/Drone.js?v=20261107_v6';
import { NODE_DESIGNS } from '../modules/CircuitSystem.js?v=20261107_v6';

export class LDtkLevel extends Level {
    constructor(eventBus, circuitSystem, options = {}) {
        super(eventBus);
        this.circuitSystem = circuitSystem;

        this.ldtkPath = options.ldtkPath || './game-levels/map.ldtk';
        this.basePath = options.basePath || './game-levels/map/simplified/';
        this.assetLoader = options.assetLoader || null;

        // Multi-room world layout
        this.roomWidth = 640;
        this.roomHeight = 320;
        this.totalRooms = 3;
        this.activeRoomIndex = 0;

        this.width = this.roomWidth * this.totalRooms; // 1920 px
        this.height = this.roomHeight; // 320 px
        this.spawnPoint = { x: 64, y: 160 };

        // Room composite images
        this.roomImages = [];
        this.drones = [];
        this.logicGates = [];
        this.lightBoxes = [];
        this.pipes = [];

        // Exit Blast Door
        this.door = {
            id: 'exit_door',
            x: 1888,
            y: 160,
            width: 32,
            height: 64,
            isOpen: false,
            openProgress: 0
        };
        this.devices.set(this.door.id, this.door);

        this.isLoaded = false;
        this._bindEvents();
    }

    _bindEvents() {
        this.eventBus.on('ACTIVATE_DEVICE', (deviceId) => {
            if (deviceId === 'exit_door' || deviceId === this.door.id) {
                this.door.isOpen = true;
            }
            if (deviceId === 'shaft_hazard') {
                const haz = this.colliders.find(c => c.deviceId === 'shaft_hazard');
                if (haz) haz.isElectrified = false;
            }
        });

        this.eventBus.on('DEACTIVATE_DEVICE', (deviceId) => {
            if (deviceId === 'exit_door' || deviceId === this.door.id) {
                this.door.isOpen = false;
            }
        });
    }

    async load() {
        try {
            // 1. Fetch main map.ldtk project data
            const res = await fetch(this.ldtkPath);
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${this.ldtkPath}`);
            const data = await res.json();

            // 2. Load composite images for all rooms
            const levels = data.levels || [];
            this.totalRooms = Math.max(1, levels.length);
            this.width = this.roomWidth * this.totalRooms;

            this.roomImages = await Promise.all(
                levels.map((lvl, index) => this._loadRoomImage(`${this.basePath}Level_${index}/_composite.png`))
            );

            // 3. Parse Colliders, Entities & Pipes across all rooms
            this.colliders = [];
            this.sockets = [];
            this.drones = [];
            this.logicGates = [];
            this.lightBoxes = [];
            this.pipes = [];

            for (let i = 0; i < levels.length; i++) {
                const lvl = levels[i];
                const worldX = lvl.worldX !== undefined ? lvl.worldX : i * this.roomWidth;
                const worldY = lvl.worldY !== undefined ? lvl.worldY : 0;

                this._buildRoomColliders(lvl, worldX, worldY);
                this._buildRoomEntities(lvl, worldX, worldY, i);
                this._buildRoomPipes(lvl, worldX, worldY);
            }

            this.isLoaded = true;
            console.log(`[LDtkLevel] Successfully loaded ${levels.length} rooms (${this.width}x${this.height}px, ${this.colliders.length} colliders, ${this.drones.length} drones).`);
        } catch (err) {
            console.warn('[LDtkLevel] Network load failed, using pre-calculated fallback:', err);
            this._loadFallbackData();
        }
    }

    _loadRoomImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn(`[LDtkLevel] Failed to load ${src}`);
                resolve(null);
            };
            img.src = src;
        });
    }

    _buildRoomColliders(lvl, worldX, worldY) {
        const factoryLayer = (lvl.layerInstances || []).find(l => l.__identifier === 'Factory2');
        if (!factoryLayer || !factoryLayer.gridTiles) return;

        const cols = 20;
        const rows = 10;
        const grid = Array.from({ length: rows }, () => Array(cols).fill(false));

        for (const t of factoryLayer.gridTiles) {
            const c = Math.floor(t.px[0] / 32);
            const r = Math.floor(t.px[1] / 32);
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                grid[r][c] = true;
            }
        }

        // 2D Greedy Merging
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
        for (let r = 0; r < rows; r++) {
            let c = 0;
            while (c < cols) {
                if (grid[r][c] && !visited[r][c]) {
                    const startC = c;
                    while (c < cols && grid[r][c] && !visited[r][c]) {
                        c++;
                    }
                    const w = c - startC;
                    let h = 1;
                    let canExtend = true;
                    while (r + h < rows && canExtend) {
                        for (let k = startC; k < startC + w; k++) {
                            if (!grid[r + h][k] || visited[r + h][k]) {
                                canExtend = false;
                                break;
                            }
                        }
                        if (canExtend) h++;
                    }
                    for (let dr = 0; dr < h; dr++) {
                        for (let dc = 0; dc < w; dc++) {
                            visited[r + dr][startC + dc] = true;
                        }
                    }

                    this.addCollider({
                        x: worldX + startC * 32,
                        y: worldY + r * 32,
                        width: w * 32,
                        height: h * 32
                    });
                } else {
                    c++;
                }
            }
        }
    }

    _buildRoomEntities(lvl, worldX, worldY, roomIndex) {
        const entityLayers = (lvl.layerInstances || []).filter(l => l.__type === 'Entities');

        for (const lay of entityLayers) {
            for (const ent of lay.entityInstances || []) {
                const id = ent.__identifier;
                const w = ent.width || 32;
                const h = ent.height || 32;
                const pivotX = (ent.__pivot && ent.__pivot[0] !== undefined) ? ent.__pivot[0] : 0;
                const pivotY = (ent.__pivot && ent.__pivot[1] !== undefined) ? ent.__pivot[1] : 0;

                // Strict 32px grid-locked entity coordinates:
                // topLeft: top-left corner of the entity's 32px tile
                // center: exact center (middle of the 32px square)
                const topLeftX = worldX + ent.px[0] - (pivotX * w);
                const topLeftY = worldY + ent.px[1] - (pivotY * h);
                const centerX = topLeftX + w / 2;
                const centerY = topLeftY + h / 2;

                const fields = {};
                for (const f of ent.fieldInstances || []) {
                    fields[f.__identifier] = f.__value;
                }

                if (id === 'Player_Spawn') {
                    this.spawnPoint = { x: topLeftX, y: topLeftY };
                } else if (id === 'Drone') {
                    const droneType = fields.Drone_Type || 'Tutorial_Drone';
                    const message = this._getDroneMessage(roomIndex, topLeftX, droneType);
                    this.drones.push(new Drone(`drone_${topLeftX}_${topLeftY}`, topLeftX, topLeftY, {
                        type: droneType,
                        message: message,
                        assetLoader: this.assetLoader
                    }));
                } else if (id === 'Socket_Anchor') {
                    this.addSocket(new Socket(`anchor_${centerX}_${centerY}`, centerX, centerY, 'ANCHOR', {
                        label: 'SWING PIVOT',
                        assetLoader: this.assetLoader
                    }));
                } else if (id === 'Socket_Battery') {
                    this.addSocket(new Socket(`battery_${centerX}_${centerY}`, centerX, centerY, 'CHARGER', {
                        label: 'FAST CHARGE',
                        assetLoader: this.assetLoader
                    }));
                } else if (id === 'Socket_Dial') {
                    const design = fields.Socket_Dial || 'T_SHAPE';
                    const rot = fields.initialRotation || 0;
                    const sock = new Socket(`dial_sock_${centerX}_${centerY}`, centerX, centerY, 'CIRCUIT', {
                        label: design,
                        assetLoader: this.assetLoader
                    });
                    this.addSocket(sock);

                    if (this.circuitSystem) {
                        this.circuitSystem.addNode({
                            id: `dial_node_${centerX}_${centerY}`,
                            x: centerX,
                            y: centerY,
                            design: design,
                            ports: this._getInitialPorts(design, rot),
                            rotationAngle: (rot % 4) * (Math.PI / 2),
                            targetRotationAngle: (rot % 4) * (Math.PI / 2),
                            deviceId: fields.targetDevice || 'exit_door'
                        });
                        sock.circuitNodeId = `dial_node_${centerX}_${centerY}`;
                    }
                } else if (id === 'Wall_run') {
                    const face = (fields.Face || 'BOTH').toLowerCase();
                    this.addWallRunWall({
                        x: topLeftX,
                        y: topLeftY,
                        width: w,
                        height: h,
                        wallRunFace: face
                    });
                } else if (id === 'Hazard_Electric') {
                    const face = (fields.Face || 'RIGHT').toLowerCase();
                    this.addHazardObject({
                        x: topLeftX,
                        y: topLeftY,
                        width: w,
                        height: h,
                        isWallRunnable: fields.isWallRunnable !== undefined ? fields.isWallRunnable : true,
                        wallRunFace: face,
                        isElectrified: true,
                        electrifiedFace: face,
                        deviceId: fields.deviceId || 'shaft_hazard',
                        shockDamage: fields.shockDamage || 8.0,
                        knockbackForce: 360
                    });
                } else if (id === 'EntityDoor_Blast' || id === 'Door_Blast') {
                    this.door.x = topLeftX;
                    this.door.y = topLeftY;
                    this.door.width = w;
                    this.door.height = h;
                    this.door.isOpen = Boolean(fields.startsOpen);
                } else if (id === 'Logic_Gate') {
                    const gateType = fields.GateType || 'AND';
                    const orientation = fields.orientation || 0;
                    this.logicGates.push({
                        id: `gate_${topLeftX}_${topLeftY}`,
                        x: topLeftX,
                        y: topLeftY,
                        type: gateType,
                        orientation: orientation,
                        isPowered: false
                    });
                } else if (id === 'Light_Box') {
                    this.lightBoxes.push({
                        id: `lightbox_${topLeftX}_${topLeftY}`,
                        x: topLeftX,
                        y: topLeftY,
                        width: w,
                        height: h,
                        color: fields.Color || '#FF0000',
                        isPowered: false
                    });
                }
            }
        }
    }

    _buildRoomPipes(lvl, worldX, worldY) {
        const pipeLayers = (lvl.layerInstances || []).filter(l => l.__identifier === 'Pipes');
        for (const lay of pipeLayers) {
            for (const t of lay.gridTiles || []) {
                this.pipes.push({
                    x: worldX + t.px[0],
                    y: worldY + t.px[1],
                    srcX: t.src[0],
                    srcY: t.src[1],
                    tileId: t.t
                });
            }
        }
    }

    _getInitialPorts(design, rot) {
        let base = [true, true, true, false]; // T_SHAPE default
        if (design === 'CORNER') base = [false, true, true, false];
        if (design === 'STRAIGHT') base = [false, true, false, true];
        if (design === 'CROSS') base = [true, true, true, true];

        const steps = Math.floor(rot >= 90 ? rot / 90 : rot) % 4;
        for (let i = 0; i < steps; i++) {
            base = [base[3], base[0], base[1], base[2]];
        }
        return base;
    }

    _getDroneMessage(roomIndex, x, type) {
        if (roomIndex === 0) {
            if (x < 300) return 'SYSTEM ONLINE: [A] / [D] to move, hold [SHIFT] to run.';
            return 'CHASM TRANSIT: Press [SPACE] to leap over the opening.';
        }
        if (roomIndex === 1) {
            if (x < 950) return 'CEILING ANCHOR: Click [LMB] towards anchor to shoot wire & swing!';
            return 'MOMENTUM JUMP: Press [SPACE] while swinging mid-air to leap off!';
        }
        if (roomIndex === 2) {
            if (x < 1500) return 'ENERGY DEPLETED? Dock at the battery plate to recharge.';
            return 'VERTICAL SHAFT: Auto-slides on walls, press [SPACE] to wall-jump!';
        }
        return 'Facility operating normally.';
    }

    _loadFallbackData() {
        // Fallback pre-calculated geometry from map.ldtk
        this.colliders = [
            // Room 0
            { x: 0, y: 0, width: 640, height: 96 },
            { x: 0, y: 96, width: 192, height: 32 },
            { x: 0, y: 128, width: 64, height: 192 },
            { x: 64, y: 224, width: 320, height: 96 },
            { x: 448, y: 224, width: 192, height: 96 },
            // Room 1
            { x: 640, y: 0, width: 640, height: 32 },
            { x: 640, y: 32, width: 224, height: 64 },
            { x: 896, y: 32, width: 384, height: 64 },
            { x: 864, y: 64, width: 32, height: 32 },
            { x: 1088, y: 96, width: 32, height: 32 },
            { x: 640, y: 224, width: 192, height: 96 },
            { x: 992, y: 224, width: 288, height: 96 },
            // Room 2
            { x: 1280, y: 0, width: 288, height: 96 },
            { x: 1728, y: 0, width: 192, height: 160 },
            { x: 1632, y: 64, width: 32, height: 256 },
            { x: 1472, y: 96, width: 96, height: 64 },
            { x: 1280, y: 224, width: 352, height: 96 },
            { x: 1664, y: 224, width: 256, height: 96 }
        ];

        this.addSocket(new Socket('anchor_1', 912, 144, 'ANCHOR', { label: 'SWING PIVOT', assetLoader: this.assetLoader }));
        this.addSocket(new Socket('battery_1', 1392, 208, 'CHARGER', { label: 'FAST CHARGE', assetLoader: this.assetLoader }));

        // 5 Dials in Level 2 (Room 2, worldX: 1280)
        const dialDefs = [
            { x: 1488, y: 144, design: 'CORNER', rot: 270 },
            { x: 1776, y: 144, design: 'T_SHAPE', rot: 0 },
            { x: 1808, y: 144, design: 'T_SHAPE', rot: 0 },
            { x: 1840, y: 144, design: 'T_SHAPE', rot: 0 },
            { x: 1872, y: 144, design: 'CORNER', rot: 2 }
        ];
        for (const d of dialDefs) {
            const sock = new Socket(`dial_sock_${d.x}_${d.y}`, d.x, d.y, 'CIRCUIT', {
                label: d.design,
                assetLoader: this.assetLoader
            });
            this.addSocket(sock);
            if (this.circuitSystem) {
                this.circuitSystem.addNode({
                    id: `dial_node_${d.x}_${d.y}`,
                    x: d.x,
                    y: d.y,
                    design: d.design,
                    ports: this._getInitialPorts(d.design, d.rot),
                    rotationAngle: (d.rot % 4) * (Math.PI / 2),
                    targetRotationAngle: (d.rot % 4) * (Math.PI / 2),
                    deviceId: 'exit_door'
                });
                sock.circuitNodeId = `dial_node_${d.x}_${d.y}`;
            }
        }

        // 3 Logic Gates in Level 2
        this.logicGates = [
            { id: 'gate_1792_64', x: 1792, y: 64, type: 'OR', orientation: 0, isPowered: false },
            { id: 'gate_1856_64', x: 1856, y: 64, type: 'OR', orientation: 0, isPowered: false },
            { id: 'gate_1824_32', x: 1824, y: 32, type: 'AND', orientation: 0, isPowered: false }
        ];

        // Light Box in Level 2
        this.lightBoxes = [
            { id: 'lightbox_1888_128', x: 1888, y: 128, width: 32, height: 32, color: '#FF0000', isPowered: false }
        ];

        // 19 Pipe Tiles in Level 2
        this.pipes = [
            { x: 1472, y: 0, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1472, y: 32, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1472, y: 64, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1472, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1504, y: 128, srcX: 0, srcY: 64, tileId: 8 },
            { x: 1760, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1760, y: 64, srcX: 64, srcY: 128, tileId: 18 },
            { x: 1792, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1792, y: 32, srcX: 64, srcY: 128, tileId: 18 },
            { x: 1824, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1824, y: 64, srcX: 64, srcY: 128, tileId: 18 },
            { x: 1824, y: 0, srcX: 64, srcY: 128, tileId: 18 },
            { x: 1856, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1856, y: 32, srcX: 0, srcY: 128, tileId: 16 },
            { x: 1856, y: 0, srcX: 32, srcY: 96, tileId: 13 },
            { x: 1888, y: 0, srcX: 0, srcY: 128, tileId: 16 },
            { x: 1888, y: 32, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1888, y: 64, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1888, y: 96, srcX: 96, srcY: 64, tileId: 11 }
        ];

        this.addWallRunWall({ x: 1632, y: 64, width: 32, height: 160, wallRunFace: 'both' });
        this.addWallRunWall({ x: 1728, y: 0, width: 32, height: 160, wallRunFace: 'left' });
        this.addHazardObject({
            x: 1536,
            y: 0,
            width: 32,
            height: 160,
            isWallRunnable: true,
            wallRunFace: 'right',
            isElectrified: true,
            electrifiedFace: 'right',
            deviceId: 'shaft_hazard'
        });

        this.spawnPoint = { x: 64, y: 192 };
        this.isLoaded = true;
    }

    update(dt, player) {
        super.update(dt);

        // Update Drones
        for (const drone of this.drones) {
            drone.update(dt, player);
        }

        // Animate exit blast door
        const d = this.door;
        const targetProgress = d.isOpen ? 1 : 0;
        if (d.openProgress !== targetProgress) {
            const step = dt * 1.8;
            d.openProgress = targetProgress > d.openProgress
                ? Math.min(targetProgress, d.openProgress + step)
                : Math.max(targetProgress, d.openProgress - step);
        }

        // Room tracking
        if (player) {
            const room = Math.max(0, Math.min(this.totalRooms - 1, Math.floor(player.x / this.roomWidth)));
            if (room !== this.activeRoomIndex) {
                this.activeRoomIndex = room;
                this.eventBus.emit('ROOM_CHANGED', { roomIndex: room });
            }
        }
    }

    renderBackground(ctx) {
        ctx.save();
        ctx.fillStyle = '#10141d';
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw composite images for each 640x320 room
        for (let i = 0; i < this.roomImages.length; i++) {
            const img = this.roomImages[i];
            if (img && img.complete) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, i * this.roomWidth, 0, this.roomWidth, this.roomHeight);
            }
        }

        ctx.restore();
    }

    getSolidColliders() {
        const list = [...this.colliders];
        if (this.door && this.door.openProgress < 0.85) {
            const currentHeight = this.door.height * (1 - this.door.openProgress);
            list.push({
                x: this.door.x,
                y: this.door.y,
                width: this.door.width,
                height: currentHeight
            });
        }
        return list;
    }

    renderForeground(ctx) {
        ctx.save();

        // 1. Render tactile wall-run runners
        this.renderWallRunGripStrips(ctx);

        // 2. Render exit door
        this._renderDoor(ctx);

        // 3. Render sockets
        for (const sock of this.sockets) {
            sock.render(ctx);
        }

        // 4. Render Logic Gates
        this._renderLogicGates(ctx);

        // 5. Render Light Boxes
        this._renderLightBoxes(ctx);

        // 6. Render Drones
        for (const drone of this.drones) {
            drone.render(ctx);
        }

        // 7. Room watermark in corner
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.font = '10px monospace';
        ctx.fillText(`SECTOR 0${this.activeRoomIndex + 1} / 0${this.totalRooms}`, this.activeRoomIndex * this.roomWidth + 16, 24);

        ctx.restore();
    }

    _renderLogicGates(ctx) {
        if (!this.logicGates || this.logicGates.length === 0) return;
        const sheet = this.assetLoader ? this.assetLoader.getImage('gates_sheet') : null;
        if (!sheet) return;

        const GATE_COORDS = {
            'AND':  { sx: 0,  sy: 0 },
            'OR':   { sx: 32, sy: 0 },
            'NOT':  { sx: 64, sy: 0 },
            'NAND': { sx: 0,  sy: 32 },
            'NOR':  { sx: 32, sy: 32 },
            'XOR':  { sx: 64, sy: 32 }
        };

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        for (const gate of this.logicGates) {
            const coord = GATE_COORDS[gate.type] || GATE_COORDS['AND'];
            const gx = Math.round(gate.x);
            const gy = Math.round(gate.y);

            // Draw base gate sprite
            ctx.drawImage(sheet, coord.sx, coord.sy, 32, 32, gx, gy, 32, 32);

            // Dynamic logic gate active state glow
            if (gate.isPowered) {
                ctx.save();
                ctx.shadowColor = '#00ddff';
                ctx.shadowBlur = 6;
                ctx.strokeStyle = '#80e5ff';
                ctx.lineWidth = 1.2;
                ctx.strokeRect(gx + 1, gy + 1, 30, 30);

                // Center glowing power filament
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(gx + 16, gy + 16, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        ctx.restore();
    }

    _renderLightBoxes(ctx) {
        if (!this.lightBoxes || this.lightBoxes.length === 0) return;
        const sheet = this.assetLoader ? this.assetLoader.getImage('circuits_sheet') : null;

        for (const box of this.lightBoxes) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;

            // 1. Draw base metal equipment box from circuits.png [0, 160]
            if (sheet) {
                ctx.drawImage(sheet, 0, 160, 32, 32, Math.round(box.x), Math.round(box.y), 32, 32);
            } else {
                ctx.fillStyle = '#222834';
                ctx.fillRect(box.x, box.y, box.width, box.height);
            }

            // 2. High-visibility Illuminated Status Diode
            const lampX = Math.round(box.x + box.width / 2);
            const lampY = Math.round(box.y + box.height / 2);

            if (box.isPowered) {
                // Online / Unlocked: Radiant Cyber Green Diode with beam halo
                ctx.save();
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 12;
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 2, 0, Math.PI * 2);
                ctx.fill();

                // Downward ambient wash onto blast door frame
                const grad = ctx.createLinearGradient(lampX, lampY, lampX, lampY + 28);
                grad.addColorStop(0, 'rgba(0, 255, 136, 0.45)');
                grad.addColorStop(1, 'rgba(0, 255, 136, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(box.x - 4, lampY, box.width + 8, 28);
                ctx.restore();
            } else {
                // Locked: Crimson Red Diode with Slow Breathing
                const pulse = 0.85 + Math.sin(Date.now() * 0.003) * 0.15;
                ctx.save();
                ctx.shadowColor = '#ff2244';
                ctx.shadowBlur = 6 * pulse;
                ctx.fillStyle = '#ff2244';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 4.5 * pulse, 0, Math.PI * 2);
                ctx.fill();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffa4a4';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 1.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.restore();
        }
    }

    _renderDoor(ctx) {
        const d = this.door;
        const currentY = d.y - d.height * d.openProgress;
        const visibleHeight = d.height * (1 - d.openProgress);

        ctx.save();
        // Door Frame
        ctx.fillStyle = '#14181f';
        ctx.fillRect(d.x - 2, d.y - 4, d.width + 4, d.height + 4);
        ctx.strokeStyle = '#2e3745';
        ctx.strokeRect(d.x - 2, d.y - 4, d.width + 4, d.height + 4);

        // Sliding Panel
        if (visibleHeight > 2) {
            ctx.fillStyle = '#3a4454';
            ctx.fillRect(d.x, currentY, d.width, d.height);
            ctx.fillStyle = d.isOpen ? '#00ffaa' : '#ff3344';
            ctx.fillRect(d.x + 4, currentY + d.height / 2 - 2, d.width - 8, 4);
        }

        // Status Lamp
        ctx.fillStyle = d.isOpen ? '#00ffaa' : '#ff3344';
        ctx.beginPath();
        ctx.arc(d.x + d.width / 2, d.y - 10, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
