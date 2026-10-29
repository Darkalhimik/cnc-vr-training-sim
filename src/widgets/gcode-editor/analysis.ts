"use client";

/**
 * The editor's live check: the interpreter and the fixture-crash check run
 * over the text shortly after typing stops, and every view of the same
 * program — the compact tab, the full-screen editor, the backplot — reads one
 * result.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Text } from "@codemirror/state";
import type { Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { useMachineStore } from "@/entities/machine/machine-store";
import type { Diagnostic } from "@/entities/nc";
import type { PartDesign } from "@/entities/part/part-design";
import { checkProgram, type CheckAgainst, type ProgramCheck } from "@/features/part-development/program-check";

/** Quiet time after the last keystroke before the program is re-run. */
const DEBOUNCE_MS = 350;

export type Analysis = ProgramCheck & {
  text: string;
  against: CheckAgainst;
  /** Every diagnostic, crashes included, in line order. */
  diagnostics: Diagnostic[];
  alarms: number;
  warnings: number;
};

type Inputs = { text: string; against: CheckAgainst; design: PartDesign; deps: readonly unknown[] };

// One result, shared: two views of the same text and target find it here
// instead of interpreting the program twice.
let cache: { inputs: Inputs; analysis: Analysis } | null = null;

const sameInputs = (a: Inputs, b: Inputs) =>
  a.text === b.text &&
  a.against === b.against &&
  a.design.stock === b.design.stock &&
  a.deps.length === b.deps.length &&
  a.deps.every((d, i) => d === b.deps[i]);

function analyse(inputs: Inputs): Analysis {
  if (cache && sameInputs(cache.inputs, inputs)) return cache.analysis;
  const check = checkProgram(inputs.text, inputs.design, inputs.against, useMachineStore.getState().machine);
  const diagnostics = [...check.crashes, ...check.result.diagnostics].sort((a, b) => a.line - b.line);
  const alarms = diagnostics.filter((d) => d.severity === "alarm").length;
  const analysis: Analysis = {
    ...check,
    text: inputs.text,
    against: inputs.against,
    diagnostics,
    alarms,
    warnings: diagnostics.length - alarms,
  };
  cache = { inputs, analysis };
  return analysis;
}

/**
 * The check for `text`, re-run after typing pauses. Against the machine, it
 * also follows the offsets, tools and programs the run would use — but not
 * the axis position, which changes every frame of a run.
 */
export function useProgramAnalysis(text: string, design: PartDesign, against: CheckAgainst) {
  const live = against === "machine";
  const workOffsets = useMachineStore((s) => (live ? s.machine.workOffsets : null));
  const tools = useMachineStore((s) => (live ? s.machine.tools : null));
  const toolInSpindle = useMachineStore((s) => (live ? s.machine.toolInSpindle : null));
  const programs = useMachineStore((s) => (live ? s.machine.programs : null));
  const variables = useMachineStore((s) => (live ? s.machine.macroVariables : null));

  const [analysis, setAnalysis] = useState<Analysis | null>(() =>
    cache && cache.inputs.text === text && cache.inputs.against === against ? cache.analysis : null,
  );
  const hasResult = useRef(analysis !== null);

  useEffect(() => {
    const inputs: Inputs = { text, against, design, deps: [workOffsets, tools, toolInSpindle, programs, variables] };
    // The first result comes at once; edits wait for a pause.
    const delay = hasResult.current && !(cache && sameInputs(cache.inputs, inputs)) ? DEBOUNCE_MS : 0;
    const timer = setTimeout(() => {
      hasResult.current = true;
      setAnalysis(analyse(inputs));
    }, delay);
    return () => clearTimeout(timer);
  }, [text, against, design, workOffsets, tools, toolInSpindle, programs, variables]);

  /** Re-run now, skipping the pause — the Check button. */
  const runNow = useCallback(() => {
    const result = analyse({ text, against, design, deps: [workOffsets, tools, toolInSpindle, programs, variables] });
    setAnalysis(result);
    return result;
  }, [text, against, design, workOffsets, tools, toolInSpindle, programs, variables]);

  return { analysis, stale: analysis !== null && analysis.text !== text, runNow };
}

/** Whether a diagnostic's line is a line of `doc`: main-program lines are,
 *  and so are a subprogram's when the file carries that O-number itself. */
function inDoc(d: Diagnostic, doc: Text): boolean {
  if (!d.program) return true;
  const n = Number(d.program.replace(/^O/i, ""));
  for (let i = 1; i <= doc.lines; i++) {
    const m = /^\s*O0*(\d+)/i.exec(doc.line(i).text);
    if (m && Number(m[1]) === n) return true;
  }
  return false;
}

/** The analysis as CodeMirror lint diagnostics, whole-line ranges. */
export function toCmDiagnostics(analysis: Analysis, doc: Text): CmDiagnostic[] {
  const out: CmDiagnostic[] = [];
  for (const d of analysis.diagnostics) {
    if (d.line < 1 || d.line > doc.lines || !inDoc(d, doc)) continue;
    const line = doc.line(d.line);
    // Leading blanks are not part of the block.
    const from = line.from + (line.text.length - line.text.trimStart().length);
    out.push({
      from,
      to: Math.max(from, line.to),
      severity: d.severity === "alarm" ? "error" : "warning",
      message: `${d.program ? `(${d.program}) ` : ""}${d.code ? `${d.code} ` : ""}${d.message}`,
    });
  }
  return out;
}

export const formatCycle = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
