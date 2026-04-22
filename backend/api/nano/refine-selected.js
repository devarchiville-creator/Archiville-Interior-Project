const {
  MODEL_NAME,
  ENABLE_FALLBACK,
  isQuotaError,
  callGeminiSingleImage,
  send,
  cors,
  handleOptions,
} = require("../_lib/gemini");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  cors(res);

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const { imageBase64, prompt, cameraPoint } = req.body || {};

    if (!imageBase64) {
      return send(res, 400, { error: "imageBase64 is required" });
    }

    const cameraInstruction = cameraPoint
      ? `Use the camera point at approximately ${Math.round(cameraPoint.x * 100)}% from left, ${Math.round(cameraPoint.y * 100)}% from top as the main viewing anchor.
Interpret this as the user's intended point-of-view and generate the refined version from that visual direction.`
      : "No explicit camera point provided. Preserve the sketch perspective.";

    const finalPrompt = `
Create a cleaner and more intentional 3D interior design concept from this selected sketch.
Preserve the selected camera angle and room composition.

${cameraInstruction}

Apply the following design instructions:
${prompt || "No extra instructions provided."}

Use advanced visual reasoning to produce a highly coherent, spatially accurate output.
Output should feel like a polished design concept render, not final photorealistic output.
`;

    try {
      const result = await callGeminiSingleImage({
        imageBase64,
        textPrompt: finalPrompt,
      });

      return send(res, 200, {
        success: true,
        images: result.images,
        text: result.text,
        debug: { modelRequested: MODEL_NAME, imageCount: result.images.length },
      });
    } catch (error) {
      if (ENABLE_FALLBACK && isQuotaError(error)) {
        return send(res, 200, {
          success: true,
          images: [imageBase64],
          text: "Fallback refined image returned",
          debug: { modelRequested: MODEL_NAME, fallback: true },
        });
      }
      throw error;
    }
  } catch (error) {
    return send(res, 500, {
      error: error?.message || "Failed to refine image",
      modelRequested: MODEL_NAME,
    });
  }
};