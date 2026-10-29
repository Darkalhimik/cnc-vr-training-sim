# Haas NGC Mill Settings and Alarms: behaviour spec (UMC-500 focus)

Part A lists the user settings that change interpreter or operator-visible behaviour.
Part B lists the alarms the simulator should raise: number, exact text, cause and recovery,
and how well each is confirmed.

Companion file: `mcode.md`, which explains how M-codes use these settings and raise these alarms.

## 0. Sources

| Tag | Source |
|---|---|
| **[OM20]** | Haas *Mill Operator's Manual NGC* 96-8210 Rev N (Dec 2020), Chapter 9 Settings, pp. 435-509. https://www.haascnc.com/content/dam/haascnc/en/service/manual/operator/english---mill-ngc---operator's-manual---2020.pdf. `p.` = printed page; PDF page = printed + 22. |
| **[WEB-S]** | Current online chapter "19 - Mill - Settings" (setting **list and names**; newer than OM20). https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---settings.html |
| **[CODE-Sn]** | Per-setting pages, pattern `https://www.haascnc.com/service/codes-settings.type=setting.machine=mill.value=S53.html`. The pattern was verified because these URLs exist in search results. haascnc.com returns HTTP 403 to fetch tools, so the content was seen **only via search-engine extract**. |
| **[UMC20]** | *UMC Series Operator's Manual Supplement NGC* 96-8250 (2020). https://www.haascnc.com/content/dam/haascnc/en/service/manual/supplement/english---umc-operator%27s-manual-supplement---2020.pdf |
| **[CHC02]** | Haas 96-8100 rev E (June 2002), VF-Series service manual, chapter "2. Alarms" (classic Haas control). Official Haas text, hosted by UC Berkeley: https://me.berkeley.edu/wp-content/uploads/2020/09/Haas-VF-Series-Product-Manual-2002.pdf (alarms on PDF pp. 52-73). |
| **[ASH]** | Haas *Alarm Search Help Guide* (RD0002): https://www.haascnc.com/service/troubleshooting-and-how-to/reference-documents/alarm-search-help.html (seen via search extract) |
| **[AXA]** | Haas *NGC Axis Assignments*: https://www.haascnc.com/content/haascnc/en/service/troubleshooting-and-how-to/reference-documents/next-generation-control---axis-assignments.html (seen via search extract) |

---

# PART A: SETTINGS

## A.1 How settings behave on the control (for the UI)

[OM20 p.435]
- **Navigation**: SETTING → Settings tab. Settings are grouped; [UP]/[DOWN] chooses a group, [RIGHT] opens it and [LEFT] goes back.
- **Direct access**: type the setting number, then [F1]. If a setting is already highlighted, the [DOWN] cursor also jumps to the typed number.
- **Value types**:
  - numeric: type the value, then [ENTER]
  - list: [RIGHT] opens the choices, [UP]/[DOWN] selects, [ENTER] confirms
- **User Positions tab** (second home, tool-change mid positions, user travel limits, safe tool change location) [OM20 p.507-508]:
  - Jog the axis to the position, then **[F2]** sets it. A crash warning appears, except for user travel limits; confirm to activate.
  - **[ORIGIN]** opens a menu:
    - 1 = clear the selected setting
    - 2 = clear all second-home settings
    - 3 = clear all tool-change mid positions
    - 4 = clear all max user travel limits
  - An invalid position shows an explanatory message on the message bar.
- The OM20 list headings and the current WEB-S names differ for some settings. Both are given below as "WEB-S name / OM20 heading".

## A.2 Numbers from the request that do not exist or differ

| Requested | Finding |
|---|---|
| 3, 7, 41, 138, 244 | **Not present** in OM20 or WEB-S. Do not invent them. |
| 1-2 "auto power off" | **1 Auto Power Off Timer**, **2 Power Off at M30** (both exist). |
| 34 "4th axis diameter?" | Exists: **34 4th Axis Diameter**. |
| 47 | **47 Mirror Image Z Axis**. |
| 73 | **73 G68 Incremental Angle**. |
| 79 / 80 | **79 5th-Axis Diameter**, **80 Mirror Image B Axis**. |
| 143 | **143 Machine Data Collection Port** (network data collection), not operator behaviour. |
| 243/244 "fan" | **243 Air Water Purge On-Time**. 244 does not exist, and no fan setting was found. |
| 255-257 "MRZP offsets?" | Exist: **255/256/257 MRZP X/Y/Z Offset**. |
| 76 | WEB-S "Tool Release Lockout"; OM20 heading "Tool Release Lock Out". |
| 88 | WEB-S list spells it "Reset Rests Override" (Haas typo); OM20 heading "Reset Resets Overrides". |

## A.3 Settings tables

Columns: **No. | Name | Values / range / default | Behaviour to implement | p.(OM20)**.
"Default" is given only where Haas states it. **Sim** marks priority: ★ = must implement, ○ = optional or cosmetic.

### A.3.1 Units, number interpretation, coordinates

| No. | Name | Values / default | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 9 | Dimensioning | INCH / MM | Selects programmed units. INCH: X/Y/Z resolution 0.0001 in, default G-code **G20**. MM: resolution 0.001 mm, default **G21**. Changing it **converts all offsets** but **does not convert stored programs**. Jog increments per handle click: inch .0001/.001/.01/.1 in, metric .001/.01/.1/1 mm. | 444-445 | ★ |
| 77 | Scale Integer F | DEFAULT, INTEGER, .1, .01, .001, .0001 | How an F **without a decimal point** is read. For `F10`: DEFAULT → 0.0010 (inch) or 0.0100 (mm); INTEGER → 10.; .1 → 1.0; .01 → 0.10; .001 → 0.010; .0001 → 0.0010. Haas recommends always using a decimal point. | 454 | ★ |
| 162 | Default To Float | ON/OFF | ON: integer values on X, Y, Z, A, B, C, E, I, J, K, U, W are read as if they had a decimal point (`X-2` → -2.). OFF: machinist notation (`X-2` → -0.0002 in inch, -0.002 in mm). Does not change Setting 77. | 462 | ★ |
| 29 | G91 Non-modal | ON/OFF | ON: G91 applies only to the block it is in. OFF: G91 is modal. Must be OFF for G47 engraving. | 447 | ★ |
| 33 | Coordinate System | FANUC / HAAS | Handling of G52/G92. In both modes the G52 value is added to all work offsets. **FANUC**: [RESET], M30 or power-down clears G52. **HAAS**: G52 stays until set to zero manually or with `G52 X0 Y0 Z0`. | 448 | ★ |
| 377 | Negative Work Offsets | ON/OFF | ON: negative work offsets move the axis away from home. OFF: positive offsets do. | 488 | ○ |
| 34 | 4th Axis Diameter | 0.0000-50.0000 in | Part diameter for the 4th axis, used to turn the G94 linear feed into an angular feedrate. On the UMC the 4th axis is **B**. | 448 | ★ |
| 79 | 5th-Axis Diameter | 0.0-50 in | Same for the 5th axis (**C** on the UMC). | 454 | ★ |
| 45-48, 80, 250 | Mirror Image X / Y / Z / A / B / C Axis (45 X, 46 Y, 47 Z, 48 A, 80 B, 250 C) | ON/OFF | Mirror that axis's motion about work zero. Same mechanism as G101. | 450, 454, 465 | ○ |
| 71 | Default G51 Scaling | default 1.000 | Scale used by G51 when P is absent. If nonzero, Settings 188-190 are ignored. | 452, 463 | ○ |
| 188-190 | G51 X / Y / Z Scale | positive | Per-axis scaling when S71 = 0. **Only G01 is allowed; G02/G03 raise alarm 467.** | 463 | ○ |
| 72 | Default G68 Rotation | degrees | Rotation used by G68 when R is absent. | 452 | ○ |
| 73 | G68 Incremental Angle | ON/OFF | ON plus G91: each G68 R adds to the previous angle. Must be OFF for G47. | 453 | ○ |

