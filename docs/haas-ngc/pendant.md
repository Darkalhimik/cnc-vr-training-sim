# Haas NGC mill pendant (front panel and keyboard)

This is the spec for the virtual Haas Next Generation Control (NGC) mill pendant. It describes the physical layout and what each control does. Behaviour is described from the operator's side; the program and interpreter rules are in `operation.md`, `gcode.md`, `mcode.md` and `settings-alarms.md`.

## Sources

| ID | Source | Notes |
|---|---|---|
| [OM20] | Haas *Mill Operator's Manual, Next Generation Control*, 96-8210 Rev N, Dec 2020 (PDF) – https://www.haascnc.com/content/dam/haascnc/en/service/manual/operator/english---mill-ngc---operator's-manual---2020.pdf | §2.3 Control Pendant (printed pp. 35–49), §2.3.4 Control Display (pp. 50–73), §1.3 Door Rules (pp. 9–10), §2.1 Detail B (p. 25), Chapter 3 Control Icons (pp. 85–101). The keyboard drawing is figure **F2.17** on printed p. 39 (PDF page 61). |
| [OL-P] | Haas online Mill Operator's Manual, chapter "4 – Mill – Control Pendant" – https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---control-pendant.html | Current text. It matches [OM20] key for key; the only differences are noted inline. |
| [OL-D] | Haas online Mill Operator's Manual, chapter "5 – Mill – Control Display" – https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---control-display.html | Screen panes and tabs. |
| [OL-M] | Haas online manual, Macros chapter (`#6198` note) – https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---macros.html, and Operation chapter (Broken Tool Detection note) – https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---operation.html | These show that NGC pendants come in **15-inch and 19-inch** LCD versions. |

Conventions:
- `[KEY]` is a key label exactly as printed on the keycap.
- "Shifted" means the small yellow character printed on the upper left of the keycap. You get it by pressing `[SHIFT]` first.
- Metric is used where Haas gives both.
- "Unconfirmed" means no Haas source we found states it.

---

## 1. Pendant overview (physical)

Source: [OM20] §2.1 F2.3 "Detail B" (p. 25) and §2.3.1–2.3.2 (pp. 36–38); [OL-P] §4.2.

The pendant is an upright box that swivels on an arm at the front right of the machine. Viewed from the front, the face has two parts:

1. **A narrow vertical strip on the LEFT.** It runs the full height of the face. It carries the Haas logo and then, from top to bottom: the `POWER ON`/`POWER OFF` pair, `EMERGENCY STOP`, the jog handle, and the `CYCLE START`/`FEED HOLD` pair.
2. **A wide area on the RIGHT.**
   - **Upper part:** the LCD screen.
   - **Lower part:** the membrane keyboard, directly under the screen and the same width as the screen.

```
        beacon (top right corner of pendant top)      clipboard on top
   +-----+-------------------------------------------+
   |HAAS |                                           |
   |logo |                                           |
   |     |               LCD SCREEN                  |   right side panel (vertical column):
   |(I)(O)  <- POWER ON / POWER OFF                  |     USB port (dust cap)
   |     |               15" or 19"                  |     MEMORY LOCK keyswitch
   | (@) <- EMERGENCY STOP                           |     SETUP MODE keyswitch
   |     +-------------------------------------------+     SECOND HOME button
   |     |                                           |     AUTO DOOR OVERRIDE button
   | (O) <- JOG HANDLE (handwheel)                   |     WORKLIGHT / HIL button(s)
   |     |              KEYBOARD (F2.17)             |     HOLD TO RUN (where equipped)
   |[|][O] <- CYCLE START / FEED HOLD                |
   +-----+-------------------------------------------+
   | storage drawer (pull-down access door), tool tray / vise-handle holder below
   +-------------------------------------------------+
   left side of pendant: Remote Jog Handle (RJH) holster; G/M-code reference list
```

Proportions are approximate and come from the line drawing [OM20] F2.3. Treat them as layout guidance, not as dimensions.
- **Left control strip:** about 22–25 % of the face width.
- **Screen and keyboard column:** about 75–78 % of the face width.
- **Screen:** about the top 55 % of the face height, above the keyboard.
- **Keyboard:** about the next 40 %.
- **Keyboard plate aspect ratio** (width : height) is about **1.48 : 1**, measured from the keyboard figure F2.17.
- **Screen size:**
  - Haas documents mention both "15 inch NGC" and "19 inch NGC" pendants [OL-M].
  - Some newer features, such as tool inspection, need the 19-inch pendant.
  - A touchscreen is fitted on some pendants. Touch is disabled for `[RESET]`, `[EMERGENCY STOP]`, `[CYCLE START]` and `[FEED HOLD]` ([OM20] §2.5, T2.25).
  - Which screen size a given UMC-500 ships with is **unconfirmed**; see `umc500.md`.
  - Absolute pendant, keyboard and keycap dimensions: **unconfirmed**. No Haas source found gives them.
