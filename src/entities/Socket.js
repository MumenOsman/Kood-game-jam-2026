/**
 * Socket.js
 * Interactive wall/ceiling socket entities where the player can plug their head wire.
 * Types:
 * - ANCHOR: Pure physical pivot for swinging across gaps.
 * - CIRCUIT: Attached to a rotatable circuit junction node.
 * - CHARGER: Recharges player battery while docked.
 */
export class Socket {
    constructor(id, x, y, type = 'ANCHOR', options = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type; // ANCHOR, CIRCUIT, CHARGER
        this.radius = 16;

        this.circuitNodeId = options.circuitNodeId || null;
        this.label = options.label || '';
        this.isHighlighted = false;
        this.isPlugged = false;

        this.pulsePhase = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.pulsePhase += dt * 4;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Highlight ring when player is in range
        if (this.isHighlighted) {
            const pulse = 1 + Math.sin(this.pulsePhase) * 0.15;
            ctx.beginPath();
            ctx.arc(0, 0, (this.radius + 10) * pulse, 0, Math.PI * 2);
            ctx.fillStyle = this.type === 'CHARGER'
                ? 'rgba(0, 255, 170, 0.2)'
                : this.type === 'CIRCUIT'
                ? 'rgba(255, 190, 0, 0.2)'
                : 'rgba(0, 220, 255, 0.2)';
            ctx.fill();

            ctx.lineWidth = 2;
            ctx.strokeStyle = this.type === 'CHARGER'
                ? '#00ffaa'
                : this.type === 'CIRCUIT'
                ? '#ffcc00'
                : '#00ddff';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Outer industrial metal mount
        ctx.fillStyle = '#22252a';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#444a53';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner receptacle
        ctx.fillStyle = this.isPlugged ? '#ffaa00' : '#141619';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Icon / Type indicator
        if (this.type === 'CHARGER') {
            // Draw Lightning bolt
            ctx.fillStyle = '#00ffaa';
            ctx.beginPath();
            ctx.moveTo(2, -9);
            ctx.lineTo(-5, 0);
            ctx.lineTo(0, 0);
            ctx.lineTo(-2, 9);
            ctx.lineTo(5, -1);
            ctx.lineTo(0, -1);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'CIRCUIT') {
            // Draw circuit circular node with rotation hint
            ctx.strokeStyle = this.isPlugged ? '#ffea00' : '#e67e22';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 1.5);
            ctx.stroke();

            // Arrow head
            ctx.fillStyle = this.isPlugged ? '#ffea00' : '#e67e22';
            ctx.beginPath();
            ctx.moveTo(0, -10);
            ctx.lineTo(4, -8);
            ctx.lineTo(0, -6);
            ctx.closePath();
            ctx.fill();
        } else {
            // ANCHOR center pin
            ctx.fillStyle = '#00ddff';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

