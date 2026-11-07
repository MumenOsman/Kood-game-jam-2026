/**
 * Player.js
 * Represents the robot hero entity: transform, physics state, battery levels,
 * tether attachment points, and animation state.
 */
export class Player {
    constructor(x = 100, y = 300) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;

        this.vx = 0;
        this.vy = 0;

        // Facing direction: 1 = right, -1 = left
        this.facing = 1;

        // Platforming states
        this.isGrounded = false;
        this.wasGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;

        // Wall sliding / wall jumping states
        this.isWallSliding = false;
        this.wallSlideDirection = 0; // -1 = touching left wall, 1 = touching right wall
        this.wallCoyoteTimer = 0;
        this.wallJumpLockTimer = 0; // Brief directional lock during wall kick
        this.shockInvulnTimer = 0; // Invulnerability / stun timer after shock

        // Tether states (strictly locked to max 3 tiles = 96px)
        this.isTethered = false;
        this.tetherSocket = null;
        this.tetherLength = 0;
        this.tetherMaxDist = 96; // 3 squares (3 x 32px)

        // Aiming / Throw states
        this.isAiming = false;
        this.aimPower = 1.0;
        this.aimAngle = 0; // radians
        this.spinAngle = 0;
        this.shootTimer = 0; // brief recoil / firing stance timer after shooting wire

        // Rest and battery states
        this.battery = 100; // 0 to 100
        this.maxBattery = 100;
        this.isCharging = false;
        this.isResting = false;
        this.idleTimer = 0;

        // High-level visual animation state
        this.currentState = 'idle'; // idle, walk, run, jump, rest, throw_ground, throw_air
    }

    drainBattery(amount) {
        if (this.battery <= 0) return 0;
        const prev = this.battery;
        this.battery = Math.max(0, this.battery - amount);
        return prev - this.battery;
    }

    addBattery(amount) {
        if (this.battery >= this.maxBattery) return 0;
        const prev = this.battery;
        this.battery = Math.min(this.maxBattery, this.battery + amount);
        return this.battery - prev;
    }

    get isLowPower() {
        return this.battery <= 25 && this.battery > 0;
    }

    get isDepleted() {
        return this.battery <= 0;
    }

    /**
     * Get the position of the wire connector / gun muzzle
     */
    getHeadSocket() {
        return {
            x: this.x + (this.facing === 1 ? 26 : 6),
            y: this.y + 16
        };
    }

    /**
     * Get player center coordinate
     */
    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }

    /**
     * Get player bounding box
     */
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

