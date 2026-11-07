# SOURCE OF TRUTH: 2D Tether Puzzle Platformer

This document is the persistent source of truth for the project. It must be consulted and updated whenever features, architecture, mechanics, or configurations are modified, ensuring seamless continuity across development sessions.

---

## 1. Project Overview & Core Constraints

- Game Concept: A 2D side-scrolling puzzle platformer where a robot uses a physical tether wire emerging from the top of its head to traverse environments and restore electrical power.
- Pacifist Philosophy: Zero combat, no weapons, and no enemies. Mechanics focus on traversal, timing, physical puzzles, and electrical routing.
- Icon / Emoji Policy: No icons or emojis in code, UI, levels, or documentation files unless explicitly requested by the user.
- Engine: Vanilla HTML5 Canvas and ES6 JavaScript modules with no external framework lock-in.

---

## 2. Directory Tree & Architecture

```
Kood-game-jam-2026/
|-- index.html                                 # Canvas container, UI layout, keybind legend
|-- README.md                                  # Human-readable project overview
|-- SOURCE_OF_TRUTH.md                         # Persistent machine and developer state specification
|-- assets/
|   |-- sprites/
|   |   |-- Hero-sprites.jpg                   # Original reference spritesheet
|   |   |-- Hero-sprites.png                   # Transparent background processed spritesheet
|   |   |-- Hero-sprites.json                  # Frame coordinates for all animation states
|   |   |-- Hero-v2.png                        # New Sci-Fi hero spritesheet (74 normalized animation frames)
|   |   `-- Hero-v2.json                       # Frame coordinates for idle, run, jump, swing, hurt, death
|   `-- levels/
|       `-- Initial-level-concept.png          # Reference level design sketch
`-- src/
    |-- main.js                                # Bootstrap, module wiring, game loop initiation
    |-- core/
    |   |-- Engine.js                          # Fixed 60Hz update accumulator, variable render interpolation
    |   |-- EventBus.js                        # Decoupled Pub/Sub messaging bus
    |   |-- InputManager.js                    # Keyboard and mouse coordinate / button tracker
    |   |-- Camera.js                          # Smooth 2D tracking camera with boundary clamping
    |   `-- AssetLoader.js                     # Asset loader with fallback image support
    |-- entities/
    |   |-- Player.js                          # Robot entity state, transform, battery, head socket
    |   |-- Socket.js                          # Sockets: ANCHOR, CIRCUIT, CHARGER
    |   `-- Drone.js                           # Tutorial guide & facility hover drones with proximity dialogue
    |-- modules/
    |   |-- PlayerMovement.js                  # Platformer kinematics, friction, jump, tether jump, wall slide/jump
    |   |-- WireSystem.js                      # Trajectory arc, projectile throw, mid-air pendulum physics
    |   |-- CircuitSystem.js                   # Bitmask directional ports, BFS power propagation, rotation
    |   |-- PipeSystem.js                      # Industrial pipe flow engine, traveling lights, dynamic power routing
    |   |-- HazardSystem.js                    # Electrified objects, hazards, shock triggers, and arc rendering
    |   `-- AnimationController.js             # Sprite playback and procedural fallback renderer
    |-- levels/
    |   |-- Level.js                           # Base level interface
    |   |-- TestRoom.js                        # Level layout implementing the initial tutorial sketch
    |   `-- LDtkLevel.js                       # Modular LDtk level loader (IntGrid collisions, greedy merging, composite render)
    |-- debug/
    |   `-- DevTools.js                        # Isolated dev-only physics calibrator, telemetry, and gizmos
    `-- ui/
        `-- HUD.js                             # Battery gauge, contextual interaction prompts, status banner
