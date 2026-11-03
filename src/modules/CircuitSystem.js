/**
 * CircuitSystem.js
 * Manages background electrical grid nodes, directional bitmask port connections,
 * BFS power propagation from generators, interactive [E] node rotation while plugged in,
 * and device activation (doors/lifts).
 */

export const DIRECTION = {
    NORTH: 1, // 0001
    EAST:  2, // 0010
    SOUTH: 4, // 0100
    WEST:  8  // 1000
};

export const OPPOSITE_DIRECTION = {
    [DIRECTION.NORTH]: DIRECTION.SOUTH,
    [DIRECTION.EAST]:  DIRECTION.WEST,
    [DIRECTION.SOUTH]: DIRECTION.NORTH,
    [DIRECTION.WEST]:  DIRECTION.EAST
};

export class CircuitSystem {
    constructor(eventBus, inputManager, player) {
        this.name = 'CircuitSystem';
        this.eventBus = eventBus;
        this.input = inputManager;
        this.player = player;

        this.nodes = new Map(); // id -> Node
        this.conduits = [];     // Array of line connections between nodes or visual paths
        this.pulseTime = 0;

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
     */
    addNode(nodeConfig) {
        const node = {
            id: nodeConfig.id,
            type: nodeConfig.type || 'JUNCTION', // SOURCE, JUNCTION, RECEIVER
            x: nodeConfig.x,
            y: nodeConfig.y,
            ports: nodeConfig.ports || 0, // bitmask of DIRECTION
            isRotatable: nodeConfig.isRotatable !== false,
            rotationAngle: nodeConfig.rotationAngle || 0, // visual rotation in radians
            targetRotationAngle: nodeConfig.rotationAngle || 0,
            isPowered: false,
            deviceId: nodeConfig.deviceId || null,
            neighbors: nodeConfig.neighbors || [], // array of { nodeId, direction }
            label: nodeConfig.label || ''
        };

        this.nodes.set(node.id, node);
        return node;
    }

    /**
     * Add a visual conduit path between two points or nodes
     */
    addConduit(conduit) {
        this.conduits.push({
            id: conduit.id,
            fromNodeId: conduit.fromNodeId,
            toNodeId: conduit.toNodeId,
            points: conduit.points || [], // [{x, y}, ...]
            isPowered: false
        });
    }

    update(dt) {
        this.pulseTime += dt * 4;

        // 1. Smooth visual node rotation interpolation
        for (const node of this.nodes.values()) {
            if (node.rotationAngle !== node.targetRotationAngle) {
                node.rotationAngle += (node.targetRotationAngle - node.rotationAngle) * 0.2;
                if (Math.abs(node.targetRotationAngle - node.rotationAngle) < 0.01) {
                    node.rotationAngle = node.targetRotationAngle;
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
     * @param {string} nodeId 
     */
    rotateNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node || !node.isRotatable) return;

        // Bit-shift rotation: N->E, E->S, S->W, W->N
        const oldPorts = node.ports;
        let newPorts = 0;
        if (oldPorts & DIRECTION.NORTH) newPorts |= DIRECTION.EAST;
        if (oldPorts & DIRECTION.EAST)  newPorts |= DIRECTION.SOUTH;
        if (oldPorts & DIRECTION.SOUTH) newPorts |= DIRECTION.WEST;
        if (oldPorts & DIRECTION.WEST)  newPorts |= DIRECTION.NORTH;

        node.ports = newPorts;
        node.targetRotationAngle += Math.PI / 2;

        this.recalculatePower();
        this.eventBus.emit('CIRCUIT_UPDATED', { nodeId, ports: newPorts });
    }

    /**
     * Recalculates power propagation across the network using BFS
     */
    recalculatePower() {
        // Reset all powered states
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

            // Check all configured neighbors
            for (const link of current.neighbors) {
                const neighbor = this.nodes.get(link.nodeId);
                if (!neighbor) continue;

                const dirToNeighbor = link.direction;
                const oppositeDir = OPPOSITE_DIRECTION[dirToNeighbor];

                // Check if current node's port is OPEN in this direction
                const currentHasPort = (current.ports & dirToNeighbor) !== 0;
                // Check if neighbor's port is OPEN towards current
                const neighborHasPort = (neighbor.ports & oppositeDir) !== 0;

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

        // Notify state changes for receivers (doors, lifts)
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

        // 1. Render Conduits
        for (const conduit of this.conduits) {
            this._renderConduit(ctx, conduit);
        }

        // 2. Render Circuit Nodes
        for (const node of this.nodes.values()) {
            this._renderNode(ctx, node);
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

        // Conduit casing (dark metal)
        ctx.strokeStyle = '#1e2228';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Electrical Core
        if (conduit.isPowered) {
            // Glowing yellow outer
            ctx.strokeStyle = '#ffb700';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Bright white-yellow inner
            ctx.strokeStyle = '#fffae0';
            ctx.lineWidth = 1.8;
            ctx.stroke();

            // Energy pulse
            ctx.setLineDash([8, 20]);
            ctx.lineDashOffset = -this.pulseTime * 15;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Unpowered conduit: dim gray
            ctx.strokeStyle = '#383d47';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.restore();
    }

    _renderNode(ctx, node) {
        ctx.save();
        ctx.translate(node.x, node.y);

        // Power Source Glow
        if (node.type === 'SOURCE') {
            const glowRadius = 24 + Math.sin(this.pulseTime) * 3;
            const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, glowRadius);
            grad.addColorStop(0, 'rgba(255, 230, 80, 0.9)');
            grad.addColorStop(0.5, 'rgba(255, 170, 0, 0.3)');
            grad.addColorStop(1, 'rgba(255, 170, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Outer Node Box
        ctx.fillStyle = '#22262d';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = node.isPowered ? '#ffb700' : '#454c58';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Rotate for port indicators
        ctx.rotate(node.rotationAngle);

        // Draw internal conduit routes based on ports bitmask
        ctx.strokeStyle = node.isPowered ? '#ffea60' : '#606775';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        if (node.ports & DIRECTION.NORTH) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -14);
            ctx.stroke();
        }
        if (node.ports & DIRECTION.EAST) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(14, 0);
            ctx.stroke();
        }
        if (node.ports & DIRECTION.SOUTH) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, 14);
            ctx.stroke();
        }
        if (node.ports & DIRECTION.WEST) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-14, 0);
            ctx.stroke();
        }

        // Center hub pin
        ctx.fillStyle = node.isPowered ? '#ffffff' : '#888f9e';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

