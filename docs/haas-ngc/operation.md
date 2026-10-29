# Haas NGC mill – modes, screens and operator procedures

This file is the spec for the control's operating behaviour as the trainee sees it. It covers modes, display screens and the standard step-by-step procedures. For keys see `pendant.md`. For G/M-code semantics see `gcode.md` and `mcode.md`. For setting numbers see `settings-alarms.md`. For machine numbers see `umc500.md`.

## Sources

| ID | Source |
|---|---|
| [OM20] | Haas *Mill Operator's Manual, NGC*, 96-8210 Rev N (Dec 2020), PDF. https://www.haascnc.com/content/dam/haascnc/en/service/manual/operator/english---mill-ngc---operator's-manual---2020.pdf . Chapters: 1.3 Door Rules (pp. 9–10); 2.3.4 Control Display (pp. 50–73); 3 Control Icons (pp. 85–101); 4 Operation (pp. 103–176); 5.2 Program Edit Modes (pp. 177–186); 6.9 Probing (pp. 227–232); 9 Settings. |
| [OL-D] | Online manual "5 – Mill – Control Display": https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---control-display.html |
| [OL-O] | Online manual "11 – Mill – Operation": https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---operation.html |
| [OL-PS] | Online manual "8 – Mill – Part Setup": https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---part-setup.html |
| [OL-SMTC] | Online manual "10 – Mill – SMTC": https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---smtc.html |
| [OL-DM] | Online manual "6 – Mill – Device Manager": https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---device-manager.html |
| [WIPS] | Haas WIPS Operator's Manual Supplement, "WIPS – Operation". https://www.haascnc.com/service/online-operator-s-manuals/wips---interactive-operator-s-manual-supplement/wips---operation.html . Seen only through a search-result summary (the page itself was not loaded), so treat details from it as secondary. |

The online chapters match the 2020 PDF text for everything cited here, except where marked **(newer)**.

---

## 1. Modes

Source: [OM20] T2.7–T2.12 and T2.17 (pp. 42–51); [OL-D] §5.1.

The control groups its functions into three modes, Setup, Edit and Operation. The current mode shows top left as `MODE:KEY`.

| Mode key | Status text | Group | What the operator can do |
|---|---|---|---|
| `ZERO RETURN` | `SETUP:ZERO` | Setup | Home all axes (`ALL`), one axis (`axis letter` + `SINGLE`), or rapid home (`HOME G28`). The work offset table, tool offset table and positions are all reachable. |
| `HANDLE JOG` | `SETUP:JOG` | Setup | Jog with the handle or jog keys. `TOOL OFFSET MEASURE` and `PART ZERO SET` are available. Tool release, manual spindle and coolant keys work. |
| `EDIT` | `EDIT:EDIT` (or `OPERATION:MEM` during background edit) | Edit / Operation | Program Editor on any program, plus VPS templates (incl. WIPS probing). Pressing `EDIT` while a program runs gives a **background edit** of a copy; the running program is not affected. |
| `MDI` | `EDIT:MDI` | Edit | Type and run blocks without a saved program. The MDI program persists until `ERASE PROGRAM`. It can be saved as `Onnnnn`. |
| `LIST PROGRAM` | (any) | Edit / Operation | Device manager: Memory, User Data, USB, Net Share. Create, select, copy, delete or edit programs. It can be used while a program runs. |
| `MEMORY` | `OPERATION:MEM` | Operation | Run the active program with `CYCLE START`. The row keys `SINGLE BLOCK`, `GRAPHICS`, `OPTION STOP` and `BLOCK DELETE` modify the run. |

Rules an implementation must follow:
- **Homing first.** Axes cannot be jogged until the machine has found home, unless Setting 53 *Jog w/o Zero Return* is ON. Setting 53 reverts to OFF at every power-up ([OM20] Setting 53).
- **Jog Away / Jog Return.** During Run-Stop-Jog-Continue the control remembers the mode the program was running in (MEM or MDI). Return is only possible to that same mode (§7.8).
- **Background edit.** `CYCLE START` is not accepted while a background-edit session is open. Leave with `PROGRAM` or `MEMORY` first.

---

## 2. Screen layout

Source: [OM20] F2.18 (p. 50); [OL-D] §5.1.

The screen is divided into panes. The figure below shows the layout in `OPERATION:MEM` while a program runs. Only one pane is active at a time; the active pane has a **white** background, and the display keys mostly decide which pane is active.

```
+------------------+------------------------------------------------------+
| 1 Mode/Network/  | 3 Main display (size varies): Program / Offsets /    |
|   Time bar       |   Current Commands / Settings / Graphics / Editor /  |
+------------------+   VPS / Help                                         |
| 2 Program        |  +------------------+-------------+---------+        |
|   display        |  | 4 Active Codes   | 5 Active    | 6 Cool- |        |
|   (active        |  |                  |   Tool      |   ant   |        |
|   program /      |  +------------------+-------------+---------+        |
|   MDI pane)      |                                                      |
+------------------+------------------------------+-----------------------+
| 13 Spindle       | 10 Position display /        | 7 Timers, Counters /  |
|    status        |    axis load                 |   Tool management     |
+------------------+------------------------------+-----------------------+
| 12 Icon bar (full width)                                                |
+-----------------------+----------------------+--------------------------+
| 11 Input bar          | 9 System status bar  | 8 Alarm status           |
+-----------------------+----------------------+--------------------------+
```

