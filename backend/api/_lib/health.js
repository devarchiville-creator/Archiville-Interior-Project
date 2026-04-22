const { MODEL_NAME, send, cors } = require("./_lib/gemini");

module.exports = async (req, res) => {
  cors(res);
  return send(res, 200, {
    ok: true,
    message: "Backend running",
    model: MODEL_NAME,
  });
};