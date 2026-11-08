/**
 * AudioManager.js
 * Manages background music tracks, sound effects, volume buses (Master, Music, FX),
 * audio persistence in localStorage, and Web Audio unlock on user gesture.
 */
export class AudioManager {
    constructor() {
        this.STORAGE_KEY = 'tether_audio_config';

        // Volumes (0.0 to 1.0)
        this.masterVolume = 1.0;
        this.musicVolume = 0.7;
        this.fxVolume = 0.8;
        this.isMuted = false;

        // Tracks definition
        this.musicSources = {
            main_menu: './assets/audio/music/main_menu.mp3',
            game_levels: './assets/audio/music/game_levels.mp3',
            special_level: './assets/audio/music/warped_vehicles.mp3'
        };

        this.fxSources = {
            // UI
            ui_click: './assets/audio/sfx/ui_click.mp3',
            ui_hover: './assets/audio/sfx/ui_hover.mp3',
            start_game: './assets/audio/sfx/start_game.mp3',
            confirm: './assets/audio/sfx/confirm.mp3',

            // Tether & Wire
            wire_launch: './assets/audio/sfx/wire_launch.mp3',
            wire_connect: './assets/audio/sfx/wire_connect.mp3',
            wire_disconnect: './assets/audio/sfx/wire_disconnect.mp3',

            // Locomotion
            player_jump: './assets/audio/sfx/player_jump.mp3',
            footstep: './assets/audio/sfx/footstep.mp3',
            bump: './assets/audio/sfx/bump.mp3',

            // Circuits & Doors
            dial_rotate: './assets/audio/sfx/dial_rotate.mp3',
            gate_connect: './assets/audio/sfx/gate_connect.mp3',
            circuit_solved: './assets/audio/sfx/circuit_solved.mp3',
            door_open: './assets/audio/sfx/door_open.mp3',
            door_close: './assets/audio/sfx/door_close.mp3',

            // Energy, Hazards & World
            laser_zap: './assets/audio/sfx/laser_zap.mp3',
            player_respawn: './assets/audio/sfx/player_respawn.mp3',
            player_charge: './assets/audio/sfx/player_charge.mp3',
            room_transition: './assets/audio/sfx/room_transition.mp3',
            access_granted: './assets/audio/sfx/access_granted.mp3',
            access_denied: './assets/audio/sfx/access_denied.mp3'
        };

        // Current active music element
        this.currentMusicKey = null;
        this.currentMusicAudio = null;

        // FX sound pool cache (Map of key -> Audio[])
        this.fxAudioPool = new Map();
        this.MAX_POOL_PER_KEY = 4;

        // Load persisted preferences
        this._loadSettings();

        // Browser autoplay unlock
        this.isUnlocked = false;
        this._setupAutoplayUnlock();
        this._warmupPool();

        // Track visited rooms to ensure room transition sound plays only once on first-time entry
        this.visitedRooms = new Set([0, 'Tutorial_jump']);
    }

    resetVisitedRooms(initialRoom = 0) {
        this.visitedRooms = new Set([initialRoom, 'Tutorial_jump']);
    }

    _warmupPool() {
        // Pre-create initial Audio objects so first trigger is instantaneous
        try {
            for (const key of Object.keys(this.fxSources)) {
                const audio = new Audio(this.fxSources[key]);
                audio.preload = 'auto';
                this.fxAudioPool.set(key, [audio]);
            }
        } catch (e) {
            // Audio preload not available in current environment
        }
    }

