/**
 * The G-code editor: CodeMirror with the Haas dialect, a live check from the
 * interpreter, hover docs and completion, a 3D backplot, and the full-screen
 * editor around them. The program text belongs to the job store.
 */
export { useProgramAnalysis, type Analysis } from "./analysis";
export { CodeEditor, type CodeEditorHandle } from "./code-editor";
export { useProgramEditor } from "./editor-store";
export { CheckSummary, ProblemList } from "./problems";
export { CHECK_TARGETS, ProgramEditorOverlay } from "./program-editor-overlay";
