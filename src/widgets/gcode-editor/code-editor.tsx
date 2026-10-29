"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { setDiagnostics } from "@codemirror/lint";
import { cn } from "@/shared/lib/cn";
import { toCmDiagnostics, type Analysis } from "./analysis";
import { gcodeExtensions } from "./extensions";

export type CodeEditorHandle = {
  /** Select a line, scroll it to the middle and focus the editor. */
  goToLine: (line: number) => void;
  focus: () => void;
};

type CodeEditorProps = {
  value: string;
  /** Absent: read-only. */
  onChange?: (text: string) => void;
  /** Its diagnostics are shown while it matches the text. */
  analysis: Analysis | null;
  /** The caret's line, whenever it changes. */
  onCaretLine?: (line: number) => void;
  /** px; the tab uses a smaller face than the full-screen editor. */
  fontSize?: number;
  className?: string;
};

/** Marks the transactions that bring an outside change in, so they are not
 *  reported back out as edits. */
const external = Annotation.define<boolean>();

/** The one change that turns `from` into `to`: the differing middle. */
function diff(from: string, to: string) {
  let start = 0;
  const max = Math.min(from.length, to.length);
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  let end = 0;
  while (
    end < max - start &&
    from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)
  ) {
    end++;
  }
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) };
}

/**
 * CodeMirror with the Haas G-code setup, controlled by `value`: the text has
 * one owner outside (the job store), and an outside change — regenerating
 * from the design, a copy from memory — is merged in as the smallest edit,
 * so the caret and the undo history survive it.
 */
export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, onChange, analysis, onCaretLine, fontSize = 12, className },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const editable = useRef(new Compartment());
  const callbacks = useRef({ onChange, onCaretLine });
  callbacks.current = { onChange, onCaretLine };
  const readOnly = !onChange;

  useEffect(() => {
    let caretLine = 0;
    const created = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          gcodeExtensions(fontSize),
          editable.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.some((t) => t.annotation(external))) {
              callbacks.current.onChange?.(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet) {
              const line = update.state.doc.lineAt(update.state.selection.main.head).number;
              if (line !== caretLine) {
                caretLine = line;
                callbacks.current.onCaretLine?.(line);
              }
            }
          }),
        ],
      }),
    });
    view.current = created;
    return () => {
      created.destroy();
      view.current = null;
    };
    // The view is built once; value, read-only and diagnostics are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === value) return;
    v.dispatch({ changes: diff(current, value), annotations: external.of(true) });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    });
  }, [readOnly]);

  // A result for an older text is left out: CodeMirror keeps the previous
  // diagnostics mapped through the edits until the fresh one arrives.
  useEffect(() => {
    const v = view.current;
    if (!v || !analysis || analysis.text !== v.state.doc.toString()) return;
    v.dispatch(setDiagnostics(v.state, toCmDiagnostics(analysis, v.state.doc)));
  }, [analysis, value]);

  useImperativeHandle(ref, () => ({
    goToLine: (line) => {
      const v = view.current;
      if (!v) return;
      const l = v.state.doc.line(Math.min(Math.max(1, line), v.state.doc.lines));
      v.dispatch({
        selection: { anchor: l.from, head: l.to },
        effects: EditorView.scrollIntoView(l.from, { y: "center" }),
      });
      v.focus();
    },
    focus: () => view.current?.focus(),
  }));

  return <div ref={host} className={cn("min-h-0 min-w-0 overflow-hidden", className)} />;
});
