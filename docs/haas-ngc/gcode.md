# Haas NGC mill G-codes (interpreter spec)

This is the G-code spec for the simulated Haas Next Generation Control (NGC) mill and the UMC-500. Developers implement the G-code interpreter from this file, so it states exact behaviour wherever a source gives it. Anything no source confirms is marked **unconfirmed**. M-codes, pendant keys, settings and alarms, operation modes and the UMC-500 are covered in the sibling files (`mcode.md`, `pendant.md`, `settings-alarms.md`, `operation.md`, and the UMC file).

## Sources

| ID | Source | Notes |
|---|---|---|
| [OM20] | Haas *Mill Operator's Manual, Next Generation Control*, 96-8210 Rev N, Dec 2020 (PDF). https://www.haascnc.com/content/dam/haascnc/en/service/manual/operator/english---mill-ngc---operator's-manual---2020.pdf | **Primary source.** "p. N" means the page number printed in the manual; the PDF page is N + 22. Chapter 7 (G-codes) is pp. 297–404. Chapter 5 (Programming) is pp. 177–220: cutter compensation pp. 199–209, canned cycles and R planes pp. 209–210. Macros are pp. 248–296, M-codes pp. 407–434, settings pp. 435–510. |
| [OL-G] | Haas online Mill Operator's Manual, "17 – Mill – G-Codes". https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---g-codes.html | Current text, newer than [OM20]. It gives the group table and the overview sections. This file uses it for the group numbers of G268/G269 and for the G101 pivot wording. |
| [OL-PS] | Haas online manual, "8 – Mill – Part Setup", §8.3 Tool Offsets. https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---part-setup.html | Describes the newer "tool offsets always applied" behaviour. |
| [OL-M] | Haas online manual, "18 – Mill – M-Codes". https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---m-codes.html | Only one M-code is allowed per block, and M-codes take effect at the end of the block. |
| [OL-S] | Haas online manual, "19 – Mill – Settings" (setting list). https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---settings.html | The local copy has setting names and numbers only. |
| [OL-MAC] | Haas online manual, "13 – Mill – Macros". https://www.haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---macros.html | Same G65 and variable tables as [OM20]. |
| [HFO26] | Productivity Inc. (Haas Factory Outlet), *Haas Mill Programming* training manual, rev. 06/26. https://productivity.com/wp-content/uploads/2025/10/Mill-Programming-2026.pdf | **Secondary**, from a Haas distributor; the text is largely taken from Haas manuals. Used for the software version of the tool-offset change and for the bolt-hole start-point rule. |
| [WB05] | Haas Automation, *Mill Programming Workbook*, January 2005 (classic, pre-NGC control). Copy hosted by Univ. of Florida: https://web.mae.ufl.edu/designlab/TA/Manuals/Haas%20VF-2%20Programming%20Workbook.pdf | **Secondary**, and for the classic control only. Used for the power-up default list, address-word ranges, G28 axis rules, and G87/G88 (which no longer appear in NGC lists). |
| [HUK] | Haas UK, "Using G-Code for Circular Milling". https://www.haas.co.uk/resources/better-techniques/control-features/using-g-code-for-circular-milling | **Secondary.** Says G12/G13 add their own lead-in and lead-out moves. |
| [SNIP] | Search-engine extracts of haascnc.com per-code and alarm pages. haascnc.com blocks automated fetches (HTTP 403), so these pages were **not read in full**. | Used only for items marked unconfirmed. |

Each code also has a canonical Haas page at `https://www.haascnc.com/service/codes-settings.type=gcode.machine=mill.value=G83.html` (replace `G83`). Only the G83 page was read directly. Its text matches [OM20] word for word.

## Conventions

- Code numbers, group numbers, address letters, setting numbers and alarm numbers are written exactly as Haas gives them. Everything else is paraphrased.
- Where Haas gives both inch and metric values, this file uses metric. When a source gives only an inch value, it is quoted as inch and marked "(inch only)".
- "Modal" means the code stays active until another code from its group replaces it. Group 00 codes are one-shot: they act only in their own block [OM20 p. 302]. A few group 00 codes still set a lasting state (G52, G92, G100/G101, G103, G107, G187); this is noted on each one.
- **Unconfirmed** means no source we read states it. A "recommended" behaviour is our suggestion for the simulator, not a Haas fact.
- Example blocks are our own and are metric unless noted. "(Ex.)" marks them.

---

## 1. Master table — [OM20 pp. 297–404; OL-G group table]

Default column: **Y** means the code is active at power-up and after a Setting 56 restore (§4.1). **Yc** means it appears only in the classic power-up list [WB05 p. 18]. **Yi** is our inference. A dash means not a default.

| Code | Grp | Modal | Default | Address letters (meaning) | Behaviour (one line) | Src [OM20] |
|---|---|---|---|---|---|---|
| G00 | 01 | M | Yc | X Y Z A B C target; E rapid % for this block | Rapid positioning. Axes move independently, so the path can dog-leg (Setting 335). Cancels any active canned cycle. | p. 308 |
| G01 | 01 | M | – | X Y Z A B C target; F feed; `,C` chamfer; `,R` corner radius | Straight-line feed move. Can insert a chamfer or corner radius before the next linear move. | p. 309 |
| G02 / G03 | 01 | M | – | X Y Z end point; I J K centre offset from the start point; R radius; A; F; L repeat (G91) | CW / CCW arc in the active plane. A third axis in the block makes it helical. | pp. 310–318 |
| G04 | 00 | 1-shot | – | P dwell (`P10.` = 10 s, `P10` = 10 ms) | Dwell. Also loads the shared P register. | p. 318 |
| G09 | 00 | 1-shot | – | – | Exact stop at the end of this block only. | p. 319 |
| G10 | 00 | 1-shot | – | L type; P offset number; R value; X Y Z A B C; G90/G91 | Writes work, tool-length or diameter offsets from the program. | p. 319 |
| G12 / G13 | 00 | 1-shot | – | I first or finish radius; K finish radius; Q step-over; L loops; D offset; F; Z depth | Circular pocket, CW / CCW. Uses G17 and applies cutter comp itself. | pp. 320–322 |
| G17 / G18 / G19 | 02 | M | G17 Y | – | Selects the XY / XZ / YZ plane for arcs. | p. 323 |
| G20 / G21 | 06 | M | per Setting 9 | – | Declares inch / mm. Alarms if it does not match Setting 9. | p. 323, p. 444 |
| G28 | 00 | 1-shot | – | X Y Z A B intermediate point | Rapid return to machine zero, through an optional intermediate point. | p. 323 |
| G29 | 00 | 1-shot | – | X Y Z A B target | Moves through the point stored by G28, then to the target. | p. 324 |
| G31 | 00 | 1-shot | – | F; X Y Z A B C | Feeds until the probe skip signal and records it in #5061–#5066. | p. 324 |
| G35 | 00 | 1-shot | – | F; D; X; Y | Probes the tool diameter into offset Dnn. | p. 326 |
| G36 | 00 | 1-shot | – | F; I J K shift; X Y Z | Probes a surface and sets the active work offset. | p. 328 |
| G37 | 00 | 1-shot | – | F; H; Z shift | Probes the tool length into offset Hnn. | p. 330 |
| G40 | 07 | M | **Y** | – | Cancels cutter comp. | p. 331, p. 200 |
| G41 / G42 | 07 | M | – | D offset number | 2D cutter comp left / right (XY plane only). | p. 331, pp. 199–209 |
| G43 / G44 | 08 | M | – | H offset number | Tool length comp: G43 adds, G44 subtracts. | p. 332 |
| G47 | 00 | 1-shot | – | P mode; X Y start; Z depth; R return plane; I angle; J height; F; E plunge; D smoothness; K corner; (comment text) | Engraves text or a serial number. | pp. 332–337 |
| G49 | 08 | M | Yc | – | Cancels G43/G44/G143. | p. 337 |
| G50 | 11 | M | Yc | – | Cancels scaling. | p. 338 |
| G51 | 11 | M | – | X Y Z scaling centre; P factor | Scaling (option). | pp. 338–343 |
| G52 | 00 or 12 | (sets a shift) | – | X Y Z A B | Global shift added to all work offsets (Setting 33). | p. 343 |
| G53 | 00 | 1-shot | – | X Y Z A B C machine coordinates | Moves in machine coordinates, ignoring work and tool offsets. | p. 343 |
| G54–G59 | 12 | M | G54 Yc | – | Work coordinate systems #1–#6. | p. 343 |
| G60 | 00 | 1-shot | – | axis words | Unidirectional positioning (Setting 35). | p. 344 |
| G61 | 15 | M | – | – | Exact-stop mode. | p. 344 |
| G64 | 15 | M | Yc | – | Cancels G61. | p. 344 |
| G65 | 00 | 1-shot | – | P program; L repeat; argument letters A–Z (see §3.22) | Macro call with arguments. | p. 344, p. 291 |
| G68 | 16 | M | – | G17/G18/G19; plane-pair centre; R angle | Coordinate rotation (option). | pp. 344–348 |
| G69 | 16 | M | Yc | – | Cancels rotation. | p. 348 |
| G70 | 00 | 1-shot | – | I radius; J start angle; L hole count | Bolt-hole circle using the active canned cycle. | p. 348 |
| G71 | 00 | 1-shot | – | I radius; J start angle; K angular step; L hole count | Bolt-hole arc. | p. 349 |
| G72 | 00 | 1-shot | – | I spacing; J line angle; L hole count | Holes along a line. | p. 349 |
| G73 | 09 | M | – | X Y Z R F Q I J K P L | High-speed peck drilling (Setting 22). | pp. 350–351 |
| G74 | 09 | M | – | X Y Z R F J L | Reverse (left-hand) tapping. | pp. 351–352 |
| G76 | 09 | M | – | X Y Z R F P Q I J L | Fine boring with a shift before retract (Setting 27). | pp. 352–353 |
| G77 | 09 | M | – | X Y Z R F Q I J L | Back boring (Setting 27). | pp. 353–355 |
| G80 | 09 | M | Yc | – | Cancels the canned cycle. | p. 356 |
| G81 | 09 | M | – | X Y Z R F L E | Drilling. | p. 356 |
| G82 | 09 | M | – | X Y Z R F P L E | Spot drill / counterbore with dwell. | p. 357 |
| G83 | 09 | M | – | X Y Z R F Q I J K P L E | Peck drilling (Settings 22, 52). | pp. 359–361 |
| G84 | 09 | M | – | X Y Z R F J L S E | Tapping (rigid). | pp. 361–362 |
| G85 | 09 | M | – | X Y Z R F L | Bore in, bore out. | p. 363 |
| G86 | 09 | M | – | X Y Z R F L | Bore, stop the spindle, retract. | pp. 363–364 |
| G89 | 09 | M | – | X Y Z R F P L | Bore in, dwell, bore out. | pp. 364–365 |
| G90 / G91 | 03 | M | G90 Yc | – | Absolute / incremental (Setting 29). | p. 365 |
| G92 | 00 | (sets a shift) | – | X Y Z A B | Shifts all work systems so the commanded position becomes the current one. | pp. 365–366 |
| G93 | 05 | M | – | F (strokes per minute) | Inverse-time feed. | p. 366 |
| G94 | 05 | M | Yc (RESET forces it) | F | Feed per minute. | p. 366 |
| G95 | 05 | M | – | F per revolution | Feed per revolution. | p. 366 |
| G98 | 10 | M | Yc | – | Canned cycle returns to the initial point. | p. 367 |
| G99 | 10 | M | – | – | Canned cycle returns to the R plane. | p. 368 |
| G100 / G101 | 00 | (sets mirror state) | – | X Y Z A B C | Mirror image off / on. | p. 369 |
| G103 | 00 | (sets look-ahead limit) | – | P 0–15 | Limits block look-ahead. | p. 370 |
| G107 | 00 | (sets mapping state) | – | X Y Z A B C; Q diameter; R radius | Cylindrical mapping on / off. | p. 371 |
| G110–G129 | 12 | M | – | – | Work systems #7–#26 (= G154 P1–P20). | p. 371 |
| G136 | 00 | 1-shot | – | F; I J K; X Y Z | Probes a work centre between the M75 point and a probed point. | pp. 372–373 |
| G141 | 07 | M | – | X Y Z A B; I J K normal vector; D; F | 3D+ cutter compensation. | pp. 374–377 |
| G143 | 08 | M | – | H | 5-axis tool length comp, VR-type machines only. | pp. 377–378 |
| G150 | 00 | 1-shot | – | D F I J K P Q R S X Y Z (+G41/G42) | General pocket from a contour subprogram. | pp. 378–386 |
| G154 | 12 | M | – | P 1–99 | Extra work systems P1–P99. | pp. 386–388 |
| G156 | 09 | M | – | Z X Y I K F C D | Broaching cycle. | pp. 388–391 |
| G167 | 00 | 1-shot | – | P setting number; Q value; K guard code | Changes a setting permanently from the program. | pp. 391–392 |
| G174 / G184 | 00 | 1-shot | – | F; X Y Z hole bottom; S | Non-vertical rigid tap, CCW / CW. | p. 392 |
| G187 | 00 | (sets smoothness state) | – | P 1–3; E corner tolerance | Smoothness level and maximum corner rounding. | p. 393 |
| G234 | 08 | M | – | H | TCPC (simultaneous 4/5-axis). | pp. 393–397 |
| G253 | 00 | 1-shot | – | – | Orients the spindle normal to the active G268 feature coordinate system. | p. 397 |
| G254 | 23 | M | – | – | DWO (3+1 / 3+2 positioning). | pp. 398–401 |
| G255 | 23 | M | Yi | – | Cancels DWO. | p. 401 |
| G266 | 00 | 1-shot | – | E rapid %; P axis number; I machine position | Single-axis rapid in machine coordinates at a set rapid %. | p. 402 |
| G268 | **14** ([OL-G]); 02 in [OM20] | M | – | X Y Z origin; I J K rotations; Q rotation order | Turns on a tilted feature coordinate system (FCS). | pp. 402–404 |
| G269 | **14** ([OL-G]); 02 in [OM20] | M | Yi | – | Turns off the FCS. | p. 402 |