| # | Pane | Content |
|---|---|---|
| 1 | Mode, Network, Time bar (top left) | `MODE:KEY`; network icons (wired, Wi-Fi strength, HaasConnect/MyHaas, net share); clock `hh:mm:ss`. |
| 2 | Program display (left) | Active program, or the MDI program, with the current block highlighted. |
| 3 | Main display | Changes with the display key: Program (Active Codes), Offsets, Current Commands, Settings, Graphics, Editor, VPS, Help. |
| 4 | Active Codes | Read-only list of the current motion G-code (rapid / linear / circular), G90/G91, cutter comp (G40/41/42), active canned cycle and work offset, plus the active `D`, `H`, `T` and the last M-code. If an alarm is active, the alarm is shown here instead. |
| 5 | Active Tool | Tool number, offset number, tool type, ATM group, maximum load %, remaining life %, a tool image, and the next pocket with the tool in it. |
| 6 | Coolant | Coolant ON/OFF; P-Cool position (1–34) if fitted; level gauge from 1/1 (full) to 0/1 (empty) with a red low band. |
| 7 | Timers & Counters | This Cycle, Last Cycle, Remaining; **M30 Counter #1** and **#2** (macros `#3901` / `#3902`); Loops Remaining. Counters increment on `M30`, and also on `M99` if Setting 118 is ON. Reset a timer or counter with `ORIGIN` on the Timers page. |
| 8 | Alarm status | Current alarm or message. |
| 9 | System status bar | Read-only messages about the operator's last action. |
| 10 | Position / axis load | Axis positions and per-axis load bars. |
| 11 | Input bar (bottom left) | Text being typed. Cleared by `RESET`; `CANCEL` is backspace. |
| 12 | Icon bar | Status icons (see §2.2). |
| 13 | Spindle status | Column 1: feed, spindle and rapid override %. Column 2: spindle rpm, spindle load in kW, surface speed, actual chip load, programmed feed, active feed (with overrides), and a spindle-load % meter. |

### 2.1 Tabbed-menu navigation

Source: [OM20] p. 73; [OL-D].
- Press a display or mode key: the first tab is active, with the cursor on its first field.
- Press the same key again to go to the next tab.
- When the cursor is on the top row, `UP` moves into the tab strip; `LEFT`/`RIGHT` choose a tab and `DOWN` enters it.
- POSITION tabs cannot be made "active" (they are display-only).
- The jog handle can move the highlight like the cursor keys.

### 2.2 Status icons worth simulating

Source: [OM20] T3.1 (pp. 85–101).

| Group | Icons |
|---|---|
| Setup and door | Setup locked; Setup unlocked; **Cycle Door** (after `POWER UP` the door must be opened and closed once so the control can check the door switch; whether this blocks `CYCLE START` is **unconfirmed**); Door Open; Door Hold |
| Running state | Running; Jog; Jog Lock; Feed Hold; Feed; Rapid; Dwell; Singbk Stop; Single Blk; Opt Stop; Blk Delete; Restart (Setting 36 scan) |
| Run-Stop-Jog-Continue | Jog Away; Jog Return; Jog Return Hold |
| Handle functions | Handle Feed; Handle Spindle; Handle Scroll |
| Machine functions | Mirroring (G101 or Settings 45/46/47/48/80/250); Brake clamped / unclamped (rotary); **Vector Jog** (5-axis jog along the tool vector) |
| Tool changer | Tool Change; Tool Unclamped; TC Door Open; TC Manual Mode; TL CW / TL CCW |
| Maintenance warnings | Low Lube; Low Coolant; Low Air (warning / alarm); High Air; Low Air Flow; Dirty TSC filter |
| E-stop | Pendant E-Stop; Tool Changer E-Stop |
| Tool life | Tool Life warning (below Setting 240) / Tool Life alarm (expired, no spare) |
| Other | Power Saving (servos off after Setting 216 time); Probe; Conveyor Fwd/Rev; TSC; TAB; Air Blast |

---

## 3. Display screens and their fields

### 3.1 PROGRAM

Shows the active program pane. In Operation modes it also shows Active Codes ([OM20] T2.6; [OL-D]).

### 3.2 POSITION

Source: [OM20] T2.22 (p. 69); [OL-D] §5.2.

| Tab | What it shows |
|---|---|
| **WORK (G54)** | Position relative to part zero of the **most recently used** work offset. At power-up this is G54. The tab title shows the active offset. |
| **DIST TO GO** | Distance remaining to the commanded end point. In `SETUP:JOG` it shows the distance jogged since entering jog mode. It is zeroed by leaving to MEM or MDI and coming back. |
| **MACHINE** | Position relative to machine zero (home). |
| **OPERATOR** | Distance jogged. It equals machine position only right after power-on. `ORIGIN` zeroes it. |
| **ALL** | All four on one screen. |

- With a POSITION tab active, `ALTER` opens the axis-display selector. `ENTER` toggles an axis on or off; at most **5** axes are shown; `ALTER` closes the selector.
- Haas machine coordinates are 0 at home and **negative** inside the travel for X, Y and Z (Z home is the top of travel). This is standard Haas convention. The exact sign and home corner per axis on the UMC-500 are in `umc500.md`.

### 3.3 OFFSET

Source: [OM20] §4.16.2 F4.40–F4.44 (pp. 165–171); [OL-PS] §8.3–8.5.

