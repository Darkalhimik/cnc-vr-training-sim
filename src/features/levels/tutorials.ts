/**
 * The tutorial levels: each is a list of steps for the tutorial engine and
 * the machine it starts on. Steps complete on machine state, never on a
 * click, and every completed step keeps a guard — see tutorial-types.ts.
 *
 * Part zero and tool lengths are taught the touch-off way: G54 X/Y from the
 * probe's reading, G54 Z = 0, and each tool's H the machine Z where its tip
 * touches the part top (the reducer's TOOL OFFSET MEASURE, Setting 64 OFF).
 * Tasks and free play use the probe way instead — the setup shortcuts.
 */
import { useMachineStore } from "@/entities/machine/machine-store";
import type { MachineState } from "@/entities/machine/machine-types";
import { generateProgram } from "@/entities/part/cam";
import type { PartDesign } from "@/entities/part/part-design";
import { idealWorkOffset } from "@/entities/part/setup";
import { toolByNumber } from "@/entities/part/tool-library";
import { cncTutorialSteps } from "@/features/cnc-tutorial/steps";
import type { TutorialStep } from "@/features/cnc-tutorial/tutorial-types";
import { useJobStore } from "@/features/part-development/job-store";
import { checkProgram } from "@/features/part-development/program-check";
import { PRACTICE_STOCK, blankDesign, readyMachine, startAt } from "./machine-setups";

