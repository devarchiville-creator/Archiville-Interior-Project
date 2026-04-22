const {
  generateImage,
  fallbackImages,
  isQuotaError,
  ENABLE_FALLBACK,
  send,
  cors,
} = require("../_lib/gemini");

module.exports = async (req, res) => {
  cors(res);

  try {
    const { imageBase64, prompt, cameraPoint } = req.body;

    const camera = cameraPoint
      ? `Focus camera around x:${cameraPoint.x}, y:${cameraPoint.y}`
      : "";

    const finalPrompt = `
Refine this interior sketch into a better design render.
${camera}
${prompt}
`;

    try {
      const images = await generateImage({
        imageBase64,
        prompt: finalPrompt,
      });

      return send(res, 200, { success: true, images });
    } catch (err) {
      if (ENABLE_FALLBACK && isQuotaError(err)) {
        return send(res, 200, {
          success: true,
          images: fallbackImages(imageBase64),
        });
      }
      throw err;
    }
  } catch (err) {
    return send(res, 500, { error: err.message });
  }
};