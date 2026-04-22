// Mocked Nano Banana adapter. Replace MOCK_IMAGES with a real API call when NANO_BANANA_API_KEY is provided.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated stock interior images (Unsplash public CDN) used as placeholders.
const POV_MOCKS = [
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=900",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900",
  "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900",
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=900",
];
const REFINED_MOCK = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200";
const REGION_MOCK = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200";
const FINAL_MOCK = "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1600";

type Action = "generate_povs" | "generate_refined" | "region_edit" | "generate_final";

interface Body {
  action: Action;
  projectId: string;
  baseAssetId?: string;
  prompt?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return json({ error: "unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const body = (await req.json()) as Body;
    if (!body.action || !body.projectId) return json({ error: "missing fields" }, 400);

    // Verify ownership
    const { data: proj } = await supabase.from("projects").select("id,user_id").eq("id", body.projectId).maybeSingle();
    if (!proj || proj.user_id !== userId) return json({ error: "forbidden" }, 403);

    // Log job
    const { data: job } = await supabase.from("generation_jobs").insert({
      project_id: body.projectId,
      user_id: userId,
      stage: body.action,
      status: "processing",
      prompt_text: body.prompt ?? null,
      request_payload_json: body as unknown as Record<string, unknown>,
    }).select("id").single();

    // Log prompt
    if (body.prompt) {
      await supabase.from("project_prompts").insert({
        project_id: body.projectId,
        user_id: userId,
        stage: body.action,
        prompt_text: body.prompt,
        variables_json: body.metadata ?? {},
      });
    }

    // Simulate latency
    await new Promise((r) => setTimeout(r, 800));

    let createdAssets: { id: string; file_url: string }[] = [];

    if (body.action === "generate_povs") {
      const rows = POV_MOCKS.map((url) => ({
        project_id: body.projectId,
        user_id: userId,
        type: "pov_sketch",
        file_url: url,
        metadata_json: { mock: true },
      }));
      const { data, error } = await supabase.from("project_assets").insert(rows).select("id,file_url");
      if (error) throw error;
      createdAssets = data ?? [];
      await supabase.from("projects").update({ current_stage: "povs" }).eq("id", body.projectId);
    } else if (body.action === "generate_refined") {
      const { data, error } = await supabase.from("project_assets").insert({
        project_id: body.projectId, user_id: userId, type: "refined_2d",
        file_url: REFINED_MOCK, parent_asset_id: body.baseAssetId,
        metadata_json: { mock: true, prompt: body.prompt },
      }).select("id,file_url").single();
      if (error) throw error;
      createdAssets = [data];
      await supabase.from("projects").update({ current_stage: "refined" }).eq("id", body.projectId);
    } else if (body.action === "region_edit") {
      const { data, error } = await supabase.from("project_assets").insert({
        project_id: body.projectId, user_id: userId, type: "region_edit",
        file_url: REGION_MOCK, parent_asset_id: body.baseAssetId,
        metadata_json: { mock: true, prompt: body.prompt, regions: body.metadata?.regions },
      }).select("id,file_url").single();
      if (error) throw error;
      createdAssets = [data];
      await supabase.from("projects").update({ current_stage: "region" }).eq("id", body.projectId);
    } else if (body.action === "generate_final") {
      const { data, error } = await supabase.from("project_assets").insert({
        project_id: body.projectId, user_id: userId, type: "final_output",
        file_url: FINAL_MOCK, parent_asset_id: body.baseAssetId,
        metadata_json: { mock: true },
      }).select("id,file_url").single();
      if (error) throw error;
      createdAssets = [data];
      await supabase.from("projects").update({ current_stage: "final" }).eq("id", body.projectId);
    }

    if (job) {
      await supabase.from("generation_jobs").update({
        status: "completed",
        response_payload_json: { assets: createdAssets },
      }).eq("id", job.id);
    }

    return json({ jobId: job?.id, assets: createdAssets });
  } catch (e) {
    console.error("generate error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
