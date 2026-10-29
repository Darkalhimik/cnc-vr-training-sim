/**
 * Haas G-code for CodeMirror: a stream tokenizer over one block at a time and
 * the highlight style that colours it.
 *
 * Colour is kept to what a programmer scans for: G-codes (what the machine
 * does), M-codes and macro flow (what the control does), tool and offset
 * words (which tool, which register). Coordinates and numbers stay the text
 * colour; comments and sequence numbers recede. Classes, not inline colours,
 * so both themes come from the same shade pairs as the rest of the product.
 */
import { HighlightStyle, StreamLanguage, type StringStream } from "@codemirror/language";
import { Tag, tags } from "@lezer/highlight";

export const gcodeTags = {
  g: Tag.define(tags.keyword),
  m: Tag.define(tags.controlKeyword),
  axis: Tag.define(tags.variableName),
  tool: Tag.define(tags.propertyName),
  param: Tag.define(tags.attributeName),
  label: Tag.define(tags.labelName),
  program: Tag.define(tags.heading),
  // Modified tags cannot be derived from, so these two are used as they are.
  variable: tags.special(tags.variableName),
  flow: Tag.define(tags.controlKeyword),
  fn: tags.function(tags.variableName),
};

const FLOW = new Set(["IF", "GOTO", "WHILE", "DO", "END", "THEN", "DPRNT", "POPEN", "PCLOS"]);
const OPERATORS = new Set(["EQ", "NE", "GT", "GE", "LT", "LE", "AND", "OR", "XOR", "MOD"]);
const FUNCTIONS = new Set([
  "SIN",
  "COS",
  "TAN",
  "ASIN",
  "ACOS",
  "ATAN",
  "SQRT",
  "ABS",
  "ROUND",
  "FIX",
  "FUP",
  "LN",
  "EXP",
  "BIN",
  "BCD",
]);

const AXES = new Set("XYZABCIJKR");
const TOOL = new Set("TSFHD");
const PARAM = new Set("PQLE");

type State = { blockStart: boolean };

/** A number right after an address letter: sign, digits, point. */
const NUMBER = /^\s*[-+]?(\d+\.?\d*|\.\d+)/;

function token(stream: StringStream, state: State): string | null {
  if (stream.sol()) state.blockStart = true;
  if (stream.eatSpace()) return null;
  const start = state.blockStart;
  state.blockStart = false;

  const ch = stream.peek()!;
  if (ch === "(") {
    // A comment runs to its ")" or the end of the line.
    stream.next();
    while (!stream.eol() && stream.next() !== ")");
    return "comment";
  }
  if (ch === "%") {
    stream.next();
    return "program";
  }
  if (ch === ";") {
    stream.next();
    state.blockStart = true;
    return "punctuation";
  }
  if (ch === "/" && start) {
    stream.next();
    state.blockStart = true;
    return "blockDelete";
  }
  if (ch === "#") {
    stream.next();
    stream.match(/^\d+/);
    return "variable";
  }
  if (ch === "[" || ch === "]") {
    stream.next();
    return "bracket";
  }
  if ("+-*/=<>".includes(ch)) {
    stream.next();
    return "operator";
  }
  if (ch === ",") {
    // ,C chamfer / ,R corner radius on a G01.
    stream.next();
    if (stream.match(/^[CR]/i)) {
      stream.match(NUMBER);
      return "param";
    }
    return "punctuation";
  }

  const word = stream.match(/^[A-Za-z]+/, false) as RegExpMatchArray | null;
  if (word) {
    const upper = word[0].toUpperCase();
    if (upper.length > 1 && (FLOW.has(upper) || OPERATORS.has(upper) || FUNCTIONS.has(upper))) {
      stream.match(word[0]);
      if (FUNCTIONS.has(upper)) return "fn";
      return FLOW.has(upper) ? "flow" : "operator";
    }
    const letter = stream.next()!.toUpperCase();
    const value = stream.match(NUMBER);
    if (letter === "G") return "g";
    if (letter === "M") return "m";
    if (letter === "O" && value) return "program";
    if (letter === "N") return "label";
    if (AXES.has(letter)) return "axis";
    if (TOOL.has(letter)) return "tool";
    if (PARAM.has(letter)) return "param";
    return "invalid";
  }

  if (stream.match(NUMBER)) return "number";
  stream.next();
  return "invalid";
}

export const gcodeLanguage = StreamLanguage.define<State>({
  name: "haas-gcode",
  startState: () => ({ blockStart: true }),
  token,
  tokenTable: {
    g: gcodeTags.g,
    m: gcodeTags.m,
    axis: gcodeTags.axis,
    tool: gcodeTags.tool,
    param: gcodeTags.param,
    label: gcodeTags.label,
    program: gcodeTags.program,
    variable: gcodeTags.variable,
    flow: gcodeTags.flow,
    fn: gcodeTags.fn,
    blockDelete: tags.processingInstruction,
  },
  languageData: { commentTokens: { block: { open: "(", close: ")" } } },
});

export const gcodeHighlight = HighlightStyle.define([
  { tag: tags.comment, class: "text-muted-foreground italic" },
  { tag: gcodeTags.g, class: "font-semibold text-sky-700 dark:text-sky-300" },
  { tag: [gcodeTags.m, gcodeTags.flow], class: "font-semibold text-violet-700 dark:text-violet-300" },
  { tag: gcodeTags.tool, class: "text-teal-700 dark:text-teal-300" },
  { tag: [gcodeTags.label, tags.processingInstruction], class: "text-muted-foreground" },
  { tag: gcodeTags.program, class: "font-semibold" },
  { tag: gcodeTags.variable, class: "text-teal-700 dark:text-teal-300" },
  { tag: gcodeTags.fn, class: "text-sky-700 dark:text-sky-300" },
  { tag: [tags.operator, tags.bracket, tags.punctuation], class: "text-muted-foreground" },
  { tag: tags.invalid, class: "text-rose-700 underline decoration-dotted dark:text-rose-300" },
]);
