/**
 * OptionsMenu.js
 * Options overlay featuring:
 * 1. Audio controls (Master, Music, FX sliders with real-time feedback & muting)
 * 2. Controls rebinding table with interactive listening state and Reset Defaults
 * 3. Back button returning to caller (Main Menu or Pause Menu).
 */
export class OptionsMenu {
    constructor({ uiTheme, audioManager, inputManager, onBack }) {
        this.theme = uiTheme;
        this.audio = audioManager;
        this.input = inputManager;
        this.onBack = onBack;

        this.currentTab = 'audio'; // 'audio' | 'controls'

        // Audio slider interaction
        this.activeSlider = null; // 'master' | 'music' | 'fx' | null

        // Controls rebinding state
        this.rebindingAction = null; // action name being rebound or null
        this.hoveredBadge = null;

        // Hover tracking
        this.hoveredBtn = null;
        this.lastHoveredBtn = null;

        this._bindRebindListener();
    }

    _bindRebindListener() {
        window.addEventListener('keydown', (e) => {
            if (!this.rebindingAction) return;
            e.preventDefault();
            e.stopPropagation();

            if (e.code === 'Escape') {
                // Cancel rebinding
                this.rebindingAction = null;
                if (this.audio) this.audio.playFx('ui_click');
                return;
            }

            this.input.rebind(this.rebindingAction, e.code);
            this.rebindingAction = null;
            if (this.audio) this.audio.playFx('confirm');
        }, true);

        window.addEventListener('mousedown', (e) => {
            if (!this.rebindingAction) return;
            // Allow rebinding to Mouse0 or Mouse2
            let mouseCode = null;
            if (e.button === 0) mouseCode = 'Mouse0';
            else if (e.button === 2) mouseCode = 'Mouse2';
            else if (e.button === 1) mouseCode = 'Mouse1';

            if (mouseCode) {
                this.input.rebind(this.rebindingAction, mouseCode);
                this.rebindingAction = null;
                if (this.audio) this.audio.playFx('confirm');
            }
        }, true);
    }

    update(dt, input) {
        const mx = input.mouseScreen.x;
        const my = input.mouseScreen.y;

        const bounds = this._getLayoutBounds();
        this.hoveredBtn = null;
        this.hoveredBadge = null;

        // 1. Tab buttons
        if (mx >= bounds.tabAudio.x && mx <= bounds.tabAudio.x + bounds.tabAudio.width &&
            my >= bounds.tabAudio.y && my <= bounds.tabAudio.y + bounds.tabAudio.height) {
            this.hoveredBtn = 'tab_audio';
        } else if (mx >= bounds.tabControls.x && mx <= bounds.tabControls.x + bounds.tabControls.width &&
            my >= bounds.tabControls.y && my <= bounds.tabControls.y + bounds.tabControls.height) {
            this.hoveredBtn = 'tab_controls';
        } else if (mx >= bounds.btnBack.x && mx <= bounds.btnBack.x + bounds.btnBack.width &&
            my >= bounds.btnBack.y && my <= bounds.btnBack.y + bounds.btnBack.height) {
            this.hoveredBtn = 'btn_back';
        }

        // 2. Tab-specific interactions
        if (this.currentTab === 'audio') {
            // Mute toggle button
            if (mx >= bounds.btnMute.x && mx <= bounds.btnMute.x + bounds.btnMute.width &&
                my >= bounds.btnMute.y && my <= bounds.btnMute.y + bounds.btnMute.height) {
                this.hoveredBtn = 'btn_mute';
            }

            // Slider drag tracking
            if (input.isLeftDown) {
                if (this.activeSlider || input.leftPressedThisFrame) {
                    const checkSlider = (sliderKey, b) => {
                        const trackY = b.y + 22;
                        if (input.leftPressedThisFrame && mx >= b.x && mx <= b.x + b.width && my >= trackY - 6 && my <= trackY + 22) {
                            this.activeSlider = sliderKey;
                        }
                        if (this.activeSlider === sliderKey) {
                            const pct = Math.max(0, Math.min(1, (mx - b.x) / b.width));
                            if (sliderKey === 'master') this.audio.setMasterVolume(pct);
                            else if (sliderKey === 'music') this.audio.setMusicVolume(pct);
                            else if (sliderKey === 'fx') this.audio.setFxVolume(pct);
                        }
                    };

                    checkSlider('master', bounds.sliderMaster);
                    checkSlider('music', bounds.sliderMusic);
                    checkSlider('fx', bounds.sliderFx);
                }
            } else {
                if (this.activeSlider === 'fx') {
                    this.audio.playFx('confirm');
                }
                this.activeSlider = null;
            }
        } else if (this.currentTab === 'controls') {
            // Reset defaults button
            if (mx >= bounds.btnReset.x && mx <= bounds.btnReset.x + bounds.btnReset.width &&
                my >= bounds.btnReset.y && my <= bounds.btnReset.y + bounds.btnReset.height) {
                this.hoveredBtn = 'btn_reset';
            }

            // Check badges
            for (const item of bounds.controlItems) {
                const b = item.badgeBounds;
                if (mx >= b.x && mx <= b.x + b.width && my >= b.y && my <= b.y + b.height) {
                    this.hoveredBadge = item.action;
                    break;
                }
            }

            if (input.leftPressedThisFrame && this.hoveredBadge && !this.rebindingAction) {
                this.rebindingAction = this.hoveredBadge;
                if (this.audio) this.audio.playFx('ui_click');
            }
        }

        // Sound on hover change
        if (this.hoveredBtn && this.hoveredBtn !== this.lastHoveredBtn) {
            if (this.audio) this.audio.playFx('ui_hover');
        }
        this.lastHoveredBtn = this.hoveredBtn;

        // Button Clicks
        if (input.leftPressedThisFrame) {
            if (this.hoveredBtn === 'tab_audio') {
                this.currentTab = 'audio';
                this.rebindingAction = null;
                if (this.audio) this.audio.playFx('ui_click');
            } else if (this.hoveredBtn === 'tab_controls') {
                this.currentTab = 'controls';
                if (this.audio) this.audio.playFx('ui_click');
            } else if (this.hoveredBtn === 'btn_mute') {
                this.audio.toggleMute();
                if (this.audio) this.audio.playFx('ui_click');
            } else if (this.hoveredBtn === 'btn_reset') {
                this.input.resetDefaults();
                this.rebindingAction = null;
                if (this.audio) this.audio.playFx('confirm');
            } else if (this.hoveredBtn === 'btn_back') {
                this.rebindingAction = null;
                if (this.audio) this.audio.playFx('ui_click');
                if (this.onBack) this.onBack();
            }
        }
    }

