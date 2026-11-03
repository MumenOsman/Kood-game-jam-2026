# 2D Tether Puzzle Platformer - Core Modular Architecture

A 2D pacifist side-scrolling puzzle platformer built with standard HTML5 Canvas and ES6 JavaScript. The game features physics-based wire swinging, directional electrical circuit routing, and snappy platformer locomotion.

---

## Controls

| Control | Action |
|---|---|
| A / D | Walk Left / Right |
| Shift + A / D | Run Left / Right |
| Space | Jump (from ground) / Tether Jump (when swinging mid-air: leaps towards facing direction and unplugs wire) |
| S | Dock / Rest (press on ground, or hold near a charger station to recharge battery) |
| Hold Left Mouse Button (LMB) | Aim and spin head plug, building launch velocity with parabolic trajectory arc |
| Release Left Mouse Button | Launch plug along trajectory arc to latch onto sockets |
| Right Mouse Button (RMB) | Cut / unplug wire cleanly without jump boost |
| W / S (while swinging) | Reel wire in (climb up) / Reel wire out (lower down) |
| E | Rotate connected electrical circuit junction 90 degrees clockwise |

---

## Architecture and Modularity

The project uses a fully decoupled architecture powered by a central EventBus Pub/Sub system:

```
src/
|-- main.js                  # Engine setup, system registration and loop orchestration
|-- core/
|   |-- Engine.js            # Fixed-timestep loop (60Hz accumulator) and variable rendering
|   |-- EventBus.js          # Independent pub/sub communication bus
|   |-- InputManager.js      # WASD, Space, Shift, E, Mouse coordinates and buttons
|   |-- Camera.js            # Smooth tracking 2D camera with boundary constraints
|   `-- AssetLoader.js       # Asynchronous sprite and JSON asset loader
|-- entities/
|   |-- Player.js            # Player kinematics, battery, anchor transforms, state
|   `-- Socket.js            # Sockets: ANCHOR, CIRCUIT, CHARGER
|-- modules/
|   |-- PlayerMovement.js    # Snappy platforming, friction, coyote time, tether jump, collision
|   |-- WireSystem.js        # Aim arc, projectile launch, pendulum distance constraint, sag/tension
|   |-- CircuitSystem.js     # Bitmask directional ports, BFS power propagation, [E] 90 deg rotation
|   `-- AnimationController.js # Sprite animation playback from Hero-sprites.jpg/.png
|-- levels/
|   |-- Level.js             # Base level interface
|   `-- TestRoom.js          # Implementation of the initial level design sketch
`-- ui/
    `-- HUD.js               # Battery gauge, contextual action hints, status messages
```

### Key Architectural Systems:
1. Event-Driven Communication:
   - WIRE_CONNECTED, WIRE_DISCONNECTED: Fired when the plug connects or detaches.
   - REQUEST_WIRE_DETACH: Fired by PlayerMovement upon a mid-air tether jump.
   - CIRCUIT_UPDATED: Fired upon rotating a junction node.
   - ACTIVATE_DEVICE: Fired when power reaches a device (e.g. Exit Door opens).
2. Bitmask Circuit Flow:
   - Directions: NORTH = 1, EAST = 2, SOUTH = 4, WEST = 8.
   - Clockwise 90 degrees rotation is an O(1) bit shift.
   - Power travels from active sources (like the ceiling Nuclear Generator) via Breadth-First Search (BFS) to reachable receivers.
3. Pendulum Physics (Distance Constraint):
   - When airborne and connected, radial velocity outward is eliminated, enforcing circular pendulum swinging.
   - Wire visual transitions smoothly between a catenary/Bezier sag when slack and a taut, glowing electrical cable under tension.

---

## Running the Project

Start any local static HTTP server from the project directory:

```bash
# Using Python 3
python3 -m http.server 8000

# Or using npx
npx serve .
```

Open http://localhost:8000 in any modern web browser.
