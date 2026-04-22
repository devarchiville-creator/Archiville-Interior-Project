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
    const { imageBase64 } = req.body || {};

    if (!imageBase64) {
      return send(res, 400, { error: "imageBase64 is required" });
    }

    const textPrompt = `
Create a photorealistic final render of this exact interior design.
Keep the exact same furniture placement, layout, proportions, camera angle, and design choices.
Do not redesign or reinterpret the room — only upgrade the visual quality.

Produce:
- Realistic materials with accurate textures (wood grain, fabric weave, stone patterns)
- Physically accurate lighting with soft shadows and highlights
- Proper depth of field and spatial depth
- Professional architectural photography composition

Output one polished, photorealistic interior render.
`;

    try {
      const result = await callGeminiSingleImage({
        imageBase64,
        textPrompt,
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
          text: "Fallback final realistic image returned",
          debug: { modelRequested: MODEL_NAME, fallback: true },
        });
      }
      throw error;
    }
  } catch (error) {
    return send(res, 500, {
      error: error?.message || "Failed to generate final realistic image",
      modelRequested: MODEL_NAME,
    });
  }
};