type FloatingTextProps = {
  title: string;
  description: string;
  actionLabel: string;
};

export function FloatingText({ title, description, actionLabel }: FloatingTextProps) {
  return (
    <div
      style={{
        background: "linear-gradient(140deg, rgba(10, 29, 41, 0.94), rgba(21, 58, 66, 0.9))",
        color: "#f0f4f8",
        borderRadius: 16,
        padding: 16,
        border: "1px solid rgba(123, 202, 183, 0.4)",
        boxShadow: "0 14px 28px rgba(9, 30, 43, 0.28)",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8dd9c5" }}>
        Поточний крок
      </div>
      <strong style={{ display: "block", marginTop: 4, marginBottom: 6, fontSize: 19 }}>{title}</strong>
      <p style={{ margin: "0 0 10px", lineHeight: 1.45, color: "#d5e7ef" }}>{description}</p>
      <span
        style={{
          color: "#c9ffd3",
          fontSize: 14,
          background: "rgba(57, 217, 138, 0.15)",
          borderRadius: 999,
          padding: "5px 10px",
          display: "inline-block",
        }}
      >
        Дія: {actionLabel}
      </span>
    </div>
  );
}