Press `OFFSET`. There are two tabs, **TOOL** and **WORK**; `F4` toggles between them, and `DOWN` activates the table.

Value entry, for both tabs:
- Type a value and press **`F1`** to *set* (replace) the field.
- Type a value and press **`ENTER`** to *add* it to the current value.
- `ALTER` does not work on offsets.
- Setting 142 (*Offset Chng Tolerance*, 0–100 mm) triggers the prompt "…changes the offset by more than Setting 142! Accept (Y/N)" when a change is larger than the setting. Press `Y` or `N`.
- With the Memory Lock key locked, offsets cannot be changed.

**TOOL tab** (up to **200** tool offsets; Setting 90 limits how many are shown). The table has three pages; scroll right with `RIGHT`.

| Page | Column | Meaning |
|---|---|---|
| 1 | Active Tool (header) | Tool in the spindle. |
| 1 | Tool Offset (T) | Offset number (row). |
| 1 | **Length Geometry (H)**, **Length Wear (H)** | Used by `G43 Hnn`. Effective length = geometry + wear. |
| 1 | **Diameter Geometry (D)**, **Diameter Wear (D)** | Used by `G41/G42 Dnn`. Diameter value, not radius (Setting 40 can change this; see the settings file). |
| 1 | Coolant Position | P-Cool spigot position. Only shown with the Programmable Coolant option. |
| 2 | Flutes | For the chip-load display and the VPS feeds/speeds. |
| 2 | Actual Diameter | For the surface-speed display. |
| 2 | Tool Type | `F1` list: None, Drill, Tap, Shell Mill, End Mill, Spot Drill, Ball Nose, Probe. It decides whether the probe measures length on the centreline (drill, tap, spot, ball, probe) or at the edge (shell or end mill). |
| 2 | Tool Material | User / Carbide / Steel (VPS). |
| 2 | Tool Pocket | Pocket the tool is in (read-only). |
| 2 | Tool Category | Large / heavy / extra-large. `ENTER` jumps to the Tool Table. |
| 3 | Approximate Length | Probe: distance from the tool tip to the spindle gauge line. |
| 3 | Approximate Diameter | Probe. |
| 3 | Edge Measure Height | Probe: how far below the tip the diameter is measured. |
| 3 | Tool Tolerance | Probe: breakage and wear check. |
| 3 | Probe Type | 0 = none; 1 = length, rotating; 2 = length, non-rotating; 3 = length + diameter, rotating. |

**WORK tab:**

| Column | Meaning |
|---|---|
| G Code | `G52`, `G54`–`G59`, then the additional offsets `G154 P1`–`P99`. `G110`–`G129` are the same as `G154 P1`–`P20` (see `gcode.md`). |
| X, Y, Z (and rotary axes if enabled, e.g. B, C) | Offset value = machine-coordinate position of part zero for that offset. |
| Work Material | For the VPS feeds and speeds. |

**(newer) Tool-offset default.** Current software behaves differently from the 2020 manual ([OL-PS] §8.3):
- A tool length offset is now applied by default unless `G49`/`H00` is commanded.
- On a tool change the active offset follows the new tool.
- The 2020 manual describes the classic behaviour, where the offset is applied only by `G43 Hnn`. Implement the newer default but keep the classic behaviour as an option; the switch-over is software-version dependent. See `gcode.md`.

### 3.4 CURRENT COMMANDS

Source: [OM20] pp. 53–62 and §4.13.1; [OL-D] §5.4.

| Tab | Content |
|---|---|
| Devices → Mechanisms | Manually operable devices: probe arm, parts catcher, and **Main Spindle** (type rpm, `F2` to set; hold `F3` = CW, hold `F4` = CCW; the spindle stops on release; max rpm is limited). |
| Devices → Workholding | E-Vise, hydraulic and pneumatic vises: setup, enable, clamp/unclamp (`M70`/`M71`), up to 8 devices and 3 foot pedals. |
| Timers | Date, time and time zone (edited under E-STOP); power-on time; cycle-start time; feed time; M30 counters #1 and #2. `ORIGIN` resets the highlighted timer. |
| Macro Vars | Macro variables. Editable. |
| Active Codes | Same as pane 4, full size. |
| Tools → Tool Table | SMTC pocket table (§7.4). |
| Tools → Tool Usage | Per-use log: start time, total time, feed time, offset number, tool number, max load %. |
| Tools → ATM | Advanced Tool Management groups and limits (§7.10). |
| Plane | Custom jog planes (`G268`; type `PJ` then `HANDLE JOG`). Gimbal-spindle machines. |
| Calculator | Standard / Milling / Tapping calculators (`F3` copies a value in; `ENTER`, `INSERT`, `ALTER` and `ORIGIN` as in the pendant spec). |
| Media | Pictures and video shown by `M130(file)` or `$FILE` comments; cleared by `M131`. |

### 3.5 ALARMS

Source: [OM20] pp. 66–67.

| Tab | Content |
|---|---|
| ACTIVE ALARM | Alarms currently stopping the machine. `PAGE UP`/`PAGE DOWN` move between several. |
| MESSAGES | Free text for the next operator. It survives power-off. `DOWN` to edit; `CANCEL` = backspace, `DELETE` = delete line, `ERASE PROGRAM` = delete all. |
| ALARM HISTORY | Recent alarms. Type a number or text and press `F1` to search. |
| ALARM VIEWER | Description of every alarm. `F1` searches. |
| KEY HISTORY | The last 2000 key presses. |

