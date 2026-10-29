import { cn } from "@/shared/lib/cn";

/** Label-and-value row. The label labels; the value is the only thing that
 *  varies. `mono` marks a precise value — an id, a count, a measurement. */
export function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3", className)}>
      <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={mono ? "font-mono text-xs" : "text-sm"}>{value}</span>
    </div>
  );
}
