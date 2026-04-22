import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  Eraser,
  ImageIcon,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type StageKey =
  | "floor_plan"
  | "povs"
  | "selected"
  | "refined"
  | "region_edit"
  | "final";

type AssetType =
  | "floor_plan"
  | "pov"
  | "selected_pov"
  | "refined"
  | "region_edit"
  | "final";

type Asset = {
  id: string;
  type: AssetType;
  file_url: string | null;
  parent_asset_id: string | null;
  created_at: string;
  metadata_json: {
    image_key?: string;
    [key: string]: any;
  };
};

type ProjectType = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stage: StageKey;
  assets: Asset[];
};

type RegionPrompt = {
  color: string;
  prompt: string;
};

// ── NEW: camera point type ────────────────────────────────────────────────────
type CameraPoint = {
  /** 0–1 fraction of image width */
  xRatio: number;
  /** 0–1 fraction of image height */
  yRatio: number;
  /** pixel coords relative to the displayed image (for rendering) */
  xPx: number;
  yPx: number;
};

const STORAGE_KEY = "interior_projects";
const API_BASE = "https://archiville-interior-project.vercel.app";

const DB_NAME = "interior_ai_studio_db";
const DB_VERSION = 1;
const IMAGE_STORE = "images";

const stepOrder: StageKey[] = [
  "floor_plan",
  "povs",
  "selected",
  "refined",
  "region_edit",
  "final",
];

const defaultRegionPrompts: RegionPrompt[] = [
  { color: "red", prompt: "" },
  { color: "blue", prompt: "" },
  { color: "green", prompt: "" },
  { color: "yellow", prompt: "" },
];

const brushColors: Record<string, string> = {
  red: "#ff0000",
  blue: "#0037ff",
  green: "#00a81c",
  yellow: "#ffea00",
};

const openImageDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const saveImageToDb = async (key: string, dataUrl: string) => {
  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);
    store.put(dataUrl, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
};

const getImageFromDb = async (key: string): Promise<string | null> => {
  const db = await openImageDb();
  const result = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readonly");
    const store = tx.objectStore(IMAGE_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as string) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
};

const deleteImageFromDb = async (key: string) => {
  const db = await openImageDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
};

const deleteImagesFromProjectInDb = async (project: ProjectType) => {
  const keys = project.assets
    .map((asset) => asset.metadata_json?.image_key)
    .filter(Boolean);
  for (const key of keys) {
    await deleteImageFromDb(key);
  }
};

const hydrateProjectImages = async (
  project: ProjectType
): Promise<ProjectType> => {
  const hydratedAssets = await Promise.all(
    project.assets.map(async (asset) => {
      if (asset.file_url) return asset;
      const imageKey = asset.metadata_json?.image_key;
      if (!imageKey) return asset;
      const image = await getImageFromDb(imageKey);
      return { ...asset, file_url: image };
    })
  );
  return { ...project, assets: hydratedAssets };
};

const createImageKey = (projectId: string, assetId: string) =>
  `project:${projectId}:asset:${assetId}`;

// ─────────────────────────────────────────────────────────────────────────────

