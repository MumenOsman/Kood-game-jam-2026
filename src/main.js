/**
 * main.js
 * Bootstrap entry point: initializes core systems, loads assets,
 * registers modular systems with Engine and EventBus, and starts loop.
 */
import { EventBus } from './core/EventBus.js?v=20261107_v18';
import { Engine } from './core/Engine.js?v=20261107_v18';
import { InputManager } from './core/InputManager.js?v=20261107_v18';
import { Camera } from './core/Camera.js?v=20261107_v18';
import { AssetLoader } from './core/AssetLoader.js?v=20261107_v18';

import { Player } from './entities/Player.js?v=20261108_v11';
import { PlayerMovement } from './modules/PlayerMovement.js?v=20261108_v11';
import { WireSystem } from './modules/WireSystem.js?v=20261108_v11';
import { CircuitSystem } from './modules/CircuitSystem.js?v=20261108_v11';
import { PipeSystem } from './modules/PipeSystem.js?v=20261108_v11';
import { HazardSystem } from './modules/HazardSystem.js?v=20261108_v11';
import { AnimationController } from './modules/AnimationController.js?v=20261108_v12';
import { TestRoom } from './levels/TestRoom.js?v=20261108_v11';
import { LDtkLevel } from './levels/LDtkLevel.js?v=20261108_v15';
import { HUD } from './ui/HUD.js?v=20261108_v15';
import { AudioManager } from './core/AudioManager.js?v=20261108_v12';
import { SaveManager } from './core/SaveManager.js?v=20261108_v12';
import { UIManager } from './ui/UIManager.js?v=20261108_v13';
import { CreditFlightScene, FLIGHT_STATE } from './modules/CreditFlightScene.js?v=20261108_v30';

