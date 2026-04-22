const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Server is running",
  });
});

app.post("/api/nano/generate-povs", (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  return res.json({
    success: true,
    images: [imageBase64, imageBase64, imageBase64, imageBase64, imageBase64],
  });
});

app.post("/api/nano/refine-selected", (req, res) => {
  const { imageBase64, prompt } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "imageBase64 is required" });
  }

  return res.json({
    success: true,
    images: [imageBase64],
    promptUsed: prompt || "",
  });
});

app.post("/api/nano/region-edit", (req, res) => {
  const { imageBase64, maskBase64, regions } = req.body;

  if (!imageBase64 || !maskBase64 || !Array.isArray(regions) || !regions.length) {
    return res
      .status(400)
      .json({ error: "imageBase64, maskBase64 and regions are required" });
  }

  return res.json({
    success: true,
    images: [imageBase64],
    regionsApplied: regions,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});