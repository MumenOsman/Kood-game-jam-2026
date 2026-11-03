/**
 * AssetLoader.js
 * Asynchronous loader and caching manager for game images, spritesheets, and JSON metadata.
 */
export class AssetLoader {
    constructor() {
        this.images = new Map();
        this.jsonData = new Map();
        this.loadedCount = 0;
        this.totalCount = 0;
    }

    /**
     * Load an image file
     * @param {string} key 
     * @param {string} src 
     * @returns {Promise<HTMLImageElement>}
     */
    loadImage(key, src) {
        this.totalCount++;
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(key, img);
                this.loadedCount++;
                resolve(img);
            };
            img.onerror = (err) => {
                console.warn(`[AssetLoader] Failed to load image: ${src}`, err);
                this.loadedCount++;
                // Create a 1x1 placeholder
                const canvas = document.createElement('canvas');
                canvas.width = 32;
                canvas.height = 32;
                this.images.set(key, canvas);
                resolve(canvas);
            };
            img.src = src;
        });
    }

    /**
     * Load a JSON file
     * @param {string} key 
     * @param {string} url 
     * @returns {Promise<any>}
     */
    async loadJSON(key, url) {
        this.totalCount++;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            this.jsonData.set(key, data);
            this.loadedCount++;
            return data;
        } catch (err) {
            console.warn(`[AssetLoader] Failed to load JSON: ${url}`, err);
            this.loadedCount++;
            this.jsonData.set(key, null);
            return null;
        }
    }

    getImage(key) {
        return this.images.get(key) || null;
    }

    getJSON(key) {
        return this.jsonData.get(key) || null;
    }

    get progress() {
        return this.totalCount === 0 ? 1 : this.loadedCount / this.totalCount;
    }
}

