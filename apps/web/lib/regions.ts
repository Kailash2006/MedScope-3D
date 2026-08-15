// Body regions — codes match the ML feature contract (features.schema.json).
// Each region carries geometry for the procedural 3D body and a 2D box for the
// accessible SVG fallback, so both views stay in sync with the same state.

export type RegionCode =
  | "head"
  | "jaw"
  | "chest_left"
  | "chest_right"
  | "abdomen"
  | "back"
  | "arm_left"
  | "arm_right"
  | "leg_left"
  | "leg_right";

export interface RegionDef {
  code: RegionCode;
  label: string;
  // Procedural 3D primitive (a rounded box), in a simple front-facing body layout.
  box: { pos: [number, number, number]; size: [number, number, number] };
  // 2D rectangle for the SVG fallback (viewBox 0 0 100 200).
  svg: { x: number; y: number; w: number; h: number };
}

export const REGIONS: RegionDef[] = [
  { code: "head", label: "Head", box: { pos: [0, 3.1, 0], size: [0.9, 0.9, 0.9] }, svg: { x: 42, y: 6, w: 16, h: 16 } },
  { code: "jaw", label: "Jaw", box: { pos: [0, 2.5, 0.15], size: [0.7, 0.35, 0.7] }, svg: { x: 44, y: 22, w: 12, h: 8 } },
  { code: "chest_left", label: "Chest (left)", box: { pos: [-0.45, 1.7, 0], size: [0.8, 1.1, 0.6] }, svg: { x: 34, y: 34, w: 16, h: 26 } },
  { code: "chest_right", label: "Chest (right)", box: { pos: [0.45, 1.7, 0], size: [0.8, 1.1, 0.6] }, svg: { x: 50, y: 34, w: 16, h: 26 } },
  { code: "abdomen", label: "Abdomen", box: { pos: [0, 0.7, 0], size: [1.5, 1.0, 0.6] }, svg: { x: 34, y: 60, w: 32, h: 24 } },
  { code: "back", label: "Back", box: { pos: [0, 1.2, -0.4], size: [1.6, 2.0, 0.3] }, svg: { x: 68, y: 34, w: 14, h: 50 } },
  { code: "arm_left", label: "Arm (left)", box: { pos: [-1.25, 1.4, 0], size: [0.45, 2.2, 0.45] }, svg: { x: 20, y: 34, w: 12, h: 46 } },
  { code: "arm_right", label: "Arm (right)", box: { pos: [1.25, 1.4, 0], size: [0.45, 2.2, 0.45] }, svg: { x: 68, y: 34, w: 12, h: 46 } },
  { code: "leg_left", label: "Leg (left)", box: { pos: [-0.4, -1.4, 0], size: [0.6, 2.6, 0.6] }, svg: { x: 38, y: 86, w: 12, h: 60 } },
  { code: "leg_right", label: "Leg (right)", box: { pos: [0.4, -1.4, 0], size: [0.6, 2.6, 0.6] }, svg: { x: 50, y: 86, w: 12, h: 60 } },
];

export const REGION_LABEL: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r.label]),
);