    _loadSettings() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const cfg = JSON.parse(raw);
                if (typeof cfg.master === 'number') this.masterVolume = Math.max(0, Math.min(1, cfg.master));
                if (typeof cfg.music === 'number') this.musicVolume = Math.max(0, Math.min(1, cfg.music));
                if (typeof cfg.fx === 'number') this.fxVolume = Math.max(0, Math.min(1, cfg.fx));
                if (typeof cfg.muted === 'boolean') this.isMuted = cfg.muted;
            }
        } catch (e) {
            console.warn('[AudioManager] Could not load audio settings from localStorage:', e);
        }
    }

    _saveSettings() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                master: this.masterVolume,
                music: this.musicVolume,
                fx: this.fxVolume,
                muted: this.isMuted
            }));
        } catch (e) {
            console.warn('[AudioManager] Could not save audio settings to localStorage:', e);
        }
    }

    _setupAutoplayUnlock() {
        const unlock = () => {
            if (this.isUnlocked) return;
            this.isUnlocked = true;
            if (this.currentMusicAudio && this.currentMusicAudio.paused) {
                this.currentMusicAudio.play().catch(() => {});
            }
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
    }

    getEffectiveMusicVolume() {
        if (this.isMuted) return 0;
        return this.masterVolume * this.musicVolume;
    }

    getEffectiveFxVolume() {
        if (this.isMuted) return 0;
        return this.masterVolume * this.fxVolume;
    }

    setMasterVolume(val) {
        this.masterVolume = Math.max(0, Math.min(1, val));
        this._applyMusicVolume();
        this._saveSettings();
    }

    setMusicVolume(val) {
        this.musicVolume = Math.max(0, Math.min(1, val));
        this._applyMusicVolume();
        this._saveSettings();
    }

    setFxVolume(val) {
        this.fxVolume = Math.max(0, Math.min(1, val));
        this._saveSettings();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this._applyMusicVolume();
        this._saveSettings();
        return this.isMuted;
    }

    _applyMusicVolume() {
        if (this.currentMusicAudio) {
            this.currentMusicAudio.volume = this.getEffectiveMusicVolume();
        }
    }

    playMusic(key, restart = false) {
        if (!this.musicSources[key]) return;
        if (this.currentMusicKey === key && this.currentMusicAudio && !restart) {
            if (this.currentMusicAudio.paused && this.isUnlocked) {
                this.currentMusicAudio.play().catch(() => {});
            }
            return;
        }

        // Fade out or pause existing
        if (this.currentMusicAudio) {
            this.currentMusicAudio.onended = null;
            this.currentMusicAudio.pause();
            this.currentMusicAudio.currentTime = 0;
        }

        this.currentMusicKey = key;
        const audio = new Audio(this.musicSources[key]);
        audio.loop = true;
        // Guaranteed seamless loop fallback across all browsers
        audio.onended = () => {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        };
        audio.volume = this.getEffectiveMusicVolume();
        this.currentMusicAudio = audio;

        if (this.isUnlocked) {
            audio.play().catch(err => {
                console.warn('[AudioManager] Music play blocked, waiting for interaction:', err);
            });
        }
    }

    stopMusic() {
        if (this.currentMusicAudio) {
            this.currentMusicAudio.pause();
            this.currentMusicAudio.currentTime = 0;
            this.currentMusicKey = null;
        }
    }

    playFx(key, volumeScale = 1.0) {
        if (this.isMuted || !this.fxSources[key]) return;
        const effVol = this.getEffectiveFxVolume() * volumeScale;
        if (effVol <= 0.001) return;

        try {
            if (!this.fxAudioPool.has(key)) {
                this.fxAudioPool.set(key, []);
            }
            const pool = this.fxAudioPool.get(key);
            let sfx = pool.find(a => a.paused || a.ended);
            if (!sfx) {
                if (pool.length < this.MAX_POOL_PER_KEY) {
                    sfx = new Audio(this.fxSources[key]);
                    pool.push(sfx);
                } else {
                    sfx = pool[0]; // Recycle oldest instance
                }
            }
            sfx.currentTime = 0;
            sfx.volume = Math.max(0, Math.min(1, effVol));
            sfx.play().catch(() => {});
        } catch (e) {
            // Audio play failed or blocked
        }
    }

    /**
     * Bind AudioManager directly to EventBus to react to gameplay,
     * hazard, tether, circuit, and player locomotion events automatically.
     */
    attachEventBus(eventBus) {
        if (!eventBus) return;
        this.eventBus = eventBus;

        // Wire / Tether (latching/removing intentionally silent per specification; launch has audio)
        eventBus.on('WIRE_LAUNCHED', () => this.playFx('wire_launch', 0.8));

        // Locomotion
        eventBus.on('PLAYER_JUMP', () => this.playFx('player_jump', 0.75));
        eventBus.on('PLAYER_WALL_JUMP', () => this.playFx('player_jump', 0.75));
        eventBus.on('PLAYER_TETHER_JUMP', () => this.playFx('player_jump', 0.85));
        eventBus.on('PLAYER_LAND', () => this.playFx('bump', 0.45));
        eventBus.on('PLAYER_FOOTSTEP', () => this.playFx('footstep', 0.25));

        // Circuits & Rotary Dials
        eventBus.on('CIRCUIT_UPDATED', () => this.playFx('dial_rotate', 0.9));

        // Blast Doors & Solved Circuits
        eventBus.on('ACTIVATE_DEVICE', (deviceId) => {
            const id = String(deviceId || '').toLowerCase();
            if (id.includes('door')) {
                this.playFx('door_open', 0.9);
                this.playFx('circuit_solved', 0.85);
            }
        });

        eventBus.on('DEACTIVATE_DEVICE', (deviceId) => {
            const id = String(deviceId || '').toLowerCase();
            if (id.includes('door')) {
                this.playFx('door_close', 0.85);
            }
        });

        // Hazards, Respawn & Battery
        eventBus.on('PLAYER_LASER_CONTACT', () => this.playFx('laser_zap', 0.95));
        eventBus.on('PLAYER_RESPAWN', () => this.playFx('player_respawn', 0.85));
        eventBus.on('CHARGER_CONNECTED', () => this.playFx('player_charge', 0.95));

        // Room / Sector progression (plays only once when entering each room for the first time)
        eventBus.on('ROOM_CHANGED', (payload) => {
            const key = (payload && payload.roomId) || (payload && payload.roomIndex !== undefined ? payload.roomIndex : payload);
            if (key !== undefined && key !== null) {
                if (!this.visitedRooms.has(key)) {
                    this.visitedRooms.add(key);
                    if (payload && payload.roomIndex !== undefined) {
                        this.visitedRooms.add(payload.roomIndex);
                    }
                    this.playFx('room_transition', 0.8);
                }
            }
        });

        // Drone / Terminal interaction
        eventBus.on('DRONE_INTERACT', (e) => this.playFx(e && e.isOpen ? 'access_granted' : 'access_denied', 0.8));
    }
}

