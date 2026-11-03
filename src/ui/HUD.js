/**
 * HUD.js
 * Renders the heads-up display: battery gauge, interactive action tooltips,
 * and contextual prompt notifications.
 */
export class HUD {
    constructor(player, camera) {
        this.player = player;
        this.camera = camera;
        this.statusMessage = 'System Online. Explore and restore power.';
        this.statusTimer = 5;

        // Trailing depletion ghost bar
        this.ghostBattery = player.battery;
        this.pulsePhase = 0;
        this.lowPowerWarned = false;
    }

    setMessage(msg, duration = 4) {
        this.statusMessage = msg;
        this.statusTimer = duration;
    }

    update(dt) {
        this.pulsePhase += dt * 5;

        if (this.statusTimer > 0) {
            this.statusTimer -= dt;
        }

        // Smoothly interpolate ghost battery towards current battery
        if (this.ghostBattery > this.player.battery) {
            this.ghostBattery = Math.max(this.player.battery, this.ghostBattery - dt * 18);
        } else {
            this.ghostBattery = this.player.battery;
        }

        // Trigger alert banner on low power
        if (this.player.isLowPower && !this.lowPowerWarned) {
            this.lowPowerWarned = true;
            this.setMessage('LOW POWER WARNING: Sprinting offline. Rest or recharge.', 4);
        } else if (!this.player.isLowPower && !this.player.isDepleted) {
            this.lowPowerWarned = false;
        }
    }

    render(ctx) {
        ctx.save();

        // 1. Battery Gauge (Top-Left)
        this._renderBatteryGauge(ctx);

        // 2. Contextual Prompt near Player
        this._renderContextPrompt(ctx);

        // 3. Status Notification banner
        if (this.statusTimer > 0 && this.statusMessage) {
            this._renderStatusBanner(ctx);
        }

        ctx.restore();
    }

    _renderBatteryGauge(ctx) {
        const p = this.player;
        const x = 24;
        const y = 24;
        const width = 160;
        const height = 18;

        // Background box
        ctx.fillStyle = 'rgba(18, 22, 28, 0.85)';
        ctx.fillRect(x - 8, y - 8, width + 55, height + 16);
        ctx.strokeStyle = p.isDepleted
            ? '#ff3344'
            : p.isLowPower
            ? '#ffaa00'
            : '#2f3846';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 8, y - 8, width + 55, height + 16);

        // Battery label
        ctx.fillStyle = p.isLowPower ? '#ffaa00' : '#b0bec5';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('POWER', x, y - 1);

        // Battery meter bar background
        ctx.fillStyle = '#10141a';
        ctx.fillRect(x, y + 4, width, height - 4);

        // Trailing depletion ghost bar (soft light-red/white)
        const ghostPct = Math.max(0, Math.min(1, this.ghostBattery / p.maxBattery));
        if (this.ghostBattery > p.battery) {
            ctx.fillStyle = 'rgba(255, 120, 120, 0.45)';
            ctx.fillRect(x + 1, y + 5, (width - 2) * ghostPct, height - 6);
        }

        // Fill percentage
        const pct = Math.max(0, Math.min(1, p.battery / p.maxBattery));
        let fillColor = '#00e676'; // Nominal green
        if (p.isCharging) {
            fillColor = '#00ffcc';
        } else if (p.isDepleted) {
            fillColor = '#ff2233';
        } else if (p.isLowPower) {
            const pulse = (Math.sin(this.pulsePhase) + 1) / 2;
            fillColor = pulse > 0.5 ? '#ff3b30' : '#ff8800';
        } else if (pct < 0.55) {
            fillColor = '#ffcc00';
        }

        ctx.fillStyle = fillColor;
        ctx.fillRect(x + 1, y + 5, (width - 2) * pct, height - 6);

        // Battery percentage text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`${Math.round(p.battery)}%`, x + width + 8, y + 13);

        if (p.isCharging) {
            ctx.fillStyle = '#00ffcc';
            ctx.font = '9px monospace';
            ctx.fillText('CHARGING', x + 50, y - 1);
        } else if (p.isDepleted) {
            ctx.fillStyle = '#ff3344';
            ctx.font = '9px monospace';
            ctx.fillText('DEPLETED', x + 50, y - 1);
        } else if (p.isLowPower) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '9px monospace';
            ctx.fillText('LOW', x + 50, y - 1);
        }
    }

    _renderContextPrompt(ctx) {
        const p = this.player;
        if (!this.camera) return;

        let prompt = null;

        if (p.isTethered && p.tetherSocket) {
            if (p.tetherSocket.type === 'CIRCUIT') {
                prompt = '[E] Rotate Circuit Junction';
            } else if (p.tetherSocket.type === 'CHARGER') {
                prompt = p.isCharging ? 'Recharging Battery...' : 'Hold [S] to Recharge';
            } else if (!p.isGrounded) {
                prompt = '[Space] Tether Jump  |  [RMB] Cut Wire';
            } else {
                prompt = '[RMB] Unplug Wire';
            }
        } else if (p.isWallSliding) {
            prompt = '[Space] or [S] Wall Jump';
        } else if (p.isAiming) {
            prompt = `Aiming... Power: ${Math.round(p.aimPower * 100)}%`;
        }

        if (prompt) {
            const screenPos = this.camera.worldToScreen(p.x + p.width / 2, p.y - 18);

            ctx.font = 'bold 12px monospace';
            const metrics = ctx.measureText(prompt);
            const boxW = metrics.width + 16;
            const boxH = 22;

            ctx.fillStyle = 'rgba(15, 20, 26, 0.88)';
            ctx.fillRect(screenPos.x - boxW / 2, screenPos.y - boxH / 2, boxW, boxH);
            ctx.strokeStyle = '#ffb700';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenPos.x - boxW / 2, screenPos.y - boxH / 2, boxW, boxH);

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(prompt, screenPos.x, screenPos.y + 4);
            ctx.textAlign = 'left';
        }
    }

    _renderStatusBanner(ctx) {
        const alpha = Math.min(1, this.statusTimer);
        ctx.save();
        ctx.globalAlpha = alpha;

        const x = ctx.canvas.width / 2;
        const y = 35;

        ctx.font = '13px monospace';
        const metrics = ctx.measureText(this.statusMessage);
        const w = metrics.width + 28;
        const h = 28;

        ctx.fillStyle = 'rgba(20, 26, 34, 0.9)';
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
        ctx.strokeStyle = '#00ddff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);

        ctx.fillStyle = '#00ddff';
        ctx.textAlign = 'center';
        ctx.fillText(this.statusMessage, x, y + 4);

        ctx.restore();
    }
}

