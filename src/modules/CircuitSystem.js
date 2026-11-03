/**
 * CircuitSystem.js
 * Manages background electrical grid nodes, cardinal port connections [Top, Right, Bottom, Left],
 * BFS power propagation from generators, interactive [E] node rotation while plugged in,
 * and device activation (doors/lifts).
 *
 * Visual representation: Circular wall dials with metallic blue housing, internal conduit channels,
 * and glowing, animated amber/orange electrical currents inside powered channels.
 */

export const PORT = {
    TOP: 0,
    RIGHT: 1,
    BOTTOM: 2,
    LEFT: 3
};

export const OPPOSITE_PORT = {
    [PORT.TOP]: PORT.BOTTOM,
    [PORT.RIGHT]: PORT.LEFT,
    [PORT.BOTTOM]: PORT.TOP,
    [PORT.LEFT]: PORT.RIGHT
};

export const NODE_DESIGNS = {
    // 1. Straight Node (I-Pipe): 2 opposite ports active
    STRAIGHT_H: () => [false, true, false, true],  // Horizontal
    STRAIGHT_V: () => [true, false, true, false],  // Vertical

    // 2. Corner Node (L-Bend): 2 adjacent ports active
    CORNER_TL: () => [true, false, false, true],   // Top & Left
    CORNER_TR: () => [true, true, false, false],   // Top & Right
    CORNER_BR: () => [false, true, true, false],   // Bottom & Right
    CORNER_BL: () => [false, false, true, true],   // Bottom & Left

    // 3. Splitter Node (T-Junction): 3 ports active
    SPLITTER_T_UP: () => [true, true, false, true],    // Top, Right, Left
    SPLITTER_T_RIGHT: () => [true, true, true, false], // Top, Right, Bottom
    SPLITTER_T_DOWN: () => [false, true, true, true],  // Right, Bottom, Left
    SPLITTER_T_LEFT: () => [true, false, true, true]   // Top, Bottom, Left
};

export class CircuitSystem {
    constructor(eventBus, inputManager, player) {
        this.name = 'CircuitSystem';
        this.eventBus = eventBus;
        this.input = inputManager;
        this.player = player;

        this.nodes = new Map(); // id -> Node
        this.conduits = [];     // Array of background conduits
        this.pulseTime = 0;

        // Visual dial styling parameters
        this.DIAL_RADIUS = 34;
        this.CHANNEL_HALF_WIDTH = 9;

        this._bindEvents();
    }

    init(engine) {
        this.engine = engine;
        this.recalculatePower();
    }

    _bindEvents() {
        this.eventBus.on('CIRCUIT_CONFIG_LOADED', () => {
            this.recalculatePower();
        });
    }

    /**
     * Add a circuit node to the graph
     * @param {Object} nodeConfig 
     * @param {string} nodeConfig.id Unique node ID
     * @param {string} [nodeConfig.type='JUNCTION'] SOURCE, JUNCTION, RECEIVER
     * @param {number} nodeConfig.x World X coordinate
     * @param {number} nodeConfig.y World Y coordinate
     * @param {boolean[]} [nodeConfig.ports=[false, false, false, false]] [Top, Right, Bottom, Left]
     * @param {boolean} [nodeConfig.isRotatable=true]
     * @param {string} [nodeConfig.deviceId=null]
     * @param {Array<{nodeId: string, portIndex: number}>} [nodeConfig.neighbors=[]]
     * @param {string} [nodeConfig.label='']
     */
    addNode(nodeConfig) {
        const ports = Array.isArray(nodeConfig.ports)
            ? [...nodeConfig.ports]
            : [false, false, false, false];

        const node = {
            id: nodeConfig.id,
            type: nodeConfig.type || 'JUNCTION',
            x: nodeConfig.x,
            y: nodeConfig.y,
            ports: ports,
            isRotatable: nodeConfig.isRotatable !== false,
            rotationAngle: nodeConfig.rotationAngle || 0,
            targetRotationAngle: nodeConfig.rotationAngle || 0,
            isPowered: false,
            wasPowered: false,
            deviceId: nodeConfig.deviceId || null,
            neighbors: nodeConfig.neighbors || [],
            label: nodeConfig.label || '',
            sparks: []
        };

        this.nodes.set(node.id, node);
        return node;
    }

    /**
     * Add a visual conduit path between nodes
     * @param {Object} conduit 
     * @param {string} conduit.id
     * @param {string} conduit.fromNodeId
     * @param {string} conduit.toNodeId
     * @param {Array<{x: number, y: number}>} conduit.points
     */
    addConduit(conduit) {
        this.conduits.push({
            id: conduit.id,
            fromNodeId: conduit.fromNodeId,
            toNodeId: conduit.toNodeId,
            points: conduit.points || [],
            isPowered: false
        });
    }

