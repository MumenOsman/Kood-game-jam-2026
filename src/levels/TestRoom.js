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
import { DIRECTION } from '../modules/CircuitSystem.js';

export class TestRoom extends Level {
    constructor(eventBus, circuitSystem) {
        super(eventBus);
        this.circuitSystem = circuitSystem;

        this.width = 3700;
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
        // Floor y = 580 (height 120)
        // Ceiling y = 80 (height 60)

        // 1. Ceiling (spanning entire level)
        this.colliders.push({ x: 0, y: 40, width: 3700, height: 60 });

        // 2. Left wall (Spawn chamber)
        this.colliders.push({ x: 0, y: 40, width: 50, height: 660 });

        // 3. Right boundary wall
        this.colliders.push({ x: 3620, y: 40, width: 80, height: 660 });

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

        // Segment 4: Circuit puzzle zone & exit chamber (x: 2400 to 3620)
        this.colliders.push({ x: 2400, y: 580, width: 1220, height: 180 });

        // Ceiling socket fixture mount over swing chasm
        this.colliders.push({ x: 1580, y: 100, width: 40, height: 40 });

        // Ceiling circuit junction mount
        this.colliders.push({ x: 3080, y: 100, width: 40, height: 40 });
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

        // Socket 3: Ceiling Circuit Junction Socket in Zone 5 (x: 3100, y: 170)
        this.sockets.push(
            new Socket('circuit_socket_1', 3100, 170, 'CIRCUIT', {
                circuitNodeId: 'junction_puzzle_1',
                label: 'Circuit Rotator'
            })
        );
    }

    _buildCircuitNetwork() {
        if (!this.circuitSystem) return;

        // 1. Power Source: Ceiling Nuclear Generator line (x: 2750, y: 110)
        this.circuitSystem.addNode({
            id: 'nuclear_gen',
            type: 'SOURCE',
            x: 2750,
            y: 110,
            ports: DIRECTION.EAST, // feeds power to the right
            isRotatable: false,
            neighbors: [
                { nodeId: 'junction_puzzle_1', direction: DIRECTION.EAST }
            ]
        });

        // 2. Rotatable Puzzle Junction (x: 3100, y: 110)
        // Straight line circuit bridge. Initially vertical (NORTH | SOUTH: disconnected from live power).
        // Rotating 90 deg clockwise turns it horizontal (EAST | WEST), connecting Nuclear Gen to Exit Door!
        this.circuitSystem.addNode({
            id: 'junction_puzzle_1',
            type: 'JUNCTION',
            x: 3100,
            y: 110,
            ports: DIRECTION.NORTH | DIRECTION.SOUTH, // Initially vertical (disconnected)
            isRotatable: true,
            rotationAngle: 0,
            neighbors: [
                { nodeId: 'nuclear_gen', direction: DIRECTION.WEST },
                { nodeId: 'door_receiver', direction: DIRECTION.EAST }
            ]
        });

        // 3. Receiver Node: Exit Door (x: 3494, y: 380)
        this.circuitSystem.addNode({
            id: 'door_receiver',
            type: 'RECEIVER',
            x: 3494,
            y: 380,
            deviceId: 'exit_door',
            ports: DIRECTION.WEST, // receives from junction
            isRotatable: false,
            neighbors: [
                { nodeId: 'junction_puzzle_1', direction: DIRECTION.WEST }
            ]
        });

        // Conduits for visual rendering
        // Generator -> Junction
        this.circuitSystem.addConduit({
            id: 'c_gen_junction',
            fromNodeId: 'nuclear_gen',
            toNodeId: 'junction_puzzle_1',
            points: [
                { x: 2750, y: 110 },
                { x: 3100, y: 110 }
            ]
        });

        // Junction -> Door Receiver
        this.circuitSystem.addConduit({
            id: 'c_junction_door',
            fromNodeId: 'junction_puzzle_1',
            toNodeId: 'door_receiver',
            points: [
                { x: 3100, y: 110 },
                { x: 3494, y: 110 },
                { x: 3494, y: 380 }
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
        ctx.fillText('CIRCUIT JUNCTION PUZZLE', 2900, 280);
        ctx.fillText('1. PLUG WIRE INTO CEILING JUNCTION', 2900, 310);
        ctx.fillText('2. PRESS [E] TO ROTATE 90 DEG CLOCKWISE', 2900, 335);
        ctx.fillText('3. ROUTE LIVE POWER TO BLAST DOOR', 2900, 360);

        // Zone 6: Exit
        ctx.fillText('SECURITY BLAST DOOR', 3380, 370);

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

        // 2. Render Exit Blast Door
        this._renderDoor(ctx);

        // 3. Render Sockets
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
