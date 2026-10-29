# Haas NGC Mill M-codes: behaviour spec (UMC-500 focus)

Behaviour spec for the M-code interpreter of the browser-based Haas NGC mill / UMC-500 trainer.
It covers what each M-code does, its parameters, when it runs relative to motion in the same block,
how it interacts with settings and alarms, and whether it matters on a UMC-500.

Related files: `settings-alarms.md` (setting numbers and alarm texts quoted here), plus the
pendant, operation, G-code and UMC-500 files.

## 0. Sources and legend

| Tag | Source | Notes |
|---|---|---|
| **[OM20]** | Haas *Mill Operator's Manual NGC*, 96-8210 Rev N, Dec 2020. https://www.haascnc.com/content/dam/haascnc/en/service/manual/operator/english---mill-ngc---operator's-manual---2020.pdf | `p.` = printed page number. PDF page = printed page + 22. M-code chapter: pp. 407-433. |
| **[WEB-M]** | Current online chapter "18 - Mill - M-Codes". https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---m-codes.html | Gives the **current code list**, which is newer than OM20. |
| **[CODE-Mxx]** | Per-code pages, e.g. https://www.haascnc.com/service/codes-settings.type=mcode.machine=mill.value=M70.html | haascnc.com returns HTTP 403 to fetch tools, so these were read **only through search-engine extracts**. Marked "(via search extract)". |
| **[UMC20]** | *UMC Series Operator's Manual Supplement NGC*, 96-8250, 2020. https://www.haascnc.com/content/dam/haascnc/en/service/manual/supplement/english---umc-operator%27s-manual-supplement---2020.pdf | |
| **[CHC02]** | Haas 96-8100 rev E (June 2002), *VF Series* service manual, alarm chapter. Classic control (CHC). Hosted at https://me.berkeley.edu/wp-content/uploads/2020/09/Haas-VF-Series-Product-Manual-2002.pdf (PDF pp. 52-73) | Used only for alarm texts. Haas states that standard (no-decimal) alarm numbers are shared by CHC and NGC, but the NGC wording may differ. |

Legend used in the tables:
- **Std / Opt**: Std = always present on an NGC mill; Opt = needs a purchased option or hardware; Acc = needs an accessory or automation cell.
- **UMC-500**: **Y** = simulate; **opt** = exists on a UMC-500 only with that option, so simulate as configurable; **n.a.** = not applicable to the machine; **?** = unconfirmed.
- **(U)** = unconfirmed. Section 9 lists every unconfirmed item.

---

## 1. Global rules (implement these first)

1. **One M-code per block.** [OM20 p.195, p.407] and [WEB-M] both say "Only one M-code is allowed per line of code."
   - Violation raises **Alarm 339 MULTIPLE CODES**. The CHC02 description reads: only one M, X, Y, Z, A, Q etc. per block, and only one G-code per group.
   - The NGC G65 page (via search extract) also says that an M-code placed *before* G65 on the same line gives "Alarm 339 Multiple codes". An M-code is allowed *after* G65.
   - M-codes may share a block with G-codes, axis words, S, T, F, etc. OM20's own samples do this, e.g. `G00 Z0.1 M09`, `G53 G49 Z0 M05`, `S1000 M03`, `M89 G80`.
2. **All M-codes take effect at the end of the block.** [OM20 p.407] and [WEB-M] state this. The simulator should run the block's motion first and the M-function second. Section 2 lists the documented nuances.
3. **Format**: the letter M followed by two to three digits. Haas writes leading zeros (`M03`), and `M3` is accepted in practice; OM20 samples use `T1 M6`. Parse M as an integer and ignore leading zeros.
4. **GOTO vs M-codes in the same block**: "The GOTO is executed after any other commands like M codes" [OM20 p.284].
5. **Undefined M-code**: CHC02 gives **329 UNDEFINED M CODE** ("That M code is not defined and is not a macro call"). An L count on any M-code other than M97/M98 gives **327 NO LOOP FOR M CODE EXCEPT M97, M98** [CHC02]. NGC wording for both is (U).
6. **Look-ahead stoppers** [OM20 p.150, p.411]. The control looks ahead up to 80 blocks. These items stop look-ahead and prevent side-mount (SMTC) tool pre-call:
   - work-offset G-codes (G54 etc.)
   - G103 without P, or with a nonzero P
   - M00 and M01
   - block-delete slashes `/`
   - a large number of blocks executed at high speed

   The simulator needs this only if it models pre-call timing. A block that starts with `/` stops look-ahead even when Block Delete is off [OM20 p.250].
7. **Cutter compensation must be cancelled** before M00, M01, M02 or M30 [OM20 p.200]. CHC alarm **349 PROG STOP W/O CANCEL CUTTER COMP**.
8. **[FEED HOLD]** stops rapid and feed moves, tool changes and part timers. It does **not** stop tapping cycles or dwell timers [OM20 p.49]. The same page covers door opening while Setup Mode is unlocked: the display shows "Door Hold", and after the door closes the control stays in feed hold until [CYCLE START] is pressed.
9. **Program restart** (Setting 36 ON) scans the program. The only M-codes it processes are M08, M09, M41, M42, M51-M58 and M61-M68 [OM20 p.448-449].
10. **Optional macro aliasing** (M-codes that call O9xxx macro programs) exists on Haas controls but is out of scope here (U).

## 2. Timing relative to motion in the same block