Alarm e-mail and SMS notifications are set up under `SETTING` → NOTIFICATIONS.

### 3.6 DIAGNOSTIC

Tabs: **Features** (purchased options and option tryout), **Compensation**, **Diagnostics** (incl. **I/O**, searchable with `F1`, and **Gauges**, incl. the coolant gauge), **Maintenance** (incl. touchscreen configuration) ([OM20] T2.6, §2.5.5, §6.9.6).

### 3.7 SETTING

- **SETTINGS** tab: numbered settings, searchable by number.
- **User Positions**: second home (Settings 268–270) and similar positions; `ORIGIN` makes an entry inactive.
- **Network**, **Notifications**.
- **GRAPHICS** tab (the one used by `[GRAPHICS]`).

Settings are listed in `settings-alarms.md`.

### 3.8 HELP

`HELP` opens icons for Active Icon Help, Active Window Help, Active Window Commands and the Help Index.
- Type a keyword and press `F1` to search.
- `LEFT`/`RIGHT` page through the help.
- `HOME` returns to the top.
- `HELP` again exits.

---

## 4. Door and Setup-mode rules (with the door OPEN)

Source: [OM20] §1.3, T1.2 (pp. 9–10).

The doors lock during program execution, spindle rotation and axis motion, and unlock when the machine is not in cycle. With the door open:

| Function | RUN mode (Setup key locked) | SETUP mode (key unlocked) |
|---|---|---|
| Air Blast (AAG) on | Not allowed | Not allowed |
| Axis jog, pendant handle | Not allowed | **Allowed** |
| Axis jog, RJH handle | Not allowed | **Allowed** |
| Axis jog, RJH shuttle knob | Not allowed | Not allowed |
| Axis rapid with `HOME G28` or Second Home | Not allowed | Not allowed |
| Axis zero return | Not allowed | Not allowed |
| Chip conveyor `CHIP FWD`/`REV` | Not allowed | Not allowed |
| `COOLANT` (pendant or RJH) | Not allowed | **Allowed** |
| Move P-Cool spigot | Not allowed | **Allowed** |
| Orient spindle | Not allowed | Not allowed |
| Run a program (`CYCLE START` on pendant or RJH) | Not allowed | Not allowed |
| Spindle `FWD`/`REV` (pendant or RJH) | Not allowed | Not allowed |
| Tool change `ATC FWD`/`ATC REV` | Not allowed | Not allowed |
| **Tool release from spindle** | **Allowed** | **Allowed** |
| TSC on / TAB on | Not allowed | Not allowed |

**Door Hold.** With Setup mode unlocked, opening the door during a cycle acts like `FEED HOLD`: the screen shows *Door Hold*. After the door closes the control stays in Feed Hold until `CYCLE START` is pressed. Door Hold and `FEED HOLD` do not stop auxiliary axes ([OM20] p. 49). Behaviour on door opening in RUN mode: the door is locked during a cycle, so it cannot be opened.

---

## 5. Power-up and zero return

Source: [OM20] §4.1 (p. 103); [OL-O] §11.1; Setting 81.

1. Press `POWER ON` and hold until the Haas logo appears. The control self-tests, boots and shows a startup screen; `CANCEL` dismisses it.
2. Turn `EMERGENCY STOP` clockwise to release it.
3. Press `RESET` to clear the start-up alarms (typically *EMERGENCY OFF*, servo-off and low-air style alarms; see `settings-alarms.md`). An alarm that will not clear means the machine needs service.
4. Close the doors.
5. Press `POWER UP`. **Motion starts immediately.**
   - The axes move toward home, then creep until each axis finds its home switch. This sets machine zero.
   - Then the **Setting 81** tool change runs (default T1):
     - Setting 81 = 0: the carousel goes to pocket 1 and no tool change happens.
     - Setting 81 = the tool already in the spindle: no tool change.
     - Otherwise: the carousel goes to pocket 1, then to that tool, and the tool is changed into the spindle.
6. Then press `CANCEL`, `CYCLE START` (runs the current program) or `HANDLE JOG`.
7. If the spindle has been idle more than **4 days**, run the 20-minute warm-up program **O09220** ([OM20] §4.2). Run it daily if the spindle is used at consistent high speeds.

Later re-homing without power cycling:
- `ZERO RETURN` + `ALL`: all axes, no tool change.
- Axis letter + `SINGLE`: one axis.
- `HOME G28`: rapid home of all axes, or one axis with a letter typed first. No confirmation prompt.

---

## 6. Jogging

Source: [OM20] §4.16.1, T2.10, T2.15, §6.12 p. 245; [OL-PS] §8.2.

1. Press `HANDLE JOG`. The status shows `SETUP:JOG`.
2. Select an axis. Press `+X`/`-X`/`+Y`/`-Y`/`+Z`/`-Z`, or `±A/C` for the 4th axis, or `SHIFT` + `±A/C` for the 5th (`±B`). The control remembers the last rotary axis chosen. Alternatively, type the axis letter and press `HANDLE JOG`.
3. Choose the increment key. In metric mode the per-click distance is 10× the printed inch value:

   | Key | Per click, inch mode | Per click, metric mode | Continuous rate (lower number on key) |
   |---|---|---|---|
   | `.0001/.1` | 0.0001 in | 0.001 mm | 0.1 |
   | `.001/1.` | 0.001 in | 0.01 mm | 1 |
   | `.01/10.` | 0.01 in | 0.1 mm | 10 |
   | `.1/100.` | 0.1 in | 1.0 mm | 100 (Setting 163 can disable this rate) |

