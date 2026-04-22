const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const ENABLE_FALLBACK = String(process.env.ENABLE_FALLBACK || "true") === "true";

// ✅ Check BEFORE initializing the client
if (!GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY environment variable is not set. " +
    "Add it in Vercel → Settings → Environment Variables."
  );
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

console.log("gemini.js loaded");
console.log("MODEL_NAME:", MODEL_NAME);
console.log("ENABLE_FALLBACK:", ENABLE_FALLBACK);
console.log("API KEY set:", !!GEMINI_API_KEY);
console.log("API KEY prefix:", GEMINI_API_KEY.slice(0, 6) + "...");

// ─────────────────────────────────────────────────────────────────────────────

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

  console.log("extractImagesFromResponse — parts:", parts.length, "images:", images.length);

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

// ── Decide whether this model supports responseModalities ────────────────────
// Flash Image models require it. Pro text/vision models do NOT support it
// and will return a 400 if you include it.
function supportsResponseModalities(modelName) {
  return (
    modelName.includes("flash-image") ||
    modelName.includes("pro-image") ||
    modelName.includes("nano-banana")
  );
}

// ─────────────────────────────────────────────────────────────────────────────

async function callGeminiSingleImage({
  imageBase64,
  textPrompt,
  extraImages = [],
}) {
  if (!imageBase64) throw new Error("imageBase64 is required");

  console.log("callGeminiSingleImage — model:", MODEL_NAME);
  console.log("callGeminiSingleImage — prompt length:", textPrompt?.length || 0);
  console.log("callGeminiSingleImage — extraImages:", extraImages.length);

  const baseImage = parseDataUrl(imageBase64);
  console.log("callGeminiSingleImage — base mimeType:", baseImage.mimeType);
  console.log("callGeminiSingleImage — base data length:", baseImage.data.length);

  const contents = [
    { inlineData: { mimeType: baseImage.mimeType, data: baseImage.data } },
  ];

  for (const img of extraImages) {
    const parsed = parseDataUrl(img);
    contents.push({
      inlineData: { mimeType: parsed.mimeType, data: parsed.data },
    });
  }

  contents.push({ text: textPrompt });

  // Only add responseModalities for image-generation models
  const useModalities = supportsResponseModalities(MODEL_NAME);
  console.log("callGeminiSingleImage — useResponseModalities:", useModalities);

  const requestPayload = {
    model: MODEL_NAME,
    contents,
    ...(useModalities && {
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  };

  const startedAt = Date.now();

  try {
    const response = await ai.models.generateContent(requestPayload);
    const elapsedMs = Date.now() - startedAt;
    console.log("callGeminiSingleImage — Gemini finished in ms:", elapsedMs);
    console.log("callGeminiSingleImage — candidates:", response?.candidates?.length || 0);

    const result = extractImagesFromResponse(response);
    console.log("callGeminiSingleImage — images extracted:", result.images.length);

    return result;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.error("callGeminiSingleImage — failed in ms:", elapsedMs);
    console.error("callGeminiSingleImage — error name:", error?.name);
    console.error("callGeminiSingleImage — error status:", error?.status);
    console.error("callGeminiSingleImage — error message:", error?.message);
    throw error;
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

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