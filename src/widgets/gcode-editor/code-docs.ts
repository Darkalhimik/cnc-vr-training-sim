/**
 * One-line documentation for the codes and addresses the editor completes and
 * explains on hover. Text from docs/haas-ngc/gcode.md §1 and mcode.md §4,
 * shortened; `simulated: false` marks codes the Haas control has but this
 * interpreter rejects, so the hover says so before the alarm does.
 */

export type CodeDoc = {
  /** "G01", "M06", "G154". */
  code: string;
  name: string;
  /** Modal group for G-codes ("01 motion"), absent for one-shots and M-codes. */
  group?: string;
  /** Words the code takes, as the manual lists them. */
  words?: string;
  description: string;
  simulated: boolean;
};

const g = (code: string, name: string, description: string, extra: Partial<CodeDoc> = {}): CodeDoc => ({
  code,
  name,
  description,
  simulated: true,
  ...extra,
});

const no = { simulated: false };

export const G_DOCS: CodeDoc[] = [
  g("G00", "Rapid positioning", "Axes move independently at rapid, so the path can dog-leg. Cancels a canned cycle.", { group: "01 motion", words: "X Y Z B C" }),
  g("G01", "Linear feed", "Straight-line move at F. `,C` / `,R` insert a chamfer or corner radius before the next move.", { group: "01 motion", words: "X Y Z B C F ,C ,R" }),
  g("G02", "Arc clockwise", "CW arc in the active plane, centre by I J K or radius R. A third axis makes it helical.", { group: "01 motion", words: "X Y Z I J K R F" }),
  g("G03", "Arc counter-clockwise", "CCW arc in the active plane, centre by I J K or radius R. A third axis makes it helical.", { group: "01 motion", words: "X Y Z I J K R F" }),
  g("G04", "Dwell", "Pauses for P: `P1.` is one second, `P1` is one millisecond.", { words: "P" }),
  g("G09", "Exact stop", "Exact stop at the end of this block only. No effect on the path here."),
  g("G10", "Set offsets", "Writes work (L2/L20), tool length (L10/L11) or diameter (L12/L13) offsets from the program.", { words: "L P R X Y Z B C" }),
  g("G12", "Circular pocket CW", "Mills a circular pocket clockwise from the current XY, applying cutter comp itself.", { words: "I K Q L D F Z" }),
  g("G13", "Circular pocket CCW", "Mills a circular pocket counter-clockwise from the current XY, applying cutter comp itself.", { words: "I K Q L D F Z" }),
  g("G17", "XY plane", "Arcs and cutter comp in the XY plane. Power-up default.", { group: "02 plane" }),
  g("G18", "XZ plane", "Arcs in the XZ plane.", { group: "02 plane" }),
  g("G19", "YZ plane", "Arcs in the YZ plane.", { group: "02 plane" }),
  g("G20", "Inch", "Declares inch units. Alarms unless Setting 9 is INCH — this machine is set to MM.", { group: "06 units" }),
  g("G21", "Metric", "Declares millimetre units; checked against Setting 9.", { group: "06 units" }),
  g("G28", "Return to machine zero", "Rapids to machine zero, through the intermediate point when axes are given.", { words: "X Y Z B C" }),
  g("G29", "Return from reference", "Moves through the point stored by G28, then to the target.", { words: "X Y Z B C" }),
  g("G31", "Skip (probe) feed", "Feeds until the probe triggers.", no),
  g("G35", "Probe tool diameter", "Probes a tool diameter into Dnn.", no),
  g("G36", "Probe work offset", "Probes a surface and sets the active work offset.", no),
  g("G37", "Probe tool length", "Probes a tool length into Hnn.", no),
  g("G40", "Cutter comp cancel", "Cancels G41/G42. Power-up default.", { group: "07 cutter comp" }),
  g("G41", "Cutter comp left", "2D cutter compensation left of the path, by the D offset. XY plane only.", { group: "07 cutter comp", words: "D" }),
  g("G42", "Cutter comp right", "2D cutter compensation right of the path, by the D offset. XY plane only.", { group: "07 cutter comp", words: "D" }),
  g("G43", "Tool length comp +", "Adds the H offset to Z. Program it on the first Z move after each tool change.", { group: "08 length", words: "H" }),
  g("G44", "Tool length comp −", "Subtracts the H offset from Z.", { group: "08 length", words: "H" }),
  g("G47", "Engraving", "Engraves text or a serial number.", no),
  g("G49", "Length comp cancel", "Cancels G43/G44/G234.", { group: "08 length" }),
  g("G50", "Scaling cancel", "Cancels G51.", { group: "11 scaling" }),
  g("G51", "Scaling", "Scales X Y Z about a centre by P.", { group: "11 scaling", words: "X Y Z P" }),
  g("G52", "Local shift", "Shift added to every work offset (Setting 33).", { words: "X Y Z B C" }),
  g("G53", "Machine coordinates", "This block moves in machine coordinates, ignoring work and tool offsets.", { words: "X Y Z B C" }),
  ...[54, 55, 56, 57, 58, 59].map((n) =>
    g(`G${n}`, `Work offset ${n - 53}`, `Selects work coordinate system #${n - 53}.${n === 54 ? " Power-up default." : ""}`, { group: "12 work offset" }),
  ),
  g("G60", "Unidirectional positioning", "Approaches from one direction (Setting 35).", no),
  g("G61", "Exact stop mode", "Every block decelerates to a stop.", { group: "15 path" }),
  g("G64", "Exact stop cancel", "Cancels G61. Power-up default.", { group: "15 path" }),
  g("G65", "Macro call", "Calls program P with arguments A–Z as local variables #1–#26, L times.", { words: "P L A–Z" }),
  g("G68", "Rotation", "Rotates the coordinate system by R about the given centre.", { group: "16 rotation", words: "X Y R" }),
  g("G69", "Rotation cancel", "Cancels G68.", { group: "16 rotation" }),
  g("G70", "Bolt circle", "Repeats the active canned cycle at L holes on a circle of radius I from angle J.", { words: "I J L" }),
  g("G71", "Bolt arc", "Repeats the active canned cycle at L holes on an arc, K degrees apart.", { words: "I J K L" }),
  g("G72", "Holes along a line", "Repeats the active canned cycle at L holes, I apart, along angle J.", { words: "I J L" }),
  g("G73", "High-speed peck", "Peck drilling with a short chip-break back-off (Setting 22).", { group: "09 canned cycle", words: "X Y Z R Q F" }),
  g("G74", "Reverse tapping", "Left-hand tapping cycle.", { group: "09 canned cycle", words: "X Y Z R F" }),
  g("G76", "Fine boring", "Bores, orients, shifts off the wall and retracts.", { group: "09 canned cycle", words: "X Y Z R F Q" }),
  g("G77", "Back boring", "Back boring cycle.", { group: "09 canned cycle", words: "X Y Z R F Q" }),
  g("G80", "Canned cycle cancel", "Cancels the active canned cycle. Needed before M06.", { group: "09 canned cycle" }),
  g("G81", "Drilling", "Rapid to R, feed to Z, rapid out. Repeats at every X/Y until G80.", { group: "09 canned cycle", words: "X Y Z R F" }),
  g("G82", "Spot drilling", "As G81 with a dwell P at the bottom.", { group: "09 canned cycle", words: "X Y Z R F P" }),
  g("G83", "Peck drilling", "Pecks Q deep, retracting to R between pecks.", { group: "09 canned cycle", words: "X Y Z R Q F" }),
  g("G84", "Tapping", "Rigid tapping; F = S × pitch.", { group: "09 canned cycle", words: "X Y Z R F" }),
  g("G85", "Boring in, boring out", "Feeds in and out.", { group: "09 canned cycle", words: "X Y Z R F" }),
  g("G86", "Bore and stop", "Feeds in, stops the spindle, rapids out.", { group: "09 canned cycle", words: "X Y Z R F" }),
  g("G87", "Bore and manual retract", "Classic-control cycle, kept for old programs.", { group: "09 canned cycle" }),
  g("G88", "Bore, dwell, manual retract", "Classic-control cycle, kept for old programs.", { group: "09 canned cycle" }),
  g("G89", "Bore, dwell, bore out", "Feeds in, dwells P, feeds out.", { group: "09 canned cycle", words: "X Y Z R F P" }),
  g("G90", "Absolute", "Coordinates are positions in the work system. Power-up default.", { group: "03 distance" }),
  g("G91", "Incremental", "Coordinates are distances from the current position.", { group: "03 distance" }),
  g("G92", "Set work shift", "Shifts every work system so the current position reads as the given values.", { words: "X Y Z B C" }),
  g("G93", "Inverse-time feed", "F is moves per minute: each block takes 1/F minutes.", { group: "05 feed mode" }),
  g("G94", "Feed per minute", "F in mm/min. Power-up default.", { group: "05 feed mode" }),
  g("G95", "Feed per revolution", "F in mm per spindle revolution.", { group: "05 feed mode" }),
  g("G98", "Initial point return", "Canned cycles return to the starting Z between holes. Power-up default.", { group: "10 return" }),
  g("G99", "R-plane return", "Canned cycles return to the R plane between holes.", { group: "10 return" }),
  g("G100", "Mirror off", "Cancels mirror image.", no),
  g("G101", "Mirror on", "Mirror image about the given axes.", no),
  g("G103", "Limit look-ahead", "Limits block look-ahead.", no),
  g("G107", "Cylindrical mapping", "Wraps a linear axis onto a rotary.", no),
  ...Array.from({ length: 20 }, (_, i) =>
    g(`G${110 + i}`, `Work offset ${i + 7}`, `Work system #${i + 7}, the same register as G154 P${i + 1}.`, { group: "12 work offset" }),
  ),
  g("G136", "Probe work centre", "Probes a work centre.", no),
  g("G141", "3D cutter comp", "3D+ cutter compensation.", no),
  g("G143", "5-axis length comp", "VR-type machines only; the UMC uses G234.", no),
  g("G150", "General pocket", "Pocket from a contour subprogram.", no),
  g("G154", "Extra work offsets", "Selects work system P1–P99.", { group: "12 work offset", words: "P" }),
  g("G156", "Broaching cycle", "Broaching cycle.", no),
  g("G167", "Modify setting", "Changes a setting from the program.", no),
  g("G174", "Non-vertical tap CCW", "Rigid tap along a tilted axis.", no),
  g("G184", "Non-vertical tap CW", "Rigid tap along a tilted axis.", no),
  g("G187", "Smoothness", "Sets the smoothness level. Accepted; no effect on the path here.", { words: "P E" }),
  g("G234", "TCPC", "Tool centre point control: X Y Z follow the tool tip while B and C move (simultaneous 5-axis).", { group: "08 length", words: "H" }),
  g("G253", "Orient to feature", "Orients the spindle normal to the G268 feature system.", no),
  g("G254", "Dynamic work offset", "DWO for 3+2: after a B/C index, X Y Z stay in the part's own frame.", { group: "23 DWO" }),
  g("G255", "DWO cancel", "Cancels G254. Program it before moving B or C back.", { group: "23 DWO" }),
  g("G266", "Single-axis rapid", "Rapid of one axis in machine coordinates.", no),
  g("G268", "Feature coordinates", "Tilted feature coordinate system.", no),
  g("G269", "Feature coordinates off", "Cancels G268.", no),
];