4. Move the axis in one of three ways:
   - **Handle:** each detent moves one increment. The direction follows the rotation sense (+/−).
   - **Hold a jog key:** continuous motion at the lower-number rate while held.
   - **`JOG LOCK`, then an axis key:** the axis keeps moving until `JOG LOCK` is pressed again or the axis reaches its travel limit.

Other jog notes:
- The **RJH** (option) jogs with its own handle and touch-screen rate buttons (.0001 / .0010 / .0100 / .1000). Its Rapid button doubles the jog speed while held together with a direction key.
- **Vector Jog** (5-axis machines) jogs along the tool vector set by the rotary positions (Vector Jog icon).
- **Safe Run** (UMC-500 is a supported machine; software ≥ 100.19.000.1300) also protects handle jog and rapid moves. It slows motion, raises crash sensitivity and backs off after a hit ([OM20] §4.10). Toggle it with `F3` in MDI.
- The continuous-rate units (likely in/min) are **unconfirmed**.

---

## 7. Setup procedures

### 7.1 Loading tools – side-mount tool changer (SMTC, as on the UMC-500)

Source: [OM20] §4.13.1 (pp. 143–149); [OL-SMTC]; [OL-D] Tool Table.

Rules before loading:
- Always load tools **through the spindle**. Never put a tool directly into a carousel pocket.
- The machine must be zero-returned (`POWER UP` if needed).
- Use the correct pull studs for the spindle (BT40 or CT40 on 40-taper; see `umc500.md`).
- Low air pressure or volume slows or prevents tool release.

**Tool Table** (`CURRENT COMMANDS` → Tools → Tool Table, then `DOWN`):
- Header fields: **Active Tool** (tool in the spindle) and **Active Pocket**. `*` marks the pocket currently at the tool-change position.
- Assign a tool: highlight a pocket, type the tool number, `ENTER`. A tool number cannot be in two pockets; that gives an *Invalid tool* error.
- Clear a tool: `0` + `ENTER`. A pocket set to `0` is "always empty", and the changer never uses it. The spindle can never be set to 0.
- Category flags: `L` large, `H` heavy, `X` extra-large (50-taper only), `SPACE` clears. The control itself adds lower-case `h` and `l`; never type them.
  - **Large** (40-taper): diameter > 3 in (76 mm). Both neighbouring pockets must be empty.
  - **Heavy** (40-taper): ≥ 4 lb (1.8 kg). On high-speed SMTCs the carousel runs at ≤ 25 % speed with a heavy tool. Large tools are assumed heavy.
- `ORIGIN` (cursor in the centre column) opens a menu: *Sequence All Pockets*, *Zero All Pockets*, *Clear Category Flags*.

**Loading an empty changer:**
1. Set up the Tool Table as above. The manual assumes the table still holds the previous job's assignments.
2. In MDI, insert **tool 1** into the spindle:
   1. Hold the holder pull-stud first, with its two drive slots lined up with the spindle drive tabs.
   2. Push it up and hold `TOOL RELEASE` (keyboard or spindle-head button).
   3. Let go of the button to clamp.
3. To load the next tool:
   1. Type `T2` and press `ATC FWD`, or run `T2 M06` with `CYCLE START`. Tool 1 goes to its pocket and the control now treats T2 as being in the spindle.
   2. Insert the physical tool 2 by hand as in step 2.
   3. Repeat for each tool.

   The manual's SMTC procedure stops after tool 1. Step 3 is the standard practice implied by the `ATC FWD`/`Tnn` behaviour described in "Moving Tools", so it is **inferred**.

**Moving a tool to another pocket** (e.g. to free pocket 12 for a large tool):
1. In MDI, find in the Tool Table which tool is in pocket 12.
2. Type `Tnn` (that tool) and press `ATC FWD`: the tool goes into the spindle.
3. Type `P18` and press `ATC FWD`: the spindle tool goes into pocket 18.
4. Mark pocket 12 `L`.
5. Put the large tool's number in SPINDLE, insert it, then type `P12` and press `ATC FWD`.

**Tool pre-call (SMTC programming).**
- The control looks up to **80 blocks** ahead. When it finds a tool change, it pre-positions the next tool.
- These stop look-ahead and so prevent pre-call:
  - a work-offset select (`G54`…);
  - `G103` without P or with P ≠ 0;
  - `M00`, `M01`;
  - a `/` block-delete line;
  - very many fast blocks.
- The idiom `T01 M06 ;` then `T02 ;` pre-calls tool 2 explicitly.

**Recovery:** `RESET` → `RECOVER` → TOOL CHANGER RECOVERY tab → `ENTER` → `A` (auto) / `M` (manual, follow the questions; must be finished once started) / `E` (exit).

### 7.2 Tool length offset – manual touch-off ("paper method")

Source: [OM20] §4.16.2 F4.43 (pp. 168–169); [OL-PS] §8.4; Settings 64 and 142.

On a UMC, first set the **tilt axis to 0°** (B0). The manual requires the tilt axis at 0 when touching off tools or working on the stationary table.

