"use client";

import { useMachineStore } from "@/entities/machine/machine-store";
import { toolByNumber, type LibraryTool } from "@/entities/part/tool-library";

const noopRaycast = () => {};

/** Spindle nose below the Spindle node's origin, metres (see the build script). */
const NOSE_Y = -0.131;
const MM = 0.001;

function ToolBody({ tool }: { tool: LibraryTool }) {
  const tipY = NOSE_Y - tool.length * MM;
  const holderLen = (tool.length - tool.stickout) * MM;
  const shankLen = (tool.stickout - tool.fluteLength) * MM;
  const r = (tool.diameter / 2) * MM;
  const pointed = tool.kind === "drill" || tool.kind === "spot";
  const tipLen = pointed
    ? r / Math.tan(((tool.tipAngle ?? 118) * Math.PI) / 360)
    : tool.kind === "ball"
      ? r
      : 0;
  const flute = tool.fluteLength * MM - tipLen;
  return (
    <group>
      {/* Holder, with a flat on the flange so rotation shows. */}
      <mesh position={[0, NOSE_Y - holderLen / 2, 0]} raycast={noopRaycast}>
        <cylinderGeometry
          args={[(tool.holderDiameter / 2) * MM, (tool.holderDiameter / 2) * MM * 0.8, holderLen, 32]}
        />
        <meshStandardMaterial color="#b9bfc6" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[(tool.holderDiameter / 2) * MM, NOSE_Y - 0.008, 0]} raycast={noopRaycast}>
        <boxGeometry args={[0.006, 0.012, 0.012]} />
        <meshStandardMaterial color="#3c4046" />
      </mesh>
      {shankLen > 0 && (
        <mesh position={[0, tipY + tool.fluteLength * MM + shankLen / 2, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[r, r, shankLen, 24]} />
          <meshStandardMaterial color="#9aa1a8" metalness={0.8} roughness={0.35} />
        </mesh>
      )}
      <mesh position={[0, tipY + tipLen + flute / 2, 0]} raycast={noopRaycast}>
        <cylinderGeometry args={[r, r, flute, 24]} />
        <meshStandardMaterial color="#3d4146" metalness={0.7} roughness={0.35} />
      </mesh>
      {pointed && (
        <mesh position={[0, tipY + tipLen / 2, 0]} rotation={[Math.PI, 0, 0]} raycast={noopRaycast}>
          <coneGeometry args={[r, tipLen, 24]} />
          <meshStandardMaterial color="#3d4146" metalness={0.7} roughness={0.35} />
        </mesh>
      )}
      {tool.kind === "ball" && (
        <mesh position={[0, tipY + r, 0]} raycast={noopRaycast}>
          <sphereGeometry args={[r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#3d4146" metalness={0.7} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
}

/** The tool in the spindle, drawn from the tool table at its real length. */
export function SpindleTool() {
  const number = useMachineStore((s) => s.machine.toolInSpindle);
  const tool = toolByNumber(number);
  return tool ? <ToolBody tool={tool} /> : null;
}
