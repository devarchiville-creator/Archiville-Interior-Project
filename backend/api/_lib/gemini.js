const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const ENABLE_FALLBACK = String(process.env.ENABLE_FALLBACK || "true") === "true";

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function parseDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Invalid base64 data URL");
  return { mimeType: match[1], data: match[2] };
}

function extractImagesFromResponse(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];

  const images = parts
    .filter((p) => p.inlineData?.data)
    .map((p) => {
      const mimeType = p.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${p.inlineData.data}`;
    });

  return images;
}

function isQuotaError(error) {
  const msg = String(error?.message || "");
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes('"code":429');
}

function fallbackImages(base, count = 1) {
  return Array(count).fill(base);
}

async function generateImage({ imageBase64, prompt, extraImages = [] }) {
  const base = parseDataUrl(imageBase64);

  const contents = [
    {
      inlineData: {
        mimeType: base.mimeType,
        data: base.data,
      },
    },
  ];

  for (const img of extraImages) {
    const parsed = parseDataUrl(img);
    contents.push({
      inlineData: {
        mimeType: parsed.mimeType,
        data: parsed.data,
      },
    });
  }

  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
  });

  return extractImagesFromResponse(response);
}

function send(res, status, data) {
  res.status(status).json(data);
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
}

module.exports = {
  MODEL_NAME,
  ENABLE_FALLBACK,
  generateImage,
  fallbackImages,
  isQuotaError,
  send,
  cors,
};