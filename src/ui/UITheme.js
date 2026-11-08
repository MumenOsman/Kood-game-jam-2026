/**
 * UITheme.js
 * Grounded pixel-art theme engine.
 * Renders 9-slice frames, 3-slice buttons, sliders, and badges using
 * the authentic pixel art spritesheet assets and CyberpunkCraftpixPixel font.
 * Strict zero-neon / zero-blur invariant.
 */
export class UITheme {
    constructor(assetLoader) {
        this.assetLoader = assetLoader;
        this.fontName = 'CyberpunkPixel';
        this.tileSize = 32;
    }

    get frameMap() {
        return this.assetLoader ? this.assetLoader.getImage('ui_frame_map') : null;
    }

    get btnMapSlate() {
        return this.assetLoader ? this.assetLoader.getImage('ui_btn_10') : null;
    }

    get btnMapAmber() {
        return this.assetLoader ? this.assetLoader.getImage('ui_btn_5') : null;
    }

    get sliderImg() {
        return this.assetLoader ? this.assetLoader.getImage('ui_slider') : null;
    }

    /**
     * Draw 9-slice pixel window/frame
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {number} w 
     * @param {number} h 
     * @param {number} setIndex 0 to 8 (default 0)
     */
    drawFrame(ctx, x, y, w, h, setIndex = 0) {
        const img = this.frameMap;
        const ts = this.tileSize;

        // Snapping to integer coordinates for razor-sharp pixel rendering
        x = Math.round(x);
        y = Math.round(y);
        w = Math.round(w);
        h = Math.round(h);

        if (!img) {
            // Fallback solid pixel frame
            ctx.fillStyle = '#141a24';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = '#37446e';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, w, h);
            return;
        }

        // Set offset in 288x288 FrameMap (9 sets: 3x3 sets of 96x96)
        const setCol = (setIndex % 3) * 96;
        const setRow = Math.floor(setIndex / 3) * 96;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // In the asset pack, the frame chassis/border is ~14-16px thick.
        // 1. Solid blue base fill for the entire interior to eliminate any perimeter gaps
        const borderInset = 14;
        ctx.fillStyle = '#37446e'; // Authentic slate blue (rgb 55, 68, 110)
        ctx.fillRect(x + borderInset, y + borderInset, w - borderInset * 2, h - borderInset * 2);

        // 2. Patterned Center Fill (setCol + 32, setRow + 32)
        const fillW = Math.max(0, w - borderInset * 2);
        const fillH = Math.max(0, h - borderInset * 2);
        if (fillW > 0 && fillH > 0) {
            ctx.drawImage(img, setCol + ts, setRow + ts, ts, ts, x + borderInset, y + borderInset, fillW, fillH);
        }

        // 3. Edges
        const edgeW = Math.max(0, w - ts * 2);
        const edgeH = Math.max(0, h - ts * 2);

        // Top edge
        if (edgeW > 0) {
            ctx.drawImage(img, setCol + ts, setRow, ts, ts, x + ts, y, edgeW, ts);
        }
        // Bottom edge
        if (edgeW > 0) {
            ctx.drawImage(img, setCol + ts, setRow + ts * 2, ts, ts, x + ts, y + h - ts, edgeW, ts);
        }
        // Left edge
        if (edgeH > 0) {
            ctx.drawImage(img, setCol, setRow + ts, ts, ts, x, y + ts, ts, edgeH);
        }
        // Right edge
        if (edgeH > 0) {
            ctx.drawImage(img, setCol + ts * 2, setRow + ts, ts, ts, x + w - ts, y + ts, ts, edgeH);
        }

        // 4. Corners
        // Top-Left
        ctx.drawImage(img, setCol, setRow, ts, ts, x, y, ts, ts);
        // Top-Right
        ctx.drawImage(img, setCol + ts * 2, setRow, ts, ts, x + w - ts, y, ts, ts);
        // Bottom-Left
        ctx.drawImage(img, setCol, setRow + ts * 2, ts, ts, x, y + h - ts, ts, ts);
        // Bottom-Right
        ctx.drawImage(img, setCol + ts * 2, setRow + ts * 2, ts, ts, x + w - ts, y + h - ts, ts, ts);

