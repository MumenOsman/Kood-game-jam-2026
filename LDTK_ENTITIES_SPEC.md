# LDtk Entity Specification Reference

Use this document to configure your Entity Definitions in LDtk (**Project Settings -> Entities**).  
You can copy and paste the **Identifiers**, **Tags**, and **Field Names** directly into LDtk so the level editor and the game engine stay 100% in sync.

---

## 1. Quick Setup Summary Table

| Entity Identifier | Visual / Role | Default Size | Pivot | Resizable | Key Fields |
|---|---|---|---|---|---|
| `Player_Spawn` | Robot spawn location | 32 × 32 | Center (0.5, 0.5) | No | None |
| `Socket_Dial` | Rotating circuit dial (T, L, Straight, Cross) | 32 × 32 | Center (0.5, 0.5) | No | `design`, `initialRotation`, `targetDevice` |
| `Socket_Battery` | Fast-charge battery alcove | 32 × 32 | Center (0.5, 0.5) | No | None |
| `Socket_Anchor` | Wire pendulum swing point | 32 × 32 | Center (0.5, 0.5) | No | None |
| `Terminal_Code` | Terminal box (red dot) for coding / overriding | 32 × 32 | Center (0.5, 0.5) | No | `terminalId`, `targetDevice` |
| `Junction_Box` | Passive wire splitter / distributor (4 white dots) | 32 × 32 | Center (0.5, 0.5) | No | `networkId` |
| `Pipe` | Visual pipe segment (if using Entities layer) | 32 × 32 | Center (0.5, 0.5) | No | None |
| `Door_Blast` | Security door that opens when powered | 32 × 64 | Top-Left (0, 0) | Yes (Height) | `id`, `startsOpen` |
| `Elevator` | Moving platform / lift | 64 × 16 | Top-Left (0, 0) | Yes (Width) | `behavior`, `distance`, `direction`, `speed` |
| `Ladder` | Vertical climbing ladder | 32 × 32 | Top-Left (0, 0) | Yes (Height) | None |
| `Stairs` | Smooth angled stair slope | 32 × 32 | Top-Left (0, 0) | Yes (Both) | `direction` |
| `Light_Lamp` | Ceiling/wall lighting fixture with radial glow | 32 × 32 | Center (0.5, 0.5) | No | `color`, `radius`, `intensity`, `flicker`, `needsPower` |

---

## 2. Detailed Entity Configurations

### Entity: `Player_Spawn`
- **Identifier:** `Player_Spawn`
- **Tags:** `gameplay`
- **Size:** `32` × `32` px
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Editor Visual:** Choose your hero icon or green color (`#00e676`).
- **Fields:** None.

---

### Entity: `Socket_Dial` (Rotating Circuit Dials)
- **Identifier:** `Socket_Dial`
- **Tags:** `sockets`, `circuits`
- **Size:** `32` × `32` px
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Fields (`+ SINGLE VALUE`):**
  1. **`design`** (Type: `Enum` or `String`)
     - Values:
       - `T_SHAPE`: 3-way splitter dial
       - `CORNER`: 90-degree L-bend dial
       - `STRAIGHT`: Pass-through I-pipe dial
       - `CROSS`: 4-way intersection dial
       - `SOURCE`: Power Generator / Power Supply Hub (the starting point where electricity originates; permanently energized)
     - Default: `T_SHAPE`
  2. **`initialRotation`** (Type: `Integer`)
     - Description: `0 = 0 deg, 1 = 90 deg, 2 = 180 deg, 3 = 270 deg`
     - Default: `0`
  3. **`targetDevice`** (Type: `String`)
     - Description: Optional device ID activated when this node receives power (e.g. `door_01`).
     - Default: `""`

### Alternative: 1-Click Dial Entities (Zero Fields / Zero Dropdowns)
If you want to stamp dials straight from the sidebar like stamps without opening menus:
- `Socket_Dial_T` (3-way splitter dial, 32×32, pivot center)
- `Socket_Dial_Corner` (L-bend dial, 32×32, pivot center)
- `Socket_Dial_Straight` (straight line dial, 32×32, pivot center)
- `Socket_Dial_Cross` (4-way intersection dial, 32×32, pivot center)
*(All have size 32×32, pivot center, and require zero custom fields).*

---

### Entity: `Socket_Battery` (Fast Charger Alcove)
- **Identifier:** `Socket_Battery`
- **Tags:** `sockets`, `energy`
- **Size:** `32` × `32` px (or the dimensions of your battery sprite)
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Editor Visual:** Battery sprite with lightning bolt (`#ffd600`).
- **Fields:** None needed (recharges at +30%/s automatically while docked).

---

### Entity: `Socket_Anchor` (Ceiling Swing Point)
- **Identifier:** `Socket_Anchor`
- **Tags:** `sockets`, `traversal`
- **Size:** `32` × `32` px
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Fields:** None needed.

---

### Entity: `Terminal_Code` (Terminal Box with Red Dot)
- **Identifier:** `Terminal_Code`
- **Tags:** `interactable`, `logic`
- **Size:** `32` × `32` px
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Editor Visual:** Grey plate with diamond border & red center dot (`#ff1744`).
- **Description:** Reserved for future drag-and-drop visual logic / automation terminal (Human Resource Machine style).
- **Fields (`+ SINGLE VALUE`):**
  1. **`terminalId`** (Type: `String`, Default: `term_01`)
  2. **`targetDevice`** (Type: `String`, Default: `door_01`)

---

