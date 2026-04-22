const {
  MODEL_NAME,
  ENABLE_FALLBACK,
  isQuotaError,
  buildFallbackPovs,
  callGeminiSingleImage,
  send,
  cors,
  handleOptions,
} = require("../_lib/gemini");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  cors(res);

  if (req.method !== "POST") {
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const { imageBase64, cameraPoint } = req.body || {};

    if (!imageBase64) {
      return send(res, 400, { error: "imageBase64 is required" });
    }

    let cameraInstruction = "";
    if (
      cameraPoint &&
      typeof cameraPoint.x === "number" &&
      typeof cameraPoint.y === "number"
    ) {
      const xPct = Math.round(cameraPoint.x * 100);
      const yPct = Math.round(cameraPoint.y * 100);
      const hLabel =
        cameraPoint.x < 0.33 ? "left" : cameraPoint.x > 0.66 ? "right" : "center";
      const vLabel =
        cameraPoint.y < 0.33 ? "top" : cameraPoint.y > 0.66 ? "bottom" : "middle";

      cameraInstruction = `
The user placed a camera at the ${vLabel}-${hLabel} area of the floor plan (${xPct}% from left, ${yPct}% from top).
Generate the interior concept sketch from that specific viewpoint, looking INTO the room from that position.
`;
    } else {
      cameraInstruction =
        "No specific camera point was set. Choose the most interesting viewpoint that reveals the overall room layout.";
    }

    const textPrompt = `
You are an expert interior design visualization AI.
Generate one high-quality interior design concept sketch from this floor plan.

Camera / viewpoint instructions:
${cameraInstruction}

Requirements:
- Preserve room layout and proportions from the floor plan exactly
- Render as a detailed 3D concept sketch with clear perspective
- Show realistic furniture placement consistent with the floor plan
- Include accurate depth, perspective lines, and spatial coherence
- Use advanced spatial reasoning to interpret floor plan geometry correctly
- Output exactly one image
`;

    const generated = [];

    try {
      const result = await callGeminiSingleImage({
        imageBase64,
        textPrompt,
      });

      if (result.images.length > 0) {
        generated.push(result.images[0]);
      }
    } catch (error) {
      if (ENABLE_FALLBACK && isQuotaError(error)) {
        return send(res, 200, {
          success: true,
          images: buildFallbackPovs(imageBase64),
          text: "Fallback POVs returned",
          debug: { modelRequested: MODEL_NAME, fallback: true },
        });
      }
      throw error;
    }

    if (!generated.length && ENABLE_FALLBACK) {
      return send(res, 200, {
        success: true,
        images: buildFallbackPovs(imageBase64),
        text: "Fallback POVs returned",
        debug: { modelRequested: MODEL_NAME, fallback: true },
      });
    }

    return send(res, 200, {
      success: true,
      images: generated,
      debug: { modelRequested: MODEL_NAME, imageCount: generated.length },
    });
  } catch (error) {
    return send(res, 500, {
      error: error?.message || "Failed to generate POVs",
      modelRequested: MODEL_NAME,
    });
  }
};