const m = (code: string, name: string, description: string, extra: Partial<CodeDoc> = {}): CodeDoc => ({
  code,
  name,
  description,
  simulated: true,
  ...extra,
});

export const M_DOCS: CodeDoc[] = [
  m("M00", "Program stop", "Stops axes, spindle and coolant; CYCLE START resumes at the next block."),
  m("M01", "Optional stop", "As M00 when OPTION STOP is on."),
  m("M02", "Program end", "Ends the program; the pointer stays on the M02 block."),
  m("M03", "Spindle forward", "Spindle clockwise at S rpm, at the end of the block.", { words: "S" }),
  m("M04", "Spindle reverse", "Spindle counter-clockwise at S rpm.", { words: "S" }),
  m("M05", "Spindle stop", "Stops the spindle and waits for zero speed."),
  m("M06", "Tool change", "Stops spindle and coolant, Z to machine zero, swaps in tool T. Cancel cycles (G80) first.", { words: "T" }),
  m("M07", "Shower coolant on", "Shower coolant; M09 turns it off."),
  m("M08", "Coolant on", "Flood coolant on. Off again at M09, M00, M30 and tool changes."),
  m("M09", "Coolant off", "Flood and shower coolant off."),
  m("M10", "B brake on", "Engages the B-axis (tilt) brake. The control also clamps it around rotary moves."),
  m("M11", "B brake off", "Releases the B-axis brake."),
  m("M12", "C brake on", "Engages the C-axis (platter) brake."),
  m("M13", "C brake off", "Releases the C-axis brake."),
  m("M16", "Tool change", "Same as M06; M06 is preferred.", { words: "T" }),
  m("M19", "Orient spindle", "Stops the spindle at its orientation angle.", { words: "P R" }),
  m("M21", "User M function", "Relay with M-Fin.", no),
  m("M29", "Output relay with M-Fin", "Pulses a relay.", no),
  m("M30", "Program end and rewind", "Ends the program, stops spindle and coolant, rewinds to the top."),
  m("M31", "Chip conveyor forward", "Accepted; no conveyor here."),
  m("M33", "Chip conveyor stop", "Accepted; no conveyor here."),
  m("M34", "Coolant spigot +", "P-Cool position up. Accepted, no effect."),
  m("M35", "Coolant spigot −", "P-Cool position down. Accepted, no effect."),
  m("M39", "Rotate carousel", "Rotates the SMTC carousel.", no),
  m("M41", "Low gear", "Accepted; the direct-drive spindle has no gearbox."),
  m("M42", "High gear", "Accepted; the direct-drive spindle has no gearbox."),
  ...[51, 52, 53, 54, 55].map((n) => m(`M${n}`, "Set user relay", `Turns user relay ${n - 50} on. Accepted, no effect.`)),
  m("M59", "Set output relay", "Sets a discrete output.", no),
  ...[61, 62, 63, 64, 65].map((n) => m(`M${n}`, "Clear user relay", `Turns user relay ${n - 60} off. Accepted, no effect.`)),
  m("M69", "Clear output relay", "Clears a discrete output.", no),
  m("M70", "Workholding clamp", "Clamps a configured vise.", no),
  m("M71", "Workholding unclamp", "Unclamps a configured vise.", no),
  m("M73", "Tool air blast on", "Accepted, no effect."),
  m("M74", "Tool air blast off", "Accepted, no effect."),
  m("M75", "Set probe reference", "Sets the G35/G136 reference point.", no),
  m("M78", "Alarm if skip found", "Probing check.", no),
  m("M79", "Alarm if skip not found", "Probing check.", no),
  m("M80", "Auto door open", "Opens the auto door.", no),
  m("M81", "Auto door close", "Closes the auto door.", no),
  m("M82", "Tool unclamp", "Maintenance only.", no),
  m("M83", "Air gun on", "Accepted, no effect."),
  m("M84", "Air gun off", "Accepted, no effect."),
  m("M86", "Tool clamp", "Maintenance only.", no),
  m("M88", "Through-spindle coolant on", "Stops the spindle first, then switches TSC."),
  m("M89", "Through-spindle coolant off", "Stops the spindle first."),
  m("M95", "Sleep mode", "Long dwell.", no),
  m("M96", "Jump if no input", "Branches on a discrete input.", no),
  m("M97", "Local subprogram call", "Calls the block N = P in this program, L times.", { words: "P L" }),
  m("M98", "Subprogram call", "Calls program O = P from memory, L times.", { words: "P L" }),
  m("M99", "Subprogram return", "Returns from a subprogram; in a main program, loops (or jumps to N = P)."),
  m("M109", "Interactive input", "Waits for a key into a macro variable.", no),
];