| Code(s) | When it acts | Source / note |
|---|---|---|
| All M-codes (default) | After the block's axis motion completes | [OM20 p.407] |
| M00, M01, M02, M30 | After the motion. The program pointer stops on the next block (M00/M01) or the same block (M02), or rewinds (M30). | [OM20 p.196, 410] |
| M03 / M04 + S in the same block | The spindle starts at the end of the block, at the S in that block. With motion in the same block, motion happens first (per the end-of-block rule). | Rule [OM20 p.407]; real-machine overlap under look-ahead is (U) |
| M05 | Stops the spindle and **waits for it to stop** before the program continues | [OM20 p.196, 410] |
| M06 / M16 | Runs its own motion sequence (Z retract, orient, swap; see section 5.3) after any motion in the block | Behaviour with X/Y words in the M06 block is (U). Simplest approach: execute the motion, then the tool change. |
| M19 | After motion. Orients and then continues. | |
| M59 Pn | At the end of the line. The macro equivalent `#12090=1` acts immediately during look-ahead. | [OM20 p.418] |
| M69 Pn | OM20 says it is processed "in the same order as axis motion", i.e. synchronised with motion, unlike the macro write | [OM20 p.419]. Treat it as end-of-block. |
| M78 / M79 | May be on the same line as the skip G-code (G31/G36/G37) or in any later block. Evaluated after the skip move. | [OM20 p.420-421] |
| M88 / M89 | The control **stops the spindle first**, then switches TSC. It does not restart the spindle after M89. | [OM20 p.421] |
| M97 / M98 / M99 | Program-flow change after the block's other actions | Rule 4 above |
| M162 | Non-blocking: later code runs immediately | [OM20 p.432] |

## 3. Machine-state groups (implementation grouping)

Haas does not publish M-code modal groups. The simulator still needs these state variables. Each is set by the codes listed and reset by the events shown.

| State | Set / cleared by | Also cleared by |
|---|---|---|
| `spindle` ∈ {CW, CCW, STOP, ORIENTED} | M03 / M04 / M05 / M19 | M00, M01 (when active), M02(U), M30, M06, M88/M89 (stops it), E-stop, RESET (U) |
| `spindleSpeedCmd` | S word | M41/M42 override until the next S (gearbox machines only) |
| `coolant` (flood) | M08 [P0-2] / M09 | M00, M01, M30, M06, Setting 197 idle timeout, Setting 32 IGNORE (commands ignored) |
| `showerCoolant` | M07 / M09 | auto-off at tool or pallet change, auto-restored after the change |
| `tsc` | M88 / M89 | M00, M01, M30, M06 |
| `tab` / `aag` / `mql` | M73/M74, M83/M84 (or M83 Pms), M140-M142 | M00 |
| `brake4` (B on UMC) / `brake5` (C on UMC) ∈ {CLAMPED, RELEASED} | M10/M11, M12/M13 | the control releases and re-applies automatically around rotary moves; see 5.5 |
| `ssv` (+P, E) | M138 / M139 | M30, RESET, E-stop |
| `conveyor` | M31 / M33 | Setting 196 idle timeout |
| `relays[]` | M51-M55 / M61-M65, M59/M69 | RESET turns M51-M55 relays off |
| `mediaTab` | M130 / M131 | |
| `viseCheckDisabled[P]` | M70/M71 with Q1 | power cycle, M02/M30, alarm, RESET, further workholding commands |

---

## 4. Master table (current NGC list plus the codes requested)

"1/blk" = the one-M-per-block rule applies (true for every code). Pages refer to [OM20].

