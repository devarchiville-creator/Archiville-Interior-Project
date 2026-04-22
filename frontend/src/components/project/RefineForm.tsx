import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2 } from "lucide-react";
import type { RefineVars } from "@/lib/prompts";

export const RefineForm = ({
  busy, onSubmit,
}: { busy: boolean; onSubmit: (v: RefineVars) => void }) => {
  const [v, setV] = useState<RefineVars>({});
  const set = (k: keyof RefineVars) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });

  return (
    <Card className="bg-surface p-6">
      <h3 className="font-display text-xl">Refine your design</h3>
      <p className="mt-1 text-sm text-muted-foreground">Optional. Leave blank to let the AI decide.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Room type"><Input placeholder="Living room" maxLength={80} onChange={set("roomType")} /></Field>
        <Field label="Design style"><Input placeholder="Scandinavian, mid-century" maxLength={80} onChange={set("designStyle")} /></Field>
        <Field label="Materials"><Input placeholder="Oak, linen, brass" maxLength={120} onChange={set("materials")} /></Field>
        <Field label="Color palette"><Input placeholder="Warm neutrals, terracotta" maxLength={120} onChange={set("colors")} /></Field>
        <Field label="Lighting mood"><Input placeholder="Warm, late afternoon" maxLength={120} onChange={set("lighting")} /></Field>
        <Field label="Furniture"><Input placeholder="Low sofa, woven rug" maxLength={120} onChange={set("furniture")} /></Field>
        <div className="sm:col-span-2">
          <Field label="Additional notes">
            <Textarea rows={3} maxLength={500} placeholder="Anything else…" onChange={set("extra")} />
          </Field>
        </div>
      </div>
      <Button onClick={() => onSubmit(v)} disabled={busy} className="mt-6 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wand2 className="h-4 w-4" /> Generate refined image</>}
      </Button>
    </Card>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
    {children}
  </div>
);