### A.3.2 Program flow, end, reset, restart

| No. | Name | Values / default | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 31 | Reset Program Pointer | ON/OFF | ON: [RESET] moves the program pointer to the program start. OFF: the pointer does not move. | 447 | ★ |
| 56 | M30 Restore Default G | ON/OFF | ON: M30 **or [RESET]** returns all modal G-codes to their defaults. | 451 | ★ |
| 36 | Program Restart | ON/OFF | ON: starting mid-program **scans the whole program** to set tools, offsets, G/M state and positions before running from the cursor. **Starting on a block with cutter comp active raises an alarm**; start before G41/G42 or after G40. The machine first goes to the tool and position of the block *before* the cursor. Processed M-codes: M08, M09, M41, M42, M51-M58, M61-M68. OFF: no scan. | 448-449 | ★ |
| 39 | Beep @ M00, M01, M02, M30 | ON/OFF | Beeper sounds until a key is pressed at M00, M01 (Optional Stop on), M02 and M30. | 449 | ○ |
| 42 | M00 After Tool Change | ON/OFF | ON: the program stops after each tool change with a message; [CYCLE START] continues. | 449 | ★ |
| 118 | M99 Bumps M30 Cntrs | ON/OFF | ON: an M99 **in a main program** increments the M30 counters (#3901/#3902). | 460 | ○ |
| 2 | Power Off at M30 | ON/OFF | ON: power-down at M30 after a **15 s** warning; any key cancels. | 443 | ○ |
| 103 | Cyc Start/Fh Same Key | ON/OFF | ON: [CYCLE START] must be **held** to run, and releasing it gives a feed hold. Mutually exclusive with 104: turning one ON turns the other OFF. | 458 | ★ |
| 104 | Jog Handle to SNGL BLK | ON/OFF | ON: the jog handle single-steps the program, and reversing the handle gives a feed hold. Mutually exclusive with 103. | 458 | ★ |
| 74 | 9xxx Progs Trace | ON/OFF | ON: O9xxxx macro code is displayed while it runs. OFF: it is hidden. | 453 | ○ |
| 75 | 9xxx Progs Single BLK | ON/OFF, **default ON** | ON + Single Block: stops at every O9xxxx block. OFF: macros run through without single-block pauses. With 74 OFF and 75 OFF, macros run hidden and unpaused. | 453 | ○ |
| 251 | Subprogram Search Location | Memory / USB Device / Setting 252 | Where M98, G65 and M130 look when the file is not in the main program's directory. For Memory or USB the file must be at the device root. File name `Onnnnn.nc`. | 465 | ★ |
| 252 | Custom Subprogram Search Location | path list | Search paths used when S251 = Setting 252. Paths are added from LIST PROGRAM with [F3] and deleted with [DELETE]. | 466 | ○ |

### A.3.3 Overrides and lockouts

| No. | Name | Values | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 10 | Limit Rapid at 50% | ON/OFF | ON: rapids are limited to 50% of maximum (Haas example: 700 → 350 ipm) and a "50% rapid override" message is shown. | 445 | ★ |
| 19 | Feedrate Override Lock | ON/OFF | Disables the feedrate override keys. | 446 | ★ |
| 20 | Spindle Override Lock | ON/OFF | Disables the spindle override keys. | 446 | ★ |
| 21 | Rapid Override Lock | ON/OFF | Disables the rapid override keys. | 446 | ★ |
| 83 | M30/Resets Overrides | ON/OFF | ON: M30 restores feed, spindle and rapid overrides to 100%. | 455 | ★ |
| 87 | Tool Change Resets Override | ON/OFF | ON: an executed **M06** cancels overrides (back to programmed values). Does not apply to [ATC FWD]/[ATC REV]. | 457 | ★ |
| 88 | Reset Rests Override / Reset Resets Overrides | ON/OFF | ON: [RESET] cancels overrides (back to programmed values or 100%). | 457 | ★ |
| 101 | Feed Override -> Rapid | ON/OFF | ON: [HANDLE FEED] makes the jog handle change feed **and** rapid overrides together, and the +10% / -10% / 100% FEEDRATE keys change both. Rapid stays at or below 100% and is limited by Setting 10. | 457 | ★ |
| 144 | Feed Override -> Spindle | ON/OFF | ON: the feed override is also applied to the spindle speed (constant chip load), and the spindle override keys are disabled. | 461 | ★ |
| 6 | Front Panel Lock | ON/OFF | ON disables spindle [FWD]/[REV], [ATC FWD]/[ATC REV], [NEXT TOOL] and [TOOL RELEASE]. | 444 | ○ |
| 8 | Prog Memory Lock | ON/OFF | ON locks memory editing ([ALTER], [INSERT], ...) and MDI. OM20 contradicts itself in the next sentence (U). | 444 | ○ |
| 17 | Opt Stop Lock Out | ON/OFF | ON: the Optional Stop feature is unavailable, so M01 never stops. | 445 | ★ |
| 18 | Block Delete Lock Out | ON/OFF | ON: Block Delete is unavailable. | 446 | ★ |
| 23 | 9xxx Progs Edit Lock | ON/OFF | ON: the O09000 folder in Memory cannot be viewed or edited. Message: `Setting 23 restricts access to folder`. | 446 | ○ |
| 76 | Tool Release Lockout | ON/OFF | ON: the keyboard [TOOL RELEASE] key is disabled. | 453 | ★ |
| 86 | M39 Lockout (OM20: "M39 (Rotate Tool Turret) Lockout") | ON/OFF | ON: M39 commands are ignored. | 457 | ○ |
| 119 | Offset Lock | ON/OFF | ON: offsets cannot be edited on the display; G10 and macros still can. | 460 | ★ |
| 120 | Macro Var Lock | ON/OFF | ON: macro variables cannot be edited manually; programs still can. | 460 | ○ |
| 142 | Offset Chng Tolerance | 0-3.9370 in (0-100 mm) | Changing an offset by more than this value prompts `XX changes the offset by more than Setting 142! Accept (Y/N)?`; [Y] accepts and [N] rejects. | 461 | ★ |

### A.3.4 Canned cycles, cutter compensation, motion quality

| No. | Name | Values / default | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 22 | Can Cycle Delta Z | distance | Chip-clearing retract distance used by **G73**. | 446 | ★ |
| 27 | G76 / G77 Shift Dir. | X+, X-, Y+, Y- | Tool shift direction to clear a boring bar in G76/G77. | 446 | ★ |
| 28 | Can Cycle Act w/o X/Y | ON/OFF (Haas prefers ON) | ON: the canned-cycle definition block runs one cycle even with no X/Y in it. OFF: X or Y is needed in that block. `L0` suppresses execution on the definition line. No effect on G72. | 447 | ★ |
| 52 | G83 Retract Above R | distance | G83 retracts this distance above R to clear chips, so R can sit close to the part. | 451 | ★ |
| 57 | Exact Stop Canned X-Y | ON/OFF | ON: X/Y reach position before Z moves in canned cycles. OFF: Z may start before X/Y arrive. | 451 | ★ |
| 130 | Tap Retract Speed | 0, 1, 2, 3, ... | Rigid-tap retract multiplier: 2 = twice the in-feed speed; 0 or 1 = no effect. A **J** address on G84 overrides it. | 460 | ★ |
| 133 | Repeat Rigid Tap | ON/OFF | Orients the spindle so threads line up on a repeat pass. **Must be ON for peck tapping.** | 461 | ○ |
| 306 | Minimum Chip Clear Time | seconds | Minimum time at "chip clean speed" (the canned-cycle E rpm). | 482 | ○ |
| 35 | G60 Offset | distance | Overshoot distance before reversing for G60. | 448 | ○ |
| 40 | Tool Offset Measure | RADIUS / DIAMETER | How tool size is entered for cutter comp; also changes the displayed diameter geometry and wear. RADIUS → DIAMETER doubles the displayed value. | 449 | ★ |
| 43 | Cutter Comp Type | A / B | How the first compensated stroke starts and how the tool leaves the part. | 449 | ★ |
| 44 | Min F Radius CC% (OM20: "Min F In Radius CC %") | % | Lowest feed, as a % of programmed, when comp slows the tool on inside arcs. | 449 | ○ |
| 58 | Cutter Compensation | FANUC / YASNAC | Comp interference method. The control looks ahead 2 X/Y blocks (3 blocks total); see OM20 p.199-200. | 451 | ★ |
| 85 | Maximum Corner Rounding | default **0.0250 in** (Haas gives inch only, ≈0.635 mm) | Corner tolerance; feed is reduced to keep corner radii within it. **0 = exact stop in every motion block.** See also 191 and G187. | 456 | ○ |
| 191 | Default Smoothness | ROUGH / MEDIUM / FINISH | Default smoothness and corner-rounding factor unless G187 overrides it. | 463 | ○ |
| 335 | Linear Rapid Mode | NONE / LINEAR (XYZ) / LINEAR + ROTARY | NONE: each axis rapids independently (dog-leg). LINEAR (XYZ): X/Y/Z rapid in a straight line, other axes independent. LINEAR + ROTARY: X/Y/Z/A/B/C all arrive together (rotary may slow). Haas: cycle time is the same in all modes. **Important for UMC visual rapid paths.** | 485 | ★ |

### A.3.5 Tools, tool change, tool management

| No. | Name | Values / default | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 15 | H and T Code Agreement | ON/OFF | ON: the H offset must match the spindle tool, otherwise **Alarm 332 H AND T NOT MATCHED** [p.194]. **H00 never alarms.** | 445 | ★ |
| 64 | Tool Offset Measure Uses Work (OM20: "T. Ofs Meas Uses Work") | ON/OFF | ON: [TOOL OFFSET MEASURE] stores machine Z **plus** the work-offset Z. OFF: stores machine Z position. | 452 | ★ |
| 81 | Tool At Power Up | tool no., **default 1** | [POWER UP] changes to this tool. 0 = no tool change; the carousel rotates to pocket 1. If the tool is already in the spindle, no change. Otherwise the carousel goes to pocket 1, then to the tool's pocket, and the tool is loaded. | 454 | ★ |
| 113 | Tool Change Method | Auto / Manual | Manual: at a tool change the machine stops and prompts the operator to load the tool; [CYCLE START] continues. | 459 | ○ |
| 155 | Load Pocket Tables | ON/OFF, **OFF at every power-on** | ON allows the SMTC pocket-tool table to be overwritten when loading an offset file. | 461 | ○ |
| 156 | Save Offsets with Program | ON/OFF | ON: offsets are saved inside the program file (under `O999999` before the final `%`); loading asks `Load Offsets (Y/N?)`. | 462 | ○ |
| 84 | Tool Overload Action | ALARM / FEEDHOLD / BEEP / AUTOFEED | Response when the tool-load limit is exceeded (ATM):<br>• ALARM stops the machine (Alarm 174).<br>• FEEDHOLD shows `Tool Overload` and feed-holds; any key clears the message.<br>• BEEP sounds the beeper.<br>• AUTOFEED automatically limits the feed using Settings 264-266.<br>AUTOFEED is ineffective while tapping (overrides locked) and must not be used for thread milling or auto-reversing tap heads. The programmed feed is restored at program end, [RESET] or when AUTOFEED is switched off. | 455-456 | ○ |
| 264 / 265 / 266 | Autofeed Step Up / Autofeed Step Down / Autofeed Minimum Override | % | AUTOFEED: % increase after the overload clears / % decrease during overload / minimum %. | 473 | ○ |
| 240 | Tool Life Warning | % of tool life | Shows the Tool Wear Warning icon when reached. The life limit itself gives Alarm 362. | 464 | ○ |
| 247 | Simultaneous XYZ Motion in Tool Change | ON/OFF | **OFF: Z retracts first, then X/Y move. ON: simultaneous.** Haas strongly recommends OFF on the UMC (B/C crash risk). | 465; UMC20 p.33 | ★ |
| 293-298 | Tool Change Mid Position X / Y / Z / A / B / C | position or inactive | A safe intermediate position the axes visit **before** the final tool-change position. Used by every tool change (M06, [NEXT TOOL], ...). Set in the User Positions tab; [ORIGIN] deactivates it. | 476-479 | ★ |
| 337-339 | Safe Tool Change Location X / Y / Z | position | Listed in WEB-S User Positions. Description found only on the *lathe* per-setting page (safe position before the final tool-change position) (U for the mill). | - | ○ |
| 420 | ATC Button Behavior | Conventional / Enhanced | Enhanced: [ATC FWD]/[ATC REV] load the next higher or lower tool number in the pocket table, wrapping around. | 491 | ○ |
| 90 | Max Tools To Display | number | Limits the rows shown on the Tool Offsets screen. | 457 | ○ |

### A.3.6 Spindle

| No. | Name | Values | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 291 | Main Spindle Speed Limit | rpm, 0 = off | Nonzero: the spindle never exceeds this speed. | 476 | ★ |
| 292 | Door Open Spindle Speed Limit | rpm | Maximum spindle speed while the door is open. | 476 | ★ |
| 165 | Ssv Variation (RPM) (OM20: "Main Spindle SSV Variation (RPM)") | positive rpm | SSV amplitude ±rpm (M138 P overrides). | 463 | ○ |
| 166 | Ssv Cycle (OM20: "Main Spindle SSV Cycle") | positive s | SSV period (M138 E overrides). | 463 | ○ |
| 421 | General Orient Angle | deg | WEB-S only; per-setting page (via search extract): mill/turn live-tool orientation after a tool change. n.a. for a UMC-500. | - | ○ |

### A.3.7 Coolant, chips, air, auxiliary

| No. | Name | Values | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 32 | Coolant Override | NORMAL / OFF / IGNORE | NORMAL: [COOLANT] key and M-codes both work. **OFF**: the key shows `FUNCTION LOCKED` and a programmed coolant command raises an alarm (CHC **363 COOLANT LOCKED OFF**). **IGNORE**: programmed coolant commands are ignored and the key still works. | 447 | ★ |
| 409 | Default Coolant Pressure | 0 Low / 1 Normal / 2 High | Pressure used by M08 with no P (VFD coolant pump only). | 490 | ○ |
| 197 | Coolant Shutoff | minutes | Coolant turns off after this much idle time. | 463 | ○ |
| 114 | Conveyor Cycle Time (minutes) | min | Interval at which the conveyor turns on automatically. On-time should be ≤80% of cycle time. M31 starts the cycle; M33 stops and cancels it. | 459 | ○ |
| 115 | Conveyor On-Time (minutes) | min | Run time per cycle. | 459 | ○ |
| 196 | Conveyor Shutoff | min | Idle time before the conveyor (and washdown) stops. | 463 | ○ |
| 242 | Air Water Purge Interval | min | Interval between condensate purges of the air reservoir. | 464 | ○ |
| 243 | Air Water Purge On-Time | s | Duration of each purge. | 464 | ○ |
| 277 | Lubrication Cycle Interval (OM20: "Axis Lubrication Interval") | hours; min 1, max 12-24 depending on model | Interval between axis lube cycles. | 476 | ○ |
| 369 | PulseJet Injection Cycle Time | - | Pulse cycle time for M161. | 486 | ○ |
| 370 | PulseJet Single Squirt Count | - | Squirt count for M162/M163. | 486 | ○ |
| 424 | Mist Extractor Condenser Time Out | - | WEB-S only (U). | - | ○ |

### A.3.8 Jog, zero return, manual mode

| No. | Name | Values / default | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 53 | Jog w/o Zero Return | ON/OFF; **returns to OFF at every power-up** | ON allows jogging before the machine is homed. Haas warns this is dangerous because axes can hit the hard stops. Setting 325's text mentions "jog limits imposed by setting 53", so jogging in this state is restricted somehow (U). | 451 | ★ |
| 325 | Manual Mode Enabled | ON/OFF | ON: jog without zero return, and the Setting 53 jog limits do **not** apply. Jog rate comes from the eWheel switch or the jog-rate keys. Tool changes with [ATC FWD]/[ATC REV] are allowed. OFF: normal operation, zero return required. | 485 | ○ |
| 163 | Disable .1 Jog Rate | ON/OFF | Disables the highest jog rate (.1 in / 1 mm); selecting it picks the next lower rate. | 462 | ★ |
| 267 | Exit Jog Mode After Idle TIme (sic) | minutes; 0 = disabled | After this many minutes in jog mode with no motion and no keys, the control leaves jog mode. **OM20 says it changes to MDI mode; the current per-setting page (via search extract) says ZERO RETURN mode.** Implement the current behaviour (ZERO RETURN) and flag it (U). | 473 | ○ |
| 108 | Quick Rotary G28 | ON/OFF | ON: G28 on a rotary axis returns to **machine** home within ±359.99° (OM20 example: at ±950° it turns ±230°; UMC20 example: `C960.` then `G28 G91 C0.` turns −240°). **Works only with G91, not G90.** | 458; UMC20 p.33 | ★ |
| 268-273 | Second Home Position X / Y / Z / A / B / C (268 is spelt "Postion" in WEB-S) | in/mm or deg, limited by travel | Second home target (G30 / [HOME G28] variants, see the G-code file). User Positions tab; [ORIGIN] deactivates. | 473-475 | ○ |
| 310-312 | Min User Travel Limit A / B / C | deg | Custom rotary travel limits, set with [F3] (move to mount position) and [F2]. The control computes the minimum to guarantee safe homing. If the tool-change position falls outside, a confirmation pop-up appears. | 482-483 | ○ |
| 313-318 | Max User Travel Limit X / Y / Z / A / B / C | position | Custom maximum travel limits (User Positions tab). The alarm raised on violation is (U); presumably the axis over-travel alarm (x.316). | 483-484 | ○ |

### A.3.9 Rotary, 5-axis, MRZP (UMC-500)

| No. | Name | Values / default | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 254 | 5-Axis Rotary Center Distance | in/mm, **default 0**, max ±0.005 in (Haas states ±0.1 mm) | Offset between the tilt and rotary centres of rotation. Applied during rotary motion with **G234** TCPC; 0 = no compensation. | 467 | ○ |
| 255 | MRZP X Offset | in/mm; macro **#20255** | B/C UMC: X distance from X home to the **B tilt axis** centreline. (A/C trunnion: to the C axis centreline.) | 468 | ★ |
| 256 | MRZP Y Offset | in/mm; **#20256** | B/C UMC: Y distance from Y home to the **C rotary axis** centreline. (A/C: to the A axis.) | 469 | ★ |
| 257 | MRZP Z Offset | in/mm; **#20257** | B/C UMC: Z distance from Z home to the **B tilt axis**. (A/C: to the A axis.) Touch off tools with tilt at 0° (B0). On the UMC-750, B and C intersect about 2 in above the table. | 470 | ★ |
| 300-302 | MRZP X / Y / Z Offset Master | in/mm | Like 255-257 but tied to the **master** (bottom, e.g. tilting trunnion) axis. **Overrides 255/256/257.** | 479-480 | ○ |
| 303-305 | MRZP X / Y / Z Offset Slave | in/mm | Like 255-257 for the **slave** (top, e.g. rotary platter) axis. **Overrides 255/256/257.** | 480-481 | ○ |
| 117 | G143 Global Offset | - | VR models only (pivot length for G143). n.a. on the UMC. | 460 | ○ |
| 378-380 | Safe Zone Calibrated Geometry Reference Point X / Y / Z | - | Safe Zone (collision) reference. | 488 | ○ |
| 408 | Exclude Tool From Safe Zone | ON/OFF; **reverts to OFF after power cycle** | Excludes the tool from the Safe Zone calculation, e.g. to machine the table. | 490 | ○ |
| 164 | Rotary Increment | 0-360, default 90 | EC-300/EC-1600 load-station [PALLET ROTATE] only. n.a. | 462 | ○ |

The VPS "B-Axis Tilt C-Axis Rotary MRZP Finish Set" probing routine writes the measured MRZP distances to macro variables **#10121-#10123**. If they have changed, the operator enters them into Settings 255-257 [UMC20 p.14-15]. See the UMC-500 file.

### A.3.10 Power, timers, warm-up, thermal, display, misc

| No. | Name | Values | Behaviour | p. | Sim |
|---|---|---|---|---|---|
| 1 | Auto Power Off Timer | minutes | Power-down after this much idle time. Not while a program runs; any key or handle movement restarts the timer. **15 s warning**, and any key cancels. | 443 | ○ |
| 216 | Servo and Hydraulic Shutoff | **seconds** | Idle time before Power Save Mode: servos and hydraulics off, restarting automatically on demand. | 464 | ○ |
| 199 | Backlight Timer | minutes | Screen backlight off after idle time, except in JOG, GRAPHICS, SLEEP or with an alarm present. Any key wakes it ([CANCEL] preferred). | 464 | ○ |
| 238 | High Intensity Light Timer (minutes) | 0 = on while the door is open | HIL on-time after the door opens (work-light switch on). | 464 | ○ |
| 239 | Worklight Off Timer (minutes) | min | Work light off after idle time; a running program continues. | 464 | ○ |
| 109 | Warm-Up Time in Min. | ≤ 300 min | Duration of warm-up compensation. With a nonzero 109 and one of 110-112, power-up asks `CAUTION! Warm up Compensation is specified! Do you wish to activate Warm up Compensation (Y/N)?`. Compensation decays linearly to 0. | 458-459 | ○ |
| 110-112 | Warmup X / Y / Z Distance | max ±0.0020 in (±0.051 mm) | Warm-up compensation amount per axis. Changing it mid-warm-up can jump the axis up to 0.0044 in. | 459 | ○ |
| 357 | Warm Up Cycle Start Idle Time | hours | After this much idle time, [CYCLE START] asks whether to re-apply warm-up compensation ([Y]/[ENTER] = yes, [N] = no). | 486 | ○ |
| 158-160 | X / Y / Z Screw Thermal Comp% | −30 to +30 | Scales screw thermal compensation by ±30%. | 462 | ○ |
| 245 | Hazardous Vibration Sensitivity | Normal / Low / Off; **Normal at every power-up** | Cabinet accelerometer threshold. Vibration of roughly 600-1,400 g (model-dependent) gives an alarm; the alarm number is (U). | 464-465 | ○ |
| 323 | Disable Notch Filter | ON/OFF; needs a power cycle | ON improves circular accuracy; OFF improves finish. | 485 | ○ |
| 4 | Graphics Rapid Path | ON/OFF | ON: rapids drawn as dashed lines in Graphics. | 444 | ★ |
| 5 | Graphics Drill Point | ON/OFF | ON: a circle is drawn at each canned-cycle hole. | 444 | ★ |
| 253 | Default Graphics Tool Width | ON/OFF | ON: tool path drawn as a line. OFF: drawn at the tool-offset diameter. | 467 | ○ |
| 422 | Lock Graphics Plane | - | WEB-S only (U). | - | ○ |
| 82 | Language | list | UI language. | 455 | ○ |
| 356 | Beeper Volume | 0 = off, 1-255 | Pendant beeper only. | 486 | ○ |
| 131 | Auto Door | ON/OFF | Enables the auto door. The door closes at [CYCLE START] and opens at M00, M01 (Opt Stop on), M02 and M30 once the spindle stops. M80/M81 need the cell-safe signal (alarm 548 otherwise). | 460 | ○ |
| 276 | Workholding Input Monitor (OM20: "Workholding Input Number") | input no. | The input watched by M90. A spindle start while it shows "unclamped" gives **973 FIXTURE CLAMP INCOMPLETE**. | 476 | ○ |
| 389 | Vise Unclamped Safety Check (OM20: "Vise 1 Clamp Device Check For Part Holding At Cycle Start" / "Vise Check For Part Hold at Cycle Start") | ON/OFF | ON: [CYCLE START] is refused while any workholding device is unclamped. | 489 | ○ |
| 416 | Media Destination | 0 Built-In Monitor / 1 External Monitor | M130 media goes to HDMI; the Media tab shows "See External Monitor". | 490 | ○ |
| 261-263 | DPRNT Store Location / DPRNT Destination File Path / DPRNT Port | Disabled / File / TCP Port | Where macro DPRNT output goes (up to 5 TCP connections). | 471-473 | ○ |
| 143 | Machine Data Collection Port | port, 0 = off | Enables the MDC TCP server for ?Q queries and E writes (2 connections). | 461, 504-506 | ○ |
| 381, 383, 396-399, 403, 423 | Touchscreen / UI sizing settings | - | UI only. | 488-489 | ○ |
| 249, 330 | Enable Haas Starup Screen (sic), MultiBoot Selection Time out | - | 330 is simulator-only (model chooser time-out on the Haas PC simulator). | 485 | ○ |
| 372, 375, 376, 382, 400 | Parts Loader Type, APL Gripper Type, Light Curtain Enable, Disable Pallet Changer, Pallet Ready Beep Type | - | APL and pallet automation. n.a. for the UMC-500 trainer. | 487-489 | ○ |
| 430, 431, 433 | Enable / Region of Interest / Behavior - Broken Tool Detection | - | WEB-S only (U). | - | ○ |

## A.4 Event pipelines (combining settings)

Implement each of these as a single function in the simulator.

- **onReset()**:
  - Pointer to program start if **S31**.
  - Modal G-codes to defaults if **S56**.
  - Overrides to 100% if **S88**.
  - Clear G52 if **S33 = FANUC**.
  - Cancel M138 SSV, G234 and G254.
  - Turn off M51-M55 relays and abort any M-Fin wait.
  - Restore the vise check (M71 Q1).
  - Restore the AUTOFEED feed.
  - Clear alarms. CHC02: one alarm per RESET press; NGC behaviour (U).
- **onM30()**:
  - Stop spindle and coolant (incl. TSC) and rewind.
  - Increment the M30 counters.
  - S56 → modal G defaults; S83 → overrides 100%; S33 = FANUC → clear G52.
  - Cancel G234/G254 and SSV.
  - S2 → power-off countdown; S39 → beep; S131 → door opens.
  - Tool length offset is **not** cancelled (software ≥ 100.16.000.1041).
- **onM06()**: S87 → overrides reset; S293-298 mid positions; S247 order of axis moves; S42 → stop after the change; S15 → H/T check later. Full sequence in `mcode.md` §5.3.
- **onPowerUp()**:
  - Servos off, with alarm 102 present until reset (U).
  - S53 forced OFF; S155 forced OFF; S245 → Normal; S408 → OFF.
  - Warm-up prompt (S109-S112).
  - [POWER UP] key zero-returns and loads the tool in S81.

---

# PART B: ALARMS

## B.1 NGC alarm numbering

Sources: [ASH], [AXA], [OM20 p.266]; all via search extract except OM20.

| Format | Meaning | Example |
|---|---|---|
| `nnn` (no decimal) | **Standard alarm.** The same numbers are used on the Classic Haas Control (CHC) and NGC [ASH]. | `102`, `332` |
| `a.nnn` or `a.nnnn` | **Axis alarm.** The prefix `a` is the axis number from the NGC axis assignment table; the part after the decimal is the alarm number. The control's Alarm Viewer searches only on the part after the decimal; the Haas web search accepts either form. | `1.9930` = X-axis serial encoder communication fault [ASH]; `1.316` = X-axis over travel range |
| `nnnn.nnn` | Four digits before the decimal = alarm number; three digits after = **sub-alarm code**. | `9100.018` [ASH] |
| `20000`-`20017` | **Informational** messages, usually logged at power-up, shown only in the alarm history, and needing no service action (except SD-card messages). | `20000` parameter change [Haas 20000 alarm messages page] |
| `1000`-`1999` | **Programmable (macro) alarms.** `#3000 = n` (n = 1-999) raises alarm `1000+n` with the text of the next comment. All motion stops and a reset is required. | `#3000=15 (MSG)` → alarm 1015 [OM20 p.266] |

**Axis prefixes (mill)** [AXA, via search extract]:

| Prefix | Axis |
|---|---|
| 1 | X |
| 2 | Y |
| 3 | Z |
| 4 | Main spindle (alarm texts read `4.xxx S (SPINDLE) ...`) |
| 5 | A |
| 6 | B |
| 7 | C |
| 9 | Servo tool carousel (mill) / turret (lathe) |

Haas notes the axis number is not always the same as the physical board address.

- **For the UMC-500: B → `6.xxx`, C → `7.xxx`.** This is the generic table, also used by Haas's rotary troubleshooting guide (5.103 / 6.103 / 7.103 for A / B / C). It is (U) only in that no UMC-specific table was seen.
- **CHC → NGC**: CHC used one number per axis (e.g. 103 X, 104 Y, 105 Z, 106 A Servo Error Too Large; 108-111 and 188, 271 Servo Overload). NGC uses one number with an axis prefix, e.g. CHC 108 "X Servo Overload" → NGC **1.108**. This mapping appears on Haas's NGC axis-grid-offset page. Per [AXA], CHC alarms 109, 110, 111, 188, 271 and 674 and the other per-axis servo-overload alarms **do not appear on NGC**.
- **Display format for the simulator**:
  - axis alarms: `<prefix>.<num> <TEXT>`, e.g. `6.316 B-AXIS OVER TRAVEL RANGE` (inferred from Haas titles such as "1.316 X-Axis Over Travel Range" and "4.116 S (SPINDLE) SPINDLE ORIENTATION FAULT")
  - standard alarms: `<num> <TEXT>`
  - NGC shows alarm text in upper case.

**Alarm handling on the control**:
- **CHC02** [PDF p.52]:
  - A blinking "ALARM" indicator appears.
  - **RESET removes one alarm from the list per press.**
  - **The presence of any alarm prevents starting a program.**
  - Tool-changer alarms: fix the mechanical cause, RESET until clear, then ZERO RET → AUTO ALL AXES.
- **NGC** [OM20]: tool-changer jams use **[RECOVER] → TOOL CHANGER RECOVERY** (automatic, then manual) [p.150-151].
- Whether NGC RESET clears all alarms at once is (U).

## B.2 Status legend

| Tag | Meaning |
|---|---|
| **NGC✓** | Number and text in an official NGC document read directly (OM20 / UMC20). |
| **NGC~** | Official Haas NGC web page or guide (haascnc.com), seen **only via search-engine extract** (site blocks fetch tools). |
| **CHC✓** | Official Haas classic-control text (CHC02). The standard number is shared with NGC per [ASH], but the **NGC wording is unconfirmed**. |
| **SEC** | Secondary source only (forum or third party). |
| **U** | Unconfirmed: no number found. A placeholder is suggested. |

Recovery shorthand: **RST** = clear the cause, then [RESET]. **RST+ZR** = [RESET], then zero return ([POWER UP] or ZERO RETURN → ALL).

## B.3 Safety / servo / axis

| No. | Text | Cause | Recovery | Status / source |
|---|---|---|---|---|
| 102 | SERVOS OFF (CHC text "Servos Off") | Servos off. Caused by E-stop, another alarm, or power-on. Spindle, coolant and tool changer are disabled. | Clear the causing condition; [RESET] turns the servos back on. Usually follows another alarm, so chase the first alarm in the history. | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_102-0000.html (one search summary titled it "SERVOS TURNED OFF"; exact NGC wording U); CHC✓ p.52 |
| 107 | EMERGENCY OFF (CHC text "Emergency Off") | [EMERGENCY STOP] pressed. CHC also raises it for low hydraulic counterbalance pressure, and then it will not reset until fixed. | Release the E-stop, then [RESET]. Expect 102 alongside. | CHC✓ p.52; NGC page exists but says Haas has "no online support for this alarm": https://www.haascnc.com/service/alarm-search.alarm=ngc_107-0000.html; NGC wording (EMERGENCY OFF vs EMERGENCY STOP) **U** |
| a.103 | AXIS SERVO ERROR TOO LARGE (CHC: "X Servo Error Too Large" 103 / Y 104 / Z 105 / A 106 / B 187 / C 270) | Following error: the axis cannot reach the commanded position (load, crash, chips, stall, hard stop). Servos turn off. | Clear the cause (chips, program feeds, crash); RST+ZR. On rotaries: the brake may not have released. | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_103-0000.html; rotary 5./6./7.103: https://www.haascnc.com/service/online-manuals/rotary---service-manual/rotary---troubleshooting.html |
| a.108 | AXIS SERVO OVERLOAD (CHC: "X Servo Overload" 108 / Y 109 / Z 110 / A 111 / B 188 / C 271) | Motor load above its continuous rating (over 100%) for seconds or minutes, e.g. a hard stop or an over-aggressive cut. Servos off. | Reduce feeds and speeds, check for dull tools; RST+ZR. | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_108-0000.html; mapping 108 → 1.108: https://haascnc.com/content/haascnc/mx/service/troubleshooting-and-how-to/how-to/ngc---axis-grid-offset.html |
| a.145 | AXIS LIMIT SWITCH (CHC: "X Limit Switch" 145 / Y 146 / Z 147 / A 148 / B 191 / C 274) | Home/limit switch input changed state during use (switch tripped, chips on the switch, or wiring). Normally impossible because soft limits stop the axis first. | Remove chips, check the switch, [RESET]. | NGC~ English page title "145 Axis Limit Switch": https://www.haascnc.com/service/alarm-search.alarm=ngc_145-0000.html; CHC✓ p.55 |
| a.316 | X-AXIS OVER TRAVEL RANGE (Haas titles: 1.316 X-Axis, 2.316 Y-Axis, 3.316 Z-Axis Over Travel Range; CHC: 316 X / 317 Y / 318 Z / 319 A / 394 B / 621 C "... Over Travel Range") | A **commanded move would exceed the travel limits**. A program or offset error, detected from the target. G234 near the limits can also cause it [UMC20 p.20]. | Fix the program or offsets, [RESET]. For the UMC: B on the UMC-500 is **−35° to +120°**; C is 360° rotation [UMC20 p.4-5]. | NGC~ https://www.haascnc.com/video/alarm-videos/alarm-1-316-x-axis-over-travel-range.html (also alarm-2-316-y-..., alarm-3-316-z-...); B/C forms `6.316`/`7.316` inferred (U) |
| a.165 | AXIS ZERO RETURN MARGIN IS TOO SMALL (CHC: "X Zero Ret Margin Too Small" 165-168, B 194, C 277) | The home switch and encoder index are too close (switch moved, misadjusted or dirty), so homing would not repeat. Stops the zero return; servos stay on. | Clean or adjust the switch (grid offset); retry the zero return. | NGC~ https://haascnc.com/ar/service/alarm-search.alarm=ngc_165-0000.html; CHC✓ |
| (none) | **Axis not homed / zero return required** | Jog or Cycle Start before [POWER UP] / zero return, with Settings 53 and 325 OFF | **No Haas alarm number found.** Implement as a blocking message, not an alarm, e.g. "ZERO RETURN REQUIRED" (placeholder text). | **U** |
| 253 | ELECTRONICS OVERHEAT | Cabinet temperature too high (CHC: above 135 °F / 57 °C). | Clean filters, check fans. | NGC✓ OM20 p.94; CHC✓ |
| 175 | Ground Fault Detected | Ground fault in the 115 V AC supply (servo or fan motors, pump). | Service. | CHC✓ |
| (none) | Hazardous vibration (Setting 245) | Accelerometer above the threshold (≈600-1,400 g) | Alarm number not found. | **U** |
| 1000-1999 | (text of the comment after `#3000=n`) | Macro programmable alarm | [RESET] | NGC✓ OM20 p.266 |

## B.4 Door / enclosure

| No. | Text | Cause | Recovery | Status / source |
|---|---|---|---|---|
| (status) | **Door Hold** (status, not an alarm) | Door opened with Setup Mode unlocked. Motion stops; on close the control remains in feed hold. | Close the door, then [CYCLE START]. | NGC✓ OM20 p.49 |
| (icon) | Door Open icon / "door must be cycled" icon | The door is open, which limits functions. After power-up the door must be cycled once to prove the sensor works. | Open and close the door once. | NGC~ NGC control-icons page (service manual) |
| 223 | DOOR LOCK FAILURE | Interlock: the door is sensed open while locked, or the lock is worn or misaligned. | Check the switch and key alignment; service. | NGC~ https://www.haascnc.com/service/troubleshooting-and-how-to/troubleshooting/electrical-safety-door-interlocks-troubleshooting-guide.html; CHC✓ p.58 |
| 238 | Door Fault | Safety switch did not trip or release when the door was commanded open or closed (auto door). | Service. | CHC✓; NGC wording U |
| 268 | Door open @ M95 Start | M95 reached with the door open. | Close the door. | CHC✓; NGC U |
| 548 | DOOR M CODES NOT ALLOWED | M80/M81 without a cell-safe signal or with the light curtain not enabled. | Enable a cell-safe signal or the light curtain; check Setting 131. | NGC~ https://www.haascnc.com/service/troubleshooting-and-how-to/troubleshooting/can-dc-autodoor-troubleshooting-guide---ngc.html |

## B.5 Air, lubrication, coolant

| No. | Text | Cause | Recovery | Status / source |
|---|---|---|---|---|
| 120 | LOW AIR PRESSURE (CHC "Low Air Pressure"; current Haas video title "Low Air Pressure or Flow") | CHC: pressure below 80 psi (5.5 bar) for a parameter-defined time. A "LOW AIR PR" message appears first, then the alarm. **UMC-500 requires 4 scfm at 100 psi (113 L/min, 6.9 bar)** [UMC20 p.5]. | Restore supply. CHC advice: incoming at least 100 psi, regulator 85 psi. | NGC~ https://www.haascnc.com/video/alarm-videos/alarm-120---low-air-pressure-or-flow.html; CHC✓ p.53 |
| 291 | Low Air Volume/Pressure During ATC | Tool change not completed because of the air supply. | Fix the air, then tool-changer recovery. | CHC✓ |
| 121 | Low Lube or Low Pressure | Way lube low or empty, or pressure out of range. | Fill the tank, check lines. | CHC✓ p.54; NGC wording U |
| 2075 | AXIS LUBRICATION RESERVOIR IS EMPTY | NGC axis-lube reservoir empty. | Refill. | NGC~ https://haascnc.com/uk/service/troubleshooting-and-how-to/troubleshooting/haas-axis-lubrication-oil---troubleshooting-guide.html |
| 151 | Low Thru Spindle Coolant | TSC: low tank, clogged filter or line. Shuts off TSC, spindle and pump. | Fix the coolant, then RST. | CHC✓; NGC U |
| 363 | Coolant Locked Off | Setting 32 = OFF and the program commanded coolant. | Change Setting 32 or edit the program. | CHC✓ |
| (icon) | Low coolant | Level is checked **only at program start**, so a running program does not stop. | | NGC✓ OM20 p.412 |

## B.6 Spindle

| No. | Text | Cause | Recovery | Status / source |
|---|---|---|---|---|
| 123 | Spindle Drive Fault | Spindle drive, motor or regen failure; over- or under-voltage. | Service, then RST. | CHC✓; a Haas CHC page exists; NGC U |
| 4.103 | S (SPINDLE) AXIS SERVO ERROR TOO LARGE | Spindle following error (e.g. encoder alignment). | RST; service. | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_4-103.html |
| 4.116 | S (SPINDLE) SPINDLE ORIENTATION FAULT (CHC 116 "Spindle Orientation Fault") | Spindle did not orient (M19 or tool change): shot pin or orientation ring, air, drive. | Check air and the orientation ring and pin; RST. | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_4-116.html |
| 186 | Spindle Not Turning | Drive status says the spindle is not at speed when expected. | RST; check the drive. | NGC~ spindle drive guide https://www.haascnc.com/service/troubleshooting-and-how-to/troubleshooting/spindle-drive---how-it-works-and-troubleshooting-guide.html; CHC✓ |
| 4.254 | SPINDLE MOTOR OVERHEAT (CHC 254 "Spindle Overheat") | Over-aggressive cutting, or a failed spindle fan. | Adjust the program, check the fan, let it cool. | NGC~ https://www.haascnc.com/content/haascnc/en/service/troubleshooting-and-how-to/troubleshooting/30t-40t-spindle-motor---troubleshooting-guide---ngc.html |
| 4.9975 | S (SPINDLE) MOTOR TEMPERATURE CRITICAL OVERHEAT | Spindle motor overheat switch. | Cool down; service. | NGC~ same guide |
| 236 | SPINDLE MOTOR OVERLOAD | Spindle overloaded (or motor or cable short). | Reduce the cut; service. | NGC~ same guide (listed without a 4. prefix); CHC✓ |
| 4.994 | S (SPINDLE) AMPLIFIER OVERLOAD | Spindle amplifier overload. | Reduce load. | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_4-994.html |
| 237 | Spindle Following Error | Commanded vs actual rpm error too large. | RST. | CHC✓ |
| 149 | Spindle Turning | Spindle not at zero speed during a tool change. | RST; check the drive. | CHC✓ |
| 133 | Spindle Locked | Orientation shot pin did not release when the spindle was commanded. | Check air and the solenoid. | CHC✓ |
| 390 | No Spindle Speed | S code not commanded (e.g. before a feed move or tapping). | Add S. | CHC✓ |
| 973 | FIXTURE CLAMP INCOMPLETE | M90 monitoring is on (Setting 276) and the spindle started while the fixture input showed unclamped. | Clamp the fixture. | NGC✓ OM20 p.422 |

## B.7 Tool / tool changer / offsets

| No. | Text | Cause | Recovery | Status / source |
|---|---|---|---|---|
| 130 | Tool Unclamped | Tool appeared unclamped during orient, gear change, speed change or TSC start. | Check the drawbar and air. | CHC✓ |
| 131 | Tool Not Clamped | Release piston not home when clamping or at power-up. | Check air and solenoids. | CHC✓ |
| 134 | Tool Clamp Fault | On unclamp, the tool did not release. | Check air and the drawbar. | CHC✓ |
| 150 | Z and Tool Interlocked | Tool changer not home while Z/A/B is not at zero (reset or E-stop during a change). | Remove the tool if needed; tool-changer recovery. | CHC✓ |
| 255 | No Tool In Spindle | Invalid spindle entry in the pocket-tool table (the spindle entry cannot be 0). | Fix the table. | CHC✓ |
| 256 | Current Tool Unknown | Tool information lost (re-initialisation). | Tool-changer restore or recovery. | CHC✓ |
| 266 | Tool Changer Fault | Changer did not return to its start position. | Tool-changer recovery. | CHC✓ |
| 622 | TOOL CHANGER ARM FAULT (CHC: "Tool Arm Fault") | SMTC arm or carousel fault (e.g. carousel stopping between pockets). | [RECOVER] → Tool Changer Recovery. | NGC~ https://www.haascnc.com/service/troubleshooting-and-how-to/troubleshooting/side-mount-tool-changer---carousel-and-pocket---troubleshooting-.html |
| 626 | TOOL-POCKET SLIDE ERROR | Tool change attempted **with the pocket already down**; also air pressure or flow, or an obstruction. | Tool Change Recovery. | NGC~ same TG |
| 623 / 624 / 625 / 627 / 628 / 629 | Side Mount Carousel Error / Invalid Tool / Carousel Positioning Error / ATC Arm Position Timeout / ATC ARM Positioning Error / Carousel Position Timeout | SMTC sequence faults (CHC). | Recovery. | CHC✓ p.70 |
| (none) | **"Tool not in pocket"** | No exact alarm found. Nearest: 255 No Tool In Spindle, 421 No Valid Pockets, 422 Pocket Table Error (CHC). | | **U** |
| 328 | Invalid Tool Number | T outside 1..max tools (CHC: Parameter 65). | Fix T. | CHC✓ |
| 332 | H AND T NOT MATCHED | Setting 15 ON and H ≠ spindle tool (H00 exempt). | Correct H, or turn off S15. | NGC✓ OM20 p.194; NGC~ Haas video "Alarm 332 H and T Not Matched" |
| 174 | TOOL LOAD EXCEEDED | Tool load in a feed exceeded the ATM limit (Setting 84 = ALARM). | Check the limit on CURRENT COMMANDS → Advanced Tool Management and the tool condition; reset the limit; clear. | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_174-0000.html |
| 362 | TOOL USAGE ALARM (CHC); current Haas video title "Tool Life Limit Reached" | Tool life limit reached (ATM). | Reset the usage count in CURRENT COMMANDS, then [RESET]. | CHC✓; NGC~ https://www.haascnc.com/mx/video/alarm-videos/alarm-362-tool-life-limit-reached.html (NGC text U) |
| 372 | Tool Change In Canned Cycle | M06 while a canned cycle is active. | Cancel the cycle (G80) first. | CHC✓ |
| 360 | Tool Changer Disabled | Changer disabled by parameter. | n/a | CHC✓ |
| (msg) | Tool release lockout | [TOOL RELEASE] pressed while Setting 76 = ON. No alarm; the key is ignored. | | NGC✓ OM20 p.453 |
| (prompt) | `XX changes the offset by more than Setting 142! Accept (Y/N)?` | Offset edit larger than S142. | Y / N. | NGC✓ OM20 p.461 |
| 385 | Invalid L, P, or R Code In G10 | Bad G10 offset write. | Fix G10. | CHC✓ |

## B.8 Program / G-code / M-code errors

| No. | Text (CHC wording unless noted) | Cause | Status / source |
|---|---|---|---|
| 302 | Invalid R In G02 or G03 | R smaller than half the chord (tolerance 0.0010 in). | CHC✓ p.62; SEC (forum: alarm 302 on a Haas VF4) |
| 303 | Invalid X, Y, or Z In G02 or G03 | Bad arc geometry. | CHC✓ |
| 304 | Invalid I, J, Or K In G02 Or G03 | Arc centre wrong: start and end radius differ by more than 0.001 in (0.01 mm). NGC page: "The center point of the arc is incorrectly defined." | NGC~ https://www.haascnc.com/service/alarm-search.alarm=ngc_304-0000.html; CHC✓ |
| 338 | Invalid IJK and XYZ in G02 or G03 | Circle definition problem. | CHC✓ |
| 305 | Invalid Q In Canned Cycle | Q ≤ 0. | CHC✓ |
| 306 | Invalid I, J, K, or Q In Canned Cycle | I/J/K/Q ≤ 0. | CHC✓ |
| 307 | Subroutine Nesting Too Deep | More than 9 nested subprograms (CHC limit). | CHC✓ |
| 309 | Exceeded Max Feed Rate | F too high. | CHC✓ |
| 310 | Invalid G Code | "G code not defined and is not a macro call". | CHC✓; SEC (Autodesk forum, Haas TM-1) |
| 311 | Unknown Code | Line not understood. | CHC✓ |
| 312 | PROGRAM END | End of subprogram reached without M99. | NGC✓ OM20 p.197; CHC✓ |
| 313 | No P Code In M97, M98, or G65 | Missing P. | CHC✓ |
| 314 | SUBPROGRAM NOT IN MEMORY (CHC: "Subprogram or Macro Not In Memory") | M98, G65 or G150 target not found (search order: program directory, then S251/S252). | NGC✓ OM20 p.379; CHC✓ |
| 315 | Invalid P Code In M97, M98 or M99 | Bad P (M98 P must be a program number without a decimal point; M99 P must be a valid N). | CHC✓ |
| 337 | GOTO or P line Not Found | N target not found. | CHC✓ |
| 322 | Sub Prog Without M99 | Called program has no M99. | CHC✓ |
| 320 | No Feed Rate Specified | Interpolation (G01/G02/G03) with no F. Haas video title "Alarm 320 - No Feed Rate". | NGC~ https://haascnc.com/sk/video/alarm-videos/alarm-320---no-feed-rate.html; CHC✓ |
| 324 | Delay Time Range Error | G04 P ≥ 1000 s. | CHC✓ |
| 326 | G04 Without P Code | | CHC✓ |
| 327 | No Loop For M Code Except M97, M98 | L on another M-code. | CHC✓ |
| 329 | Undefined M Code | Unknown M-code. | CHC✓ |
| 331 | Range Error | Number too large. | CHC✓ |
| 339 | MULTIPLE CODES | More than one M (or X, Y, Z, A, Q ...) in a block, or two G-codes from the same group. Also an M-code placed before G65 on the same line. | CHC✓ p.64; NGC~ Haas video "Alarm 339 Multiple Codes" https://www.haascnc.com/mx/video/alarm-videos/alarm-339-multiple-codes.html |
| 340 | Cutter Comp Begin With G02 or G03 | Comp must start on a linear move. | CHC✓ |
| 341 | Cutter Comp End With G02 or G03 | Comp must end on a linear move. | CHC✓ |
| 342 | Cutter Comp Path Too Small | | CHC✓ |
| 344 | Cutter Comp With G18 and G19 | Comp only in G17. | CHC✓ |
| 349 | Prog Stop W/O Cancel Cutter Comp | M00/M01/M02/M30 with G41/G42 active (OM20 p.200 states the rule). | CHC✓ |
| 350 | Cutter Comp Look Ahead Error | Too many non-motion blocks while comp is active. | CHC✓ |
| 367 | Cutter Comp Interference | Move impossible with this tool size (comp gouge). | CHC✓ p.65; SEC (Autodesk forum "367 Cutter Comp Interference") |
| 368 / 369 | Groove Too Small / Tool Too Big | Pocket or groove cycles. | CHC✓ |
| 370 | POCKET DEFINITION ERROR | G150 geometry not closed, or start point outside it. | NGC✓ OM20 p.211 |
| 371 | Invalid I, J, K, OR Q | G150. | CHC✓ |
| 378 / 379 | Skip Signal Found / Skip Signal Not Found | M78 / M79. | CHC✓ |
| 383 / 384 | Inch Is Not Selected / Metric Is Not Selected | G20/G21 does not match Setting 9. | CHC✓ |
| 386 | Invalid Address Format | Malformed address (closest match to "bad number format"). | CHC✓ |
| 243 | Bad Number | Entered data is not a number (input or edit context). | CHC✓ |
| 248 | Number Range Error | Number entry out of range. | CHC✓ |
| 348 | Motion Not Allowed In G93 Mode | G12, G13, G70-72, G150 or group-9 cycles in inverse-time mode. | CHC✓ |
| 365 | P Definition Error | P out of range (CHC: M59/M69 P1100-1155; the NGC range differs). | CHC✓ |
| 467 | (text not given) | **G02/G03 while Settings 188-190 scaling is in effect.** | NGC✓ number only (OM20 p.463); text U |
| (none) | **Invalid work offset** (e.g. G154 P out of range) | No dedicated alarm number found. | **U** |
| (none) | **Program not found** (main program) | A UI condition in the Device Manager, not an alarm. CHC has 436 Disk File Not Found. | **U** |
| (alarm) | Setting 36 restart on a comp-active line | Program restart started inside G41/G42. Number not given. | NGC✓ rule (OM20 p.448), number U |
| (alarm) | M48 wrong program for the loaded pallet / M48 nested | Number not given. | NGC✓ rule (OM20 p.418), number U |

## B.9 Unconfirmed items (settings and alarms)

1. NGC wording of 102 (SERVOS OFF vs SERVOS TURNED OFF) and 107 (EMERGENCY OFF vs EMERGENCY STOP).
2. No Haas alarm number found for "axis not homed / zero return required", hazardous vibration (Setting 245), "tool not in pocket", invalid work offset, main program not found, the Setting 36 restart-in-comp alarm, or the M48 alarm.
3. Every **CHC✓** text has a standard number shared with NGC per Haas, but its exact NGC wording was not seen. Affected: 121, 123, 130, 131, 133, 134, 149, 150, 151, 175, 237, 238, 243, 248, 255, 256, 266, 268, 291, 302-315 (except 304, 312, 314), 320-386, 390, 623-629.
4. The B/C axis-alarm prefixes `6.` and `7.` on a UMC-500 come from the generic table; the UMC-specific confirmation is missing.
5. Whether NGC RESET clears one alarm or all alarms per press (CHC: one).
6. Every **NGC~** item was seen through search-engine extracts of haascnc.com, not read directly (the site returns 403 to fetch tools).
7. Setting 267: target mode MDI (OM20) vs ZERO RETURN (current page).
8. The nature of the "jog limits" under Setting 53.
9. Settings 337-339 description seen only on the lathe page.
10. Settings 422, 424, 430, 431, 433: name only.
11. Setting 8: OM20 text contradicts itself.
12. Whether user travel limits (310-318) raise the x.316 alarm.
13. Alarm 467 text.
14. Alarm 362 NGC text ("TOOL LIFE LIMIT REACHED" per the video title).
