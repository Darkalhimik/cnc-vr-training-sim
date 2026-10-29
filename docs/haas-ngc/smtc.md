# UMC-500 side-mount tool changer (SMTC): what the simulator animates

The spec behind the animated tool change: where the carousel, the pocket and
the double arm are, the order they move in during an M06, how long it takes,
and which tool ends up in which pocket. Code semantics of M06 are in
`mcode.md` §5.3; machine data in `umc500.md` §4.4 and §8. Retrieved
2026-10-29. Status codes as in `umc500.md` (OFF, OFF-idx, SEC, DER, UNCONF).

## Sources

| ID | Source |
|---|---|
| [OM20] | Haas *Mill Operator's Manual – NGC*, 96-8210 (2020): §5.5.2 tool change (p.196), M06 (p.411), SMTC notes (pp.148–152), FEED HOLD (p.49). Read through `mcode.md` §5.3. |
| [UMC20] | Haas *UMC Series Operator's Manual Supplement – NGC*, 96-8250 Rev L: Setting 247 (p.33). Read through `umc500.md` §4.4. |
| [PDP-500] | Haas UMC-500 product page, Specs tab (OFF-idx, via `umc500.md` §8). |
| [SVC-SMTC] | Haas service pages, read only through a web-search index (OFF-idx): "Side Mount Tool Changer – Carousel and Pocket – Troubleshooting", https://www.haascnc.com/service/troubleshooting-and-how-to/troubleshooting/side-mount-tool-changer---carousel-and-pocket---troubleshooting-.html, and "Mill – Side Mount Tool Changer – Manual Recovery", https://www.haascnc.com/content/haascnc/en/service/troubleshooting-and-how-to/how-to/mill---side-mount-tool-changer---manual-recovery.html. A direct fetch of the recovery page returned **HTTP 403**; it was not worked around. |
| [CAD] | The Haas configurator CAD in `assets/cad/` ("UMC 500- 30 Pkt Tool Changer", "UMC-500- Tool Changer Arm Up"), measured by `tools/blender/build_umc500.py`. |

## 1. Layout (DER from [CAD])

Machine frame of the build script: metres, X right, Y away from the operator,
Z up, floor at 0, before the model is centred.

| Item | Value | Status |
|---|---|---|
| Carousel | A wheel on the left wall turning about an axis along X through (y −0.4105, z 1.742). 30 pockets on a 320.5 mm radius, 12° apart. | DER [CAD] |
| Pockets | Hold the tool level, taper towards the machine, cutter pointing out at the wall (−X). The pocket mouth (the tool's gauge line) is at x −1.014. | DER [CAD] |
| Station | The pocket at the bottom of the wheel, in line with the arm's axis (both at y −0.4105). | DER [CAD] |
| Double arm | Turns about a vertical axis at (x −0.611, y −0.4105). Its ends are 305.5 mm from the axis. At rest it lies along Y. | DER [CAD] |
| Tool-change position | With the arm turned along X, one end is over x −0.3055. The spindle is there at **X −610** (the −X end of travel) and **Y −82**, at **Z 0**. | DER [CAD] + `kinematics.ts` |
| Pocket down | The station pocket tilts a quarter turn about an axis along Y so its tool hangs vertically under the arm's other end, gauge line at the same height as the spindle's at Z 0. The pivot is chosen to make that so (x −0.933, z 1.438); the real pivot is not measured. | DER (pivot UNCONF) |

The CAD has the arm in its "up" (rest) position. Its plate grips about 35–80 mm
below the gauge line, on the holder body rather than in the V-flange groove;
that is how the CAD sits at Z 0 and is left as is.

## 2. Sequence of an M06

1. **Spindle and coolant off** [OM20 p.411].
2. **Z to machine zero**, then **X/Y to the tool-change position** (Setting 247
   OFF, Haas's recommended setting on UMCs [UMC20 p.33]). Rapids, like any
   other: the old tool is still in the spindle and sweeps the stock if it is
   driven through it.
3. **Carousel index** to the requested tool's pocket, the short way round.
   Haas pre-calls the next tool so this usually overlaps cutting [OM20 p.150];
   the simulator does it at the start of the change (§4).
4. **Spindle orients** [OM20 p.411].
5. **Swap** [OM20 p.411, as in `mcode.md` §5.3 step 6; SVC-SMTC]:
   pocket down (air cylinder, POCKET UP / DOWN sensors) → arm turns onto both
   tools → drawbar unclamps (the ARM AT CLAMP/UNCLAMP sensor confirms the arm
   is under the spindle first) → arm drops, pulling both tools → arm turns 180°
   → arm rises, inserting both → drawbar clamps → arm returns → pocket up.
6. Z stays at machine zero; nothing restarts on its own.

The tool that comes out of pocket *p* is replaced in *p* by the tool that was in
the spindle, so the pocket table drifts from T = pocket (Haas's pocket-tool
table is kept by the control for exactly this reason [OM20 pp.148–152]). A
fresh shift loads tool N in pocket N, with the spindle tool's pocket empty.

## 3. Time

| Item | Value | Status |
|---|---|---|
| Swap (tool-to-tool) | 2.8 s average, standard 30+1 SMTC | OFF-idx [PDP-500] |
| Chip-to-chip | 3.6 s | OFF-idx [PDP-500] |
| Carousel index | 0.12 s per pocket, so up to 1.8 s for 15 pockets | **UNCONF** (assumed) |
| Shares of the swap | pocket down 12 %, grip 16 %, unclamp 6 %, extract 12 %, 180° 20 %, insert 12 %, clamp 6 %, return 10 %, pocket up 6 % | **UNCONF** (chosen to read clearly) |
| FEED HOLD | stops a change in progress [OM20 p.49]; CYCLE START finishes it | OFF |

## 4. Not modelled / open

- Pre-call and look-ahead indexing (the carousel turning during the cut before
  an M06). Every change indexes on its own clock.
- Index direction of the real carousel, the arm's turning direction and its
  rest angle (the CAD shows it along Y; real arms often rest about 60–65° off
  the tools). UNCONF.
- Whether X/Y at the change is a fixed machine parameter or Settings 337–339
  (`mcode.md` §5.3 4c). The values above come from the geometry.
- Heavy/large tool flags (slower change, empty neighbour pockets) and `Pnn`
  with ATC FWD (put the spindle tool into a chosen pocket) [OM20 p.148, 152].
- RESET or E-stop mid-change: the real machine needs TOOL CHANGER RECOVERY
  [OM20 p.151]; the simulator abandons the swap and lets the arm and pocket
  settle back with the tools where they started.
