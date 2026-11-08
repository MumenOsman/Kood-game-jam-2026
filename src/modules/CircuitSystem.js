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
    constructor(eventBus, inputManager, player, options = {}) {
        this.name = 'CircuitSystem';
        this.eventBus = eventBus;
        this.input = inputManager;
        this.player = player;
        this.assetLoader = options.assetLoader || null;

        this.nodes = new Map(); // id -> Node
        this.conduits = [];     // Array of background conduits
        this.pulseTime = 0;

        // Visual dial styling parameters (strictly 32px grid tiles)
        this.DIAL_RADIUS = 16;
        this.CHANNEL_HALF_WIDTH = 6;

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
            label: nodeConfig.label || ''
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
        }

        // 2. Check for [E] rotation input while tethered to a circuit socket or standing adjacent
        const p = this.player;
        if (this.input.interactPressed && p) {
            if (p.isTethered && p.tetherSocket) {
                const sock = p.tetherSocket;
                if (sock.type === 'CIRCUIT' && sock.circuitNodeId) {
                    this.rotateNode(sock.circuitNodeId);
                }
            } else {
                // If player is standing close to a circuit dial, allow rotating directly
                const px = p.x + p.width / 2;
                const py = p.y + p.height / 2;
                let closest = null;
                let minDist = 42;
                for (const node of this.nodes.values()) {
                    const dist = Math.hypot(node.x - px, node.y - py);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = node;
                    }
                }
                if (closest) {
                    this.rotateNode(closest.id);
                }
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

        // Recalculate global power network
        this.recalculatePower();

        // Emit CIRCUIT_UPDATED event
        this.eventBus.emit('CIRCUIT_UPDATED', {
            nodeId: node.id,
            ports: [...node.ports]
        });
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

    render(ctx, camera = null) {
        ctx.save();

        // 1. Render background conduits
        for (const conduit of this.conduits) {
            if (camera && typeof camera.isVisible === 'function' && conduit.points && conduit.points.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (let i = 0; i < conduit.points.length; i++) {
                    const pt = conduit.points[i];
                    if (pt.x < minX) minX = pt.x;
                    if (pt.x > maxX) maxX = pt.x;
                    if (pt.y < minY) minY = pt.y;
                    if (pt.y > maxY) maxY = pt.y;
                }
                if (!camera.isVisible(minX, minY, Math.max(32, maxX - minX), Math.max(32, maxY - minY), 32)) {
                    continue;
                }
            }
            this._renderConduit(ctx, conduit);
        }

        // 2. Render circular wall dials
        for (const node of this.nodes.values()) {
            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(node.x - 16, node.y - 16, 32, 32, 32)) {
                continue;
            }
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
        ctx.translate(Math.round(node.x), Math.round(node.y));

        const sheet = this.assetLoader ? this.assetLoader.getImage('circuits_sheet') : null;

        if (sheet) {
            // Determine design column in Circuits(4).png:
            // Col 0 = CROSS, Col 1 = T_SHAPE, Col 2 = CORNER, Col 3 = STRAIGHT
            // Row 1 (y = 32) when unpowered, Row 0 (y = 0) when powered
            let col = 1;
            let sy = node.isPowered ? 0 : 32;

            if (node.design === 'CROSS') col = 0;
            else if (node.design === 'T_SHAPE') col = 1;
            else if (node.design === 'CORNER') col = 2;
            else if (node.design === 'STRAIGHT') col = 3;
            else if (node.type === 'SOURCE' || node.design === 'Source') {
                col = 0;
                sy = 160;
            } else {
                // Determine from active ports
                const count = node.ports.filter(Boolean).length;
                if (count === 4) col = 0;
                else if (count === 3) col = 1;
                else if (count === 2) {
                    col = (node.ports[0] === node.ports[2]) ? 3 : 2;
                } else col = 1;
            }

            const sx = col * 32;

            ctx.save();
            ctx.imageSmoothingEnabled = false; // Authentic pixel art crispness
            // Smoothly rotate the 32x32 sprite around its center
            ctx.rotate(node.rotationAngle);
            ctx.drawImage(sheet, sx, sy, 32, 32, -16, -16, 32, 32);
            ctx.restore();

            // Center plug socket contact
            this._renderCenterSocket(ctx, node);
        } else {
            // Minimalist fallback
            ctx.fillStyle = node.isPowered ? '#ffaa00' : '#204a6e';
            ctx.fillRect(-16, -16, 32, 32);
        }

        ctx.restore();
    }

    _renderCenterSocket(ctx, node) {
        const isPlugged = (this.player &&
                           this.player.isTethered &&
                           this.player.tetherSocket &&
                           this.player.tetherSocket.circuitNodeId === node.id);

        if (isPlugged) {
            ctx.fillStyle = '#fffa65';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#111923';
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3ca0ff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}
