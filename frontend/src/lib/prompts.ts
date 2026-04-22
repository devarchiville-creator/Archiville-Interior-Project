// Stage prompt builders for Nano Banana adapter.
export type RefineVars = {
  roomType?: string;
  designStyle?: string;
  materials?: string;
  lighting?: string;
  colors?: string;
  furniture?: string;
  extra?: string;
};

export const buildPovsPrompt = () =>
  "Analyze the uploaded floor plan and produce 5 distinct interior concept visualizations from different plausible viewpoints. Render in an architectural sketch / early-stage interior ideation style. Maintain coherence with the implied room layout.";

export const buildRefinePrompt = (v: RefineVars) => {
  const lines = [
    "Using the chosen viewpoint as the base, generate a cleaner, more intentional 2D interior design image.",
    "Preserve the original spatial composition and perspective.",
  ];
  if (v.roomType) lines.push(`Room type: ${v.roomType}.`);
  if (v.designStyle) lines.push(`Design style: ${v.designStyle}.`);
  if (v.materials) lines.push(`Materials: ${v.materials}.`);
  if (v.colors) lines.push(`Color palette: ${v.colors}.`);
  if (v.lighting) lines.push(`Lighting mood: ${v.lighting}.`);
  if (v.furniture) lines.push(`Furniture: ${v.furniture}.`);
  if (v.extra) lines.push(`Additional notes: ${v.extra}.`);
  return lines.join(" ");
};

export const buildRegionPrompt = (instruction: string) =>
  `Edit ONLY the marked region according to: "${instruction}". Strictly preserve everything outside the region — keep perspective, lighting, materials, and style identical to the base image.`;

export const buildFinalPrompt = () =>
  "Create a polished, photorealistic final interior render from the latest approved version. Improve realism, materials, textures, lighting, and visual harmony while preserving the approved layout and design choices.";
