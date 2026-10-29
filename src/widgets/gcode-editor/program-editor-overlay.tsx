"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { showToast, ToastContainer } from "@/shared/ui/toast";
import { cn } from "@/shared/lib/cn";
import { useMachineStore } from "@/entities/machine/machine-store";
import type { Diagnostic } from "@/entities/nc";
import { toolByNumber } from "@/entities/part/tool-library";
import { useJobStore } from "@/features/part-development/job-store";
import type { CheckAgainst } from "@/features/part-development/program-check";
import { programName } from "@/features/part-development/setup";
import { useProgramAnalysis } from "./analysis";
import { Backplot, toolColor } from "./backplot";
import { CodeEditor, type CodeEditorHandle } from "./code-editor";
import { useProgramEditor } from "./editor-store";
import { CheckSummary, ProblemList } from "./problems";
import { buildToolpath } from "./toolpath";

export const CHECK_TARGETS: { value: CheckAgainst; label: string }[] = [
  { value: "ideal", label: "Ideal setup" },
  { value: "machine", label: "Machine setup" },
];

/** "O01001 (TRAINING BRACKET)" → "TRAINING BRACKET". */
function programTitle(text: string): string | null {
  const m = /^\s*O\d+\s*\(([^)]*)\)/m.exec(text);
  return m ? m[1].trim() : null;
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>;
}

function ProgramRow({
  name,
  title,
  selected,
  tags,
  onClick,
}: {
  name: string;
  title: string | null;
  selected: boolean;
  tags: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "mx-1 grid w-[calc(100%-0.5rem)] gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
        selected ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-xs">{name}</span>
        {tags.map((t) => (
          <span key={t} className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t}
          </span>
        ))}
      </span>
      {title && <span className="truncate text-[11px] text-muted-foreground">{title}</span>}
    </button>
  );
}

