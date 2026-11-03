/**
 * TestRoom.js
 * Implementation of the tutorial level from "Initial-level-game-mechanics-test.png":
 * - Zone 1: Spawn chamber room (A/D walk, Shift run, S dock/rest)
 * - Zone 2: Jumping gap
 * - Zone 3: Wide swing chasm with ceiling socket (LMB aim & throw, Space mid-air tether jump, RMB cut)
 * - Zone 4: Self-recharge station (CHARGER socket + battery charge)
 * - Zone 5: Nuclear power line & ceiling circuit junction (E to rotate circuit)
 * - Zone 6: Heavy blast door opening when power arrives
 */
import { Level } from './Level.js';
import { Socket } from '../entities/Socket.js';
import { PORT, NODE_DESIGNS } from '../modules/CircuitSystem.js';

export class TestRoom extends Level {
    constructor(eventBus, circuitSystem) {
        super(eventBus);
        this.circuitSystem = circuitSystem;

        this.width = 5100;
        this.height = 760;
        this.spawnPoint = { x: 120, y: 480 };

        // Exit door state
        this.door = {
            id: 'exit_door',
            x: 3480,
            y: 400,
            width: 28,
            height: 180,
            isOpen: false,
            openProgress: 0 // 0 = closed, 1 = fully open
        };
        this.devices.set(this.door.id, this.door);

        this._buildGeometry();
        this._buildSockets();
        this._buildCircuitNetwork();
        this._bindEvents();
    }

    _bindEvents() {
        this.eventBus.on('ACTIVATE_DEVICE', (deviceId) => {
            if (deviceId === 'exit_door') {
                this.door.isOpen = true;
            }
        });

        this.eventBus.on('DEACTIVATE_DEVICE', (deviceId) => {
            if (deviceId === 'exit_door') {
                this.door.isOpen = false;
            }
        });
    }

    _buildGeometry() {
        // 1. Ceiling (spanning entire facility)
        this.colliders.push({ x: 0, y: 40, width: 5100, height: 60 });

        // 2. Left wall (Spawn chamber)
        this.colliders.push({ x: 0, y: 40, width: 50, height: 660 });

        // 3. Right boundary wall at end of Upper Sector
        this.colliders.push({ x: 5020, y: 40, width: 80, height: 660 });

        // 4. Floor Segments:
        // Segment 1: Spawn chamber & tutorial corridor (x: 40 to 860)
        this.colliders.push({ x: 40, y: 580, width: 820, height: 180 });

        // Starter chamber storage boxes (x: 180 to 320)
        this.colliders.push({ x: 220, y: 520, width: 60, height: 60 });
        this.colliders.push({ x: 280, y: 460, width: 60, height: 120 });

        // GAP 1 (Jump Gap): x: 860 to 1060 (width 200px)

        // Segment 2: Intermediate island (x: 1060 to 1340)
        this.colliders.push({ x: 1060, y: 580, width: 280, height: 180 });

        // GAP 2 (Swing Chasm): x: 1340 to 1860 (width 520px)

        // Segment 3: Charger platform (x: 1860 to 2400)
        this.colliders.push({ x: 1860, y: 580, width: 540, height: 180 });

        // Small alcove wall near charger
        this.colliders.push({ x: 2280, y: 580, width: 40, height: 180 });

        // Segment 4: Circuit puzzle zone, blast door exit & Chamber 02 floor (x: 2400 to 4340)
        this.colliders.push({ x: 2400, y: 580, width: 1940, height: 180 });

        // Elevated platforms in circuit puzzle corridor for easy dial access
        this.colliders.push({ x: 2710, y: 480, width: 80, height: 100 });  // Under Splitter
        this.colliders.push({ x: 2980, y: 440, width: 140, height: 140 }); // Under Corner

        // Ceiling socket fixture mount over swing chasm
        this.colliders.push({ x: 1580, y: 100, width: 40, height: 40 });

        // 5. Chamber 02 & Vertical Shaft Geometry (From media_1793727603625_21c05ec9.png):
        // Chamber 02 intermediate ceiling
        this.colliders.push({ x: 3508, y: 140, width: 642, height: 30 });

        // Shaft Left Wall: Electrified by default, de-electrified via circuit cutoff dial
        this.addHazardObject({
            x: 4150,
            y: 140,
            width: 30,
            height: 440,
            isWallRunnable: true,
            wallRunFace: 'right',
            isElectrified: true,
            electrifiedFace: 'right',
            deviceId: 'shaft_left_wall',
            shockDamage: 8.0,
            knockbackForce: 360
        });

        // Shaft Right Wall: Wall-runnable grip surface
        this.addWallRunWall({
            x: 4340,
            y: 260,
            width: 30,
            height: 320,
            wallRunFace: 'left'
        });

        // Upper Floor Platform extending rightward from the top of the right wall
        this.colliders.push({ x: 4340, y: 260, width: 700, height: 50 });
    }

