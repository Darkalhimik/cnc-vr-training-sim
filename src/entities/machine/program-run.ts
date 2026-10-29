/**
 * The program runner between the control and the scene: what CYCLE START
 * hands the interpreter, and each frame of playback turned into reducer
 * actions. Pure, so tools/logic-check drives the same path as the scene.
 */
import { codesAt, interpret, type NcResult, type NcSetup } from "@/entities/nc";
import type { RunAction } from "./machine-logic";
import type { AxisValues, MachineState } from "./machine-types";
import { advance, startCursor, stoppingAlarm, type PlaybackCursor } from "./program-playback";

/** A program being executed: the interpreted result and how far along it is. */
export type ActiveRun = {
  result: NcResult;
  cursor: PlaybackCursor;
  /** Live axis position, ahead of the throttled one in machine state. */
  position: AxisValues;
};

/** What the interpreter needs to know about the machine before a run. */
export function setupOf(m: MachineState): NcSetup {
  return {
    workOffsets: m.workOffsets,
    tools: Object.fromEntries(
      Object.entries(m.tools).map(([n, t]) => [
        n,
        {
          number: Number(n),
          length: t.length,
          lengthWear: t.lengthWear,
          diameter: t.diameter,
          diameterWear: t.diameterWear,
        },
      ]),
    ),
    toolInSpindle: m.toolInSpindle,
    pockets: m.pockets,
    carouselPocket: m.carouselPocket,
    start: m.position,
    programs: m.programs,
    options: {
      blockDelete: m.blockDelete,
      optionalStop: m.optionStop,
      metricDefault: true,
      variables: m.macroVariables,
    },
  };
}

/** The text CYCLE START runs: the active program, or the MDI blocks closed
 *  with an M30 like a program. A keypad tool change runs as its M06. */
export function runText(m: MachineState): string {
  if (m.runSource === "atc") return `T${m.atcTool} M06\nM30`;
  return m.runSource === "mdi" ? `${m.mdi}\nM30` : (m.programs[m.activeProgram] ?? "");
}

/** The tool change the run is in the middle of, and how far into it. Feed
 *  hold stops the cursor, so a held change holds its pose. */
export function activeToolChange(run: ActiveRun | null) {
  const motion = run?.result.motions[run.cursor.index];
  return motion?.kind === "toolChange" ? { change: motion, elapsed: run!.cursor.elapsed } : null;
}

/** Interprets what CYCLE START just started (`next`), from the machine as it
 *  was when the button was pressed (`before`). */
export function startRun(before: MachineState, next: MachineState): ActiveRun {
  return { result: interpret(runText(next), setupOf(before)), cursor: startCursor, position: { ...next.position } };
}

/** The interpreter's warnings, for the message line at CYCLE START. */
export function runWarning(result: NcResult): string | null {
  const warnings = result.diagnostics.filter((d) => d.severity === "warning");
  if (warnings.length === 0) return null;
  const [first] = warnings;
  const more = warnings.length > 1 ? ` (+${warnings.length - 1} more)` : "";
  return `Line ${first.line}: ${first.message}${more}`;
}

export type RunFrame = {
  /** Events crossed, in order, then the halt if the program stopped. */
  actions: RunAction[];
  /** Where the program is, while it keeps running; the scene throttles these. */
  progress: Extract<RunAction, { type: "runProgress" }> | null;
  /** Swept tool positions, for material removal. */
  feed: AxisValues[];
  rapid: AxisValues[];
};

/** Advances `run` (in place) by `dt` seconds of machine time. */
export function stepRun(run: ActiveRun, m: MachineState, dt: number): RunFrame {
  const step = advance(run.result, run.cursor, run.position, dt, {
    overrides: { feed: m.overrides.feed, rapid: m.overrides.rapid },
    singleBlock: m.singleBlock,
    optionalStop: m.optionStop,
  });
  run.cursor = step.cursor;
  run.position = step.position;

  const codes = codesAt(run.result, step.block);
  const at = { position: step.position, codes };
  const actions: RunAction[] = step.events.map((event) => ({ type: "runEvent", event }));
  let progress: RunFrame["progress"] = { type: "runProgress", ...at, line: step.line };
  if (step.halt) {
    progress = null;
    // Ran out of motions without reaching M30: the interpreter stopped on an alarm.
    const alarm = stoppingAlarm(run.result);
    const ended = step.events.some((e) => e.kind === "end");
    if (step.halt === "end" && !ended && alarm) {
      const text = alarm.code ? `${alarm.code} ${alarm.message}` : alarm.message;
      actions.push({ type: "runHalt", halt: "alarm", ...at, line: alarm.line, alarm: text });
    } else {
      actions.push({ type: "runHalt", halt: step.halt, ...at, line: step.line });
    }
  }
  return {
    actions,
    progress,
    feed: step.samples.filter((s) => !s.rapid).map((s) => s.position),
    rapid: step.samples.filter((s) => s.rapid).map((s) => s.position),
  };
}
