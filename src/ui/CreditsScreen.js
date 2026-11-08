/**
 * CreditsScreen.js
 * Credits overlay accessible from the Main Menu and presented upon completing the final sector.
 * Features high-contrast typography, pure white text, dimmed backdrop, and strict pixel-art aesthetics.
 */
export class CreditsScreen {
    constructor({ uiTheme, audioManager, onReturnToMenu }) {
        this.theme = uiTheme;
        this.audio = audioManager;
        this.onReturnToMenu = onReturnToMenu;

        this.hoveredBtn = null;
        this.lastHoveredBtn = null;
        this.hoveredLink = null;
    }

    _getLayoutBounds() {
        const cx = 1280 / 2;
        const cy = 720 / 2;
        const frameW = 820;
        const frameH = 610;
        const fx = Math.round(cx - frameW / 2);
        const fy = Math.round(cy - frameH / 2);

        const btnW = 280;
        const btnH = 38;
        const btnReturn = {
            id: 'return_to_menu',
            text: 'RETURN TO MAIN MENU',
            x: cx - btnW / 2,
            y: fy + 524,
            width: btnW,
            height: btnH,
            variant: 'amber'
        };

        const linkMumen = {
            id: 'link_mumen',
            url: 'https://mumen.dev',
            x: cx - 70,
            y: fy + 197,
            width: 140,
            height: 22
        };

        const linkGithub = {
            id: 'link_github',
            url: 'https://github.com/MumenOsman/Kood-game-jam-2026',
            x: cx - 220,
            y: fy + 453,
            width: 440,
            height: 22
        };

        return { cx, cy, frameW, frameH, fx, fy, btnReturn, linkMumen, linkGithub };
    }

    update(dt, input) {
        const { btnReturn, linkMumen, linkGithub } = this._getLayoutBounds();
        const mx = input.mouseScreen.x;
        const my = input.mouseScreen.y;

        // Button hover
        this.hoveredBtn = null;
        if (mx >= btnReturn.x && mx <= btnReturn.x + btnReturn.width &&
            my >= btnReturn.y && my <= btnReturn.y + btnReturn.height) {
            this.hoveredBtn = btnReturn.id;
        }

        // Link hover
        this.hoveredLink = null;
        if (mx >= linkMumen.x && mx <= linkMumen.x + linkMumen.width &&
            my >= linkMumen.y && my <= linkMumen.y + linkMumen.height) {
            this.hoveredLink = linkMumen.url;
        } else if (mx >= linkGithub.x && mx <= linkGithub.x + linkGithub.width &&
                   my >= linkGithub.y && my <= linkGithub.y + linkGithub.height) {
            this.hoveredLink = linkGithub.url;
        }

        // Hover sound
        if (this.hoveredBtn && this.hoveredBtn !== this.lastHoveredBtn) {
            if (this.audio) this.audio.playFx('ui_hover');
        }
        this.lastHoveredBtn = this.hoveredBtn;

        // Click handling
        if (input.leftPressedThisFrame) {
            if (this.hoveredBtn === 'return_to_menu') {
                if (this.audio) this.audio.playFx('ui_click');
                if (this.onReturnToMenu) this.onReturnToMenu();
            } else if (this.hoveredLink) {
                if (this.audio) this.audio.playFx('ui_click');
                try {
                    window.open(this.hoveredLink, '_blank', 'noopener,noreferrer');
                } catch (e) {
                    console.warn('[Credits] Failed to open external URL:', e);
                }
            }
        }
    }

