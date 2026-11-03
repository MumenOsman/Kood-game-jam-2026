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
    const animation = new AnimationController(assetLoader);
    const hud = new HUD(player, camera);

    // 5. Global Event Notifications
    eventBus.on('CIRCUIT_UPDATED', ({ nodeId }) => {
        hud.setMessage('Circuit junction re-routed! Tracing power grid...');
    });

    eventBus.on('ACTIVATE_DEVICE', (deviceId) => {
        if (deviceId === 'exit_door') {
            hud.setMessage('POWER RESTORED: Blast door unlocking!', 5);
        }
    });

    eventBus.on('PLAYER_TETHER_JUMP', () => {
        hud.setMessage('Tether jump executed!');
    });

    // 6. Composite Game Loop System
    const gameMaster = {
        name: 'GameMaster',
        init(eng) {
            movement.init(eng);
            wireSystem.init(eng);
            circuitSystem.init(eng);
        },
        update(dt) {
            // Level entities update
            level.update(dt);

            // Circuit rotation & power propagation
            circuitSystem.update(dt);

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

            // End-of-frame input reset
            input.postUpdate();
        },
        render(ctx, alpha) {
            // World Space Rendering
            camera.applyTransform(ctx);

            level.renderBackground(ctx);
            circuitSystem.render(ctx);
            level.renderForeground(ctx);
            wireSystem.render(ctx);
            animation.render(ctx, player);

            camera.restoreTransform(ctx);

            // Screen Space HUD Rendering
            hud.render(ctx);
        }
    };

    engine.registerSystem(gameMaster);
    engine.start();

    console.log('[TetherPlatformer] Engine started successfully with modular architecture!');
}

window.addEventListener('DOMContentLoaded', bootstrap);

