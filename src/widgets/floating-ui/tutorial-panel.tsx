type TutorialPanelProps = {
  title: string;
  stepIndex: number;
  totalSteps: number;
  message: string;
  completed: boolean;
  onReset: () => void;
  onForceNext: () => void;
};

export function TutorialPanel({
  title,
  stepIndex,
  totalSteps,
  message,
  completed,
  onReset,
  onForceNext,
}: TutorialPanelProps) {
  const progress = Math.round((Math.min(stepIndex, totalSteps) / totalSteps) * 100);

  return (
    <aside
      style={{
        background: "linear-gradient(165deg, #ffffff, #f2f9f7)",
        border: "1px solid #c8d9dd",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 12px 26px rgba(16, 42, 67, 0.1)",
      }}
    >
      <h3 style={{ margin: "0 0 8px" }}>{completed ? "Tutorial completed" : title}</h3>
      <p style={{ margin: "0 0 10px", color: "#486581" }}>
        Step {Math.min(stepIndex + 1, totalSteps)} / {totalSteps}
      </p>

      <div style={{ height: 8, background: "#e4ecf2", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #0b8f7a, #3dbf83)",
          }}
        />
      </div>

      <p style={{ margin: "12px 0", color: "#334e68" }}>{message}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onForceNext}
          style={{
            border: "none",
            borderRadius: 10,
            padding: "8px 12px",
            background: "#0b8f7a",
            color: "#ffffff",
            cursor: "pointer",
          }}
        >
          Next step
        </button>
        <button
          type="button"
          onClick={onReset}
          style={{
            border: "1px solid #bcccdc",
            borderRadius: 10,
            padding: "8px 12px",
            background: "#ffffff",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
    </aside>
  );
}