1. Load the tool in the spindle.
2. `HANDLE JOG`, then `.1/100.` (fast). Select X or Y and jog the tool over the part centre.
3. Select `+Z`/`-Z` and jog Z to about 25 mm above the part.
4. Select `.0001/.1` (slow). Put a sheet of paper between tool and part. Lower Z until the paper just still moves.
5. `OFFSET` → TOOL tab. Highlight **Length Geometry (H)** for this tool's offset number.
6. Press `TOOL OFFSET MEASURE`. The control writes:
   - Setting 64 **OFF**: the current **Z machine position**. This is a negative number: the distance from Z home to the touch point.
   - Setting 64 **ON**: the measured value **plus the work-offset Z**.
   - If the change exceeds Setting 142, confirm with `Y`.
7. Press `NEXT TOOL`. **Z retracts at rapid** and the next tool is changed in; the cursor moves to it. Repeat from step 2.

What this means for the interpreter (standard Haas practice):
- With G54 Z = 0 and Length Geometry = machine Z at the part top, `G43 Hnn` makes `Z0` the part top. Using a gauge-block thickness is up to the operator.
- The paper thickness (~0.1 mm) is ignored by the control.

### 7.3 Tool length (and diameter) offset – with a tool setter / WIPS probe

Sources: [OM20] §4.16.2 page 3 columns, §6.9 (pp. 227–231); [WIPS] (secondary).

1. `OFFSET` → TOOL tab. For the tool, set:
   - **Tool Type** (decides centreline versus edge probing);
   - **Approximate Length** (tip to gauge line) and **Approximate Diameter**;
   - **Edge Measure Height** = 0 for length only;
   - **Probe Type**: 1 or 2 = length only, 3 = length + diameter.
2. With the tool in the spindle (MDI), press `TOOL OFFSET MEASURE` and choose an automatic probe option, then press `CYCLE START`. The control runs the tool-setter routine and writes Length Geometry (and Diameter Geometry for type 3).
3. Alternatively use VPS → PROBING → Tool Setting templates, then `CYCLE START` (or `F4` to send the code to MDI).

Probe I/O used by the generated code:
- `M59 P2` selects the table tool probe; `M69 P2` selects the spindle work probe.
- `M59 P3` enables the probe (its LED flashes green; red and a beep when triggered); `M69 P3` disables it.
- System variables `#12002` / `#12003` mirror these outputs.
- The Renishaw macros are called with `G65 P98xx`, e.g. `P9832` work probe on, `P9833` off, `P9810` protected move ([OM20] §6.9.3–6.9.4).

### 7.4 Work offset – mechanical pointer, edge finder or WIPS

Source: [OM20] §4.16.2 F4.44–F4.45 (pp. 170–171); [OL-PS] §8.5–8.7.

**Pointer method (as documented):**
1. Clamp the part and load a pointer (or edge finder) in the spindle.
2. `HANDLE JOG`, `.1/100.`, `+Z`: jog Z to about 25 mm above the part. Switch to `.001/1.` and lower Z to about 5 mm above the part.
3. Jog X and Y to the part-zero feature (the manual uses the upper-left corner).
4. `OFFSET` → WORK tab (`F4` toggles from TOOL), `DOWN` to activate. Move to **G54 X**.
5. Press `PART ZERO SET`. Machine X goes into G54 X and the cursor moves to Y. Press again: machine Y goes into G54 Y.
   - A **third** press would write the current machine Z into G54 Z. The manual warns this causes a crash or Z alarm when the program runs, because the tool-length method above assumes G54 Z = 0.

**Edge finder (standard practice, derived from the documented key behaviour):**
1. Touch the X edge with an edge finder of radius r, then `PART ZERO SET` on G54 X.
2. Type `r` (or `-r`, depending on which side of the edge the finder touched) and press `ENTER`. ENTER **adds** the typed value to the stored value.
3. Repeat for Y.
4. Typing a value and pressing `F1` replaces the field instead.

**WIPS spindle probe:**
- Use VPS → PROBING → Spindle Probe templates (bore, boss, pocket, web, single surface, corner, …). Fill in the fields and press `CYCLE START`; the result is written to the chosen work offset.
- Or, in the WORK tab, press `F3` to set a probing action.
- The probe must be in the spindle (tool type *Probe*) with its length offset set.

**UMC note.** For 5-axis work the part-zero setup interacts with MRZP (machine rotary zero point) and DWO/TCPC. See `umc500.md` and `gcode.md` (G254/G234).

---

## 8. Running a program

### 8.1 Select or create a program

Source: [OM20] §4.3 (pp. 104–112); [OL-DM].

`LIST PROGRAM` opens the device tabs: Memory, User Data, USB, Net Share.
- **Navigation:** `UP`/`DOWN` highlight. `RIGHT` opens a directory (marked `>`); `LEFT` goes up. The current path is shown, e.g. `MEMORY/CUSTOMER 11/NEW PROGRAMS`.
- **Columns:** check box; **O #** (Memory only); **Comment** (from the first program line); **File Name**; Size and Last Modified (hidden; shown with `F3` → *Show File Details*); status column, where:
  - `*` = active program;
  - `E` = open in the editor;
  - `>` = directory;
  - `S` = directory on the Setting 252 search path.
- **New program:** `INSERT`. The O number is required (up to 5 digits; zero-padded, so `1` becomes `O00001`). File name and comment are optional. `ENTER` saves; `UNDO` cancels.
  - Avoid **O09xxx**: that range is reserved for macros and machine programs.
  - Duplicate O numbers prompt for overwrite.
