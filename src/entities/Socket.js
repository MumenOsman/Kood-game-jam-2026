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
        this.assetLoader = options.assetLoader || null;

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

        // Highlight ring when player is in range (subtle, non-intrusive)
        if (this.isHighlighted) {
            const pulse = 1 + Math.sin(this.pulsePhase) * 0.12;
            const r = (this.radius + 2) * pulse;
            ctx.strokeStyle = this.type === 'CHARGER'
                ? '#00e676'
                : this.type === 'CIRCUIT'
                ? '#4da6ff'
                : '#00ddff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // For CIRCUIT sockets, CircuitSystem draws the 32x32 rotatable dial tile
        if (this.type === 'CIRCUIT') {
            if (this.isPlugged) {
                ctx.fillStyle = '#fffa65';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        // Authentic 32x32 Pixel-Art Sprite Rendering for CHARGER and ANCHOR
        if (this.type === 'CHARGER') {
            const sheet = this.assetLoader ? this.assetLoader.getImage('circuits_sheet') : null;
            if (sheet) {
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                // Circuits(4).png Row 5, Col 1: [32, 160] (32x32 lightning plate)
                ctx.drawImage(sheet, 32, 160, 32, 32, -16, -16, 32, 32);
                ctx.restore();
            } else {
                ctx.fillStyle = '#22252a';
                ctx.fillRect(-14, -14, 28, 28);
                ctx.fillStyle = '#ffaa00';
                ctx.fillRect(-6, -8, 12, 16);
            }
        } else if (this.type === 'ANCHOR') {
            const sheet = this.assetLoader ? this.assetLoader.getImage('drones_sheet') : null;
            if (sheet) {
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                // Drones +.png Row 5, Col 0: [0, 160] (32x32 ceiling anchor mount)
                ctx.drawImage(sheet, 0, 160, 32, 32, -16, -16, 32, 32);
                ctx.restore();
            } else {
                ctx.fillStyle = '#22252a';
                ctx.fillRect(-12, -12, 24, 24);
                ctx.fillStyle = '#00ddff';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Plugged connection core glow
        if (this.isPlugged) {
            ctx.fillStyle = '#fffa65';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

