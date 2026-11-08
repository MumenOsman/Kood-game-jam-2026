/**
 * HUD.js
 * Renders the heads-up display: battery gauge, interactive action tooltips,
 * and contextual prompt notifications.
 */
export class HUD {
    constructor(player, camera) {
        this.player = player;
        this.camera = camera;
        this.statusMessage = '';
        this.statusTimer = 0;

        // Trailing depletion ghost bar
        this.ghostBattery = player.battery;
        this.pulsePhase = 0;
        this.lowPowerWarned = false;
    }

    setMessage(msg, duration = 4) {
        // Notification pop-ups disabled per user preference
        this.statusMessage = '';
        this.statusTimer = 0;
    }

    update(dt) {
        this.pulsePhase += dt * 5;

        // Smoothly interpolate ghost battery towards current battery
        if (this.ghostBattery > this.player.battery) {
            this.ghostBattery = Math.max(this.player.battery, this.ghostBattery - dt * 18);
        } else {
            this.ghostBattery = this.player.battery;
        }

        // Low power tracking
        if (this.player.isLowPower && !this.lowPowerWarned) {
            this.lowPowerWarned = true;
        } else if (!this.player.isLowPower && !this.player.isDepleted) {
            this.lowPowerWarned = false;
        }
    }

    render(ctx) {
        ctx.save();

        // 1. Battery Gauge (Top-Left)
        this._renderBatteryGauge(ctx);

        ctx.restore();
    }

    _renderBatteryGauge(ctx) {
        const p = this.player;
        const x = 20;
        const y = 20;
        const width = 230;
        const height = 48;

        ctx.save();

        // 1. Outer Chassis / Frame (Grounded Industrial Pixel Art)
        // Background plate
        ctx.fillStyle = 'rgba(14, 18, 26, 0.94)';
        ctx.fillRect(x, y, width, height);

        // Frame Border - tinted crimson when depleted, amber when low, steel-blue nominal
        const frameBorderColor = p.isDepleted
            ? '#d93b3b'
            : p.isLowPower
            ? '#f4b03c'
            : '#37446e';
        ctx.strokeStyle = frameBorderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);