```

---

## 3. Core Mechanics & Technical Specifications

### 3.1. Locomotion & Platforming (`PlayerMovement.js`)
- Arcade Deterministic Kinematics (Option 1 / "Brawlhalla" Style):
  - Unit of Measurement: Strictly locked to 32px grid squares (`1 sq = 32px`).
  - Physical Dimensions: Exactly $32 \times 32\text{ px}$ (1 grid square).
  - Jump Apex Height: Strictly capped at **2 squares ($64\text{ px}$)** via discrete Euler impulse $v_0 = -435.15\text{ px/s}$ with gravity $g = 1400\text{ px/s}^2$.
  - Jump Horizontal Landing Span: Strictly capped at **2 squares ($64\text{ px}$)** via air velocity clamping $v_x = 103.8\text{ px/s}$ ($63.5\text{ px}$ landing span). Jumping while sprinting never overshoots the 2-tile span limit.
  - Instant Ground Locomotion: Instant full walk speed (5.0 sq/s = 160 px/s) or run speed (8.0 sq/s = 256 px/s) on key press, and instant crisp stop (`vx = 0`) on key release (zero ice-skating drift or sliding lag).
  - Deterministic Space Tap: Fixed jump arc by default; tapping Space executes the full 2-square arc cleanly without accidental cutoffs.
- Ground Locomotion Speeds:
  - Walk Speed: 5.0 sq/s ($160\text{ px/s}$)
  - Run Speed (Shift): 8.0 sq/s ($256\text{ px/s}$)
  - Emergency Depleted Crawl: 2.5 sq/s ($80\text{ px/s}$)
- Jump Kinematics:
  - Ground Jump Apex: Strictly 2 squares ($64\text{ px}$)
  - Wall Jump: 2 squares up ($64\text{ px}$), 2 squares outward ($64\text{ px}$)
  - Tether Mid-Air Jump: 2 squares up, 2 squares forward
  - Coyote Time: 120ms buffer for ledge jumps
  - Jump Buffer: 120ms pre-landing jump press memory
- Energy Mechanics:
  - Drain Walk: 0.5% / sec
  - Drain Run: 1.2% / sec
  - Ground Jump Cost: 1.5% per jump
  - Tether Jump Cost: 2.0% per jump
  - Circuit Dial Rotation Cost: 3.0% per 90 deg turn
  - Idle / Wire Aiming: 0.0% (free of charge)
  - Wall CHARGER Socket: Recharges rapidly at +30.0% / sec up to 100.0%
  - Emergency Rest Trickle: Recharges at +1.0% / sec while resting on the ground up to a 20.0% safety threshold
- Energy States:
  - Nominal (> 50%): Full speed and mobility, green HUD bar.
  - Moderate (25% - 50%): Full mobility, warm amber HUD bar.
  - Low Power (1% - 25%): Red pulsing HUD bar, sprinting disabled, jump force slightly softened.
  - Depleted (0%): Emergency crawl mode (80 px/s), small hops, can sit to trickle back up to 20% or plug into charger. Zero punishment or resets.

### 3.2. Wire & Tether Dynamics (`WireSystem.js`)
- Max Wire Length: 3 squares ($96\text{ px}$) strictly locked.
- Min Wire Length: 20 px
- Projectile Speed: 1400 px/s straight line towards mouse cursor (`PROJECTILE_GRAVITY = 0`).
- Firing: Single LMB click launches the wire instantly from gun muzzle directly at the cursor coordinates.
- Reeling Speed: 140 px/s (climb with W, descend with S while airborne)
- Socket Highlight: Sockets within 3 squares ($96\text{ px}$) highlight automatically.
- Mid-Air Pendulum Constraint: Radial distance constraint eliminates outward radial velocity component, enforcing circular pendulum swinging.
- Wire Cut: Right Mouse Button (RMB) cleanly disconnects the wire with zero jump boost, preserving tangential momentum.
- Ground Auto-Detachment: Walking on the ground beyond 3 squares automatically snaps the plug out.
- Visuals: Straight glowing line under tension with animated electrical pulses. Recoil gun firing stance triggers on shot.

### 3.3. Circuit System & Grid Logic (`CircuitSystem.js`)
- Cardinal Port Architecture: Defined as a 4-element boolean array `[Top, Right, Bottom, Left]`:
  - `PORT.TOP = 0`
  - `PORT.RIGHT = 1`
  - `PORT.BOTTOM = 2`
  - `PORT.LEFT = 3`
- Node Designs (3 Distinct Types):
  1. Straight Node (I-Pipe): 2 opposite ports active (`[false, true, false, true]` horizontal or `[true, false, true, false]` vertical), routing power straight across.
  2. Corner Node (L-Bend): 2 adjacent ports active (`[true, false, false, true]`, `[true, true, false, false]`, etc.), routing power at 90 degrees.
  3. Splitter Node (T-Junction): 3 ports active (`[false, true, true, true]`, `[true, true, false, true]`, etc.), splitting incoming power into two outgoing directions.
- Rotation Mechanism: Pressing E while tethered to a CIRCUIT socket shifts the active port array by 1 index clockwise (`[Left, Top, Right, Bottom]`), smoothly animates dial rotation by 90 degrees, spawns electrical sparks along the dial rim, and emits `EventBus.emit('CIRCUIT_UPDATED')`.
- Power Propagation (BFS): Power is traced from SOURCE nodes through background conduits. Power only flows between adjacent nodes if their touching ports are both active.
- Visual Representation:
  - Circular wall dials (radius 34 px) with double concentric metallic blue housing (`#204a6e` outer, `#4da6ff` inner).
  - Internal conduit channels with metallic blue borders (`#3ca0ff`, 2.2 px).
  - Inner channel fill: dark charcoal (`#0d131a`) when unpowered.
  - Animated electrical plasma current: flowing amber/orange wave (`#ff9900` glow with `#fff099` core) traveling along active channels when powered.
  - Center wire plug socket: integrated metallic blue socket at (0, 0) of dial, illuminating amber when tethered.
