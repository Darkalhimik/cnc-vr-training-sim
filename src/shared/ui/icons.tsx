/**
 * The few glyphs the product draws, as inline SVG on a 16-unit grid with a
 * 1.5 stroke in currentColor — sized and coloured by the text around them.
 */
type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "size-3.5"}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Svg>
);

export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Svg>
);

export const StarIcon = ({ filled, className }: IconProps & { filled?: boolean }) => (
  <svg viewBox="0 0 16 16" aria-hidden className={className ?? "size-3"}>
    <path
      d="M8 1.8l1.85 3.9 4.25.5-3.15 2.9.85 4.2L8 11.2l-3.8 2.1.85-4.2L1.9 6.2l4.25-.5z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.5l4.5 4.5L6 12.5" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3.5v9l7-4.5z" fill="currentColor" />
  </Svg>
);

export const ShelfIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="2" width="11" height="12" rx="1" />
    <path d="M2.5 6h11M2.5 10h11M5 4.5h2M9 8.5h2.5M5 12.5h3" />
  </Svg>
);

/** A tool in its holder: taper, flange, holder, fluted cutter. */
export const ToolIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 1.5h3l.5 2.5h-4zM4.5 4h7v1.5h-7zM5.5 5.5h5L9.5 9h-3zM7 9h2v5.5L8 15.5l-1-1zM7 10.5l2 1M7 12.5l2 1" />
  </Svg>
);

export const ExpandIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);

/** Stars out of three, filled up to `value`. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className ?? "inline-flex gap-0.5 text-foreground"} aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <StarIcon key={i} filled={i < value} />
      ))}
    </span>
  );
}
