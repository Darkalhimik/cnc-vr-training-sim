"use client";

import { useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { cn } from "@/shared/lib/cn";
import {
  FACES,
  FACE_LABEL,
  validateDesign,
  type Face,
  type Feature,
  type FeatureKind,
} from "@/entities/part/part-design";
import { MATERIALS, type StockMaterial } from "@/entities/part/tool-library";
import { useMachineStore } from "@/entities/machine/machine-store";
import { showToast } from "@/shared/ui/toast";
import { useJobStore, type WorkspaceTab } from "../job-store";
import { checkProgram, type CheckAgainst, type ProgramCheck } from "../program-check";

const KIND_LABEL: Record<FeatureKind, string> = {
  face: "Facing",
  "pocket-rect": "Rectangular pocket",
  "pocket-circle": "Circular pocket",
  hole: "Drilled hole",
  slot: "Slot",
  contour: "Outside contour",
};

const tabs: { value: WorkspaceTab; label: string }[] = [
  { value: "design", label: "Design" },
  { value: "program", label: "Program" },
];

const inputClass =
  "h-7 w-full min-w-0 rounded-md border bg-transparent px-2 font-mono text-xs tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** A labelled millimetre value. Commits on every valid number typed. */
function Num({
  label,
  value,
  onChange,
  step = 0.5,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className={inputClass}
      />
    </label>
  );
}

/** The parameters a feature kind has, as inputs. */
function FeatureParams({ f, update }: { f: Feature; update: (patch: Partial<Feature>) => void }) {
  const pair = (key: "center" | "size" | "start" | "end", labels: [string, string]) => {
    const v = (f as Record<string, unknown>)[key] as [number, number];
    return (
      <>
        <Num label={labels[0]} value={v[0]} onChange={(x) => update({ [key]: [x, v[1]] } as Partial<Feature>)} />
        <Num label={labels[1]} value={v[1]} onChange={(y) => update({ [key]: [v[0], y] } as Partial<Feature>)} />
      </>
    );
  };
  const depth = <Num label="Depth" value={f.depth} onChange={(depth) => update({ depth })} />;
  switch (f.kind) {
    case "face":
      return depth;
    case "pocket-rect":
      return (
        <>
          {pair("center", ["Centre u", "Centre v"])}
          {pair("size", ["Width", "Height"])}
          <Num label="Corner R" value={f.cornerRadius} onChange={(cornerRadius) => update({ cornerRadius })} />
          {depth}
        </>
      );
    case "pocket-circle":
      return (
        <>
          {pair("center", ["Centre u", "Centre v"])}
          <Num label="Diameter" value={f.diameter} onChange={(diameter) => update({ diameter })} />
          {depth}
        </>
      );
    case "hole":
      return (
        <>
          {pair("center", ["Centre u", "Centre v"])}
          <label className="grid min-w-0 gap-1">
            <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">Drill</span>
            <select
              value={f.diameter}
              onChange={(e) => update({ diameter: parseFloat(e.target.value) })}
              className={inputClass}
            >
              {[5, 6.8, 8.5].map((d) => (
                <option key={d} value={d}>
                  Ø{d}
                </option>
              ))}
            </select>
          </label>
          {depth}
        </>
      );
    case "slot":
      return (
        <>
          {pair("start", ["Start u", "Start v"])}
          {pair("end", ["End u", "End v"])}
          <Num label="Width" value={f.width} onChange={(width) => update({ width })} />
          {depth}
        </>
      );
    case "contour":
      return (
        <>
          {pair("size", ["Width", "Height"])}
          <Num label="Corner R" value={f.cornerRadius} onChange={(cornerRadius) => update({ cornerRadius })} />
          {depth}
        </>
      );
  }
}

function DesignTab() {
  const design = useJobStore((s) => s.design);
  const camWarnings = useJobStore((s) => s.camWarnings);
  const updateDesign = useJobStore((s) => s.updateDesign);
  const updateStock = useJobStore((s) => s.updateStock);
  const addFeature = useJobStore((s) => s.addFeature);
  const updateFeature = useJobStore((s) => s.updateFeature);
  const removeFeature = useJobStore((s) => s.removeFeature);
  const programEdited = useJobStore((s) => s.programEdited);
  const generate = useJobStore((s) => s.generate);
  const setTab = useJobStore((s) => s.setTab);
  const [kind, setKind] = useState<FeatureKind>("pocket-rect");
  const [face, setFace] = useState<Face>("top");

  const issues = validateDesign(design);
  const issueFor = (id: string) => issues.filter((i) => i.featureId === id);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-[1fr_6rem] gap-2">
        <label className="grid gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Part name</span>
          <input
            value={design.name}
            onChange={(e) => updateDesign({ name: e.target.value })}
            className={cn(inputClass, "font-sans")}
          />
        </label>
        <Num label="Program O" value={design.programNumber} step={1} onChange={(n) => updateDesign({ programNumber: Math.max(1, Math.round(n)) })} />
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide">Stock</h4>
        <div className="grid grid-cols-4 gap-2">
          <Num label="X" value={design.stock.x} step={1} onChange={(x) => updateStock({ x })} />
          <Num label="Y" value={design.stock.y} step={1} onChange={(y) => updateStock({ y })} />
          <Num label="Z" value={design.stock.z} step={1} onChange={(z) => updateStock({ z })} />
          <label className="grid min-w-0 gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Material</span>
            <select
              value={design.stock.material}
              onChange={(e) => updateStock({ material: e.target.value as StockMaterial })}
              className={inputClass}
            >
              {Object.entries(MATERIALS).map(([value, m]) => (
                <option key={value} value={value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs/relaxed text-muted-foreground">
          Part zero (G54) is the top-face centre. Feature positions are millimetres from each face&apos;s
          centre, u right and v up as you look at that face; depth goes into the part.
        </p>
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide">
          Features <span className="font-mono font-normal text-muted-foreground">{design.features.length}</span>
        </h4>
        <ul className="space-y-2">
          {design.features.map((f) => (
            <li key={f.id} className="space-y-2 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{KIND_LABEL[f.kind]}</span>
                <Badge qualifier>{FACE_LABEL[f.face]}</Badge>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => removeFeature(f.id)}>
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <FeatureParams f={f} update={(patch) => updateFeature(f.id, patch)} />
              </div>
              {issueFor(f.id).map((i) => (
                <p key={i.message} className="text-xs text-amber-700 dark:text-amber-300">
                  {i.message}
                </p>
              ))}
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <label className="grid min-w-0 flex-1 gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Feature</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as FeatureKind)} className={inputClass}>
              {(Object.keys(KIND_LABEL) as FeatureKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid w-24 gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Face</span>
            <select value={face} onChange={(e) => setFace(e.target.value as Face)} className={inputClass}>
              {FACES.map((fc) => (
                <option key={fc} value={fc}>
                  {FACE_LABEL[fc]}
                </option>
              ))}
            </select>
          </label>
          <Button size="md" variant="secondary" onClick={() => addFeature(kind, kind === "contour" || kind === "face" ? "top" : face)}>
            Add
          </Button>
        </div>
      </section>

      {(issues.some((i) => i.featureId === null) || camWarnings.length > 0) && (
        <section className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
          {issues
            .filter((i) => i.featureId === null)
            .map((i) => (
              <p key={i.message} className="text-xs text-amber-700 dark:text-amber-300">
                {i.message}
              </p>
            ))}
          {camWarnings.map((w) => (
            <p key={w} className="text-xs text-amber-700 dark:text-amber-300">
              {w}
            </p>
          ))}
        </section>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="md"
          onClick={() => {
            generate();
            setTab("program");
          }}
        >
          {programEdited ? "Regenerate program" : "View program"}
        </Button>
        {programEdited && (
          <span className="text-xs text-muted-foreground">The program has hand edits; regenerating replaces them.</span>
        )}
      </div>
    </div>
  );
}

const checkTargets: { value: CheckAgainst; label: string }[] = [
  { value: "ideal", label: "Ideal setup" },
  { value: "machine", label: "Machine setup" },
];

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function ProgramTab() {
  const program = useJobStore((s) => s.program);
  const design = useJobStore((s) => s.design);
  const setProgram = useJobStore((s) => s.setProgram);
  const programEdited = useJobStore((s) => s.programEdited);
  const loadProgram = useMachineStore((s) => s.loadProgram);
  const lines = program.split("\n").length;
  const [scroll, setScroll] = useState(0);
  const [against, setAgainst] = useState<CheckAgainst>("ideal");
  const [check, setCheck] = useState<(ProgramCheck & { text: string; against: CheckAgainst }) | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const stale = check !== null && (check.text !== program || check.against !== against);
  const diagnostics = check ? [...check.crashes, ...check.result.diagnostics].sort((a, b) => a.line - b.line) : [];
  const alarms = diagnostics.filter((d) => d.severity === "alarm").length;
  const runCheck = () =>
    setCheck({ text: program, against, ...checkProgram(program, design, against, useMachineStore.getState().machine) });
  const name = `O${String(design.programNumber).padStart(5, "0")}`;

  /** Put the caret on a line and scroll it into view. */
  const goTo = (line: number) => {
    const el = editor.current;
    if (!el) return;
    const at = program.split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
    el.focus();
    el.setSelectionRange(at, at + (program.split("\n")[line - 1]?.length ?? 0));
    el.scrollTop = Math.max(0, (line - 4) * 18);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge qualifier>{programEdited ? "edited" : "from design"}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{lines} lines</span>
        <div className="ml-auto flex gap-2">
          <SegmentedControl options={checkTargets} value={against} onChange={setAgainst} />
          <Button size="sm" variant="secondary" onClick={runCheck}>
            Check
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const { rejected } = loadProgram(name, program);
              showToast(rejected ?? `${name} sent to the control and selected.`, rejected ? "warning" : "success");
            }}
          >
            Send to machine
          </Button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-md border">
        {/* Line numbers, scrolled with the text. */}
        <div
          aria-hidden
          className="w-10 shrink-0 select-none overflow-hidden border-r bg-muted/50 py-2 pr-2 text-right font-mono text-[11px] leading-[18px] text-muted-foreground"
        >
          <div style={{ transform: `translateY(${-scroll}px)` }}>
            {Array.from({ length: lines }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        </div>
        <textarea
          ref={editor}
          value={program}
          spellCheck={false}
          onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
          onChange={(e) => setProgram(e.target.value)}
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-2 font-mono text-[11px] leading-[18px] outline-none"
        />
      </div>
      {check && (
        <section className={cn("max-h-48 space-y-1 overflow-y-auto rounded-md border p-2", stale && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={alarms > 0 ? "rose" : "emerald"}>{alarms} alarms</Badge>
            <Badge tone="amber">{diagnostics.length - alarms} warnings</Badge>
            <span className="font-mono text-muted-foreground">
              {minutes(check.result.cycleSeconds)} cycle · {check.result.motions.length} moves · tools{" "}
              {check.result.toolsUsed.map((t) => `T${t}`).join(" ") || "none"}
            </span>
            {stale && <span className="text-muted-foreground">edited since — check again</span>}
          </div>
          <ul className="space-y-0.5">
            {diagnostics.map((d, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => goTo(d.line)}
                  className={cn(
                    "w-full rounded px-1 text-left font-mono text-[11px] hover:bg-accent",
                    d.severity === "alarm" ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300",
                  )}
                >
                  L{d.line}
                  {d.program ? ` (${d.program})` : ""} {d.code ? `${d.code} ` : ""}
                  {d.message}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs/relaxed text-muted-foreground">
            {check.against === "ideal"
              ? "Checked against the probed setup: gauge-line tool lengths and G54 at the top-face centre, from home."
              : "Checked against the machine as it is now: its tool and work offsets, the tool in the spindle and where the axes are."}{" "}
            CRASH lines are where the real tool would end up, which the control cannot see.
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * The desktop workspace for Part development: a drawer over the left of the
 * stage where the part is designed and its program read or edited. Typing
 * belongs on a desktop; setup and running happen on the machine, in any mode.
 */
export function PartWorkspace() {
  const tab = useJobStore((s) => s.tab);
  const setTab = useJobStore((s) => s.setTab);
  const setOpen = useJobStore((s) => s.setWorkspaceOpen);

  return (
    <aside className="pointer-events-auto flex h-full w-[30rem] max-w-[calc(100vw-22rem)] flex-col border-r bg-background/95 backdrop-blur">
      <header className="flex items-center gap-2 border-b p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide">Part development</h3>
        <SegmentedControl options={tabs} value={tab} onChange={setTab} className="ml-auto" />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </header>
      <div className={cn("min-h-0 flex-1 p-3", tab === "design" ? "overflow-y-auto" : "flex flex-col")}>
        {tab === "design" ? <DesignTab /> : <ProgramTab />}
      </div>
    </aside>
  );
}