**Not in any NGC list.** G87 and G88 are in neither the [OM20] list nor the [OL-G] list. On the classic control they were "bore in, manual retract" and "bore in, dwell, manual retract", group 09 [WB05 pp. 16, 71, 83–84]. G102, G153–G169 (classic 5-axis canned cycles) and G188 are also classic-only [WB05 pp. 16–17]. **Recommended:** reject these, and any other code not in this table, with an "invalid G-code" alarm. The alarm number is unconfirmed.

**Group conflict.** [OM20] gives G268/G269 group **02**, the same group as G17/G18/G19. [OL-G] and [HFO26] give group **14**. Use 14. With 02, `G17 G268` in one block would be a same-group error, and the [OM20] examples never put them in the same block, so 14 breaks nothing.

---

## 2. Group summary (for the modal-state model) — [OM20 pp. 297–302; OL-G group table]

| Group | Codes | Notes |
|---|---|---|
| 00 | G04 G09 G10 G12 G13 G28 G29 G31 G35 G36 G37 G47 G52* G53 G60 G65 G70 G71 G72 G92 G100 G101 G103 G107 G136 G150 G167 G174 G184 G187 G253 G266 | Non-modal [OM20 p. 302]. *G52 is listed as "00 or 12". The 12 is a leftover of the classic YASNAC mode; under both NGC options of Setting 33 (FANUC, HAAS), G52 is group 00 [OM20 p. 343; WB05 p. 15]. |
| 01 | G00 G01 G02 G03 | Motion. G00 or G01 also cancels group 09 [OM20 pp. 305, 356]. |
| 02 | G17 G18 G19 | Plane. |
| 03 | G90 G91 | |
| 05 | G93 G94 G95 | |
| 06 | G20 G21 | |
| 07 | G40 G41 G42 G141 | |
| 08 | G43 G44 G49 G143 G234 | G234 and G43 cancel each other [OM20 p. 396]. |
| 09 | G73 G74 G76 G77 G80 G81 G82 G83 G84 G85 G86 G89 G156 | Canned cycles. |
| 10 | G98 G99 | |
| 11 | G50 G51 | |
| 12 | G54–G59, G110–G129, G154 | Work offset. |
| 14 | G268 G269 | Per [OL-G]. |
| 15 | G61 G64 | The classic control used group 13 [WB05 p. 15]. NGC uses 15. |
| 16 | G68 G69 | |
| 23 | G254 G255 | |

Macro variables #4001–#4021 return the last or default code of groups 1–21 [OM20 p. 268]. Implement modal state as a per-group map so these reads work. Group 23 has no #4001-series variable within that documented range (unconfirmed how it is read).

---

## 3. Detailed interpreter notes

### 3.1 G00 Rapid positioning (group 01) — [OM20 p. 308; p. 485 Setting 335]

- Addresses: X Y Z A B C (all optional), plus **E**, which sets the rapid rate of this block only, as a percent.
- Modal. Every following block is rapid until another group 01 code is given.
- **Cancels an active canned cycle**, the same as G80.
- Path: each named axis runs at its own maximum speed, so the axes can finish at different times and the path is generally **not a straight line**. The next block waits until every axis has stopped.
- Setting 335 "Linear Rapid Mode" controls this:
  - `NONE`: each axis moves on its own.
  - `LINEAR (XYZ)`: X, Y and Z move in a straight line through space; other axes move on their own.
  - `LINEAR + ROTARY`: X/Y/Z/A/B/C all arrive at the same time.
  - Haas says all three modes take the same total time. The factory default is unconfirmed (see `settings-alarms.md`).
- Setting 57 sets how closely the X/Y rapids of a canned cycle must stop before Z moves (§3.25).
- The rapid rate is scaled by the rapid override and by Setting 10 (limit rapid to 50%).

### 3.2 G01 Linear interpolation (group 01) — [OM20 pp. 309–310]

- Addresses: F (feed), X Y Z A B C, `,R` (corner radius), `,C` (chamfer distance). **Both corner words start with a comma.** The examples are `Y-5. ,C1.` and `X-5. ,R1.` A plain `C` is the C axis. The overview text in [OM20 p. 197] and [OL-G] writes "Cnn.nnnn / Rnn.nnnn", but the detailed G01 section and every example use the comma form.
- F is modal: the latest F stays in force until another F is given. In G93 every block needs its own F (§3.36).
- All programmed axes start and finish together (true linear interpolation).
- If an axis cannot reach the programmed feed, G01 does not execute and the control raises a "max feedrate exceeded" alarm. The alarm number is unconfirmed.
- Modal until G00, G02 or G03.
- **Corner chamfer / radius**, as Haas states it:
  - The `,C` or `,R` goes on the **first** of two linear blocks that meet at a corner. The control inserts the chamfer or arc between the two blocks.
  - The block that ends the corner **must be another linear interpolation block**. A G04 dwell may come between the two.
  - `,C d`: the chamfer starts d before the corner on the first line and ends d after the corner on the second line.
  - `,R r`: an arc of radius r, tangent to both lines.
  - Several corner blocks in a row are allowed.
  - Both moves must lie in the two axes of the active plane (G17, G18 or G19).
  - Unconfirmed: the alarm when the next block is not linear, and the alarm when d or r does not fit the segment lengths. **Recommended:** raise an alarm before any motion.
  - (Ex.) `G01 X50. ,R5. F300.;` then `Y-40.;` gives a 5 mm arc between the X move and the Y move.

### 3.3 G02 / G03 Circular interpolation (group 01) — [OM20 pp. 310–318; OL-G "Circular Interpolation Motion"]

- Addresses: F; I J K (centre); R (radius); X Y Z (end point); A.
- **Plane** (group 02) decides which words define the arc. Only the centre words of the active plane are allowed: G17 uses **I J**, G18 uses **I K**, G19 uses **J K**.
- **Direction** is the view from the positive end of the third axis:
  - G17 is seen from above the table.
  - G18 is seen from the rear of the machine looking toward the front (from +Y).
  - G19 is seen from the control-panel side (from +X on a standard VMC).
  - G02 is CW in that view, G03 is CCW [OM20 p. 323].
