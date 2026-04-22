import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Pov = { id: string; file_url: string };

export const PovGallery = ({
  povs, selectedId, onSelect, loading,
}: { povs: Pov[]; selectedId: string | null; onSelect: (id: string) => void; loading?: boolean }) => {
  if (loading) {
    return (
      <Card className="grid place-items-center bg-surface py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Generating 5 concept POVs…</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {povs.map((p, i) => {
        const selected = selectedId === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              "group relative overflow-hidden rounded-xl border-2 bg-surface text-left transition",
              selected ? "border-primary shadow-glow" : "border-border hover:border-primary/40"
            )}
          >
            <img src={p.file_url} alt={`POV ${i + 1}`} className="aspect-square w-full object-cover" />
            <div className="flex items-center justify-between p-3">
              <span className="text-xs text-muted-foreground">POV {i + 1}</span>
              {selected && (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
