# TetherMind

> A high-momentum 2D puzzle platformer where electricity is both your lifeline and your greatest puzzle.

Created for the **//kood Game Jam [Platformers] 2026**.  
Solo developed with love (and plenty of caffeine) by **Mumen Osman** ([mumen.dev](https://mumen.dev)).

---

## What is TetherMind?

In **TetherMind**, you step into the chassis of a nimble, pacifist utility droid trapped deep inside a labyrinthine industrial power sector. The facility's automated security grid has malfunctioned—deadly high-voltage hazard barriers block every corridor, heavy blast doors are sealed shut, and backup power is dead.

Your only weapon? **A high-tensile, electrified tether cable** attached to your head.

By slinging your plug across chasms, anchoring to ceiling mounts, running up vertical concrete walls, and manually rewiring live electrical circuits, you must restore power to the sector and navigate your way to freedom.

---

## Core Mechanics & How It Plays

### 1. High-Octane Pendulum Locomotion
- **Aim & Launch**: Hold and release your mouse to aim a parabolic trajectory arc. Launch your plug into ceiling anchors, rotating circuit dials, or charging docks.
- **Physics-Driven Swinging**: Build momentum with authentic pendulum physics. Pump your swing mid-air, reel in (`W`) to hoist yourself up, or reel out (`S`) to swing low over electrified floors.
- **Tether Jumping**: Detach at the apex of your swing with `Space` to convert pure rotational velocity into an explosive directional launch across massive gaps.
- **Vertical Wall Running**: Hit full sprint speed and run directly up vertical bulkheads to reach high platforms and hidden conduits.

### 2. Physical Circuit Rewiring & Logic Puzzles
- **Hands-On Electrical Routing**: You are a walking conductor. Plug yourself directly into 32px cardinal junction dials to rotate circuit tracks (`E` or click).
- **Logic Gates (AND & XOR)**: Solve real electrical networks. Route power through multi-input AND gates and exclusive XOR splitters to crack secure doors.
- **Live Causal Hazards**: Direct cause-and-effect physics. Connecting live power energizes conduits and de-electrifies lethal shock barriers, opening clean pathways through hazardous corridors.

### 3. Battery Management
- Every acrobatic leap, wall-run, tether jump, and circuit rotation draws on your onboard power cells.
- Keep an eye on your battery gauge! Jack into active generators or wall chargers to restore your charge before your systems hit emergency shutoff.

### 4. Interactive Field Drones
- Curious holographic drones hover throughout the sector. Click on them from any distance to receive tactical field intel, environmental analysis, and navigational tips.

---

## Controls

*All keyboard controls can be fully customized and rebound in the **Options** menu.*

| Action | Control | How to Use |
|---|---|---|
| **Move Left / Right** | `A` / `D` | Smooth acceleration & ground traction |
| **Sprint** | `Shift` + `A` / `D` | High-speed dash, required to initiate wall runs |
| **Wall Run** | Sprint into wall + `Space` | Run vertically up walls to scale heights |
| **Jump** | `Space` | Grounded jump with variable height & coyote time |
| **Tether Jump** | `Space` *(mid-air swing)* | Leaps forward with momentum boost and unplugs cable |
| **Aim & Launch Plug** | **Hold & Release LMB** | Draw trajectory arc; release to fire plug |
| **Cut / Detach Wire** | **RMB** | Drops straight down without momentum boost |
| **Reel In / Out** | `W` / `S` *(while swinging)* | Climb up or drop down along your tether |
| **Rotate Circuit Dial** | `E` *(or Left Click dial)* | Rotates connected circuit junction 90° clockwise |
| **Inspect Drone** | **Left Click** on drone | Opens field tutorial log from any distance |
| **Pause / Back** | `Escape` | Opens pause menu or returns from settings |

---

## Architecture & Codebase

Built completely from scratch using vanilla HTML5 Canvas, modern ES6 modules, and an event-driven `EventBus` pub/sub pipeline without bloated third-party frameworks:

```
src/
|-- main.js                       # Game bootstrap, system registration, and loop coordination
|-- core/
|   |-- Engine.js                 # Deterministic 60Hz fixed-timestep accumulator with interpolation
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

Clone the repository and spin up any standard static HTTP server:

```bash
# Clone the repository
git clone https://github.com/MumenOsman/Kood-game-jam-2026.git
cd Kood-game-jam-2026

# Option 1: Python 3
python3 -m http.server 3000

# Option 2: Node.js (npx serve)
npx serve . -p 3000

# Option 3: Included dev server
python3 dev_server.py
```

Then open `http://localhost:3000` in any modern web browser.

---

## Assets & Credits

- **Design, Programming, and Custom Art**: Mumen Osman ([mumen.dev](https://mumen.dev))
- **Additional 2D Pixel Art, GUI, & Audio**: [CraftPix.net](https://craftpix.net)
- **Built With**: Custom ES6 Canvas Engine, [LDtk](https://ldtk.io), and [Penpot](https://penpot.app)
- **Source Code**: [https://github.com/MumenOsman/Kood-game-jam-2026](https://github.com/MumenOsman/Kood-game-jam-2026)

---

## License

This project was created for the //kood Game Jam [Platformers] 2026. Custom code and level configurations are distributed under the MIT License. Embedded commercial art packs remain copyright their respective creators at CraftPix.net.
