"use client";

import { useEffect, useState } from "react";
import { STOCK_LIMITS, STOCK_PRESETS, type Stock } from "@/entities/part/part-design";
import { MATERIALS, type StockMaterial } from "@/entities/part/tool-library";
import { cn } from "@/shared/lib/cn";
import { useJobStore } from "../job-store";

const control =
  "h-7 w-full min-w-0 rounded-md border bg-background px-2 font-mono text-xs tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring";

const sizeOf = (s: Stock) => `${s.x} × ${s.y} × ${s.z}`;

/** One dimension of the blank: typed freely, kept to the vise's range when
 *  it is committed (Enter or leaving the field). */
function Dimension({ axis, value, onCommit }: { axis: "x" | "y" | "z"; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = parseFloat(text);
    if (!Number.isFinite(v)) return setText(String(value));
    const clamped = Math.min(STOCK_LIMITS.max[axis], Math.max(STOCK_LIMITS.min[axis], Math.round(v)));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{axis}</span>
      <input
        type="number"
        inputMode="numeric"
        min={STOCK_LIMITS.min[axis]}
        max={STOCK_LIMITS.max[axis]}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className={control}
      />
    </label>
  );
}

/**
 * The blank the job is cut from: a size the shop stocks, or any size the
 * vise takes, and its material. The design, the program and the blank the
 * vise hands out all follow it.
 */
export function StockPicker({ compact = false, className }: { compact?: boolean; className?: string }) {
  const stock = useJobStore((s) => s.design.stock);
  const updateStock = useJobStore((s) => s.updateStock);
  const preset = STOCK_PRESETS.findIndex(([x, y, z]) => x === stock.x && y === stock.y && z === stock.z);
  const [custom, setCustom] = useState(false);
  const showSizes = !compact || custom || preset < 0;
  const { min, max } = STOCK_LIMITS;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Blank size, mm"
          value={custom || preset < 0 ? "custom" : String(preset)}
          onChange={(e) => {
            if (e.target.value === "custom") return setCustom(true);
            setCustom(false);
            const [x, y, z] = STOCK_PRESETS[Number(e.target.value)];
            updateStock({ x, y, z });
          }}
          className={control}
        >
          {STOCK_PRESETS.map(([x, y, z], i) => (
            <option key={i} value={i}>
              {x} × {y} × {z}
            </option>
          ))}
          <option value="custom">{preset < 0 ? `${sizeOf(stock)} custom` : "Custom size…"}</option>
        </select>
        <select
          aria-label="Material"
          value={stock.material}
          onChange={(e) => updateStock({ material: e.target.value as StockMaterial })}
          className={cn(control, "font-sans")}
        >
          {(Object.keys(MATERIALS) as StockMaterial[]).map((m) => (
            <option key={m} value={m}>
              {MATERIALS[m].label}
            </option>
          ))}
        </select>
      </div>
      {showSizes && (
        <div className="grid grid-cols-3 gap-2">
          <Dimension axis="x" value={stock.x} onCommit={(x) => updateStock({ x })} />
          <Dimension axis="y" value={stock.y} onCommit={(y) => updateStock({ y })} />
          <Dimension axis="z" value={stock.z} onCommit={(z) => updateStock({ z })} />
        </div>
      )}
      <p className="text-[11px]/relaxed text-muted-foreground">
        The vise takes {min.x}–{max.x} mm across, {min.y}–{max.y} mm along the jaws, {min.z}–{max.z} mm tall.
      </p>
    </div>
  );
}
