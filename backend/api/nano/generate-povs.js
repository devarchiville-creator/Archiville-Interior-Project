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

    const prompts = [
      "Front-left view interior sketch",
      "Front-right view interior sketch",
      "Corner perspective interior sketch",
      "Top angle interior sketch",
      "Wide room perspective sketch",
    ];

    const images = [];

    for (const p of prompts) {
      try {
        const result = await generateImage({
          imageBase64,
          prompt: p,
        });

        if (result[0]) images.push(result[0]);
      } catch (err) {
        if (ENABLE_FALLBACK && isQuotaError(err)) {
          return send(res, 200, {
            success: true,
            images: fallbackImages(imageBase64, 5),
          });
        }
        throw err;
      }
    }

    return send(res, 200, {
      success: true,
      images,
    });
  } catch (err) {
    return send(res, 500, { error: err.message });
  }
};