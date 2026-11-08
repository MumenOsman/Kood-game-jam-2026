/**
 * SaveManager.js
 * Manages game progress serialization to localStorage, enabling
 * "Continue" from checkpoint / active room across browser sessions.
 */
export class SaveManager {
    constructor() {
        this.STORAGE_KEY = 'tether_save_slot_0';
    }

    hasSave() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            return data && typeof data.roomIndex === 'number' && data.checkpoint && typeof data.checkpoint.x === 'number';
        } catch (e) {
            return false;
        }
    }

    getSaveData() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[SaveManager] Failed to read save file:', e);
            return null;
        }
    }

    saveGame({ roomIndex = 0, checkpoint = { x: 0, y: 0 }, battery = 100, roomName = 'Sector 1' } = {}) {
        try {
            const payload = {
                roomIndex,
                checkpoint,
                battery,
                roomName,
                timestamp: Date.now(),
                dateStr: new Date().toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error('[SaveManager] Failed to write save file:', e);
            return false;
        }
    }

    clearSave() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('[SaveManager] Failed to clear save:', e);
            return false;
        }
    }
}