- **Physical spindle load meter:** the NGC pendant has **none**. Spindle load is shown on screen in the Spindle Status pane as % of motor capacity and in kW ([OM20] §2.4).

### 1.1 Front panel controls (left strip)

Source: [OM20] T2.1 (p. 36); [OL-P] §4.2. Top-to-bottom order is from [OM20] F2.3.

| # (top→bottom) | Control | Appearance | What it does |
|---|---|---|---|
| 1 | `[POWER ON]` | Round push button with the "I" symbol, left of the pair. Shown green on machines (colour unconfirmed from the manual). | Powers the control on. Hold it until the Haas logo appears, then the control boots. |
| 1 | `[POWER OFF]` | Round push button with the "O" symbol, right of the pair. | Powers the machine off. |
| 2 | `[EMERGENCY STOP]` | Large red mushroom head. Turn it to the right to release. | Stops all axis motion, disables servos, stops the spindle and the tool changer, and turns off the coolant pump. While it is pressed the "Pendant E-Stop" icon shows. Releasing it does not restart anything: press `[RESET]` to clear the resulting alarms. |
| 3 | Jog handle ("[HANDLE JOG]" control) | Handwheel with a −/+ direction marking. | Jogs the selected axis in HANDLE JOG mode by one jog increment per detent. It also scrolls text and menus (editor, Help, HANDLE SCROLL), adjusts feed or spindle override in 1 % steps after `[HANDLE FEED]` / `[HANDLE SPINDLE]`, and single-steps a program when Setting 104 is ON. Detents per revolution: **unconfirmed** (100 per revolution is typical for Haas MPGs, but no source found states it). |
| 4 | `[CYCLE START]` | Square-framed button with the "I" symbol, left of the pair. | Starts or continues the active program (MEM) or the MDI block(s). Resumes after FEED HOLD, single-block stop, M00/M01. In GRAPHICS it starts the simulation. Disabled while the door is open (see door rules in `operation.md`). With Setting 103 ON you must hold it; releasing it gives a feed hold. |
| 4 | `[FEED HOLD]` | Square-framed button with the "O" symbol, right of the pair. | Stops rapid and feed motion while the spindle keeps running. It also pauses tool changes and part timers, but **not** tapping cycles or dwell timers ([OM20] p. 49). Resume with `[CYCLE START]`. |

The left/right order within each pair (POWER ON left of POWER OFF, CYCLE START left of FEED HOLD) follows the drawing and the "I"/"O" convention. Confirm it against a photo before final art; this is **unconfirmed** from text.

### 1.2 Right side panel

Source: [OM20] T2.2 (p. 37); [OL-P] §4.2. The manual lists the controls in this order. The drawing F2.3 shows them as one vertical column on the side face, nearest the operator: five round items, one square item, then one round item at the bottom ("Hold To Run, where equipped").

| Control | Type | What it does |
|---|---|---|
| USB | USB port with removable dust cap | Connects a USB memory device. A USB tab then appears in `[LIST PROGRAM]`. |
| Memory Lock | Keyswitch | When locked, programs, settings, parameters and offsets cannot be changed. |
| Setup Mode | Keyswitch. Locked = vertical position = Run mode. | Locked enables all safety features (Run mode). Unlocked = Setup mode, which allows some functions with the door open (see `operation.md` §6). The screen shows a Setup icon (locked or unlocked). |
| Second Home | Push button with a "⊕2" symbol | Rapids all axes to the user position in Settings 268–270 (X/Y/Z second home). Same caution as HOME G28: motion starts with no prompt. Not allowed with the door open. |
| Auto Door Override | Push button with a door symbol | Opens or closes the optional Auto Door. |
| Worklight | Push button(s) with a light-bulb symbol | Toggles the internal work light, and the High Intensity Lights (HIL) if fitted. |
| Hold To Run | Push button, where equipped (CE/robot cells) | Enable button. Exact function on a UMC-500: **unconfirmed**. |

### 1.3 Top of pendant and around it

- **Beacon light** on the pendant top ([OM20] T2.3, p. 37–38):

  | Beacon | Meaning |
  |---|---|
  | Off | Machine idle |
  | Solid green | Program running |
  | Flashing green | Stopped but ready; operator input needed (M00, M01, single-block stop, FEED HOLD) |
  | Flashing red | Fault or Emergency Stop |
  | Flashing yellow | A tool has expired (Tool Wear icon shown) |

  The flashing-yellow state is listed in [OM20] but missing from the current online table [OL-P].
