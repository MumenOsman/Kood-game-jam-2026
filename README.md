# 2D Tether Puzzle Platformer

Created for the **//kood Game Jam [Platformers] 2026**.

Solo developed by **Mumen Osman** ([mumen.dev](https://mumen.dev)).

A 2D pacifist puzzle platformer built from scratch using modern ES6 JavaScript, HTML5 Canvas, and LDtk. The game combines physics-based wire swinging, wall running, directional electrical circuit routing, logic gates (AND / XOR), and snappy platformer locomotion.

---

## Gameplay & Features

- **Physics-Based Tether & Cable Mechanics**: Aim and launch your plug to latch onto ceiling anchors, battery chargers, and circuit dials. Swing with realistic pendulum physics, reel in/out, and perform high-velocity tether jumps.
- **Circuit Routing & Logic Gates**: Rotate electrical junctions on a 32px cardinal grid. Solve intricate power distribution networks using AND gates, XOR gates, and energized electrical conduit pipes to power blast doors and de-electrify lethal hazard barriers.
- **Acrobatic Locomotion**: Responsive platforming mechanics including wall running, coyote time, jump buffering, and directional momentum preservation.
- **Battery & Power Management**: Your battery powers your mechanics. Connect to active power grids or charging docks to automatically recharge your power cells.
- **Interactive Holographic Drones**: Context-aware tutorial drones provide non-intrusive, interactive guides and field tips on demand.
- **Full UI & Audio System**:
  - Interactive Main Menu with Continue, Options, and Credits.
  - In-game HUD with real-time battery status and contextual interaction tooltips.
  - Pause Menu with instant restart and checkpoint loading.
  - Fully rebindable keyboard controls with persistent localStorage profiles.
  - Master, Music, and Sound FX volume controls with live preview.
  - Authentic retro cyberpunk pixel-art sound design and audio orchestration.

---

## Controls

All keyboard controls can be rebound to your preference in the **Options** menu.

| Action | Default Key / Input | Notes |
|---|---|---|
| **Move Left / Right** | `A` / `D` | Smooth acceleration and grounded friction |
| **Run** | `Shift` + `A` / `D` | Higher top speed, required for wall running |
| **Wall Run** | Run into wall + `Space` | Scale vertical walls using momentum |
| **Jump** | `Space` | Grounded jump with variable height & coyote time |
| **Tether Jump** | `Space` *(while swinging)* | Boost leaps in facing direction and cleanly detaches wire |
| **Aim & Launch Plug** | **Hold & Release Left Mouse Button (LMB)** | Aim parabolic trajectory arc, launch to attach |
| **Detach / Cut Wire** | **Right Mouse Button (RMB)** | Drops from tether without jump momentum |
| **Reel In / Out** | `W` / `S` *(while swinging)* | Adjust tether length mid-air |
| **Rotate Circuit** | `E` *(or Left Click on dial)* | Rotates connected circuit junction 90° clockwise |
| **Interact / Inspect** | **Left Click** on Drones | Opens drone tutorial log from any distance |
| **Pause / Back** | `Escape` | Toggles pause menu or returns from submenus |

---

## Architecture & Codebase

The game is built with a modular, decoupled architecture driven by an event-driven `EventBus`:

```
src/
|-- main.js                       # Game bootstrap, system registration, and loop coordination
|-- core/
|   |-- Engine.js                 # 60Hz fixed-timestep accumulator with interpolation
|   |-- EventBus.js               # Decoupled pub/sub messaging backbone
|   |-- InputManager.js           # Action mapping, rebindable inputs, and mouse state
|   |-- Camera.js                 # Smooth 2D tracking camera with room bounding
|   |-- AssetLoader.js            # Asynchronous sprite sheets, audio, and LDtk JSON loader
|   |-- AudioManager.js           # Multi-channel Web Audio sound player with volume busses
|   `-- SaveManager.js            # LocalStorage game progress and room state persistence
|-- entities/
|   |-- Player.js                 # Player state machine, kinematics, battery, and anchors
|   |-- Drone.js                  # Interactive tutorial drone entities
|   `-- Socket.js                 # Anchor, circuit, and charger sockets
|-- modules/
|   |-- PlayerMovement.js         # Locomotion, wall running, gravity, collisions
|   |-- WireSystem.js             # Parabolic aim trajectory, distance constraint, catenary curve
|   |-- CircuitSystem.js          # Bitmask cardinal port routing, BFS power flow, XOR / AND gates
|   |-- PipeSystem.js             # Energized electrical conduit rendering with animated pulses
|   |-- HazardSystem.js           # Lethal electrical walls & direct physical causality
|   `-- AnimationController.js    # Sprite animation sequencing
|-- levels/
|   |-- Level.js                  # Abstract level interface
|   |-- LDtkLevel.js              # LDtk tilemap parser, entities loader, room transitions
|   `-- TestRoom.js               # Standalone test sandbox
`-- ui/
    |-- UIManager.js              # Central UI state machine (Main Menu, Playing, Paused, Options, Credits)
    |-- UITheme.js                # Pixel-art 9-slice window frames, buttons, sliders, badges
    |-- HUD.js                    # In-game battery meter and contextual prompts
    |-- MainMenu.js               # Start screen with Start, Continue, Options, Credits
    |-- PauseMenu.js              # In-game pause modal
    |-- OptionsMenu.js            # Volume sliders, audio mute toggle, rebindable controls
    `-- CreditsScreen.js          # Centered end-game & start menu credits modal with links
```

---

## Running Locally

Clone the repository and run any local HTTP server:

```bash
# Clone repository
git clone https://github.com/MumenOsman/Kood-game-jam-2026.git
cd Kood-game-jam-2026

# Option 1: Python 3
python3 -m http.server 3000

# Option 2: Node.js (npx serve)
npx serve . -p 3000

# Option 3: Dedicated dev server (included)
python3 dev_server.py
```

Open `http://localhost:3000` in your browser.

---

## Deploying to itch.io

Because this project uses native HTML5 Canvas and ES6 modules without bundling overhead, it runs natively on itch.io.

### Method 1: Uploading a ZIP via Browser (Quickest)

1. **Package the Game**:
   Create a `.zip` archive containing the root files and folders. Ensure `index.html` is at the root of the ZIP (do not zip a wrapper folder):
   ```bash
   zip -r game.zip index.html assets/ game-levels/ src/ -x "*.git*" "*__pycache__*"
   ```
2. **Configure itch.io Project Page**:
   - Go to your itch.io dashboard and create a new project (or edit existing).
   - **Classification**: *Game*
   - **Kind of project**: *HTML* (You have a ZIP or HTML file that will be played in the browser).
   - **Uploads**: Click **Upload files** and select `game.zip`.
   - Check the box: **"This file will be played in the browser"**.
3. **Embed Options**:
   - **Viewport dimensions**: Set **Width: 1280** and **Height: 720**.
   - Check **Enable fullscreen button**.
   - Check **Automatically start on page load**.
   - Orientation: *Landscape*.
4. **Save & Publish**: Save the page and test in your browser!

### Method 2: Automated Deployment via Butler CLI (Recommended for Updates)

itch.io's official command-line tool, [Butler](https://itch.io/docs/butler/), automatically pushes diffs without re-uploading the entire package:

```bash
# 1. Install butler (if not already installed)
curl -L -o butler.zip https://broth.itch.ovh/butler/linux-amd64/LATEST/archive/default
unzip butler.zip -d ~/.local/bin/

# 2. Login to your itch account
butler login

# 3. Push your build directory directly
butler push . your-username/kood-game-jam-2026:html5 --userversion="1.0.0"
```

---

## Assets & Credits

- **Design, Programming, and Custom Art**: Mumen Osman ([mumen.dev](https://mumen.dev))
- **Additional 2D Pixel Art, GUI, & Audio**: [CraftPix.net](https://craftpix.net)
- **Built With**: Custom ES6 Engine, [LDtk](https://ldtk.io), and [Penpot](https://penpot.app)
- **Source Code**: [https://github.com/MumenOsman/Kood-game-jam-2026](https://github.com/MumenOsman/Kood-game-jam-2026)

---

## License

This project was created for the //kood Game Jam [Platformers] 2026. Custom code and level configurations are distributed under the MIT License. Embedded commercial art packs remain copyright their respective creators at CraftPix.net.
