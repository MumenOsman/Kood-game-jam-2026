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
            const highlightRadius = this.type === 'CIRCUIT' ? 44 : (this.radius + 10);
            ctx.beginPath();
            ctx.arc(0, 0, highlightRadius * pulse, 0, Math.PI * 2);
            ctx.fillStyle = this.type === 'CHARGER'
                ? 'rgba(0, 255, 170, 0.2)'
                : this.type === 'CIRCUIT'
                ? 'rgba(77, 166, 255, 0.22)'
                : 'rgba(0, 220, 255, 0.2)';
            ctx.fill();

            ctx.lineWidth = 2;
            ctx.strokeStyle = this.type === 'CHARGER'
                ? '#00ffaa'
                : this.type === 'CIRCUIT'
                ? '#4da6ff'
                : '#00ddff';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // For CIRCUIT sockets, the circular dial housing and channels are drawn by CircuitSystem.
        // The socket renders the center plug contact and range ring.
        if (this.type === 'CIRCUIT') {
            if (this.isPlugged) {
                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.restore();
            return;
        }

        // Outer industrial metal mount (for ANCHOR and CHARGER)
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

        // Type indicator for CHARGER and ANCHOR
        if (this.type === 'CHARGER') {
            // Charging terminal blades
            ctx.fillStyle = '#00ffaa';
            ctx.fillRect(-6, -8, 4, 16);
            ctx.fillRect(2, -8, 4, 16);
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

