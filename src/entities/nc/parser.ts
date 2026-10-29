/**
 * Program text -> blocks of words and macro statements.
 *
 * Parsing is done once, up front: expressions become small trees so a WHILE
 * loop that runs a thousand times does not re-read its text. A syntax error
 * stays on its block and only becomes an alarm if that block is executed —
 * the control also reads blocks as it reaches them.
 */
import type { BinaryOp, Block, Diagnostic, Expr, MacroFunction, ParsedProgram, Statement, Word } from "./types";

const FUNCTIONS: readonly MacroFunction[] = [
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
];
const COMPARISONS: readonly BinaryOp[] = ["EQ", "NE", "GT", "GE", "LT", "LE"];

class SyntaxError_ extends Error {}

const isLetter = (c: string) => c >= "A" && c <= "Z";
const isDigit = (c: string) => c >= "0" && c <= "9";

/** Cursor over one block's code, upper-cased, comments already removed. */
class Cursor {
  i = 0;
  constructor(readonly s: string) {}

  skip() {
    while (this.i < this.s.length && (this.s[this.i] === " " || this.s[this.i] === "\t")) this.i++;
  }
  peek(): string {
    this.skip();
    return this.s[this.i] ?? "";
  }
  done(): boolean {
    return this.peek() === "";
  }
  /** The run of letters at the cursor (a keyword or function name), unconsumed. */
  keyword(): string {
    this.skip();
    let j = this.i;
    while (j < this.s.length && isLetter(this.s[j])) j++;
    return this.s.slice(this.i, j);
  }
  take(token: string): boolean {
    this.skip();
    if (this.s.startsWith(token, this.i)) {
      this.i += token.length;
      return true;
    }
    return false;
  }
  expect(token: string, what = `"${token}"`) {
    if (!this.take(token)) throw new SyntaxError_(`expected ${what}${this.near()}`);
  }
  near(): string {
    const rest = this.s.slice(this.i).trim();
    return rest ? ` near "${rest.slice(0, 12)}"` : " at end of block";
  }
  /** Unsigned number literal; `decimal` tells whether it had a point. */
  number(): { v: number; decimal: boolean } | null {
    this.skip();
    let j = this.i;
    let digits = 0;
    let decimal = false;
    while (j < this.s.length) {
      const c = this.s[j];
      if (isDigit(c)) digits++;
      else if (c === "." && !decimal) decimal = true;
      else break;
      j++;
    }
    if (digits === 0) return null;
    const v = Number(this.s.slice(this.i, j));
    this.i = j;
    return { v, decimal };
  }
}

// --- expressions -----------------------------------------------------------
// Precedence, loosest first: OR XOR, AND, comparisons, + -, * / MOD, unary.
// Fanuc binds AND with * and OR with +; putting comparisons above the logical
// operators instead means [#1 GT 0 AND #2 LT 5] reads the way it is written.

function parseExpr(c: Cursor): Expr {
  let a = parseAnd(c);
  for (;;) {
    const k = c.keyword();
    if (k !== "OR" && k !== "XOR") return a;
    c.take(k);
    a = { k: "bin", op: k, a, b: parseAnd(c) };
  }
}

function parseAnd(c: Cursor): Expr {
  let a = parseComparison(c);
  while (c.keyword() === "AND") {
    c.take("AND");
    a = { k: "bin", op: "AND", a, b: parseComparison(c) };
  }
  return a;
}

function parseComparison(c: Cursor): Expr {
  const a = parseSum(c);
  const k = c.keyword() as BinaryOp;
  if (!COMPARISONS.includes(k)) return a;
  c.take(k);
  return { k: "bin", op: k, a, b: parseSum(c) };
}

function parseSum(c: Cursor): Expr {
  let a = parseProduct(c);
  for (;;) {
    const p = c.peek();
    if (p !== "+" && p !== "-") return a;
    c.take(p);
    a = { k: "bin", op: p, a, b: parseProduct(c) };
  }
}

function parseProduct(c: Cursor): Expr {
  let a = parseUnary(c);
  for (;;) {
    const p = c.peek();
    if (p === "*" || p === "/") {
      c.take(p);
      a = { k: "bin", op: p, a, b: parseUnary(c) };
    } else if (c.keyword() === "MOD") {
      c.take("MOD");
      a = { k: "bin", op: "MOD", a, b: parseUnary(c) };
    } else return a;
  }
}

