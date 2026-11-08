/**
 * UIManager.js
 * Central UI State Coordinator and Event Router.
 * Manages transitions between:
 * - MAIN_MENU
 * - PLAYING
 * - PAUSED
 * - OPTIONS
 */
import { UITheme } from './UITheme.js?v=20261108_v11';
import { MainMenu } from './MainMenu.js?v=20261108_v11';
import { PauseMenu } from './PauseMenu.js?v=20261108_v11';
import { OptionsMenu } from './OptionsMenu.js?v=20261108_v11';
import { VictoryModal } from './VictoryModal.js?v=20261108_v11';
import { CreditsScreen } from './CreditsScreen.js?v=20261108_v12';

export class UIManager {
    constructor({ assetLoader, audioManager, saveManager, inputManager, onStartNewGame, onLoadGame, onRestartLevel, onRestartGame, onExitToMenu }) {
        this.assetLoader = assetLoader;
        this.audio = audioManager;
        this.saveManager = saveManager;
        this.input = inputManager;

        this.onStartNewGame = onStartNewGame;
        this.onLoadGame = onLoadGame;
        this.onRestartLevel = onRestartLevel;
        this.onRestartGame = onRestartGame;
        this.onExitToMenu = onExitToMenu;

        this.theme = new UITheme(assetLoader);

        this.state = 'MAIN_MENU'; // 'MAIN_MENU' | 'PLAYING' | 'PAUSED' | 'OPTIONS' | 'VICTORY' | 'CREDITS'
        this.previousState = 'MAIN_MENU';

        // Child views
        this.mainMenu = new MainMenu({
            uiTheme: this.theme,
            audioManager: this.audio,
            saveManager: this.saveManager,
            onStartGame: () => this.handleStartGame(),
            onContinue: () => this.handleContinueGame(),
            onOptions: () => this.openOptions(),
            onCredits: () => this.openCredits()
        });

        this.pauseMenu = new PauseMenu({
            uiTheme: this.theme,
            audioManager: this.audio,
            onResume: () => this.resumeGame(),
            onRestartLevel: () => this.handleRestartLevel(),
            onRestartGame: () => this.handleRestartGame(),
            onOptions: () => this.openOptions(),
            onExitToMainMenu: () => this.handleExitToMainMenu()
        });

        this.optionsMenu = new OptionsMenu({
            uiTheme: this.theme,
            audioManager: this.audio,
            inputManager: this.input,
            onBack: () => this.closeOptions()
        });

        this.victoryModal = new VictoryModal({
            uiTheme: this.theme,
            audioManager: this.audio,
            onPlayAgain: () => this.handleStartGame(),
            onExitToMainMenu: () => this.handleExitToMainMenu()
        });

        this.creditsScreen = new CreditsScreen({
            uiTheme: this.theme,
            audioManager: this.audio,
            onReturnToMenu: () => this.handleExitToMainMenu()
        });

        // Start menu music
        if (this.audio) {
            this.audio.playMusic('main_menu');
        }
    }

    handleStartGame() {
        this.state = 'PLAYING';
        if (this.audio) {
            this.audio.resetVisitedRooms();
            this.audio.playMusic('game_levels');
        }
        if (this.onStartNewGame) {
            this.onStartNewGame();
        }
    }

    handleContinueGame() {
        if (!this.saveManager || !this.saveManager.hasSave()) return;
        this.state = 'PLAYING';
        if (this.audio) {
            this.audio.playMusic('game_levels');
        }
        if (this.onLoadGame) {
            this.onLoadGame(this.saveManager.getSaveData());
        }
    }

    showVictory() {
        this.showCredits();
    }

    openCredits() {
        this.previousState = this.state;
        this.state = 'CREDITS';
        if (this.audio) this.audio.playFx('ui_click');
    }

    showCredits() {
        if (this.state === 'CREDITS') return;
        this.state = 'CREDITS';
        if (this.audio) {
            this.audio.playFx('circuit_solved');
            this.audio.playFx('access_granted');
        }
    }

    pauseGame() {
        if (this.state !== 'PLAYING') return;
        this.state = 'PAUSED';
        if (this.audio) this.audio.playFx('ui_click');
    }

    resumeGame() {
        if (this.state !== 'PAUSED') return;
        this.state = 'PLAYING';
        if (this.audio) this.audio.playFx('ui_click');
    }

    handleRestartLevel() {
        if (this.state !== 'PAUSED') return;
        if (this.onRestartLevel) {
            this.onRestartLevel();
        }
        this.state = 'PLAYING';
    }

    handleRestartGame() {
        if (this.state !== 'PAUSED') return;
        if (this.onRestartGame) {
            this.onRestartGame();
        }
        this.state = 'PLAYING';
    }

    openOptions() {
        this.previousState = this.state;
        this.state = 'OPTIONS';
        if (this.audio) this.audio.playFx('ui_click');
    }

    closeOptions() {
        this.state = this.previousState || 'MAIN_MENU';
        if (this.audio) this.audio.playFx('ui_click');
    }

    handleExitToMainMenu() {
        if (this.onExitToMenu) {
            this.onExitToMenu();
        }
        this.state = 'MAIN_MENU';
        if (this.audio) {
            this.audio.playMusic('main_menu');
        }
    }

    update(dt) {
        // Global Escape Key Handling
        if (this.input.isKeyPressed('Escape')) {
            if (this.state === 'PLAYING') {
                this.pauseGame();
                return;
            } else if (this.state === 'PAUSED') {
                this.resumeGame();
                return;
            } else if (this.state === 'OPTIONS') {
                if (this.optionsMenu.rebindingAction) {
                    this.optionsMenu.rebindingAction = null;
                } else {
                    this.closeOptions();
                }
                return;
            } else if (this.state === 'CREDITS') {
                this.handleExitToMainMenu();
                return;
            }
        }

        // Delegate to active screen
        if (this.state === 'MAIN_MENU') {
            this.mainMenu.update(dt, this.input);
        } else if (this.state === 'PAUSED') {
            this.pauseMenu.update(dt, this.input);
        } else if (this.state === 'OPTIONS') {
            this.optionsMenu.update(dt, this.input);
        } else if (this.state === 'VICTORY') {
            this.victoryModal.update(dt, this.input);
        } else if (this.state === 'CREDITS') {
            this.creditsScreen.update(dt, this.input);
        }
    }

    render(ctx) {
        if (this.state === 'MAIN_MENU') {
            this.mainMenu.render(ctx);
        } else if (this.state === 'PAUSED') {
            this.pauseMenu.render(ctx);
        } else if (this.state === 'OPTIONS') {
            this.optionsMenu.render(ctx);
        } else if (this.state === 'VICTORY') {
            this.victoryModal.render(ctx);
        } else if (this.state === 'CREDITS') {
            this.creditsScreen.render(ctx);
        }
    }
}

