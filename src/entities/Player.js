/**
 * Player.js
 * Represents the robot hero entity: transform, physics state, battery levels,
 * tether attachment points, and animation state.
 */
export class Player {
    constructor(x = 100, y = 300) {
        this.x = x;
        this.y = y;
        this.width = 44;
        this.height = 72;

        this.vx = 0;
        this.vy = 0;

        // Facing direction: 1 = right, -1 = left
        this.facing = 1;

        // Platforming states
        this.isGrounded = false;
        this.wasGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;

        // Tether states
        this.isTethered = false;
        this.tetherSocket = null;
        this.tetherLength = 0;
        this.tetherMaxDist = 280;

        // Aiming / Throw states
        this.isAiming = false;
        this.aimPower = 0; // 0.0 to 1.0
        this.aimAngle = 0; // radians
        this.spinAngle = 0; // for plug spinning animation

        // Rest and battery states
        this.battery = 75; // 0 to 100
        this.maxBattery = 100;
        this.isCharging = false;
        this.isResting = false;
        this.idleTimer = 0;

        // High-level visual animation state
        this.currentState = 'idle'; // idle, walk, run, jump, rest, throw_ground, throw_air
    }

    /**
     * Get the position of the wire connector on top of the robot's head
     */
    getHeadSocket() {
        return {
            x: this.x + this.width / 2,
            y: this.y + 6
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