async function bootstrap() {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = 1280;
    canvas.height = 720;

    // Load pixel font via FontFace API
    try {
        const pixelFont = new FontFace('CyberpunkPixel', 'url(./assets/ui/font/CyberpunkCraftpixPixel.otf)');
        await pixelFont.load();
        document.fonts.add(pixelFont);
    } catch (e) {
        console.warn('[Font] Failed to load CyberpunkPixel via FontFace:', e);
    }

    // 1. Core Services
    const eventBus = new EventBus();
    const assetLoader = new AssetLoader();
    const camera = new Camera(canvas.width, canvas.height);
    const input = new InputManager(canvas, camera);
    const engine = new Engine(canvas);
    const audioManager = new AudioManager();
    const saveManager = new SaveManager();
    audioManager.attachEventBus(eventBus);

    // 2. Load Assets (spritesheet and bounds metadata)
    await Promise.all([
        assetLoader.loadImage('hero_sheet', './assets/sprites/Hero-v2.png?v=20261107_v7'),
        assetLoader.loadJSON('hero_meta', './assets/sprites/Hero-v2.json?v=20261107_v7'),
        assetLoader.loadImage('drones_sheet', './assets/sprites/drones.png?v=20261107_v7'),
        assetLoader.loadImage('circuits_sheet', './assets/sprites/circuits.png?v=20261107_v7'),
        assetLoader.loadImage('gates_sheet', './assets/sprites/gates.png?v=20261107_v7'),
        assetLoader.loadImage('objects_sheet', './assets/sprites/objects.png?v=20261107_v7'),
        assetLoader.loadImage('ui_frame_map', './assets/ui/frames/FrameMap.png?v=20261107_v1'),
        assetLoader.loadImage('ui_btn_10', './assets/ui/buttons/ButtonMap10.png?v=20261107_v1'),
        assetLoader.loadImage('ui_btn_5', './assets/ui/buttons/ButtonMap5.png?v=20261107_v1'),
        assetLoader.loadImage('ui_slider', './assets/ui/bars/Scrolling1.png?v=20261107_v1'),
        assetLoader.loadImage('factory_bg', './assets/backgrounds/factory_bg.png?v=20261108_v1'),
        assetLoader.loadImage('vehicle_static', './assets/sprites/vehicle/vehicle-3-static.png?v=20261108_v1'),
        assetLoader.loadImage('vehicle_f1', './assets/sprites/vehicle/frames/vehicle-3.png?v=20261108_v1'),
        assetLoader.loadImage('vehicle_f2', './assets/sprites/vehicle/frames/vehicle-4.png?v=20261108_v1'),
        assetLoader.loadImage('vehicle_f3', './assets/sprites/vehicle/frames/vehicle-5.png?v=20261108_v1'),
        assetLoader.loadImage('thrust_back1', './assets/sprites/vehicle/frames-thrust/thrust-back/thrust-back1.png?v=20261108_v1'),
        assetLoader.loadImage('thrust_back2', './assets/sprites/vehicle/frames-thrust/thrust-back/thrust-back2.png?v=20261108_v1'),
        assetLoader.loadImage('thrust_back3', './assets/sprites/vehicle/frames-thrust/thrust-back/thrust-back3.png?v=20261108_v1'),
        assetLoader.loadImage('thrust_bottom1', './assets/sprites/vehicle/frames-thrust/thrust-bottom/thrust-bottom1.png?v=20261108_v1'),
        assetLoader.loadImage('thrust_bottom2', './assets/sprites/vehicle/frames-thrust/thrust-bottom/thrust-bottom2.png?v=20261108_v1'),
        assetLoader.loadImage('thrust_bottom3', './assets/sprites/vehicle/frames-thrust/thrust-bottom/thrust-bottom3.png?v=20261108_v1')
    ]);

    // 3. Entity & Level Setup
    const urlParams = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : null;
    const levelQuery = urlParams ? urlParams.get('level') : null;
    const roomQuery = urlParams ? urlParams.get('room') : null;
    const resetQuery = urlParams ? (urlParams.get('reset') === 'true' || urlParams.get('clear') === 'true') : false;
    if (resetQuery) {
        saveManager.clearSave();
        saveManager.clearCompletedLevels();
    }

    let level = null;
    const circuitSystem = new CircuitSystem(eventBus, input, null, { assetLoader });

    if (levelQuery === 'testroom') {
        level = new TestRoom(eventBus, circuitSystem, { assetLoader });
        camera.setBounds(0, 0, level.width, level.height);
    } else {
        const ldtkLevel = new LDtkLevel(eventBus, circuitSystem, {
            ldtkPath: './game-levels/map.ldtk',
            basePath: './game-levels/map/simplified/',
            assetLoader: assetLoader
        });
        await ldtkLevel.load();
        level = ldtkLevel;
        camera.setRoomMode(level.rooms || level.roomWidth, level.roomHeight, level.totalRooms);
    }

    const player = new Player(level.spawnPoint.x, level.spawnPoint.y);
    const initSave = saveManager.hasSave() ? saveManager.getSaveData() : null;
    if (initSave && initSave.checkpoint) {
        player.x = initSave.checkpoint.x;
        player.y = initSave.checkpoint.y;
    } else if (roomQuery !== null) {
        const targetRoomIdx = Math.max(0, Math.min(level.totalRooms - 1, parseInt(roomQuery, 10)));
        if (level.getRoomCheckpoint) {
            const cp = level.getRoomCheckpoint(targetRoomIdx);
            player.x = cp.x;
            player.y = cp.y;
        } else if (level.roomWidth) {
            player.x = targetRoomIdx * level.roomWidth + 96;
            player.y = level.spawnPoint.y;
        }
    }
    circuitSystem.player = player;
    player.eventBus = eventBus;

    camera.snapTo(player.x, player.y);

    // 4. Modules
    const pipeSystem = new PipeSystem(eventBus, assetLoader, circuitSystem, level);
    pipeSystem.init(assetLoader, level, circuitSystem);

    const movement = new PlayerMovement(eventBus, input, player, level);
    const wireSystem = new WireSystem(eventBus, input, player, level);
    const hazardSystem = new HazardSystem(eventBus, player, level);
    const animation = new AnimationController(assetLoader);
    const hud = new HUD(player, camera);

    // 5. Respawn & Core State Events
    function respawnPlayer(reason = 'LASER') {
        wireSystem.disconnectWire();
        const activeRoom = (level.rooms && level.rooms[level.activeRoomIndex]) || { worldX: 0, worldY: 0, pxWid: 640, pxHei: 320 };
        const cp = level.getRoomCheckpoint ? level.getRoomCheckpoint(level.activeRoomIndex) : { x: activeRoom.worldX + 64, y: 192 };
        player.x = cp.x;
        player.y = cp.y;
        player.vx = 0;
        player.vy = 0;
        player.isWallSliding = false;
        player.isWallHanging = false;
        player.isWallRunning = false;
        player.isTethered = false;
        player.shockInvulnTimer = 0; // Clear shock timer to eliminate flickering
        player.respawnBlinkTimer = 1.2; // Trigger calm 3-blink respawn sequence

        // Energy is ALWAYS restored to full on respawn from any cause
        player.battery = player.maxBattery || 100;
        eventBus.emit('BATTERY_CHANGED', player.battery);
        eventBus.emit('PLAYER_RESPAWN', { reason });
    }

    eventBus.on('PLAYER_LASER_CONTACT', () => respawnPlayer('LASER'));
    eventBus.on('PLAYER_BATTERY_DEPLETED', () => respawnPlayer('BATTERY_DEPLETED'));

    // 6. DevTools / Debug System (Disabled for clean production release)
    const IS_DEV = false;

    let devTools = null;
    if (IS_DEV) {
        window.__GAME__ = { engine, level, circuitSystem, pipeSystem, player, eventBus, movement, wireSystem, camera, hazardSystem, input, hud };
        try {
            const { DevTools } = await import('./debug/DevTools.js?v=20261107_v14');
            devTools = new DevTools({
                engine,
                eventBus,
                input,
                player,
                camera,
                movement,
                wireSystem,
                circuitSystem,
                pipeSystem,
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

    // 7. Save & UI Manager Integration
    let lastSavedRoomIndex = level.activeRoomIndex || 0;
    let isGameCompleted = false;

    function saveCurrentProgress() {
        if (!level || isGameCompleted) return;
        const activeRoomIdx = level.activeRoomIndex || 0;
        const roomName = (level.rooms && level.rooms[activeRoomIdx]?.identifier) || `Sector ${activeRoomIdx + 1}`;
        const cp = level.getRoomCheckpoint ? level.getRoomCheckpoint(activeRoomIdx) : { x: player.x, y: player.y };
        saveManager.saveGame({
            roomIndex: activeRoomIdx,
            checkpoint: { x: cp.x, y: cp.y },
            battery: Math.round(player.battery),
            roomName
        });
    }

    const skipMenu = urlParams ? urlParams.get('skipmenu') === 'true' : false;

    const uiManager = new UIManager({
        assetLoader,
        audioManager,
        saveManager,
        inputManager: input,
        onStartNewGame: () => {
            isGameCompleted = false;
            wireSystem.disconnectWire();
            if (creditFlightScene) {
                creditFlightScene.state = FLIGHT_STATE.INACTIVE;
                player.isVisible = true;
            }
            const startRoom = 0;
            level.activeRoomIndex = startRoom;
            if (typeof level.resetAllCircuits === 'function') {
                level.resetAllCircuits();
            }
            if (pipeSystem && typeof pipeSystem.recalculatePower === 'function') {
                pipeSystem.recalculatePower();
            }
            const cp = level.getRoomCheckpoint ? level.getRoomCheckpoint(startRoom) : { x: level.spawnPoint.x, y: level.spawnPoint.y };
            player.x = cp.x;
            player.y = cp.y;
            player.vx = 0;
            player.vy = 0;
            player.battery = player.maxBattery || 100;
            camera.snapTo(player.x, player.y);
            saveManager.clearSave();
            lastSavedRoomIndex = 0;
        },
        onLoadGame: (saveData) => {
            wireSystem.disconnectWire();
            if (creditFlightScene) {
                creditFlightScene.state = FLIGHT_STATE.INACTIVE;
                player.isVisible = true;
            }
            const targetIdx = Math.max(0, Math.min(level.totalRooms - 1, saveData.roomIndex || 0));
            level.activeRoomIndex = targetIdx;
            const cp = saveData.checkpoint || (level.getRoomCheckpoint ? level.getRoomCheckpoint(targetIdx) : level.spawnPoint);
            player.x = cp.x;
            player.y = cp.y;
            player.vx = 0;
            player.vy = 0;
            player.battery = typeof saveData.battery === 'number' ? saveData.battery : 100;
            camera.snapTo(player.x, player.y);
        },
        onSelectLevel: (roomIndex) => {
            isGameCompleted = false;
            wireSystem.disconnectWire();

            if (roomIndex === 12) {
                const targetIdx = Math.max(0, Math.min(level.totalRooms - 1, 12));
                level.activeRoomIndex = targetIdx;
                player.isVisible = false;
                if (creditFlightScene) {
                    creditFlightScene.startFlightRunnerDirectly();
                }
                return;
            }

            if (creditFlightScene) {
                creditFlightScene.state = FLIGHT_STATE.INACTIVE;
                player.isVisible = true;
            }
            const targetIdx = Math.max(0, Math.min(level.totalRooms - 1, roomIndex || 0));
            level.activeRoomIndex = targetIdx;
            if (typeof level.resetRoomCircuits === 'function') {
                level.resetRoomCircuits(targetIdx);
            }
            if (pipeSystem && typeof pipeSystem.recalculatePower === 'function') {
                pipeSystem.recalculatePower();
            }
            const cp = level.getRoomCheckpoint ? level.getRoomCheckpoint(targetIdx) : level.spawnPoint;
            player.x = cp.x;
            player.y = cp.y;
            player.vx = 0;
            player.vy = 0;
            player.battery = player.maxBattery || 100;
            player.shockInvulnTimer = 0;
            player.respawnBlinkTimer = 1.2;
            camera.snapTo(player.x, player.y);
            saveCurrentProgress();
            if (audioManager) {
                audioManager.resetVisitedRooms();
            }
            eventBus.emit('BATTERY_CHANGED', player.battery);
            eventBus.emit('ROOM_CHANGED', { roomIndex: targetIdx, roomId: (level.rooms && level.rooms[targetIdx] && level.rooms[targetIdx].id) || `Room_${targetIdx}` });
        },
        onRestartLevel: () => {
            if (creditFlightScene) {
                creditFlightScene.state = FLIGHT_STATE.INACTIVE;
                player.isVisible = true;
            }
            respawnPlayer('RESTART');
        },
        onRestartGame: () => {
            wireSystem.disconnectWire();
            if (creditFlightScene) {
                creditFlightScene.state = FLIGHT_STATE.INACTIVE;
                player.isVisible = true;
            }
            const startRoom = 0;
            level.activeRoomIndex = startRoom;
            if (typeof level.resetAllCircuits === 'function') {
                level.resetAllCircuits();
            }
            if (pipeSystem && typeof pipeSystem.recalculatePower === 'function') {
                pipeSystem.recalculatePower();
            }
            const cp = level.getRoomCheckpoint ? level.getRoomCheckpoint(startRoom) : { x: level.spawnPoint.x, y: level.spawnPoint.y };
            player.x = cp.x;
            player.y = cp.y;
            player.vx = 0;
            player.vy = 0;
            player.battery = player.maxBattery || 100;
            player.shockInvulnTimer = 0;
            player.respawnBlinkTimer = 1.2;
            camera.snapTo(player.x, player.y);
            saveManager.clearSave();
            lastSavedRoomIndex = 0;
            if (audioManager) {
                audioManager.resetVisitedRooms();
                audioManager.playFx('player_respawn', 0.85);
            }
            eventBus.emit('BATTERY_CHANGED', player.battery);
            eventBus.emit('ROOM_CHANGED', { roomIndex: 0, roomId: (level.rooms && level.rooms[0] && level.rooms[0].id) || 'Room_0' });
        },
        onExitToMenu: () => {
            if (!isGameCompleted) {
                if (level && level.activeRoomIndex > 0) {
                    saveCurrentProgress();
                } else {
                    saveManager.clearSave();
                }
            }
            wireSystem.disconnectWire();
            if (creditFlightScene) {
                creditFlightScene.state = FLIGHT_STATE.INACTIVE;
                player.isVisible = true;
            }
        }
    });

    // 7b. Credits Flight Scene (Secret Level Vehicle Flight & Credits Minigame)
    const creditFlightScene = new CreditFlightScene({
        assetLoader,
        audioManager,
        uiTheme: uiManager.theme,
        eventBus,
        onComplete: () => {
            isGameCompleted = true;
            saveManager.markLevelCompleted(11); // Mark Sector 12 complete
            saveManager.markLevelCompleted(12); // Mark Secret Credits Flight Level complete
            saveManager.clearSave();
            wireSystem.disconnectWire();
            level.activeRoomIndex = 0;
            const startCp = level.getRoomCheckpoint ? level.getRoomCheckpoint(0) : level.spawnPoint;
            player.x = startCp.x;
            player.y = startCp.y;
            player.vx = 0;
            player.vy = 0;
            player.battery = player.maxBattery || 100;
            player.isVisible = true;
            camera.snapTo(player.x, player.y);
            uiManager.showCredits();
        }
    });

    if (window.__GAME__) {
        window.__GAME__.uiManager = uiManager;
    }

    if (skipMenu) {
        uiManager.state = 'PLAYING';
        audioManager.playMusic('game_levels');
    }

    // 8. Composite Game Loop System
    const gameMaster = {
        name: 'GameMaster',
        init(eng) {
            movement.init(eng);
            wireSystem.init(eng);
            circuitSystem.init(eng);
            pipeSystem.init(assetLoader, level, circuitSystem);
            hazardSystem.init(eng);
        },
        update(dt) {
            // UI Manager update (handles menu buttons, slider drags, Esc key)
            uiManager.update(dt);

            // Ambient visual animations (pipe energy pulses & player idle breathing) run across ALL states
            pipeSystem.update(dt);
            animation.update(dt, player);

            const isFlightMode = creditFlightScene && creditFlightScene.state !== FLIGHT_STATE.INACTIVE;
            if (isFlightMode) {
                player.isVisible = false;
                wireSystem.disconnectWire();
            }

            // High-speed sky flight runner mode
            if (creditFlightScene && (creditFlightScene.state === FLIGHT_STATE.FLIGHT_RUNNER || creditFlightScene.state === FLIGHT_STATE.HYPERDRIVE_EXIT)) {
                creditFlightScene.update(dt, input, camera, level);
                if (devTools) devTools.update(dt);
                input.postUpdate();
                return;
            }

            if (uiManager.state === 'PLAYING') {
                // Full gameplay physics kinematics, collisions, hazards, wire & entity updates
                level.update(dt, player, input);

                // Auto-save on room change & mark completed levels
                if (level.activeRoomIndex !== lastSavedRoomIndex) {
                    if (level.activeRoomIndex > 0) {
                        for (let i = 0; i < level.activeRoomIndex; i++) {
                            saveManager.markLevelCompleted(i);
                        }
                    }
                    lastSavedRoomIndex = level.activeRoomIndex;
                    saveCurrentProgress();
                }

                // Circuit rotation & power propagation
                circuitSystem.update(dt);

                // Electrified hazards & shock detection
                hazardSystem.update(dt);

                // Hangar takeoff spaceship control vs regular player locomotion
                if (creditFlightScene && creditFlightScene.state === FLIGHT_STATE.HANGAR_TAKEOFF) {
                    creditFlightScene.update(dt, input, camera, level);
                } else {
                    movement.update(dt);
                    wireSystem.update(dt);

                    // Fall-out-of-bounds safety respawn
                    const activeRoom = (level.rooms && level.rooms[level.activeRoomIndex]) || { worldX: 0, worldY: 0, pxWid: 640, pxHei: 320 };
                    if (player.y > activeRoom.worldY + activeRoom.pxHei + 40) {
                        respawnPlayer('FALL');
                    }

                    // Zero power reboot respawn
                    if (player.battery <= 0 && player.shockInvulnTimer <= 0) {
                        respawnPlayer('BATTERY_DEPLETED');
                    }

                    // Smooth camera tracking (room-by-room sliding in LDtk, free-follow in testroom)
                    camera.follow(player);

                    // HUD
                    hud.update(dt);
                }

                camera.update();
            } else {
                // In menus / pause: keep ambient entity visuals animated (drones hovering & thrusters, blast doors)
                // while kinematics, physics, timers, wire, and hazard shocks remain 100% frozen
                if (level && level.drones) {
                    for (const drone of level.drones) {
                        drone.update(dt, player);
                    }
                }
                if (level && level.doors) {
                    for (const d of level.doors) {
                        const targetProgress = d.isOpen ? 1 : 0;
                        if (d.openProgress !== targetProgress) {
                            const step = dt * 1.8;
                            d.openProgress = targetProgress > d.openProgress
                                ? Math.min(targetProgress, d.openProgress + step)
                                : Math.max(targetProgress, d.openProgress - step);
                        }
                    }
                }
            }

            // DevTools update
            if (devTools) {
                devTools.update(dt);
            }

            // End-of-frame input reset
            input.postUpdate();
        },
        render(ctx, alpha) {
            // If in Flight Runner mode, render full-screen credits flight scene
            if (creditFlightScene && (creditFlightScene.state === FLIGHT_STATE.FLIGHT_RUNNER || creditFlightScene.state === FLIGHT_STATE.HYPERDRIVE_EXIT)) {
                creditFlightScene.render(ctx);
                if (devTools) devTools.renderScreen(ctx);
                return;
            }

            const isTitleFlow = uiManager.state === 'MAIN_MENU' ||
                uiManager.state === 'CREDITS' ||
                uiManager.state === 'VICTORY' ||
                (uiManager.state === 'OPTIONS' && uiManager.previousState === 'MAIN_MENU');

            if (isTitleFlow) {
                // Focus camera on saved room or initial room
                const save = saveManager.hasSave() ? saveManager.getSaveData() : null;
                const menuRoomIdx = save && typeof save.roomIndex === 'number' ? save.roomIndex : 0;
                if (level.rooms && level.rooms[menuRoomIdx]) {
                    const r = level.rooms[menuRoomIdx];
                    camera.snapTo(r.worldX + r.pxWid / 2, r.worldY + r.pxHei / 2);
                } else {
                    camera.snapTo(player.x, player.y);
                }
            }

            // World Space Rendering (Always renders world + player robot)
            camera.applyTransform(ctx);

            level.renderBackground(ctx, camera);
            pipeSystem.render(ctx, camera);
            circuitSystem.render(ctx, camera);
            level.renderForeground(ctx, camera);
            hazardSystem.render(ctx, camera);
            wireSystem.render(ctx);

            if (creditFlightScene && creditFlightScene.state === FLIGHT_STATE.HANGAR_TAKEOFF) {
                creditFlightScene.render(ctx, camera);
            } else if (player.isVisible !== false) {
                animation.render(ctx, player);
            }

            // DevTools world-space gizmos
            if (devTools) {
                devTools.renderWorld(ctx);
            }

            camera.restoreTransform(ctx);

            // Screen Space
            if (isTitleFlow) {
                // Translucent dimming veil over background
                ctx.fillStyle = 'rgba(8, 12, 18, 0.78)';
                ctx.fillRect(0, 0, 1280, 720);

                // Render Title screen or Options overlay (HUD is never shown in menus)
                uiManager.render(ctx);
            } else {
                // In-Game Flow: only render HUD when actively playing (and not in flight takeoff)
                if (uiManager.state === 'PLAYING' && (!creditFlightScene || creditFlightScene.state === FLIGHT_STATE.INACTIVE)) {
                    hud.render(ctx);
                }

                // UI Overlay (Pause Menu or in-game Options Menu)
                uiManager.render(ctx);

                // DevTools screen-space telemetry overlay
                if (devTools) {
                    devTools.renderScreen(ctx);
                }
            }
        }
    };

    engine.registerSystem(gameMaster);
    engine.start();

    console.log('[TetherPlatformer] Engine started successfully with modular architecture!');
}

window.addEventListener('DOMContentLoaded', bootstrap);