| Code | Exact name (WEB-M) | Std/Opt | UMC-500 | Params | Summary | p. |
|---|---|---|---|---|---|---|
| M00 | Stop Program | Std | Y | - | Stops axes, spindle and all coolants; CYCLE START resumes at the next block | 410 |
| M01 | Optional Program Stop | Std | Y | - | Same as M00 when [OPTION STOP] is on; Setting 17 can lock the feature out | 410 |
| M02 | Program End | Std | Y | - | Ends the program; the pointer stays at the M02 block | 410, 196 |
| M03 | Spindle Forward Command (WEB-M spells it "Foward") | Std | Y | S | Spindle CW at S rpm | 410 |
| M04 | Spindle Reverse Command | Std | Y | S | Spindle CCW | 410 |
| M05 | Spindle Stop Command | Std | Y | - | Stop, then wait for zero speed | 410 |
| M06 | Tool Change | Std | Y | T | Full tool-change sequence (section 5.3) | 411 |
| M07 | Shower Coolant On | Opt | ? | - | Shower coolant; M09 turns it off | 412 |
| M08 / M09 | Coolant On / Off | Std (OM20 calls the coolant supply "optional") | Y | M08 P0/P1/P2 | Flood coolant; P = pressure level on VFD pumps | 412 |
| M10 / M11 | Engage / Release 4th Axis Brake | Opt (built-in on UMC) | **Y: B-axis brake** | - | Section 5.5 | 413 |
| M12 / M13 | Engage / Release 5th Axis Brake | Opt (built-in on UMC) | **Y: C-axis brake** | - | Section 5.5 | 413 |
| M16 | Tool Change | Std | Y | T | Same as M06; M06 is preferred | 413 |
| M19 | Orient Spindle | Std (P/R values need the Spindle Orientation option) | Y | P (deg, integer) or R (deg, 2 dp) | Orient spindle | 413 |
| M21-M25 | Optional User M Function with M-Fin | Std relays | opt | - | Close relay, wait for M-Fin | 414 |
| M29 | Set Output Relay with M-Fin | Std | opt | P 0-255 | Relay on, wait for M-Fin, relay off | 415 |
| M30 | Program End and Reset | Std | Y | - | End, stop spindle and coolant, rewind | 415 |
| M31 | Chip Conveyor Forward | Opt | opt | - | Conveyor forward; Settings 114/115 cycle | 416 |
| M33 | Chip Conveyor Stop | Opt | opt | - | Conveyor stop | 416 |
| M34 / M35 | Coolant Increment / Decrement | Opt (P-Cool) | ? | P (no decimal) | P-Cool spigot position | 416 |
| M36 | Pallet Part Ready | Opt (pallet changer) | n.a.* | - | Waits for [PART READY] | 417 |
| M39 | Rotate Tool Turret | Std (SMTC) | Y (diagnostic) | T (pocket) | Rotate SMTC carousel; Setting 86 lockout | 417 |
| M41 / M42 | Low / High Gear Override | gearbox only | **n.a. (U)**: UMC20's UMC-500 spec table does not state the spindle drive type. Haas markets the UMC-500 with an inline direct-drive spindle, which has no gearbox (not verified in these sources). | - | Hold gear until the next S | 417 |
| M46 | Qn Pmm Jump to Line | Opt (pallet) | n.a.* | Q pallet, P line | Jump if pallet n is loaded | 418 |
| M48 | Validate That The Current Program is Appropriate for Loaded Pallet | Opt (pallet) | n.a.* | - | Alarm if the PST does not match | 418 |
| M50 | Pallet Change Sequence | Opt (pallet) | n.a.* | P pallet (optional) | Pallet change | 418 |
| M51-M55 | Set Optional User M-codes | Std relays | opt | - | Relay on (latched) | 418 |
| M59 | Set Output Relay | Std | opt | P | Discrete output on | 418 |
| M61-M65 | Clear Optional User M-codes | Std relays | opt | - | Relay off | 419 |
| M69 | Clear Output Relay | Std | opt | P | Discrete output off | 419 |
| M70 / M71 | Workholding Clamp / Unclamp | Opt | opt | P1-P8 vise, Q0/Q1 | Clamp or unclamp the configured vise | 420 |
| M73 / M74 | Tool Air Blast (TAB) On / Off | Opt | opt | - | TAB | 420 |
| M75 | Set G35 or G136 Reference Point | Opt (probing) | opt | - | Set the reference after probing | 420 |
| M78 | Alarm if Skip Signal Found | Opt (probing) | opt | - | Alarm 378 (CHC) if the probe triggered | 420 |
| M79 | Alarm if Skip Signal Not Found | Opt (probing) | opt | - | Alarm 379 (CHC) if the probe did not trigger | 421 |
| M80 / M81 | Auto Door Open / Close | Opt | opt | - | Needs Setting 131 and a cell-safe signal | 421 |
| M82 | Tool Unclamp | Std (maintenance) | Y | - | Release tool (test only) | 421 |
| M83 / M84 | Auto Air Gun On / Off | Opt | opt | M83 P (ms) | AAG | 421 |
| M86 | Tool Clamp | Std (maintenance) | Y | - | Clamp tool (test only) | 421 |
| M88 / M89 | Through-Spindle Coolant On / Off | Opt | opt | - | TSC; spindle stopped first | 421 |
| M90 / M91 | Fixture Clamp Input On / Off | Std (needs Setting 276) | opt | - | Enable or disable clamp-input monitoring | 422 |
| M95 | Sleep Mode | Std | Y | comment `(hh:mm)` | Long dwell | 422 |
| M96 | Jump If No Input | Std | Y | P block, Q input 0-255 | Branch if input = 0 | 423 |
| M97 | Local Sub-Program Call | Std | Y | P (N number), L 1-99 | Local subprogram | 424 |
| M98 | Sub-Program Call | Std | Y | P (O number) or `(<path>)`, L 1-99 | External subprogram | 424 |
| M99 | Sub-Program Return or Loop | Std | Y | P (N number, optional) | Return, jump or loop | 425 |
| M104 / M105 | Probe Arm Extend / Retract | Opt | ? (mostly lathe hardware) | - | Tool-setting probe arm | 426 |
| M109 | Interactive User Input | Std (U) | Y | P 500-549 / 10500-10549 | Wait for a key into a macro variable | 426 |
| M116 / M117 | Vise Air Chips Blast On/Off | Opt | opt | - | (WEB-M; CODE-M116 via search extract) | - |
| M130 / M131 | Display Media / Cancel Display Media | Std | Y | `(file)` + optional `(caption)` | Show image or video in the Media tab | 428 |
| M138 / M139 | Spindle Speed Variation On/Off | Std (U) | Y | P rpm, E sec | SSV | 430 |
| M140 / M141 / M142 | MQL On Continuous / On Single Squirt / Stop MQL | Opt | ? | - | OM20 only; **not in the current WEB-M list** | 430 |
| M158 / M159 | Mist Condenser On/Off | Opt | opt | - | Mist condenser | 431 |
| M160 | Cancel Active PulseJet | Opt | opt | - | | 431 |
| M161 | PulseJet Continuous Mode | Opt | opt | P 1-99 s | Pulses during feed moves | 431 |
| M162 | PulseJet Single Event Mode | Opt | opt | P 1-99 pulses | Non-blocking | 431 |
| M163 | PulseJet Modal Mode | Opt | opt | P 1-99 per hole | Pulses in canned cycles; cancelled by G80 | 432 |
| M180 / M181 | Auto Window Open / Close | Opt | ? | - | WEB-M list only; details (U) | - |
| M199 | Pallet / Part Load or Program End | Opt (pallet / APL) | n.a.* | - | Acts as M30 in MEM/MDI, as M50+M99 in PST mode | 433 |
| M300 | M300 - APL/Robot Custom Sequence | Acc | n.a. | P alias, R0, Q0 | APL/robot sequence | - |

\* A UMC pallet pool exists as an option (a separate Haas supplement). Treat pallet codes as out of scope unless the UMC file adds a pallet pool.