export type TutorialLevel = {
  steps: TutorialStep[];
  /** Puts the machine and the job where the tutorial starts. */
  prepare: () => void;
  /** Shown when it is done. */
  outro: string;
};

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const mm = (n: number) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(3)}`;
/** Uppercase, no spaces or block end: how a typed block is compared. */
const squash = (s: string) => s.toUpperCase().replace(/[\s;]/g, "");

// A zero return in progress clears "homed" until it arrives; it is not a lost one.
const homed = {
  holds: (m: MachineState) => (m.homed || m.homingStage !== null) && m.control === "on",
  violation: "The machine lost its zero return. Home it with POWER UP.",
};
const doorShut = { holds: (m: MachineState) => !m.doorOpen && m.homed, violation: "Close the door: the machine will not move with it open." };

// ---------------------------------------------------------------- startup

const startup: TutorialLevel = {
  steps: cncTutorialSteps,
  prepare: () => {
    useJobStore.getState().loadJob(blankDesign(1001));
    useMachineStore.getState().reset();
  },
  outro: "Startup complete: homed, jogged and warmed up. The machine is ready to run a job.",
};

// ---------------------------------------------------------------- jogging

const jog: TutorialLevel = {
  prepare: () => startAt(readyMachine(), blankDesign(1001)),
  outro: "You can put any axis where you want it, as coarse or as fine as the job needs, and send it home again.",
  steps: [
    {
      id: "jog-mode",
      title: "Handle jog",
      shortLabel: "Mode",
      guard: homed,
      phases: [
        {
          id: "mode",
          instruction: "Press HANDLE JOG. The handwheel now moves the selected axis.",
          highlight: ["hand_jog"],
          done: (m) => m.mode === "jog",
        },
      ],
    },
    {
      id: "coarse",
      title: "Coarse moves",
      shortLabel: "Coarse",
      guard: homed,
      phases: [
        {
          id: "x",
          instruction: "Select X.",
          highlight: ["axis_x"],
          done: (m) => m.mode === "jog" && m.jogAxis === "x",
        },
        {
          id: "x-move",
          instruction: (m) =>
            `At 1 mm per detent a click is 10 mm. Turn the handwheel minus (left half) until X reads −100 or less. X is at ${mm(m.position.x)}.`,
          highlight: ["handwheel"],
          done: (m) => m.position.x <= -100,
        },
        {
          id: "y",
          instruction: "Select Y.",
          highlight: ["axis_y"],
          done: (m) => m.mode === "jog" && m.jogAxis === "y",
        },
        {
          id: "y-move",
          instruction: (m) => `Jog Y to −80 or less. Y is at ${mm(m.position.y)}.`,
          highlight: ["handwheel"],
          done: (m) => m.position.y <= -80,
        },
      ],
    },
    {
      id: "fine",
      title: "Fine increments",
      shortLabel: "Fine",
      guard: homed,
      phases: [
        {
          id: "z-fine",
          instruction:
            "Select Z, then on the full panel press the .001/1. key: 0.01 mm per detent, 0.1 mm per click.",
          highlight: ["axis_z"],
          keys: ["INC_001"],
          done: (m) => m.jogAxis === "z" && m.handleIncrement === 0.01,
        },
        {
          id: "z-move",
          instruction: (m) => `Bring Z down to exactly −0.500. Z is at ${mm(m.position.z)}.`,
          highlight: ["handwheel"],
          done: (m) => near(m.position.z, -0.5, 0.0005),
        },
        {
          id: "coarse-again",
          instruction: "Back to coarse: press the .1/100. key for 1 mm per detent.",
          highlight: [],
          keys: ["INC_1"],
          done: (m) => m.handleIncrement === 1,
        },
      ],
    },
    {
      id: "trunnion",
      title: "Tilt and turn",
      shortLabel: "B / C",
      guard: homed,
      phases: [
        {
          id: "b",
          instruction: "Select B: the trunnion tilts the table.",
          highlight: ["axis_b"],
          done: (m) => m.jogAxis === "b",
        },
        {
          id: "b-move",
          instruction: (m) => `Tilt B to +30° or more (plus is the right half). B is at ${m.position.b.toFixed(1)}°.`,
          highlight: ["handwheel"],
          done: (m) => m.position.b >= 30,
        },
        {
          id: "c",
          instruction: "Select C: the platter turns.",
          highlight: ["axis_c"],
          done: (m) => m.jogAxis === "c",
        },
        {
          id: "c-move",
          instruction: (m) => `Turn C to +90° or more. C is at ${m.position.c.toFixed(1)}°.`,
          highlight: ["handwheel"],
          done: (m) => m.position.c >= 90,
        },
      ],
    },
    {
      id: "home",
      title: "Zero return",
      shortLabel: "Home",
      guard: { holds: () => true, violation: "" },
      phases: [
        {
          id: "power-up",
          instruction: "Press POWER UP to send every axis home: Z first, then X and Y, then B and C.",
          highlight: ["power_up"],
          done: (m) => m.homed && m.homingStage === null && Object.values(m.position).every((v) => near(v, 0, 0.001)),
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- part zero

/** G54 the probe would find for the blank in the vise. */
const probeReading = (m: MachineState) =>
  idealWorkOffset({ x: m.stock?.size[0] ?? 80, y: m.stock?.size[1] ?? 60, z: m.stock?.size[2] ?? 30, material: "aluminium" });

const workOffset: TutorialLevel = {
  prepare: () => startAt(readyMachine({ doorOpen: true }), blankDesign(1001)),
  outro:
    "G54 X and Y now sit on the top-face centre. Z stays 0: in this shop the tool lengths carry the height of the part — the next tutorial measures them.",
  steps: [
    {
      id: "clamp",
      title: "Clamp the blank",
      shortLabel: "Clamp",
      guard: { holds: (m) => m.stock !== null, violation: "The blank came out of the vise. Clamp it again." },
      phases: [
        {
          id: "vise",
          instruction: "The door is open. Click the vise to clamp the 80 × 60 × 30 mm blank.",
          highlight: ["vise"],
          done: (m) => m.stock !== null,
        },
        {
          id: "door",
          instruction: "Close the door.",
          highlight: ["door"],
          done: (m) => !m.doorOpen,
        },
      ],
    },
    {
      id: "page",
      title: "Work offsets",
      shortLabel: "OFFSET",
      guard: doorShut,
      phases: [
        {
          id: "offset",
          instruction:
            "Open the full panel and press OFFSET until the WORK tab shows. The cursor starts on G54 X. Tip: with the full panel open you can type on your keyboard.",
          highlight: [],
          keys: ["OFFSET"],
          done: (m) => m.display === "offset" && m.offsetTab === "work",
        },
      ],
    },
    {
      id: "xy",
      title: "Enter X and Y",
      shortLabel: "X / Y",
      guard: {
        holds: (m) => near(m.workOffsets.G54.x, probeReading(m).x, 0.01),
        violation: "G54 X changed. Enter the probe's X again.",
      },
      phases: [
        {
          id: "x",
          instruction: (m) =>
            `The probe found the top-face centre at X ${mm(probeReading(m).x)}. With G54 X highlighted, type ${probeReading(m).x.toFixed(3)} and press F1 (F1 replaces, ENTER adds).`,
          highlight: [],
          keys: ["F1"],
          done: (m) => near(m.workOffsets.G54.x, probeReading(m).x, 0.01),
        },
        {
          id: "y",
          instruction: (m) =>
            `Move the cursor right to Y, type ${probeReading(m).y.toFixed(3)} and press F1.`,
          highlight: [],
          keys: ["RIGHT", "F1"],
          done: (m) => near(m.workOffsets.G54.y, probeReading(m).y, 0.01),
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- tool lengths

/** Tip height above the part top, mm: the paper test as a number. */
function tipGap(m: MachineState): number {
  const tool = toolByNumber(m.toolInSpindle);
  const top = probeReading(m).z + (tool?.length ?? 0);
  return m.position.z - top;
}
const overPart = (m: MachineState) => {
  const p = probeReading(m);
  return near(m.position.x, p.x, 25) && near(m.position.y, p.y, 18);
};
/** H a tool should get by touch-off, within a paper's thickness. */
const touchedOff = (m: MachineState, t: number) => {
  const tool = toolByNumber(t);
  const h = m.tools[t]?.length ?? 0;
  return !!tool && h !== 0 && near(h, probeReading(m).z + tool.length, 0.1);
};

function touchSteps(t: number, fromAway: boolean): TutorialStep[] {
  const label = `T${t}`;
  return [
    {
      id: `approach-${t}`,
      title: `Bring ${label} down`,
      shortLabel: `${label} down`,
      guard: homed,
      phases: [
        ...(fromAway
          ? [
              {
                id: "over",
                instruction: (m: MachineState) => {
                  const p = probeReading(m);
                  return `In HANDLE JOG, put the spindle over the part: X within 25 mm of ${mm(p.x)} (now ${mm(m.position.x)}), Y within 18 mm of ${mm(p.y)} (now ${mm(m.position.y)}).`;
                },
                highlight: ["hand_jog" as const, "axis_x" as const, "axis_y" as const],
                done: (m: MachineState) => overPart(m),
              },
            ]
          : []),
        {
          id: "coarse",
          instruction: (m) =>
            `Select Z and come down at 1 mm per detent until the tip is under 5 mm above the part. Gap: ${tipGap(m).toFixed(2)} mm.`,
          highlight: ["axis_z", "handwheel"],
          done: (m) => overPart(m) && tipGap(m) < 5,
        },
        {
          id: "fine",
          instruction: (m) =>
            `Slow down: .01/10. (0.1 mm per detent), then .001/1. (0.01 mm per click) — stop when the paper drags, the tip 0 to 0.10 mm above. Gap: ${tipGap(m).toFixed(2)} mm.`,
          highlight: ["handwheel"],
          keys: ["INC_01", "INC_001"],
          done: (m) => overPart(m) && tipGap(m) >= 0 && tipGap(m) <= 0.1,
        },
      ],
    },
    {
      id: `measure-${t}`,
      title: `Measure ${label}`,
      shortLabel: `H${String(t).padStart(2, "0")}`,
      guard: { holds: (m) => touchedOff(m, t), violation: `${label}'s length offset changed. Touch it off again.` },
      phases: [
        {
          id: "measure",
          instruction: `Press TOOL OFFSET MEASURE: the control stores this Z as ${label}'s length offset H${String(t).padStart(2, "0")}.`,
          highlight: [],
          keys: ["TOOL_OFFSET_MEASURE"],
          done: (m) => touchedOff(m, t),
        },
      ],
    },
  ];
}