function EditorOverlay() {
  const program = useJobStore((s) => s.program);
  const design = useJobStore((s) => s.design);
  const setProgram = useJobStore((s) => s.setProgram);
  const programEdited = useJobStore((s) => s.programEdited);
  const programs = useMachineStore((s) => s.machine.programs);
  const activeProgram = useMachineStore((s) => s.machine.activeProgram);
  const toolInSpindle = useMachineStore((s) => s.machine.toolInSpindle);
  const loadProgram = useMachineStore((s) => s.loadProgram);
  const against = useProgramEditor((s) => s.against);
  const setAgainst = useProgramEditor((s) => s.setAgainst);
  const viewing = useProgramEditor((s) => s.viewing);
  const view = useProgramEditor((s) => s.view);
  const close = useProgramEditor((s) => s.close);

  const name = programName(design);
  const viewed = viewing !== null ? (programs[viewing] ?? null) : null;
  const readOnly = viewed !== null;
  const text = viewed ?? program;
  const { analysis, stale, runNow } = useProgramAnalysis(text, design, against);
  const toolpath = useMemo(
    () => (analysis ? buildToolpath(analysis.result, design.stock, against === "ideal" ? 0 : toolInSpindle) : null),
    [analysis, design.stock, against, toolInSpindle],
  );
  const [caretLine, setCaretLine] = useState<number | null>(null);
  const [problemsOpen, setProblemsOpen] = useState(true);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const editor = useRef<CodeEditorHandle>(null);

  const send = () => {
    if (readOnly) return;
    const { rejected } = loadProgram(name, program);
    showToast(rejected ?? `${name} sent to the control and selected.`, rejected ? "warning" : "success");
  };
  const check = () => {
    const a = runNow();
    setProblemsOpen(true);
    showToast(
      `${a.alarms} alarm${a.alarms === 1 ? "" : "s"}, ${a.warnings} warning${a.warnings === 1 ? "" : "s"}.`,
      a.alarms > 0 ? "warning" : "success",
    );
  };
  const actions = useRef({ send, check });
  actions.current = { send, check };

  // Ctrl+S and Ctrl+Enter are caught before CodeMirror, which would insert a
  // line on Ctrl+Enter; Escape only after it, so it closes search and the
  // completion list first.
  useEffect(() => {
    const capture = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        actions.current.send();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        actions.current.check();
      }
    };
    const bubble = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    };
    window.addEventListener("keydown", capture, true);
    window.addEventListener("keydown", bubble);
    return () => {
      window.removeEventListener("keydown", capture, true);
      window.removeEventListener("keydown", bubble);
    };
  }, [close]);

  useEffect(() => setConfirmCopy(false), [viewing]);

  const goTo = (d: Diagnostic) => {
    if (!d.program) return editor.current?.goToLine(d.line);
    if (programs[d.program] === undefined) return;
    view(d.program);
    setTimeout(() => editor.current?.goToLine(d.line), 0);
  };

  const editCopy = () => {
    if (viewed === null) return;
    if (viewed !== program && !confirmCopy) return setConfirmCopy(true);
    setProgram(viewed);
    view(null);
    showToast(`${viewing} copied into the job program, to be sent as ${name}.`, "info");
  };

  const memory = Object.keys(programs).sort();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight">Program editor</h2>
        <span className="font-mono text-xs">{viewing ?? name}</span>
        <Badge qualifier>{readOnly ? "read-only" : programEdited ? "edited" : "from design"}</Badge>
        <span className="text-xs text-muted-foreground">{design.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <SegmentedControl options={CHECK_TARGETS} value={against} onChange={setAgainst} />
          <Button size="md" variant="secondary" onClick={check} title="Ctrl+Enter">
            Check
          </Button>
          <Button size="md" onClick={send} disabled={readOnly} title="Ctrl+S">
            Send to machine
          </Button>
          <Button size="md" variant="ghost" onClick={close} title="Esc">
            Close
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)_minmax(18rem,28rem)]">
        <aside className="flex min-h-0 flex-col overflow-y-auto border-r pb-3">
          <SideHeading>Job</SideHeading>
          <ProgramRow
            name={name}
            title={design.name}
            selected={viewing === null}
            tags={[programEdited ? "edited" : "from design"]}
            onClick={() => view(null)}
          />
          <SideHeading>Control memory</SideHeading>
          {memory.length === 0 && <p className="px-3 text-xs text-muted-foreground">Nothing loaded yet.</p>}
          {memory.map((key) => (
            <ProgramRow
              key={key}
              name={key}
              title={programTitle(programs[key])}
              selected={viewing === key}
              tags={[...(key === activeProgram ? ["active"] : []), ...(programs[key] === program ? ["= job"] : [])]}
              onClick={() => view(key)}
            />
          ))}
          {readOnly && (
            <div className="mt-auto space-y-2 border-t px-3 pt-3">
              <p className="text-xs/relaxed text-muted-foreground">
                {viewing} is shown as the control holds it. Edit a copy to change it here and send it back as {name}.
              </p>
              <Button size="md" variant={confirmCopy ? "danger" : "secondary"} className="w-full" onClick={editCopy}>
                {confirmCopy ? "Replace the job program" : "Edit a copy"}
              </Button>
            </div>
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <CodeEditor
            ref={editor}
            value={text}
            onChange={readOnly ? undefined : setProgram}
            analysis={analysis}
            onCaretLine={setCaretLine}
            fontSize={13}
            className="flex-1"
          />
          <div className="border-t">
            <button
              type="button"
              onClick={() => setProblemsOpen(!problemsOpen)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
            >
              <h4 className="text-[11px] font-semibold uppercase tracking-wide">Problems</h4>
              {analysis && (
                <>
                  <Badge tone={analysis.alarms > 0 ? "rose" : "emerald"}>{analysis.alarms} alarms</Badge>
                  <Badge tone={analysis.warnings > 0 ? "amber" : "zinc"}>{analysis.warnings} warnings</Badge>
                </>
              )}
              {stale && <span className="text-xs text-muted-foreground">checking…</span>}
              <span className="ml-auto text-xs text-muted-foreground">{problemsOpen ? "Hide" : "Show"}</span>
            </button>
            {problemsOpen && (
              <div className={cn("max-h-44 overflow-y-auto px-1 pb-2", stale && "opacity-60")}>
                <ProblemList analysis={analysis} onGoTo={goTo} />
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l">
          <div className="min-h-0 flex-1">
            <Backplot
              toolpath={toolpath}
              stock={design.stock}
              caretLine={viewing === null ? caretLine : null}
              onPickLine={(line) => editor.current?.goToLine(line)}
            />
          </div>
          <div className="space-y-2 border-t p-3">
            <CheckSummary analysis={analysis} stale={stale} />
            {toolpath && toolpath.feeds.length > 0 && (
              <ul className="grid gap-1">
                {toolpath.feeds.map(({ tool }) => (
                  <li key={tool} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: toolColor(tool) }} />
                    <span className="font-mono">T{tool}</span>
                    <span className="truncate text-muted-foreground">{toolByNumber(tool)?.name ?? "not in the carousel"}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs/relaxed text-muted-foreground">
              {against === "ideal"
                ? "Where each real tool tip goes with the probed setup: gauge-line lengths and G54 at the top-face centre."
                : "Where each real tool tip goes with the machine's own offsets and the tool now in the spindle."}{" "}
              Dashed: rapids. White: the caret&apos;s line. Click a move to find its line.
            </p>
          </div>
        </aside>
      </div>

      {/* The shell's toasts sit under this overlay; Send and Check report here. */}
      <div className="pointer-events-none absolute right-4 bottom-4 max-w-sm">
        <div className="pointer-events-auto">
          <ToastContainer />
        </div>
      </div>
    </div>
  );
}

/** The full-screen program editor, while open. Mounted once by the shell. */
export function ProgramEditorOverlay() {
  const isOpen = useProgramEditor((s) => s.isOpen);
  return isOpen ? <EditorOverlay /> : null;
}
