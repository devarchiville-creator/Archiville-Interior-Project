const { MODEL_NAME, ENABLE_FALLBACK, send, cors, handleOptions } = require("./_lib/gemini");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  cors(res);

  const rawKey = process.env.GEMINI_API_KEY || "";

  return send(res, 200, {
    ok: true,
    message: "Backend running",
    model: MODEL_NAME,
    fallback: ENABLE_FALLBACK,
    keyPresent: !!rawKey,
    keyPreview: rawKey ? `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}` : null,
  });
};