---

## 5. Detailed behaviour

### 5.1 Program stop / end: M00, M01, M02, M30, M95, M199

**M00 Stop Program** [OM20 p.410; p.196]
- Stops axes, spindle and coolant, including TSC, Through-Tool Air Blast and Auto Air Gun/MQL.
- The block after M00 becomes highlighted. [CYCLE START] continues from there.
- Stops look-ahead, so there is no SMTC tool pre-call across an M00 [p.150].
- With Setting 39 ON, the beeper sounds until a key is pressed [p.449].
- With Setting 131 (Auto Door) ON, the door opens once the spindle has stopped [p.460].
- Does **not** cancel G234 (TCPC) or G254 (DWO) [UMC20 p.20, p.24].
- Whether CYCLE START restores the spindle and coolant automatically is (U). Recommended for the trainer: do not auto-restart; programs re-command S/M03 and M08 after an M00.

**M01 Optional Program Stop** [p.410]
- Identical to M00 when Optional Stop is active ([OPTION STOP] key toggles it).
- Otherwise it is ignored, but it still stops look-ahead.
- Setting 17 ON makes the Optional Stop feature unavailable, so M01 never stops.
- The Setting 39 beep and Setting 131 door opening apply only when Optional Stop is on.

**M02 Program End** [p.410, p.196]
- Ends the program. The pointer **remains at the M02 block**; contrast M30, which rewinds.
- Cancels G234 and G254 [UMC20].
- Spindle and coolant stop on M02 are not explicitly documented in OM20 (U); recommended: same as M30.

**M30 Program End and Reset** [p.415, p.196]
- Stops the program and the spindle, turns off coolant including TSC, and returns the cursor to the start of the program.
- Since software 100.16.000.1041, M30 **no longer cancels tool length offsets** [p.415].
- Increments M30 Counter #1 and #2 (macro #3901 / #3902) [p.53, p.67; CURRENT COMMANDS > Timers & Counters].
- Cancels G234 and G254 [UMC20] and SSV/M138 [p.430]. Restores the vise unclamp check (M71 Q1) [CODE-M70 via search extract].
- Behaviour that depends on settings:
  - S2 ON: power-off sequence with a 15 s warning; any key aborts it.
  - S39 ON: beep.
  - S56 ON: modal G-codes return to their defaults.
  - S83 ON: feed, spindle and rapid overrides return to 100%.
  - S131 ON: auto door opens after the spindle stops.
  - S33 = FANUC: the G52 shift is cleared.
- Cutter compensation must already be cancelled (Alarm 349, CHC).

**M95 Sleep Mode** [p.422]
- A long dwell. The format is `M95 (hh:mm)`: the comment *immediately* after M95 holds the sleep duration.
- Example: `M95 (12:30)` sleeps 12 h 30 min. The lines after it should be warm-up moves.
- CHC alarm **268 DOOR OPEN @ M95 START** if the door is open when M95 is reached. NGC wording is (U).

**M199 Pallet / Part Load or Program End** [p.433]
- Replaces M30/M99 at program end. In MEM or MDI it behaves exactly like M30.
- When run from the Pallet Schedule Table, it acts as M50 + M99: it loads the next scheduled pallet and program and continues.

### 5.2 Spindle: M03, M04, M05, M19, M41/M42, M138/M139

**M03 / M04 / M05** [p.410; p.196]
- M03 runs the spindle CW and M04 CCW, at the S address speed (rpm, up to machine maximum). M05 stops the spindle and **waits for it to stop**.
- Speed limits:
  - **S291** Main Spindle Speed Limit: a nonzero value caps the speed.
  - **S292** Door Open Spindle Speed Limit: caps the speed while the door is open.
- Overrides:
  - S20 locks out spindle override.
  - S144 ON applies the feed override to the spindle as well and disables the spindle override keys.
  - The [HANDLE SPINDLE] key adjusts the override in 1% steps; the +10% / -10% / 100% keys work as labelled [p.48].
- Workholding:
  - **M90 + S276**: a spindle start while the clamp input indicates "not clamped" gives **973 FIXTURE CLAMP INCOMPLETE** [p.422].
  - **S389 / M70-M71**: spindle start with an unclamped vise alarms unless the check is disabled with `M71 Pn Q1` [CODE-M70 via search extract].

**M19 Orient Spindle (optional P and R)** [p.413-414]
- `P` = integer degrees, 0-360. `R` = degrees with two decimals, 0.00-360.00. Examples: `M19 P270.`, `M19 R123.45`.
- **A negative value is ignored and the spindle orients to 0°.**
- Without the M19 orient option the spindle can only orient to the zero position.
- The orient state ends when a spindle start is commanded (U for the exact release semantics).

**M41 / M42 Low / High Gear Override** [p.417]
- Gearbox machines only. Program them with S before M03, e.g. `S1200 M41` then `M03`.
- The gear reverts at the next S command; the spindle does not have to stop.
- On a machine without a gearbox, treat these as **no-op** (U: whether they raise an alarm). CHC alarm 361 "Gear Change Disabled" exists.

**M138 / M139 Spindle Speed Variation** [p.430]
- SSV varies the spindle speed ±P rpm around the command with a cycle of E seconds.
- Defaults come from **Setting 165** (variation, rpm) and **Setting 166** (cycle, s); `P` and `E` on M138 override them.
- Examples: `M138 P500 E1.5`, `M138 P500` (E from S166), `M138 E1.5` (P from S165).
- An `E` on a G187 line applies only to G187 and does not touch SSV.
- M138 is independent of spindle commands: it stays active while the spindle is stopped.
- Active until **M139, M30, RESET or E-stop**.

