/**
 * LDtkLevel.js
 * Multi-room LDtk Level Loader supporting room-by-room transitions (Celeste / Metroid style),
 * greedy collider merging, responsive canvas scaling, and interactive entities:
 * Drones, Sockets, Wall-runs, Hazards, and Blast Doors.
 */
import { Level } from './Level.js?v=20261107_v8';
import { Socket } from '../entities/Socket.js?v=20261107_v8';
import { Drone } from '../entities/Drone.js?v=20261108_v4';
import { Spaceship } from '../entities/Spaceship.js?v=20261108_v1';
import { PORT, NODE_DESIGNS } from '../modules/CircuitSystem.js?v=20261107_v8';

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
        this.totalRooms = 4;
        this.activeRoomIndex = 0;

        this.width = this.roomWidth * this.totalRooms; // 2560 px
        this.height = this.roomHeight; // 320 px
        this.spawnPoint = { x: 64, y: 160 };

        // Zero-GC collider caches
        this._staticSolidColliders = null;
        this._activeSolidCollidersList = [];

        // Room composite images & background
        this.roomImages = [];
        this.backgroundImage = null;
        this.bgPath = './assets/backgrounds/factory_bg.png';
        this.drones = [];
        this.logicGates = [];
        this.lightBoxes = [];
        this.pipes = [];

        // Exit Blast Doors & Power Sources (purely loaded from map)
        this.doors = [];
        this.powerSources = [];
        this.spaceship = null;

        this.isLoaded = false;
        this._bindEvents();
    }

    _bindEvents() {
        this.eventBus.on('ACTIVATE_DEVICE', (deviceId) => {
            const d = (this.doors || []).find(dr => dr.id === deviceId);
            if (d) d.isOpen = true;
            if (deviceId === 'exit_door' && this.door) this.door.isOpen = true;
            if (deviceId === 'matrix_door' && this.matrixDoor) this.matrixDoor.isOpen = true;

            if (deviceId === 'shaft_hazard') {
                const haz = this.colliders.find(c => c.deviceId === 'shaft_hazard');
                if (haz) haz.isElectrified = false;
            }
            if (deviceId === 'matrix_hazard') {
                const haz = this.colliders.find(c => c.deviceId === 'matrix_hazard');
                if (haz) haz.isElectrified = false;
            }
        });

        this.eventBus.on('DEACTIVATE_DEVICE', (deviceId) => {
            const d = (this.doors || []).find(dr => dr.id === deviceId);
            if (d) d.isOpen = false;
            if (deviceId === 'exit_door' && this.door) this.door.isOpen = false;
            if (deviceId === 'matrix_door' && this.matrixDoor) this.matrixDoor.isOpen = false;

            if (deviceId === 'shaft_hazard') {
                const haz = this.colliders.find(c => c.deviceId === 'shaft_hazard');
                if (haz) haz.isElectrified = true;
            }
            if (deviceId === 'matrix_hazard') {
                const haz = this.colliders.find(c => c.deviceId === 'matrix_hazard');
                if (haz) haz.isElectrified = true;
            }
        });
    }

    async load() {
        try {
            // 1. Fetch main map.ldtk project data (cache-busting ensures hot updates are loaded immediately)
            const cacheBust = this.ldtkPath.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
            const res = await fetch(`${this.ldtkPath}${cacheBust}`);
            if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${this.ldtkPath}`);
            const data = await res.json();

            // 2. Load background image & room tile layers for all rooms
            this.backgroundImage = await this._loadRoomImage(this.bgPath);

            const rawLevels = data.levels || [];
            // Sort rooms in logical spatial progression order (worldX ascending, then bottom-to-top worldY descending)
            const levels = [...rawLevels].sort((a, b) => {
                const ax = a.worldX !== undefined ? a.worldX : 0;
                const bx = b.worldX !== undefined ? b.worldX : 0;
                if (ax !== bx) return ax - bx;
                const ay = a.worldY !== undefined ? a.worldY : 0;
                const by = b.worldY !== undefined ? b.worldY : 0;
                return by - ay; // Bottom to top for ascending shafts
            });
            this.totalRooms = Math.max(1, levels.length);
            this.width = this.roomWidth * this.totalRooms;
            this.rooms = levels.map((lvl, index) => ({
                index,
                id: lvl.identifier,
                worldX: lvl.worldX !== undefined ? lvl.worldX : index * this.roomWidth,
                worldY: lvl.worldY !== undefined ? lvl.worldY : 0,
                pxWid: lvl.pxWid || this.roomWidth,
                pxHei: lvl.pxHei || this.roomHeight
            }));

            this.roomImages = await Promise.all(
                levels.map(async (lvl, index) => {
                    const f2Path = `${this.basePath}${lvl.identifier}/Factory2.png`;
                    let img = await this._loadRoomImage(f2Path);
                    if (img) return img;

                    const idPath = `${this.basePath}${lvl.identifier}/_composite.png`;
                    img = await this._loadRoomImage(idPath);
                    if (img) return img;

                    const tilesPath = `${this.basePath}${lvl.identifier}/_tiles.png`;
                    img = await this._loadRoomImage(tilesPath);
                    if (img) return img;

                    return this._loadRoomImage(`${this.basePath}Level_${index}/_composite.png`);
                })
            );

            // 3. Parse Colliders, Entities & Pipes across all rooms
            this.colliders = [];
            this.sockets = [];
            this.drones = [];
            this.logicGates = [];
            this.lightBoxes = [];
            this.pipes = [];
            this.powerSources = [];
            this.doors = [];

            for (let i = 0; i < levels.length; i++) {
                const lvl = levels[i];
                const worldX = lvl.worldX !== undefined ? lvl.worldX : i * this.roomWidth;
                const worldY = lvl.worldY !== undefined ? lvl.worldY : 0;

                this._buildRoomColliders(lvl, worldX, worldY);
                this._buildRoomEntities(lvl, worldX, worldY, i);
                this._buildRoomPipes(lvl, worldX, worldY);
            }

            // 5. Resolve puzzle cutoff boxes and door controls across all rooms
            this._resolveCutoffBoxes();
            this._resolveDoorControls();

            this.isLoaded = true;
            console.log(`[LDtkLevel] Successfully loaded ${levels.length} rooms (${this.width}x${this.height}px, ${this.colliders.length} colliders, ${this.drones.length} drones).`);
        } catch (err) {
            window.__LAST_LOAD_ERR = (err && err.stack) || String(err);
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
            const cacheBust = src.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
            img.src = `${src}${cacheBust}`;
        });
    }

    addCollider(config) {
        const col = super.addCollider(config);
        this._staticSolidColliders = null;
        return col;
    }

    _ensureStaticSolidColliders() {
        if (!this._staticSolidColliders) {
            this._staticSolidColliders = (this.colliders || []).filter(c => !c.isHazard || c.isWallRunnable);
        }
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
                    const droneType = 'Tutorial_Drone';
                    const message = this._getDroneMessage(roomIndex, topLeftX, droneType, fields.Context || fields.message);
                    this.drones.push(new Drone(`drone_${topLeftX}_${topLeftY}`, topLeftX, topLeftY, {
                        type: 'Tutorial_Drone',
                        message: message,
                        assetLoader: this.assetLoader,
                        eventBus: this.eventBus,
                        roomIndex: roomIndex
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
                    let design = fields.Socket_Dial || 'T_SHAPE';
                    if (lvl.identifier === 'Level_11') {
                        const relGx = Math.round((ent.px[0] - (pivotX * w)) / 32);
                        const relGy = Math.round((ent.px[1] - (pivotY * h)) / 32);
                        if ((relGx === 1 && relGy === 5) || (relGx === 14 && relGy === 2)) {
                            design = 'T_SHAPE';
                        }
                        if (relGx === 14 && relGy === 1) {
                            design = 'CROSS';
                        }
                    }
                    const isSource = (design.toLowerCase() === 'source');
                    const isCross = (design && design.toUpperCase() === 'CROSS');
                    let rot = fields.initialRotation || 0;
                    if (lvl.identifier === 'Level_11') {
                        const relGx = Math.round((ent.px[0] - (pivotX * w)) / 32);
                        const relGy = Math.round((ent.px[1] - (pivotY * h)) / 32);
                        const key = `${relGx},${relGy}`;
                        const scrambleMap = {
                            '4,8': 0, '4,6': 90, '4,4': 90,
                            '6,8': 0,
                            '17,8': 0, '17,6': 180,
                            '1,5': 0, '1,3': 270,
                            '8,1': 0, '9,2': 0, '9,4': 180, '9,6': 90,
                            '14,2': 0, '14,3': 270, '14,5': 0
                        };
                        if (scrambleMap[key] !== undefined) {
                            rot = scrambleMap[key];
                        }
                    }
                    // In And_gate_3, the 1-click bottom circuit dial starts horizontal (90 deg) so laser is active until clicked
                    if (lvl.identifier === 'And_gate_3' && Math.round(ent.px[0]) === 624 && Math.round(ent.px[1]) === 208 && rot === 0) {
                        rot = 90;
                    }
                    const steps = Math.round(rot >= 90 ? rot / 90 : rot) % 4;
                    const initialAngle = steps * (Math.PI / 2);

                    if (isSource) {
                        this.powerSources.push({
                            id: `source_${Math.round(topLeftX)}_${Math.round(topLeftY)}`,
                            x: topLeftX,
                            y: topLeftY,
                            width: w,
                            height: h
                        });
                    }

                    let sock = null;
                    if (!isSource && !isCross) {
                        sock = new Socket(`dial_sock_${centerX}_${centerY}`, centerX, centerY, 'CIRCUIT', {
                            label: design,
                            assetLoader: this.assetLoader
                        });
                        this.addSocket(sock);
                    }

                    if (this.circuitSystem) {
                        const targetDev = (Math.round(centerX) === 1488 || Math.round(topLeftX) === 1488)
                            ? 'shaft_hazard'
                            : (fields.targetDevice || 'exit_door');
                        this.circuitSystem.addNode({
                            id: `dial_node_${centerX}_${centerY}`,
                            x: centerX,
                            y: centerY,
                            type: isSource ? 'SOURCE' : 'JUNCTION',
                            design: design,
                            ports: this._getInitialPorts(design, rot),
                            isRotatable: !isSource && !isCross,
                            rotationAngle: initialAngle,
                            targetRotationAngle: initialAngle,
                            deviceId: targetDev
                        });
                        if (sock) {
                            sock.circuitNodeId = `dial_node_${centerX}_${centerY}`;
                        }
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
                    const hazId = fields.deviceId || `hazard_${Math.round(topLeftX)}_${Math.round(topLeftY)}`;
                    const isCorridorBeam = (face === 'all_sides' || face === 'all') && ((w > h && w <= 128) || (h > w && h <= 128));
                    this.addHazardObject({
                        x: topLeftX,
                        y: topLeftY,
                        width: w,
                        height: h,
                        isWallRunnable: fields.isWallRunnable !== undefined ? fields.isWallRunnable : false,
                        wallRunFace: face,
                        isElectrified: true,
                        electrifiedFace: isCorridorBeam ? 'beam' : face,
                        isCorridorBeam: isCorridorBeam,
                        deviceId: hazId,
                        shockDamage: fields.shockDamage || 8.0,
                        knockbackForce: 360
                    });
                } else if (id === 'Power_source') {
                    this.powerSources.push({
                        id: `source_${Math.round(topLeftX)}_${Math.round(topLeftY)}`,
                        x: topLeftX,
                        y: topLeftY,
                        width: w,
                        height: h
                    });
                } else if (id === 'EntityDoor_Blast' || id === 'Door_Blast') {
                    const doorId = fields.id || `door_${Math.round(topLeftX)}_${Math.round(topLeftY)}`;
                    let targetDoor = (this.doors || []).find(d => d.id === doorId);
                    if (!targetDoor) {
                        targetDoor = {
                            id: doorId,
                            x: topLeftX,
                            y: topLeftY,
                            width: w,
                            height: h,
                            isOpen: Boolean(fields.startsOpen),
                            openProgress: 0
                        };
                        this.doors.push(targetDoor);
                        this.devices.set(doorId, targetDoor);
                    } else {
                        targetDoor.x = topLeftX;
                        targetDoor.y = topLeftY;
                        targetDoor.width = w;
                        targetDoor.height = h;
                        targetDoor.isOpen = Boolean(fields.startsOpen);
                    }
                    if (doorId === 'exit_door') this.door = targetDoor;
                    if (doorId === 'matrix_door') this.matrixDoor = targetDoor;
                } else if (id === 'Logic_Gate') {
                    const rawGateType = fields.GateType || 'AND';
                    let gateType = (rawGateType === 'OR') ? 'XOR' : rawGateType;
                    const orientation = fields.orientation || 0;
                    const relGx = Math.round((ent.px[0] - (pivotX * w)) / 32);
                    const relGy = Math.round((ent.px[1] - (pivotY * h)) / 32);
                    if (lvl.identifier === 'Level_11') {
                        if ((relGx === 4 && relGy === 1) || (relGx === 11 && relGy === 4) || (relGx === 11 && relGy === 2) || (relGx === 19 && relGy === 8)) {
                            gateType = 'XOR';
                        } else {
                            gateType = 'AND';
                        }
                    }
                    let inPorts = fields.inPorts;
                    let outPorts = fields.outPorts;
                    if (!inPorts || !outPorts) {
                        const deduced = this._deduceGatePorts(relGx, relGy, gateType);
                        if (!inPorts) inPorts = deduced.inPorts;
                        if (!outPorts) outPorts = deduced.outPorts;
                    }
                    this.logicGates.push({
                        id: `gate_${topLeftX}_${topLeftY}`,
                        x: topLeftX,
                        y: topLeftY,
                        type: gateType,
                        orientation: orientation,
                        inPorts: inPorts,
                        outPorts: outPorts,
                        isPowered: false,
                        isConflict: false
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
                } else if (id === 'Spaceship') {
                    this.spaceship = new Spaceship({
                        x: topLeftX,
                        y: topLeftY,
                        width: 148,
                        height: 72,
                        roomIndex: roomIndex,
                        assetLoader: this.assetLoader,
                        eventBus: this.eventBus
                    });
                }
            }
        }
    }

    _buildRoomPipes(lvl, worldX, worldY) {
        // Collect all dial positions in this room to prevent static pipes from bypassing rotators
        const dialPositions = new Set();
        if (this.sockets) {
            for (const s of this.sockets) {
                if (s.type === 'CIRCUIT') {
                    const tlX = Math.round(s.x - 16);
                    const tlY = Math.round(s.y - 16);
                    dialPositions.add(`${tlX},${tlY}`);
                }
            }
        }

        const pipeLayers = (lvl.layerInstances || []).filter(l => l.__identifier === 'Pipes');
        for (const lay of pipeLayers) {
            for (const t of lay.gridTiles || []) {
                const px = worldX + t.px[0];
                const py = worldY + t.px[1];
                if (dialPositions.has(`${px},${py}`)) {
                    // Suppress static pipe beneath circuit dial so rotator controls flow
                    continue;
                }
                this.pipes.push({
                    x: px,
                    y: py,
                    srcX: t.src[0],
                    srcY: t.src[1],
                    tileId: t.t
                });
            }
        }

        if (lvl.identifier === 'Level_11') {
            const p9_3 = this.pipes.find(p => p.x === worldX + 288 && p.y === worldY + 96);
            if (!p9_3) {
                this.pipes.push({ x: worldX + 288, y: worldY + 96, srcX: 96, srcY: 64, tileId: 11 });
            }
            const p9_5 = this.pipes.find(p => p.x === worldX + 288 && p.y === worldY + 160);
            if (!p9_5) {
                this.pipes.push({ x: worldX + 288, y: worldY + 160, srcX: 96, srcY: 64, tileId: 11 });
            }
        }
    }

    _getInitialPorts(design, rot) {
        // Base cardinal port masks [Top, Right, Bottom, Left] at rotationAngle = 0 in circuits.png:
        let base = [false, true, true, true];   // T_SHAPE: Right, Bottom, Left (T pointing DOWN)
        if (design === 'CORNER') base = [false, true, true, false];  // CORNER: Right, Bottom
        if (design === 'STRAIGHT') base = [true, false, true, false]; // STRAIGHT: Top, Bottom
        if (design === 'CROSS' || (design && design.toLowerCase() === 'source')) base = [true, true, true, true]; // CROSS or Source: 4-way

        const steps = Math.round(rot >= 90 ? rot / 90 : rot) % 4;
        for (let i = 0; i < steps; i++) {
            base = [base[3], base[0], base[1], base[2]];
        }
        return base;
    }

    _getDroneMessage(roomIndex, x, type, context = null) {
        if (context) {
            const ctxKey = String(context).toLowerCase().trim();
            if (ctxKey.includes('hang and turn') || ctxKey.includes('hang & turn')) {
                return '[SPACE] then [LMB] to hang and rotate\nSolve puzzle to open door';
            }
            if (ctxKey.includes('hang and move') || ctxKey.includes('circuits to hang') || ctxKey.includes('hang and swing')) {
                return 'Jump, hang, rotate and swing!';
            }
            if (ctxKey.includes('hang') || ctxKey.includes('circuits')) {
                return 'Jump, hang, rotate and swing!';
            }
            if (ctxKey.includes('xor') || ctxKey.includes('or gate')) {
                return 'XOR GATE:\nActive on 1 input\nConflict on 2 inputs';
            }
            if (ctxKey.includes('and gate')) {
                return 'AND GATE:\nRequires BOTH inputs ON';
            }
            if (ctxKey.includes('laser') || ctxKey.includes('electrified') || ctxKey.includes('hazard')) {
                return 'HAZARD:\nSever circuit to cut laser';
            }
            if (ctxKey.includes('turning') || ctxKey.includes('socket') || ctxKey.includes('dial') || ctxKey.includes('door') || ctxKey.includes('puzzle') || ctxKey.includes('rotation')) {
                return '[LMB] = Connect Wire\n[E] = Rotate Junction\nSolve puzzle to open door';
            }
            if (ctxKey.includes('charging')) {
                return '[LMB] = Connect Wire to Charger\nAuto-Recharges Battery';
            }
            if (ctxKey.includes('wall run')) {
                return 'Sprint into wall to run up\n[SPACE] = Wall Jump';
            }
            if (ctxKey.includes('spaceship') || ctxKey.includes('vehicle')) {
                return 'Board the spaceship\nWASD = Maneuver & Fly';
            }
            if (ctxKey.includes('swing') || ctxKey.includes('connect wire')) {
                return '[LMB] = Shoot Wire\n[RMB] = Cut Wire\n[SPACE] = Swing Jump';
            }
            if (ctxKey.includes('jump')) {
                return '[SPACE] = Jump';
            }
            if (ctxKey.includes('move')) {
                return '[A] [D] = Move';
            }
            return context;
        }
        if (roomIndex === 0) {
            if (x < 300) return '[A] [D] = Move';
            return '[SPACE] = Jump';
        }
        if (roomIndex === 1) {
            if (x < 950) return '[LMB] = Shoot Wire\n[RMB] = Cut Wire';
            return '[SPACE] = Tether Jump';
        }
        if (roomIndex === 2) {
            if (x < 1500) return '[LMB] = Connect Wire to Charger\nAuto-Recharges Battery';
            return '[SPACE] = Wall Jump\nHold [S] = Fast Slide';
        }
        if (roomIndex === 3) {
            return '[LMB] = Connect Wire\n[E] = Rotate Junction\nSolve puzzle to open door';
        }
        return '[A] [D] = Move';
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
            { x: 1664, y: 224, width: 256, height: 96 },
            // Room 3 (Sector 04: Substation Logic Matrix, worldX: 1920)
            { x: 1920, y: 0, width: 640, height: 32 },
            { x: 1920, y: 32, width: 128, height: 32 },
            { x: 2368, y: 32, width: 192, height: 32 },
            { x: 1920, y: 224, width: 160, height: 96 },
            { x: 2144, y: 224, width: 64, height: 96 },
            { x: 2240, y: 224, width: 320, height: 96 },
            { x: 2368, y: 64, width: 128, height: 32 }
        ];

        this.addSocket(new Socket('anchor_1', 912, 144, 'ANCHOR', { label: 'SWING PIVOT', assetLoader: this.assetLoader }));
        this.addSocket(new Socket('battery_1', 1392, 208, 'CHARGER', { label: 'FAST CHARGE', assetLoader: this.assetLoader }));
        this.addSocket(new Socket('anchor_matrix', 2112, 80, 'ANCHOR', { label: 'SWING PIVOT', assetLoader: this.assetLoader }));
        this.addSocket(new Socket('battery_matrix', 1952, 208, 'CHARGER', { label: 'FAST CHARGE', assetLoader: this.assetLoader }));

        // 5 Dials in Level 2 (Room 2, worldX: 1280)
        const dialDefs = [
            { x: 1488, y: 144, design: 'CORNER', rot: 270, dev: 'shaft_hazard' },
            { x: 1776, y: 144, design: 'T_SHAPE', rot: 0, dev: 'exit_door' },
            { x: 1808, y: 144, design: 'T_SHAPE', rot: 0, dev: 'exit_door' },
            { x: 1840, y: 144, design: 'T_SHAPE', rot: 0, dev: 'exit_door' },
            { x: 1872, y: 144, design: 'CORNER', rot: 2, dev: 'exit_door' },
            // 4 Dials in Level 3 (Room 3, worldX: 1920)
            { x: 2000, y: 112, design: 'T_SHAPE', rot: 0, dev: 'matrix_hazard' },
            { x: 2064, y: 112, design: 'T_SHAPE', rot: 90, dev: 'matrix_door' },
            { x: 2096, y: 112, design: 'CORNER', rot: 180, dev: 'matrix_door' },
            { x: 2384, y: 48, design: 'CORNER', rot: 0, dev: 'matrix_door' }
        ];
        for (const d of dialDefs) {
            const sock = new Socket(`dial_sock_${d.x}_${d.y}`, d.x, d.y, 'CIRCUIT', {
                label: d.design,
                assetLoader: this.assetLoader
            });
            this.addSocket(sock);
            if (this.circuitSystem) {
                const steps = Math.round(d.rot >= 90 ? d.rot / 90 : d.rot) % 4;
                const initialAngle = steps * (Math.PI / 2);
                this.circuitSystem.addNode({
                    id: `dial_node_${d.x}_${d.y}`,
                    x: d.x,
                    y: d.y,
                    design: d.design,
                    ports: this._getInitialPorts(d.design, d.rot),
                    rotationAngle: initialAngle,
                    targetRotationAngle: initialAngle,
                    deviceId: d.dev || (d.x === 1488 ? 'shaft_hazard' : 'exit_door')
                });
                sock.circuitNodeId = `dial_node_${d.x}_${d.y}`;
            }
        }

        // Logic Gates in Level 2 & Level 3
        this.logicGates = [
            { id: 'gate_1792_64', x: 1792, y: 64, type: 'XOR', orientation: 0, inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.TOP], isPowered: false, isConflict: false },
            { id: 'gate_1856_64', x: 1856, y: 64, type: 'XOR', orientation: 0, inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.TOP], isPowered: false, isConflict: false },
            { id: 'gate_1824_32', x: 1824, y: 32, type: 'AND', orientation: 0, inPorts: [PORT.LEFT, PORT.RIGHT], outPorts: [PORT.TOP], isPowered: false, isConflict: false },
            // Room 3 Logic Gates
            { id: 'gate_2048_160', x: 2048, y: 160, type: 'NOT', orientation: 0, inPorts: [PORT.LEFT], outPorts: [PORT.RIGHT], isPowered: false, isConflict: false },
            { id: 'gate_2432_128', x: 2432, y: 128, type: 'XOR', orientation: 0, inPorts: [PORT.TOP, PORT.BOTTOM], outPorts: [PORT.RIGHT], isPowered: false, isConflict: false },
            { id: 'gate_2464_160', x: 2464, y: 160, type: 'AND', orientation: 0, inPorts: [PORT.TOP, PORT.LEFT], outPorts: [PORT.RIGHT], isPowered: false, isConflict: false }
        ];

        // Light Boxes in Level 2 & Level 3
        this.lightBoxes = [
            { id: 'lightbox_1888_128', x: 1888, y: 128, width: 32, height: 32, color: '#FF0000', isPowered: false },
            { id: 'lightbox_2496_160', x: 2496, y: 160, width: 32, height: 32, color: '#FF0000', isPowered: false }
        ];

        // Pipe Tiles in Level 2 (including Chamber 1 & Chamber 2 independent feeds)
        this.pipes = [
            // Chamber 1 Left Ceiling Feed & Hazard Cutoff
            { x: 1472, y: 0, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1472, y: 32, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1472, y: 64, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1472, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1504, y: 128, srcX: 0, srcY: 64, tileId: 8 },

            // Chamber 2 Independent Ceiling Power Feed along wall (1728) into Dial 1 (1760)
            { x: 1728, y: 0, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1728, y: 32, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1728, y: 64, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1728, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1728, y: 128, srcX: 32, srcY: 128, tileId: 17 },

            // Chamber 2 Logic Puzzle Conduit Network
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
            { x: 1888, y: 96, srcX: 96, srcY: 64, tileId: 11 },

            // Room 3 (Sector 04) Pipes:
            // Ceiling Power Intake at (1984, 0)
            { x: 1984, y: 0, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1984, y: 32, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1984, y: 64, srcX: 96, srcY: 64, tileId: 11 },
            // Inverter feed from Dial 1 (2000, 112)
            { x: 1984, y: 128, srcX: 96, srcY: 64, tileId: 11 },
            { x: 1984, y: 160, srcX: 32, srcY: 128, tileId: 17 },
            { x: 2016, y: 160, srcX: 0, srcY: 64, tileId: 8 },
            // Inverter to Hazard
            { x: 2080, y: 160, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2112, y: 160, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2144, y: 160, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2176, y: 160, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2208, y: 160, srcX: 0, srcY: 64, tileId: 8 },
            // Inter-dial (2000, 112 to 2064, 112)
            { x: 2016, y: 96, srcX: 0, srcY: 64, tileId: 8 },
            // Upper gantry bridge feed
            { x: 2048, y: 64, srcX: 32, srcY: 128, tileId: 17 },
            { x: 2048, y: 32, srcX: 96, srcY: 64, tileId: 11 },
            { x: 2080, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2112, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2144, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2176, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2208, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2240, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2272, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2304, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2336, y: 32, srcX: 0, srcY: 64, tileId: 8 },
            // Upper Dial 4 to Gate 2
            { x: 2368, y: 64, srcX: 64, srcY: 96, tileId: 15 },
            { x: 2400, y: 64, srcX: 64, srcY: 128, tileId: 18 },
            { x: 2400, y: 96, srcX: 96, srcY: 64, tileId: 11 },
            { x: 2432, y: 96, srcX: 64, srcY: 128, tileId: 18 },
            // Lower Dial 3 to Gate 2
            { x: 2080, y: 128, srcX: 96, srcY: 64, tileId: 11 },
            { x: 2080, y: 192, srcX: 32, srcY: 128, tileId: 17 },
            { x: 2112, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2144, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2176, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2208, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2240, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2272, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2304, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2336, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2368, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2400, y: 192, srcX: 0, srcY: 64, tileId: 8 },
            { x: 2432, y: 192, srcX: 0, srcY: 128, tileId: 16 },
            { x: 2432, y: 160, srcX: 96, srcY: 64, tileId: 11 },
            // Gate 2 to Gate 3
            { x: 2464, y: 128, srcX: 0, srcY: 128, tileId: 16 }
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

        this.addWallRunWall({ x: 2336, y: 64, width: 32, height: 160, wallRunFace: 'left' });
        this.addHazardObject({
            x: 2240,
            y: 64,
            width: 32,
            height: 160,
            isWallRunnable: true,
            wallRunFace: 'right',
            isElectrified: true,
            electrifiedFace: 'right',
            deviceId: 'matrix_hazard'
        });

        this.spawnPoint = { x: 64, y: 192 };
        this._staticSolidColliders = null;
        this.isLoaded = true;
    }

    getRoomCheckpoint(roomIndex) {
        if (!this.rooms || this.rooms.length === 0) {
            return { x: 64, y: 192 };
        }
        const rm = this.rooms[Math.max(0, Math.min(this.rooms.length - 1, roomIndex))];
        if (rm.id === 'And_gate_3_above') {
            return { x: rm.worldX + 128, y: rm.worldY + 128 };
        }
        if (rm.id === 'Level_7') {
            return { x: rm.worldX + 64, y: rm.worldY + 128 };
        }
        if (rm.id === 'Level_11') {
            return { x: rm.worldX + 64, y: rm.worldY + 224 };
        }
        if (rm.id === 'Level_12') {
            return { x: rm.worldX + 64, y: rm.worldY + 128 };
        }
        return { x: rm.worldX + 64, y: rm.worldY + 192 };
    }

    /**
     * Resets all circuit nodes, logic gates, lightboxes, and doors in the specified room back to their initial state.
     * Ensures selected levels from the menu start completely unsolved.
     * @param {number} roomIndex 
     */
    resetRoomCircuits(roomIndex) {
        if (!this.rooms || roomIndex < 0 || roomIndex >= this.rooms.length) {
            this.resetAllCircuits();
            return;
        }
        const rm = this.rooms[roomIndex];
        const minX = rm.worldX;
        const maxX = rm.worldX + rm.pxWid;
        const minY = rm.worldY;
        const maxY = rm.worldY + rm.pxHei;

        if (this.circuitSystem && typeof this.circuitSystem.resetRoomNodes === 'function') {
            this.circuitSystem.resetRoomNodes(minX, maxX, minY, maxY);
        }

        // Reset doors in this room
        for (const d of (this.doors || [])) {
            if (d.x >= minX && d.x < maxX && d.y >= minY && d.y < maxY) {
                d.isOpen = false;
                d.openProgress = 0;
            }
        }

        // Reset hazards in this room
        for (const h of (this.colliders || [])) {
            if (h.isHazard && h.x >= minX && h.x < maxX && h.y >= minY && h.y < maxY) {
                h.isElectrified = true;
            }
        }

        // Reset lightboxes in this room
        for (const b of (this.lightBoxes || [])) {
            if (b.x >= minX && b.x < maxX && b.y >= minY && b.y < maxY) {
                b.isPowered = false;
            }
        }

        // Reset logic gates in this room
        for (const g of (this.logicGates || [])) {
            if (g.x >= minX && g.x < maxX && g.y >= minY && g.y < maxY) {
                g.isPowered = false;
                g.isConflict = false;
            }
        }
    }

    /**
     * Resets all circuit nodes, logic gates, lightboxes, and doors across the entire facility.
     */
    resetAllCircuits() {
        if (this.circuitSystem && typeof this.circuitSystem.resetAllNodes === 'function') {
            this.circuitSystem.resetAllNodes();
        }

        for (const d of (this.doors || [])) {
            d.isOpen = false;
            d.openProgress = 0;
        }

        for (const h of (this.colliders || [])) {
            if (h.isHazard) {
                h.isElectrified = true;
            }
        }

        for (const b of (this.lightBoxes || [])) {
            b.isPowered = false;
        }

        for (const g of (this.logicGates || [])) {
            g.isPowered = false;
            g.isConflict = false;
        }
    }

    update(dt, player, input = null) {
        super.update(dt);

        // Update Drones
        for (const drone of this.drones) {
            drone.update(dt, player, input);
        }

        // Update Spaceship
        if (this.spaceship) {
            this.spaceship.update(dt, player, input);
        }

        // Animate all exit blast doors
        for (const d of (this.doors || [])) {
            const targetProgress = d.isOpen ? 1 : 0;
            if (d.openProgress !== targetProgress) {
                const step = dt * 1.8;
                d.openProgress = targetProgress > d.openProgress
                    ? Math.min(targetProgress, d.openProgress + step)
                    : Math.max(targetProgress, d.openProgress - step);
            }
        }

        // 2D Room tracking
        if (player) {
            const px = player.x + (player.width || 32) / 2;
            const py = player.y + (player.height || 32) / 2;
            let currentRoom = (this.rooms || []).find(r =>
                px >= r.worldX && px < r.worldX + r.pxWid &&
                py >= r.worldY && py < r.worldY + r.pxHei
            );
            if (!currentRoom && this.rooms && this.rooms.length > 0) {
                let closest = this.rooms[0];
                let minDist = Infinity;
                for (const r of this.rooms) {
                    const cx = r.worldX + r.pxWid / 2;
                    const cy = r.worldY + r.pxHei / 2;
                    const d = Math.hypot(cx - px, cy - py);
                    if (d < minDist) {
                        minDist = d;
                        closest = r;
                    }
                }
                currentRoom = closest;
            }
            if (currentRoom && currentRoom.index !== this.activeRoomIndex) {
                this.activeRoomIndex = currentRoom.index;
                this.eventBus.emit('ROOM_CHANGED', { roomIndex: currentRoom.index, roomId: currentRoom.id });
            }
        }
    }

    renderBackground(ctx, camera = null) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Base dark tone beneath background in case of loading or borders
        ctx.fillStyle = '#10141d';
        ctx.fillRect(0, 0, this.width, this.height);

        // 1. Draw the game factory background for visible rooms
        if (this.rooms && this.rooms.length > 0) {
            for (let i = 0; i < this.rooms.length; i++) {
                const rm = this.rooms[i];
                const rx = rm ? rm.worldX : i * this.roomWidth;
                const ry = rm ? rm.worldY : 0;
                const rw = rm ? rm.pxWid : this.roomWidth;
                const rh = rm ? rm.pxHei : this.roomHeight;

                if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(rx, ry, rw, rh, 32)) {
                    continue;
                }

                if (this.backgroundImage && this.backgroundImage.complete) {
                    ctx.drawImage(this.backgroundImage, rx, ry, rw, rh);
                }
            }
        } else if (this.backgroundImage && this.backgroundImage.complete) {
            for (let i = 0; i < this.totalRooms; i++) {
                const rx = i * this.roomWidth;
                if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(rx, 0, this.roomWidth, this.roomHeight, 32)) {
                    continue;
                }
                ctx.drawImage(this.backgroundImage, rx, 0, this.roomWidth, this.roomHeight);
            }
        }

        // 2. Draw room tile layers (Factory2, platforms, structures) on top of visible rooms
        for (let i = 0; i < this.roomImages.length; i++) {
            const img = this.roomImages[i];
            const rm = this.rooms ? this.rooms[i] : null;
            const rx = rm ? rm.worldX : i * this.roomWidth;
            const ry = rm ? rm.worldY : 0;
            const rw = rm ? rm.pxWid : this.roomWidth;
            const rh = rm ? rm.pxHei : this.roomHeight;

            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(rx, ry, rw, rh, 32)) {
                continue;
            }

            if (img && img.complete) {
                ctx.drawImage(img, rx, ry, rw, rh);
            }
        }

        ctx.restore();
    }

    getSolidColliders() {
        // Zero-GC collider list retrieval: reuse static cached list and avoid array allocations
        this._ensureStaticSolidColliders();
        if (!this._activeSolidCollidersList) {
            this._activeSolidCollidersList = [];
        }
        this._activeSolidCollidersList.length = 0;

        const staticList = this._staticSolidColliders;
        for (let i = 0; i < staticList.length; i++) {
            this._activeSolidCollidersList.push(staticList[i]);
        }

        for (const d of (this.doors || [])) {
            if (d && d.openProgress < 0.85) {
                if (!d._colliderObj) {
                    d._colliderObj = { x: d.x, y: d.y, width: d.width, height: d.height };
                }
                d._colliderObj.x = d.x;
                d._colliderObj.y = d.y;
                d._colliderObj.width = d.width;
                d._colliderObj.height = d.height * (1 - d.openProgress);
                this._activeSolidCollidersList.push(d._colliderObj);
            }
        }
        return this._activeSolidCollidersList;
    }

    getHazardColliders() {
        return (this.colliders || []).filter(c => c.isHazard === true);
    }

    renderForeground(ctx, camera = null) {
        ctx.save();

        // 1. Render tactile wall-run runners
        this.renderWallRunGripStrips(ctx, camera);

        // 2. Render exit door
        this._renderDoor(ctx, camera);

        // 3. Render sockets
        for (const sock of this.sockets) {
            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(sock.x - 16, sock.y - 16, 32, 32, 32)) {
                continue;
            }
            sock.render(ctx);
        }

        // 4. Render Power Sources (Industrial Generator Core)
        this._renderPowerSources(ctx, camera);

        // 5. Render Logic Gates
        this._renderLogicGates(ctx, camera);

        // 6. Render Light Boxes
        this._renderLightBoxes(ctx, camera);

        // 7. Render Drones
        for (const drone of this.drones) {
            drone.render(ctx, camera);
        }

        // 7b. Render Spaceship
        if (this.spaceship) {
            this.spaceship.render(ctx, camera);
        }

        // 8. Room watermark in corner
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.font = '10px monospace';
        const curRoom = (this.rooms && this.rooms[this.activeRoomIndex]) || null;
        const rx = curRoom ? curRoom.worldX : this.activeRoomIndex * this.roomWidth;
        const ry = curRoom ? curRoom.worldY : 0;
        const sectorNum = String(this.activeRoomIndex + 1).padStart(2, '0');
        const totalNum = String(this.totalRooms).padStart(2, '0');
        ctx.fillText(`SECTOR ${sectorNum} / ${totalNum}`, rx + 16, ry + 24);

        ctx.restore();
    }

    _renderPowerSources(ctx, camera = null) {
        if (!this.powerSources || this.powerSources.length === 0) return;
        const sheet = this.assetLoader ? this.assetLoader.getImage('circuits_sheet') : null;

        for (const src of this.powerSources) {
            const sx = Math.round(src.x);
            const sy = Math.round(src.y);
            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(sx, sy, 32, 32, 32)) {
                continue;
            }

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            // 1. Solid industrial mounting plate backing (eliminates background tile transparency gaps)
            ctx.fillStyle = '#10151f';
            ctx.fillRect(sx, sy, 32, 32);

            // 2. Draw authentic 32x32 Generator Plate from Circuits(4).png [64, 160]
            if (sheet) {
                ctx.drawImage(sheet, 64, 160, 32, 32, sx, sy, 32, 32);
            } else {
                ctx.fillStyle = '#1c2432';
                ctx.fillRect(sx + 2, sy + 2, 28, 28);
                ctx.strokeStyle = '#2e3d52';
                ctx.lineWidth = 1;
                ctx.strokeRect(sx + 2, sy + 2, 28, 28);
            }

            // 3. Grounded industrial power core indicator (golden lumen channel)
            ctx.fillStyle = '#ffd000';
            ctx.fillRect(sx + 13, sy + 13, 6, 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx + 15, sy + 15, 2, 2);

            ctx.restore();
        }
    }

    _renderLogicGates(ctx, camera = null) {
        if (!this.logicGates || this.logicGates.length === 0) return;

        for (const gate of this.logicGates) {
            const gx = Math.round(gate.x);
            const gy = Math.round(gate.y);
            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(gx, gy, 32, 32, 32)) {
                continue;
            }
            this._renderSingleLogicGate(ctx, gate, gx, gy);
        }
    }

    _renderSingleLogicGate(ctx, gate, gx, gy) {
        const isPowered = Boolean(gate.isPowered);
        const rawType = (gate.type || 'AND').toUpperCase();
        const type = (rawType === 'OR') ? 'XOR' : rawType;

        ctx.save();

        // 0. Standard Industrial Truss Background Patch (masks any background seams)
        ctx.fillStyle = '#222a5c';
        ctx.fillRect(gx, gy, 32, 32);

        // 1. Industrial Micro-Controller Bezel & Chassis (32x32)
        ctx.fillStyle = isPowered ? '#0f1722' : '#0c121a';
        ctx.strokeStyle = isPowered ? '#2e5b82' : '#1c2838';
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(gx + 2, gy + 2, 28, 28, 3.5);
        } else {
            ctx.rect(gx + 2, gy + 2, 28, 28);
        }
        ctx.fill();
        ctx.stroke();

        // Inner beveled rim
        ctx.strokeStyle = isPowered ? 'rgba(0, 220, 255, 0.20)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1.0;
        ctx.strokeRect(gx + 3.5, gy + 3.5, 25, 25);

        // Corner mounting micro-screws
        ctx.fillStyle = isPowered ? '#4a7299' : '#2b3b4e';
        const rivets = [
            [gx + 4.5, gy + 4.5],
            [gx + 27.5, gy + 4.5],
            [gx + 4.5, gy + 27.5],
            [gx + 27.5, gy + 27.5]
        ];
        for (const [rx, ry] of rivets) {
            ctx.beginPath();
            ctx.arc(rx, ry, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Metallic contact pins on module edges
        ctx.fillStyle = isPowered ? '#55a8c9' : '#31445b';
        ctx.fillRect(gx, gy + 7.5, 2.5, 2);   // Top input lead
        ctx.fillRect(gx, gy + 14.5, 2.5, 2);  // Bottom input lead
        ctx.fillRect(gx + 29.5, gy + 11, 2.5, 2); // Output lead

        // Status LED diode in top-right corner: lit when powered, off when disconnected
        const ledX = gx + 25.5;
        const ledY = gy + 6.5;
        if (isPowered) {
            ctx.fillStyle = '#00e676';
            ctx.beginPath();
            ctx.arc(ledX, ledY, 1.8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ledX, ledY, 0.8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Disconnected: light is off
            ctx.fillStyle = '#223142';
            ctx.beginPath();
            ctx.arc(ledX, ledY, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. High-Precision Vector IEEE Logic Symbol
        ctx.save();
        ctx.imageSmoothingEnabled = true;

        if (isPowered) {
            ctx.strokeStyle = '#00ddff';
            ctx.fillStyle = 'rgba(0, 221, 255, 0.08)';
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        } else {
            // Disconnected: light is off
            ctx.strokeStyle = '#41556e';
            ctx.fillStyle = 'transparent';
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }

        this._renderGateSymbol(ctx, type, gx, gy, isPowered);

        if (isPowered) {
            // Crisp white filament highlight
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            this._renderGateSymbol(ctx, type, gx, gy, false);
        }
        ctx.restore();

        // 3. Crisp High-Legibility Typography Label
        ctx.save();
        ctx.font = 'bold 7px "Segoe UI", "Roboto", "Consolas", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isPowered) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText(type, gx + 16, gy + 24.5);
        } else {
            // Disconnected: unlit label
            ctx.fillStyle = '#5a738f';
            ctx.fillText(type, gx + 16, gy + 24.5);
        }
        ctx.restore();

        ctx.restore();
    }

    _renderGateSymbol(ctx, type, gx, gy, shouldFill = true) {
        if (type === 'AND') {
            // ANSI/IEEE Standard AND Gate
            ctx.beginPath();
            // Input lead lines
            ctx.moveTo(gx + 2.5, gy + 8.5);
            ctx.lineTo(gx + 7.5, gy + 8.5);
            ctx.moveTo(gx + 2.5, gy + 15.5);
            ctx.lineTo(gx + 7.5, gy + 15.5);

            // Gate contour
            ctx.moveTo(gx + 7.5, gy + 5.5);
            ctx.lineTo(gx + 14, gy + 5.5);
            ctx.bezierCurveTo(gx + 21.5, gy + 5.5, gx + 21.5, gy + 18.5, gx + 14, gy + 18.5);
            ctx.lineTo(gx + 7.5, gy + 18.5);
            ctx.closePath();

            // Output lead line
            ctx.moveTo(gx + 21.5, gy + 12);
            ctx.lineTo(gx + 29.5, gy + 12);

            if (shouldFill) {
                ctx.fill();
            }
            ctx.stroke();
            return;

        } else if (type === 'OR') {
            // ANSI/IEEE Standard OR Gate
            // 1. Closed main body
            ctx.beginPath();
            ctx.moveTo(gx + 7.5, gy + 5.5);
            ctx.quadraticCurveTo(gx + 16, gy + 6.2, gx + 22.5, gy + 12);
            ctx.quadraticCurveTo(gx + 16, gy + 17.8, gx + 7.5, gy + 18.5);
            ctx.quadraticCurveTo(gx + 10.5, gy + 12, gx + 7.5, gy + 5.5);
            ctx.closePath();

            if (shouldFill) {
                ctx.fill();
            }
            ctx.stroke();

            // 2. Input & Output lead lines
            ctx.beginPath();
            ctx.moveTo(gx + 2.5, gy + 8.5);
            ctx.lineTo(gx + 8.8, gy + 8.5);
            ctx.moveTo(gx + 2.5, gy + 15.5);
            ctx.lineTo(gx + 8.8, gy + 15.5);
            ctx.moveTo(gx + 22.5, gy + 12);
            ctx.lineTo(gx + 29.5, gy + 12);
            ctx.stroke();
            return;

        } else if (type === 'XOR') {
            // ANSI/IEEE Standard XOR Gate
            // 1. Closed main body
            ctx.beginPath();
            ctx.moveTo(gx + 7.5, gy + 5.5);
            ctx.quadraticCurveTo(gx + 16, gy + 6.2, gx + 22.5, gy + 12);
            ctx.quadraticCurveTo(gx + 16, gy + 17.8, gx + 7.5, gy + 18.5);
            ctx.quadraticCurveTo(gx + 10.5, gy + 12, gx + 7.5, gy + 5.5);
            ctx.closePath();

            if (shouldFill) {
                ctx.fill();
            }
            ctx.stroke();

            // 2. Auxiliary curved input arc and lead lines
            ctx.beginPath();
            // Offset curved back line
            ctx.moveTo(gx + 4.5, gy + 5.5);
            ctx.quadraticCurveTo(gx + 7.5, gy + 12, gx + 4.5, gy + 18.5);

            // Input leads to auxiliary arc
            ctx.moveTo(gx + 2.5, gy + 8.5);
            ctx.lineTo(gx + 5.6, gy + 8.5);
            ctx.moveTo(gx + 2.5, gy + 15.5);
            ctx.lineTo(gx + 5.6, gy + 15.5);

            // Continuous leads across arc into main body
            ctx.moveTo(gx + 6.2, gy + 8.5);
            ctx.lineTo(gx + 8.8, gy + 8.5);
            ctx.moveTo(gx + 6.2, gy + 15.5);
            ctx.lineTo(gx + 8.8, gy + 15.5);

            // Output lead line
            ctx.moveTo(gx + 22.5, gy + 12);
            ctx.lineTo(gx + 29.5, gy + 12);
            ctx.stroke();
            return;

        } else if (type === 'NOT') {
            // Inverter Triangle
            ctx.beginPath();
            ctx.moveTo(gx + 7.5, gy + 6.5);
            ctx.lineTo(gx + 17.5, gy + 12);
            ctx.lineTo(gx + 7.5, gy + 17.5);
            ctx.closePath();
            if (shouldFill) {
                ctx.fill();
            }
            ctx.stroke();

            // Inversion Bubble + leads
            ctx.beginPath();
            ctx.arc(gx + 19.5, gy + 12, 1.6, 0, Math.PI * 2);
            ctx.moveTo(gx + 2.5, gy + 12);
            ctx.lineTo(gx + 7.5, gy + 12);
            ctx.moveTo(gx + 21.1, gy + 12);
            ctx.lineTo(gx + 29.5, gy + 12);
            ctx.stroke();
            return;

        } else if (type === 'NAND') {
            // AND shape
            ctx.beginPath();
            ctx.moveTo(gx + 7.5, gy + 5.5);
            ctx.lineTo(gx + 13, gy + 5.5);
            ctx.bezierCurveTo(gx + 19.5, gy + 5.5, gx + 19.5, gy + 18.5, gx + 13, gy + 18.5);
            ctx.lineTo(gx + 7.5, gy + 18.5);
            ctx.closePath();
            if (shouldFill) {
                ctx.fill();
            }
            ctx.stroke();

            // Bubble + leads
            ctx.beginPath();
            ctx.arc(gx + 21, gy + 12, 1.5, 0, Math.PI * 2);
            ctx.moveTo(gx + 2.5, gy + 8.5);
            ctx.lineTo(gx + 7.5, gy + 8.5);
            ctx.moveTo(gx + 2.5, gy + 15.5);
            ctx.lineTo(gx + 7.5, gy + 15.5);
            ctx.moveTo(gx + 22.5, gy + 12);
            ctx.lineTo(gx + 29.5, gy + 12);
            ctx.stroke();
            return;

        } else if (type === 'NOR') {
            // OR shape
            ctx.beginPath();
            ctx.moveTo(gx + 7.5, gy + 5.5);
            ctx.quadraticCurveTo(gx + 15, gy + 6.2, gx + 20.5, gy + 12);
            ctx.quadraticCurveTo(gx + 15, gy + 17.8, gx + 7.5, gy + 18.5);
            ctx.quadraticCurveTo(gx + 10.5, gy + 12, gx + 7.5, gy + 5.5);
            ctx.closePath();
            if (shouldFill) {
                ctx.fill();
            }
            ctx.stroke();

            // Bubble + leads
            ctx.beginPath();
            ctx.arc(gx + 22, gy + 12, 1.5, 0, Math.PI * 2);
            ctx.moveTo(gx + 2.5, gy + 8.5);
            ctx.lineTo(gx + 8.8, gy + 8.5);
            ctx.moveTo(gx + 2.5, gy + 15.5);
            ctx.lineTo(gx + 8.8, gy + 15.5);
            ctx.moveTo(gx + 23.5, gy + 12);
            ctx.lineTo(gx + 29.5, gy + 12);
            ctx.stroke();
            return;
        }

        if (shouldFill) {
            ctx.fill();
        }
        ctx.stroke();
    }

    _renderLightBoxes(ctx, camera = null) {
        if (!this.lightBoxes || this.lightBoxes.length === 0) return;
        const sheet = this.assetLoader ? this.assetLoader.getImage('circuits_sheet') : null;

        for (const box of this.lightBoxes) {
            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(box.x, box.y, box.width || 32, box.height || 32, 32)) {
                continue;
            }
            ctx.save();
            ctx.imageSmoothingEnabled = false;

            // 1. Draw base metal equipment box from circuits.png [0, 160]
            if (sheet) {
                ctx.drawImage(sheet, 0, 160, 32, 32, Math.round(box.x), Math.round(box.y), 32, 32);
            } else {
                ctx.fillStyle = '#222834';
                ctx.fillRect(box.x, box.y, box.width, box.height);
            }

            // 2. High-visibility Status Diode (no neon blur)
            const lampX = Math.round(box.x + box.width / 2);
            const lampY = Math.round(box.y + box.height / 2);

            if (box.isPowered) {
                // Online / Unlocked: Clean green status diode
                ctx.fillStyle = '#00cc66';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Locked: Clean muted red diode
                ctx.fillStyle = '#881824';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#cc4455';
                ctx.beginPath();
                ctx.arc(lampX, lampY, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    _renderSingleDoor(ctx, d) {
        const currentY = d.y - d.height * d.openProgress;
        const visibleHeight = d.height * (1 - d.openProgress);

        ctx.save();
        // Door Frame: Industrial side jambs and top lintel / track (no opaque interior fill)
        ctx.fillStyle = '#1e2633';
        ctx.fillRect(d.x - 3, d.y - 4, 3, d.height + 4);              // Left jamb
        ctx.fillRect(d.x + d.width, d.y - 4, 3, d.height + 4);         // Right jamb
        ctx.fillRect(d.x - 3, d.y - 4, d.width + 6, 4);                // Top lintel / track

        ctx.strokeStyle = '#2e3745';
        ctx.lineWidth = 1;
        ctx.strokeRect(d.x - 3, d.y - 4, 3, d.height + 4);
        ctx.strokeRect(d.x + d.width, d.y - 4, 3, d.height + 4);
        ctx.strokeRect(d.x - 3, d.y - 4, d.width + 6, 4);

        // Sliding Panel (clipped to doorway opening so panel retracts cleanly into header)
        if (visibleHeight > 2) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(d.x, d.y, d.width, d.height);
            ctx.clip();

            ctx.fillStyle = '#3a4454';
            ctx.fillRect(d.x, currentY, d.width, d.height);
            ctx.fillStyle = d.isOpen ? '#00ffaa' : '#ff3344';
            ctx.fillRect(d.x + 4, currentY + d.height / 2 - 2, d.width - 8, 4);
            ctx.restore();
        }

        // Status Lamp
        ctx.fillStyle = d.isOpen ? '#00ffaa' : '#ff3344';
        ctx.beginPath();
        ctx.arc(d.x + d.width / 2, d.y - 10, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _renderDoor(ctx, camera = null) {
        for (const d of (this.doors || [])) {
            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(d.x - 8, d.y - 16, d.width + 16, d.height + 24, 32)) {
                continue;
            }
            this._renderSingleDoor(ctx, d);
        }
    }

    _resolveCutoffBoxes() {
        if (!this.colliders || !this.lightBoxes) return;
        const hazards = this.colliders.filter(c => c.isHazard);
        for (const haz of hazards) {
            // Find the room containing this hazard
            const room = (this.rooms || []).find(r =>
                haz.x >= r.worldX && haz.x < r.worldX + r.pxWid &&
                haz.y >= r.worldY && haz.y < r.worldY + r.pxHei
            );
            if (!room) continue;

            const roomBoxes = this.lightBoxes.filter(b =>
                b.x >= room.worldX && b.x < room.worldX + room.pxWid &&
                b.y >= room.worldY && b.y < room.worldY + room.pxHei
            );

            if (roomBoxes.length === 1) {
                haz.cutoffBoxId = roomBoxes[0].id;
                haz.isCorridorBeam = true;
            } else if (roomBoxes.length > 1) {
                // Multi-box rooms (e.g. And_gate_3 / And_gate_3_above)
                const rx = haz.x - room.worldX;
                const ry = haz.y - room.worldY;
                if (room.id === 'And_gate_3') {
                    if (rx < 300) {
                        // Left wall laser -> lightbox at rx < 300
                        const b = roomBoxes.find(bx => (bx.x - room.worldX) < 300);
                        if (b) haz.cutoffBoxId = b.id;
                    } else if (ry >= 100) {
                        // Lower laser in shaft -> lower shaft lightbox
                        const b = roomBoxes.find(bx => (bx.x - room.worldX) >= 300 && (bx.y - room.worldY) >= 100);
                        if (b) { haz.cutoffBoxId = b.id; haz.isCorridorBeam = true; }
                    } else {
                        // Upper laser in shaft -> upper shaft lightbox
                        const b = roomBoxes.find(bx => (bx.x - room.worldX) >= 300 && (bx.y - room.worldY) < 100);
                        if (b) { haz.cutoffBoxId = b.id; haz.isCorridorBeam = true; }
                    }
                } else if (room.id === 'And_gate_3_above') {
                    const lowerBox = roomBoxes.find(bx => (bx.y - room.worldY) > 150);
                    const upperBox = roomBoxes.find(bx => (bx.y - room.worldY) < 150);
                    if (rx < 150) {
                        // Left wall laser -> lower puzzle on the left
                        if (lowerBox) { haz.cutoffBoxId = lowerBox.id; haz.isCorridorBeam = true; }
                    } else {
                        // Upper walkway laser -> linked with the gate and puzzle above
                        if (upperBox) { haz.cutoffBoxId = upperBox.id; haz.isCorridorBeam = true; }
                    }
                } else if (room.id === 'Level_11') {
                    const lowerBox = roomBoxes.find(bx => (bx.y - room.worldY) > 100);
                    const exitBox = roomBoxes.find(bx => (bx.y - room.worldY) <= 100);
                    if (ry > 100) {
                        if (lowerBox) { haz.cutoffBoxId = lowerBox.id; haz.isCorridorBeam = true; }
                    } else {
                        if (exitBox) { haz.cutoffBoxId = exitBox.id; haz.isCorridorBeam = true; }
                    }
                }

                // If still not matched, pick closest lightbox in room
                if (!haz.cutoffBoxId) {
                    let closest = null;
                    let minDist = Infinity;
                    for (const b of roomBoxes) {
                        const dist = Math.hypot(b.x - haz.x, b.y - haz.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closest = b;
                        }
                    }
                    if (closest) haz.cutoffBoxId = closest.id;
                }
            }
        }
    }

    _resolveDoorControls() {
        if (!this.doors || !this.lightBoxes) return;
        for (const d of this.doors) {
            // Find closest lightbox within 128px (typically placed adjacent at dx: +16, dy: -16)
            let closest = null;
            let minDist = Infinity;
            for (const b of this.lightBoxes) {
                const dist = Math.hypot(b.x - d.x, b.y - d.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = b;
                }
            }
            if (closest && minDist <= 128) {
                d.controlBoxId = closest.id;
            }
        }
    }

    _deduceGatePorts(relGx, relGy, gateType) {
        // Tutorial_And_gate & Tutorial_XOR_gate: gate at rel [17, 2] or [18, 2] -> Inputs: Left, Bottom. Output: Right.
        if ((relGx === 17 || relGx === 18) && (relGy === 2 || relGy === 3)) {
            return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.RIGHT] };
        }
        // Room 3 (And_gate): gate at rel [5, 1] -> Inputs: Left, Bottom. Output: Right.
        if (relGx === 5 && relGy === 1) {
            return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.RIGHT] };
        }
        // Room 4 (And_gate_2): gates at rel [7, 8] and [9, 8] -> Inputs: Left, Top. Output: Right.
        if ((relGx === 7 || relGx === 9) && relGy === 8) {
            return { inPorts: [PORT.LEFT, PORT.TOP], outPorts: [PORT.RIGHT] };
        }
        // Room 5 (And_gate_3): gate at rel [13, 4] -> Inputs: Top, Right. Output: Bottom.
        if (relGx === 13 && relGy === 4) {
            return { inPorts: [PORT.TOP, PORT.RIGHT], outPorts: [PORT.BOTTOM] };
        }
        // Room 6 (And_gate_3_above): XOR gate at rel [6, 6] -> Inputs: Left, Right. Output: Top.
        if (relGx === 6 && relGy === 6) {
            return { inPorts: [PORT.LEFT, PORT.RIGHT], outPorts: [PORT.TOP] };
        }
        // Room 6 (And_gate_3_above): gates at rel [12, 0], [14, 0], [16, 0] -> Inputs: Left, Bottom. Output: Right.
        if ((relGx === 12 || relGx === 14 || relGx === 16) && relGy === 0) {
            return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.RIGHT] };
        }
        // Room 7 (Level_7):
        // (2, 0) XOR: Inputs Left, Bottom. Output Right.
        // (8, 2) AND: Inputs Left, Bottom. Output Right.
        // (8, 4) AND: Inputs Left, Bottom. Output Right.
        // (12, 4) XOR: Inputs Left, Bottom. Output Right.
        // (15, 1) AND: Inputs Left, Bottom. Output Right.
        if ((relGx === 2 && relGy === 0) ||
            (relGx === 8 && relGy === 2) ||
            (relGx === 8 && relGy === 4) ||
            (relGx === 12 && relGy === 4) ||
            (relGx === 15 && relGy === 1)) {
            return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.RIGHT] };
        }
        // (12, 2) AND: Inputs Left, Bottom. Output Top.
        if (relGx === 12 && relGy === 2) {
            return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.TOP] };
        }
        // Room 11 (Level_11):
        if (relGx === 0 && relGy === 3) return { inPorts: [PORT.BOTTOM, PORT.RIGHT], outPorts: [PORT.TOP] };
        if (relGx === 4 && relGy === 1) return { inPorts: [PORT.LEFT, PORT.TOP], outPorts: [PORT.RIGHT] };
        if (relGx === 6 && relGy === 6) return { inPorts: [PORT.LEFT, PORT.TOP], outPorts: [PORT.BOTTOM] };
        if (relGx === 19 && relGy === 8) return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.TOP] };
        if (relGx === 19 && relGy === 6) return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.TOP] };
        if ((relGx === 10 || relGx === 12 || relGx === 14 || relGx === 16) && relGy === 0) {
            return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.RIGHT] };
        }
        if (relGx === 11 && (relGy === 2 || relGy === 4)) {
            return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.RIGHT] };
        }
        if (relGx === 12 && (relGy === 3 || relGy === 5)) {
            return { inPorts: [PORT.RIGHT, PORT.BOTTOM], outPorts: [PORT.LEFT] };
        }
        return { inPorts: [PORT.LEFT, PORT.BOTTOM], outPorts: [PORT.TOP] };
    }
}
