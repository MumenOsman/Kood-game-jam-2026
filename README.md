# TetherMind

Created for the **//kood Game Jam [Platformers] 2026**.  
Solo developed with love (and plenty of caffeine) by **Mumen Osman** ([mumen.dev](https://mumen.dev)).

---

## Welcome to TetherMind

TetherMind is a 2D puzzle platformer all about swinging, wall running, and rewiring electrical circuits. You play as a little maintenance robot trapped in a powered down industrial facility. There are no enemies to fight and no weapons to shoot. Your goal is simply to make your way through each room by restoring power to blast doors and shutting off dangerous electrical hazards.

Your main tool is the power cable plugged into the top of your head. You can fling your plug across the room, hook into ceiling anchors to swing over spikes, climb up vertical walls, and jack into circuit dials to redirect electricity where it needs to go.

---

## How It Plays

### Swinging and Moving Around
You aim with your mouse, hold left click to see your throw arc, and release to shoot your plug. Once you are hooked into an anchor or a circuit dial, you can swing back and forth with real pendulum physics.

While hanging in the air, you can reel your cable in with W or let it out with S to adjust your height. If you want to launch yourself across a wide gap, hit Space while swinging and your robot will leap forward, unplugging the cable mid flight. You can also run at full speed and jump into a wall to run straight up it.

### Puzzles and Circuit Logic
Each room is a puzzle. You will find rotating circuit dials on walls and ceilings. When you connect your plug to a dial, you can rotate it 90 degrees with E or by clicking it.

Power flows through these circuits into logic gates, like AND gates that need two inputs to turn on, and XOR gates that only activate with one single power line. When you route electricity to the right places, heavy blast doors will slide open and deadly electrified walls will turn off so you can pass safely.

### Keeping Your Battery Charged
Everything you do takes a little bit of power. Running, jumping, swinging, and turning heavy circuit dials slowly drains your battery bar at the top of the screen.

To stay alive, you need to plug into active power circuits or wall chargers scattered around the levels. Once you plug in, your battery refills automatically.

### Helpful Drones
You will spot friendly little drones hovering in the rooms. Click on any drone at any time to open its screen and read quick tips about new mechanics.

---

## Controls

You can customize all keyboard controls in the Options menu.

| Action | Control | What it does |
|---|---|---|
| Move Left and Right | A and D | Walk around |
| Sprint | Shift + A or D | Run faster, needed for wall running |
| Wall Run | Sprint into wall + Space | Run straight up a wall |
| Jump | Space | Jump from the ground |
| Tether Jump | Space while swinging | Leap forward and detach your cable |
| Aim and Throw Plug | Hold and release Left Click | Aim your throw and launch the plug |
| Drop Down | Right Click | Detach cable without jumping |
| Reel Cable In and Out | W and S while swinging | Climb up or lower down |
| Rotate Circuit Dial | E or Left Click dial | Turn connected circuit 90 degrees |
| Read Drone Info | Left Click drone | Open drone tutorial screen |
| Pause Game | Escape | Open the pause menu |

---

## Project Structure and Architecture

The game runs on a custom engine built with vanilla HTML5 Canvas and JavaScript modules, using a simple event bus to let systems talk to each other without messy dependencies.

```
src/
|-- main.js                       # Game setup and main game loop
|-- core/
|   |-- Engine.js                 # 60 frames per second loop
|   |-- EventBus.js               # Event bus for game wide events
|   |-- InputManager.js           # Keyboard and mouse handling with remapping
|   |-- Camera.js                 # Smooth camera that follows the player room by room
|   |-- AssetLoader.js            # Loads images, audio files, and level data
|   |-- AudioManager.js           # Sound effects and background music
|   `-- SaveManager.js            # Saves checkpoint progress to localStorage
|-- entities/
|   |-- Player.js                 # Robot physics, battery, and state
|   |-- Drone.js                  # Tutorial drones
|   `-- Socket.js                 # Anchor, circuit, and charger sockets
|-- modules/
|   |-- PlayerMovement.js         # Walking, jumping, wall running, and collisions
|   |-- WireSystem.js             # Aiming, throwing, swinging physics, and cable rendering
|   |-- CircuitSystem.js          # Circuit dials, power flow, and logic gates
|   |-- PipeSystem.js             # Conduit pipes that light up with electricity
|   |-- HazardSystem.js           # Electric hazard walls and doors
|   `-- AnimationController.js    # Sprite animations
|-- levels/
|   |-- Level.js                  # Level interface
|   |-- LDtkLevel.js              # LDtk tilemap loader and room setup
|   `-- TestRoom.js               # Sandbox test room
`-- ui/
    |-- UIManager.js              # Handles menus and screen states
    |-- UITheme.js                # Pixel art frames, buttons, and sliders
    |-- HUD.js                    # Battery meter and interaction hints
    |-- MainMenu.js               # Title screen
    |-- PauseMenu.js              # Pause menu
    |-- OptionsMenu.js            # Volume controls and key rebinding
    `-- CreditsScreen.js          # Credits screen
```

---

## How to Play Locally

To play the game on your computer, clone the repository and run any simple local web server:

```bash
# Clone the repository
git clone https://github.com/MumenOsman/Kood-game-jam-2026.git
cd Kood-game-jam-2026

# Option 1: Python 3
python3 -m http.server 3000

# Option 2: Node.js
npx serve . -p 3000

# Option 3: Included python script
python3 dev_server.py
```

Then visit `http://localhost:3000` in your web browser.

---

## Credits

- Design, Programming, and Custom Art: Mumen Osman ([mumen.dev](https://mumen.dev))
- Additional 2D Pixel Art, GUI, and Audio: [CraftPix.net](https://craftpix.net)
- Built With: Custom JavaScript engine, [LDtk](https://ldtk.io), and [Penpot](https://penpot.app)
- Source Code: [https://github.com/MumenOsman/Kood-game-jam-2026](https://github.com/MumenOsman/Kood-game-jam-2026)

---

## License

Created for the //kood Game Jam [Platformers] 2026. Code and levels are under the MIT License. Art assets belong to CraftPix.net.