    update(dt) {
        this.pulseTime += dt * 4;

        // 1. Smooth visual node rotation interpolation
        for (const node of this.nodes.values()) {
            if (node.rotationAngle !== node.targetRotationAngle) {
                const diff = node.targetRotationAngle - node.rotationAngle;
                node.rotationAngle += diff * 0.22;
                if (Math.abs(diff) < 0.005) {
                    node.rotationAngle = node.targetRotationAngle;
                }
            }

            // Update spark particles
            if (node.sparks && node.sparks.length > 0) {
                for (let i = node.sparks.length - 1; i >= 0; i--) {
                    const sp = node.sparks[i];
                    sp.x += sp.vx * dt;
                    sp.y += sp.vy * dt;
                    sp.life -= dt;
                    if (sp.life <= 0) {
                        node.sparks.splice(i, 1);
                    }
                }
            }
        }

        // 2. Check for [E] rotation input while tethered to a circuit socket
        const p = this.player;
        if (this.input.interactPressed && p.isTethered && p.tetherSocket) {
            const sock = p.tetherSocket;
            if (sock.type === 'CIRCUIT' && sock.circuitNodeId) {
                this.rotateNode(sock.circuitNodeId);
            }
        }
    }

    /**
     * Rotate a circuit junction node 90 degrees clockwise
     * Shifts active port array by 1 index: [Top, Right, Bottom, Left] -> [Left, Top, Right, Bottom]
     * @param {string} nodeId 
     */
    rotateNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node || !node.isRotatable) return;

        // Clockwise shift:
        // Left moves to Top, Top moves to Right, Right moves to Bottom, Bottom moves to Left
        const p = node.ports;
        const newPorts = [
            Boolean(p[PORT.LEFT]),
            Boolean(p[PORT.TOP]),
            Boolean(p[PORT.RIGHT]),
            Boolean(p[PORT.BOTTOM])
        ];

        node.ports = newPorts;
        node.targetRotationAngle += Math.PI / 2;

        // Deduct rotation torque energy cost from player
        if (this.player && typeof this.player.drainBattery === 'function') {
            this.player.drainBattery(3.0);
            this.eventBus.emit('BATTERY_CHANGED', this.player.battery);
        }

        // Spawn rotation electrical sparks along metallic dial rim
        this._spawnDialSparks(node, 10);

        // Recalculate global power network
        this.recalculatePower();

        // Emit CIRCUIT_UPDATED event
        this.eventBus.emit('CIRCUIT_UPDATED', {
            nodeId: node.id,
            ports: [...node.ports]
        });
    }

    _spawnDialSparks(node, count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 90;
            node.sparks.push({
                x: Math.cos(angle) * this.DIAL_RADIUS,
                y: Math.sin(angle) * this.DIAL_RADIUS,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.4 ? '#4da6ff' : '#ffaa00',
                life: 0.25 + Math.random() * 0.2
            });
        }
    }

    /**
     * Traces power from Generator nodes through connected background conduits.
     * Power only flows between adjacent nodes if their touching ports are both active.
     */
    recalculatePower() {
        // Reset all powered flags
        for (const node of this.nodes.values()) {
            node.wasPowered = node.isPowered;
            node.isPowered = (node.type === 'SOURCE');
        }

        for (const conduit of this.conduits) {
            conduit.isPowered = false;
        }

        // BFS Queue starting from all active SOURCE nodes
        const queue = [];
        for (const node of this.nodes.values()) {
            if (node.type === 'SOURCE') {
                queue.push(node);
            }
        }

        const visited = new Set();

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current.id)) continue;
            visited.add(current.id);
            current.isPowered = true;

            // Traverse adjacent neighbors
            for (const link of current.neighbors) {
                const neighbor = this.nodes.get(link.nodeId);
                if (!neighbor) continue;

                const currentPortIndex = (link.fromPort !== undefined) ? link.fromPort : link.portIndex;
                const neighborPortIndex = (link.toPort !== undefined) ? link.toPort : OPPOSITE_PORT[currentPortIndex];

                // Rule: Power only flows between adjacent nodes if their touching ports are BOTH active
                const currentHasPort = Boolean(current.ports[currentPortIndex]);
                const neighborHasPort = Boolean(neighbor.ports[neighborPortIndex]);

                if (currentHasPort && neighborHasPort) {
                    neighbor.isPowered = true;
                    if (!visited.has(neighbor.id)) {
                        queue.push(neighbor);
                    }

                    // Mark conduit as powered
                    for (const conduit of this.conduits) {
                        if (
                            (conduit.fromNodeId === current.id && conduit.toNodeId === neighbor.id) ||
                            (conduit.fromNodeId === neighbor.id && conduit.toNodeId === current.id)
                        ) {
                            conduit.isPowered = true;
                        }
                    }
                }
            }
        }

        // Check state transitions for receivers (blast doors, lifts)
        for (const node of this.nodes.values()) {
            if (node.type === 'RECEIVER' && node.deviceId) {
                if (node.isPowered && !node.wasPowered) {
                    this.eventBus.emit('ACTIVATE_DEVICE', node.deviceId);
                } else if (!node.isPowered && node.wasPowered) {
                    this.eventBus.emit('DEACTIVATE_DEVICE', node.deviceId);
                }
            }
        }
    }

    render(ctx) {
        ctx.save();

        // 1. Render background conduits
        for (const conduit of this.conduits) {
            this._renderConduit(ctx, conduit);
        }

        // 2. Render circular wall dials
        for (const node of this.nodes.values()) {
            this._renderDialNode(ctx, node);
        }

        ctx.restore();
    }

    _renderConduit(ctx, conduit) {
        if (!conduit.points || conduit.points.length < 2) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(conduit.points[0].x, conduit.points[0].y);
        for (let i = 1; i < conduit.points.length; i++) {
            ctx.lineTo(conduit.points[i].x, conduit.points[i].y);
        }

        // Metallic blue / dark industrial casing
        ctx.strokeStyle = '#152433';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.strokeStyle = '#2b587a';
        ctx.lineWidth = 10;
        ctx.stroke();

        if (conduit.isPowered) {
            // Powered conduit: glowing amber/orange electrical core
            ctx.strokeStyle = '#ff9900';
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.strokeStyle = '#ffea70';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Animated traveling energy pulses
            ctx.setLineDash([10, 22]);
            ctx.lineDashOffset = -this.pulseTime * 18;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Unpowered conduit: dark charcoal
            ctx.strokeStyle = '#0e151d';
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.restore();
    }

    _renderDialNode(ctx, node) {
        ctx.save();
        ctx.translate(node.x, node.y);

        const radius = this.DIAL_RADIUS;
        const halfWidth = this.CHANNEL_HALF_WIDTH;

        // 1. Base Circular Dial Plate
        ctx.fillStyle = '#0a1017';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Double Concentric Outer Ring in Metallic Blue
        ctx.strokeStyle = '#204a6e';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.strokeStyle = '#4da6ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius - 2.5, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Clip internal conduit channels to the circular dial
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, radius - 3.5, 0, Math.PI * 2);
        ctx.clip();

        // Rotate for smooth visual dial rotation
        ctx.rotate(node.rotationAngle);

        // Compute active ports relative to the dial's base rotation
        // Because the canvas is rotated by node.rotationAngle, we draw the channels in their current ports orientation
        // To avoid double-rotating, we draw the canonical channels matching node.ports when unrotated,
        // or apply smooth visual delta. Here node.targetRotationAngle advances by PI/2, and node.ports shifts.
        // We can draw based on the current logical node.ports, and apply the smooth fractional delta:
        const angleDelta = node.rotationAngle - node.targetRotationAngle;
        ctx.rotate(angleDelta);

        // Draw Conduit Channels for active ports
        this._renderDialChannels(ctx, node.ports, node.isPowered, radius, halfWidth);

        ctx.restore(); // Exit clip & rotation

        // 4. Center Wire Plug Socket
        this._renderCenterSocket(ctx, node);

        // 5. Dial Rotation Sparks
        if (node.sparks && node.sparks.length > 0) {
            for (const sp of node.sparks) {
                ctx.fillStyle = sp.color;
                ctx.fillRect(sp.x - 1.5, sp.y - 1.5, 3, 3);
            }
        }

        ctx.restore();
    }

    _renderDialChannels(ctx, ports, isPowered, radius, h) {
        const R = radius + 2;

        // 1. Fill Channel Interiors
        // Draw branches for all active ports meeting at the center hub
        ctx.fillStyle = isPowered ? 'rgba(255, 140, 0, 0.25)' : '#0d131a';

        ctx.beginPath();
        // Center hub
        ctx.rect(-h, -h, h * 2, h * 2);

        // Port 0: Top
        if (ports[PORT.TOP]) {
            ctx.rect(-h, -R, h * 2, R);
        }
        // Port 1: Right
        if (ports[PORT.RIGHT]) {
            ctx.rect(0, -h, R, h * 2);
        }
        // Port 2: Bottom
        if (ports[PORT.BOTTOM]) {
            ctx.rect(-h, 0, h * 2, R);
        }
        // Port 3: Left
        if (ports[PORT.LEFT]) {
            ctx.rect(-R, -h, R, h * 2);
        }
        ctx.fill();

        // 2. Channel Borders in Metallic Blue
        ctx.strokeStyle = '#3ca0ff';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'square';

        // Check each of the 4 quadrants between adjacent ports
        // Quadrant 0: Top (0) to Right (1)
        this._drawQuadrantBorder(ctx, ports[PORT.TOP], ports[PORT.RIGHT], 0, -1, 1, 0, R, h);
        // Quadrant 1: Right (1) to Bottom (2)
        this._drawQuadrantBorder(ctx, ports[PORT.RIGHT], ports[PORT.BOTTOM], 1, 0, 0, 1, R, h);
        // Quadrant 2: Bottom (2) to Left (3)
        this._drawQuadrantBorder(ctx, ports[PORT.BOTTOM], ports[PORT.LEFT], 0, 1, -1, 0, R, h);
        // Quadrant 3: Left (3) to Top (0)
        this._drawQuadrantBorder(ctx, ports[PORT.LEFT], ports[PORT.TOP], -1, 0, 0, -1, R, h);

        // 3. Glowing Animated Amber/Orange Electrical Current inside Powered Channels
        if (isPowered) {
            this._renderElectricalCurrent(ctx, ports, R);
        }
    }

    _drawQuadrantBorder(ctx, portA, portB, ux, uy, vx, vy, R, h) {
        // u = direction of port A, v = direction of port B
        if (portA && portB) {
            // Both active: Inner 90-degree corner
            ctx.beginPath();
            ctx.moveTo(ux * R + vx * h, uy * R + vy * h);
            ctx.lineTo(ux * h + vx * h, uy * h + vy * h);
            ctx.lineTo(ux * h + vx * R, uy * h + vy * R);
            ctx.stroke();
        } else if (portA && !portB) {
            // Port A active, Port B inactive: border line extends along A
            ctx.beginPath();
            ctx.moveTo(ux * R + vx * h, uy * R + vy * h);
            ctx.lineTo(-ux * h + vx * h, -uy * h + vy * h);
            ctx.stroke();
        } else if (!portA && portB) {
            // Port A inactive, Port B active: border line extends along B
            ctx.beginPath();
            ctx.moveTo(ux * h + vx * R, uy * h + vy * R);
            ctx.lineTo(ux * h - vx * h, uy * h - vy * h);
            ctx.stroke();
        }
    }

    _renderElectricalCurrent(ctx, ports, R) {
        ctx.save();

        const dirs = [
            { x: 0, y: -1 }, // Top
            { x: 1, y: 0 },  // Right
            { x: 0, y: 1 },  // Bottom
            { x: -1, y: 0 }  // Left
        ];

        // Draw animated wavy plasma path for each active port branch
        for (let i = 0; i < 4; i++) {
            if (!ports[i]) continue;

            const dir = dirs[i];
            const perpX = -dir.y;
            const perpY = dir.x;

            const steps = 14;
            const stepLen = R / steps;

            // Outer amber glow wave
            ctx.strokeStyle = '#ff9900';
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(0, 0);

            for (let s = 1; s <= steps; s++) {
                const dist = s * stepLen;
                const wave = Math.sin(dist * 0.45 - this.pulseTime * 10) * 3.2
                           + Math.cos(dist * 0.85 + this.pulseTime * 14) * 1.4;
                const px = dir.x * dist + perpX * wave;
                const py = dir.y * dist + perpY * wave;
                ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Inner hot yellow core
            ctx.strokeStyle = '#fff099';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);

            for (let s = 1; s <= steps; s++) {
                const dist = s * stepLen;
                const wave = Math.sin(dist * 0.45 - this.pulseTime * 10) * 3.2
                           + Math.cos(dist * 0.85 + this.pulseTime * 14) * 1.4;
                const px = dir.x * dist + perpX * wave;
                const py = dir.y * dist + perpY * wave;
                ctx.lineTo(px, py);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    _renderCenterSocket(ctx, node) {
        // Metallic blue center socket housing
        ctx.fillStyle = '#111923';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#3ca0ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner plug port core
        const isPlugged = (this.player.isTethered &&
                           this.player.tetherSocket &&
                           this.player.tetherSocket.circuitNodeId === node.id);

        ctx.fillStyle = isPlugged ? '#ffaa00' : '#080d14';
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Center contact pin
        ctx.fillStyle = isPlugged ? '#ffffff' : '#4da6ff';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}