        ctx.restore();
    }

    /**
     * Draw 3-slice button
     * @param {CanvasRenderingContext2D} ctx 
     * @param {{x: number, y: number, width: number, height: number}} bounds 
     * @param {string} text 
     * @param {'normal'|'hover'|'pressed'|'disabled'} state 
     * @param {'slate'|'amber'} variant 
     */
    drawButton(ctx, bounds, text, state = 'normal', variant = 'slate') {
        const img = variant === 'amber' ? this.btnMapAmber : this.btnMapSlate;
        const ts = this.tileSize;
        const { x, y, width: w, height: h } = bounds;

        let row = 0;
        let textColor = '#cdd8e6';

        if (state === 'disabled') {
            row = 3;
            textColor = '#556377';
        } else if (state === 'pressed') {
            row = 2;
            textColor = '#ffffff';
        } else if (state === 'hover') {
            row = 1;
            textColor = variant === 'amber' ? '#ffffff' : '#ffd580';
        } else {
            row = 0;
            textColor = variant === 'amber' ? '#ffdf99' : '#b2c2d4';
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (img) {
            const sy = row * ts;
            const capW = 24; // Pixel cap width
            const midSrcW = 16;
            const midDestW = Math.max(0, w - capW * 2);

            // Left cap
            ctx.drawImage(img, 0, sy, capW, ts, x, y, capW, h);

            // Stretched center segment
            if (midDestW > 0) {
                ctx.drawImage(img, 32, sy, midSrcW, ts, x + capW, y, midDestW, h);
            }

            // Right cap
            ctx.drawImage(img, 64 + (32 - capW), sy, capW, ts, x + w - capW, y, capW, h);
        } else {
            // Crisp fallback rectangle
            ctx.fillStyle = state === 'hover' ? '#2f3d54' : '#1e2634';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = state === 'hover' ? '#f4b03c' : '#37446e';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
        }

        // Draw centered button label
        if (text) {
            ctx.font = '16px CyberpunkPixel, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 1px pixel drop shadow (no blur)
            ctx.fillStyle = '#0a0d14';
            ctx.fillText(text, Math.round(x + w / 2) + 1, Math.round(y + h / 2) + 1);

            // Text fill
            ctx.fillStyle = textColor;
            ctx.fillText(text, Math.round(x + w / 2), Math.round(y + h / 2));
        }

        ctx.restore();
    }

    /**
     * Draw pixel volume/value slider
     */
    drawSlider(ctx, bounds, label, value, min = 0, max = 100, isMuted = false) {
        const { x, y, width: w, height: h } = bounds;
        const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Label and value percentage
        ctx.font = '14px CyberpunkPixel, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isMuted ? '#606d80' : '#d2deeb';
        ctx.fillText(label, x, y + 10);

        ctx.textAlign = 'right';
        ctx.fillStyle = isMuted ? '#884444' : '#f4b03c';
        const displayVal = isMuted ? 'MUTED' : `${Math.round(pct * 100)}%`;
        ctx.fillText(displayVal, x + w, y + 10);

        // Slider track
        const trackY = y + 22;
        const trackH = 14;

        // Background track (clean dark slate frame)
        ctx.fillStyle = '#0e121a';
        ctx.fillRect(x, trackY, w, trackH);
        ctx.strokeStyle = '#28354c';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, trackY, w, trackH);

        // Filled active bar
        const fillW = Math.max(0, (w - 4) * pct);
        if (fillW > 0) {
            ctx.fillStyle = isMuted ? '#4a5360' : '#f4b03c';
            ctx.fillRect(x + 2, trackY + 2, fillW, trackH - 4);
        }

        // Thumb handle (pixel notch)
        const thumbX = Math.round(x + 2 + fillW);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.max(x + 1, Math.min(x + w - 7, thumbX - 3)), trackY - 2, 6, trackH + 4);
        ctx.strokeStyle = '#1a2230';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.max(x + 1, Math.min(x + w - 7, thumbX - 3)), trackY - 2, 6, trackH + 4);

        ctx.restore();
    }

    /**
     * Draw pixel keybinding badge
     */
    drawKeyBadge(ctx, bounds, label, isListening = false, isHovered = false) {
        const { x, y, width: w, height: h } = bounds;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = isListening ? '#401818' : (isHovered ? '#2a374d' : '#18202d');
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isListening ? '#ff4444' : (isHovered ? '#f4b03c' : '#37446e');
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.font = '13px CyberpunkPixel, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1px pixel shadow
        ctx.fillStyle = '#0a0d14';
        ctx.fillText(label, Math.round(x + w / 2) + 1, Math.round(y + h / 2) + 1);

        ctx.fillStyle = isListening ? '#ff8888' : (isHovered ? '#ffd580' : '#f4b03c');
        ctx.fillText(label, Math.round(x + w / 2), Math.round(y + h / 2));

        ctx.restore();
    }

    /**
     * Dark modal backdrop veil for pause / options screens
     */
    drawModalBackdrop(ctx, width, height) {
        ctx.save();
        ctx.fillStyle = 'rgba(8, 12, 18, 0.82)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
}

