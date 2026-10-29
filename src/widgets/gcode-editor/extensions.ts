/**
 * Everything the editor is besides its text: the Haas language, hover docs,
 * completion of G- and M-codes, the lint gutter, search, and a theme drawn
 * from the design tokens so it follows light and dark with the rest.
 */
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  hoverTooltip,
  keymap,
  lineNumbers,
  type Tooltip,
} from "@codemirror/view";
import { ADDRESS_DOCS, G_DOCS, M_DOCS, docFor, type CodeDoc } from "./code-docs";
import { gcodeHighlight, gcodeLanguage } from "./gcode-language";

const MACRO_WORDS: Completion[] = [
  ...["IF", "GOTO", "WHILE", "DO", "END", "THEN"].map((label) => ({ label, type: "keyword", detail: "macro flow" })),
  ...["SIN", "COS", "TAN", "ASIN", "ACOS", "ATAN", "SQRT", "ABS", "ROUND", "FIX", "FUP", "LN", "EXP"].map((label) => ({
    label,
    type: "function",
    detail: "macro function",
    apply: `${label}[`,
  })),
  ...["EQ", "NE", "GT", "GE", "LT", "LE", "AND", "OR", "XOR", "MOD"].map((label) => ({
    label,
    type: "keyword",
    detail: "macro operator",
  })),
];

function docNode(doc: CodeDoc): HTMLElement {
  const root = document.createElement("div");
  root.className = "max-w-72 space-y-1 p-2 text-xs/relaxed";
  const head = document.createElement("div");
  head.className = "flex items-baseline gap-2";
  const code = document.createElement("span");
  code.className = "font-mono font-semibold";
  code.textContent = doc.code;
  const name = document.createElement("span");
  name.className = "font-medium";
  name.textContent = doc.name;
  head.append(code, name);
  root.append(head);
  if (doc.group || doc.words) {
    const meta = document.createElement("div");
    meta.className = "font-mono text-[10px] text-muted-foreground";
    meta.textContent = [doc.group && `group ${doc.group}`, doc.words && `words ${doc.words}`].filter(Boolean).join(" · ");
    root.append(meta);
  }
  const body = document.createElement("p");
  body.className = "text-muted-foreground";
  body.textContent = doc.description;
  root.append(body);
  if (!doc.simulated) {
    const warn = document.createElement("p");
    warn.className = "text-amber-700 dark:text-amber-300";
    warn.textContent = "Not simulated: the control here raises an alarm on it.";
    root.append(warn);
  }
  return root;
}

/** Inside a "( … )" comment at `col` of `text`? */
function inComment(text: string, col: number): boolean {
  let open = false;
  for (let i = 0; i < col; i++) {
    if (text[i] === "(") open = true;
    else if (text[i] === ")") open = false;
  }
  return open;
}

function completeCodes(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  if (inComment(line.text, context.pos - line.from)) return null;

  const code = context.matchBefore(/(?<![A-Za-z])[GgMm]\d*/);
  if (code && (code.from !== code.to || context.explicit)) {
    // CodeMirror's own fuzzy match does the filtering: "G1" finds G01 and G10.
    const docs = code.text[0].toUpperCase() === "G" ? G_DOCS : M_DOCS;
    return {
      from: code.from,
      options: docs.map((d) => ({
          label: d.code,
          detail: d.simulated ? d.name : `${d.name} — not simulated`,
          info: () => docNode(d),
          type: "keyword",
          boost: d.simulated ? 0 : -50,
        })),
      validFor: /^[GgMm]\d*$/,
    };
  }

  const word = context.matchBefore(/[A-Za-z]{2,}/);
  if (word) return { from: word.from, options: MACRO_WORDS, validFor: /^[A-Za-z]*$/ };
  return null;
}

/** The address word under the pointer, explained. */
const codeHover = hoverTooltip((view, pos): Tooltip | null => {
  const line = view.state.doc.lineAt(pos);
  const col = pos - line.from;
  if (inComment(line.text, col)) return null;
  for (const m of line.text.matchAll(/(?<![A-Za-z])([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))?/g)) {
    const start = m.index;
    const end = start + m[0].length;
    if (col < start || col > end) continue;
    const letter = m[1].toUpperCase();
    const value = m[2];
    let node: HTMLElement | null = null;
    if ((letter === "G" || letter === "M") && value !== undefined) {
      const doc = docFor(letter, value);
      if (doc) node = docNode(doc);
      else {
        node = document.createElement("div");
        node.className = "p-2 text-xs text-amber-700 dark:text-amber-300";
        node.textContent = `${letter}${value}: not a code this control knows.`;
      }
    } else if (ADDRESS_DOCS[letter] && /[A-Za-z]/.test(line.text[end] ?? " ") === false) {
      node = document.createElement("div");
      node.className = "max-w-72 p-2 text-xs/relaxed";
      const code = document.createElement("span");
      code.className = "font-mono font-semibold";
      code.textContent = `${letter} `;
      node.append(code, document.createTextNode(ADDRESS_DOCS[letter]));
    }
    if (!node) return null;
    const dom = node;
    return { pos: line.from + start, end: line.from + end, above: true, create: () => ({ dom }) };
  }
  return null;
});

/** Colours and sizes from the design tokens, so the editor changes theme with the page. */
const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
    lineHeight: "1.6",
  },
  ".cm-content": { caretColor: "var(--foreground)", padding: "6px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-gutters": {
    backgroundColor: "color-mix(in oklab, var(--muted) 50%, transparent)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 6px", minWidth: "2.5em" },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--accent) 55%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--accent)", color: "var(--foreground)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in oklab, var(--ring) 40%, transparent)" },
  ".cm-selectionMatch": { backgroundColor: "color-mix(in oklab, var(--ring) 25%, transparent)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "color-mix(in oklab, var(--ring) 30%, transparent)",
    outline: "none",
  },
  ".cm-searchMatch": { backgroundColor: "color-mix(in oklab, oklch(0.8 0.15 85) 35%, transparent)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "color-mix(in oklab, oklch(0.8 0.15 85) 60%, transparent)" },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "2px 8px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionDetail": { color: "var(--muted-foreground)", fontStyle: "normal", marginLeft: "1em" },
  ".cm-tooltip.cm-completionInfo": { padding: "0" },
  ".cm-diagnostic": { padding: "4px 8px", fontSize: "12px" },
  ".cm-panels": { backgroundColor: "var(--background)", color: "var(--foreground)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--border)" },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
  ".cm-search": { fontSize: "12px", padding: "6px 8px" },
  ".cm-textfield": {
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "2px 6px",
    color: "var(--foreground)",
  },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--foreground)",
    padding: "2px 8px",
  },
  ".cm-panel button[name=close]": { color: "var(--muted-foreground)" },
});

/** The editor's extensions; `fontSize` in px. */
export function gcodeExtensions(fontSize: number): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    lintGutter(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    search({ top: true }),
    gcodeLanguage,
    syntaxHighlighting(gcodeHighlight),
    autocompletion({ override: [completeCodes], icons: false }),
    codeHover,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...lintKeymap,
    ]),
    theme,
    EditorView.theme({ "&": { fontSize: `${fontSize}px` } }),
  ];
}
