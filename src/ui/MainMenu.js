/**
 * MainMenu.js
 * Main Title Screen.
 * Presents [Start Game, Continue (if save exists), Options].
 * Rendered using authentic pixel-art frames and buttons.
 */
export class MainMenu {
    constructor({ uiTheme, audioManager, saveManager, onStartGame, onContinue, onSelectLevel, onOptions, onCredits }) {
        this.theme = uiTheme;
        this.audio = audioManager;
        this.saveManager = saveManager;

        this.onStartGame = onStartGame;
        this.onContinue = onContinue;
        this.onSelectLevel = onSelectLevel;
        this.onOptions = onOptions;
        this.onCredits = onCredits;

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
            } else if (this.hoveredBtn === 'select_level') {
                if (this.onSelectLevel) this.onSelectLevel();
            } else if (this.hoveredBtn === 'options') {
                if (this.onOptions) this.onOptions();
            } else if (this.hoveredBtn === 'credits') {
                if (this.onCredits) this.onCredits();
            }
        }
    }

    _getButtonBounds(hasSave) {
        const cx = 1280 / 2;
        const frameY = 215;
        const frameH = 300;
        const btnW = 280;
        const btnH = 38;
        const spacing = 12;

        const buttonDefs = hasSave ? [
            { id: 'continue', text: 'CONTINUE', variant: 'amber' },
            { id: 'start', text: 'START NEW GAME', variant: 'slate' },
            { id: 'select_level', text: 'SELECT LEVEL', variant: 'slate' },
            { id: 'options', text: 'OPTIONS', variant: 'slate' },
            { id: 'credits', text: 'CREDITS', variant: 'slate' }
        ] : [
            { id: 'start', text: 'START NEW GAME', variant: 'amber' },
            { id: 'select_level', text: 'SELECT LEVEL', variant: 'slate' },
            { id: 'options', text: 'OPTIONS', variant: 'slate' },
            { id: 'credits', text: 'CREDITS', variant: 'slate' }
        ];

        const totalH = buttonDefs.length * btnH + (buttonDefs.length - 1) * spacing;
        const startY = frameY + (frameH - totalH) / 2;

        return buttonDefs.map((def, idx) => ({
            id: def.id,
            text: def.text,
            x: cx - btnW / 2,
            y: startY + idx * (btnH + spacing),
            width: btnW,
            height: btnH,
            disabled: false,
            variant: def.variant
        }));
    }

    render(ctx) {
        ctx.save();

        // 1. Title & Header (Centered cleanly above window frame)
        ctx.font = '36px CyberpunkPixel, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1px Pixel drop shadow
        ctx.fillStyle = '#05070a';
        ctx.fillText('TETHERMIND', 640 + 2, 165 + 2);

        // Amber pixel header
        ctx.fillStyle = '#f4b03c';
        ctx.fillText('TETHERMIND', 640, 165);

        // 2. Central Window Frame
        const frameW = 400;
        const frameH = 300;
        const frameX = 640 - frameW / 2;
        const frameY = 215;
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