    render(ctx) {
        const { cx, frameW, frameH, fx, fy, btnReturn, linkMumen, linkGithub } = this._getLayoutBounds();

        ctx.save();

        // 1. Extra-Deep Dimmed Backdrop Veil to maximize contrast and focus
        ctx.fillStyle = 'rgba(4, 6, 10, 0.94)';
        ctx.fillRect(0, 0, 1280, 720);

        // 2. Central 9-slice Window Frame
        this.theme.drawFrame(ctx, fx, fy, frameW, frameH, 0);

        // 3. Inner Dark Obsidian Mat to dim patterned blue background and make text pop
        ctx.fillStyle = 'rgba(8, 12, 18, 0.88)';
        ctx.fillRect(fx + 16, fy + 16, frameW - 32, frameH - 32);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Helper for crisp high-contrast drop-shadow text
        const drawShadowText = (text, x, y, color, shadowColor = '#030508') => {
            ctx.fillStyle = shadowColor;
            ctx.fillText(text, x + 1, y + 1);
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
        };

        // 4. Header Title & Subheader
        ctx.font = '28px CyberpunkPixel, monospace';
        ctx.fillStyle = '#030508';
        ctx.fillText('THANKS FOR PLAYING!', cx + 2, fy + 55 + 2);
        ctx.fillStyle = '#f4b03c';
        ctx.fillText('THANKS FOR PLAYING!', cx, fy + 55);

        // Subheader (original slate grey)
        ctx.font = '14px CyberpunkPixel, monospace';
        drawShadowText('Created for the //kood Game Jam [Platformers] 2026.', cx, fy + 88, '#8a9bb8');

        // Top divider
        ctx.strokeStyle = '#27354a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx + 40, fy + 112);
        ctx.lineTo(fx + frameW - 40, fy + 112);
        ctx.stroke();

        // 5. Developer Section (original slate grey sentences & white name)
        ctx.font = '14px CyberpunkPixel, monospace';
        drawShadowText('Solo developed with love (and plenty of caffeine) by:', cx, fy + 144, '#94a3b8');

        // Developer Name (prominent pure white)
        ctx.font = '22px CyberpunkPixel, monospace';
        ctx.fillStyle = '#030508';
        ctx.fillText('Mumen Osman', cx + 1, fy + 178 + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Mumen Osman', cx, fy + 178);

        // Website Link (luminous cyan)
        ctx.font = '16px CyberpunkPixel, monospace';
        const isMumenHovered = (this.hoveredLink === linkMumen.url);
        const mumenColor = isMumenHovered ? '#7dd3fc' : '#38bdf8';
        drawShadowText('mumen.dev', cx, fy + 208, mumenColor);

        ctx.strokeStyle = mumenColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 44, fy + 218);
        ctx.lineTo(cx + 44, fy + 218);
        ctx.stroke();

        // Roles (original slate grey)
        ctx.font = '14px CyberpunkPixel, monospace';
        drawShadowText('Design, Programming, and Custom Art', cx, fy + 236, '#94a3b8');

        // Mid divider
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(fx + 80, fy + 264);
        ctx.lineTo(fx + frameW - 80, fy + 264);
        ctx.stroke();

        // 6. Additional Assets
        ctx.font = '16px CyberpunkPixel, monospace';
        drawShadowText('Additional Assets:', cx, fy + 298, '#f4b03c');

        ctx.font = '14px CyberpunkPixel, monospace';
        drawShadowText('2D Pixel Art, GUI, and Audio Assets provided by CraftPix.net', cx, fy + 324, '#cbd5e1');

        // 7. Built With
        ctx.font = '16px CyberpunkPixel, monospace';
        drawShadowText('Built With', cx, fy + 368, '#f4b03c');

        ctx.font = '14px CyberpunkPixel, monospace';
        drawShadowText('Custom game engine, LDtk, and Penpot', cx, fy + 394, '#cbd5e1');

        // 8. Source Code
        ctx.font = '16px CyberpunkPixel, monospace';
        drawShadowText('Source code:', cx, fy + 438, '#f4b03c');

        ctx.font = '13px CyberpunkPixel, monospace';
        const isGithubHovered = (this.hoveredLink === linkGithub.url);
        const githubColor = isGithubHovered ? '#7dd3fc' : '#38bdf8';
        drawShadowText('https://github.com/MumenOsman/Kood-game-jam-2026', cx, fy + 464, githubColor);

        ctx.strokeStyle = githubColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 188, fy + 474);
        ctx.lineTo(cx + 188, fy + 474);
        ctx.stroke();

        // Bottom divider before return button
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(fx + 80, fy + 498);
        ctx.lineTo(fx + frameW - 80, fy + 498);
        ctx.stroke();

        // 9. Return to Main Menu Button
        const btnState = (this.hoveredBtn === btnReturn.id) ? 'hover' : 'normal';
        this.theme.drawButton(ctx, btnReturn, btnReturn.text, btnState, btnReturn.variant);

        ctx.restore();
    }
}
