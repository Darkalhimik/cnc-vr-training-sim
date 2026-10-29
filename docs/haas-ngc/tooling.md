# Tooling: the crib, holders, cutters and a machine's tool table

This file is the spec for the trainer's tools: what a tool is, which machine
can take which tool, and the limits a machine's tool table is checked against.
Code: `src/entities/tooling/` (crib and loadout), `src/widgets/vr-scene/tool-body.ts`
(geometry), `src/features/tooling/` (store, panels, `/toolbox`).

## 1. The question: is a tool a machine's own?

No. A tool is a **cutter clamped in a holder**, and what a spindle takes is the
holder's **taper**. Everything below the taper — collet chuck, side-lock,
shrink fit, shell mill arbor, drill chuck, and whatever cutter is in it — is the
same tool on any spindle with that taper.

- Haas 40-taper mills (VF series, UMC-500/750, …) take **CT40** (Haas's name for
  CAT40, ANSI B5.50) or **BT40** (JIS B6339 / MAS 403). The UMC-500 is built with
  either; the trainer's is CT40 (`umc500.md` §6, spindle table: "CT40 or BT40").
- CT40 and BT40 are both 7/24 tapers of the same size but **do not interchange**:
  the flange differs (inch vs metric, drive slots) and so do the pull studs.
  Haas: "Use the correct pull studs for the spindle (BT40 or CT40 on 40-taper)"
  (`operation.md` §7.1).
- 50-taper mills and lathes are other cribs: a lathe turret takes VDI or BOT
  tooling, not holders at all.

What *is* a machine's own is its **tool table**: which tool is T1, T2…, which
pocket each sits in, its measured length and wear, and its LARGE/HEAVY flags
(`operation.md` §7.1). Two machines can carry the same end mill as different
tool numbers with different lengths.

**So the trainer has both:** one shop-wide **tool crib** in the lobby — every
tool, browsable, each listing the machines it fits — and a **tool cart beside
each machine**, where that machine's table is set up from the crib and checked
against that machine's spindle and changer. A second 40-taper mill would share
the crib and get its own cart; a lathe would need a crib of its own.

## 2. Limits of the UMC-500 side-mount changer

From `umc500.md` §8 and `operation.md` §7.1. Checked by `checkLoadout()` on the
client and again by `PUT /api/tooling`.

| Limit | Value | Rule in the trainer |
| --- | --- | --- |
| Pockets | 30 (+1 in the spindle) | T1–T30 |
| Max tool diameter, neighbours full | 64 mm (2.5 in) | over this the tool is **large** |
| Max tool diameter, neighbours empty | 127 mm (5.0 in) | a large tool needs T−1 and T+1 empty; pockets wrap, 1 and 30 are neighbours |
| Max tool length from the gauge line | 305 mm (12 in) | refused |
| Max tool mass | 5.4 kg (12 lb) | refused |
| Heavy | ≥ 1.8 kg (4 lb) | flagged H; on the real machine the carousel slows (not simulated) |

`operation.md` gives LARGE as "over 3 in (76 mm)" in the generic SMTC text;
the UMC-500 spec sheets give 64 mm with all pockets full. The trainer uses the
machine's own 64 mm.

## 3. Holders in the crib

| Kind | Grips by | Notes |
| --- | --- | --- |
| Side-lock (Weldon) | a set screw on the shank's flat | rigid, cannot pull out; more runout than a collet |
| ER collet chuck | a slotted collet closed by the nut | one chuck, a range of shanks (ER16 1–10 mm, ER20 1–13, ER32 2–20) |
| Shrink fit | the heated bore shrinking onto the shank | least runout, slimmest nose |
| Shell mill arbor | a pilot, two drive keys and a centre screw | for face mills |
| Keyless drill chuck | three jaws | drilling only |

The CT40 shape is drawn to the standard: 7/24 taper 44.45 mm at the gauge line,
68.4 mm long; V-flange 63.5 mm across, 15.9 mm thick, two drive slots; the pull
stud above. Gauge lengths, noses and masses are typical catalogue values, not a
particular maker's part numbers. Tool mass is the holder's, plus the cutter as
a solid of its diameter and length (carbide 14.5 g/cm³, HSS-Co 8.1, a face
mill's pocketed steel body at 60 % of 7.85), plus 0.12 kg for the pull stud.

## 4. The standard set and the levels

The first eight crib tools are the **standard set**, T1–T8: the sizes the
tutorials, tasks, CAM templates and removal engine were built on, kept exactly
(gauge length, stick-out, nose diameter — the nose is what the removal engine
checks for holder crashes). **Levels always run with the standard set**, so a
task's program and its grading mean the same for everyone. **Free play runs
with the machine's own table** as the trainee saved it.

Loading a table (free play, machine idle) puts tool T in pocket T — Haas's
"Sequence All Pockets" — keeps a tool's measured length if the same tool stays
in the same number, and leaves a new one unmeasured, as at the machine. The
CAM picks from what is loaded: the largest face mill (else the largest end mill)
to face, the largest end mill to contour, the largest end mill that fits a
pocket or slot, a drill of the hole's exact size, the largest spot drill to spot.

## 5. Looks

Coatings are coloured as they are in a tool room: AlTiN/TiAlN carbide the dark
violet-grey, TiN-coated HSS drills gold, ground carbide shanks bright, face mill
bodies dark steel with darker inserts. Flutes are cut into the cutter's surface
as a helix (38° end mills, 30° drills and ball mills).