/** Address letters, for hovering a word that is not a G- or M-code. */
export const ADDRESS_DOCS: Record<string, string> = {
  X: "X axis position (mm). Without a decimal point it is read in thousandths (Setting 162 off): X10 = 0.010 mm.",
  Y: "Y axis position (mm). Without a decimal point it is read in thousandths: Y10 = 0.010 mm.",
  Z: "Z axis position (mm). Without a decimal point it is read in thousandths: Z10 = 0.010 mm.",
  A: "The UMC-500 has no A axis.",
  B: "B axis, trunnion tilt (degrees, −35 to +120). +B tips the platter towards −X.",
  C: "C axis, platter rotation (degrees, continuous).",
  I: "Arc centre X offset from the start point; or a cycle / pattern parameter.",
  J: "Arc centre Y offset from the start point; or a cycle / pattern parameter.",
  K: "Arc centre Z offset from the start point; or a cycle / pattern parameter.",
  R: "Arc radius, or the canned-cycle R plane.",
  F: "Feed rate, mm/min. Write the decimal point: F600 without one is 0.6 mm/min (Setting 77).",
  S: "Spindle speed, rpm (UMC-500: 8100 max). Takes effect with M03/M04.",
  T: "Tool number; M06 loads it. Tools 1–8 are in the carousel.",
  H: "Tool length offset number for G43/G44/G234, usually the same as T.",
  D: "Tool diameter offset number for G41/G42, usually the same as T.",
  P: "Dwell time, program or sequence number, or a cycle parameter, by context.",
  Q: "Peck depth (G73/G83) or shift (G76/G77).",
  L: "Repeat count, or the G10 offset type.",
  N: "Sequence number: a label for M97, M99 P and GOTO.",
  O: "Program number. The comment after it is the program's name.",
  E: "Rapid override % for this block (G00), or a cycle's plunge feed.",
};

const byCode = new Map([...G_DOCS, ...M_DOCS].map((d) => [d.code, d]));

/** Normalises "G1" / "g01" / "G154.0" to the table's "G01" / "G154". */
export function codeKey(letter: string, value: string): string {
  const n = Math.round(parseFloat(value));
  return `${letter.toUpperCase()}${String(Number.isFinite(n) ? n : value).padStart(2, "0")}`;
}

export const docFor = (letter: string, value: string): CodeDoc | null => byCode.get(codeKey(letter, value)) ?? null;
