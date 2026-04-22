const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const GEMINI_API_KEY = "AIzaSyCCtTP2cQyF2KFUYeuKHican2V0RytGh9k";
const MODEL_NAME = "gemini-2.5-pro-preview-05-06";
const ENABLE_FALLBACK = true;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function maskKey(key = "") {
  if (!key) return "[missing]";
  if (key.length <= 8) return "[too-short]";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

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

function logStartupInfo() {
  console.log("========================================");
  console.log("Server boot");
  console.log("PORT:", PORT);
  console.log("MODEL_NAME:", MODEL_NAME);
  console.log("API KEY:", maskKey(GEMINI_API_KEY));
  console.log("FALLBACK:", ENABLE_FALLBACK);
  console.log("NODE_ENV:", process.env.NODE_ENV || "not-set");
  console.log("========================================");
}

function logQuotaDetails(error) {
  try {
    const rawMessage = error?.message;
    console.log("---- RAW ERROR MESSAGE START ----");
    console.log(rawMessage || "[no message]");
    console.log("---- RAW ERROR MESSAGE END ----");

    let parsed = null;
    if (typeof rawMessage === "string" && rawMessage.trim().startsWith("{")) {
      parsed = JSON.parse(rawMessage);
    } else if (error?.error) {
      parsed = error.error;
    }

    const payload = parsed?.error || parsed;
    if (!payload) {
      console.log("No structured payload found on error.");
      return;
    }

    console.log("Structured error code:", payload.code);
    console.log("Structured error status:", payload.status);
    console.log("Structured error message:", payload.message);

    const details = Array.isArray(payload.details) ? payload.details : [];
    for (const detail of details) {
      if (detail["@type"] === "type.googleapis.com/google.rpc.QuotaFailure") {
        console.log("Quota violations:");
        for (const violation of detail.violations || []) {
          console.log("  quotaMetric:", violation.quotaMetric);
          console.log("  quotaId:", violation.quotaId);
          console.log("  quotaDimensions:", JSON.stringify(violation.quotaDimensions));
        }
      }

      if (detail["@type"] === "type.googleapis.com/google.rpc.RetryInfo") {
        console.log("Retry delay:", detail.retryDelay);
      }

      if (detail["@type"] === "type.googleapis.com/google.rpc.Help") {
        console.log("Help links:", JSON.stringify(detail.links || []));
      }
    }
  } catch (e) {
    console.log("Failed to parse structured quota details:", e?.message);
  }
}

function isQuotaError(error) {
  if (!error) return false;
  if (error?.status === 429) return true;
  const msg = String(error?.message || "");
  return msg.includes("RESOURCE_EXHAUSTED") || msg.includes('"code":429');
}

async function callGeminiSingleImage({ imageBase64, textPrompt, routeName, extraImages = [] }) {
  console.log(`\n=== ${routeName} ===`);
  console.log("Using model:", MODEL_NAME);
  console.log("Using API key:", maskKey(GEMINI_API_KEY));
  console.log("Prompt preview:", (textPrompt || "").slice(0, 250));

  if (!imageBase64) {
    throw new Error("imageBase64 is required");
  }

  const baseImage = parseDataUrl(imageBase64);
  console.log("Base image mimeType:", baseImage.mimeType);
  console.log("Base64 payload length:", baseImage.data.length);

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

  const startedAt = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
    });

    const elapsedMs = Date.now() - startedAt;
    console.log("Gemini call finished in ms:", elapsedMs);

    const { images, text, partsCount } = extractImagesFromResponse(response);
    console.log("Response candidates:", response?.candidates?.length || 0);
    console.log("Response partsCount:", partsCount);
    console.log("Images extracted:", images.length);
    console.log("Returned text preview:", text ? text.slice(0, 300) : "[none]");

    return { images, text, raw: response };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.log("Gemini call failed in ms:", elapsedMs);
    console.error("Error name:", error?.name);
    console.error("Error status:", error?.status);
    console.error("Error message:", error?.message);
    console.error("Full error object:", error);
    logQuotaDetails(error);
    throw error;
  }
}

function buildFallbackPovs(baseImage) {
  return [baseImage, baseImage, baseImage, baseImage, baseImage];
}

app.get("/api/health", (req, res) => {
  console.log("GET /api/health");
  res.json({
    ok: true,
    message: "Server is running",
    model: MODEL_NAME,
    apiKeyMasked: maskKey(GEMINI_API_KEY),
    fallback: ENABLE_FALLBACK,
  });
});

