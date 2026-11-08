/**
 * PauseMenu.js
 * In-game pause modal invoked by pressing Escape.
 * Options: [Continue, Restart Level, Restart Game, Options, Exit to Main Menu].
 */
export class PauseMenu {
    constructor({ uiTheme, audioManager, onResume, onRestartLevel, onRestartGame, onOptions, onExitToMainMenu }) {
        this.theme = uiTheme;
        this.audio = audioManager;

        this.onResume = onResume;
        this.onRestartLevel = onRestartLevel;
        this.onRestartGame = onRestartGame;
        this.onOptions = onOptions;
        this.onExitToMainMenu = onExitToMainMenu;

        this.hoveredBtn = null;
        this.lastHoveredBtn = null;
    }

    update(dt, input) {
        const mx = input.mouseScreen.x;
        const my = input.mouseScreen.y;

        const buttons = this._getButtonBounds();
        this.hoveredBtn = null;

        for (const btn of buttons) {
            if (mx >= btn.x && mx <= btn.x + btn.width && my >= btn.y && my <= btn.y + btn.height) {
                this.hoveredBtn = btn.id;
                break;
            }
        }

        // Sound on hover
        if (this.hoveredBtn && this.hoveredBtn !== this.lastHoveredBtn) {
            if (this.audio) this.audio.playFx('ui_hover');
        }
        this.lastHoveredBtn = this.hoveredBtn;

        // Click handling
        if (input.leftPressedThisFrame && this.hoveredBtn) {
            if (this.audio) this.audio.playFx('ui_click');

            if (this.hoveredBtn === 'resume') {
                if (this.onResume) this.onResume();
            } else if (this.hoveredBtn === 'restart_level') {
                if (this.onRestartLevel) this.onRestartLevel();
            } else if (this.hoveredBtn === 'restart_game') {
                if (this.onRestartGame) this.onRestartGame();
            } else if (this.hoveredBtn === 'options') {
                if (this.onOptions) this.onOptions();
            } else if (this.hoveredBtn === 'main_menu') {
                if (this.onExitToMainMenu) this.onExitToMainMenu();
            }
        }
    }

    _getButtonBounds() {
        const cx = 1280 / 2;
        const frameH = 350;
        const frameY = Math.round((720 - frameH) / 2); // 185
        const startY = frameY + 68;
        const btnW = 280;
        const btnH = 36;
        const spacing = 12;

        return [
            { id: 'resume', text: 'CONTINUE', x: cx - btnW / 2, y: startY, width: btnW, height: btnH, variant: 'amber' },
            { id: 'restart_level', text: 'RESTART LEVEL', x: cx - btnW / 2, y: startY + (btnH + spacing), width: btnW, height: btnH, variant: 'slate' },
            { id: 'restart_game', text: 'RESTART GAME', x: cx - btnW / 2, y: startY + (btnH + spacing) * 2, width: btnW, height: btnH, variant: 'slate' },
            { id: 'options', text: 'OPTIONS', x: cx - btnW / 2, y: startY + (btnH + spacing) * 3, width: btnW, height: btnH, variant: 'slate' },
            { id: 'main_menu', text: 'EXIT TO MAIN MENU', x: cx - btnW / 2, y: startY + (btnH + spacing) * 4, width: btnW, height: btnH, variant: 'slate' }
        ];
    }

    render(ctx) {
        ctx.save();

        // 1. Dark Backdrop
        this.theme.drawModalBackdrop(ctx, 1280, 720);

        // 2. Central Frame
        const frameW = 400;
        const frameH = 350;
        const frameX = 640 - frameW / 2;
        const frameY = Math.round((720 - frameH) / 2);
        this.theme.drawFrame(ctx, frameX, frameY, frameW, frameH, 0);

        // 3. Header Title (Comfortably padded inside the frame)
        ctx.font = '22px CyberpunkPixel, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#05070a';
        ctx.fillText('GAME PAUSED', 640 + 1, frameY + 38 + 1);

        ctx.fillStyle = '#f4b03c';
        ctx.fillText('GAME PAUSED', 640, frameY + 38);

        // 4. Buttons
        const buttons = this._getButtonBounds();
        for (const btn of buttons) {
            const state = this.hoveredBtn === btn.id ? 'hover' : 'normal';
            this.theme.drawButton(ctx, btn, btn.text, state, btn.variant);
        }

        ctx.restore();
    }
}