function parseUnary(c: Cursor): Expr {
  if (c.take("-")) return { k: "neg", a: parseUnary(c) };
  if (c.take("+")) return parseUnary(c);
  return parsePrimary(c, true);
}

function parseVariable(c: Cursor): Extract<Expr, { k: "var" }> {
  if (c.peek() === "[") return { k: "var", index: parseBracket(c) };
  const n = c.number();
  if (!n || n.decimal) throw new SyntaxError_(`bad variable number${c.near()}`);
  return { k: "var", index: { k: "num", v: n.v } };
}

function parseBracket(c: Cursor): Expr {
  c.expect("[");
  const e = parseExpr(c);
  c.expect("]");
  return e;
}

function parsePrimary(c: Cursor, allowFunctions: boolean): Expr {
  const p = c.peek();
  if (p === "[") return parseBracket(c);
  if (p === "#") {
    c.take("#");
    return parseVariable(c);
  }
  if (isDigit(p) || p === ".") {
    const n = c.number();
    if (!n) throw new SyntaxError_(`bad number${c.near()}`);
    return { k: "num", v: n.v };
  }
  const name = c.keyword() as MacroFunction;
  if (allowFunctions && FUNCTIONS.includes(name)) {
    c.take(name);
    const a = parseBracket(c);
    // ATAN[a]/[b] is the two-argument, four-quadrant form.
    if (name === "ATAN" && c.peek() === "/") {
      const save = c.i;
      c.take("/");
      if (c.peek() === "[") return { k: "fn", name, a, b: parseBracket(c) };
      c.i = save;
    }
    return { k: "fn", name, a };
  }
  throw new SyntaxError_(p ? `unexpected "${p}"${c.near()}` : "missing value at end of block");
}

/** The value after an address letter: a literal, #var or [expr], with an optional sign. */
function parseWordValue(c: Cursor, letter: string): { value: number | Expr; decimal: boolean } {
  const negative = c.take("-");
  if (!negative) c.take("+");
  const p = c.peek();
  if (isDigit(p) || p === ".") {
    const n = c.number();
    if (!n) throw new SyntaxError_(`bad number after ${letter}`);
    return { value: negative ? -n.v : n.v, decimal: n.decimal };
  }
  if (p === "#" || p === "[") {
    const e = parsePrimary(c, false);
    return { value: negative ? { k: "neg", a: e } : e, decimal: true };
  }
  throw new SyntaxError_(`address ${letter} has no value${c.near()}`);
}

// --- statements --------------------------------------------------------------

function parseAssignment(c: Cursor): Statement {
  c.expect("#");
  const target = parseVariable(c).index;
  c.expect("=", '"=" in assignment');
  return { kind: "assign", target, value: parseExpr(c) };
}

function parseWords(c: Cursor, optionalFrom: { on: boolean }): Word[] {
  const words: Word[] = [];
  while (!c.done()) {
    const ch = c.peek();
    if (ch === "/") {
      c.take("/");
      optionalFrom.on = true;
      continue;
    }
    if (!isLetter(ch)) throw new SyntaxError_(`unexpected "${ch}"${c.near()}`);
    c.i++;
    const { value, decimal } = parseWordValue(c, ch);
    words.push({ letter: ch, value, decimal, optional: optionalFrom.on });
  }
  return words;
}

function parseStatement(c: Cursor, keyword: string): Statement {
  c.take(keyword);
  switch (keyword) {
    case "IF": {
      if (c.peek() !== "[") throw new SyntaxError_("IF needs a [condition]");
      const cond = parseBracket(c);
      const k = c.keyword();
      if (k === "GOTO") {
        c.take(k);
        return { kind: "if-goto", cond, target: parseUnary(c) };
      }
      if (k === "THEN") {
        c.take(k);
        if (c.peek() === "#") return { kind: "if-then", cond, then: parseAssignment(c) };
        return { kind: "if-then", cond, then: { kind: "words", words: parseWords(c, { on: false }) } };
      }
      throw new SyntaxError_("IF needs GOTO or THEN");
    }
    case "WHILE": {
      if (c.peek() !== "[") throw new SyntaxError_("WHILE needs a [condition]");
      const cond = parseBracket(c);
      c.expect("DO", "DO after WHILE [...]");
      const n = c.number();
      if (!n) throw new SyntaxError_("DO needs a loop number");
      return { kind: "while", cond, id: n.v };
    }
    case "END": {
      const n = c.number();
      if (!n) throw new SyntaxError_("END needs a loop number");
      return { kind: "end", id: n.v };
    }
    case "GOTO":
      return { kind: "goto", target: parseUnary(c) };
    default: {
      const text = c.s.slice(c.i);
      c.i = c.s.length;
      return { kind: "ignored", text: `${keyword}${text}` };
    }
  }
}