    _buildSockets() {
        // Socket 1: Ceiling Swing Anchor (over the wide chasm at x: 1600, y: 150)
        this.sockets.push(
            new Socket('swing_anchor_1', 1600, 150, 'ANCHOR', {
                label: 'Swing Tether'
            })
        );

        // Socket 2: Wall Charger Socket in Zone 4 (x: 2150, y: 460)
        this.sockets.push(
            new Socket('charge_socket_1', 2150, 460, 'CHARGER', {
                label: 'Recharge Station'
            })
        );

        // Socket 3: Splitter Node Dial Center Socket (x: 2750, y: 240)
        this.sockets.push(
            new Socket('socket_splitter', 2750, 240, 'CIRCUIT', {
                circuitNodeId: 'junction_splitter',
                label: 'Splitter T-Junction'
            })
        );

        // Socket 4: Corner Node Dial Center Socket (x: 3050, y: 240)
        this.sockets.push(
            new Socket('socket_corner', 3050, 240, 'CIRCUIT', {
                circuitNodeId: 'junction_corner',
                label: 'Corner L-Bend'
            })
        );

        // Socket 5: Straight Node Dial Center Socket (x: 3280, y: 420)
        this.sockets.push(
            new Socket('socket_straight', 3280, 420, 'CIRCUIT', {
                circuitNodeId: 'junction_straight',
                label: 'Straight I-Pipe'
            })
        );

        // Socket 6: Chamber 02 Wall Power Cutoff Dial (x: 4020, y: 380)
        this.sockets.push(
            new Socket('socket_wall_cutoff', 4020, 380, 'CIRCUIT', {
                circuitNodeId: 'dial_wall_cutoff',
                label: 'Wall Power Cutoff'
            })
        );
    }

