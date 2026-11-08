/**
 * SaveManager.js
 * Manages game progress serialization to localStorage, enabling
 * "Continue" from checkpoint / active room across browser sessions.
 */
export class SaveManager {
    constructor() {
        this.STORAGE_KEY = 'tether_save_v1';
        this.COMPLETED_KEY = 'tether_completed_v1';

        // Proactively purge legacy pre-release save slots so game starts completely fresh
        try {
            localStorage.removeItem('tether_save_slot_0');
            localStorage.removeItem('tether_completed_levels');
        } catch (e) {}
    }

    hasSave() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            // Require player to have actually progressed past Sector 1 (roomIndex > 0)
            return !!(data && typeof data.roomIndex === 'number' && data.roomIndex > 0 && data.checkpoint && typeof data.checkpoint.x === 'number');
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

    /**
     * Retrieve array of completed room indices.
     * Automatically migrates existing save data if present.
     * @returns {number[]}
     */
    getCompletedLevels() {
        let set = new Set();
        try {
            const raw = localStorage.getItem(this.COMPLETED_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    for (const idx of arr) {
                        if (typeof idx === 'number') set.add(idx);
                    }
                }
            }
        } catch (e) {
            console.warn('[SaveManager] Failed reading completed levels:', e);
        }

        // Auto-migration: if player has reached room N in save, all rooms 0..N-1 are completed
        const saveData = this.getSaveData();
        if (saveData && typeof saveData.roomIndex === 'number' && saveData.roomIndex > 0) {
            let changed = false;
            for (let i = 0; i < saveData.roomIndex; i++) {
                if (!set.has(i)) {
                    set.add(i);
                    changed = true;
                }
            }
            if (changed) {
                this._persistCompletedLevels(set);
            }
        }

        return Array.from(set).sort((a, b) => a - b);
    }

    /**
     * Mark a room index as completed and persist to localStorage.
     * @param {number} roomIndex 
     */
    markLevelCompleted(roomIndex) {
        if (typeof roomIndex !== 'number' || roomIndex < 0) return false;
        try {
            const completed = new Set(this.getCompletedLevels());
            if (!completed.has(roomIndex)) {
                completed.add(roomIndex);
                this._persistCompletedLevels(completed);
            }
            return true;
        } catch (e) {
            console.error('[SaveManager] Failed to mark level completed:', e);
            return false;
        }
    }

    /**
     * Check if a room index has been completed.
     * @param {number} roomIndex 
     * @returns {boolean}
     */
    isLevelCompleted(roomIndex) {
        const completed = this.getCompletedLevels();
        return completed.includes(roomIndex);
    }

    _persistCompletedLevels(set) {
        try {
            const arr = Array.from(set).sort((a, b) => a - b);
            localStorage.setItem(this.COMPLETED_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('[SaveManager] Failed saving completed levels:', e);
        }
    }

    clearCompletedLevels() {
        try {
            localStorage.removeItem(this.COMPLETED_KEY);
            return true;
        } catch (e) {
            return false;
        }
    }
}

