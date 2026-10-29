/**
 * The full NGC pendant face, as data: every key's position and legend in
 * millimetres from the panel's top-left corner. The painter draws it, hit
 * testing reads it, and nothing else needs to know where a key is.
 *
 * Follows docs/haas-ngc/pendant.md: a control strip on the left (POWER ON/OFF,
 * E-STOP, jog handle, CYCLE START/FEED HOLD), the screen above a 1.48 : 1
 * keyboard plate whose eight groups sit at the positions measured from the
 * manual's keyboard drawing, and the side-panel controls drawn as a strip on
 * the right. Sized about 1.6× real so legends stay readable in a headset.
 */

export type KeyGroup =
  | "function"
  | "jog"
  | "overrides"
  | "display"
  | "cursor"
  | "mode"
  | "alpha"
  | "numeric"
  | "app";

export type PanelKey = {
  /** Stable key id, e.g. "RESET", "JOG_+X", "ALPHA_G". */
  id: string;
  label: string;
  /** Legend printed small above the main one, reached with SHIFT. */
  shifted?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  group: KeyGroup;
  /** The arrow-shaped mode keys at the head of each mode row. */
  arrow?: boolean;
  /** RESET is the one red key. */
  accent?: boolean;
};

export type PanelLabel = { text: string; x: number; y: number; w: number; h: number };
export type GroupPlate = { group: KeyGroup; title?: string; x: number; y: number; w: number; h: number };

/** Left control strip, screen-and-keyboard column, side-panel strip. */
const STRIP = { x: 12, w: 150 };
const COLUMN = { x: 172, w: 520 };
const SIDE = { x: 704, w: 64 };

export const PANEL_W = SIDE.x + SIDE.w + 12;
export const PANEL_H = 808;

/** 4:3 like the NGC's LCD, full column width. */
export const SCREEN = { x: COLUMN.x, y: 20, w: COLUMN.w, h: 390 };

/** The keyboard plate, 1.48 : 1 (pendant.md §1). */
export const KEYBOARD = { x: COLUMN.x, y: 424, w: COLUMN.w, h: Math.round(COLUMN.w / 1.48) };

/** Physical controls drawn as 3D objects over the panel (centres, mm). */
export const PHYSICAL = {
  powerOn: { x: 58, y: 96, r: 17 },
  powerOff: { x: 116, y: 96, r: 17 },
  estop: { x: 87, y: 228, r: 38 },
  handwheel: { x: 87, y: 560, r: 56 },
  cycleStart: { x: 58, y: 736, r: 21 },
  feedHold: { x: 116, y: 736, r: 21 },
} as const;

/** Right side panel, top to bottom in the manual's order. */
export const SIDE_CONTROLS = [
  { id: "USB", label: "USB", kind: "port" },
  { id: "MEMORY_LOCK", label: "MEMORY\nLOCK", kind: "keyswitch" },
  { id: "SETUP_MODE", label: "SETUP\nMODE", kind: "keyswitch" },
  { id: "SECOND_HOME", label: "2ND\nHOME", kind: "button" },
  { id: "AUTO_DOOR", label: "AUTO\nDOOR", kind: "button" },
  { id: "WORKLIGHT", label: "WORK\nLIGHT", kind: "button" },
].map((c, i) => ({ ...c, x: SIDE.x + SIDE.w / 2, y: 120 + i * 92, r: 13 }));

/** A group's box on the keyboard plate, from normalised coordinates. */
function box(x0: number, x1: number, y0: number, y1: number) {
  return {
    x: KEYBOARD.x + x0 * KEYBOARD.w,
    y: KEYBOARD.y + y0 * KEYBOARD.h,
    w: (x1 - x0) * KEYBOARD.w,
    h: (y1 - y0) * KEYBOARD.h,
  };
}

const BOXES: Record<Exclude<KeyGroup, "app">, ReturnType<typeof box>> = {
  function: box(0.044, 0.315, 0.061, 0.309),
  jog: box(0.044, 0.315, 0.321, 0.569),
  overrides: box(0.044, 0.315, 0.587, 0.939),
  display: box(0.324, 0.593, 0.061, 0.253),
  cursor: box(0.334, 0.593, 0.273, 0.52),
  mode: box(0.601, 0.949, 0.061, 0.523),
  alpha: box(0.329, 0.73, 0.542, 0.939),
  numeric: box(0.743, 0.949, 0.542, 0.939),
};

type Cell = [id: string, label: string, shifted?: string] | "label" | null;

const GAP = 2.4;

/**
 * Lay a grid of keys into a group's box. A cell of "label" is the printed
 * group caption in the middle of the cursor and spindle rows; `span` widens
 * a key over the next cells (RESET).
 */