- **I J K form** (Haas's preferred form):
  - I/J/K are always distances **from the start point to the centre**, in both G90 and G91.
  - X/Y/Z is the end point: absolute in G90, incremental in G91.
  - An axis of the plane that is not programmed keeps its start value, so its end equals its start.
- **Full circle:** program only I/J/K, with no end point in the plane, e.g. `G02 I3.0 J4.0`. **A full circle needs the I/J/K form; R cannot make one.**
- **R form:**
  - R is the arc radius.
  - **Positive R** gives an arc of 180° or less; **negative R** gives an arc of more than 180°.
  - Exactly 180° uses positive R.
  - To find the centre (standard geometry, not stated by Haas): let d be the chord length. The centre lies on the chord's perpendicular bisector at distance √(R² − (d/2)²). Choose the side that gives the requested direction and an arc ≤ 180° (R > 0) or > 180° (R < 0).
  - If d > 2|R|, raise an alarm. The alarm number and tolerance are unconfirmed.
- **Helical:** add the linear axis that is **not** in the plane (e.g. Z in G17). It moves in proportion to the arc. The control sets each axis speed so the helix rate equals the programmed F. Read this as the feed along the 3D helix path (likely meaning; the exact feed definition is unconfirmed).
- **L on an arc:** with G91, `L` repeats the arc block. The single-point thread-mill example repeats a full helical circle 5 times with `I-0.5 J0 Z0.125 L5` [OM20 p. 317].
- **With cutter comp:** arcs are allowed only in G17. Comp cannot be turned on or off, change side, or change D in an arc block. An inside arc with a radius smaller than the comp radius raises an alarm (§3.13).
- **Arc consistency (I/J/K form):** a Haas alarm page reached through [SNIP] is titled "304 Invalid I, J, or K in G02 or G03". The number, title and tolerance are **unconfirmed**. **Recommended:** alarm when |start-to-centre radius − end-to-centre radius| is greater than 0.0025 mm (our value). Do the check before motion.
- A on an arc: A is listed as an allowed address. How a rotary axis moves inside an arc is unconfirmed. **Recommended:** move it linearly in proportion, like a helical axis.
- With settings 188–190 per-axis scaling active, G02/G03 raise **alarm 467** (§3.16).

### 3.4 G04 Dwell (group 00) — [OM20 p. 318; WB05 p. 26]

- `P` is the dwell time. **`P10.` (with a decimal point) = 10 seconds. `P10` (no decimal point) = 10 milliseconds.**
- **P is one shared modal register** for G04, M97, M98 and the canned cycles. A `G04 Pnn` or `M97 Pnn` given in the middle of a canned cycle also replaces the cycle's dwell. G00, G01, G80 and [RESET] clear the cycle P [OM20 pp. 304, 318]. The same note appears under G103 and G154, so their P also lands in this register.
- Range (classic): 0.001–1000.0 s [WB05 p. 26]. Unconfirmed for NGC.
- Dwell with X instead of P is not documented. **Recommended:** reject it.

### 3.5 G09 Exact stop (group 00) — [OM20 p. 319]

The axes slow down and stop at this block's end point before the next block is processed. It affects this block only.

### 3.6 G10 Set offsets (group 00) — [OM20 pp. 319–320]

| L | Writes | P range | Value words | Macro variables written ([OM20 pp. 265, 270–271]) |
|---|---|---|---|---|
| L2 | Work origin of G52 (P0) or G54–G59 (P1–P6) | P0, P1–P6 | X Y Z A B C | G52 = #5201–#5206. G54 = #5221–#5226, then +20 for each code up to G59 = #5321–#5326. |
| L10 | Tool **length** geometry (H) | P1–P200 | R | #2001–#2200 |
| L1 or L11 | Tool **length wear** (H) | P1–P200 | R | #2201–#2400 |
| L12 | **Diameter/radius** geometry (D) | P1–P200 | R | #2401–#2600 |
| L13 | **Diameter/radius wear** (D) | P1–P200 | R | #2601–#2800 |
| L20 | Extra work origins: G110–G129 (P1–P20) or G154 P1–P99 | P1–P99 | X Y Z A B C | G154 Pn = #14001+20·(n−1) to +5 (P99 = #15961–#15966). The legacy alias for n ≤ 20 is #7001+20·(n−1). |

- **G90 in the block:** the value **replaces** the stored value. **G91 in the block:** the value is **added** to it. Haas example: `G10 L2 P1 G91 X6.0` moves G54 6.0 in +X.
- R is "offset value or increment" for length and diameter.
- Haas notes L1 = L11 = length **wear**. This differs from Fanuc, where L1 is geometry.
- Unconfirmed:
  - Whether the G90/G91 written in a G10 block stays modal for later blocks. G90/G91 is a group 03 word, so the general rule says it does, and the classic workbook warns to restore G90 after `G28 G91` [WB05 p. 47]. **Recommended:** treat it as modal.
  - Whether the L12/L13 R value is taken as radius or diameter under Setting 40. **Recommended:** store it exactly as written in the D column; Setting 40 decides how that column is read.
  - Behaviour with a P out of range, or with L2 and no P. **Recommended:** alarm.

### 3.7 G12 / G13 Circular pocket milling (group 00) — [OM20 pp. 320–322; WB05 p. 49; HUK]

| Word | Meaning |
|---|---|
| I | Radius of the first circle, or the finish radius if there is no K. **Must be greater than the tool radius and less than K.** |
| K | Radius of the finished circle (optional). |
| Q | Radius step-over. Use only together with K. |
| L | Loop count for repeated deeper passes (with G91). |
| D | Tool radius/diameter offset. `D00` = cut on the tool centreline. **With no D, the last D commanded is used, even one later cancelled by G40.** |
| F | Feed. Required. |
| Z | Depth of cut (G90), or depth increment per loop (G91). |
| X Y | Pocket centre (classic only [WB05]; not in the [OM20] list; unconfirmed on NGC). |

- G12 cuts CW and includes **G42**. G13 cuts CCW and includes **G41**. Do not program G41/G42 yourself; give a D.
- Always in the XY plane. Non-modal.
- **Start:** rapid the tool to the pocket centre first. [HUK] says the cycle adds its own lead-in and lead-out moves; their geometry is unconfirmed.
- **Patterns:**
  - I only: one finish circle.
  - I + K + Q: spiral out from I to K in steps of Q.
  - To clear all material: make I and Q smaller than the tool diameter and set K to the pocket radius.
- **G91 + L:** the Z increment is repeated L times. Example: `G13 G91 Z-.5 I.4 K2. Q.4 L4 D01 F20.` gives a total depth of 2.0 (inch example) [OM20 p. 322]. The G91 in that block stays active: the next line in the Haas example restores G90.
- **End:** the tool is **not** retracted. Z stays at depth, so program a retract yourself [WB05 p. 49]. Where XY ends (most likely back at the centre) is unconfirmed.
- In G90, whether Z is reached by plunging at F at the centre is unconfirmed. **Recommended:** feed to Z at the centre at F.

### 3.8 G17 / G18 / G19 Plane selection (group 02) — [OM20 p. 323]

- Default G17.
- Applies to G02/G03 and to the plane rules of G01 corners. G12/G13 always use XY.
- Cutter comp (G41/G42) allows arcs only in G17.
- G68 uses the current plane unless the G68 block names one (§3.23).
- Canned cycles in G18/G19: [OL-G] mentions "G17, G19 cycles" in a sentence copied from the lathe manual. Mill behaviour is unconfirmed. **Recommended:** support canned cycles only in G17 and alarm otherwise.

### 3.9 G20 / G21 Inch / metric (group 06) — [OM20 p. 323; Setting 9 p. 444]

- These codes only **check** units; they do not change them. Setting 9 (`INCH`/`MM`) sets the units.
- **G20 in a program causes an alarm if Setting 9 is not INCH.**
- That G21 alarms when Setting 9 is INCH is unconfirmed but symmetrical. **Recommended:** alarm.
- Default: G20 when Setting 9 = INCH, G21 when MM.
- Resolution: 0.0001 in or 0.001 mm.
- Changing Setting 9 converts the stored offsets but **not** the programs.

### 3.10 G28 Return to machine zero (group 00) — [OM20 pp. 323–324; WB05 pp. 23, 47]

- **No axis words:** all axes (X, Y, Z, A, B) return to machine zero **together**. On the classic control, auxiliary axes (B, C…) went after X/Y/Z/A [WB05].
- **With axis words:** only the **named** axes move [WB05 p. 47; implied by Haas code such as `G91 G28 Z0.` then `G91 G28 Y0.`, OM20 p. 225]. Each named axis:
  1. moves to the **intermediate point** given by its word, read under G90/G91 in the current work coordinates;
  2. then moves to machine zero.
- The intermediate point is saved as the **G29 reference point**.
- Haas examples [OM20 p. 324]:
  - `G28 G90 X0 Y0 Z0`: goes to work X0 Y0 Z0 first, then home. This is dangerous for Z, since work Z0 is usually the part top.
  - `G28 G90 X1. Y1. Z1.`: goes through work X1 Y1 Z1.
  - `G28 G91 X0 Y0 Z0`: goes **straight** to machine zero (zero incremental distance to the intermediate point).
  - `G28 G91 X-1. Y-1. Z-1.`: moves −1 incrementally, then home.
- **Idiom:** `G28 G91 Z0` sends Z straight home. The G91 is a group 03 word and **stays modal**, so the program must restore G90 [WB05 p. 47].
- Moves are rapid.
- The classic control ignored tool length offset in the G28 move [WB05 p. 47]. G28 ignores G234 and G254 rotational deltas; Haas advises against G28 while G254 is active or while B/C are not at zero [OM20 pp. 397, 401].
- Setting 108 "Quick Rotary G28": rotary axes take the shortest way home (within ±359.99°). **This works only with G91.** They go to machine home, not to work zero [OM20 p. 458].
- Whether G28 cancels G43 on NGC is unconfirmed. The classic control said "a G28, M30 or Reset will also cancel tool length offsets" [WB05 p. 25]; [OM20 p. 337] lists only H0, M30 and [RESET].

### 3.11 G29 Return from reference point (group 00) — [OM20 p. 324]

The named axes go to the G29 reference point stored by the last G28, then to the position given in the G29 block. With no G28 since power-up, behaviour is unconfirmed. **Recommended:** alarm.

### 3.12 G31 / G35 / G36 / G37 / G136 Probing (group 00) — [OM20 pp. 324–331, 372–373]

All five are non-modal and need the probing option. They must not be used with G41/G42 active. G36 and G136 also must not have G43/G44 active.

Haas recommends a probe feed below **F2500.** mm/min (F100. in/min).

| Code | Words | Behaviour |
|---|---|---|
| G31 | F (required); at least one of X Y Z A B C (otherwise alarm) | Feeds toward the target. On a skip signal: stop, beep, store the position in **#5061–#5066** (X Y Z A B C; [OM20 p. 269] extends this to #5069 for U V W), and go to the next block. With no skip: no beep, store the **end-of-move** position, carry on. #5063 includes tool length comp. |
| G35 | F, D, X/Y | Diameter = distance between the point set with `G31 … M75` and the G35 touch, reduced by Setting 63 (tool probe width). Written to the non-zero Dnn. Run the spindle in reverse (M04) for a right-hand cutter. |
| G36 | F, X Y Z, optional I J K | The touch point becomes zero of the **active** work offset for each programmed axis, shifted by I/J/K. Corrected by Settings 59–62 (probe offsets). |
| G37 | F, H (non-zero, with G43/G44 active), Z | Feeds Z until the touch. **Hnn** = distance from the current work zero to the touch point, shifted by the G37 Z value (`Z0` = no shift). The work system and H may be selected in this block or the one before. |
| G136 | F, X Y Z, optional I J K | Sets the active work offset to the **midpoint** between the `G31 … M75` point and the G136 touch, shifted by I/J/K. Settings 59–62 apply. |

The probe must be switched on first (`M59 P1134`; the tool-setter sequence is in [OM20 p. 325]). That belongs to `mcode.md`.

### 3.13 G40 / G41 / G42 Cutter compensation (group 07) — [OM20 pp. 199–209, 331; Settings 40, 43, 44, 58 pp. 449–451]

**Offset value**

- D selects the offset row, 1–200; the number is in the leftmost column of the tool offset table.
- The amount used = **geometry + wear** of that D row (#2401+ and #2601+).
- If Setting 40 = DIAMETER, the shift is half the stored value. If RADIUS, it is the stored value.
- A **negative** amount swaps sides: G41 with a negative value acts like G42 with a positive value.
- `D0` uses 0, which has the same effect as comp off. On the classic control D00 also cancelled any earlier Dnn [WB05 p. 24].

**Basic rules**

- G41 puts the tool **left** of the path as seen along the direction of travel; G42 puts it **right**. G40 cancels. G40 is the power-up state.
- Comp works in **XY only (G17)**. G141 is the 3D version.

**Entry and exit** [OM20 pp. 203, 207]

- To turn comp on, the G41/G42 block needs a non-zero D. To turn it off, a block must contain G40.
- **The ramp-on move:** the block holding G41/G42 starts at the programmed (uncompensated) point and **ends at the offset point**.
- **The ramp-off move:** the block holding G40 starts at the offset point and ends at the **programmed, uncompensated** point.
- **Changing sides** (G41↔G42): the move starts offset on one side and ends offset on the other side.
- **No XY motion in the G41/G42/G40 block:** the change is held until the next block with X or Y motion.
- **Lead-in rule:** turn comp on during a **G01 X/Y move at least as long as the comp radius**, and turn it off the same way. Haas phrases the rules in terms of G01. Whether entry is allowed on G00 is unconfirmed. **Recommended:** allow it on G00 or G01, and alarm on G02/G03.
- **Arcs:** turning comp on or off in a G02/G03 block causes an **alarm** (number unconfirmed). Changing D or side in an arc block is not allowed either.
- **New D while comp is on:** the new value takes effect at the end of the current move.
- **Setting 43 "Cutter Comp Type", A (default) or B** [OM20 p. 203, figures F5.15/F5.16]. It matters when the entry move is followed by a move at less than 90°:
  - Type A: the tool goes **directly** to the offset start point of the second move.
  - Type B: used for clearance around clamps; the tool takes an extra corner path.
  - Our reading of the figures for Type B: the tool first reaches the point offset normal to the entry move, then moves to the offset start of the next move. Unconfirmed in detail.

**Look-ahead and corners** (Setting 58)

- The control looks at the current block plus the **next two blocks with X or Y motion**, three in all, to check for interference.
- **YASNAC:** the tool side must be placed along every programmed edge without overcutting the next two moves. All outside corners are joined with an **arc**.
- **FANUC:** the cutter does not have to sit on every edge. An alarm is raised if the path would overcut. Outside angles up to 270° are joined with a **sharp corner**; above 270° an **extra linear move** is added.
- A move shorter than the tool radius and at a right angle to the previous move works only with FANUC; YASNAC raises a cutter comp alarm.
- An inside arc with a radius smaller than the active comp radius raises an alarm.

**Feed** (Setting 44, 1–100%)

- On the inside of an arc the feed is reduced to keep the programmed feed at the cutting edge, but never below Setting 44 % of F.
- 100% = no adjustment.
- There is no speed-up on outside arcs.

**Program end and other limits**

- **M30, M00, M01 or M02 with comp still active raises an alarm.** Note that M00 and M01 are included.
- Setting 36 (program restart) raises an alarm if the restart line is inside a comp section [OM20 p. 448].
- With G68: turn comp on **after** rotation and off **before** G69 [OM20 p. 348].
- G103 also limits the comp look-ahead [OM20 p. 370].
- G12/G13 and G150 apply comp themselves (§3.7, §3.43).

### 3.14 G43 / G44 / G49 Tool length compensation (group 08) — [OM20 pp. 194, 332, 337, 415; OL-PS §8.3; HFO26 p. 7]

**Classic behaviour (as written in [OM20])**

- `G43 Hnn` **adds** the length (geometry #2001+ plus wear #2201+) of row nn to the commanded Z. `G44 Hnn` **subtracts** it.
- A **non-zero H is required**. H rows are 1–200.
- Haas's pattern puts G43 on the first Z approach after every tool change: `G43 H01 Z0.1`. The offset is applied in the move of that block.
- If no Z word is in the G43 block, it is unconfirmed whether Z moves at once or on the next Z move. **Recommended:** apply it on the next Z move (Fanuc behaviour), and show the new value in the position display immediately.
- **Setting 15 "H and T Code Agreement":** when ON, the H number must match the tool in the spindle, otherwise **Alarm 332 "H and T Not Matched"**. `H00` never raises this alarm.
- **What cancels G43/G44:**
  - G49 and `H0`/`H00`.
  - [RESET] [OM20 p. 337].
  - **M30: version-dependent.** [OM20 p. 337] says M30 cancels, but [OM20 p. 415] says "as of software version **100.16.000.1041**, M30 no longer cancels tool length offsets." Follow p. 415 for a modern NGC.
  - G234: TCPC cancels G43. In the other direction, G43, G44 or G49 cancel G234 [OM20 p. 396].
- G53 ignores tool offsets in its block [OM20 p. 343].

**Newer default (current online manual)**

- Tool offsets are **always applied by default**, unless G49/H00 is explicitly commanded.
- On mills, the active tool offset **updates automatically to match the new tool after a tool change** [OL-PS §8.3].
- [HFO26] (secondary) adds two points:
  - This starts with **NGC software 100.21.000.1100**.
  - The active length offset **and its group 08 code persist through power cycles**.
- No setting in the [OL-S] list controls this behaviour, so it is tied to the software version only.

**Simulator recommendation**

Provide a `toolOffsetBehaviour` option:

- `classic`: explicit G43 Hnn is needed; M30 cancels it in software before 100.16.000.1041.
- `ngc-2020`: M30 keeps the offset; [RESET] cancels it.
- `ngc-current`: offset always applied, follows T after M06, survives power-off; only G49/H00 cancels it.

The default is `ngc-current` (newest).

### 3.15 G47 Text engraving (group 00) — [OM20 pp. 332–337]

**Preconditions:** **Setting 29 (G91 Non-modal) and Setting 73 (G68 Incremental Angle) must be OFF.** Engraving along an arc is not supported.

| Word | Meaning |
|---|---|
| P | `0` = literal text, `1` = sequential serial number, `32`–`126` = one ASCII character (P is the ASCII code). |
| (comment) | For P0 and P1, the text in the **same block's parentheses** is the text or the serial format. The parser must keep the comment with the block. |
| X Y | Start point: bottom-left corner of the first character. |
| Z | Engraving depth. |
| R | Return plane. The tool retracts to this Z after engraving (example: `R0.05` = 0.05 above the part). |
| I | Text angle, −360 to +360 (default 0). |
| J | Character height (default 1.0 in current units). The minimum is 0.001 (inch only). |
| F | XY engraving feed. |
| E | Plunge feed for the −Z moves. |
| D | Smoothness: D1 rough, D2 medium, D3 finish (default D3). |
| K | Maximum corner rounding (default K0.002, inch only). |

- **Characters:** A–Z, a–z, 0–9 and `` ` ~ ! @ # $ % ^ & * - _ = + [ ] { } \ | ; : ' " , . / < > ? ``.
- Parentheses can only be engraved with `P40` and `P41`, one block per character.
- **Serial numbers (P1):**
  - The number of `#` characters in the comment sets the digit count, e.g. `(####)` = 4 digits.
  - The value lives in **#599** and increases by 1 after each engraving.
  - `G47 P1 (0001)` engraves nothing and only sets the start number.
  - `#599=[#599-1]` between two G47 blocks repeats the same number.
- **Corner rounding:** Haas suggests `G187 E0.05` (metric; E0.002 in inch) before G47, then `G187` alone afterwards to restore the default.
- Haas examples always follow G47 with `G00 G80 Z…`. Whether G47 leaves any canned-cycle-like state is unconfirmed. **Recommended:** none; just accept the G80.
- G47 combines with G107 to engrave around a cylinder (§3.40).

### 3.16 G50 / G51 Scaling (group 11) — [OM20 pp. 338–343; Settings 71, 188–190 pp. 452, 463]

- Rotation and Scaling is a paid option (200-hour tryout available). In the simulator, treat it as installed.
- `G51 [X] [Y] [Z] [P]`:
  - X/Y/Z = scaling centre. If none are given, the **last commanded position** is used.
  - P = factor, 0.001–999.999, applied to all axes.
- **Choosing the factor:**
  1. P, if programmed.
  2. Otherwise Setting 71, if it is non-zero (default 1.000).
  3. Otherwise Settings 188/189/190, per axis X/Y/Z. **With these active, only G01 is allowed; G02/G03 raise alarm 467.**
- **What is scaled:** X Y Z A B C end points of G00/G01/G02/G03, and **I J K R** of arcs. Each is scaled about the centre and takes effect from the block **after** G51.
- **Canned cycles:** the initial point, the depth and the return plane are scaled.
- **Not scaled:**
  - Tool offsets and cutter comp values.
  - G73/G83 Q, I, J, K.
  - G76/G77 Q.
- Results are rounded down to the smallest unit of the variable.
- **With rotation:** turn scaling on **before** rotation, in separate blocks, and turn it off after G69.
- G50 cancels.

### 3.17 G52 Global work shift (group 00; listed "00 or 12") — [OM20 p. 343; Setting 33 p. 448]

- The G52 values (the "G52" row of the work offset page, #5201–#5206) are **added to every work offset**.
- **Setting 33 = FANUC:**
  - The values are cleared at power-on, [RESET], a mode change, the end of the program/M30, G92, or `G52 X0 Y0 Z0 A0 B0`.
- **Setting 33 = HAAS:**
  - The G-code section says the values are cleared by G92.
  - The settings section says they are cleared by entering zero by hand or by programming `G52 X0` / `Y0` / `Z0`.
  - So both G92 and `G52 …0` clear them.
- Whether `G52` in G91 adds to the current shift is unconfirmed. **Recommended:** G52 always sets the values absolutely.

### 3.18 G53 Machine coordinates, one block (group 00) — [OM20 p. 343; WB05 p. 48]

- Work offsets **and tool offsets** are ignored in this block. Machine zero = the position reached by Zero Return.
- Typical uses: `G53 G49 Z0` (Z home), `G53 Y0`.
- The motion type comes from the active group 01 code. If it is a canned-cycle state, behaviour is unconfirmed.
- Whether G53 honours G91 is unconfirmed. **Recommended:** always absolute machine coordinates.
- G53 ignores G234 and G254 [OM20 pp. 397, 401].

### 3.19 Work coordinate systems G54–G59, G110–G129, G154 P1–P99 (group 12) — [OM20 pp. 194, 343, 371, 386–388, 270–271]

| Select | Offset table row | Macro variables X..C |
|---|---|---|
| G52 (shift) | G52 | #5201–#5206 |
| G54 … G59 | G54 … G59 | #5221–#5226, #5241–…, #5261–…, #5281–…, #5301–…, #5321–#5326 |
| G110 … G129 | = G154 P1 … P20 | #14001–#14006 … #14381–#14386 (legacy #7001–#7006 … #7381–#7386) |
| G154 Pn (n = 1–99) | G154 Pn | #14001 + 20·(n−1) … +5. Examples: P21 = #14401, P50 = #14981, P99 = #15961 |

- G110–G129 and G154 P1–P20 are the **same** offsets.
- While G154 is active, the work-offset heading shows the P value.
- **Machine position** = work offset + G52 shift + G92 shift + programmed value (+ tool length on Z, ± scaling, rotation and mirror). This order is our model; the order of rotation, scaling and mirror relative to the offsets is unconfirmed.
- Setting 377 (negative work offsets) changes the sign convention of the offsets; see `settings-alarms.md`.
- The G154 P word shares the modal P register (§3.4).
- Selecting a work offset G-code also stops look-ahead before a tool change [OM20 p. 411], which matters only for timing.

### 3.20 G60 Unidirectional positioning (group 00) — [OM20 p. 344]

- Positions from one direction only. The axis overshoots by **Setting 35** (G60 Offset), then reverses onto the target.
- [OM20] p. 344 says "positive direction"; p. 448 says "past the target point prior to reversing". So the final approach is in the + direction. Unconfirmed whether that applies on all axes.
- Kept for compatibility. One block only.

### 3.21 G61 / G64 Exact stop mode (group 15) — [OM20 p. 344; Setting 85 p. 456]

- G61: every move decelerates to an exact stop. G64 cancels it (default per [WB05]).
- With Setting 85 (maximum corner rounding) = 0, the control behaves as if exact stop were on for every block.

### 3.22 G65 Macro call (group 00) — [OM20 pp. 253–255, 291–293]

- Format: `G65 Pnnnnn [Lnnnn] [arguments]`, or `G65 (/path/file.nc)` (paths are case sensitive).
- L repeats the call. Calls nest up to **9** levels deep.
- The program is searched in the active drive first, then in the Setting 251/252 locations. If it is not found, an alarm is raised.
- **Argument letters → local variables:**

  | Letter | Var | Letter | Var | Letter | Var |
  |---|---|---|---|---|---|
  | A | #1 | J | #5 | T | #20 |
  | B | #2 | K | #6 | U | #21 |
  | C | #3 | M | #13 | V | #22 |
  | D | #7 | Q | #17 | W | #23 |
  | E | #8 | R | #18 | X | #24 |
  | F | #9 | S | #19 | Y | #25 |
  | H | #11 | I | #4 | Z | #26 |

- **G, L, N, O and P cannot pass arguments.**
- Alternate addressing: up to 10 sets of I J K fill #4–#33.
- **Arguments without a decimal point** are scaled by the least increment [OM20 p. 254]:
  - A B C I J K Q R U V W X Y Z → × 0.0001 in (× 0.001 mm).
  - D E F H L M S T → taken as written (× 1).
- On a G65 call the new locals start undefined; the caller's locals are saved and restored.
- **Aliasing:** a G-code 1–255 can be assigned to O9010–O9019, and an M-code to O9000–O9009. G00, G65, G66 and G67 cannot be aliased. Only G aliases pass arguments.
- Full macro language: see the macros material. It is out of scope here.

### 3.23 G68 / G69 Rotation (group 16) — [OM20 pp. 344–348; Settings 72, 73 pp. 452–453]

- `G68 [G17|G18|G19] [centre on the plane pair] [R]`. The plane is the one in the block, otherwise the current one.
- Centre: X/Y in G17, X/Z in G18, Y/Z in G19. **If no centre is given, the current position is used.**
- R = angle in degrees, −360.000 to +360.000. **Positive = CCW.** If R is missing, **Setting 72** is used.
- **Setting 73 ON + G91:** each G68 **adds** R to the current angle. With G90, G68 sets the angle absolutely.
- The angle is **reset to 0 at the start of the program**.
- **What is rotated:** values in the plane of rotation (X, Y, Z, I, J, K of that plane) in blocks **after** G68. The G68 block's own values are **not** rotated.
- Do not change the plane while G68 is active. Scaling goes on first (§3.16). Comp goes on after G68 and off before G69.
- G69 cancels.
- How a G91 move right after G68 is rotated is unconfirmed. **Recommended:** rotate the incremental vector.

### 3.24 G70 / G71 / G72 Bolt-hole patterns (group 00) — [OM20 pp. 303–304, 348–349; HFO26 p. 63; Setting 28 p. 447]

- **A canned cycle must be active.** Allowed cycles: G73, G74, G76, G77 or G81–G89. At each hole the cycle runs.
- **Reference point:**
  - G70/G71: the tool is placed at the **pattern centre** before the call.
  - G72: the tool is placed at the **starting hole** [HFO26, secondary].
  - The centre comes from the current XY position; G70/G71 have no X/Y words.
- **Skipping the centre hole:** put **L0** on the canned-cycle line, or turn Setting 28 OFF.

| Code | I | J | K | L |
|---|---|---|---|---|
| G70 bolt circle | Radius | Start angle 0–360°, CCW from 3 o'clock (optional) | – | Number of equally spaced holes |
| G71 bolt arc | Radius | Start angle (optional) | Angular step between holes (±) | Number of holes |
| G72 line | Distance between holes | Line angle, CCW from 3 o'clock (optional) | – | Number of holes |

- Holes for G70 sit at J + 360°·k/L, for k = 0…L−1. G71 holes sit at J + K·k.
- Unconfirmed:
  - Whether G72's first hole is at the current position or one I step away. **Recommended:** follow [HFO26]: the first hole is at the current position, which a previous L0 left undrilled, so G72 drills holes 1…L starting there.
  - Where XY ends after the pattern. **Recommended:** at the last hole.
  - Setting 28 "has no effect on G72 cycles" [OM20 p. 447]. Its exact meaning is unclear.

### 3.25 Canned cycles: common rules (group 09) — [OM20 pp. 303–307, 209–210, 356, 367–368; Settings 22, 27, 28, 52, 57, 130 pp. 446–460; WB05 pp. 70–72]

**Sequence for every cycle**

1. Rapid in X/Y (and on the classic control, optional A) to the hole position.
2. Rapid in Z to the R plane.
3. The cycle's Z operation.
4. The bottom-of-hole action.
5. Retract to R (G99) or to the initial point (G98).

**Required words:** Z, R and F are "required data for all canned cycles" [OM20 p. 305]. An S must be programmed in or before the cycle block.

**Plane:** the cycles act along Z in G17 (§3.8).

**When the definition block drills** [OM20 p. 303; Setting 28]:

- With an X/Y in the cycle block, the cycle runs there.
- With no X/Y:
  - Setting 28 **ON** (Haas's preferred setting): the cycle runs once at the current XY.
  - Setting 28 **OFF**: nothing runs until an X/Y appears.
- **`L0` in the cycle block:** no cycle runs in that block, whatever Setting 28 says and whether or not X/Y is present. Use it for obstacle-avoidance moves and bolt-pattern centres (Haas example: `X5.5 L0`).

**While a cycle is active:**

- **Every block with a new X and/or Y position runs the cycle again** after a rapid positioning move.
- Z or R in such a block replace the stored values for that hole and the holes after it.
- G98/G99 can be changed at any time; the change applies to the next holes.
- Unconfirmed:
  - A block with only Z, only R, or only a rotary word (no X/Y). **Recommended:** update the stored Z/R; do not drill; position rotary axes without drilling.
  - A block with only an M/S/F/T word. **Recommended:** no hole.

**G91 and L** [OM20 pp. 193, 303]:

- With G91, X/Y are increments, and **L repeats "move by the increment, then run the cycle" L times**. Example: `G91 X-0.5625 L9` drills 9 more holes in a row.
- The Haas text describes L only for G91. L in G90 is unconfirmed. **Recommended:** repeat the cycle L times at the same position.
- The L range on the classic control is 0–32767 [WB05 p. 26].

**Z and R in G91** (unconfirmed on Haas; Fanuc convention):

- R = distance from the initial point to the R plane.
- Z = distance from the R plane to the hole bottom.
- Support from the Haas examples: `G99 G91 G81 F8.15 X1.25 Z-0.3 L5`, started from Z0.1 with **no R**, drills 0.2 deep [OM20 pp. 191–193]. That matches R = 0 (R plane at the initial level) and Z measured from R.
- **Recommended:** if R is missing in G91, use R = 0. If R is missing in G90, raise an alarm. Haas lists R as required; the alarm number is unconfirmed.

**Initial point and return** [OM20 pp. 210, 304, 367; WB05 p. 72]:

- Initial point = **the Z position in the block before the cycle**, i.e. Z when the cycle was first defined.
- G98: return to the initial point after each hole. G99: return to the R plane.
- G77 always behaves as G98 (§3.29).

**XY moves** between holes are rapids. With **Setting 57** ON, X/Y must reach their exact position before Z moves.

**Cancelling:**

- **G80, G00 and G01** cancel all canned cycles.
- G02/G03 are not named. **Recommended:** they also cancel (Fanuc convention); unconfirmed.
- [RESET] cancels the cycle P. Whether it cancels the cycle itself when Setting 56 is OFF is unconfirmed. **Recommended:** cancel.

**Spindle** (G76, G77, G81, G82, G86, G89, and the classic G83):

- The cycle uses the **last spindle command** (M03/M04/M05).
- With no command yet, **M03** is assumed.
- With **M05** the cycle runs "no-spin". Haas warns this can cause a crash.
- G74/G84 start and stop the spindle themselves.

**E word** (G81, G82, G83, G84): "chip-clean RPM". After each cycle the spindle reverses at that speed to throw off chips. The exact motion and timing are unconfirmed.

**Scaling** (§3.16) scales the initial point, depth and R plane, but not peck Q/I/J/K or the G76/G77 Q shift.

### 3.26 G73 High-speed peck drilling — [OM20 pp. 350–351; Setting 22 p. 446]

- Words: F, I (first peck), J (reduction per peck), K, L, P (dwell at the bottom, seconds), Q (peck, always incremental), R, X, Y, Z.
- **I, J, K and Q are always positive.**
- Three modes:
  - **I, J, K:** the first peck is I; each next peck is J smaller; the minimum peck is K. Between pecks the drill **backs off by Setting 22** (Can Cycle Delta Z) to break the chip, then feeds on.
  - **K and Q:** pecks of Q with a Setting 22 back-off. Each time the accumulated depth reaches **K**, the drill **returns to the R plane**.
  - **Q only:** equal pecks of Q with a Setting 22 back-off. The drill returns to R only after **all** pecks are done.
- At Z: dwell P if given, then retract per G98/G99.

### 3.27 G74 Reverse tapping — [OM20 pp. 351–352; Setting 130 p. 460; WB05 p. 71]

- Words: F, J (retract multiple), L, R, X, Y, Z.
- Left-hand thread. The spindle turns CCW going in, reverses at Z, and feeds out [WB05 table].
- Feed: F (mm/min) = RPM × pitch (mm). In inch, F (in/min) = RPM ÷ TPI [OM20 p. 304].
- J and Setting 130 work as for G84 (§3.32).

### 3.28 G76 Fine boring — [OM20 pp. 352–353; Setting 27 p. 446; WB05 p. 71]

- Words: F, I, J, L, P (dwell), Q (shift, always incremental), R, X, Y, Z.
- Sequence: feed to Z, dwell P, **spindle stop and orient**, **shift away from the wall**, rapid out [WB05 table]. [OM20] confirms the shift before retract; the orient comes from [WB05].
- **Shift:**
  - If Q is given, its direction comes from **Setting 27** (X+, X−, Y+, Y−).
  - Without Q, the optional **I/J** give both the shift direction and the distance (X and Y components).
- That the tool shifts back and the spindle restarts after the retract is standard behaviour but unconfirmed.

### 3.29 G77 Back boring — [OM20 pp. 353–355; WB05 p. 71]

- Words: F, I, J, L, Q, R, X, Y, Z. Shift direction: Setting 27 (or I/J).
- **R is negative and must be below the bottom of the part.** Z is measured from the active work offset.
- **G98 is assumed automatically.**
- Haas example: R−1.6 below a 1.0-thick part, Q0.1, Setting 27 = X+.
  - At the R depth the tool moves 0.1 in X.
  - It feeds up to Z.
  - It shifts back toward the hole centre and retracts.
- Classic sequence [WB05]: spindle stop, orient, shift, rapid in, shift back, feed up, then orient, shift and rapid out.
- The two sources disagree about which position is on centre, so the exact shift order is **unconfirmed**. **Recommended:**
  1. Orient.
  2. Shift by −Q.
  3. Rapid to R.
  4. Shift back to the centre.
  5. Start the spindle.
  6. Feed up to Z.
  7. Stop and orient.
  8. Shift by −Q.
  9. Rapid to the initial point.
  10. Shift back.

### 3.30 G80 Cancel / G81 Drill / G82 Spot drill — [OM20 pp. 356–359]

- G80 cancels every canned cycle.
- **G81** (words E F L R X Y Z): rapid to R, feed to Z, rapid back to R or the initial point.
- **G82** (words E F L P R X Y Z): the same as G81 plus a dwell P at the bottom.

### 3.31 G83 Normal peck drilling — [OM20 pp. 359–361; Settings 22, 52 pp. 446, 451; WB05 p. 75]

- Words: E, F, I, J, K, L, P, Q, R, X, Y, Z.
- **Q mode:**
  1. Feed one peck of Q.
  2. **Rapid back to R.** If Setting 52 > 0, go to R + Setting 52 instead.
  3. Rapid down to **Setting 22 above the previous peck bottom**.
  4. Feed the next peck.
  5. Repeat until Z.
- **I/J/K mode:** the first peck is I, each next is J smaller, the minimum is K. **Do not use Q with I/J/K.**
- P = pause at the end of the last peck. It stays in force for later blocks that do not give P.
- Retract per G98/G99.
- What happens when Q and I are given together is unconfirmed. **Recommended:** alarm.

### 3.32 G84 Tapping — [OM20 pp. 361–362; Settings 130, 133 pp. 460–461; Setting 84 note p. 455]

- Words: E, F, J (retract multiple), L, R, X, Y, Z, S.
- **No M03/M04 is needed. The cycle starts and stops the spindle itself.**
- Feed: F (mm/min) = RPM × pitch. Haas example (inch): 900 RPM ÷ 16 TPI = 56.25 in/min.
- **Rigid tapping** (a Haas option): spindle speed and feed are synchronised. At Z the spindle reverses, and the tap feeds out at J × the in-feed rate.
  - J overrides Setting 130 "Tap Retract Speed". J2 = twice as fast.
  - Setting 130 = 0 or 1 has no effect.
- Feed and spindle overrides are locked out while tapping, rigid or floating.
- Setting 133 "Repeat Rigid Tap" orients the spindle so a second pass follows the same thread. It must be ON for peck tapping.
- **Floating (non-rigid) tapping:** Haas mentions it only in passing ("rigid or floating", p. 455). No floating-mode sequence is documented. **Recommended:** the simulator always has rigid tap. If floating is ever modelled, use feed in, reverse the spindle, feed out, without synchronisation.
- With G98, whether the retract goes at feed all the way to the initial point or at feed to R and then rapid to the initial point is unconfirmed. **Recommended:** feed to R, then rapid to the initial point.

### 3.33 G85 / G86 / G89 Boring — [OM20 pp. 209–210, 363–365; WB05 p. 71]

- **G85** (F L R X Y Z): feed in, **feed out**.
- **G86** (F L R X Y Z):
  - Feed in.
  - **The spindle stops at the bottom.** The tool retracts only after the spindle has stopped, at rapid [WB05].
  - Whether the spindle restarts after the retract is unconfirmed. **Recommended:** restart it in the previous direction when the tool reaches R or the initial point (Fanuc behaviour).
- **G89** (F L P R X Y Z): feed in, **dwell P**, then **feed out**.
  - [OM20] says it keeps boring at the feed rate while returning.
  - The classic [WB05] table says "rapid out". Follow [OM20].

### 3.34 G90 / G91 Absolute / incremental (group 03) — [OM20 pp. 190–193, 365; Setting 29 p. 447]

- G90: positions are relative to the origin of the active work system. G91: positions are relative to the current position.
- **Setting 29 "G91 Non-modal" ON:** G91 applies only to its own block. It must be OFF for G47.
- G91 cannot be used with G143.
- I/J/K of arcs are always incremental (§3.3).

### 3.35 G92 Work system shift (group 00) — [OM20 pp. 365–366]

- No motion.
- With either Setting 33 option (FANUC or HAAS), G92 shifts **all** work systems (G54–G59, G110–G129) so that the **commanded position becomes the current position** in the active system.
- The shift value shows at the bottom of the Work Offsets page.
- **Cleared:** at power-up, by [ZERO RETURN]+[ALL] or [ZERO RETURN]+[SINGLE], or by hand on that page.
- To undo it in a program, give the reverse G92. Haas example: `G92 X2. Y2.`, then later `G92 X-2. Y-2.`
- G92 **cancels G52** for the axes named in the block. Example: `G92 X1.4` clears only the X part of G52.

### 3.36 G93 / G94 / G95 Feed modes (group 05) — [OM20 p. 366; Settings 34, 79 pp. 448, 454]

- **G93 inverse time:**
  - F = "strokes per minute". The block takes 60/F seconds.
  - **Every feed block must carry its own F.**
  - Settings 34 and 79 (rotary diameters) are not needed.
  - **[RESET] sets G94.**
- **G94 feed per minute** (mm/min or in/min):
  - For rotary moves the control turns the linear feed into an angular rate using Setting 34 (A diameter) and Setting 79 (5th-axis diameter).
- **G95 feed per revolution** (mm/rev in MM, in/rev in INCH):
  - Spindle override changes the feed with it, so the chip load stays the same.
  - Feed override changes only the feed.

### 3.37 G98 / G99 Canned cycle return (group 10) — [OM20 pp. 210, 367–368]

See §3.25. Default G98 [WB05].

### 3.38 G100 / G101 Mirror image (group 00, state persists) — [OM20 p. 369; OL-G "Mirror Image"; Settings 45–48, 80, 250]

- `G101 X0.` turns on mirroring of the X axis; `G100 X0.` turns it off. Same for Y, Z, A, B, C.
- Motion is mirrored about the work zero point [OM20].
- [OL-G] now says the **pivot point is the value of the axis word**, e.g. `G101 X25.` would mirror about X25 (our reading). **Recommended:** use the newer pivot = word value. Old programs always use `X0.`, so they behave the same either way.
- Put G100/G101 in a block **without other G-codes**. They cause **no motion**.
- The display shows which axes are mirrored.
- Settings 45, 46, 47, 48, 80 and 250 mirror X, Y, Z, A, B and C permanently.
- Mirroring one of the two plane axes reverses arc direction (G02↔G03) and comp side (G41↔G42). This is standard practice; Haas does not state it.

### 3.39 G103 Limit block look-ahead (group 00, state persists) — [OM20 pp. 250, 370]

- P = 0–15 blocks. `G103` or `G103 P0` = no limit.
- Macro expressions are evaluated at look-ahead time. `G103 P1` evaluates them one block ahead; Haas advises a few empty blocks after it.
- G103 affects cutter comp and high-speed machining.
- Its P loads the shared P register (§3.4).
- A block starting with `/` also stops look-ahead, even when Block Delete is off [OM20 p. 250].

### 3.40 G107 Cylindrical mapping (group 00, state persists) — [OM20 p. 371; example p. 337]

- Turns linear-axis motion into motion on the surface of a cylinder on a rotary axis, one rotary axis at a time.
- Words: the axis pair (e.g. `A0. Y0.`), **R** = cylinder radius or **Q** = cylinder diameter.
- `G107` alone switches mapping off.
- Although it is group 00, its default state follows **Setting 56**.
- The diameter can follow Settings 34/79 or be set on its own. G107 can also set the default cylinder diameter without starting mapping.
- Haas example: `G107 A0. Y0. R0.75` maps Y onto A on a 0.75 radius (inch only), used with G47. The detailed mapping maths is unconfirmed.
- The axis pair is read as: the rotary word names the axis to map onto, and the linear word names the axis to map. The meaning of the values (start angle and start position) is unconfirmed.

### 3.41 G141 3D+ cutter compensation (group 07) — [OM20 pp. 374–377]

- Format: `G141 X Y Z I J K F D`. Following blocks are `G01 X Y Z I J K F` or `G00 X Y Z I J K`.
- **Only G00/G01** are allowed.
- D is modal and selects the diameter **wear**/size row.
- In G93 every block needs F.
- **I J K = the unit normal** from the tool centre to the contact point (length 1).
- Only the block **end point** is offset along IJK, by geometry + wear (half of it in diameter mode).
- No self-intersection check.
- To offset along an axis, that axis word must be present (example: a Y word is needed for J).
- G40 cancels.

### 3.42 G143 5-axis tool length compensation (group 08) — [OM20 pp. 377–378; Setting 117]

- Only for machines where **all rotary motion is in the tool** (VR series). **Not for the UMC-500.**
- Needs H, two rotary axes A and B, and **G90 only**. G49 or H00 cancels.
- Only G00/G01; no G02/G03 and no canned cycles.
- An axis with no word in the block does not move.
- G93 is recommended.
- Setting 117 adds a global pivot-length offset.

### 3.43 G150 General purpose pocket (group 00) — [OM20 pp. 378–386]

| Word | Meaning |
|---|---|
| D | Tool radius/diameter offset |
| F | Feed |
| I or J | Roughing step-over in X (I) or Y (J), positive |
| K | Finish allowance on the walls. The last pass at final Z. |
| P | Number of the geometry subprogram |
| Q | Z depth per pass, incremental from R, positive. **Must be in the block**, even for one pass. |
| R | Rapid R plane. **Give it every time.** If omitted, the last R is used. |
| S | Spindle speed (optional) |
| X Y | Start point. Must be **inside** the closed contour. |
| Z | Final depth |

- `G41`/`G42` may be in the block. Haas examples follow with `G40 X… Y…`.
- **Subprogram:**
  - Searched first as a local N-number, then as an external program. If neither is found: **Alarm 314 "Subprogram Not In Memory"**.
  - G01/G02/G03 in X/Y only, **at most 40 moves**, **no macro variables**.
  - Must be a closed shape. Do not move back to the start hole after closing it.
- A start point outside the contour or an open contour gives **Alarm 370 "Pocket Definition Error"** [OL-G].
- Sequence: plunge in Z from R by Q. Cut around the contour leaving K. Rough the inside in I or J steps. Repeat for each Q until Z. Then make the finish pass at full depth.

### 3.44 G156 Broaching (group 09) — [OM20 pp. 388–391]

- Words:
  - Z: total peck depth.
  - X/Y (optional): furthest slice position.
  - I: slice increment. The last slice may be shorter.
  - K: peck increment.
  - F: feed.
  - C: C-axis position (may be in or before the block).
  - D: X clearance shift before the Z return. Its sign gives the direction.
- **Orient the spindle with M19 first, in a separate block** (P/R not negative).
- An alarm is raised if any spindle rotation is commanded during the cycle, or if the spindle is still turning when the pecks start.
- The cycle is modal. Later blocks that contain broaching words run it again.
- Cancel with G80 (example: `G00 G80`).
- Rarely used in training. **Recommended:** low priority.

### 3.45 G167 Modify setting (group 00) — [OM20 pp. 391–392]

- `G167 P<setting> Q<value> [K<guard>]`. The change is **permanent**.
- Q is a number, or the enumeration index for settings without units.
- An alarm is raised if P or Q is missing, P is not a valid setting, or Q is not valid for that setting.
- Haas examples use `K10755`.
- Example: `G167 P84 Q3 K10755` sets Setting 84 to AUTOFEED.

### 3.46 G174 / G184 Non-vertical rigid tap (group 00) — [OM20 p. 392]

- G174 = CCW, G184 = CW.
- Words: F, X Y Z = hole bottom, S.
- **The start position is the X Y Z A B position programmed before the block.** The tap moves along the line from there to the bottom.
- F/S must equal the thread pitch exactly. The spindle is started automatically.
- Used with a right-angle head or on 5-axis machines.

### 3.47 G187 Accuracy control (group 00, state persists) — [OM20 p. 393; Settings 85, 191 pp. 456, 463]

- `G187 Pn Ennnn`:
  - P1 rough, P2 medium, P3 finish. This temporarily overrides **Setting 191** (factory default MEDIUM).
  - E = maximum corner rounding. This temporarily overrides **Setting 85** (default 0.0250 inch).
- `G187 Pn` changes only the smoothness. `G187 E…` changes only the corner value.
- **`G187` alone** clears E and restores the Setting 191 smoothness.
- **Cancelled by** [RESET], M30, M02, the end of the program, and [EMERGENCY STOP].
- Classic E range: 0.0001–0.25 (inch only) [WB05 p. 25].
- For simulation, corner rounding affects path and time only. **Recommended:** model corners with a blend radius ≤ E.

### 3.48 G234 TCPC (group 08) — [OM20 pp. 393–397, 239–240]

- `G234 Hnn`. **The H must be in the same block**, because G234 cancels the previous H.
- Needs an active work offset (G54…).
- The control combines the MRZP (Settings 255–257) with the work offset. It keeps the program coordinate system fixed to the rotating table, so a single-axis Y move becomes an interpolated X/Y/Z move when B/C are rotated.
- **G234 cancels G43.** Exactly one of G43 or G234 must supply tool length.
- **Cancelled by:** [EMERGENCY STOP], [RESET], [HANDLE JOG], [LIST PROGRAM], M02, M30, G43, G44, G49.
- **Not cancelled by** M00 or M01.
- **Ignored by** G28, G29, G53 and M06.
- **Cannot be active together with G254.**
- Turning on TCPC rotates the work envelope and can cause an over-travel alarm near the limits. Haas advises positioning near the work offset centre first.
- Haas suggests G93 for TCPC programs (example startup line `G00 G17 G40 G80 G90 G94 G98`). This is optional.
- [SNIP] (unconfirmed): G268 must come **before** G234, otherwise **Alarm 2062 "TCPC OR DWO INCOMPATIBLE CODE"**.
- UMC-specific details (MRZP, axis configuration) are in the UMC file.

### 3.49 G253 Orient spindle normal to FCS (group 00) — [OM20 p. 397]

- Rotates the rotary axes so the spindle is perpendicular to the active feature coordinate system.
- **Only allowed while G268 is active.** The alarm otherwise is unconfirmed.
- Haas example order: `G268 … I J K Q`, then `G253`, then `G00 X0 Y0 Z.5`, then the cycle, then `G269`.
- Whether G253 also moves the linear axes is unconfirmed. **Recommended:** move B/C only, and require the program to recall X/Y/Z afterwards, as in the example.

### 3.50 G254 / G255 DWO (group 23) — [OM20 pp. 398–401]

- G254 corrects for the difference between the programmed and actual workpiece location during **3+1 or 3+2 positioning**. It is not for simultaneous work.
- **The B value of the work offset used must be 0.**
- **Rules:**
  - Command the work offset first. All rotary motion must be finished before G254.
  - After G254, and after any later rotary move, program X, Y and Z before any cutting move. Put X/Y in one block and Z in a separate block, even if they repeat the current position.
  - Retract with G53 before rotary moves.
  - Cancel with G255 before any rotary motion and before simultaneous 4/5-axis work.
- **Cancelled by:** [EMERGENCY STOP], [RESET], [HANDLE JOG], [LIST PROGRAM], G255, M02, M30.
- **Not cancelled by** M00 or M01.
- **Ignored by** G28, G29, G53 and M06. Haas strongly advises against G28/G29 while G254 is active.
- Cannot be combined with G234.

### 3.51 G266 Single-axis linear rapid % (group 00) — [OM20 p. 402]

- `G266 E<rapid %> P<axis> I<machine position>`. Axis numbers: P1 = X, P2 = Y, P3 = Z. The numbers for A/B/C are unconfirmed.
- Haas example: `G266 E10. P1 I-1`, which moves X to machine X−1. at 10% rapid.
- Note: the example's I has no decimal point. Under the decimal rules (§4.4) that would be −0.0001 in. The meaning intended is −1.0, so always write a decimal point.

### 3.52 G268 / G269 Feature coordinate system (group 14 [OL-G]; 02 in [OM20]) — [OM20 pp. 402–404; OL-G]

| Word | Meaning |
|---|---|
| X Y Z | FCS origin, given in the active work coordinate system |
| I J K | Rotation of the FCS about the WCS X, Y and Z axes (optional) |
| Q | Order of the rotations. **Default Q321 = about Z, then Y, then X.** Q123 = about X, then Y, then Z. |

- **G43 must be active before G268.** The FCS transform is applied separately from the tool length offset.
- **G268 causes no motion.** After G268, re-command the current position (X Y Z) before moving.
- **Two ways to define the FCS:**
  1. Rotate B/C first, then `G268 X Y Z` with no I/J/K. The FCS plane is normal to the spindle at that moment.
  2. `G268 X Y Z I J K [Q]`. This allows a plane that is not normal to the spindle.
- Canned cycles and other G-codes work normally inside the FCS.
- **G269** cancels and returns to the WCS.
- Unconfirmed:
  - Whether the I/J/K rotations are about fixed WCS axes (extrinsic) or about the moving axes (intrinsic). **Recommended:** fixed WCS axes, applied in the Q order.
  - Availability. [SNIP] says a Haas service page limits G268/G269 to head-head machines and UMCs. The UMC supplement lists them for the UMC.

---

## 4. Interpreter essentials

### 4.1 Default modal state (power-up, and M30/[RESET] with Setting 56 ON) — [OM20 pp. 200, 323, 366, 393, 444, 451; WB05 p. 18; OL-PS; HFO26 p. 7]

| Group | Default | Source |
|---|---|---|
| 01 | G00 | [WB05 p. 18] (classic) |
| 02 | G17 | [OM20 p. 323] |
| 03 | G90 | [WB05] |
| 05 | G94 | [WB05]. [RESET] always forces G94 [OM20 p. 366]. |
| 06 | G20 if Setting 9 = INCH, G21 if MM | [OM20 p. 444] |
| 07 | G40 | [OM20 p. 200] |
| 08 | G49, **but see §3.14**: on current software the tool offset and its group 08 code survive power cycles | [WB05]; [OL-PS]; [HFO26] |
| 09 | G80 | [WB05] |
| 10 | G98 | [WB05] |
| 11 | G50 | [WB05] |
| 12 | G54 | [WB05] |
| 14 | G269 | inferred |
| 15 | G64 | [WB05] |
| 16 | G69 | [WB05]. The G68 angle is also reset at program start [OM20 p. 345]. |
| 23 | G255 | inferred |
| G107 | off | follows Setting 56 [OM20 p. 371] |
| G187 | Setting 191 smoothness, Setting 85 corner value | [OM20 p. 393] |

- There is no default F or S. Once given, they stay until changed or until power-off [WB05 p. 18].
- **Setting 56 "M30 Restore Default G":**
  - ON: ending with **M30 or pressing [RESET]** returns **all modal G-codes** to the defaults above [OM20 p. 451].
  - OFF: modal codes carry over, except the items that are always reset (§4.2).

### 4.2 What [RESET] and M30 do to G-code state — [OM20 pp. 39, 304, 337, 343, 366, 393, 396, 401, 415, 447–457]

| Item | [RESET] | M30 | Source |
|---|---|---|---|
| All modal G-codes to defaults | if Setting 56 ON | if Setting 56 ON | [OM20 p. 451] |
| G93 → G94 | always | per Setting 56 | [OM20 p. 366] |
| G187 → Setting 191/85 | always | always (also M02, end of program, E-stop) | [OM20 p. 393] |
| G234 TCPC | cancelled | cancelled (also M02) | [OM20 p. 396] |
| G254 DWO | cancelled | cancelled (also M02) | [OM20 p. 401] |
| G52 (Setting 33 = FANUC) | cleared | cleared | [OM20 pp. 343, 448] |
| Tool length offset G43/G44 | cancelled [OM20 p. 337] | **not** cancelled since 100.16.000.1041 [OM20 p. 415]. On current software offsets are always applied (§3.14). | |
| Canned-cycle P (dwell) | cleared | – | [OM20 p. 304] |
| Program pointer | to the top if Setting 31 ON | to the top | [OM20 p. 447]; M30 per `mcode.md` |
| Overrides | to 100% if Setting 88 ON | to 100% if Setting 83 ON | [OM20 pp. 455–457] |
| Alarms and input text | cleared | – | [OM20 p. 39] |
| G92 shift | kept (cleared at power-up and by Zero Return) | kept | [OM20 p. 365] |
| G68 angle | – | reset at the next program start | [OM20 p. 345] |
| Cutter comp / canned cycle when Setting 56 OFF | unconfirmed; **recommended:** cancel (G40/G80) | unconfirmed; recommended: cancel | – |

- M30, M00, M01 or M02 reached **with G41/G42 active** raises an alarm (§3.13).
- `H0` / `G49` / [RESET] cancel tool length comp (classic text).

### 4.3 Block structure and parsing — [OM20 pp. 42–43, 187, 250, 302; OL-M; WB05 pp. 10–11, 24–27]

- **End of block:** `;` (EOB). In a file, each line is one block. **Recommended:** treat both `;` and a newline as EOB, and ignore anything after `;` on the same line (unconfirmed).
- `%` lines start and end a program file and are not executed.
- The first block is `Onnnnn`: a letter O followed by 5 digits. A program name may follow in parentheses.
- **Comments** are written in `( … )` and must come in pairs. They are not executed.
  - **Exception:** G47 P0/P1 reads the comment text in its own block (§3.15).
  - The comments in the first lines are the program's display name.
- **Block delete `/`:**
  - With Block Delete ON, the control does not execute what follows the `/` on that line. Haas's own use is `/` at the start of the block.
  - A `/` stops look-ahead even when Block Delete is OFF.
  - Inside a macro expression `/` means divide, so only a `/` at the start of a block (after an optional N) should be read as block delete. That is our recommendation.
- **N numbers** are optional (classic range 0–99999). They are targets for M97, M99 Pnnnn and the G150 P search.
- **Several G-codes per block** are allowed if they come from **different groups**. **Two G-codes from the same group in one block are not allowed** [OM20 pp. 187, 302]. The alarm number is unconfirmed.
  - **Recommended:** raise an alarm for two modal codes of the same group, and for two motion-producing group 00 codes (e.g. `G28 G53`).
  - Accept the usual group 00 + modal combinations, e.g. `G53 G49 Z0`, `G28 G91 Z0`, `G10 L2 P1 G91 X…`.
- **One M-code per block. M-codes take effect at the end of the block**, after the motion [OL-M; WB05 p. 10]. A second M-code raises an alarm (number unconfirmed).
- Leading zeros may be dropped (`G0` = `G00`, `M1` = `M01`), but trailing zeros may not (`G7` ≠ `G70`) [WB05 p. 11; VPS output in OM20 p. 225 uses `G0`].
- A `+` sign is optional; `-` is required.
- G-numbers with decimals (G68.2, G43.4, …) do not exist on Haas. Reject them.
- **Order within a block** (no source; recommended, Fanuc-like):
  1. Comments, N.
  2. F, S, T, D, H values.
  3. Mode G-codes: groups 02, 03, 05, 06, 10, 11, 12, 15, 16, then 07 and 08.
  4. Group 00 functions.
  5. Motion (group 01/09) with the block's axis words.
  6. The M-code last.

### 4.4 Numbers and decimal points — [OM20 Settings 9, 77, 162 pp. 444, 454, 462; G04 p. 318; G65 p. 254; WB05 pp. 24–27]

| Word | With a decimal point | Without a decimal point |
|---|---|---|
| X Y Z (and U V W) | Value in mm (or in) | **Setting 162 "Default To Float" OFF:** last digit = 0.001 mm (0.0001 in). `X-2` = −0.002 mm / −0.0002 in. **ON:** read as if there were a decimal point, so `X-2` = −2. |
| A B C | degrees | Setting 162 applies to A B C. On the classic control the last digit was 0.001° [WB05]. |
| I J K E | as written | Setting 162 lists I J K E as affected. **E conflict:** Setting 162 treats E like an axis word, but the G65 table passes E as an integer. Unconfirmed. **Recommended:** follow Setting 162. |
| R Q | as written | Not in the Setting 162 list. The G65 table scales them like axis words. **Recommended:** treat them like X. |
| F | as written | **Setting 77 "Scale Integer F"** (`F10` as the example): DEFAULT → 0.0100 mm/min (0.0010 in/min); INTEGER → 10.; `.1` → 1.0; `.01` → 0.10; `.001` → 0.010; `.0001` → 0.0010. Setting 162 does not affect F. |
| P (G04 / canned-cycle dwell) | seconds | **G04: milliseconds** (`P10` = 10 ms). Canned-cycle P without a decimal point is unconfirmed. **Recommended:** the same as G04. |
| P (program / N / G154 / G103 / setting), L, N, O, D, H, T, M, S, G | – | integers |

- Resolution and minimum input are 0.001 mm or 0.0001 in, and rotary axes 0.001° (classic) [OM20 p. 444; WB05].
- The factory default of Setting 162 is unconfirmed (see `settings-alarms.md`). **Recommended:** the Setting 162 OFF behaviour, which is traditional machinist notation.
- **Confirmed word ranges:**
  - D and H offsets 1–200 (`H0`/`D0` = cancel or zero).
  - G154 P1–P99; G103 P0–15; G51 P 0.001–999.999; G68 R ±360.000.
  - G47 I ±360, P 0/1/32–126; G70 J 0–360; G187 P1–3; Setting 44 1–100%.
  - G65 nesting 9 levels; `#3000` alarms 1–999.
- **Classic ranges** (unconfirmed for NGC) [WB05 pp. 24–26]: N 0–99999, L 0–32767, dwell P 0.001–1000.0 s, Q 0.001–100.0 (inch only), S 1–99999, G187 E 0.0001–0.25 (inch only).

### 4.5 Modality of address words — [OM20 pp. 268–269, 304, 309, 318, 320; WB05 p. 18]

- **F** is modal across all feed moves. G93 needs F in every block. No F before the first feed move → alarm (number unconfirmed).
- **S** is modal. It must be set in or before a canned-cycle block.
- **D** is modal. G12/G13 use the last D even after G40. G141 D is modal.
- **H** is modal with G43/G44 (G234 needs its own H).
- **P** is one shared modal register for G04, M97, G103, G154 and the canned cycles. It is cleared by G00, G01, G80 and [RESET] (§3.4).
- **Canned-cycle Z, R, Q, I, J, K, E, J (tap)** are kept while the cycle is active. A block with only X/Y re-uses them.
- #4101–#4126 hold the last interpreted value of each address A–Z (except G). For example, D is in #4107 and I in #4104.

### 4.6 Arc checks (summary) — [OM20 pp. 207, 310–311; SNIP]

- **Allowed centre words:** only those of the plane (§3.3). **Recommended:** alarm on I/J/K of another plane (unconfirmed).
- **Full circle:** I/J/K only, with no end point. R with start = end → alarm (recommended).
- **Radius mismatch** (I/J/K form): a Haas alarm "304 Invalid I, J, or K in G02 or G03" exists according to [SNIP]. Tolerance unconfirmed; we suggest 0.0025 mm.
- **R form:** a chord longer than 2|R| → alarm.
- **Comp:** arcs in G17 only. An inside arc radius smaller than the comp radius → alarm. Comp cannot start or end on an arc.

### 4.7 Canned cycle plus axis-only blocks (summary) — [OM20 pp. 303–305, 356]

- While a group 09 cycle is active, **any block with X and/or Y runs the cycle** at the new position, after rapid positioning in XY, **unless that block has L0**.
- G91 + L repeats it L times.
- G00, G01 or G80 end the cycle.
- A Z/R/rotary-only block: unconfirmed (§3.25).

### 4.8 Offsets data model (for G10, G52, G92, G54…, macros) — [OM20 pp. 265, 269–271, 319, 365]

| Data | Size | Variables |
|---|---|---|
| Tool length geometry H / wear | 200 each | #2001–#2200 / #2201–#2400 |
| Diameter/radius geometry D / wear | 200 each | #2401–#2600 / #2601–#2800 |
| G52 shift | X Y Z A B C | #5201–#5206 |
| G54–G59 | 6 × 6 | #5221–#5326 (20 apart) |
| G154 P1–P99 (P1–P20 = G110–G129) | 99 × 6 | #14001–#15966 (20 apart); legacy #7001–#7386 for P1–P20 |
| G92 shift | per axis | page footer only; no variable documented |
| Current work position / machine position / skip / total TLC | – | #5041–#5046 / #5021–#5026 / #5061–#5069 / #5081–#5086 |

Reading any work-offset variable stops look-ahead until that block runs [OM20 p. 270].

---

## 5. Not confirmed (summary)

1. Most power-up defaults come from the 2005 classic workbook, not an NGC source: G00, G90, G49, G50, G54, G64, G69, G80, G98, G94. G255 and G269 are inferred. Only G17, G40, G20/G21 (Setting 9) and RESET→G94 are stated for NGC.
2. Group number of G268/G269: 02 in [OM20], 14 in [OL-G]. We use 14.
3. Alarm numbers and texts for:
   - two G-codes of the same group;
   - more than one M-code;
   - an invalid G-code;
   - a G20/G21 mismatch;
   - G21 with Setting 9 = INCH;
   - missing F;
   - an R-form arc that cannot be made;
   - a G01 corner error;
   - comp start or stop on an arc;
   - comp still active at M30/M00;
   - G253 without G268.
4. Arc radius-mismatch tolerance, and the exact alarm 304 text (seen only in [SNIP]).
5. Alarm 2062 and the rule that G268 must precede G234 (seen only in [SNIP]).
6. EOB handling: text after `;` on a line, and `;` versus newline.
7. Mid-line `/` block delete (Haas says it ignores the code after `/` on the line).
8. Canned cycles in G91: R measured from the initial point and Z from R. Behaviour when R is missing.
9. L in G90 canned cycles. Z-only, R-only and rotary-only blocks while a cycle is active. Whether G02/G03 cancel a canned cycle.
10. Whether RESET cancels G41/G42 and the canned cycle when Setting 56 is OFF.
11. G12/G13: XY end position, lead-in/lead-out geometry, X/Y centre words on NGC, and how Z is fed in G90.
12. G72: whether the first hole is at the current position (only [HFO26] says so), and where XY ends after G70–G72.
13. G76/G77: spindle orientation and shift-back order (the [OM20] and [WB05] descriptions of G77 differ). G86 spindle restart. G84 retract speed from R to the initial point under G98. The floating-tap sequence.
14. E chip-clean RPM: exact motion.
15. G10:
    - whether G90/G91 in the block stays modal;
    - whether L12/L13 values are radius or diameter;
    - P-range errors.
16. G43 when the block has no Z word: is the offset applied at once or on the next Z move.
17. Whether G28 cancels G43 on NGC.
18. G29 with no G28 before it.
19. G53 together with G91.
20. G52 in G91.
21. G60 direction for all axes.
22. Factory default of Setting 162 (decimal handling). Integer handling of E, R, Q and canned-cycle P.
23. G101 pivot: [OM20] says work zero; [OL-G] says the value of the axis word.
24. G107 mapping maths and the meaning of its axis-word values.
25. G266 axis numbers for A/B/C.
26. G268: whether I/J/K rotations are extrinsic or intrinsic, and which machines support it.
27. G253: does it also move the linear axes.
28. Order of transforms (rotation, scaling, mirror versus offsets).
29. How the feed is defined for helical moves, and how A moves inside G02/G03.
30. The software version where "tool offsets always applied" started (100.21.000.1100 comes only from the secondary [HFO26]). No setting controls it as far as the [OL-S] list shows.
31. G87/G88: classic only. They are not in any NGC list; the behaviour if a program uses them is unconfirmed (recommended: invalid-code alarm).