const STATEMENT_KEYWORDS = new Set(["IF", "WHILE", "GOTO", "END", "DPRNT", "POPEN", "PCLOS"]);

function parseBlock(code: string, comments: string[], line: number, text: string): Block | null {
  const block: Block = { line, text, words: [], comments, optional: false };
  const c = new Cursor(code);
  if (c.done()) return null;
  try {
    if (c.take("/")) block.optional = true;
    if (c.peek() === "O" && isDigit(c.s[c.i + 1] ?? "")) {
      c.take("O");
      block.o = c.number()!.v;
      // Anything after the number on an O line is the program's name.
      return block;
    }
    if (c.peek() === "N" && isDigit(c.s[c.i + 1] ?? "")) {
      c.take("N");
      block.n = c.number()!.v;
    }
    const keyword = c.keyword();
    if (STATEMENT_KEYWORDS.has(keyword)) block.statement = parseStatement(c, keyword);
    else if (c.peek() === "#") block.statement = parseAssignment(c);
    else block.words = parseWords(c, { on: false });
    if (!c.done()) throw new SyntaxError_(`unexpected text${c.near()}`);
  } catch (e) {
    if (!(e instanceof SyntaxError_)) throw e;
    block.error = e.message;
  }
  return block;
}

/** Pairs WHILE … DO n with its END n, innermost first. */
function matchLoops(blocks: Block[], errors: Diagnostic[]): ParsedProgram["loops"] {
  const whileToEnd: Record<number, number> = {};
  const endToWhile: Record<number, number> = {};
  const open: { id: number; index: number }[] = [];
  blocks.forEach((b, index) => {
    const s = b.statement;
    if (s?.kind === "while") open.push({ id: s.id, index });
    if (s?.kind === "end") {
      const at = open.map((o) => o.id).lastIndexOf(s.id);
      if (at < 0) {
        b.error = `END ${s.id} without WHILE … DO ${s.id}`;
        errors.push({ line: b.line, severity: "alarm", message: b.error });
        return;
      }
      const w = open.splice(at)[0];
      whileToEnd[w.index] = index;
      endToWhile[index] = w.index;
    }
  });
  for (const o of open) {
    const b = blocks[o.index];
    b.error = `DO ${o.id} without END ${o.id}`;
    errors.push({ line: b.line, severity: "alarm", message: b.error });
  }
  return { whileToEnd, endToWhile };
}

/** Tokens, comments, block delete, O/N, macro statements; errors with line numbers. */
export function parseProgram(text: string): ParsedProgram {
  const blocks: Block[] = [];
  const errors: Diagnostic[] = [];
  const programStarts: Record<number, number> = {};
  let number: number | undefined;
  let name: string | undefined;

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1;
    if (raw.trimStart().startsWith("%")) return;
    // Split on ";" (end of block) outside comments, collecting comments.
    let code = "";
    let comments: string[] = [];
    let comment: string | null = null;
    const flush = () => {
      const block = parseBlock(code, comments, line, raw.trim());
      if (block) {
        if (comment !== null) block.error ??= "comment not closed with )";
        if (block.o !== undefined) {
          programStarts[block.o] ??= blocks.length;
          if (number === undefined) {
            number = block.o;
            name = comments[0]?.trim() || undefined;
          }
        }
        if (block.error) errors.push({ line, severity: "alarm", message: block.error });
        blocks.push(block);
      }
      code = "";
      comments = [];
    };
    for (const ch of raw) {
      if (comment !== null) {
        if (ch === ")") {
          comments.push(comment);
          comment = null;
        } else comment += ch;
      } else if (ch === "(") comment = "";
      else if (ch === ";") flush();
      else code += ch.toUpperCase();
    }
    flush();
  });

  const loops = matchLoops(blocks, errors);
  return { number, name, blocks, errors, programStarts, loops };
}
