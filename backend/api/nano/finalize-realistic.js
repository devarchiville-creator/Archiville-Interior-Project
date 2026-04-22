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
    const { imageBase64 } = req.body;

    const prompt = `
Convert this into a photorealistic interior render.
Keep same layout, furniture, camera angle.
Do not redesign.
`;

    try {
      const images = await generateImage({
        imageBase64,
        prompt,
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