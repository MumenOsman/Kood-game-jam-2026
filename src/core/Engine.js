/**
 * Engine.js
 * Fixed-timestep game loop (60Hz accumulator) with decoupled variable rendering,
 * and modular lifecycle management for independent systems.
 */
export class Engine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.systems = [];
        this.isRunning = false;
        this.isPaused = false;

        // Timing parameters
        this.fixedDt = 1 / 60; // 60 updates per second (16.66ms)
        this.maxAccumulatedTime = 0.25; // Prevent spiral of death on lag
        this.accumulator = 0;
        this.lastTimestamp = 0;

        this._animationFrameId = null;
        this._loop = this._loop.bind(this);
    }

    /**
     * Register a modular system.
     * @param {{name?: string, init?: Function, update?: Function, render?: Function}} system 
     */
    registerSystem(system) {
        this.systems.push(system);
        if (typeof system.init === 'function') {
            system.init(this);
        }
        return this;
    }

    getSystem(name) {
        return this.systems.find(s => s.name === name) || null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTimestamp = performance.now();
        this.accumulator = 0;
        this._animationFrameId = requestAnimationFrame(this._loop);
    }

    stop() {
        this.isRunning = false;
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this.lastTimestamp = performance.now();
    }

    _loop(timestamp) {
        if (!this.isRunning) return;

        let frameTime = (timestamp - this.lastTimestamp) / 1000;
        this.lastTimestamp = timestamp;

        if (frameTime > this.maxAccumulatedTime) {
            frameTime = this.maxAccumulatedTime;
        }

        if (!this.isPaused) {
            this.accumulator += frameTime;

            // Fixed-timestep update steps
            while (this.accumulator >= this.fixedDt) {
                this._fixedUpdate(this.fixedDt);
                this.accumulator -= this.fixedDt;
            }
        }

        // Render with interpolation alpha
        const alpha = this.accumulator / this.fixedDt;
        this._render(alpha);

        this._animationFrameId = requestAnimationFrame(this._loop);
    }

    _fixedUpdate(dt) {
        for (let i = 0; i < this.systems.length; i++) {
            const system = this.systems[i];
            if (typeof system.update === 'function') {
                system.update(dt);
            }
        }
    }

    _render(alpha) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.systems.length; i++) {
            const system = this.systems[i];
            if (typeof system.render === 'function') {
                system.render(this.ctx, alpha);
            }
        }
    }
}