### 5.3 Tool change: T address, M06, M16, M39, M82, M86

**T address** [p.195-196; p.150]
- `Tnn` alone selects the next tool. It does not start a change.
- On a side-mount changer (the UMC-500 has an SMTC), a T word after a tool change pre-positions the carousel ("pre-call"), e.g. `T1 M06` then `T2`.
- Without an explicit T pre-call, look-ahead pre-calls the next tool unless a look-ahead stopper intervenes (section 1, rule 6).

**M06 Tool Change (T = tool number)** [p.411; p.196; p.150-152; S247/S293-298; UMC20 p.33]

The simulator should model this sequence. Steps marked (U) are plausible but not documented.

1. **Validate.** T must be a valid tool number (CHC **328 INVALID TOOL NUMBER**). Further checks:
   - **372 TOOL CHANGE IN CANNED CYCLE** if a canned cycle is active [CHC].
   - The tool must exist in the pocket-tool table.
   - Pockets designated `0` are never used.
   - The spindle entry may never be tool 0 [p.148].
2. **Setting 87** ON: overrides reset to programmed values (100%). This applies to programmed changes only, not [ATC FWD]/[ATC REV] [p.457].
3. **Stop spindle and coolant**, including TSC and, implicitly, TAB [p.411]. Shower coolant M07 is also turned off but is **restored after** the change if it was on [p.412].
4. **Axis moves** (setting-dependent):
   - a. If any **Tool Change Mid Position** (Settings 293-298, X/Y/Z/A/B/C) is active, the axes first go there. This applies to every tool change, including [NEXT TOOL] and [ATC FWD] [p.476-479].
   - b. **Z goes to the tool change position**, i.e. machine zero. On VMCs X and Y can be anywhere [p.196]. "The control moves the Z Axis to a position above machine zero during a tool change, but it never moves below machine zero. At the end of a tool change, the Z Axis is at machine zero" [p.196].
   - c. **Setting 247** OFF (default; strongly recommended on UMC): Z retracts first, then X/Y move. ON: X/Y/Z move simultaneously, with crash risk because of B/C [p.465; UMC20 p.33].
   - Whether a UMC-500 moves X/Y (or B/C) to a fixed tool-change position by machine parameter is (U); see the UMC-500 file. Current Settings 337-339 "Safe Tool Change Location X/Y/Z" appear in the User Positions tab [WEB settings]. Their detailed text was found only on the lathe page: a safe position the axes visit before their final tool-change positions (U for the mill).
   - **M06 ignores TCPC and DWO**: the tool-change motion is not transformed by G234/G254 [UMC20 p.20, p.24].
5. **Spindle orient** to the tool-change angle (automatic; the program need not command M19) [p.411].
6. **SMTC swap** (UMC-500):
   - The carousel is already at the pocket of the requested tool if pre-called; otherwise it rotates there first, and this wait is the delay that pre-call avoids.
   - Pocket down, arm rotates and grips both tools, drawbar unclamps, arm extracts, rotates 180°, inserts, drawbar clamps, arm returns, pocket up.
   - The sub-step order is mechanical background and (U) at fine level.
   - High-speed SMTC: tools flagged heavy (`H`, `h`) change at **max 25% speed**; the pocket up/down speed is not slowed [p.148].
   - Opening the SMTC cage door pauses the change and it resumes on close; the same applies to the MANUAL switch on machines with a door-switch panel [p.152].
7. **Z ends at machine zero.** No G43 is applied automatically. If **Setting 15** is ON, a later H that differs from the spindle tool gives **332 H AND T NOT MATCHED** (H00 is exempt) [p.194, 445].
8. **Setting 42** ON: the program stops after the tool change with a message; [CYCLE START] continues [p.449].
9. Flood coolant and TSC are **not** documented as auto-restored (only shower coolant is). The trainer should require re-commanding M08/M88 (U).

Other M06 notes:
- [FEED HOLD] stops a tool change in progress [p.49].
- With **Setting 113** = Manual, the machine stops at the tool change and prompts the operator to load the tool; [CYCLE START] continues [p.459].
- Requested tool already in the spindle: behaviour (U). Recommended: no swap, no Z move.
- A failed change requires **[RECOVER] → TOOL CHANGER RECOVERY**: automatic (A), then manual (M) if the automatic step fails [p.151].

**M16** behaves the same as M06; M06 is preferred [p.413].

**M39 Rotate Tool Turret** [p.417]
- Rotates the SMTC carousel without a tool change. Program the pocket as `Tn` before M39.
- Intended for diagnostics and crash recovery. **Setting 86 (M39 Lockout)** ON makes the control ignore M39.

**M82 Tool Unclamp / M86 Tool Clamp** [p.421]
- Release or clamp the drawbar. For maintenance and test only; programs must use M06.
- [TOOL RELEASE] key equivalent; Setting 76 locks that key out.

### 5.4 Coolant, air, lubrication: M07, M08/M09, M34/M35, M88/M89, M73/M74, M83/M84, M116/M117, M140-M142, M158/M159, M160-M163

- **M07 Shower Coolant On** [p.412]
  - M09 stops shower *and* standard coolant.
  - Shower coolant stops automatically before a tool or pallet change and restarts afterwards if it was on.
  - Some machines use relay codes (e.g. M51/M61) instead.
