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
    const { imageBase64, maskBase64, regions } = req.body || {};

    if (!imageBase64 || !maskBase64 || !Array.isArray(regions) || !regions.length) {
      return send(res, 400, {
        error: "imageBase64, maskBase64 and regions are required",
      });
    }

    const regionPrompt = regions
      .map((r, i) => `Color ${i + 1} (${r.color}): ${r.prompt}`)
      .join("\n");

    const textPrompt = `
Edit this interior image using the provided color mask.

Instructions:
${regionPrompt}

Only modify the painted regions according to their color instructions.
Preserve all unpainted regions exactly as they are.
Preserve the same camera view and composition.
Use advanced reasoning to ensure edits are spatially coherent and realistic.
Return one updated design image.
`;

    try {
      const result = await callGeminiSingleImage({
        imageBase64,
        textPrompt,
        extraImages: [maskBase64],
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
          text: "Fallback region edit returned",
          debug: { modelRequested: MODEL_NAME, fallback: true },
        });
      }
      throw error;
    }
  } catch (error) {
    return send(res, 500, {
      error: error?.message || "Failed to edit regions",
      modelRequested: MODEL_NAME,
    });
  }
};