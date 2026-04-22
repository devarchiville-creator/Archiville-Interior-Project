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
    .filter((part) => part.inlineData?.data)
    .map((part) => {
      const mimeType = part.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    });

  const text = parts
    .filter((part) => part.text)
    .map((part) => part.text)
    .join("\n");

  return { images, text, partsCount: parts.length };
}

function isQuotaError(error) {
  if (!error) return false;
  if (error?.status === 429) return true;
  const msg = String(error?.message || "");
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes('"code":429');
}

function fallbackImages(base, count = 1) {
  return Array(count).fill(base);
}

function buildFallbackPovs(baseImage) {
  return [baseImage, baseImage, baseImage, baseImage, baseImage];
}

async function callGeminiSingleImage({
  imageBase64,
  textPrompt,
  extraImages = [],
}) {
  if (!imageBase64) throw new Error("imageBase64 is required");

  const baseImage = parseDataUrl(imageBase64);

  const contents = [
    {
      inlineData: {
        mimeType: baseImage.mimeType,
        data: baseImage.data,
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

  contents.push({ text: textPrompt });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  return extractImagesFromResponse(response);
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.status(200).end();
    return true;
  }
  return false;
}

function send(res, status, data) {
  cors(res);
  res.status(status).json(data);
}

module.exports = {
  MODEL_NAME,
  ENABLE_FALLBACK,
  parseDataUrl,
  extractImagesFromResponse,
  isQuotaError,
  fallbackImages,
  buildFallbackPovs,
  callGeminiSingleImage,
  cors,
  handleOptions,
  send,
};