function grid(group: Exclude<KeyGroup, "app">, rows: Cell[][], options: { span?: Record<string, number>; title?: number } = {}) {
  const b = BOXES[group];
  const titleH = options.title ?? 0;
  const cols = Math.max(...rows.map((r) => r.length));
  const cw = b.w / cols;
  const ch = (b.h - titleH) / rows.length;
  const keys: PanelKey[] = [];
  const labels: PanelLabel[] = [];
  rows.forEach((row, r) => {
    let c = 0;
    for (const cell of row) {
      const x = b.x + c * cw + GAP / 2;
      const y = b.y + titleH + r * ch + GAP / 2;
      if (cell === "label") {
        labels.push({ text: group === "cursor" ? "CURSOR" : "SPINDLE", x, y, w: cw - GAP, h: ch - GAP });
        c += 1;
        continue;
      }
      if (cell) {
        const [id, label, shifted] = cell;
        const span = options.span?.[id] ?? 1;
        keys.push({
          id,
          label,
          shifted,
          group,
          x,
          y,
          w: cw * span - GAP,
          h: ch - GAP,
          arrow: group === "mode" && c === 0,
          accent: id === "RESET",
        });
        c += span;
        continue;
      }
      c += 1;
    }
  });
  return { keys, labels };
}

const blocks = [
  grid(
    "function",
    [
      [["RESET", "RESET"], ["POWER_UP", "POWER\nUP"], ["RECOVER", "RECOVER"]],
      [["F1", "F1"], ["F2", "F2"], ["F3", "F3"], ["F4", "F4"]],
      [
        ["TOOL_OFFSET_MEASURE", "TOOL\nOFFSET\nMEASURE"],
        ["NEXT_TOOL", "NEXT\nTOOL"],
        ["TOOL_RELEASE", "TOOL\nRELEASE"],
        ["PART_ZERO_SET", "PART\nZERO\nSET"],
      ],
    ],
    { span: { RESET: 2 } },
  ),
  grid("jog", [
    [["CHIP_FWD", "CHIP\nFWD"], ["JOG_+AC", "+A/C", "+B"], ["JOG_+Z", "+Z"], ["JOG_-Y", "−Y"], ["CLNT_UP", "CLNT\nUP"]],
    [["CHIP_STOP", "CHIP\nSTOP"], ["JOG_+X", "+X"], ["JOG_LOCK", "JOG\nLOCK"], ["JOG_-X", "−X"], ["CLNT_DOWN", "CLNT\nDOWN"]],
    [["CHIP_REV", "CHIP\nREV"], ["JOG_+Y", "+Y"], ["JOG_-Z", "−Z"], ["JOG_-AC", "−A/C", "−B"], ["AUX_CLNT", "AUX\nCLNT"]],
  ]),
  grid(
    "overrides",
    [
      [["FEED_-10", "−10%\nFEED"], ["FEED_100", "100%\nFEED"], ["FEED_+10", "+10%\nFEED"], ["HANDLE_FEED", "HANDLE\nFEED"]],
      [["SPINDLE_-10", "−10%\nSPINDLE"], ["SPINDLE_100", "100%\nSPINDLE"], ["SPINDLE_+10", "+10%\nSPINDLE"], ["HANDLE_SPINDLE", "HANDLE\nSPINDLE"]],
      [["SPINDLE_FWD", "FWD"], ["SPINDLE_STOP", "STOP"], ["SPINDLE_REV", "REV"], "label"],
      [["RAPID_5", "5%\nRAPID"], ["RAPID_25", "25%\nRAPID"], ["RAPID_50", "50%\nRAPID"], ["RAPID_100", "100%\nRAPID"]],
    ],
    { title: 8 },
  ),
  grid(
    "display",
    [
      [["PROGRAM", "PROGRAM"], ["POSITION", "POSITION"], ["OFFSET", "OFFSET"], ["CURRENT_COMMANDS", "CURRENT\nCOMMANDS"]],
      [["ALARMS", "ALARMS"], ["DIAGNOSTIC", "DIAG-\nNOSTIC"], ["SETTING", "SETTING"], ["HELP", "HELP"]],
    ],
    { title: 8 },
  ),
  grid("cursor", [
    [["HOME", "HOME"], ["UP", "▲"], ["PAGE_UP", "PAGE\nUP"]],
    [["LEFT", "◀"], "label", ["RIGHT", "▶"]],
    [["END", "END"], ["DOWN", "▼"], ["PAGE_DOWN", "PAGE\nDOWN"]],
  ]),
  grid("mode", [
    [["EDIT", "EDIT"], ["INSERT", "INSERT"], ["ALTER", "ALTER"], ["DELETE", "DELETE"], ["UNDO", "UNDO"]],
    [["MEMORY", "MEMORY"], ["SINGLE_BLOCK", "SINGLE\nBLOCK"], ["GRAPHICS", "GRAPHICS"], ["OPTION_STOP", "OPTION\nSTOP"], ["BLOCK_DELETE", "BLOCK\nDELETE"]],
    [["MDI", "MDI"], ["COOLANT", "COOLANT"], ["HANDLE_SCROLL", "HANDLE\nSCROLL"], ["ATC_FWD", "ATC\nFWD"], ["ATC_REV", "ATC\nREV"]],
    [["HANDLE_JOG", "HANDLE\nJOG"], ["INC_0001", ".0001\n.1"], ["INC_001", ".001\n1."], ["INC_01", ".01\n10."], ["INC_1", ".1\n100."]],
    [["ZERO_RETURN", "ZERO\nRETURN"], ["ZR_ALL", "ALL"], ["ZR_ORIGIN", "ORIGIN"], ["ZR_SINGLE", "SINGLE"], ["ZR_HOME", "HOME\nG28"]],
    [["LIST_PROGRAM", "LIST\nPROGRAM"], ["SELECT_PROGRAM", "SELECT\nPROGRAM"], ["BACK", "◀\nBACK"], ["FORWARD", "FORWARD\n▶"], ["ERASE_PROGRAM", "ERASE\nPROGRAM"]],
  ]),
  grid("alpha", [
    [["SHIFT", "SHIFT"], ["ALPHA_A", "A"], ["ALPHA_B", "B"], ["ALPHA_C", "C"], ["ALPHA_D", "D"], ["ALPHA_E", "E"]],
    [["ALPHA_F", "F"], ["ALPHA_G", "G"], ["ALPHA_H", "H"], ["ALPHA_I", "I"], ["ALPHA_J", "J"], ["ALPHA_K", "K"]],
    [["ALPHA_L", "L"], ["ALPHA_M", "M"], ["ALPHA_N", "N"], ["ALPHA_O", "O"], ["ALPHA_P", "P"], ["ALPHA_Q", "Q"]],
    [["ALPHA_R", "R"], ["ALPHA_S", "S"], ["ALPHA_T", "T"], ["ALPHA_U", "U"], ["ALPHA_V", "V"], ["ALPHA_W", "W"]],
    [["ALPHA_X", "X"], ["ALPHA_Y", "Y"], ["ALPHA_Z", "Z"], ["EOB", ";", "/"], ["PAREN_OPEN", "(", "["], ["PAREN_CLOSE", ")", "]"]],
  ]),
  grid("numeric", [
    [["NUM_7", "7", "&"], ["NUM_8", "8", "@"], ["NUM_9", "9", ":"]],
    [["NUM_4", "4", "%"], ["NUM_5", "5", "$"], ["NUM_6", "6", "!"]],
    [["NUM_1", "1", "*"], ["NUM_2", "2", "`"], ["NUM_3", "3", "?"]],
    [["MINUS", "−", "+"], ["NUM_0", "0", "="], ["DOT", ".", "#"]],
    [["CANCEL", "CANCEL"], ["SPACE", "SPACE"], ["ENTER", "ENTER"]],
  ]),
];

export const KEYS: PanelKey[] = [
  ...blocks.flatMap((b) => b.keys),
  // Not a Haas key: closes this panel.
  { id: "CLOSE_PANEL", label: "CLOSE", group: "app", x: SIDE.x, y: 14, w: SIDE.w, h: 26 },
];

export const LABELS: PanelLabel[] = blocks.flatMap((b) => b.labels);

/** The coloured sub-panels the groups sit on (pendant.md §2). */
export const PLATES: GroupPlate[] = (Object.keys(BOXES) as (keyof typeof BOXES)[]).map((group) => ({
  group,
  title: group === "overrides" ? "OVERRIDES" : group === "display" ? "DISPLAY" : undefined,
  ...BOXES[group],
}));

export const STRIP_BOX = { x: STRIP.x, y: 12, w: STRIP.w, h: PANEL_H - 24 };
export const SIDE_BOX = { x: SIDE.x, y: 52, w: SIDE.w, h: PANEL_H - 64 };

/** The key under a panel point, if any. */
export function keyAt(x: number, y: number): PanelKey | null {
  for (const key of KEYS) {
    if (x >= key.x && x <= key.x + key.w && y >= key.y && y <= key.y + key.h) return key;
  }
  return null;
}