- Device Triggering: When power reaches a RECEIVER node, emits `ACTIVATE_DEVICE`, opening blast doors or moving platforms. When power is severed, emits `DEACTIVATE_DEVICE`.

### 3.4. Wall Run & Wall Jump Mechanics (`PlayerMovement.js` & `Level.js`)
- Modular Wall Definition: Any collider registered in any level with `isWallRunnable: true` acts as a wall-runnable surface. Supports `wallRunFace: 'left' | 'right' | 'both'` (default: `'both'`).
- Auto-Stick Contact: When airborne and contacting a valid non-electrified wall-run surface, the player automatically sticks to the wall flush against its face without needing to hold A or D. Horizontal velocity stops (`vx = 0`), facing aligns toward the wall, and descent speed is clamped to 110 px/s (`isWallSliding = true`).
- Fast Slide with S: Holding S (`moveDown`) accelerates the descent speed down the wall to 320 px/s (`FAST_WALL_SLIDE_SPEED = 320 px/s`). S does not cause jumping from the wall.
- Wall Jump Execution (Space ONLY): Wall jump is triggered strictly by pressing Space (`jumpPressed`). S does not jump. Wall jump launches the robot outward (340 px/s) and upward (-490 px/s) away from the wall.
- Wall Coyote Time: 120ms buffer allowing wall jump immediately after sliding off or detaching from the wall.
- Directional Lock: 150ms input lock during wall kick to prevent immediate counter-steering and preserve parabolic leap arc.
- Electrification Check: If a wall is electrified (`isElectrified: true`), wall sliding is blocked and player contact triggers a high-voltage shock instead.
- Visual Cue: `Level.renderWallRunGripStrips(ctx)` renders cyan tactile friction runner grooves along runnable wall faces. HUD displays contextual prompt `[Space] Wall Jump  |  Hold [S] Fast Slide` while sliding.

