/**
 * VictoryModal.js
 * Facility Escape / Game Won Modal displayed upon completing all sectors.
 */
export class VictoryModal {
    constructor({ uiTheme, audioManager, onPlayAgain, onExitToMainMenu }) {
        this.theme = uiTheme;
        this.audio = audioManager;

        this.onPlayAgain = onPlayAgain;
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

            if (this.hoveredBtn === 'play_again') {
                if (this.onPlayAgain) this.onPlayAgain();
            } else if (this.hoveredBtn === 'main_menu') {
                if (this.onExitToMainMenu) this.onExitToMainMenu();
            }
        }
    }

    _getButtonBounds() {
        const cx = 1280 / 2;
        const frameY = 210;
        const startY = frameY + 130;
        const btnW = 280;
        const btnH = 38;
        const spacing = 16;

        return [
            { id: 'play_again', text: 'PLAY AGAIN', x: cx - btnW / 2, y: startY, width: btnW, height: btnH, variant: 'amber' },
            { id: 'main_menu', text: 'MAIN MENU', x: cx - btnW / 2, y: startY + (btnH + spacing), width: btnW, height: btnH, variant: 'slate' }
        ];
    }

    render(ctx) {
        ctx.save();

        // 1. Dark Backdrop
        this.theme.drawModalBackdrop(ctx, 1280, 720);

        // 2. Central Frame
        const frameW = 480;
        const frameH = 290;
        const frameX = 640 - frameW / 2;
        const frameY = 210;
        this.theme.drawFrame(ctx, frameX, frameY, frameW, frameH, 0);

        // 3. Victory Header
        ctx.font = '24px CyberpunkPixel, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#05070a';
        ctx.fillText('FACILITY ESCAPED!', 640 + 1, frameY + 44 + 1);

        ctx.fillStyle = '#f4b03c';
        ctx.fillText('FACILITY ESCAPED!', 640, frameY + 44);

        // Subtitle
        ctx.font = '12px CyberpunkPixel, monospace';
        ctx.fillStyle = '#8a9bb8';
        ctx.fillText('ALL SECTORS LIBERATED - PACIFIST RUN COMPLETE', 640, frameY + 76);

        ctx.fillStyle = '#4ade80';
        ctx.fillText('Power grid restored without casualties.', 640, frameY + 98);

        // 4. Buttons
        for (const btn of this._getButtonBounds()) {
            const isHovered = this.hoveredBtn === btn.id;
            this.theme.drawButton(ctx, btn.x, btn.y, btn.width, btn.height, btn.text, isHovered, btn.variant);
        }

        ctx.restore();
    }
}