- **Select the active program:** highlight it and press **`SELECT PROGRAM`**. It is marked `*`, runs on `CYCLE START` in MEM, and cannot be deleted while active.
- **Other file operations:**
  - `ENTER` toggles a check mark.
  - `F2` copies the checked files.
  - `DELETE` deletes the checked files (or the highlighted one).
  - `ALTER` opens a program in the editor.
  - `F3` = file menu (container zip/unzip, rename, special symbols…).

### 8.2 Prove-out and run

Sources: [OM20] T2.8, §4.17, §4.18, "Override Usage" p. 49; [OL-O] §11.5–11.6.

1. **Graphics first** (no machine motion):
   1. `MEMORY` → `GRAPHICS` → `CYCLE START`.
   2. On screen: feed moves are drawn black, rapids green, drill-cycle positions as `X`. `1`/`2`/`3` choose the G17/G18/G19 view; `F2` zooms (`PAGE UP`/`DOWN` resize the box, `ENTER` applies, `HOME` resets the view); `F3`/`F4` set the speed.
   3. The tool is drawn with the Diameter Geometry, or as a thin line if Setting 253 is ON.
   4. A Z bar shows the Z work zero plus the current tool length.
   5. Graphics does not simulate every machine function.
2. There is **no DRY RUN or machine-lock key** on the NGC mill. A common prove-out practice (not a Haas-documented feature) is:
   - rapid override `5% RAPID` or `25% RAPID`;
   - `SINGLE BLOCK` ON;
   - a hand ready on `FEED HOLD`;
   - **Safe Run** (`F3` in MDI), where supported.
3. `MEMORY`. Set the toggles:
   - **`SINGLE BLOCK`** ON: one block per `CYCLE START`.
   - **`OPTION STOP`** ON: stop at `M01`.
   - **`BLOCK DELETE`** ON: skip text after `/`.
4. Press **`CYCLE START`**. The beacon turns solid green.
   - With the cursor elsewhere than the program start, the run begins at the cursor block.
   - **Setting 36** (*Program Restart*) ON: the control first scans the program to restore tools, offsets, G/M state and positions.
   - With Setting 36 ON it alarms if the start block is inside active cutter comp. Start before the `G41`/`G42` block or after the `G40` block.
5. **Overrides during the run:**
   - `±10% FEEDRATE` / `100% FEEDRATE` / `HANDLE FEED` (1 % steps).
   - `±10% SPINDLE` / `100% SPINDLE` / `HANDLE SPINDLE`.
   - `5/25/50/100% RAPID`.
   - Override locks: Settings 19/20/21.
   - Override reset: Settings 83 (on M30), 87 (on M06), 88 (on RESET).
   - Rapid cap: Setting 10 (50 %).
   - Feed override applied to rapids: Setting 101.
6. **`M00`** always stops, and so does **`M01`** with OPTION STOP on. The beacon flashes green. Press `CYCLE START` to continue.
7. **`FEED HOLD`:**
   - Axis motion stops; the spindle keeps turning.
   - Tool changes and part timers pause.
   - Tapping cycles and dwells finish what they are doing.
   - `CYCLE START` resumes.
8. **`RESET`** ends the run: alarms and the input line are cleared. Then:
   - Setting 31 ON: program pointer to the start.
   - Setting 56 ON: modal G-codes to their defaults.
   - Setting 88 ON: overrides to 100 %.
   - Spindle and coolant stop. This last behaviour is **unconfirmed** from the NGC text; see `pendant.md` §3.1.
9. **`M30`** ends the program, increments the M30 counters and rewinds. M99 also counts if Setting 118 is ON. Setting 56 and Setting 83 apply as above.
10. **Find an error.** After a program alarm, `SHIFT` + `F4` shows the last G-code line that caused an error (software ≥ 100.19.000.1100).

### 8.3 Run-Stop-Jog-Continue (stop, jog away, resume)

Source: [OM20] §4.17 (pp. 172–173); [OL-O] §11.5.

1. Press `FEED HOLD`. Motion stops and the spindle keeps turning.
2. Type an axis letter (`X`, `Y`, `Z`, `A`, `B` or `C`) and press `HANDLE JOG`. The control **stores the current positions** and shows *Jog Away*.
3. Jog clear. While jogged away you may:
   - start or stop the spindle (`FWD`/`REV`/`STOP`);
   - switch TSC with `AUX CLNT` (spindle stopped first) and TAB with `SHIFT`+`AUX CLNT`;
   - switch coolant with `COOLANT`, and AAG/MQL with `SHIFT`+`COOLANT`;
   - release the tool to change inserts.

   Do **not** change tools or offsets: the return uses the old offsets.
4. Jog back near the stored position, or to any position with a clear rapid path to it.
5. Press `MEMORY` or `MDI`, whichever was running. Only the original mode is accepted. The control shows *Jog Return*.
6. Press `CYCLE START`.
   - The control rapids **X, Y and the rotary axes at 5 %** to the stored point, **then Z**. It does not retrace the jog-away path.
   - `FEED HOLD` during this move gives *Jog Return Hold*; `CYCLE START` continues it.
   - At the end the control is in feed hold.
7. Press `CYCLE START` again to resume the program.

### 8.4 MDI

Source: [OM20] §5.2.2 (p. 180).