app.post("/api/nano/generate-povs", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    const prompts = [
      "Generate an interior design sketch from a front-left camera angle based on this floor plan. Keep layout coherence.",
    ];

    const generated = [];

    for (let i = 0; i < prompts.length; i += 1) {
      try {
        const result = await callGeminiSingleImage({
          routeName: `/api/nano/generate-povs [${i + 1}]`,
          imageBase64,
          textPrompt: prompts[i],
        });

        if (result.images.length > 0) {
          generated.push(result.images[0]);
        }
      } catch (error) {
        if (ENABLE_FALLBACK && isQuotaError(error)) {
          console.log("Quota hit during POV generation. Using fallback images.");
          return res.json({
            success: true,
            images: buildFallbackPovs(imageBase64),
            text: "Fallback POVs returned",
            debug: {
              modelRequested: MODEL_NAME,
              fallback: true,
            },
          });
        }
        throw error;
      }
    }

    if (!generated.length && ENABLE_FALLBACK) {
      return res.json({
        success: true,
        images: buildFallbackPovs(imageBase64),
        text: "Fallback POVs returned",
        debug: {
          modelRequested: MODEL_NAME,
          fallback: true,
        },
      });
    }

    return res.json({
      success: true,
      images: generated,
      debug: {
        modelRequested: MODEL_NAME,
        imageCount: generated.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to generate POVs",
      modelRequested: MODEL_NAME,
      apiKeyMasked: maskKey(GEMINI_API_KEY),
    });
  }
});

app.post("/api/nano/refine-selected", async (req, res) => {
  try {
    const { imageBase64, prompt, cameraPoint } = req.body;

    const cameraInstruction = cameraPoint
      ? `Use the selected camera point as the main viewing anchor.
Camera point coordinates on sketch:
x = ${cameraPoint.x}
y = ${cameraPoint.y}

Interpret this as the user's intended point-of-view focus area and generate the refined version from that visual direction.`
      : "No explicit camera point provided. Preserve the sketch perspective.";

    const finalPrompt = `
Create a cleaner and more intentional 3D interior design concept from this selected sketch.
Preserve the selected camera angle and room composition.

${cameraInstruction}

Apply the following design instructions:
${prompt || "No extra instructions provided."}

Output should still feel like a design concept render, not final photorealistic output.
`;

    try {
      const result = await callGeminiSingleImage({
        routeName: "/api/nano/refine-selected",
        imageBase64,
        textPrompt: finalPrompt,
      });

      return res.json({
        success: true,
        images: result.images,
        text: result.text,
        debug: {
          modelRequested: MODEL_NAME,
          imageCount: result.images.length,
        },
      });
    } catch (error) {
      if (ENABLE_FALLBACK && isQuotaError(error)) {
        console.log("Quota hit during refine-selected. Using fallback image.");
        return res.json({
          success: true,
          images: [imageBase64],
          text: "Fallback refined image returned",
          debug: {
            modelRequested: MODEL_NAME,
            fallback: true,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to refine image",
      modelRequested: MODEL_NAME,
      apiKeyMasked: maskKey(GEMINI_API_KEY),
    });
  }
});

app.post("/api/nano/region-edit", async (req, res) => {
  console.log("\n=== /api/nano/region-edit ===");

  try {
    const { imageBase64, maskBase64, regions } = req.body;

    if (!imageBase64 || !maskBase64 || !Array.isArray(regions) || !regions.length) {
      return res.status(400).json({
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
Preserve all unpainted regions exactly.
Preserve the same camera view and composition.
Return one updated design image.
`;

    try {
      const result = await callGeminiSingleImage({
        routeName: "/api/nano/region-edit",
        imageBase64,
        textPrompt,
        extraImages: [maskBase64],
      });

      return res.json({
        success: true,
        images: result.images,
        text: result.text,
        debug: {
          modelRequested: MODEL_NAME,
          imageCount: result.images.length,
        },
      });
    } catch (error) {
      if (ENABLE_FALLBACK && isQuotaError(error)) {
        console.log("Quota hit during region-edit. Using fallback image.");
        return res.json({
          success: true,
          images: [imageBase64],
          text: "Fallback region edit returned",
          debug: {
            modelRequested: MODEL_NAME,
            fallback: true,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to edit regions",
      modelRequested: MODEL_NAME,
      apiKeyMasked: maskKey(GEMINI_API_KEY),
    });
  }
});

app.post("/api/nano/finalize-realistic", async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    const textPrompt = `
Create a photorealistic final render of this exact interior design.
Keep the exact same furniture placement, layout, proportions, camera angle, and design choices.
Do not redesign the room.
Only upgrade it into a polished realistic interior render with realistic materials, shadows, lighting, texture, and depth.
`;

    try {
      const result = await callGeminiSingleImage({
        routeName: "/api/nano/finalize-realistic",
        imageBase64,
        textPrompt,
      });

      return res.json({
        success: true,
        images: result.images,
        text: result.text,
        debug: {
          modelRequested: MODEL_NAME,
          imageCount: result.images.length,
        },
      });
    } catch (error) {
      if (ENABLE_FALLBACK && isQuotaError(error)) {
        console.log("Quota hit during finalize-realistic. Using fallback image.");
        return res.json({
          success: true,
          images: [imageBase64],
          text: "Fallback final realistic image returned",
          debug: {
            modelRequested: MODEL_NAME,
            fallback: true,
          },
        });
      }
      throw error;
    }
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Failed to generate final realistic image",
      modelRequested: MODEL_NAME,
      apiKeyMasked: maskKey(GEMINI_API_KEY),
    });
  }
});

app.listen(PORT, () => {
  logStartupInfo();
  console.log(`Server running on http://localhost:${PORT}`);
});