/**
 * Alarm and warning texts, per docs/haas-ngc/settings-alarms.md (part B).
 * NGC shows alarm text in upper case; axis alarms carry the axis prefix
 * (1 X, 2 Y, 3 Z, 6 B). Numbers are the standard Haas ones shared by the
 * classic control and NGC; alarms with no Haas number found are shown by
 * name only. Kept in one table so renumbering is a one-file change.
 */
export const ALARMS = {
  overtravelX: { code: "1.316", text: "X-AXIS OVER TRAVEL RANGE" },
  overtravelY: { code: "2.316", text: "Y-AXIS OVER TRAVEL RANGE" },
  overtravelZ: { code: "3.316", text: "Z-AXIS OVER TRAVEL RANGE" },
  overtravelB: { code: "6.316", text: "B-AXIS OVER TRAVEL RANGE" },
  arcR: { code: "302", text: "INVALID R IN G02 OR G03" },
  arcXYZ: { code: "303", text: "INVALID X, Y, OR Z IN G02 OR G03" },
  arcIJK: { code: "304", text: "INVALID I, J, OR K IN G02 OR G03" },
  cycleQ: { code: "305", text: "INVALID Q IN CANNED CYCLE" },
  cycleIJKQ: { code: "306", text: "INVALID I, J, K, OR Q IN CANNED CYCLE" },
  nesting: { code: "307", text: "SUBROUTINE NESTING TOO DEEP" },
  maxFeed: { code: "309", text: "EXCEEDED MAX FEED RATE" },
  invalidG: { code: "310", text: "INVALID G CODE" },
  unknownCode: { code: "311", text: "UNKNOWN CODE" },
  programEnd: { code: "312", text: "PROGRAM END" },
  noP: { code: "313", text: "NO P CODE IN M97, M98, OR G65" },
  subNotFound: { code: "314", text: "SUBPROGRAM NOT IN MEMORY" },
  invalidP: { code: "315", text: "INVALID P CODE IN M97, M98 OR M99" },
  noFeed: { code: "320", text: "NO FEED RATE SPECIFIED" },
  dwellRange: { code: "324", text: "DELAY TIME RANGE ERROR" },
  dwellNoP: { code: "326", text: "G04 WITHOUT P CODE" },
  invalidTool: { code: "328", text: "INVALID TOOL NUMBER" },
  undefinedM: { code: "329", text: "UNDEFINED M CODE" },
  lineNotFound: { code: "337", text: "GOTO OR P LINE NOT FOUND" },
  multipleCodes: { code: "339", text: "MULTIPLE CODES" },
  compBeginArc: { code: "340", text: "CUTTER COMP BEGIN WITH G02 OR G03" },
  compEndArc: { code: "341", text: "CUTTER COMP END WITH G02 OR G03" },
  compPathSmall: { code: "342", text: "CUTTER COMP PATH TOO SMALL" },
  compPlane: { code: "344", text: "CUTTER COMP WITH G18 AND G19" },
  notInG93: { code: "348", text: "MOTION NOT ALLOWED IN G93 MODE" },
  compAtStop: { code: "349", text: "PROG STOP W/O CANCEL CUTTER COMP" },
  pocketIJK: { code: "359", text: "INVALID I, J, OR K IN G12 OR G13" },
  compInterference: { code: "367", text: "CUTTER COMP INTERFERENCE" },
  toolChangeInCycle: { code: "372", text: "TOOL CHANGE IN CANNED CYCLE" },
  inchNotSelected: { code: "383", text: "INCH IS NOT SELECTED" },
  metricNotSelected: { code: "384", text: "METRIC IS NOT SELECTED" },
  g10: { code: "385", text: "INVALID L, P, OR R CODE IN G10" },
  addressFormat: { code: "386", text: "INVALID ADDRESS FORMAT" },
  planeInG68: { code: "389", text: "G17, G18, G19 ILLEGAL IN G68" },
  noSpindleSpeed: { code: "390", text: "NO SPINDLE SPEED" },
  // Simulator alarms: conditions a trainee must not get away with, but for
  // which no Haas alarm number was found.
  spindleStopped: { text: "FEED MOVE WITH SPINDLE STOPPED" },
  toolNotInTable: { text: "TOOL NOT IN TOOL TABLE" },
  noToolOnM06: { text: "M06 WITHOUT T CODE" },
  offsetEmpty: { text: "TOOL OFFSET REGISTER EMPTY" },
  m99NoCaller: { text: "M99 WITHOUT CALLER" },
  dwoBOffset: { text: "G254 WITH NON-ZERO B WORK OFFSET" },
  tcpcDwo: { text: "TCPC OR DWO INCOMPATIBLE CODE" },
  cycle: { text: "CANNED CYCLE ERROR" },
  macro: { text: "MACRO ERROR" },
  notSupported: { text: "NOT SUPPORTED IN SIMULATOR" },
  runaway: { text: "PROGRAM DID NOT END" },
  internal: { text: "INTERPRETER ERROR" },
} as const satisfies Record<string, { code?: string; text: string }>;

export type AlarmKey = keyof typeof ALARMS;

export const WARNINGS = {
  noLengthComp: "Feed move with no tool length offset active (G43/G234)",
  workOffsetMissing: "Work offset not set — treated as 0",
  workOffsetZero: "Work offset X, Y and Z are all 0 — is it set?",
  hMismatch: "H number does not match the tool in the spindle (alarm 332 with Setting 15 ON)",
  zeroOffset: "Tool offset is 0",
  noM30: "Program ended without M30",
  rpmClamped: "Spindle speed above 8100 rpm — clamped",
  spindleNoS: "Spindle started with no S speed",
  m99Main: "M99 at the end of the main program: the control would run it again from the top",
  stopMessage: "Program stop (#3006)",
  classicCycle: "G87/G88 are classic-control cycles, not in the NGC list",
  integerWord: "has no decimal point — read in least increments (Setting 162 OFF)",
  integerFeed: "has no decimal point — read in least increments (Setting 77 DEFAULT)",
} as const;