- **M08 Coolant On / M09 Coolant Off** [p.412]
  - `M08 Pn` sets the pressure on machines with a variable-frequency coolant pump: **P0 = low, P1 = normal, P2 = high**. With no P, or P out of range, normal pressure is used. The P works only if no other G-codes are in the block. Without the VFD pump, P is ignored.
  - The default pressure comes from **Setting 409** (0/1/2).
  - **The coolant level is checked only at program start**, so low coolant does not stop a running program.
  - **Setting 32**:
    - NORMAL: the key and M-codes both work.
    - OFF: the key shows FUNCTION LOCKED and a programmed M08/M09 raises an alarm (CHC **363 COOLANT LOCKED OFF**).
    - IGNORE: programmed coolant commands are ignored; the key still works.
  - The [COOLANT] key override persists until the next M-code or operator action [p.49].
  - **Setting 197**: coolant turns off after N idle minutes.
- **M34 / M35 Coolant Increment / Decrement (P-Cool)** [p.416]
  - Without P: move the spigot one position away from or toward home.
  - `M34 Pnn` / `M35 Pnn` go to absolute position nn, and either code can be used for that.
  - P must be written without a decimal point.
- **M88 / M89 Through-Spindle Coolant** [p.421]
  - The control stops the spindle before executing either code and does not restart it after M89.
  - Program M88 **before** the S/M03. If M88 comes after the spindle start, the spindle starts, stops, TSC turns on, then the spindle restarts.
  - CHC 151 LOW THRU SPINDLE COOLANT (U on NGC).
- **M73 / M74 Tool Air Blast On / Off** [p.420].
- **M83 / M84 Auto Air Gun On / Off** [p.421]
  - `M83 Pnnn` turns the air gun on for nnn **milliseconds**, then off.
  - Manual control: [SHIFT] + [COOLANT].
- **M116 / M117 Vise Air Chips Blast On / Off** [WEB-M; CODE-M116 via search extract].
- **M140 / M141 / M142 MQL** [p.430]: continuous on, timed single squirt, off. Listed in OM20 but **absent from the current WEB-M list**.
- **M158 / M159 Mist Condenser On / Off** [p.431]
  - The condenser runs continuously while a program with axis motion is running.
  - M158 in MDI runs it for only 10 s.
  - Current Setting 424 is "Mist Extractor Condenser Time Out" (details U).
- **PulseJet** [p.431-432]
  - **M160** cancels the active PulseJet code.
  - **M161 [Pnn]** (1-99 s interval) pulses whenever a feed move is active; duty cycle from **Setting 369**.
  - **M162 [Pnn]** (1-99 pulses) is a single event and **non-blocking**; count from **Setting 370**.
  - **M163 [Pnn]** (1-99 per hole) is modal for canned drill, tap and bore cycles. It is **cancelled with the canned cycle** (G80 etc.).

### 5.5 Rotary brakes: M10-M13 (UMC-500 B/C)

[OM20 p.413, p.245; Haas UMC brake bleed procedure AD0496 / T-0062 (via search extract)]

| Code | Generic meaning | On UMC-500 (B/C trunnion) |
|---|---|---|
| M10 | Engage 4th-axis brake | **Clamp B-axis (tilt) brake** |
| M11 | Release 4th-axis brake | **Unclamp B-axis brake** |
| M12 | Engage 5th-axis brake | **Clamp C-axis (rotary) brake** |
| M13 | Release 5th-axis brake | **Unclamp C-axis brake** |

Mapping evidence: Haas's UMC brake bleed procedure has the operator command `M11` in MDI to unclamp the **B-axis** brake and `M10` to clamp it. The C-axis procedure references `M13`. Both were seen only via search extract, so the mapping is confirmed by Haas text that was not read directly. On UMC machines the 4th axis is B and the 5th is C.

Behaviour:
- Brakes are **normally engaged**. M10/M12 are needed only after an M11/M13 [p.413].
- For an ordinary rotary move with brakes engaged, the control releases the brake, moves, and re-applies it. This causes **a pause between blocks** in 4/5-axis cuts. To avoid it, program **M11 and/or M13 before G93**; the brakes then stay off "indefinitely" until re-engaged [p.245].
- Haas: engage the brakes for any non-5-axis cutting; cutting with brakes off wears the gear sets [p.245].
- The pendant shows a **Brake icon** for clamped or unclamped state [OM20 icons p.93-94].
- Whether RESET or M30 re-engages a released brake is (U). Recommended: re-engage at M30, RESET and E-stop, and log it.

### 5.6 Relays and discrete I/O: M21-M25, M29, M51-M55, M59, M61-M65, M69, M90/M91, M96

[p.414-419, 422-423]

**M21-M25**
- Each closes one built-in user relay and **waits for M-Fin** (input 18). Only one relay switches at a time.
- [RESET] aborts the wait.
- Built-in relay output numbers:

| Code | Output | Code | Output |
|---|---|---|---|
| M21 | P114 | M24 | P113 |
| M22 | P115 | M25 | P112 |
| M23 | P116 | M26 | P4 (OM20 table only) |

**M29 Pn** (n = 0-255): relay on, pause, wait for M-Fin, then relay off and continue. [RESET] aborts.

**M51-M55 / M61-M65**: latch a built-in relay on or off. [RESET] turns all of them off.

Range discrepancy:
- OM20 headings say M51-**M56** / M61-**M66**, while the text and [WEB-M] say M51-M55 / M61-M65.
- Setting 36 lists M51-**M58** / M61-**M68**.
- Implement **M51-M55 / M61-M65** and treat M56-M58 / M66-M68 as (U).

**M59 Pn / M69 Pn**: turn a discrete output on or off.
- 8M relay banks are addressed only with M29/M59/M69 and P codes. First bank P90-P97; then P103-P110 and P79-P86 [p.418-419].
- OM20 has an inconsistent example, `M69 P12nnn`. Accept P 0-255 and also tolerate 12nnn (U).
- CHC alarm 365 P DEFINITION ERROR covers an out-of-range P. The CHC range (1100-1155) differs from NGC.