### 3.5. Modular Electrified Hazards & Objects (`HazardSystem.js` & `Level.js`)
- Modular Hazard Architecture: Managed by `HazardSystem`, completely decoupled from specific room geometry. Any collider in any level with `isElectrified: true` acts as an active hazard.
- Directional Faces Supported:
  - `'right'`: Electric field along right edge; knockback repels player rightward (+360 px/s).
  - `'left'`: Electric field along left edge; knockback repels player leftward (-360 px/s).
  - `'top'`: Electric field along top edge (floors/rails); knockback blasts player upward (-380 px/s).
  - `'bottom'`: Electric field along bottom edge (ceilings); knockback blasts player downward (+300 px/s).
  - `'all'`: Electric field around entire perimeter; knockback repels omnidirectionally away from center.
- Shock Mechanics:
  - Battery Drain: Configurable `shockDamage` (default -8.0% battery power).
  - Knockback: Configurable `knockbackForce` (default 360 px/s).
  - Invulnerability Window: 450ms invulnerability timer during which the player sprite flickers at 45Hz.
  - Zero Violent Death: Consistent with pacifist rules, shock drains power and knocks back; depleted battery enters emergency crawl mode.
- Circuit & Device Integration:
  - Listens to `ACTIVATE_DEVICE(deviceId)`: Sets matching colliders to `isElectrified: true`, bursting sparks.
  - Listens to `DEACTIVATE_DEVICE(deviceId)`: Sets matching colliders to `isElectrified: false`, bursting safe cyan sparks.
  - Listens to `TOGGLE_DEVICE(deviceId)`: Inverts electrification state.
- Visual Effects: High-voltage animated double-phase lightning arcs (magenta `#ff4081` outer, cyan `#00e5ff` secondary, white core) with pulsating red hazard warning LEDs when active, and calm green LEDs when de-electrified.