    _getLayoutBounds() {
        const cx = 1280 / 2;
        const cy = 720 / 2;
        const frameW = 680;
        const frameH = 500;
        const fx = cx - frameW / 2;
        const fy = cy - frameH / 2;

        const tabW = 160;
        const tabH = 32;
        const tabY = fy + 65;

        // Tab buttons
        const tabAudio = { x: fx + 50, y: tabY, width: tabW, height: tabH };
        const tabControls = { x: fx + 50 + tabW + 12, y: tabY, width: tabW, height: tabH };

        // Audio controls
        const sliderW = 420;
        const sliderH = 42;
        const audioStartY = tabY + 52;
        const sliderMaster = { x: cx - sliderW / 2, y: audioStartY, width: sliderW, height: sliderH };
        const sliderMusic = { x: cx - sliderW / 2, y: audioStartY + 64, width: sliderW, height: sliderH };
        const sliderFx = { x: cx - sliderW / 2, y: audioStartY + 128, width: sliderW, height: sliderH };
        const btnMute = { x: cx - 80, y: audioStartY + 195, width: 160, height: 36 };

        // Controls items (table)
        const actionsList = [
            { action: 'moveLeft', label: 'MOVE LEFT' },
            { action: 'moveRight', label: 'MOVE RIGHT' },
            { action: 'jump', label: 'JUMP / WALL JUMP' },
            { action: 'dock', label: 'DOCK / SLIDE / REEL DOWN' },
            { action: 'moveUp', label: 'REEL CABLE UP' },
            { action: 'interact', label: 'ROTATE JUNCTION / DOCK' },
            { action: 'shootWire', label: 'SHOOT WIRE' },
            { action: 'cutWire', label: 'CUT WIRE' }
        ];

        const controlStartY = tabY + 44;
        const itemRowH = 26;
        const controlItems = actionsList.map((item, idx) => {
            const rowY = controlStartY + idx * itemRowH;
            return {
                action: item.action,
                label: item.label,
                rowY,
                badgeBounds: { x: cx + 45, y: rowY, width: 180, height: 22 }
            };
        });

        const btnReset = { x: cx - 110, y: fy + frameH - 85, width: 220, height: 32 };
        const btnBack = { x: cx - 90, y: fy + frameH - 46, width: 180, height: 32 };

        return {
            fx, fy, frameW, frameH,
            tabAudio, tabControls,
            sliderMaster, sliderMusic, sliderFx, btnMute,
            controlItems, btnReset,
            btnBack
        };
    }

