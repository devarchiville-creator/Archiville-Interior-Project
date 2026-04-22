export const STAGES = [
  { key: "upload", label: "Upload" },
  { key: "povs", label: "POVs" },
  { key: "selected", label: "Select" },
  { key: "refined", label: "Refine" },
  { key: "region", label: "Edit" },
  { key: "final", label: "Final" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const ASSET_TYPES = {
  FLOOR_PLAN: "floor_plan",
  POV: "pov_sketch",
  SELECTED: "selected_pov",
  REFINED: "refined_2d",
  REGION_EDIT: "region_edit",
  FINAL: "final_output",
} as const;
