/**
 * Level.js
 * Base abstract class defining level colliders, sockets, devices, and rendering hooks.
 * Designed modularly: allows any level to register wall-runnable surfaces and electrified hazard objects.
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

    /**
     * Add a standard solid collider
     * @param {Object} config
     * @returns {Object} The created collider object
     */
    addCollider(config) {
        const col = {
            x: config.x,
            y: config.y,
            width: config.width,
            height: config.height,
            isHazard: Boolean(config.isHazard),
            isWallRunnable: Boolean(config.isWallRunnable),
            wallRunFace: config.wallRunFace || 'both', // 'left', 'right', or 'both'
            isElectrified: Boolean(config.isElectrified),
            electrifiedFace: config.electrifiedFace || 'all', // 'left', 'right', 'top', 'bottom', 'all'
            deviceId: config.deviceId || null,
            shockDamage: config.shockDamage !== undefined ? config.shockDamage : 8.0,
            knockbackForce: config.knockbackForce !== undefined ? config.knockbackForce : 360,
            ...config
        };
        this.colliders.push(col);
        return col;
    }

    /**
     * Add an explicit wall-runnable surface
     * Modular: any wall in any level can be designated as wall-runnable.
     * @param {Object} config
     * @returns {Object} The created wall collider
     */
    addWallRunWall(config) {
        return this.addCollider({
            ...config,
            isWallRunnable: true,
            wallRunFace: config.wallRunFace || 'both'
        });
    }

    /**
     * Add an electrified hazard object (wall, floor, ceiling, trap, or obstacle)
     * Modular: can be statically electrified or dynamically toggled via deviceId.
     * @param {Object} config
     * @returns {Object} The created hazard collider
     */
    addHazardObject(config) {
        return this.addCollider({
            ...config,
            isHazard: true,
            isElectrified: config.isElectrified !== undefined ? config.isElectrified : true,
            electrifiedFace: config.electrifiedFace || 'all',
            deviceId: config.deviceId || null,
            shockDamage: config.shockDamage !== undefined ? config.shockDamage : 8.0,
            knockbackForce: config.knockbackForce !== undefined ? config.knockbackForce : 360
        });
    }

    getSolidColliders() {
        return this.colliders.filter(c => !c.isHazard || c.isWallRunnable);
    }

    getWallRunColliders() {
        return this.colliders.filter(c => c.isWallRunnable === true);
    }

    getHazardColliders() {
        return this.colliders.filter(c => c.isHazard === true);
    }

    getSockets() {
        return this.sockets;
    }

    getDevice(id) {
        return this.devices.get(id);
    }

    addDevice(id, device) {
        this.devices.set(id, device);
    }

    addSocket(socket) {
        this.sockets.push(socket);
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

    /**
     * Visual helper to render tactile friction grip runners on all wall-runnable surfaces
     */
    renderWallRunGripStrips(ctx, camera = null) {
        ctx.save();
        const wallRunColliders = this.getWallRunColliders();
        for (const col of wallRunColliders) {
            // If currently electrified, hazard arcs take visual precedence
            if (col.isElectrified) continue;

            if (camera && typeof camera.isVisible === 'function' && !camera.isVisible(col.x, col.y, col.width, col.height, 32)) {
                continue;
            }

            const face = col.wallRunFace || 'both';
            const drawGrip = (xPos) => {
                ctx.fillStyle = '#3a4e66';
                const step = 22;
                for (let y = col.y + 12; y < col.y + col.height - 12; y += step) {
                    ctx.fillRect(xPos - 2, y, 4, 3);
                }
            };

            if (face === 'right' || face === 'both') {
                drawGrip(col.x + col.width);
            }
            if (face === 'left' || face === 'both') {
                drawGrip(col.x);
            }
        }
        ctx.restore();
    }
}