const toolLength: TutorialLevel = {
  prepare: () =>
    startAt(
      readyMachine({
        stock: PRACTICE_STOCK,
        patch: {
          // Part zero as the previous tutorial left it: X/Y probed, Z 0.
          workOffsets: {
            ...readyMachine().workOffsets,
            G54: { ...idealWorkOffset(PRACTICE_STOCK), z: 0, b: 0, c: 0 },
          },
        },
      }),
      blankDesign(1001),
    ),
  outro: "T2 and T3 are touched off. A program that calls G43 H02 or H03 now knows where their tips are.",
  steps: [
    ...touchSteps(2, true),
    {
      id: "next-tool",
      title: "Next tool",
      shortLabel: "T3",
      guard: homed,
      phases: [
        {
          id: "next",
          instruction:
            "Press NEXT TOOL: Z goes up, the head travels to the changer on the left wall, and the arm swaps T2 for T3 from the carousel.",
          highlight: [],
          keys: ["NEXT_TOOL"],
          done: (m) => m.toolInSpindle === 3,
        },
      ],
    },
    // The change leaves the head at the changer, so T3 starts with the move
    // back over the part.
    ...touchSteps(3, true),
  ],
};

// ---------------------------------------------------------------- MDI

const mdi: TutorialLevel = {
  prepare: () => startAt(readyMachine({ stock: PRACTICE_STOCK, probed: true }), blankDesign(1001)),
  outro: "MDI runs whatever you type, once. It is how an operator positions the machine and checks a tool without writing a program.",
  steps: [
    {
      id: "mode",
      title: "MDI mode",
      shortLabel: "MDI",
      guard: homed,
      phases: [
        {
          id: "mdi",
          instruction: "Open the full panel and press MDI.",
          highlight: [],
          keys: ["MDI"],
          done: (m) => m.mode === "mdi",
        },
      ],
    },
    {
      id: "move",
      title: "Position over the part",
      shortLabel: "G00",
      guard: doorShut,
      phases: [
        {
          id: "type",
          instruction:
            "Type G00 G90 G54 X0 Y0 and press INSERT: rapid, absolute, to the part zero in X and Y. You can type on your keyboard while the full panel is open.",
          highlight: [],
          keys: ["INSERT"],
          done: (m) => /G0?0/.test(squash(m.mdi)) && squash(m.mdi).includes("G54") && /X0(?!\d)/.test(squash(m.mdi)) && /Y0(?!\d)/.test(squash(m.mdi)),
        },
        {
          id: "run",
          instruction: "Press CYCLE START. The spindle moves over the centre of the blank.",
          highlight: ["cycle_start"],
          done: (m) => near(m.position.x, m.workOffsets.G54.x, 0.01) && near(m.position.y, m.workOffsets.G54.y, 0.01),
        },
      ],
    },
    {
      id: "spindle",
      title: "Start the spindle",
      shortLabel: "M03",
      guard: homed,
      phases: [
        {
          id: "type",
          instruction: "Type S1500 M03 and press INSERT: 1 500 rpm, clockwise.",
          highlight: [],
          keys: ["INSERT"],
          done: (m) => squash(m.mdi).includes("S1500") && /M0?3(?!\d)/.test(squash(m.mdi)),
        },
        {
          id: "run",
          instruction: "Press CYCLE START and watch the spindle come up to speed. M30 at the end stops it again.",
          highlight: ["cycle_start"],
          done: (m) => m.spindle.dir === "cw" && m.spindle.rpm === 1500,
        },
      ],
    },
    {
      id: "erase",
      title: "Clear MDI",
      shortLabel: "Erase",
      guard: { holds: () => true, violation: "" },
      phases: [
        {
          id: "erase",
          instruction: "When the run has finished, press ERASE PROGRAM to empty the MDI program.",
          highlight: [],
          keys: ["ERASE_PROGRAM"],
          done: (m) => m.mdi === "" && m.program === "idle",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- running a program

const PROVE_OUT: PartDesign = {
  name: "Prove-out plate",
  programNumber: 2001,
  stock: PRACTICE_STOCK,
  features: [
    { id: "p-face", kind: "face", face: "top", depth: 0.5 },
    { id: "p-pocket", kind: "pocket-rect", face: "top", center: [-10, 0], size: [24, 18], cornerRadius: 5, depth: 3 },
    { id: "p-hole", kind: "hole", face: "top", center: [22, 0], diameter: 6.8, depth: 10 },
  ],
};
const PROVE_OUT_NAME = "O02001";

const firstProgram: TutorialLevel = {
  prepare: () => {
    const program = generateProgram(PROVE_OUT).text;
    startAt(
      readyMachine({ stock: PRACTICE_STOCK, probed: true, programs: { [PROVE_OUT_NAME]: program } }),
      PROVE_OUT,
      program,
    );
  },
  outro: "That is how every new program goes on: single block and low rapids until it has shown it is safe, then full speed.",
  steps: [
    {
      id: "select",
      title: "Select the program",
      shortLabel: "Select",
      guard: { holds: (m) => m.activeProgram === PROVE_OUT_NAME, violation: `Select ${PROVE_OUT_NAME} again.` },
      phases: [
        {
          id: "list",
          instruction: "Open the full panel and press LIST PROGRAM.",
          highlight: [],
          keys: ["LIST_PROGRAM"],
          done: (m) => m.mode === "list",
        },
        {
          id: "pick",
          instruction: `Move the cursor to ${PROVE_OUT_NAME} and press SELECT PROGRAM.`,
          highlight: [],
          keys: ["DOWN", "SELECT_PROGRAM"],
          done: (m) => m.activeProgram === PROVE_OUT_NAME,
        },
      ],
    },
    {
      id: "prove",
      title: "Prove it out",
      shortLabel: "Single",
      guard: doorShut,
      phases: [
        {
          id: "single",
          instruction: "Turn SINGLE BLOCK on: the program stops after every block.",
          highlight: [],
          keys: ["SINGLE_BLOCK"],
          done: (m) => m.singleBlock,
        },
        {
          id: "rapid",
          instruction: "Set the rapid override to 25 %.",
          highlight: [],
          keys: ["RAPID_25"],
          done: (m) => m.overrides.rapid === 25,
        },
        {
          id: "start",
          instruction: "Press MEMORY, then CYCLE START for the first block.",
          highlight: ["memory", "cycle_start"],
          done: (m) => m.program !== "idle" && m.runSource === "memory",
        },
        {
          id: "step",
          instruction: (m) =>
            `Keep pressing CYCLE START, one block at a time, reading each before it runs. Line ${m.programLine} of the program — go on to line 12.`,
          highlight: ["cycle_start"],
          done: (m) => m.programLine >= 12,
        },
      ],
    },
    {
      id: "run",
      title: "Let it run",
      shortLabel: "Run",
      guard: doorShut,
      phases: [
        {
          id: "single-off",
          instruction: "Turn SINGLE BLOCK off and put the rapids back to 100 %.",
          highlight: [],
          keys: ["SINGLE_BLOCK", "RAPID_100"],
          done: (m) => !m.singleBlock && m.overrides.rapid === 100,
        },
        {
          id: "go",
          instruction: "Press CYCLE START.",
          highlight: ["cycle_start"],
          done: (m) => m.program === "running" && !m.singleBlock,
        },
        {
          id: "hold",
          instruction: "Press FEED HOLD: motion stops where it is, the spindle keeps turning.",
          highlight: ["feed_hold"],
          done: (m) => m.program === "hold",
        },
        {
          id: "resume",
          instruction: "Press CYCLE START to carry on.",
          highlight: ["cycle_start"],
          done: (m) => m.program === "running",
        },
      ],
    },
    {
      id: "finish",
      title: "Finish",
      shortLabel: "M30",
      guard: { holds: () => true, violation: "" },
      phases: [
        {
          id: "end",
          instruction: "Let it run to M30.",
          highlight: [],
          done: (m) => m.lastProgramDone === PROVE_OUT_NAME,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- lines and arcs

const BASICS_NAME = "O02002";
const MARKER = "(YOUR MOVES HERE)";
const BASICS_TEMPLATE = `%
${BASICS_NAME} (LINES AND ARCS)
(T2 10 MM END MILL - G54 AT THE TOP-FACE CENTRE)
G00 G17 G21 G40 G49 G80 G90
T2 M06
S6000 M03
G54 G00 X-30. Y-20.
G43 H02 Z10. M08
G01 Z-1. F300.
${MARKER}

G00 Z10. M09
G53 G49 Z0.
M30
%`;

/** The trainee's own blocks: everything after the marker. */
const ownBlocks = () => {
  const program = useJobStore.getState().program;
  const at = program.indexOf(MARKER);
  return (at === -1 ? program : program.slice(at + MARKER.length)).toUpperCase();
};

const gcodeBasics: TutorialLevel = {
  prepare: () =>
    startAt(readyMachine({ stock: PRACTICE_STOCK, probed: true }), blankDesign(2002, "Lines and arcs"), BASICS_TEMPLATE),
  outro: "Lines, arcs, a tool, a speed and a feed: that is most of what any milling program is made of.",
  steps: [
    {
      id: "lines",
      title: "Straight lines",
      shortLabel: "G01",
      guard: { holds: () => true, violation: "" },
      phases: [
        {
          id: "open",
          instruction:
            "Open the program in the editor (Program → Full screen). The tool is already 1 mm into the top at X−30 Y−20. Under (YOUR MOVES HERE), write G01 X30. — a cut along X.",
          highlight: [],
          done: () => /G0?1[^\n]*X\s*30/.test(ownBlocks()) || /^\s*X\s*30/m.test(ownBlocks()),
        },
        {
          id: "y",
          instruction: "Add Y20. on the next line: G01 is modal, so it keeps cutting straight.",
          highlight: [],
          done: () => /^\s*(G0?1\s*)?Y\s*20/m.test(ownBlocks()),
        },
      ],
    },
    {
      id: "arcs",
      title: "Arcs",
      shortLabel: "G02/G03",
      guard: { holds: () => true, violation: "" },
      phases: [
        {
          id: "arc",
          instruction:
            "Add an arc back towards the start: G03 X-30. R30. (anticlockwise, radius 30) — or G02 with I and J if you prefer centres.",
          highlight: [],
          done: () => /G0?[23][^\n]*X[^\n]*(R|I|J)/.test(ownBlocks()),
        },
        {
          id: "close",
          instruction: "Finish the shape with G01 Y-20. back to the start point.",
          highlight: [],
          done: () => /G0?1[^\n]*Y\s*-\s*20/.test(ownBlocks()) || /^\s*Y\s*-\s*20/m.test(ownBlocks().split(/G0?[23]/).slice(1).join("")),
        },
      ],
    },
    {
      id: "check",
      title: "Check and send",
      shortLabel: "Check",
      guard: { holds: () => true, violation: "" },
      phases: [
        {
          id: "clean",
          instruction: "Press Check: the program must interpret with no alarms and no crash.",
          highlight: [],
          done: () => {
            const { program, design } = useJobStore.getState();
            const check = checkProgram(program, design, "ideal", useMachineStore.getState().machine);
            return check.crashes.length === 0 && !check.result.diagnostics.some((d) => d.severity === "alarm");
          },
        },
        {
          id: "send",
          instruction: `Send it to the machine: it is stored as ${BASICS_NAME} and selected.`,
          highlight: [],
          done: (m) => m.activeProgram === BASICS_NAME && m.programs[BASICS_NAME] === useJobStore.getState().program,
        },
      ],
    },
    {
      id: "cut",
      title: "Cut it",
      shortLabel: "Cut",
      guard: { holds: () => true, violation: "" },
      phases: [
        {
          id: "run",
          instruction: "Door shut, MEMORY, CYCLE START — and watch your shape appear in the top of the blank.",
          highlight: ["memory", "cycle_start"],
          done: (m) => m.lastProgramDone === BASICS_NAME,
        },
      ],
    },
  ],
};

export const TUTORIALS: Record<string, TutorialLevel> = {
  "umc500.tutorial.startup": startup,
  "umc500.tutorial.jog": jog,
  "umc500.tutorial.work-offset": workOffset,
  "umc500.tutorial.tool-length": toolLength,
  "umc500.tutorial.mdi": mdi,
  "umc500.tutorial.first-program": firstProgram,
  "umc500.tutorial.gcode-basics": gcodeBasics,
};