    _buildCircuitNetwork() {
        if (!this.circuitSystem) return;

        // 1. Power Source: Nuclear Generator Line (x: 2550, y: 240)
        this.circuitSystem.addNode({
            id: 'nuclear_gen',
            type: 'SOURCE',
            x: 2550,
            y: 240,
            ports: [false, true, false, false], // Sends power to the Right
            isRotatable: false,
            neighbors: [
                { nodeId: 'junction_splitter', fromPort: PORT.RIGHT, toPort: PORT.LEFT }
            ]
        });

        // 2. Splitter Node (T-Junction): 3 ports active (Right, Bottom, Left)
        this.circuitSystem.addNode({
            id: 'junction_splitter',
            type: 'JUNCTION',
            x: 2750,
            y: 240,
            ports: NODE_DESIGNS.SPLITTER_T_DOWN(), // [false, true, true, true]
            isRotatable: true,
            neighbors: [
                { nodeId: 'nuclear_gen', fromPort: PORT.LEFT, toPort: PORT.RIGHT },
                { nodeId: 'junction_corner', fromPort: PORT.RIGHT, toPort: PORT.LEFT }
            ]
        });

        // 3. Corner Node (L-Bend): 2 adjacent ports active (initially Top & Left, needs Left & Bottom)
        this.circuitSystem.addNode({
            id: 'junction_corner',
            type: 'JUNCTION',
            x: 3050,
            y: 240,
            ports: NODE_DESIGNS.CORNER_TL(), // [true, false, false, true] - Misaligned initially!
            isRotatable: true,
            neighbors: [
                { nodeId: 'junction_splitter', fromPort: PORT.LEFT, toPort: PORT.RIGHT },
                { nodeId: 'junction_straight', fromPort: PORT.BOTTOM, toPort: PORT.LEFT }
            ]
        });

        // 4. Straight Node (I-Pipe): 2 opposite ports active (initially Vertical, needs Horizontal)
        this.circuitSystem.addNode({
            id: 'junction_straight',
            type: 'JUNCTION',
            x: 3280,
            y: 420,
            ports: NODE_DESIGNS.STRAIGHT_V(), // [true, false, true, false] - Misaligned initially!
            isRotatable: true,
            neighbors: [
                { nodeId: 'junction_corner', fromPort: PORT.LEFT, toPort: PORT.BOTTOM },
                { nodeId: 'door_receiver', fromPort: PORT.RIGHT, toPort: PORT.LEFT }
            ]
        });

        // 5. Receiver Node: Blast Door (x: 3480, y: 420)
        this.circuitSystem.addNode({
            id: 'door_receiver',
            type: 'RECEIVER',
            x: 3480,
            y: 420,
            deviceId: 'exit_door',
            ports: [false, false, false, true], // Receives power from Left
            isRotatable: false,
            neighbors: [
                { nodeId: 'junction_straight', fromPort: PORT.LEFT, toPort: PORT.RIGHT }
            ]
        });

        // Visual Background Conduits (terminated cleanly at dial outer rims radius 34px)
        // Generator -> Splitter
        this.circuitSystem.addConduit({
            id: 'c_gen_splitter',
            fromNodeId: 'nuclear_gen',
            toNodeId: 'junction_splitter',
            points: [
                { x: 2550 + 34, y: 240 },
                { x: 2750 - 34, y: 240 }
            ]
        });

        // Splitter -> Corner
        this.circuitSystem.addConduit({
            id: 'c_splitter_corner',
            fromNodeId: 'junction_splitter',
            toNodeId: 'junction_corner',
            points: [
                { x: 2750 + 34, y: 240 },
                { x: 3050 - 34, y: 240 }
            ]
        });

        // Corner -> Straight (routes down from corner bottom rim and connects to straight left rim)
        this.circuitSystem.addConduit({
            id: 'c_corner_straight',
            fromNodeId: 'junction_corner',
            toNodeId: 'junction_straight',
            points: [
                { x: 3050, y: 240 + 34 },
                { x: 3050, y: 420 },
                { x: 3280 - 34, y: 420 }
            ]
        });

        // Straight -> Door Receiver (routes from straight right rim to door frame)
        this.circuitSystem.addConduit({
            id: 'c_straight_door',
            fromNodeId: 'junction_straight',
            toNodeId: 'door_receiver',
            points: [
                { x: 3280 + 34, y: 420 },
                { x: 3480 - 10, y: 420 }
            ]
        });

        // 6. Chamber 02: Wall Power Feed & Cutoff Network (From media_1793727603625_21c05ec9.png)
        // Substation Power Source in Chamber 02
        this.circuitSystem.addNode({
            id: 'substation_power',
            type: 'SOURCE',
            x: 3820,
            y: 380,
            ports: [false, true, false, false], // Sends power to the Right
            isRotatable: false,
            neighbors: [
                { nodeId: 'dial_wall_cutoff', fromPort: PORT.RIGHT, toPort: PORT.LEFT }
            ]
        });

        // Wall Cutoff Dial: Straight I-Pipe initially aligned Horizontal (power flows to left wall!)
        // Rotating 90 deg clockwise to Vertical cuts power to the left wall
        this.circuitSystem.addNode({
            id: 'dial_wall_cutoff',
            type: 'JUNCTION',
            x: 4020,
            y: 380,
            ports: NODE_DESIGNS.STRAIGHT_H(), // [false, true, false, true] - Initially CONNECTED!
            isRotatable: true,
            neighbors: [
                { nodeId: 'substation_power', fromPort: PORT.LEFT, toPort: PORT.RIGHT },
                { nodeId: 'receiver_wall_power', fromPort: PORT.RIGHT, toPort: PORT.LEFT }
            ]
        });

        // Receiver: Shaft Left Electrified Wall
        this.circuitSystem.addNode({
            id: 'receiver_wall_power',
            type: 'RECEIVER',
            x: 4150,
            y: 380,
            deviceId: 'shaft_left_wall',
            ports: [false, false, false, true], // Receives power from Left
            isRotatable: false,
            neighbors: [
                { nodeId: 'dial_wall_cutoff', fromPort: PORT.LEFT, toPort: PORT.RIGHT }
            ]
        });

        // Substation -> Wall Cutoff Dial Conduit
        this.circuitSystem.addConduit({
            id: 'c_sub_cutoff',
            fromNodeId: 'substation_power',
            toNodeId: 'dial_wall_cutoff',
            points: [
                { x: 3820 + 34, y: 380 },
                { x: 4020 - 34, y: 380 }
            ]
        });

        // Wall Cutoff Dial -> Shaft Left Wall Conduit
        this.circuitSystem.addConduit({
            id: 'c_cutoff_wall',
            fromNodeId: 'dial_wall_cutoff',
            toNodeId: 'receiver_wall_power',
            points: [
                { x: 4020 + 34, y: 380 },
                { x: 4150 - 2, y: 380 }
            ]
        });
    }