        // Subtle 1px inner dark bevel
        ctx.strokeStyle = '#1a2232';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);

        // Corner rivets (authentic 2x2 px metal studs)
        ctx.fillStyle = '#5a6e94';
        ctx.fillRect(x + 4, y + 4, 2, 2);
        ctx.fillRect(x + width - 6, y + 4, 2, 2);
        ctx.fillRect(x + 4, y + height - 6, 2, 2);
        ctx.fillRect(x + width - 6, y + height - 6, 2, 2);

        // 2. Header Row (Entirely inside frame)
        ctx.font = '12px CyberpunkPixel, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Title: BATTERY with 1px drop shadow
        const labelX = x + 10;
        const labelY = y + 8;
        ctx.fillStyle = '#05070a';
        ctx.fillText('BATTERY', labelX + 1, labelY + 1);
        ctx.fillStyle = p.isLowPower ? '#f4b03c' : '#dce5f0';
        ctx.fillText('BATTERY', labelX, labelY);

        // State Tag ([CHARGING], [LOW], [DEPLETED])
        let statusTag = '';
        let tagColor = '#f4b03c';
        if (p.isCharging) {
            statusTag = '[CHARGING]';
            tagColor = '#f4b03c';
        } else if (p.isDepleted) {
            statusTag = '[DEPLETED]';
            tagColor = '#d93b3b';
        } else if (p.isLowPower) {
            statusTag = '[LOW]';
            tagColor = '#f4b03c';
        }

        if (statusTag) {
            ctx.fillStyle = '#05070a';
            ctx.fillText(statusTag, labelX + 72 + 1, labelY + 1);
            ctx.fillStyle = tagColor;
            ctx.fillText(statusTag, labelX + 72, labelY);
        }

        // Percentage text (aligned to the right inside frame)
        const pctText = `${Math.round(p.battery)}%`;
        ctx.textAlign = 'right';
        const pctX = x + width - 10;
        ctx.fillStyle = '#05070a';
        ctx.fillText(pctText, pctX + 1, labelY + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(pctText, pctX, labelY);

        // 3. Battery Meter Inset Trough (inside frame)
        const barX = x + 10;
        const barY = y + 26;
        const barW = width - 20;
        const barH = 14;

        // Inset trough background & border
        ctx.fillStyle = '#080b10';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = '#273449';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Trailing depletion ghost bar
        const ghostPct = Math.max(0, Math.min(1, this.ghostBattery / p.maxBattery));
        if (this.ghostBattery > p.battery) {
            const ghostW = Math.round((barW - 2) * ghostPct);
            ctx.fillStyle = 'rgba(230, 80, 80, 0.45)';
            ctx.fillRect(barX + 1, barY + 1, ghostW, barH - 2);
        }

        // Battery Fill
        const pct = Math.max(0, Math.min(1, p.battery / p.maxBattery));
        const fillW = Math.round((barW - 2) * pct);

        let fillColor = '#3cd070'; // Nominal emerald green
        let highlightColor = '#86efac';
        if (p.isCharging) {
            fillColor = '#f4b03c';
            highlightColor = '#fef08a';
        } else if (p.isDepleted) {
            fillColor = '#d93b3b';
            highlightColor = '#f87171';
        } else if (p.isLowPower) {
            const pulse = (Math.sin(this.pulsePhase) + 1) / 2;
            fillColor = pulse > 0.5 ? '#d93b3b' : '#f4b03c';
            highlightColor = pulse > 0.5 ? '#f87171' : '#fef08a';
        } else if (pct < 0.5) {
            fillColor = '#e6a122';
            highlightColor = '#fde68a';
        }

        if (fillW > 0) {
            ctx.fillStyle = fillColor;
            ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);

            // 1px top highlight for crisp authentic pixel bevel
            ctx.fillStyle = highlightColor;
            ctx.fillRect(barX + 1, barY + 1, fillW, 2);
        }

        // 4. Subtle cell divider ticks at 25%, 50%, 75%
        for (const frac of [0.25, 0.5, 0.75]) {
            const tickX = Math.round(barX + barW * frac);
            ctx.fillStyle = '#080b10';
            ctx.fillRect(tickX, barY, 1, barH);
        }

        ctx.restore();
    }

    _renderContextPrompt(ctx) {
        const p = this.player;
        if (!this.camera) return;

        let prompt = null;

        if (p.isTethered && p.tetherSocket) {
            if (p.tetherSocket.type === 'CIRCUIT') {
                prompt = '[E] Rotate Circuit Junction';
            } else if (p.tetherSocket.type === 'CHARGER') {
                prompt = 'Recharging Battery...  |  [RMB] Disconnect';
            } else if (!p.isGrounded) {
                prompt = '[Space] Tether Jump  |  [RMB] Cut Wire';
            } else {
                prompt = '[RMB] Unplug Wire';
            }
        } else if (p.isWallSliding) {
            prompt = '[Space] Wall Jump  |  Hold [S] Fast Slide';
        }

        if (prompt) {
            const screenPos = this.camera.worldToScreen(p.x + p.width / 2, p.y - 18);

            ctx.font = '12px CyberpunkPixel, monospace';
            const metrics = ctx.measureText(prompt);
            const boxW = metrics.width + 16;
            const boxH = 22;

            ctx.fillStyle = 'rgba(14, 18, 25, 0.92)';
            ctx.fillRect(screenPos.x - boxW / 2, screenPos.y - boxH / 2, boxW, boxH);
            ctx.strokeStyle = '#37446e';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(screenPos.x - boxW / 2, screenPos.y - boxH / 2, boxW, boxH);

            ctx.fillStyle = '#f4b03c';
            ctx.textAlign = 'center';
            ctx.fillText(prompt, screenPos.x, screenPos.y + 4);
            ctx.textAlign = 'left';
        }
    }

    _renderStatusBanner(ctx) {
        // Notification pop-up banners disabled
    }
}

