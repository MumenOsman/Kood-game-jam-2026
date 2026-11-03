/**
 * main.js
 * Bootstrap entry point: initializes core systems, loads assets,
 * registers modular systems with Engine and EventBus, and starts loop.
 */
import { EventBus } from './core/EventBus.js';
import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { Camera } from './core/Camera.js';
import { AssetLoader } from './core/AssetLoader.js';

import { Player } from './entities/Player.js';
import { PlayerMovement } from './modules/PlayerMovement.js';
import { WireSystem } from './modules/WireSystem.js';
import { CircuitSystem } from './modules/CircuitSystem.js';
import { HazardSystem } from './modules/HazardSystem.js';
import { AnimationController } from './modules/AnimationController.js';
import { TestRoom } from './levels/TestRoom.js';
import { HUD } from './ui/HUD.js';

async function bootstrap() {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = 1280;
    canvas.height = 720;

    // 1. Core Services
    const eventBus = new EventBus();
    const assetLoader = new AssetLoader();
    const camera = new Camera(canvas.width, canvas.height);
    const input = new InputManager(canvas, camera);
    const engine = new Engine(canvas);

    // 2. Load Assets (spritesheet and bounds metadata)
    await Promise.all([
        assetLoader.loadImage('hero_sheet', './assets/sprites/Hero-sprites.png'),
        assetLoader.loadJSON('hero_meta', './assets/sprites/Hero-sprites.json')
    ]);

    // 3. Entity & Level Setup
    const player = new Player(120, 480);
    const circuitSystem = new CircuitSystem(eventBus, input, player);
    const level = new TestRoom(eventBus, circuitSystem);
    camera.setBounds(0, 0, level.width, level.height);
    camera.snapTo(player.x, player.y);

    // 4. Modules
    const movement = new PlayerMovement(eventBus, input, player, level);
    const wireSystem = new WireSystem(eventBus, input, player, level);
    const hazardSystem = new HazardSystem(eventBus, player, level);
    const animation = new AnimationController(assetLoader);
    const hud = new HUD(player, camera);

    // 5. Global Event Notifications
    eventBus.on('CIRCUIT_UPDATED', ({ nodeId }) => {
        hud.setMessage('Circuit junction re-routed! Tracing power grid...');
    });

    eventBus.on('ACTIVATE_DEVICE', (deviceId) => {
        if (deviceId === 'exit_door') {
            hud.setMessage('POWER RESTORED: Blast door unlocking!', 5);
        } else if (deviceId === 'shaft_left_wall') {
            hud.setMessage('WARNING: Shaft left wall energized with high voltage!', 4);
        }
    });

    eventBus.on('DEACTIVATE_DEVICE', (deviceId) => {
        if (deviceId === 'shaft_left_wall') {
            hud.setMessage('SHAFT HAZARD OFFLINE: Wall safe for climbing!', 5);
        }
    });

    eventBus.on('PLAYER_SHOCKED', ({ damage }) => {
        hud.setMessage(`HIGH VOLTAGE SHOCK: -${damage.toFixed(0)}% POWER`, 3.5);
    });

    eventBus.on('PLAYER_TETHER_JUMP', () => {
        hud.setMessage('Tether jump executed!');
    });

    // 6. DevTools / Debug System (Development & Localhost Only - Never loaded in production)
    const IS_DEV = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.search.includes('debug=true')
    );

    let devTools = null;
    if (IS_DEV) {
        try {
            const { DevTools } = await import('./debug/DevTools.js');
            devTools = new DevTools({
                engine,
                eventBus,
                input,
                player,
                camera,
                movement,
                wireSystem,
                circuitSystem,
                hazardSystem,
                level,
                hud,
                canvas
            });
            devTools.init();
        } catch (err) {
            console.warn('[DevTools] Could not load debug module:', err);
        }
    }

    // 7. Composite Game Loop System
    const gameMaster = {
        name: 'GameMaster',
        init(eng) {
            movement.init(eng);
            wireSystem.init(eng);
            circuitSystem.init(eng);
            hazardSystem.init(eng);
        },
        update(dt) {
            // Level entities update
            level.update(dt);

            // Circuit rotation & power propagation
            circuitSystem.update(dt);

            // Electrified hazards & shock detection
            hazardSystem.update(dt);

            // Player kinematics & collisions
            movement.update(dt);

            // Wire aiming, projectile & pendulum constraint
            wireSystem.update(dt);

            // Fall-out-of-bounds safety respawn
            if (player.y > level.height + 50) {
                wireSystem.disconnectWire();
                player.x = 120;
                player.y = 480;
                player.vx = 0;
                player.vy = 0;
                hud.setMessage('Unit recovered to nearest safety platform.');
            }

            // Sprite animation timing
            animation.update(dt, player);

            // Smooth camera tracking
            camera.follow(player, player.facing * 80, -30);
            camera.update();

            // HUD
            hud.update(dt);

            // DevTools update
            if (devTools) {
                devTools.update(dt);
            }

            // End-of-frame input reset
            input.postUpdate();
        },
        render(ctx, alpha) {
            // World Space Rendering
            camera.applyTransform(ctx);

            level.renderBackground(ctx);
            circuitSystem.render(ctx);
            level.renderForeground(ctx);
            hazardSystem.render(ctx);
            wireSystem.render(ctx);
            animation.render(ctx, player);

            // DevTools world-space gizmos
            if (devTools) {
                devTools.renderWorld(ctx);
            }

            camera.restoreTransform(ctx);

            // Screen Space HUD Rendering
            hud.render(ctx);

            // DevTools screen-space telemetry overlay
            if (devTools) {
                devTools.renderScreen(ctx);
            }
        }
    };

    engine.registerSystem(gameMaster);
    engine.start();

    console.log('[TetherPlatformer] Engine started successfully with modular architecture!');
}

window.addEventListener('DOMContentLoaded', bootstrap);

