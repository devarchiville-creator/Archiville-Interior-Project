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
    const { imageBase64, maskBase64, regions } = req.body;

    const prompt = regions
      .map((r) => `${r.color}: ${r.prompt}`)
      .join("\n");

    try {
      const images = await generateImage({
        imageBase64,
        prompt: `Edit based on mask:\n${prompt}`,
        extraImages: [maskBase64],
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