const Project = () => {
  const { id } = useParams();
  const nav = useNavigate();

  const [project, setProject] = useState<ProjectType | null>(null);
  const [busy, setBusy] = useState(false);
  const [refinedApproved, setRefinedApproved] = useState(false);
  const [regionPrompts, setRegionPrompts] =
    useState<RegionPrompt[]>(defaultRegionPrompts);
  const [activeColor, setActiveColor] =
    useState<keyof typeof brushColors>("red");
  const [brushSize, setBrushSize] = useState(18);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cameraHintVisible, setCameraHintVisible] = useState(true);

  // ── NEW: draggable camera state ───────────────────────────────────────────
  const [cameraPoint, setCameraPoint] = useState<CameraPoint | null>(null);
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);
  const floorPlanImgRef = useRef<HTMLImageElement | null>(null);
  const floorPlanWrapperRef = useRef<HTMLDivElement | null>(null);

  const [refineForm, setRefineForm] = useState({
    roomType: "",
    designStyle: "",
    materials: "",
    lightingMood: "",
    colorPalette: "",
    furniturePreferences: "",
    extraInstructions: "",
  });

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const getProjects = (): ProjectType[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveProjects = (projects: ProjectType[]) => {
    const safeProjects = projects.map((project) => ({
      ...project,
      assets: project.assets.map((asset) => ({ ...asset, file_url: null })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeProjects));
  };

  const loadProject = async () => {
    if (!id) return;
    const projects = getProjects();
    const found = projects.find((p) => p.id === id);
    if (!found) {
      toast({
        title: "Project not found",
        description: "This project does not exist in local storage.",
        variant: "destructive",
      });
      nav("/dashboard", { replace: true });
      return;
    }
    const hydrated = await hydrateProjectImages(found);
    setProject(hydrated);
  };

  useEffect(() => {
    void loadProject();
  }, [id]);

  useEffect(() => {
    if (!project?.assets) return;
    const latestRefined = [...project.assets]
      .reverse()
      .find((a) => a.type === "refined");
    const approved = !!latestRefined?.metadata_json?.approved;
    setRefinedApproved(approved);
  }, [project]);

  useEffect(() => {
    const handleResize = () => syncCanvasToImage();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const updateProject = async (
    updater: (current: ProjectType) => ProjectType
  ) => {
    if (!id) return;
    const projects = getProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) {
      toast({ title: "Project not found", variant: "destructive" });
      return;
    }
    const currentHydrated = await hydrateProjectImages(projects[index]);
    const updated = updater(currentHydrated);
    updated.updatedAt = new Date().toISOString();
    projects[index] = updated;
    saveProjects(projects);
    const hydratedUpdated = await hydrateProjectImages(updated);
    setProject(hydratedUpdated);
  };

  const addAsset = async (asset: Omit<Asset, "id" | "created_at">) => {
    if (!id) throw new Error("Project id missing");
    const assetId = crypto.randomUUID();
    const imageKey = asset.file_url ? createImageKey(id, assetId) : undefined;
    if (asset.file_url && imageKey) {
      await saveImageToDb(imageKey, asset.file_url);
    }
    const newAsset: Asset = {
      id: assetId,
      created_at: new Date().toISOString(),
      ...asset,
      file_url: null,
      metadata_json: {
        ...(asset.metadata_json || {}),
        ...(imageKey ? { image_key: imageKey } : {}),
      },
    };
    await updateProject((current) => ({
      ...current,
      assets: [...current.assets, newAsset],
    }));
    return { ...newAsset, file_url: asset.file_url };
  };

  const setStage = async (stage: StageKey) => {
    await updateProject((current) => ({ ...current, stage }));
  };

  const floorPlan = useMemo(
    () => project?.assets.find((a) => a.type === "floor_plan"),
    [project]
  );
  const povs = useMemo(
    () => project?.assets.filter((a) => a.type === "pov") ?? [],
    [project]
  );
  const selectedAsset = useMemo(
    () => project?.assets.find((a) => a.type === "selected_pov"),
    [project]
  );
  const refined = useMemo(
    () =>
      [...(project?.assets ?? [])].reverse().find((a) => a.type === "refined"),
    [project]
  );
  const regionEdits = useMemo(
    () => project?.assets.filter((a) => a.type === "region_edit") ?? [],
    [project]
  );
  const final = useMemo(
    () =>
      [...(project?.assets ?? [])].reverse().find((a) => a.type === "final"),
    [project]
  );

  const currentPreview =
    regionEdits[regionEdits.length - 1] ?? refined ?? selectedAsset ?? floorPlan;

  const currentStepIndex = project ? stepOrder.indexOf(project.stage) : -1;

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const callApi = async (url: string, body: any) => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Request failed");
    return data;
  };

  const getNanoOutputUrls = (data: any): string[] => {
    if (Array.isArray(data?.images)) return data.images;
    if (Array.isArray(data?.outputUrls)) return data.outputUrls;
    if (Array.isArray(data?.outputs))
      return data.outputs.map((item: any) => item?.url).filter(Boolean);
    if (typeof data?.image === "string") return [data.image];
    if (typeof data?.outputUrl === "string") return [data.outputUrl];
    return [];
  };

  // ── NEW: camera drag helpers ──────────────────────────────────────────────

  const getCameraPointFromEvent = (
    clientX: number,
    clientY: number
  ): CameraPoint | null => {
    const img = floorPlanImgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const xPx = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const yPx = Math.max(0, Math.min(clientY - rect.top, rect.height));
    return {
      xPx,
      yPx,
      xRatio: xPx / rect.width,
      yRatio: yPx / rect.height,
    };
  };

  const handleFloorPlanClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingCamera) return; // was a drag, not a click
    const pt = getCameraPointFromEvent(e.clientX, e.clientY);
    if (pt) setCameraPoint(pt);
  };

  const handleCameraMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingCamera(true);
  };

  useEffect(() => {
    if (!isDraggingCamera) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const { clientX, clientY } =
        "touches" in e ? e.touches[0] : (e as MouseEvent);
      const pt = getCameraPointFromEvent(clientX, clientY);
      if (pt) setCameraPoint(pt);
    };

    const onUp = () => setIsDraggingCamera(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDraggingCamera]);

  // ── file upload ───────────────────────────────────────────────────────────

  const handleUploadFloorPlan = async (file: File) => {
    try {
      setBusy(true);
      const dataUrl = await fileToDataUrl(file);
      if (!id) throw new Error("Project id missing");
      const assetId = crypto.randomUUID();
      const imageKey = createImageKey(id, assetId);
      await saveImageToDb(imageKey, dataUrl);
      await updateProject((current) => {
        const otherAssets = current.assets.filter((a) => a.type !== "floor_plan");
        const floorPlanAsset: Asset = {
          id: assetId,
          type: "floor_plan",
          file_url: null,
          parent_asset_id: null,
          created_at: new Date().toISOString(),
          metadata_json: {
            fileName: file.name,
            fileSize: file.size,
            image_key: imageKey,
          },
        };
        return {
          ...current,
          stage: "floor_plan",
          assets: [...otherAssets, floorPlanAsset],
        };
      });
      await loadProject();
      // reset camera when a new floor plan is uploaded
      setCameraPoint(null);
      toast({
        title: "Floor plan uploaded",
        description: "Click or drag the camera icon to set your POV.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "Could not read the file.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // ── generate POVs — now passes cameraPoint ────────────────────────────────

  const generatePovs = async () => {
    if (!floorPlan?.file_url) {
      toast({ title: "Upload a floor plan first", variant: "destructive" });
      return;
    }
    if (!id) return;
    setBusy(true);
    try {
      const result = await callApi("/api/nano/generate-povs", {
        imageBase64: floorPlan.file_url,
        // send normalised coords so the backend can embed them in the prompt
        cameraPoint: cameraPoint
          ? { x: cameraPoint.xRatio, y: cameraPoint.yRatio }
          : null,
      });

      const outputUrls = getNanoOutputUrls(result);
      if (!outputUrls.length) {
        throw new Error("No POV images returned from backend.");
      }

      const newPovs: Asset[] = [];
      for (let index = 0; index < outputUrls.slice(0, 5).length; index++) {
        const url = outputUrls[index];
        const assetId = crypto.randomUUID();
        const imageKey = createImageKey(id, assetId);
        await saveImageToDb(imageKey, url);
        newPovs.push({
          id: assetId,
          type: "pov",
          file_url: null,
          parent_asset_id: floorPlan.id,
          created_at: new Date().toISOString(),
          metadata_json: {
            povNumber: index + 1,
            label: `POV ${index + 1}`,
            provider: "nano-banana",
            cameraLabel: `Camera ${index + 1}`,
            image_key: imageKey,
          },
        });
      }

      await updateProject((current) => {
        const withoutOldPovs = current.assets.filter(
          (a) =>
            a.type !== "pov" &&
            a.type !== "selected_pov" &&
            a.type !== "refined" &&
            a.type !== "region_edit" &&
            a.type !== "final"
        );
        return { ...current, stage: "povs", assets: [...withoutOldPovs, ...newPovs] };
      });

      await loadProject();
      toast({ title: "POVs generated", description: "Concept sketches are ready." });
    } catch (error: any) {
      toast({
        title: "POV generation failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const selectPov = async (povAsset: Asset) => {
    if (!id) return;
    try {
      const imageData =
        povAsset.file_url ||
        (await getImageFromDb(povAsset.metadata_json?.image_key));
      if (!imageData) throw new Error("Selected POV image missing");
      const assetId = crypto.randomUUID();
      const imageKey = createImageKey(id, assetId);
      await saveImageToDb(imageKey, imageData);
      await updateProject((current) => {
        const otherAssets = current.assets.filter((a) => a.type !== "selected_pov");
        const selectedPovAsset: Asset = {
          id: assetId,
          type: "selected_pov",
          file_url: null,
          parent_asset_id: povAsset.id,
          created_at: new Date().toISOString(),
          metadata_json: {
            pov_asset_id: povAsset.id,
            provider: "nano-banana",
            cameraLabel: povAsset.metadata_json?.cameraLabel || "Selected camera",
            image_key: imageKey,
          },
        };
        return { ...current, stage: "selected", assets: [...otherAssets, selectedPovAsset] };
      });
      await loadProject();
      toast({ title: "POV selected", description: "You can now refine the design." });
    } catch (error: any) {
      toast({
        title: "POV selection failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const generateRefined = async () => {
    if (!selectedAsset?.file_url) {
      toast({ title: "Select a POV first", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const prompt = `
Room type: ${refineForm.roomType}
Design style: ${refineForm.designStyle}
Materials: ${refineForm.materials}
Lighting mood: ${refineForm.lightingMood}
Color palette: ${refineForm.colorPalette}
Furniture preferences: ${refineForm.furniturePreferences}
Extra instructions: ${refineForm.extraInstructions}
`;
      const result = await callApi("/api/nano/refine-selected", {
        imageBase64: selectedAsset.file_url,
        prompt,
        cameraPoint: cameraPoint
          ? { x: cameraPoint.xRatio, y: cameraPoint.yRatio }
          : null,
      });

      const outputUrls = getNanoOutputUrls(result);
      if (!outputUrls.length) throw new Error("No refined image returned from backend.");

      await addAsset({
        type: "refined",
        file_url: outputUrls[0],
        parent_asset_id: selectedAsset.id,
        metadata_json: { ...refineForm, approved: false, provider: "nano-banana" },
      });

      await setStage("refined");
      setRefinedApproved(false);
      setTimeout(() => syncCanvasToImage(), 50);
      toast({ title: "Refined image ready", description: "Review and approve before region edits." });
    } catch (error: any) {
      toast({
        title: "Refinement failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const approveRefined = async () => {
    if (!refined) {
      toast({ title: "No refined image found", variant: "destructive" });
      return;
    }
    await updateProject((current) => ({
      ...current,
      stage: "region_edit",
      assets: current.assets.map((asset) =>
        asset.id === refined.id
          ? { ...asset, metadata_json: { ...asset.metadata_json, approved: true } }
          : asset
      ),
    }));
    setRefinedApproved(true);
    setTimeout(() => syncCanvasToImage(), 50);
    toast({ title: "Design approved", description: "You can now paint regions directly on the image." });
  };

  const updateRegionPrompt = (index: number, value: string) => {
    setRegionPrompts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, prompt: value } : item))
    );
  };

  const syncCanvasToImage = () => {
    const img = imageRef.current;
    const canvas = maskCanvasRef.current;
    const wrapper = wrapperRef.current;
    if (!img || !canvas || !wrapper) return;
    const rect = img.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.left = `${rect.left - wrapperRect.left}px`;
    canvas.style.top = `${rect.top - wrapperRect.top}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (clientX: number, clientY: number) => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getCanvasPoint(clientX, clientY);
    if (!canvas || !ctx || !point) return;
    ctx.strokeStyle = brushColors[activeColor];
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
  };

  const draw = (clientX: number, clientY: number) => {
    if (!isDrawing) return;
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    const point = getCanvasPoint(clientX, clientY);
    if (!canvas || !ctx || !point) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => startDraw(e.clientX, e.clientY);
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => draw(e.clientX, e.clientY);
  const handleCanvasMouseUp = () => endDraw();
  const handleCanvasMouseLeave = () => endDraw();
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    startDraw(touch.clientX, touch.clientY);
  };
  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    draw(touch.clientX, touch.clientY);
  };
  const handleCanvasTouchEnd = () => endDraw();

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getMaskDataUrl = () => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const submitRegionEdit = async () => {
    if (!currentPreview?.file_url) {
      toast({ title: "Nothing to edit yet", variant: "destructive" });
      return;
    }
    const maskBase64 = getMaskDataUrl();
    if (!maskBase64) {
      toast({ title: "Draw mask regions first", description: "Use the pencil tool to mark areas on the image.", variant: "destructive" });
      return;
    }
    const validRegions = regionPrompts
      .map((r) => ({ color: r.color, prompt: r.prompt.trim() }))
      .filter((r) => r.prompt);
    if (!validRegions.length) {
      toast({ title: "Add at least one color prompt", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const result = await callApi("/api/nano/region-edit", {
        imageBase64: currentPreview.file_url,
        maskBase64,
        regions: validRegions,
      });
      const outputUrls = getNanoOutputUrls(result);
      if (!outputUrls.length) throw new Error("No edited image returned from backend.");
      await addAsset({
        type: "region_edit",
        file_url: outputUrls[0],
        parent_asset_id: currentPreview.id,
        metadata_json: { regions: validRegions, provider: "nano-banana" },
      });
      await setStage("region_edit");
      clearMask();
      setRegionPrompts(defaultRegionPrompts);
      toast({ title: "Region edit applied", description: "Updated version is ready." });
    } catch (error: any) {
      toast({ title: "Region edit failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const generateFinalRealistic = async () => {
    if (!currentPreview?.file_url) {
      toast({ title: "No image available", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const result = await callApi("/api/nano/finalize-realistic", {
        imageBase64: currentPreview.file_url,
      });
      const outputUrls = getNanoOutputUrls(result);
      if (!outputUrls.length) throw new Error("No final realistic image returned from backend.");
      await addAsset({
        type: "final",
        file_url: outputUrls[0],
        parent_asset_id: currentPreview.id,
        metadata_json: { provider: "nano-banana", realistic: true },
      });
      await setStage("final");
      toast({ title: "Realistic final ready", description: "Photorealistic final image created." });
    } catch (error: any) {
      toast({ title: "Final generation failed", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!id || !project) return;
    const ok = window.confirm("Delete this project and all stored images?");
    if (!ok) return;
    await deleteImagesFromProjectInDb(project);
    const projects = getProjects().filter((p) => p.id !== id);
    saveProjects(projects);
    toast({ title: "Project deleted", description: "The project and stored images were removed." });
    nav("/dashboard", { replace: true });
  };

  if (!project) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold">{project.name}</h1>
              <p className="text-sm text-muted-foreground">Nano Banana powered workflow</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={deleteProject}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-4">
          <div className="grid gap-2 md:grid-cols-6">
            {stepOrder.map((step, index) => {
              const active = index <= currentStepIndex;
              return (
                <div
                  key={step}
                  className={`rounded-lg border px-3 py-2 text-center text-xs capitalize ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {step.replace("_", " ")}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">

        {/* ── FLOOR PLAN UPLOAD ── */}
        {!floorPlan ? (
          <section>
            <SectionHeading
              title="Upload Floor Plan"
              sub="Start by uploading the base floor plan image."
            />
            <Card className="bg-card/80 p-6 shadow-elegant">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border p-10 text-center hover:bg-muted/30">
                <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground" />
                <div className="font-medium">Choose floor plan image</div>
                <div className="mt-1 text-sm text-muted-foreground">PNG, JPG, JPEG, WEBP</div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUploadFloorPlan(file);
                  }}
                />
              </label>
            </Card>
          </section>
        ) : (
          /* ── FLOOR PLAN + DRAGGABLE CAMERA ── */
          <section>
            <SectionHeading
              title="Floor Plan"
              sub={
                cameraPoint
                  ? "Camera placed — drag it to reposition, then generate POVs."
                  : "Click anywhere on the floor plan to place the camera POV, then generate."
              }
            />
            <Card className="bg-card/80 p-4 shadow-elegant">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">

                {/* floor plan with overlay */}
                <div
                  ref={floorPlanWrapperRef}
                  className="relative cursor-crosshair select-none overflow-hidden rounded-lg"
                  style={{ flexShrink: 0, width: "clamp(200px, 100%, 420px)" }}
                  onClick={handleFloorPlanClick}
                >
                  <img
                    ref={floorPlanImgRef}
                    src={floorPlan.file_url || ""}
                    alt="Floor plan"
                    className="w-full rounded-lg object-cover"
                    draggable={false}
                  />

                  {/* camera pin */}
                  {cameraPoint && (
                    <button
                      type="button"
                      onMouseDown={handleCameraMouseDown}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setIsDraggingCamera(true);
                      }}
                      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 touch-none"
                      style={{
                        left: cameraPoint.xPx,
                        top: cameraPoint.yPx,
                        cursor: isDraggingCamera ? "grabbing" : "grab",
                      }}
                      title="Drag to reposition camera POV"
                    >
                      {/* outer pulse ring */}
                      <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/40" />
                      {/* icon container */}
                      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg ring-2 ring-white">
                        <Camera className="h-5 w-5 text-primary-foreground" />
                      </span>
                      {/* label */}
                      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-background/90 px-2 py-0.5 text-xs font-medium text-primary shadow">
                        POV
                      </span>
                    </button>
                  )}

                  {/* hint when no camera placed yet */}
                  {!cameraPoint && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                      <div className="flex flex-col items-center gap-2 rounded-xl bg-background/80 px-5 py-3 shadow backdrop-blur">
                        <Camera className="h-6 w-6 text-primary" />
                        <p className="text-xs font-medium text-foreground">
                          Click to place camera
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* right: info + CTA */}
                <div className="flex flex-1 flex-col gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold">Floor plan uploaded</h3>
                    <p className="text-sm text-muted-foreground">
                      {cameraPoint
                        ? `Camera set at ${Math.round(cameraPoint.xRatio * 100)}% × ${Math.round(cameraPoint.yRatio * 100)}% of the image.`
                        : "No camera point set yet — the AI will choose a default viewpoint."}
                    </p>
                  </div>

                  {cameraPoint && (
                    <button
                      type="button"
                      onClick={() => setCameraPoint(null)}
                      className="self-start text-xs text-muted-foreground underline hover:text-destructive"
                    >
                      Remove camera pin
                    </button>
                  )}

                  {/* re-upload */}
                  <label className="cursor-pointer self-start text-xs text-muted-foreground underline hover:text-foreground">
                    Replace floor plan
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUploadFloorPlan(file);
                      }}
                    />
                  </label>

                  <Button
                    onClick={() => void generatePovs()}
                    disabled={busy}
                    className="mt-auto self-start bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate POVs
                        {cameraPoint && (
                          <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                            with camera
                          </span>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* ── GENERATED POVS ── */}
        {povs.length > 0 && (
          <section>
            <SectionHeading
              title="Generated POVs"
              sub="Use the camera button to choose the view you want to refine."
            />
            {cameraHintVisible && (
              <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                Click the <span className="font-semibold">camera button</span> on the sketch you like.
                <button className="ml-3 underline" onClick={() => setCameraHintVisible(false)}>
                  Hide
                </button>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {povs.map((asset, index) => {
                const isSelected = selectedAsset?.metadata_json?.pov_asset_id === asset.id;
                return (
                  <Card
                    key={asset.id}
                    className={`overflow-hidden border p-3 shadow-elegant ${
                      isSelected ? "border-primary ring-1 ring-primary" : "border-border"
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={asset.file_url || ""}
                        alt={`POV ${index + 1}`}
                        className="h-64 w-full rounded-lg object-cover"
                      />
                      <button
                        onClick={() => void selectPov(asset)}
                        className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-background/90 px-3 py-2 text-sm shadow-lg hover:bg-background"
                        type="button"
                      >
                        <Camera className="h-4 w-4" />
                        {isSelected ? "Selected View" : "Select View"}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium">POV {index + 1}</h3>
                        <p className="text-sm text-muted-foreground">
                          {asset.metadata_json?.cameraLabel || "Camera view"}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ── REFINE ── */}
        {selectedAsset && (
          <section>
            <SectionHeading title="Refine Selected POV" sub="Describe what you want in the next design version." />
            <Card className="bg-card/80 p-6 shadow-elegant">
              <div className="mb-6 grid gap-4 md:grid-cols-[280px_1fr]">
                <div>
                  <img src={selectedAsset.file_url || ""} alt="Selected POV" className="w-full rounded-lg" />
                  <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                    <Camera className="h-4 w-4" />
                    {selectedAsset.metadata_json?.cameraLabel || "Selected camera"}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <InputBlock label="Room type" value={refineForm.roomType} onChange={(v) => setRefineForm((s) => ({ ...s, roomType: v }))} placeholder="Living room" />
                  <InputBlock label="Design style" value={refineForm.designStyle} onChange={(v) => setRefineForm((s) => ({ ...s, designStyle: v }))} placeholder="Modern minimalist" />
                  <InputBlock label="Materials" value={refineForm.materials} onChange={(v) => setRefineForm((s) => ({ ...s, materials: v }))} placeholder="Wood, marble, linen" />
                  <InputBlock label="Lighting mood" value={refineForm.lightingMood} onChange={(v) => setRefineForm((s) => ({ ...s, lightingMood: v }))} placeholder="Warm ambient" />
                  <InputBlock label="Color palette" value={refineForm.colorPalette} onChange={(v) => setRefineForm((s) => ({ ...s, colorPalette: v }))} placeholder="Cream, walnut, black" />
                  <InputBlock label="Furniture preferences" value={refineForm.furniturePreferences} onChange={(v) => setRefineForm((s) => ({ ...s, furniturePreferences: v }))} placeholder="Low sofa, open shelves" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Extra instructions</label>
                <textarea
                  rows={4}
                  value={refineForm.extraInstructions}
                  onChange={(e) => setRefineForm((s) => ({ ...s, extraInstructions: e.target.value }))}
                  placeholder="Add anything more you want in the refined version..."
                  className="w-full rounded-md border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void generateRefined()} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wand2 className="mr-2 h-4 w-4" />Generate Refined Sketch</>}
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* ── REFINED OUTPUT ── */}
        {refined && (
          <section>
            <SectionHeading title="Refined Output" sub="Approve this output before moving to region-based editing." />
            <Card className="bg-card/80 p-4 shadow-elegant">
              <img src={refined.file_url || ""} alt="Refined output" className="mx-auto max-h-[560px] rounded-lg" onLoad={syncCanvasToImage} />
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <Button variant="outline" asChild>
                  <a href={refined.file_url || "#"} download={`${project.name}-refined.png`}>
                    <Download className="mr-2 h-4 w-4" />Download
                  </a>
                </Button>
                {!refinedApproved ? (
                  <Button onClick={() => void approveRefined()} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                    <CheckCircle2 className="mr-2 h-4 w-4" />Approve and Continue
                  </Button>
                ) : (
                  <Button disabled variant="secondary">Approved</Button>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* ── REGION EDIT ── */}
        {refined && refinedApproved && (
          <section>
            <SectionHeading title="Color-based Region Editing" sub="Use the pencil tool on the image, then give one prompt for each color." />
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="bg-card/80 p-4 shadow-elegant">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">Paint Regions on the Image</h3>
                    <p className="text-sm text-muted-foreground">Select a color, use the pencil, and mark the exact areas you want to modify.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(brushColors).map((color) => (
                      <button key={color} onClick={() => setActiveColor(color as keyof typeof brushColors)}
                        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${activeColor === color ? "border-primary text-primary" : "border-border"}`} type="button">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: brushColors[color] }} />
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Pencil className="h-4 w-4" /><span className="text-sm">Brush</span>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    Size
                    <input type="range" min={6} max={42} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
                    <span>{brushSize}</span>
                  </label>
                  <Button variant="outline" onClick={clearMask}>
                    <Eraser className="mr-2 h-4 w-4" />Clear Mask
                  </Button>
                </div>
                <div ref={wrapperRef} className="relative">
                  <img ref={imageRef} src={currentPreview?.file_url || ""} alt="Current preview"
                    className="w-full rounded-lg select-none" onLoad={syncCanvasToImage} draggable={false} />
                  <canvas ref={maskCanvasRef} className="absolute z-10 cursor-crosshair touch-none rounded-lg"
                    onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseLeave}
                    onTouchStart={handleCanvasTouchStart} onTouchMove={handleCanvasTouchMove} onTouchEnd={handleCanvasTouchEnd} />
                </div>
              </Card>

              <Card className="bg-card/80 p-4 shadow-elegant">
                <div className="mb-4">
                  <h3 className="font-display text-lg font-semibold">Color Prompts</h3>
                  <p className="text-sm text-muted-foreground">Write what should happen inside each painted color region.</p>
                </div>
                <div className="space-y-4">
                  {regionPrompts.map((item, index) => (
                    <div key={item.color} className="rounded-lg border border-border p-3">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: brushColors[item.color] }} />
                        <span className="text-sm font-medium capitalize">{item.color}</span>
                      </div>
                      <textarea rows={3} value={item.prompt} onChange={(e) => updateRegionPrompt(index, e.target.value)}
                        placeholder={`What should happen in the ${item.color} region?`}
                        className="w-full rounded-md border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <Button onClick={() => void submitRegionEdit()} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wand2 className="mr-2 h-4 w-4" />Apply Region Edit</>}
                  </Button>
                  <Button onClick={() => void generateFinalRealistic()} disabled={busy} variant="outline" className="w-full">
                    <Wand2 className="mr-2 h-4 w-4" />Generate Realistic Final
                  </Button>
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* ── REGION EDIT HISTORY ── */}
        {regionEdits.length > 0 && (
          <section>
            <SectionHeading title="Edited Versions" sub="Outputs returned after color-based region edits." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {regionEdits.map((asset, index) => (
                <Card key={asset.id} className="overflow-hidden border-border p-3">
                  <img src={asset.file_url || ""} alt={`Region edit ${index + 1}`} className="h-56 w-full rounded-lg object-cover" />
                  <div className="mt-3">
                    <h3 className="font-medium">Region Edit {index + 1}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(asset.created_at).toLocaleString()}</p>
                    {Array.isArray(asset.metadata_json?.regions) && (
                      <div className="mt-2 space-y-1">
                        {asset.metadata_json.regions.map((region: RegionPrompt, idx: number) => (
                          <p key={`${region.color}-${idx}`} className="line-clamp-2 text-sm text-muted-foreground">
                            <span className="font-medium capitalize">{region.color}:</span> {region.prompt}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── FINAL ── */}
        {final && (
          <section>
            <SectionHeading title="Final Realistic Output" sub="Photorealistic version generated from the latest edited image." />
            <Card className="bg-card/80 p-4 shadow-elegant">
              <img src={final.file_url || ""} alt="Final output" className="mx-auto max-h-[640px] rounded-lg" />
              <div className="mt-4 flex justify-end">
                <Button asChild className="bg-gradient-primary text-primary-foreground">
                  <a href={final.file_url || "#"} download={`${project.name}-final.png`}>
                    <Download className="mr-2 h-4 w-4" />Download Final
                  </a>
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* ── HISTORY ── */}
        {project.assets.length > 0 && (
          <section>
            <SectionHeading title="History" sub="Everything saved in this local project." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {project.assets.map((asset) => (
                <Card key={asset.id} className="overflow-hidden border-border p-3">
                  {asset.file_url ? (
                    <img src={asset.file_url} alt={asset.type} className="h-44 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-44 place-items-center rounded-lg bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="mt-3">
                    <h3 className="font-medium capitalize">{asset.type.replace("_", " ")}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(asset.created_at).toLocaleString()}</p>
                    {asset.metadata_json?.approved && <p className="mt-2 text-sm text-primary">Approved</p>}
                    {asset.metadata_json?.cameraLabel && <p className="mt-1 text-sm text-muted-foreground">{asset.metadata_json.cameraLabel}</p>}
                    {Array.isArray(asset.metadata_json?.regions) && (
                      <div className="mt-2 space-y-1">
                        {asset.metadata_json.regions.map((region: RegionPrompt, idx: number) => (
                          <p key={`${region.color}-${idx}`} className="line-clamp-2 text-sm text-muted-foreground">
                            <span className="font-medium capitalize">{region.color}:</span> {region.prompt}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function InputBlock({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

export default Project;