**M90 / M91**: enable or disable fixture-clamp input monitoring.
- Needs **Setting 276** set to a valid input number (>0).
- If the monitored input (variable #709 / #10709) = 1 and the spindle is commanded on, the control raises **973 FIXTURE CLAMP INCOMPLETE** [p.422].

**M96 Pnnnn Qnn**: if discrete input Q (0-255) is **0**, jump to block `Nnnnn` in the same program; otherwise continue [p.423].

### 5.7 Subprograms and flow: M97, M98, M99

[p.424-426; p.211-216; p.282-284]

**M97 Pnnnn [Lnn]**: local subprogram.
- P is an N number in the **same program**. The subprogram sits after M30 and ends with M99.
- L repeats the call 1-99 times.
- Missing P gives CHC 313 NO P CODE IN M97, M98, OR G65. An N that is not found gives CHC 315 INVALID P CODE IN M97, M98 OR M99 or 337 GOTO OR P LINE NOT FOUND (U which one NGC uses).

**M98 Pnnnn [Lnn]** or **M98 (<path>/Onnnnn.nc) [Lnn]**: external subprogram.
- Search order:
  1. the main program's directory
  2. the location in **Setting 251** (Memory root, USB root, or the Setting 252 path list)
- An external file must be named `Onnnnn.nc` with the O, leading zeros and `.nc`.
- Not found: **314 SUBPROGRAM NOT IN MEMORY** [OM20 p.379 wording "Subprogram Not In Memory"; CHC text "Subprogram or Macro Not In Memory"].
- The subprogram must end with M99. Otherwise **312 PROGRAM END** [p.197] (CHC also has 322 SUB PROG WITHOUT M99).

**Nesting**: CHC limit is 9 levels (**307 SUBROUTINE NESTING TOO DEEP**). The NGC limit is (U); use 9.

**M99**: three uses.
1. At the end of a subprogram, local subprogram or macro: return to the block **after** the call. If L > 1, repeat first. The display shows "Loops Remaining".
2. **`M99 Pnn`**: unconditional jump to `Nnn` **in the current program**. It does *not* return to the caller [p.282]. The "Haas" example on p.425-426 shows that to resume the caller at N100, the caller itself contains `N51 M99 P100` after the `M98` (Fanuc-style return emulation).
3. M99 in a **main** program loops back to its start and runs until [RESET].
   - **Setting 118** ON: each main-program M99 increments the M30 counters (not M99 in subprograms).
   - With macros: `N50 [#10000 LT 10] M99 P10` is a conditional branch.
   - `/M99` combined with Block Delete lets one file act as main or subprogram [p.250].

### 5.8 Probing: M75, M78, M79, M104/M105

- **M75**: set the G35/G136 reference point; it must come after a probing function [p.420].
- **M78**: alarm if a skip (G31/G36/G37) *did* receive a probe signal, i.e. an unexpected touch or possible crash. CHC **378 SKIP SIGNAL FOUND**.
- **M79**: alarm if the skip did *not* receive a signal (positioning error). CHC **379 SKIP SIGNAL NOT FOUND**.
- M78 and M79 may be on the same line as the skip G-code or in any later block [p.420-421].
- **M104 / M105**: extend or retract the optional tool-setting probe arm [p.426].

### 5.9 Doors, workholding, windows: M80/M81, M70/M71, M180/M181

**M80 / M81 Auto Door Open / Close** [p.421; S131 p.460]
- The pendant beeps while the door moves. Requires **Setting 131 = ON**.
- The codes work only with a **cell-safe signal from a robot** (OM20) or an enabled light curtain.
- Otherwise: **548 DOOR M CODES NOT ALLOWED** [Haas CAN/DC autodoor troubleshooting guide, via search extract]. CHC equivalent: 346 ILLEGAL M CODE.
- Automatic behaviour with S131 ON: the door closes on [CYCLE START] and opens at M00, M01 (Optional Stop on), M02 or M30 once the spindle stops.

**M70 / M71 Workholding Clamp / Unclamp** [p.420; CODE-M70/M71 via search extract]
- `P1`-`P8` selects the vise; with no P, vise 1.
- `Q0` or no Q leaves the "vise unclamped while spindle on" check enabled; `Q1` disables it (e.g. `M71 P1 Q1`).
- The check is restored by power cycle, M02/M30, an alarm, RESET or further workholding commands.
- **Setting 389** (Vise Unclamped Safety Check) affects whether M71 during spindle rotation alarms. The M71 page says M71 itself is not affected by S389 (U on the exact matrix).

**M180 / M181 Auto Window Open / Close**: in the current WEB-M list only; behaviour (U).

### 5.10 Pallet codes: M36, M46, M48, M50, M199 (n.a. on a standard UMC-500)

[p.417-418]
- **M36**: wait for [PART READY]. The pallet change occurs after [PART READY] is pressed and the doors are closed.
- **M46 Qn Pmm**: jump to line mm if pallet n is loaded.
- **M48**: alarm if the current program is not assigned to the loaded pallet in the PST. Allowed in the PST program, never in its subroutines.
- **M50 [Pn]**: pallet change; Pn selects a specific pallet (pallet pool).
- **M199**: see 5.1.

### 5.11 Operator interaction and media: M109, M130/M131

**M109 Pnnn** [p.426-428]
- Shows the comment as a prompt and stores the **ASCII code** of the next key pressed into macro variable P (500-549 or 10500-10549). The variable is 0 until a key is pressed.
- Programs typically loop until the variable is nonzero.
- With WIPS installed, use 500-539 only. OM20's note on reserved ranges is internally inconsistent; it says both "540-599" and "10549-10599".
- Needs the macro option for the IF/GOTO logic around it (U whether M109 itself requires macros).

**M130 (file.ext) [(caption)]** [p.428-429]
- Shows an image or video in the Media tab under CURRENT COMMANDS. Formats: **MP4, MOV, PNG, JPEG**; recommended maximum 1920×1080.
- Uses the Setting 251/252 search like M98. **Setting 416** can send media to an external HDMI monitor.
- The media stays until the next M130 or an **M131** clears it.

### 5.12 Automation: M300

**M300 Pn**: runs APL/robot custom sequence n (alias from the custom-sequence tab). `R0` runs it in reverse, ignoring non-robot commands. `Q0` runs it in the background [CODE-M300 via search extract]. n.a. for the trainer unless an APL is modelled.

---

## 6. Codes asked about that are not in the current NGC mill list

| Code | Status |
|---|---|
| M26 | Appears only in OM20's relay table ("P4 (M26)"); not in WEB-M. (U) |
| M27, M28 | Not in OM20 or WEB-M. Do not implement; treat as undefined (Alarm 329 CHC). |
| M32 | Not listed. NGC lists only M31 forward and M33 stop for the conveyor. A classic-control conveyor-reverse code is (U). |
| M56, M58 / M66, M68 | See 5.6. Only M51-M55 / M61-M65 are confirmed in the current list. |
| M76, M77 | Not in OM20 or WEB-M. (U); treat as undefined. |
| M140-M142 | In OM20 (MQL), missing from the current WEB-M list. Implement as optional or no-op. |
| M300 | In WEB-M (APL/Robot). |
| M70/M71, M73/M74, M180/M181 | In WEB-M (see above). |

## 7. Settings referenced (details in settings-alarms.md)

2, 15, 17, 20, 32, 33, 36, 39, 42, 56, 83, 86, 87, 113, 114/115, 118, 131, 144, 165/166, 196, 197, 247, 251/252, 276, 291, 292, 293-298, 337-339, 369/370, 389, 409, 416.

## 8. Alarms raised by M-code processing (texts in settings-alarms.md)

| No. | Text (source) | Trigger |
|---|---|---|
| 312 | PROGRAM END (OM20 p.197) | Subprogram reached its end without M99 |
| 313 | NO P CODE IN M97, M98, OR G65 (CHC) | M97/M98 without P |
| 314 | SUBPROGRAM NOT IN MEMORY (OM20 p.379) | M98 or G65 target not found |
| 315 | INVALID P CODE IN M97, M98 OR M99 (CHC) | Bad P |
| 307 | SUBROUTINE NESTING TOO DEEP (CHC) | Nesting over 9 (U on NGC) |
| 322 | SUB PROG WITHOUT M99 (CHC) | Called program lacks M99 |
| 327 | NO LOOP FOR M CODE EXCEPT M97, M98 (CHC) | L on another M-code |
| 328 | INVALID TOOL NUMBER (CHC) | M06 with a bad T |
| 329 | UNDEFINED M CODE (CHC) | Unknown M-code |
| 332 | H AND T NOT MATCHED (OM20 p.194) | Setting 15 ON and H ≠ spindle tool |
| 339 | MULTIPLE CODES (CHC; NGC video page exists) | More than one M in a block |
| 349 | PROG STOP W/O CANCEL CUTTER COMP (CHC) | M00/M01/M02/M30 with G41/G42 active |
| 363 | COOLANT LOCKED OFF (CHC) | M08/M09 with Setting 32 = OFF |
| 372 | TOOL CHANGE IN CANNED CYCLE (CHC) | M06 inside a canned cycle |
| 378 / 379 | SKIP SIGNAL FOUND / SKIP SIGNAL NOT FOUND (CHC) | M78 / M79 |
| 548 | DOOR M CODES NOT ALLOWED (Haas autodoor guide) | M80/M81 without cell-safe signal or light curtain |
| 973 | FIXTURE CLAMP INCOMPLETE (OM20 p.422) | M90 monitoring + spindle start while unclamped |
| 268 | DOOR OPEN @ M95 START (CHC) | M95 with the door open |

## 9. Unconfirmed items (M-codes)

1. Whether M03/M04 in a block with motion starts before or during that motion on a real NGC; Haas documentation says only "end of block".
2. M06 with X/Y/Z words in the same block; whether a UMC-500 moves X/Y/B/C to a fixed tool-change position; the mill meaning of Settings 337-339.
3. M06 when the requested tool is already in the spindle; `T0 M06` handling.
4. Whether M00/M01 restore spindle and coolant on CYCLE START (recommend: no).
5. Whether M02 stops spindle and coolant like M30.
6. Whether flood coolant / TSC restart automatically after M06 (only shower coolant is documented as restored).
7. Whether RESET, M30 or E-stop re-engage rotary brakes released by M11/M13.
8. NGC text of alarms 307, 313, 315, 322, 327, 328, 329, 349, 363, 372, 378, 379 and 268 (CHC wording used).
9. NGC subprogram nesting limit (CHC: 9).
10. The M51-M58 / M61-M68 range and M26.
11. The exact M69 P format (`Pnnn` vs `P12nnn`).
12. M180/M181 behaviour; M104/M105 applicability on a UMC-500.
13. Whether M109 or M138 require a purchased option on NGC.
14. Whether M41/M42 on a non-gearbox machine is a no-op or raises an alarm.
15. The exact M70/M71 × Setting 389 alarm matrix.
16. Per-code pages (CODE-Mxx) were read only through search-engine extracts, because haascnc.com blocks fetch tools.
