/**
 * MainMenu.js
 * Main Title Screen.
 * Presents [Start Game, Continue (if save exists), Options].
 * Rendered using authentic pixel-art frames and buttons.
 */
export class MainMenu {
    constructor({ uiTheme, audioManager, saveManager, onStartGame, onContinue, onOptions }) {
        this.theme = uiTheme;
        this.audio = audioManager;
        this.saveManager = saveManager;

        this.onStartGame = onStartGame;
        this.onContinue = onContinue;
        this.onOptions = onOptions;

        this.hoveredBtn = null;
        this.lastHoveredBtn = null;

        // Visual animation counter
        this.timer = 0;
    }

    update(dt, input) {
        this.timer += dt;
        const hasSave = this.saveManager ? this.saveManager.hasSave() : false;

        const mx = input.mouseScreen.x;
        const my = input.mouseScreen.y;

        const buttons = this._getButtonBounds(hasSave);
        this.hoveredBtn = null;

        for (const btn of buttons) {
            if (btn.disabled) continue;
            if (mx >= btn.x && mx <= btn.x + btn.width && my >= btn.y && my <= btn.y + btn.height) {
                this.hoveredBtn = btn.id;
                break;
            }
        }

        // Play hover sound when mouse moves over a new button
        if (this.hoveredBtn && this.hoveredBtn !== this.lastHoveredBtn) {
            if (this.audio) this.audio.playFx('ui_hover');
        }
        this.lastHoveredBtn = this.hoveredBtn;

        // Handle click
        if (input.leftPressedThisFrame && this.hoveredBtn) {
            if (this.audio) {
                if (this.hoveredBtn === 'start' || this.hoveredBtn === 'continue') {
                    this.audio.playFx('start_game');
                } else {
                    this.audio.playFx('ui_click');
                }
            }

            if (this.hoveredBtn === 'start') {
                if (this.onStartGame) this.onStartGame();
            } else if (this.hoveredBtn === 'continue') {
                if (this.onContinue) this.onContinue();
            } else if (this.hoveredBtn === 'options') {
                if (this.onOptions) this.onOptions();
            }
        }
    }

    _getButtonBounds(hasSave) {
        const cx = 1280 / 2;
        const frameY = 245;
        const startY = frameY + 35;
        const btnW = 280;
        const btnH = 38;
        const spacing = 16;

        return [
            { id: 'start', text: 'START GAME', x: cx - btnW / 2, y: startY, width: btnW, height: btnH, disabled: false, variant: 'amber' },
            { id: 'continue', text: 'CONTINUE', x: cx - btnW / 2, y: startY + (btnH + spacing), width: btnW, height: btnH, disabled: !hasSave, variant: 'slate' },
            { id: 'options', text: 'OPTIONS', x: cx - btnW / 2, y: startY + (btnH + spacing) * 2, width: btnW, height: btnH, disabled: false, variant: 'slate' }
        ];
    }

    render(ctx) {
        ctx.save();

        // 1. Title & Header (Centered cleanly above window frame)
        ctx.font = '36px CyberpunkPixel, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1px Pixel drop shadow
        ctx.fillStyle = '#05070a';
        ctx.fillText('TETHER PLATFORMER', 640 + 2, 195 + 2);

        // Amber pixel header
        ctx.fillStyle = '#f4b03c';
        ctx.fillText('TETHER PLATFORMER', 640, 195);

        // 2. Central Window Frame
        const frameW = 400;
        const frameH = 240;
        const frameX = 640 - frameW / 2;
        const frameY = 245;
        this.theme.drawFrame(ctx, frameX, frameY, frameW, frameH, 0);

        // 3. Buttons
        const hasSave = this.saveManager ? this.saveManager.hasSave() : false;
        const buttons = this._getButtonBounds(hasSave);

        for (const btn of buttons) {
            let state = 'normal';
            if (btn.disabled) {
                state = 'disabled';
            } else if (this.hoveredBtn === btn.id) {
                state = 'hover';
            }
            this.theme.drawButton(ctx, btn, btn.text, state, btn.variant);
        }

        ctx.restore();
    }
}