- **Remote Jog Handle (RJH)** holster on the left side of the pendant ([OM20] F2.3 item 9). The RJH is optional. Lifting it out of the holster activates it ([OM20] §4.15).
- **Clipboard** on top, and a **G- and M-code reference list** on the left side.
- **Tool Release button on the spindle head** ([OM20] F2.4 item 2). It does the same as `[TOOL RELEASE]` and is used when loading tools by hand.

---

## 2. Keyboard: overall layout

Source: [OM20] F2.17 (p. 39) and T2.4–T2.16 (pp. 39–48); [OL-P] §4.3–4.7. The keyboard is split into 8 functional groups. Each group sits on its own coloured sub-panel:
- Function: grey
- Jog: blue
- Overrides: black
- Display: black header strip
- Cursor: blue
- Mode: grey
- Alpha: grey
- Numeric: black

Block diagram (not to scale; exact grids in §2.2, proportions in §2.1):

```
+-------------------+-----------------+---------------------------+
| [1] FUNCTION      | [3] DISPLAY     |                           |
|     3 rows x 4    |     2 x 4       |   [4] MODE                |
+-------------------+-----------------+       6 rows x 5          |
| [7] JOG           | [2] CURSOR      |   (col 1 = arrow-shaped   |
|     3 x 5         |     3 x 3       |    mode key)              |
+-------------------+-----------------+--------------+------------+
| [8] OVERRIDES     | [6] ALPHA                      | [5] NUMERIC|
|     4 x 4         |     5 x 6                      |     5 x 3  |
+-------------------+--------------------------------+------------+
```

### 2.1 Group placement (normalised coordinates)

These values were measured on the 2020 manual drawing F2.17. The origin is the top-left of the keyboard plate; x runs right and y runs down; 1.0 = full plate width or height. The plate aspect ratio is about 1.48 : 1. Use them for a proportionally faithful virtual keyboard. They are approximate (±0.01).

| Group | x from | x to | y from | y to | Grid (rows × cols) | Keys |
|---|---|---|---|---|---|---|
| Function | 0.044 | 0.315 | 0.061 | 0.309 | 3 × 4 (RESET spans 2 cols) | 11 |
| Jog | 0.044 | 0.315 | 0.321 | 0.569 | 3 × 5 | 15 |
| Overrides (title "OVERRIDES") | 0.044 | 0.315 | 0.587 | 0.939 | 4 × 4 (row 3 has 3 keys + "SPINDLE" label) | 15 |
| Display (title "DISPLAY") | 0.324 | 0.593 | 0.061 | 0.253 | 2 × 4 | 8 |
| Cursor | 0.334 | 0.593 | 0.273 | 0.520 | 3 × 3 (centre = "CURSOR" label) | 8 |
| Mode | 0.601 | 0.949 | 0.061 | 0.523 | 6 × 5 | 30 |
| Alpha | 0.329 | 0.730 | 0.542 | 0.939 | 5 × 6 | 30 |
| Numeric | 0.743 | 0.949 | 0.542 | 0.939 | 5 × 3 | 15 |
| **Total** | | | | | | **132** |

### 2.2 Exact key grids (top-to-bottom, left-to-right)

Notation: `MAIN (shifted)`. Arrow keys are shown by their names.

**[1] Function keys**

| | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| row 1 | `RESET` (red, spans cols 1–2) | ← | `POWER UP` | `RECOVER` |
| row 2 | `F1` | `F2` | `F3` | `F4` |
| row 3 | `TOOL OFFSET MEASURE` | `NEXT TOOL` | `TOOL RELEASE` | `PART ZERO SET` |

**[7] Jog keys**

The arrows printed on the X/Y keys point in the direction of *table* travel on a VF-style mill. That is why `+X` carries a left arrow and `-X` a right arrow, and why `+Y` points down-left (toward the operator) and `-Y` points up-right. `+Z` and `-Z` show spindle travel (up and down). This reading of the icons is our interpretation of F2.17.

| | col 1 | col 2 | col 3 | col 4 | col 5 |
|---|---|---|---|---|---|
| row 1 | `CHIP FWD` | `+A/C` (shifted `+B`) | `+Z` (up arrow) | `-Y` (diagonal arrow, up-right) | `CLNT UP` |
| row 2 | `CHIP STOP` | `+X` (left arrow) | `JOG LOCK` | `-X` (right arrow) | `CLNT DOWN` |
| row 3 | `CHIP REV` | `+Y` (diagonal arrow, down-left) | `-Z` (down arrow) | `-A/C` (shifted `-B`) | `AUX CLNT` |

**[8] Override keys**

| | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| row 1 | `-10% FEEDRATE` | `100% FEEDRATE` | `+10% FEEDRATE` | `HANDLE FEED` |
| row 2 | `-10% SPINDLE` | `100% SPINDLE` | `+10% SPINDLE` | `HANDLE SPINDLE` |
| row 3 | `FWD` | `STOP` | `REV` | (printed label `SPINDLE`; no key) |
| row 4 | `5% RAPID` | `25% RAPID` | `50% RAPID` | `100% RAPID` |

**[3] Display keys** (header strip reads `DISPLAY`)

| | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| row 1 | `PROGRAM` | `POSITION` | `OFFSET` | `CURRENT COMMANDS` |
| row 2 | `ALARMS` | `DIAGNOSTIC` | `SETTING` | `HELP` |

**[2] Cursor keys**

| | col 1 | col 2 | col 3 |
|---|---|---|---|
| row 1 | `HOME` | UP (arrow) | `PAGE UP` |
| row 2 | LEFT (arrow) | (label `CURSOR`, not a key) | RIGHT (arrow) |
| row 3 | `END` | DOWN (arrow) | `PAGE DOWN` |

**[4] Mode keys.** Column 1 holds the arrow-shaped mode key. It points right at its row of four function keys.

| | col 1 (mode) | col 2 | col 3 | col 4 | col 5 |
|---|---|---|---|---|---|
| row 1 | `EDIT` | `INSERT` | `ALTER` | `DELETE` | `UNDO` |
| row 2 | `MEMORY` | `SINGLE BLOCK` | `GRAPHICS` | `OPTION STOP` | `BLOCK DELETE` |
| row 3 | `MDI` | `COOLANT` | `HANDLE SCROLL` | `ATC FWD` | `ATC REV` |
| row 4 | `HANDLE JOG` | `.0001` / `.1` | `.001` / `1.` | `.01` / `10.` | `.1` / `100.` |
| row 5 | `ZERO RETURN` | `ALL` | `ORIGIN` | `SINGLE` | `HOME G28` |
| row 6 | `LIST PROGRAM` | `SELECT PROGRAM` | BACK (left arrow) | FORWARD (right arrow) | `ERASE PROGRAM` |

Notes:
- **MDI row.** The keys under MDI are `COOLANT`, `HANDLE SCROLL`, `ATC FWD`, `ATC REV`. There is **no** "NEXT TOOL" in this row; `NEXT TOOL` is in the Function group.
- **Jog-increment keys.** Each prints two numbers: the per-click increment on top and the continuous-jog speed below.

**[6] Alpha keys**

| | c1 | c2 | c3 | c4 | c5 | c6 |
|---|---|---|---|---|---|---|
| row 1 | `SHIFT` | `A` | `B` | `C` | `D` | `E` |
| row 2 | `F` | `G` | `H` | `I` | `J` | `K` |
| row 3 | `L` | `M` | `N` | `O` | `P` | `Q` |
| row 4 | `R` | `S` | `T` | `U` | `V` | `W` |
| row 5 | `X` | `Y` | `Z` | `;` (shifted `/`) | `(` (shifted `[`) | `)` (shifted `]`) |

**[5] Numeric keys**

