"use client";

import Link from "next/link";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useEffect, useState } from "react";
import { machineBySlug, type MachineInfo } from "@/entities/catalog/machines";
import { levelShortTitle, levelsFor, type LevelInfo, type LevelKind } from "@/entities/catalog/levels";
import { DEVICE_LABEL, DEVICE_MODES, type DeviceMode } from "@/entities/machine/machine-types";
import { useProgress } from "@/features/levels/progress";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { CheckIcon, LockIcon, PlayIcon, Stars, StarIcon } from "@/shared/ui/icons";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { AppHeader } from "@/widgets/app-header/app-header";

const DEVICES: { value: DeviceMode; label: string }[] = DEVICE_MODES.map((d) => ({ value: d, label: DEVICE_LABEL[d] }));
const DEVICE_KEY = "cnc-device";

const TRACKS: { kind: LevelKind; title: string; blurb: string }[] = [
  { kind: "tutorial", title: "Tutorials", blurb: "One procedure at a time, with the next control shown." },
  { kind: "task", title: "Tasks", blurb: "A drawing and a blank. Write the program; the part is measured." },
];

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

type Progress = ReturnType<typeof useProgress>;
type NodeState = "done" | "next" | "open" | "locked";

function nodeState(level: LevelInfo, p: Progress): NodeState {
  if (p.completed.has(level.id)) return "done";
  if (!p.unlocked.has(level.id)) return "locked";
  return p.next?.id === level.id ? "next" : "open";
}

/** One stop on a track: a numbered disc, its name, and its stars once done. */
function LevelNode({
  level,
  index,
  state,
  stars,
  selected,
  onSelect,
}: {
  level: LevelInfo;
  index: number;
  state: NodeState;
  stars: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="group flex w-[4.75rem] shrink-0 flex-col items-center gap-2 text-center outline-none"
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full font-mono text-sm transition-colors",
          state === "done" && "bg-foreground text-background",
          state === "next" && "border-2 border-foreground bg-background",
          state === "open" && "border bg-background",
          state === "locked" && "border border-dashed text-muted-foreground",
          selected ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "group-hover:ring-1 group-hover:ring-ring",
        )}
      >
        {state === "done" ? <CheckIcon className="size-4" /> : state === "locked" ? <LockIcon /> : index + 1}
      </span>
      <span className={cn("text-xs/tight", state === "locked" && "text-muted-foreground")}>{levelShortTitle(level)}</span>
      <span className="h-3">{state === "done" && <Stars value={stars} />}</span>
    </button>
  );
}