    update(dt) {
        super.update(dt);

        // Smooth door opening/closing animation
        if (this.door.isOpen && this.door.openProgress < 1) {
            this.door.openProgress = Math.min(1, this.door.openProgress + dt * 1.5);
        } else if (!this.door.isOpen && this.door.openProgress > 0) {
            this.door.openProgress = Math.max(0, this.door.openProgress - dt * 2.0);
        }
    }

    getSolidColliders() {
        const list = [...this.colliders];
        // If door is closed or partially open, add remaining closed portion as solid collider
        if (this.door.openProgress < 0.85) {
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

    renderBackground(ctx) {
        // Deep industrial facility background
        ctx.fillStyle = '#0f1318';
        ctx.fillRect(0, 0, this.width, this.height);

        // Facility wall panels & structural beams
        ctx.strokeStyle = '#181e26';
        ctx.lineWidth = 2;
        for (let x = 100; x < this.width; x += 160) {
            ctx.beginPath();
            ctx.moveTo(x, 100);
            ctx.lineTo(x, 580);
            ctx.stroke();
        }

        for (let y = 180; y <= 500; y += 120) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Nuclear Power Generator sign & overhead glow line
        ctx.fillStyle = 'rgba(255, 200, 0, 0.08)';
        ctx.fillRect(2600, 40, 500, 100);

        ctx.fillStyle = '#ffb700';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('NUCLEAR POWER LINE [HIGH VOLTAGE]', 2660, 85);

        // Tutorial Wall Graffiti / Signs
        this._renderTutorialSigns(ctx);

        // Render Pit Depth Hazards
        ctx.fillStyle = '#07090c';
        // Gap 1 pit
        ctx.fillRect(860, 580, 200, 200);
        // Gap 2 swing pit
        ctx.fillRect(1340, 580, 520, 200);

        // Hazard stripes on ledges
        this._renderHazardStripes(ctx, 840, 580, 20);
        this._renderHazardStripes(ctx, 1060, 580, 20);
        this._renderHazardStripes(ctx, 1320, 580, 20);
        this._renderHazardStripes(ctx, 1860, 580, 20);
    }

    _renderTutorialSigns(ctx) {
        ctx.save();
        ctx.fillStyle = 'rgba(180, 200, 220, 0.65)';
        ctx.font = '13px monospace';

        // Zone 1: Spawn
        ctx.fillText('CHAMBER 01 - SYSTEM DIAGNOSTICS', 100, 240);
        ctx.fillText('[A] / [D] : WALK', 100, 275);
        ctx.fillText('[SHIFT]   : RUN', 100, 300);
        ctx.fillText('[S]       : DOCK / REST', 100, 325);

        // Zone 2: Jump
        ctx.fillText('CHASM TRANSIT', 900, 300);
        ctx.fillText('[SPACE] : JUMP', 900, 330);

        // Zone 3: Wire Swing
        ctx.fillText('SECTOR 02: PENDULUM SWING', 1420, 250);
        ctx.fillText('1. HOLD [LMB] TO AIM & SPIN PLUG', 1420, 280);
        ctx.fillText('2. RELEASE [LMB] TO LAUNCH WIRE', 1420, 305);
        ctx.fillText('3. [W] / [S] REEL IN / OUT', 1420, 330);
        ctx.fillText('4. [SPACE] MID-AIR TETHER JUMP', 1420, 355);
        ctx.fillText('5. [RMB] CUT WIRE', 1420, 380);

        // Zone 4: Charger
        ctx.fillText('FAST CHARGE ALCOVE', 2040, 360);
        ctx.fillText('CONNECT WIRE & HOLD [S] TO RECHARGE', 2040, 390);

        // Zone 5: Circuit Puzzle
        ctx.fillText('CIRCUIT JUNCTION DIALS [PLUG IN & PRESS E TO ROTATE]', 2650, 160);
        ctx.fillText('DIAL 1: T-JUNCTION (SPLITTER) - 3 ACTIVE PORTS', 2650, 185);
        ctx.fillText('DIAL 2: L-BEND (CORNER) - 90 DEG ANGLE', 2650, 205);
        ctx.fillText('DIAL 3: I-PIPE (STRAIGHT) - PASS-THROUGH', 2650, 225);
        ctx.fillText('POWER FLOWS ONLY WHEN TOUCHING PORTS ARE BOTH ACTIVE', 2650, 395);

        // Zone 6: Exit
        ctx.fillText('SECURITY BLAST DOOR', 3380, 370);

        // Zone 7: Chamber 02 & Vertical Ascent Shaft (From media_1793727603625_21c05ec9.png)
        ctx.fillText('CHAMBER 02 - VERTICAL SHAFT ACCESS', 3620, 240);
        ctx.fillText('WALL POWER CUTOFF DIAL: ROTATE [E] TO DE-ENERGIZE LEFT WALL', 3620, 275);
        ctx.fillText('WALL RUN: HOLD [A] / [D] AGAINST WALL TO SLIDE', 3620, 305);
        ctx.fillText('WALL JUMP: PRESS [SPACE] WHILE SLIDING TO LEAP ACROSS SHAFT', 3620, 330);

        // Shaft labels
        ctx.fillStyle = '#ff4081';
        ctx.fillText('HIGH VOLTAGE HAZARD', 4160, 130);
        ctx.fillStyle = '#4da6ff';
        ctx.fillText('UPPER SECTOR 02 REACHED', 4420, 200);

        ctx.restore();
    }

    _renderHazardStripes(ctx, x, y, width) {
        ctx.save();
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(x, y, width, 8);
        ctx.fillStyle = '#111';
        for (let i = 0; i < width; i += 6) {
            ctx.fillRect(x + i, y, 3, 8);
        }
        ctx.restore();
    }

    renderForeground(ctx) {
        // 1. Render Solid Platforms
        ctx.save();
        ctx.fillStyle = '#1c222b';
        ctx.strokeStyle = '#323b49';
        ctx.lineWidth = 2;

        for (const col of this.colliders) {
            ctx.fillRect(col.x, col.y, col.width, col.height);
            ctx.strokeRect(col.x, col.y, col.width, col.height);

            // Metal floor surface highlight
            if (col.y === 580) {
                ctx.fillStyle = '#444f62';
                ctx.fillRect(col.x, col.y, col.width, 3);
                ctx.fillStyle = '#1c222b';
            }
        }

        // 2. Render Wall Run tactile grip strips
        this.renderWallRunGripStrips(ctx);

        // 3. Render Exit Blast Door
        this._renderDoor(ctx);

        // 4. Render Sockets
        for (const sock of this.sockets) {
            sock.render(ctx);
        }

        ctx.restore();
    }

    _renderDoor(ctx) {
        const d = this.door;
        const currentY = d.y - d.height * d.openProgress;
        const visibleHeight = d.height * (1 - d.openProgress);

        ctx.save();
        // Door Frame
        ctx.fillStyle = '#14181f';
        ctx.fillRect(d.x - 4, d.y - 10, d.width + 8, d.height + 10);
        ctx.strokeStyle = '#2e3745';
        ctx.strokeRect(d.x - 4, d.y - 10, d.width + 8, d.height + 10);

        // Sliding Heavy Door Panel
        if (visibleHeight > 2) {
            ctx.fillStyle = '#3a4454';
            ctx.fillRect(d.x, currentY, d.width, d.height);

            // Door security seams & stripes
            ctx.fillStyle = '#222933';
            ctx.fillRect(d.x + 4, currentY + 10, d.width - 8, d.height - 20);

            // Hazard stripe across middle
            ctx.fillStyle = d.isOpen ? '#00ffaa' : '#ff3344';
            ctx.fillRect(d.x + 6, currentY + d.height / 2 - 4, d.width - 12, 8);
        }

        // Door Status Indicator Lamp
        ctx.fillStyle = d.isOpen ? '#00ffaa' : '#ff3344';
        ctx.beginPath();
        ctx.arc(d.x + d.width / 2, d.y - 18, 5, 0, Math.PI * 2);
        ctx.fill();

        // Door status text
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = d.isOpen ? '#00ffaa' : '#ff3344';
        ctx.fillText(d.isOpen ? 'ONLINE / OPEN' : 'LOCKED - NO POWER', d.x - 45, d.y - 28);

        ctx.restore();
    }
}