1. Press `MDI` (`EDIT:MDI`). Type blocks, ending each with `;` (EOB) and inserted with `INSERT`/`ENTER`, then press `CYCLE START`. `SINGLE BLOCK` works in MDI too.
2. The MDI content stays until `ERASE PROGRAM` clears it.
3. To save it as a program:
   1. `HOME` to the first line.
   2. Type `Onnnnn`.
   3. Press `ALTER`.
   4. In the RENAME pop-up, add a name and title, then `ENTER`.
4. Typical MDI tasks:
   - `T5 M06` (tool change);
   - `S1000 M03` (spindle; also see Devices → Main Spindle);
   - `G00 G90 G53 Z0` (Z home in machine coordinates);
   - `G91 G28 Z0` (incremental-zero G28 idiom);
   - `M19` (spindle orient);
   - probing calls.

   Semantics are in `gcode.md` and `mcode.md`.

### 8.5 Editing a program (EDIT)

Source: [OM20] §5.2.1, §5.2.3–5.2.4 (pp. 177–186).

1. In `LIST PROGRAM`, highlight a program and press `EDIT` (or `ALTER`). The program opens in the **Program Generation** pane (right). The active program / MDI pane stays on the left.
2. **Move:** cursor keys or the jog handle.
3. **Insert:** highlight the block the new code should follow, type, `INSERT`.
4. **Replace:** highlight, type, `ALTER`.
5. **Delete:** highlight, `DELETE`.
6. **Undo:** `UNDO`, up to 40 steps. The history is lost on leaving EDIT:EDIT.
7. **Block selection:**
   1. `F2` at the first or last block, move the cursor, then `F2` again to finish the selection.
   2. Then `ENTER` = paste a copy after the cursor; `ALTER` = move the block there; `DELETE` = delete it. These cannot be undone.
   3. The program-name line cannot be selected; trying gives *GUARDED CODE*.
8. **Save:** the editor does **not** auto-save.
   - `MEMORY` (or File → *Set To Run*) saves the program and loads it as active.
   - File → *Save* / *Save As* also save. The file name turns from red to black when saved.
   - *Discard Changes* reverts.
9. **`F1` pull-down menus:**
   - **File:** New, Set To Run, Save, Save As, Discard Changes.
   - **Edit:** Undo/Redo (40), Cut/Copy/Paste clipboard, Insert File Path (M98), Insert Media File (M130 / $FILE), Special Symbols.
   - **Search:** Find and Replace. It searches code, not comment text.
   - **Modify:** renumbering and similar functions; the details are not covered here.
10. **Quick search** (no menu): type text, then `UP` (toward the start) or `DOWN` (toward the end). Text in parentheses searches comments only.
11. **Background edit:** while a program runs, `EDIT` edits a copy of the active program, or `LIST PROGRAM` → `ALTER` edits another one.
    - At the end you get *Overwrite After End of Program* or *Discard Changes*.
    - Exit with `PROGRAM` or `MEMORY`.

### 8.6 Advanced Tool Management (brief)

Source: [OL-D] Tools → ATM.

- **Groups.** Programs may call a tool *group*; the control picks a tool from it.
- **Limits per group:**
  - ORDER: ordered / newest / oldest;
  - USAGE (tool changes), HOLES, WARN, LOAD %;
  - ACTION when the load is exceeded: ALARM, FEEDHOLD, BEEP, AUTOFEED, NEXT TOOL;
  - FEED minutes, TOTAL TIME minutes.
- **Expired tools** go to the EXP group. The beacon flashes and the group rows turn red.
- **H- and D-codes** default to the tool number. H is editable only with Setting 15 OFF.

---

## 9. Five-axis operator notes (UMC)

Sources: [OM20] §4.16.2 note, §6.12 (pp. 233–247), Settings 108 and 250.

- Touch off tools and set offsets on the stationary table with the tilt axis at **0°**.
- Jogging rotaries:
  - the 4th axis via `±A/C`, the 5th via `SHIFT` + `±A/C`;
  - or type `B`/`C` and press `HANDLE JOG`;
  - the Vector Jog icon shows jogging along the tool axis.
- The rotary brakes show *Brake clamped/unclamped* icons. They are commanded by M-codes (see `mcode.md`).
- **Setting 108** (*Quick Rotary G28*): when ON, a rotary zero return takes the short way, within ±359.99°, to **machine** home (not the work zero). It works only with G91 (`G28 G91 C0.`), not G90 (UMC supplement, see `settings-alarms.md`).
- On the UMC-500 the 4th axis is **B** (tilt, −35° to +120°) with brake `M10`/`M11`, and the 5th axis is **C** (platter, continuous) with brake `M12`/`M13` (see `umc500.md` and `mcode.md`).
- Mirror image of the rotary axes uses Setting 80 (B) and Setting 250 (C).

---

## 10. Unconfirmed / open items (operation)

1. Whether the *Cycle Door* condition after POWER UP blocks `CYCLE START` until the door has been opened and closed once.
2. Exact RESET effect on spindle and coolant on the NGC; the manual only lists alarm, input and override effects.
3. Units of the continuous jog rates.
4. The SMTC loading steps after tool 1. The manual's procedure stops there; the `ATC FWD`/`Tnn` method above is inferred from "Moving Tools".
5. Sign convention of the edge-finder radius correction. It is derived, not stated in the manual.
6. The exact WIPS `TOOL OFFSET MEASURE` dialog on current software. It is known only from a search summary of the WIPS supplement.
7. Software version at which the "offset always applied / follows the tool change" behaviour began. The online manual states the behaviour without a version.
8. Exact contents of the Editor *Modify* menu.
