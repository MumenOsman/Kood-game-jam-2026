/**
 * Level.js
 * Base abstract class defining level colliders, sockets, devices, and rendering hooks.
 */
export class Level {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.colliders = [];
        this.sockets = [];
        this.devices = new Map(); // id -> device
        this.width = 4000;
        this.height = 900;
        this.spawnPoint = { x: 120, y: 480 };
    }

    getSolidColliders() {
        return this.colliders;
    }

    getSockets() {
        return this.sockets;
    }

    getDevice(id) {
        return this.devices.get(id);
    }

    update(dt) {
        for (const sock of this.sockets) {
            sock.update(dt);
        }
        for (const dev of this.devices.values()) {
            if (typeof dev.update === 'function') {
                dev.update(dt);
            }
        }
    }

    renderBackground(ctx) {}
    renderForeground(ctx) {}
}