### 3.6. DevTools & Debug Inspection Suite (`DevTools.js`)
- Production Isolation Guard: Dynamically imported only when `IS_DEV` evaluates to true (`localhost`, `127.0.0.1`, or explicit `?debug=true` query param). In public itch.io production releases, debug code is never loaded or executed.
- Toggle Hotkeys: Tilde / Backquote (`` ` `` / `~`) or `F1` toggles the entire DevTools overlay and tuning sidebar.
- Telemetry HUD: Real-time velocity (`vx`, `vy`), locomotion state (`GROUNDED`, `AIRBORNE`, `WALL_SLIDING`, `TETHERED`, `RESTING`), active timers (`coyoteTimer`, `jumpBufferTimer`, `wallCoyoteTimer`, `wallJumpLockTimer`), wire length, battery power, and mouse world coordinates.
- Hitbox & Gizmo Visualizers:
  - Player AABB with state-dependent colors (green = grounded, cyan = airborne, amber = wall slide, magenta = shock invulnerable).
  - Wall-run surfaces with 10px contact detection threshold margins.
  - Electrified hazards with active face indicators.
  - Sockets with 30px magnetic latch capture radii and 280px / 500px wire range limits.
  - Pendulum radial constraint ring around active anchor socket.
- Trajectory Path Tracer & Apex Marker: 180-frame historical trail rendering the exact parabolic curve of jumps and pendulum swings, marking jump apex height and horizontal distance span.
- Interactive Distance Ruler: Hold `Shift` + `Right-Click` and drag to measure horizontal distance (`dx`), vertical height difference (`dy`), and Euclidean distance (`dist`) in pixels.
- Live Physics Tuning Sidebar: Floating DOM drawer with live two-way bound sliders for walk/run speeds, acceleration, friction, ground jump, wall jump up/outward impulses, wall slide speeds, gravity, wire throw speeds, and reel speed. Includes a `[Copy Config]` button that exports calibrated JavaScript constants to clipboard.

### 3.7. Pipe Flow System & LDtk Grid Lockdown (`PipeSystem.js` & `LDtkLevel.js`)
- Universal LDtk Entity Pivot Calculation:
  ```javascript
  const topLeftX = worldX + ent.px[0] - (pivotX * w);
  const topLeftY = worldY + ent.px[1] - (pivotY * h);
  const centerX = topLeftX + w / 2;
  const centerY = topLeftY + h / 2;
  ```
  - For entities with pivot `[0.5, 0.5]`, `ent.px` is already the entity's center. No `+ 16` offset is added.
  - Sockets and circuit nodes receive `(centerX, centerY)`, while sprites drawing from top-left (`Drone`, `Logic_Gate`, `Light_Box`) receive `(topLeftX, topLeftY)`.
  - Every entity occupies strictly one single $32\times32\text{ px}$ grid cube, centered precisely where placed in LDtk.
- Pipe Flow Network Engine (`PipeSystem.js`):
  - Extracts and renders all 19 tiles on the `Pipes` layer from `map.ldtk` (`circuits_sheet`).
  - Classifies conduits into vertical (`[96, 64]`), horizontal (`[0, 64]`, `[32, 96]`), and corner bends (`[64, 128]` for Right/Bottom, `[0, 128]` for Left/Bottom).
- Multi-Layer Visual Pipeline ("With Lights and Everything"):
  - Base metal conduit casing from `circuits.png`.
  - Molten golden lumen channel (`#ffba00`) with ultra-bright filament core (`#fff8cc`) when energized.
  - Continuous traveling high-voltage dashed plasma pulses (`#ffffff` / `#ffe066`) streaming continuously along each pipe in the direction of power flow.
  - Seamless 90-degree corner light rounding without sprite clipping.
  - Tactile micro-sparks and coupling joint indicator LEDs.
  - Recessed armored wall conduit bridge spanning Chamber 1 to Chamber 2 across the vertical hazard shaft.
- Facility Circuit Propagation & Puzzle Logic:
  - Ceiling Power Feed: Column 6 (`1472, 0..96`) is permanently energized by the facility generator.
  - Dial 0 (CORNER at 1488, 144): Connects Top to Right, feeding the horizontal exit pipe and the wall conduit to Chamber 2.
  - Dial Bus (Dials 1..4): Daisy-chained power bus feeding into `OR Gate 1` and `OR Gate 2`.
  - Logic Gates: `AND Gate` activates when both `OR Gate 1` and `OR Gate 2` conditions are satisfied.
  - Door Trunk Line: Transmits electricity down into the status light box and blast door.
  - Light Box: Features a heavy-duty metallic box (`circuits.png` `[0, 160]`) with a dual-state status diode (Crimson Red with slow breathing pulse when locked; radiant Cyber Green with downward ambient glow when online).
  - Solid Blast Door: `LDtkLevel.getSolidColliders()` physically blocks player passage until the circuit puzzle is solved and the door slides open.
  - Dial Rotation Access: Pressing [E] rotates a dial both when tethered via wire and when standing adjacent to the dial (within 42px).

---

## 4. EventBus Topic Registry

| Event Topic | Payload | Emitted By | Handled By |
|---|---|---|---|
| `WIRE_LAUNCHED` | `{ x, y, vx, vy }` | `WireSystem` | Audio / Particles |
| `WIRE_CONNECTED` | `socket` | `WireSystem` | `CircuitSystem`, `HUD`, `Player` |
| `WIRE_DISCONNECTED` | `socket` | `WireSystem` | `CircuitSystem`, `HUD`, `Player` |
| `REQUEST_WIRE_DETACH` | `null` | `PlayerMovement` | `WireSystem` |
| `PLAYER_JUMP` | `{ x, y }` | `PlayerMovement` | Sound / FX |
| `PLAYER_TETHER_JUMP` | `{ x, y, dir }` | `PlayerMovement` | `HUD`, FX |
| `PLAYER_WALL_JUMP` | `{ x, y, dir }` | `PlayerMovement` | `HUD`, AnimationController, FX |
| `PLAYER_SHOCKED` | `{ damage, knockbackX, knockbackY, deviceId }` | `HazardSystem` | `PlayerMovement`, `HUD`, FX |
| `PLAYER_REST_START` | `null` | `PlayerMovement` | `AnimationController` |
| `PLAYER_REST_END` | `null` | `PlayerMovement` | `AnimationController` |
| `BATTERY_CHANGED` | `batteryLevel` | `PlayerMovement` | `HUD` |
| `CIRCUIT_UPDATED` | `{ nodeId, ports }` | `CircuitSystem` | `HUD`, Level |
| `ACTIVATE_DEVICE` | `deviceId` | `CircuitSystem` | `TestRoom`, `HazardSystem` |
| `DEACTIVATE_DEVICE` | `deviceId` | `CircuitSystem` | `TestRoom`, `HazardSystem` |
| `TOGGLE_DEVICE` | `deviceId` | CircuitSystem / Level | `HazardSystem` |

---

## 5. Level Specification: Test Room (`TestRoom.js`)

Based on `Initial files/Initial-level-game-mechanics-test.png` and `media_1793727603625_21c05ec9.png`:
- Zone 1 (Spawn Chamber): x = 40 to 860. Tutorial prompts for walk, run, dock/rest. Storage boxes to jump onto.
- Zone 2 (Jump Gap): Gap from x = 860 to 1060 (width 200 px).
- Zone 3 (Swing Chasm): Gap from x = 1340 to 1860 (width 520 px). Ceiling anchor socket at (1600, 150).
- Zone 4 (Charger Alcove): Platform x = 1860 to 2400. Wall socket at (2150, 460) of type CHARGER.
- Zone 5 (Circuit Puzzle Corridor): Platform x = 2400 to 3620.
  - Nuclear Generator Source at (2550, 240).
  - Dial 1: Splitter Node (T-Junction) at (2750, 240) with elevated box at (2710, 480).
  - Dial 2: Corner Node (L-Bend) at (3050, 240) with elevated catwalk at (2980, 440).
  - Dial 3: Straight Node (I-Pipe) at (3280, 420).
- Zone 6 (Exit Blast Door): Blast Door receiver at (3480, 420), height 180 px. Opens upward with hydraulic animation when power routes from Nuclear source through all three dials.
- Zone 7 (Chamber 02 & Vertical Chimney Shaft): x = 3508 to 5100.
  - Chamber 02 floor from x = 3508 to 4340.
  - Substation Power Source at (3820, 380) routing power right to Dial 4.
  - Dial 4 (Wall Cutoff Dial): Straight I-Pipe at (4020, 380), initially horizontal `[false, true, false, true]`, delivering power to the shaft left wall. Rotating 90 degrees cuts power to the wall.
  - Shaft Left Wall: Collider at x = 4150, y = 140, width = 30, height = 440 (`deviceId: 'shaft_left_wall'`). Initially electrified on right face. When de-electrified via Dial 4, becomes wall-runnable (`wallRunFace: 'right'`).
  - Shaft Right Wall: Collider at x = 4340, y = 260, width = 30, height = 320 (`isWallRunnable: true`, `wallRunFace: 'left'`).
  - Chimney Shaft Width: 160 px between walls (x = 4180 to 4340), perfectly sized for wall jumping up.
  - Upper Floor Platform: Extends from top of right wall (x = 4340 to 5040, y = 260) into upper facility area.

---

## 6. Controls Reference

| Input | Action |
|---|---|
| A / D | Walk Left / Right |
| Shift + A / D | Run Left / Right |
| Space | Jump from ground / Mid-air Tether Jump / Wall Jump (only Space wall jumps) |
| S | Dock / Rest (on ground) / Fast Slide (when attached to wall) |
| Hold LMB | Aim and spin head plug, previewing parabolic trajectory arc |
| Release LMB | Launch plug projectile along arc |
| RMB | Cut / unplug wire cleanly without jump boost |
| W / S (airborne) | Reel wire in / out |
| E | Rotate connected circuit junction 90 degrees clockwise |

---

## 7. Change Log

- 2026-11-03: Initial build of modular core platformer engine, decoupled EventBus, fixed-timestep 60Hz loop, WireSystem with pendulum physics and aiming arc, CircuitSystem with bitmask power routing and BFS, TestRoom matching sketch layout, HUD, and Hero sprite integration.
- 2026-11-03: Updated mid-air tether mechanics: RMB cleanly cuts wire without jump boost; Space mid-air performs tether jump in facing direction.
- 2026-11-03: Removed all icons, emojis, and non-ASCII decorative characters across all project files.
- 2026-11-03: Created SOURCE_OF_TRUTH.md as persistent project state documentation.
- 2026-11-03: Implemented cardinal port array model [Top, Right, Bottom, Left] and 3 distinct junction dial designs (Straight I-Pipe, Corner L-Bend, Splitter T-Junction). Added metallic blue dial housing, internal channel borders, and animated amber/orange electrical plasma currents. Updated TestRoom to feature a multi-node puzzle with elevated access platforms and blast door activation.
- 2026-11-03: Implemented subtle battery power depletion system (walking 0.5%/s, running 1.2%/s, jumps 1.5%, tether jumps 2.0%, dial rotation 3.0%). Added Low Power Mode (< 25%), Emergency Crawl Mode (0%), emergency rest trickle recharge (+1%/s up to 20%), trailing ghost depletion bar in HUD, and cleaned conduit termination at dial housing rims.
- 2026-11-03: Implemented modular Wall Run and Wall Jump mechanics (clamped slide speed 110 px/s, coyote timer, wall kick impulse 340 px/s outward and -490 px/s upward with directional lock). Implemented modular HazardSystem managing electrified colliders of any orientation (left, right, top, bottom, all), directional knockback, -8% battery shock drain, and high-voltage double-phase lightning arc rendering. Extended TestRoom with Chamber 02, vertical chimney shaft (160 px wide), substation power line, cutoff dial, and upper floor platform. Added Level.js helper methods (addWallRunWall, addHazardObject, renderWallRunGripStrips) for seamless level extensibility.
- 2026-11-03: Refined wall run mechanics: player automatically sticks to wall-runnable surfaces upon contact without requiring A or D input; pressing either Space or S allows jumping off the wall. Added contextual HUD prompt and updated InputManager with downPressed support.
- 2026-11-03: Updated wall sliding and jumping controls per feedback: pressing/holding S accelerates slide down to 320 px/s without jumping; only Space executes the wall jump. Updated HUD prompt to [Space] Wall Jump | Hold [S] Fast Slide and footer controls legend.
- 2026-11-03: Implemented isolated DevTools & Debug System (DevTools.js): gated by IS_DEV environment check, toggleable via `~` or F1. Features real-time kinematics telemetry HUD, hitbox and socket constraint gizmos, jump trajectory and apex tracer, Shift+RMB interactive pixel distance ruler, and live DOM physics tuning panel with clipboard preset export.
- 2026-11-07: Completed Stage 1 & 2: Locked player physical bounds strictly to 32x32 px with HD 192x192 supersampled sprite rendering (Hero-v2.png), deterministic 2-square jump apex and span kinematics, DevTools calibrated in squares, authentic 32x32 animated pixel-art drones (Drones +.png), rotatable dials (Circuits(4).png), logic gates (Gates.png), and sockets.
- 2026-11-07: Completed Stage 3: Resolved LDtk entity pivot math (topLeft = worldX + px - pivot * w; center = topLeft + w/2), locking all dials, sockets, anchors, chargers, drones, gates, and light boxes into single 32px cubes. Built PipeSystem.js parsing all 19 tiles from map.ldtk Pipes layer, rendering molten golden lumen illumination, continuous traveling light pulses streaming in flow direction, smooth 90-degree corner light rounding, micro-sparks, dynamic circuit power propagation from ceiling generator through dials and logic gates (OR, AND) to the exit blast door and status light box, with physical solid door collider blocking player passage when closed.


