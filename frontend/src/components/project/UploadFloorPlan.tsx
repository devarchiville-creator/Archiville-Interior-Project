import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2, ImagePlus } from "lucide-react";
import { ASSET_TYPES } from "@/lib/stages";

const MAX_MB = 10;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export const UploadFloorPlan = ({
  projectId, userId, onUploaded,
}: { projectId: string; userId: string; onUploaded: (assetId: string, url: string) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast({ title: "Unsupported file", description: "Use PNG, JPG, or WebP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: "Too large", description: `Max ${MAX_MB}MB.`, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${userId}/${projectId}/floor-plan-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("floor-plans").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("floor-plans").getPublicUrl(path);
      const url = pub.publicUrl;

      const { data: asset, error: aErr } = await supabase.from("project_assets").insert({
        project_id: projectId,
        user_id: userId,
        type: ASSET_TYPES.FLOOR_PLAN,
        file_url: url,
        storage_path: path,
      }).select("id").single();
      if (aErr || !asset) throw aErr;

      await supabase.from("projects").update({ current_stage: "upload" }).eq("id", projectId);
      setPreview(url);
      toast({ title: "Floor plan uploaded" });
      onUploaded(asset.id, url);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-surface p-8">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10">
          <ImagePlus className="h-5 w-5 text-primary" />
        </div>
        <h2 className="mt-4 font-display text-2xl">Upload your floor plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, or WebP up to {MAX_MB}MB.</p>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className="mt-6 cursor-pointer rounded-xl border-2 border-dashed border-border p-10 transition hover:border-primary/50 hover:bg-primary/5"
        >
          {preview ? (
            <img src={preview} alt="Floor plan preview" className="mx-auto max-h-64 rounded-md" />
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <Upload className="mx-auto h-6 w-6" />
              <p className="mt-2">Click or drop a file here</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        <Button disabled={busy} onClick={() => inputRef.current?.click()} className="mt-6 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Choose file</>}
        </Button>
      </div>
    </Card>
  );
};
