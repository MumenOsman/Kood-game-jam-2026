/**
 * LevelSelectScreen.js
 * Sector Selection Archive overlay.
 * Displays all game sectors in a compact 2-column modal frame.
 * Completed levels are unlocked, highlighted on hover, and clickable to replay.
 * Uncompleted levels are cleanly grayed-out and disabled.
 * Strict zero-neon / pixel-art invariant compliance.
 */
export class LevelSelectScreen {
    constructor({ uiTheme, audioManager, saveManager, onSelectLevel, onBack }) {
        this.theme = uiTheme;
        this.audio = audioManager;
        this.saveManager = saveManager;
        this.onSelectLevel = onSelectLevel;
        this.onBack = onBack;

        this.hoveredBtn = null;
        this.lastHoveredBtn = null;

        this.sectors = [
            { index: 0, title: 'SECTOR 01', subtitle: 'Basics: Jump' },
            { index: 1, title: 'SECTOR 02', subtitle: 'Pendulum Swing' },
            { index: 2, title: 'SECTOR 03', subtitle: 'Wall-Run & Charge' },
            { index: 3, title: 'SECTOR 04', subtitle: 'Junction Sockets' },
            { index: 4, title: 'SECTOR 05', subtitle: 'AND Logic Gate' },
            { index: 5, title: 'SECTOR 06', subtitle: 'Dual Circuit' },
            { index: 6, title: 'SECTOR 07', subtitle: 'Ascending Shaft' },
            { index: 7, title: 'SECTOR 08', subtitle: 'XOR Logic Gate' },
            { index: 8, title: 'SECTOR 09', subtitle: 'Power Grid' },
            { index: 9, title: 'SECTOR 10', subtitle: 'Matrix Chamber' },
            { index: 10, title: 'SECTOR 11', subtitle: 'Final Sector' }
        ];
    }

    _getLayoutBounds() {
        const cx = 1280 / 2;
        const frameW = 820;
        const frameH = 490;
        const fx = cx - frameW / 2;
        const fy = (720 - frameH) / 2;

        const btnW = 340;
        const btnH = 40;
        const colGap = 36;
        const rowGap = 14;
        const rowStartY = fy + 84;

        const col0_X = fx + 52;
        const col1_X = col0_X + btnW + colGap;

        const completedLevels = this.saveManager ? this.saveManager.getCompletedLevels() : [];

        const sectorButtons = this.sectors.map((sec) => {
            const isCol1 = sec.index >= 6;
            const row = isCol1 ? sec.index - 6 : sec.index;
            const x = isCol1 ? col1_X : col0_X;
            const y = rowStartY + row * (btnH + rowGap);
            const isCompleted = completedLevels.includes(sec.index);

            return {
                id: `sector_${sec.index}`,
                index: sec.index,
                text: `${sec.title}: ${sec.subtitle}`,
                x,
                y,
                width: btnW,
                height: btnH,
                isCompleted
            };
        });

        const btnBack = {
            id: 'btn_back',
            text: 'BACK',
            x: cx - 90,
            y: fy + frameH - 48,
            width: 180,
            height: 34
        };

        return {
            fx,
            fy,
            frameW,
            frameH,
            sectorButtons,
            btnBack
        };
    }

    update(dt, input) {
        const mx = input.mouseScreen.x;
        const my = input.mouseScreen.y;
        const bounds = this._getLayoutBounds();

        this.hoveredBtn = null;

        // Check sector buttons
        for (const btn of bounds.sectorButtons) {
            if (mx >= btn.x && mx <= btn.x + btn.width && my >= btn.y && my <= btn.y + btn.height) {
                if (btn.isCompleted) {
                    this.hoveredBtn = btn.id;
                }
                break;
            }
        }

        // Check Back button
        const b = bounds.btnBack;
        if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
            this.hoveredBtn = b.id;
        }

        // Play audio hover
        if (this.hoveredBtn && this.hoveredBtn !== this.lastHoveredBtn) {
            if (this.audio) this.audio.playFx('ui_hover');
        }
        this.lastHoveredBtn = this.hoveredBtn;

        // Handle clicks
        if (input.leftPressedThisFrame && this.hoveredBtn) {
            if (this.hoveredBtn === 'btn_back') {
                if (this.audio) this.audio.playFx('ui_click');
                if (this.onBack) this.onBack();
            } else if (this.hoveredBtn.startsWith('sector_')) {
                const secIdx = parseInt(this.hoveredBtn.replace('sector_', ''), 10);
                if (this.audio) this.audio.playFx('start_game');
                if (this.onSelectLevel) this.onSelectLevel(secIdx);
            }
        }
    }

    render(ctx) {
        ctx.save();

        // 1. Dark Backdrop
        this.theme.drawModalBackdrop(ctx, 1280, 720);

        const bounds = this._getLayoutBounds();

        // 2. Central Window Frame
        this.theme.drawFrame(ctx, bounds.fx, bounds.fy, bounds.frameW, bounds.frameH, 0);

        // 3. Title Header & Info Subtitle
        ctx.font = '22px CyberpunkPixel, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#070a0e';
        ctx.fillText('SELECT SECTOR', 640 + 1, bounds.fy + 34 + 1);
        ctx.fillStyle = '#f4b03c';
        ctx.fillText('SELECT SECTOR', 640, bounds.fy + 34);

        ctx.font = '12px CyberpunkPixel, monospace';
        ctx.fillStyle = '#6b7c96';
        ctx.fillText('REPLAY ANY PREVIOUSLY COMPLETED SECTOR', 640, bounds.fy + 56);

        // 4. Sector Buttons
        for (const btn of bounds.sectorButtons) {
            const isHover = this.hoveredBtn === btn.id;
            const state = !btn.isCompleted ? 'disabled' : (isHover ? 'hover' : 'normal');
            const variant = btn.isCompleted ? (isHover ? 'amber' : 'slate') : 'slate';

            this.theme.drawButton(ctx, btn, btn.text, state, variant);
        }

        // 5. Back Button
        const isBackHover = this.hoveredBtn === bounds.btnBack.id;
        this.theme.drawButton(
            ctx,
            bounds.btnBack,
            bounds.btnBack.text,
            isBackHover ? 'hover' : 'normal',
            isBackHover ? 'amber' : 'slate'
        );

        ctx.restore();
    }
}