    render(ctx) {
        ctx.save();

        // 1. Dark Backdrop
        this.theme.drawModalBackdrop(ctx, 1280, 720);

        const bounds = this._getLayoutBounds();

        // 2. Window Frame
        this.theme.drawFrame(ctx, bounds.fx, bounds.fy, bounds.frameW, bounds.frameH, 0);

        // 3. Title Header (Well-padded with room to breathe inside frame)
        ctx.font = '22px CyberpunkPixel, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#070a0e';
        ctx.fillText('SYSTEM CONFIGURATION', 640 + 1, bounds.fy + 38 + 1);
        ctx.fillStyle = '#f4b03c';
        ctx.fillText('SYSTEM CONFIGURATION', 640, bounds.fy + 38);

        // 4. Tabs
        const isAudioActive = this.currentTab === 'audio';
        this.theme.drawButton(ctx, bounds.tabAudio, 'AUDIO', isAudioActive ? 'pressed' : (this.hoveredBtn === 'tab_audio' ? 'hover' : 'normal'), isAudioActive ? 'amber' : 'slate');
        this.theme.drawButton(ctx, bounds.tabControls, 'CONTROLS', !isAudioActive ? 'pressed' : (this.hoveredBtn === 'tab_controls' ? 'hover' : 'normal'), !isAudioActive ? 'amber' : 'slate');

        // 5. Active Tab Contents
        if (isAudioActive) {
            this._renderAudioTab(ctx, bounds);
        } else {
            this._renderControlsTab(ctx, bounds);
        }

        // 6. Back Button
        this.theme.drawButton(ctx, bounds.btnBack, 'BACK', this.hoveredBtn === 'btn_back' ? 'hover' : 'normal', 'slate');

        ctx.restore();
    }

    _renderAudioTab(ctx, bounds) {
        const isMuted = this.audio ? this.audio.isMuted : false;

        // Sliders
        const masterVal = this.audio ? this.audio.masterVolume * 100 : 100;
        const musicVal = this.audio ? this.audio.musicVolume * 100 : 70;
        const fxVal = this.audio ? this.audio.fxVolume * 100 : 80;

        this.theme.drawSlider(ctx, bounds.sliderMaster, 'MASTER VOLUME', masterVal, 0, 100, isMuted);
        this.theme.drawSlider(ctx, bounds.sliderMusic, 'MUSIC VOLUME', musicVal, 0, 100, isMuted);
        this.theme.drawSlider(ctx, bounds.sliderFx, 'SOUND FX VOLUME', fxVal, 0, 100, isMuted);

        // Mute Toggle Button (Simple, concise label)
        const muteLabel = isMuted ? 'UNMUTE' : 'MUTE';
        this.theme.drawButton(ctx, bounds.btnMute, muteLabel, this.hoveredBtn === 'btn_mute' ? 'hover' : 'normal', isMuted ? 'amber' : 'slate');
    }

    _renderControlsTab(ctx, bounds) {
        ctx.save();

        const cx = 1280 / 2;

        for (const item of bounds.controlItems) {
            // Label
            ctx.font = '12px CyberpunkPixel, monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#b8c6d4';
            ctx.fillText(item.label, cx + 25, item.rowY + 11);

            // Key Badge
            const isListening = this.rebindingAction === item.action;
            const isHovered = this.hoveredBadge === item.action;
            const keyText = isListening ? 'PRESS KEY...' : this.input.getBindingDisplayName(item.action);

            this.theme.drawKeyBadge(ctx, item.badgeBounds, keyText, isListening, isHovered);
        }

        // Rebinding instruction only shown when actively rebinding
        if (this.rebindingAction) {
            ctx.font = '12px CyberpunkPixel, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ff8888';
            ctx.fillText('PRESS ANY KEY OR MOUSE BUTTON // ESC TO CANCEL', cx, bounds.btnReset.y - 12);
        }

        // Reset Defaults Button
        this.theme.drawButton(ctx, bounds.btnReset, 'RESET DEFAULTS', this.hoveredBtn === 'btn_reset' ? 'hover' : 'normal', 'slate');

        ctx.restore();
    }
}