### Entity: `Junction_Box` (Wire Splitter with 4 White Dots)
- **Identifier:** `Junction_Box`
- **Tags:** `circuits`
- **Size:** `32` × `32` px
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Behavior:** Passive multi-way conduit splitter / bus. When power enters from any connected pipe, it automatically branches out to all 4 pipe outputs simultaneously without needing rotation.
- **Fields (`+ SINGLE VALUE`):**
  1. **`networkId`** (Type: `String`, Default: `net_main`)

---

### Entity: `Pipe` (If placing pipes on an Entity layer)
- **Identifier:** `Pipe`
- **Tags:** `circuits`
- **Size:** `32` × `32` px
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Fields:** None needed!

> **💡 Time-Saving Recommendation for Pipes:**  
> The fastest and easiest way to place pipes is to make your `Pipes` layer a **Tiles** layer (instead of an Entities layer). Then you simply paint your pipes on the map with your brush in 5 seconds. The engine will detect the connected pipes automatically!

---

### Entity: `Door_Blast` (Sliding Security Door)
- **Identifier:** `Door_Blast`
- **Tags:** `doors`, `obstacles`
- **Size:** `32` × `64` px (adjust height to your corridor)
- **Pivot:** Top-Left (`X: 0`, `Y: 0`)
- **Resizable:** Check **Height** (so you can stretch it to fit any doorway height)
- **Editor Visual:** Red/Orange barrier (`#ff5722`).
- **Behavior:** Slides vertically upward into the ceiling when power reaches it, with a status light (Red = Locked, Green = Open).
- **Fields (`+ SINGLE VALUE`):**
  1. **`id`** (Type: `String`, Default: `exit_door`)
  2. **`startsOpen`** (Type: `Boolean`, Default: `false`)

---

### Entity: `Elevator` (Moving Platform / Lift)
- **Identifier:** `Elevator`
- **Tags:** `traversal`, `platforms`
- **Size:** `64` × `16` px
- **Pivot:** Top-Left (`X: 0`, `Y: 0`)
- **Resizable:** Check **Width** (so you can make narrow or wide elevators)
- **Editor Visual:** Industrial platform (`#7c4dff`).
- **Fields (`+ SINGLE VALUE`):**
  1. **`behavior`** (Type: `Enum` or `String`, Default: `CONSTANT_LOOP`)
     - Options:
       - `CONSTANT_LOOP`: Moves up and down (or back and forth) constantly once powered.
       - `ONE_WAY`: Waits for player to step on, carries them to the destination area once, and then stays parked permanently.
  2. **`speed`** (Type: `Float`, Default: `120.0`)
  3. **`distance`** (Type: `Integer`, Default: `128`)
     - Number of pixels to travel (positive = down/right, negative = up/left).
  4. **`direction`** (Type: `Enum` or `String`, Default: `VERTICAL`)
     - Options: `VERTICAL`, `HORIZONTAL`
  5. **`needsPower`** (Type: `Boolean`, Default: `true`)
     - If true, only activates once circuit power reaches its connected line.

---

### Entity: `Ladder` (Vertical Climbing Ladder)
- **Identifier:** `Ladder`
- **Tags:** `traversal`
- **Size:** `32` × `32` px
- **Pivot:** Top-Left (`X: 0`, `Y: 0`)
- **Resizable:** Check **Height** (stretch vertically down/up to match the ladder's length)
- **Editor Visual:** Ladder sprite or amber marker (`#ffb300`).
- **Behavior:** When the robot overlaps with this zone, holding **[W]** climbs up, **[S]** climbs down, and gravity is paused while clinging.
- **Fields:** None needed!

---

### Entity: `Stairs` (Angled Stair / Ramp Slope)
- **Identifier:** `Stairs`
- **Tags:** `traversal`, `geometry`
- **Size:** `32` × `32` px
- **Pivot:** Top-Left (`X: 0`, `Y: 0`)
- **Resizable:** Check **Width** and **Height** (stretch across your stair staircase)
- **Editor Visual:** Green slope ramp (`#00e676`).
- **Behavior:** Smooth diagonal collision surface preventing the robot from snagging on jagged tile steps when running up or down.
- **Fields (`+ SINGLE VALUE`):**
  1. **`direction`** (Type: `Enum` or `String`, Default: `UP_RIGHT`)
     - Options:
       - `UP_RIGHT`: Slopes upward from bottom-left to top-right.
       - `UP_LEFT`: Slopes upward from bottom-right to top-left.

---

### Entity: `Light_Lamp` (Ceiling / Wall Lighting Fixture)
- **Identifier:** `Light_Lamp`
- **Tags:** `visuals`, `lighting`
- **Size:** `32` × `32` px
- **Pivot:** Center (`X: 0.5`, `Y: 0.5`)
- **Resizable:** No
- **Editor Visual:** Lamp fixture / light bulb (`#ffee58`).
- **Behavior:** Casts radial ambient lighting onto the background and platforms.
- **Fields (`+ SINGLE VALUE`):**
  1. **`color`** (Type: `Color`, Default: `#ffe57f` - warm industrial light)
  2. **`radius`** (Type: `Integer`, Default: `160` - light radius in pixels)
  3. **`intensity`** (Type: `Float`, Default: `0.75` - brightness from `0.0` to `1.0`)
  4. **`flicker`** (Type: `Boolean`, Default: `false` - subtle industrial electrical hum/flicker)
  5. **`needsPower`** (Type: `Boolean`, Default: `false` - if true, only turns on when circuit power reaches it)