| | c1 | c2 | c3 |
|---|---|---|---|
| row 1 | `7` (shifted `&`) | `8` (shifted `@`) | `9` (shifted `:`) |
| row 2 | `4` (shifted `%`) | `5` (shifted `$`) | `6` (shifted `!`) |
| row 3 | `1` (shifted `*`) | `2` (shifted `` ` ``; the online manual prints `‘`) | `3` (shifted `?`) |
| row 4 | `-` (shifted `+`) | `0` (shifted `=`) | `.` (shifted `#`) |
| row 5 | `CANCEL` | `SPACE` | `ENTER` |

- **Enter key.** It is labelled `ENTER`. Older Haas controls used `WRITE/ENTER`; on the NGC it is just `ENTER`.
- **EOB key.** It is the `;` key.
- **Symbols not on the keypad:** `_ ^ ~ { } \ | < >`. Enter them through `[LIST PROGRAM]` → `[F3]` → *Special Symbols* ([OM20] T2.23).

---

## 3. What each key does

Sources: [OM20] T2.4–T2.16 (pp. 39–48), "Override Usage" (p. 49), §2.3.4 and Chapter 4; [OL-P]. "Any" means the key works in every mode. The modes are EDIT, MEM (MEMORY), MDI, JOG (HANDLE JOG), ZERO (ZERO RETURN) and LIST (LIST PROGRAM).

### 3.1 Function group

| Key | Behaviour |
|---|---|
| `RESET` | Any mode. Clears alarms and the input line ([OM20] T2.4). Also: Setting 88 ON → overrides go back to 100 %; Setting 31 ON → program pointer goes to the program start; Setting 56 ON → modal G-codes return to defaults. It also turns off the probe after a probe test ([OM20] §6.9). It ends a running program: all motion, spindle and coolant stop, and the program does not resume with CYCLE START from the interrupted point. This is standard Haas behaviour, but the NGC manual table does not spell it out, so the exact spindle/coolant handling is **unconfirmed**. |
| `POWER UP` | After power-on (and any time the machine is not in an alarm), homes all axes and initialises the control. The first POWER UP after power-on moves toward home, then searches the home switches slowly. Then a tool change to the tool in **Setting 81** (default 1) happens: if Setting 81 = 0, the carousel only goes to pocket 1. Motion starts immediately, with no prompt. |
| `RECOVER` | Enters tool-changer recovery (the TOOL CHANGER RECOVERY tab). For the SMTC: `[ENTER]`, then `A` = automatic recovery, `M` = manual, `E` = exit ([OM20] §4.13.4). |
| `F1`–`F4` | Soft keys. Their meaning depends on the active tab or pane. A help area on screen shows the current meanings. See §3.8. |
| `TOOL OFFSET MEASURE` | In JOG mode, with the TOOL offsets tab active: writes the current Z position into the highlighted tool's **Length Geometry (H)**. Setting 64 OFF → value = Z machine position. Setting 64 ON → value = measured value + work offset Z. If the change exceeds Setting 142 you get a Y/N confirmation. With the WIPS probe option it instead offers automatic probe options; then press `CYCLE START`. |
| `NEXT TOOL` | During tool touch-off: retracts Z (rapid) and changes to the next tool in sequence. The offset cursor follows that tool. This causes rapid Z motion. |
| `TOOL RELEASE` | Unclamps the tool in the spindle in MDI, ZERO RETURN or HANDLE JOG mode. The tool is released while the key is held and clamps again on release. This is used for hand loading. Allowed with the door open in both Run and Setup mode. Setting 76 can lock it out (see settings file). |
| `PART ZERO SET` | With the WORK offsets tab active and the cursor on a work-offset axis field: writes the current machine position of that axis into the field, then moves the cursor to the next axis. The 1st press sets X, the 2nd Y, the **3rd Z** (the manual warns against a third press when using a pointer). |

### 3.2 Cursor group

| Key | Behaviour |
|---|---|
| `HOME` | Cursor to the top item. In the editor: the first block. In graphics zoom (`F2` then `HOME`): resets the view to the full work area. In Help: top of the page. |
| UP / DOWN / LEFT / RIGHT | Move one item, block or field. Tabs: UP from the top row selects the tab strip; DOWN enters the tab. `[LIST PROGRAM]`: RIGHT opens a directory, LEFT goes up a level. Basic program search: type text, then UP or DOWN searches toward the start or end of the program. |
| `PAGE UP` / `PAGE DOWN` | Page through a program or table, or change displays. In graphics zoom they enlarge (PAGE UP) or shrink (PAGE DOWN) the zoom window. |
| `END` | Cursor to the bottom item. In the editor: the last block. |

### 3.3 Display group

Each key opens a tabbed screen. Press the same key again to move to the next tab. Full contents are in `operation.md` §2.

| Key | Opens |
|---|---|
| `PROGRAM` | The active program pane, with active codes in Operation modes. |
| `POSITION` | Position display tabs: WORK (G54…), DIST TO GO, MACHINE, OPERATOR, ALL. With a position tab active, `ALTER` opens the axis-display selector (up to 5 axes shown). |
| `OFFSET` | TOOL and WORK offset tables. `F4` toggles between them. |
| `CURRENT COMMANDS` | Tabs: Devices (Mechanisms, Workholding), Timers, Macro Vars, Active Codes, Tools (Tool Table / pocket table, Tool Usage, ATM), Plane, Calculator, Media. |
| `ALARMS` | Tabs: ACTIVE ALARM, MESSAGES, ALARM HISTORY, ALARM VIEWER, KEY HISTORY (last 2000 keys). |
| `DIAGNOSTIC` | Tabs: Features, Compensation, Diagnostics (incl. I/O, Gauges), Maintenance. |
| `SETTING` | SETTINGS (numbered user settings), User Positions, Network, Notifications, plus the GRAPHICS tab used by `[GRAPHICS]`. |
| `HELP` | On-screen manual: Active Icon Help, Active Window Help, Active Window Commands, Help Index. `F1` searches. Press `HELP` again to exit. |

### 3.4 Mode group

The current mode always shows top left of the screen as `MODE:KEY`. `[EDIT]` and `[LIST PROGRAM]` can also be pressed while a program runs; they then act as display keys (background edit / device manager) without stopping the program.

| Key | Status shown | Behaviour |
|---|---|---|
| `EDIT` | `EDIT:EDIT` (or `OPERATION:MEM` for background edit) | Opens the Program Editor on the program selected in LIST PROGRAM (Program Generation pane). VPS is reachable from the EDIT tabs. `F1` opens the pull-down menu (File / Edit / Search / Modify). |
| `INSERT` | EDIT, MDI, LIST | Inserts the input line (or the clipboard) after the highlighted code. In LIST PROGRAM: create a new program. In a calculator: append the result to the input line. |
| `ALTER` | EDIT, MDI, LIST, POSITION | Replaces the highlighted code with the input line. It does **not** work for offsets. In LIST PROGRAM: open the highlighted program in the editor. With a block selection: move the block. With a position tab: axis-display selector. In MDI with the cursor on the first line: rename/save as Onnnnn. |
| `DELETE` | EDIT, MDI, LIST, ALARMS/MESSAGES | Deletes the highlighted item or the selected block. In LIST PROGRAM: deletes checked files. In MESSAGES: deletes a line. |
| `UNDO` | EDIT, MDI | Undoes up to the last 40 edits and clears a block highlight. It cannot undo a deleted block selection or a deleted program, and the history is lost when you leave EDIT:EDIT. In pop-ups: cancel. |
| `MEMORY` | `OPERATION:MEM` | Run mode for the active program. From EDIT it also saves the program and sets it to run ("Set To Run"). It is also used to return from Jog Away in Run-Stop-Jog-Continue. |
| `SINGLE BLOCK` | MEM (and MDI) | Toggles single block. Each `CYCLE START` runs one block. Icon: "Single Blk". |
| `GRAPHICS` | MEM | Opens Graphics (simulation). `CYCLE START` then runs the program on screen only, with no axis motion. |
| `OPTION STOP` | MEM | Toggles optional stop. When ON, `M01` stops the program. Setting 17 can lock it. |
| `BLOCK DELETE` | MEM | Toggles block delete. When ON, code after `/` on that line is skipped. Setting 18 can lock it. |
| `MDI` | `EDIT:MDI` | Manual Data Input: type blocks and run them with `CYCLE START`. The MDI contents persist until erased. |
| `COOLANT` | Any (Setup-mode rules apply) | Toggles flood coolant (M08/M09 state) until the next M-code or key press. Setting 32 can lock it. `SHIFT`+`COOLANT` toggles the optional Auto Air Gun / MQL. |
| `HANDLE SCROLL` | JOG | Toggles handle-scroll: the jog handle moves the cursor in menus instead of jogging. |
| `ATC FWD` | MDI (documented); other modes **unconfirmed**. Needs a zero-returned machine and a closed door. | Indexes the tool changer to the next tool and performs a tool change. With `Tnn` typed on the input line: change to tool nn. With `Pnn`: put the spindle tool into pocket nn (SMTC) ([OM20] §4.13.1, "Moving Tools"). |
| `ATC REV` | MDI | Same as `ATC FWD` but to the previous tool. |
| `HANDLE JOG` | `SETUP:JOG` | Jog mode. Select an axis with a jog key, or type the axis letter and press `HANDLE JOG`. Then turn the handle, or hold the jog key for continuous jog. During FEED HOLD, typing an axis letter and pressing `HANDLE JOG` starts Run-Stop-Jog-Continue. |
| `.0001/.1` | JOG | Handle increment 0.0001 in = **0.001 mm** per click. The lower number (0.1) is the continuous jog-key speed. |
| `.001/1.` | JOG | 0.001 in = **0.01 mm** per click; continuous speed 1. |
| `.01/10.` | JOG | 0.01 in = **0.1 mm** per click; continuous speed 10. |
| `.1/100.` | JOG | 0.1 in = **1.0 mm** per click; continuous speed 100. Setting 163 can disable this highest rate (the next lower rate is used instead). |
| `ZERO RETURN` | `SETUP:ZERO` | Zero-return mode. The position display shows Operator / Work G54 / Machine / Dist To Go. |
| `ALL` | ZERO | Returns all axes to machine zero, like POWER UP but **without** a tool change. |
| `ORIGIN` | Context | Sets the selected value(s) to zero: the Operator position, timers and M30 counters in Timers, a calculator, the tool pocket table ORIGIN menu, or a User Position setting (inactive). |
| `SINGLE` | ZERO | Type an axis letter (e.g. `Z`), then `SINGLE`: that axis returns to machine zero. |
| `HOME G28` | ZERO | Rapids all axes to zero (machine home) with **no prompt**. After typing an axis letter, homes that one axis. Not allowed with the door open. |
| `LIST PROGRAM` | Device manager | Device tabs: Memory, User Data, USB, Net Share. |
| `SELECT PROGRAM` | LIST | Makes the highlighted program active (marked `*`). |
| BACK arrow | LIST (any screen) | Browser-style back to the previous screen. |
| FORWARD arrow | LIST (any screen) | Browser-style forward. |
| `ERASE PROGRAM` | LIST, MDI, MESSAGES | LIST: deletes the selected program. MDI: clears the whole MDI program. MESSAGES: clears the whole message. |

Continuous jog-speed units for the lower numbers (0.1 / 1 / 10 / 100) are **unconfirmed**. They are most likely in/min in inch mode; the metric equivalent is not stated.

### 3.5 Alpha and numeric groups

| Key | Behaviour |
|---|---|
| `A`–`Z` | Type upper-case letters. `SHIFT` + letter gives lower case. In ZERO RETURN or HANDLE JOG, an axis letter followed by `SINGLE` / `HOME G28` / `HANDLE JOG` selects that axis. In the Standard calculator the letters are operators: `D` add, `J` subtract, `P` multiply, `V` divide, `E` ± sign, `K` square root, `Q` percent, `S` memory store, `R` memory recall, `C` memory clear. In the SMTC tool table: `L` large, `H` heavy, `X` extra-large (50-taper only). |
| `SHIFT` | One-shot shift for the next key: yellow characters, lower case, or `SHIFT`+`+A/C`/`-A/C` to select the B / 5th axis. Combinations: `SHIFT`+`COOLANT` = Auto Air Gun/MQL; `SHIFT`+`AUX CLNT` = Through-Tool Air Blast; `SHIFT`+`F4` = locate the last program error. |
| `;` | End Of Block (EOB). `SHIFT`+`;` = `/` (block delete). |
| `(` `)` | Comment delimiters; they must be used as a pair. `SHIFT` gives `[` `]` (macro brackets). |
| `0`–`9`, `-`, `.` | Digits, minus sign and decimal point. Shifted: `+ = # * ` ? % $ ! & @ :`. |
| `CANCEL` | Backspace (deletes the last typed character). It also dismisses the startup screen and cancels pop-ups. |
| `SPACE` | Inserts a space. In the tool pocket table it clears the category flag. |
| `ENTER` | Answers prompts and writes input. In offset tables, a typed value + `ENTER` **adds** to the current value (`F1` replaces it). In LIST PROGRAM it toggles the file check mark. With a block selection it pastes a copy. |

### 3.6 Jog group

| Key | Behaviour |
|---|---|
| `+X -X +Y -Y +Z -Z` | In HANDLE JOG: tap to select the axis for the handle, or press and hold to jog continuously at the selected continuous speed. After `JOG LOCK`, a tap starts continuous motion until `JOG LOCK` is pressed again or the axis reaches its limit. |
| `+A/C` `-A/C` | Select or jog the **4th** rotary axis. |
| `SHIFT`+`+A/C` / `SHIFT`+`-A/C` (`+B` / `-B`) | Select or jog the **5th** rotary axis. The control remembers the last rotary axis selected: after a SHIFT selection, plain `±A/C` keeps selecting that axis until SHIFT is used again ([OM20] §6.12, p. 245). On a UMC the 4th axis is B (tilt) and the 5th is C (platter) (see `umc500.md`). If the 4th/5th rule above applies literally, the unshifted `±A/C` key would select **B** and `SHIFT`+`±A/C` (legend `±B`) would select **C**, which is the opposite of what the legends suggest. This mapping is **unconfirmed**. Typing `B` or `C` + `HANDLE JOG` is an unambiguous alternative. |
| `JOG LOCK` | Latches continuous jog (see above). Icon: "Jog Lock". |
| `CHIP FWD` / `CHIP STOP` / `CHIP REV` | Chip auger/conveyor forward (out of the machine), stop, reverse. Not allowed with the door open (Run or Setup). Settings 114/115 cover the conveyor cycle. |
| `CLNT UP` / `CLNT DOWN` | Move the optional Programmable Coolant (P-Cool) nozzle up or down (positions 1–34). |
| `AUX CLNT` | In MDI: toggles Through-Spindle Coolant (TSC, option; the spindle must be stopped in RSJC). `SHIFT`+`AUX CLNT` toggles Through-Tool Air Blast (TAB). Both also work in Run-Stop-Jog-Continue. |

### 3.7 Override group

Source: [OM20] T2.16 and "Override Usage" (p. 49).

| Key | Behaviour |
|---|---|
| `-10% FEEDRATE` / `+10% FEEDRATE` | Feed override in 10 % steps. It affects feed moves only; rapids are affected only when Setting 101 is ON. |
| `100% FEEDRATE` | Feed override back to 100 %. |
| `HANDLE FEED` | The jog handle changes feed override in 1 % steps. |
| `-10% SPINDLE` / `+10% SPINDLE` | Spindle-speed override in 10 % steps. |
| `100% SPINDLE` | Spindle override back to 100 %. |
| `HANDLE SPINDLE` | The jog handle changes spindle override in 1 % steps. |
| `FWD` / `STOP` / `REV` | Manual spindle CW / stop / CCW, at the last commanded S. Not allowed with the door open. |
| `5% RAPID` / `25% RAPID` / `50% RAPID` / `100% RAPID` | Rapid override (limit) to that percentage. Setting 10 caps rapids at 50 %. |

General override rules:
- Settings **19 / 20 / 21** lock out the feed / spindle / rapid overrides.
- Settings **83 / 87 / 88** reset overrides to 100 % on M30 / programmed M06 / RESET. Setting 87 does not apply to ATC FWD/REV.
- `FEED HOLD` behaves like a 0 % override for motion, but tapping and dwell continue.
- Override limits (min/max %) are **unconfirmed**; no source found states them.

### 3.8 Soft keys (F1–F4) by context

These are the contexts documented in [OM20]. The on-screen key-help area always shows the current set.

| Context | F1 | F2 | F3 | F4 |
|---|---|---|---|---|
| OFFSET → WORK | Set typed value (replace) | – | Probing action (WIPS) | Toggle to TOOL tab |
| OFFSET → TOOL | Set typed value; in Tool Type / Tool Material columns, open the option list | – | – | Toggle to WORK tab |
| Editor (EDIT) | Pull-down menu | Start/end block selection | – | – |
| LIST PROGRAM | – | Copy checked files | File menu (Create Container, Show File Details, Special Symbols, Rename, …) | (in container dialog) start packing / extract |
| ALARMS (HISTORY/VIEWER), HELP, DIAGNOSTIC I/O | Search for typed text or number | – | – | – |
| GRAPHICS | – | Zoom window | Graphics speed | Graphics speed |
| MDI (Safe Run machines) | – | – | Activate/deactivate Safe Run | – |
| CURRENT COMMANDS → Devices → Main Spindle | – | Set RPM | Hold = spindle CW | Hold = spindle CCW |
| Calculators | – | – | Copy value from the standard calculator | – |
| Any (with `SHIFT`) | – | – | – | `SHIFT`+`F4` = show the last program error line |

---

## 4. Implementation notes for the virtual pendant

- **Keycap colours** (from F2.17, approximate):
  - `RESET`: red/orange.
  - Function keys: grey with black text.
  - Jog keys: grey on a blue panel.
  - Override keys: grey on a black panel. FWD, STOP and REV are bold.
  - Display keys: dark grey keys.
  - Cursor keys: on a blue panel.
  - Mode keys: grey. The mode key in column 1 is arrow-shaped.
  - Alpha keys: grey on a grey panel; `SHIFT` text is yellow.
  - Numeric keys: grey on a black panel, with yellow shifted symbols.
- **Mode keys are latching states.** Model them as one active mode. The row keys act according to the active mode, but most row keys (e.g. `COOLANT`, `SINGLE BLOCK`) work from several modes, as described above.
- **Toggle state.** `SHIFT` is a one-shot modifier. `SINGLE BLOCK`, `OPTION STOP`, `BLOCK DELETE`, `JOG LOCK` and `HANDLE SCROLL` are toggles whose state is shown with icons in the icon bar. They need no key LEDs; no LEDs are shown on F2.17.
- **Physical buttons are hard keys, not touch targets.** `CYCLE START`, `FEED HOLD`, `RESET` and `EMERGENCY STOP` must never be touch-screen actions.

## 5. Unconfirmed / open items (pendant)

1. Absolute pendant, screen and keycap dimensions; which screen (15" or 19", touch or non-touch) a current UMC-500 ships with.
2. Jog handle detents per revolution (100 assumed).
3. Units of the continuous jog speeds printed on the increment keys (0.1 / 1 / 10 / 100).
4. Min/max limits of feed and spindle override.
5. Exact left/right order of the POWER ON/OFF and CYCLE START/FEED HOLD pairs, and the exact top-to-bottom order of items on the right side panel. Only the manual table order and a small line drawing are available.
6. Mapping of `±A/C` versus `SHIFT ±A/C` to B and C on a UMC.
7. `F2`/`F3` meanings in the OFFSET → TOOL tab on current software. The 2020 manual only documents F1 and F4.