function Track({
  kind,
  machine,
  progress,
  selected,
  onSelect,
}: {
  kind: LevelKind;
  machine: MachineInfo;
  progress: Progress;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const track = TRACKS.find((t) => t.kind === kind)!;
  const levels = levelsFor(machine.id, kind);
  const done = levels.filter((l) => progress.completed.has(l.id)).length;
  return (
    <section className="space-y-4 rounded-md border p-4">
      <header className="flex items-baseline gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide">{track.title}</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {done}/{levels.length}
        </span>
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">{track.blurb}</p>
      </header>
      <ol className="flex items-start overflow-x-auto pb-1">
        {levels.map((level, i) => {
          const state = nodeState(level, progress);
          const prevDone = i > 0 && progress.completed.has(levels[i - 1].id);
          return (
            <Fragment key={level.id}>
              {i > 0 && (
                // The path between two stops: solid once the one before is done.
                <li
                  aria-hidden
                  className={cn("mt-[21px] h-0.5 min-w-3 flex-1", prevDone ? "bg-foreground" : "bg-border")}
                />
              )}
              <li>
                <LevelNode
                  level={level}
                  index={i}
                  state={state}
                  stars={progress.byLevel.get(level.id)?.stars ?? 0}
                  selected={selected === level.id}
                  onSelect={() => onSelect(level.id)}
                />
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

/** What the selected level asks, how the trainee did on it, and Start. */
function LevelDetail({
  level,
  machine,
  device,
  progress,
}: {
  level: LevelInfo;
  machine: MachineInfo;
  device: DeviceMode;
  progress: Progress;
}) {
  const row = progress.byLevel.get(level.id);
  const state = nodeState(level, progress);
  const track = levelsFor(machine.id, level.kind);
  const before = track[track.indexOf(level) - 1];
  const missing = [
    ...(before && !progress.completed.has(before.id) ? [before] : []),
    ...(level.requires ?? []).filter((id) => !progress.completed.has(id)).map((id) => levelsFor(machine.id).find((l) => l.id === id)!),
  ];

  return (
    <aside className="space-y-4 rounded-md border p-4 lg:sticky lg:top-16">
      <div className="flex items-center gap-2">
        <Badge qualifier>{level.kind === "tutorial" ? "Tutorial" : "Task"}</Badge>
        <span className="font-mono text-xs text-muted-foreground">~{level.minutes} min</span>
        {state === "done" && <Stars value={row?.stars ?? 0} className="ml-auto inline-flex gap-0.5" />}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold tracking-tight">{level.title}</h3>
        <p className="text-xs/relaxed text-muted-foreground">{level.goal}</p>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {level.skills.map((s) => (
          <li key={s} className="rounded-md bg-muted px-2 py-0.5 text-[11px]">
            {s}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Best</dt>
          <dd className="font-mono">{row?.bestSeconds != null ? time(row.bestSeconds) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{level.kind === "task" ? "Score" : "Par"}</dt>
          <dd className="font-mono">
            {level.kind === "task" ? (row?.bestScore != null ? `${row.bestScore}%` : "—") : time(level.parSeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Attempts</dt>
          <dd className="font-mono">{row?.attempts ?? 0}</dd>
        </div>
      </dl>
      {state === "locked" ? (
        <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs/relaxed text-muted-foreground">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" />
          Finish {missing.map((l) => l.title).join(" and ")} first.
        </p>
      ) : (
        <Link
          href={`/world/${device}?level=${encodeURIComponent(level.id)}`}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlayIcon />
          {state === "done" ? "Play again" : "Start"}
        </Link>
      )}
    </aside>
  );
}

function LevelMap() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearchParams();
  const machine = machineBySlug(slug);
  const progress = useProgress(machine?.id ?? "umc500");
  const [selected, setSelected] = useState<string | null>(search.get("level"));
  const [device, setDevice] = useState<DeviceMode>("desktop");

  // The device is a per-browser preference: a headset user picks VR once.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DEVICE_KEY);
      const known = DEVICE_MODES.find((d) => d === stored);
      if (known) setDevice(known);
    } catch {}
  }, []);
  const chooseDevice = (d: DeviceMode) => {
    setDevice(d);
    try {
      localStorage.setItem(DEVICE_KEY, d);
    } catch {}
  };

  if (!machine) notFound();
  const levels = levelsFor(machine.id);
  const current = levels.find((l) => l.id === selected) ?? progress.next ?? levels[0];

  return (
    <div className="min-h-dvh">
      <AppHeader crumbs={[{ label: machine.name, href: `/machines/${machine.slug}` }, { label: "Levels" }]} />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center gap-3">
          <div className="mr-auto space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Levels</h1>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <StarIcon filled className="size-3 text-foreground" />
              <span className="font-mono text-foreground">{progress.stars}</span> of {progress.maxStars} stars
            </p>
          </div>
          <SegmentedControl options={DEVICES} value={device} onChange={chooseDevice} />
          <Link
            href={`/world/${device}?at=${machine.id}`}
            className="inline-flex h-7 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
          >
            <PlayIcon />
            Free play
          </Link>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {TRACKS.map((t) => (
              <Track
                key={t.kind}
                kind={t.kind}
                machine={machine}
                progress={progress}
                selected={current.id}
                onSelect={setSelected}
              />
            ))}
            <p className="text-xs/relaxed text-muted-foreground">
              Free play is the whole machine with nothing scripted: design a part, program it, set it up and cut it,
              then keep it in the warehouse.
            </p>
          </div>
          <LevelDetail level={current} machine={machine} device={device} progress={progress} />
        </div>
      </main>
    </div>
  );
}

export default function LevelsPage() {
  // useSearchParams needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <LevelMap />
    </Suspense>
  );
}
