/**
 * EventBus.js
 * Central decoupled Pub/Sub communication hub for the game engine and modular systems.
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event topic.
     * @param {string} event 
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once.
     * @param {string} event 
     * @param {Function} callback 
     */
    once(event, callback) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback(...args);
        };
        this.on(event, wrapper);
    }

    /**
     * Unsubscribe a specific callback from an event.
     * @param {string} event 
     * @param {Function} callback 
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
            if (this.listeners.get(event).size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Emit an event to all registered subscribers.
     * @param {string} event 
     * @param {...any} args 
     */
    emit(event, ...args) {
        if (!this.listeners.has(event)) return;
        for (const callback of this.listeners.get(event)) {
            try {
                callback(...args);
            } catch (err) {
                console.error(`[EventBus] Error in listener for event "${event}":`, err);
            }
        }
    }

    /**
     * Clear all event listeners.
     */
    clear() {
        this.listeners.clear();
    }
}

