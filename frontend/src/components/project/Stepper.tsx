import { STAGES, StageKey } from "@/lib/stages";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Stepper = ({ current }: { current: StageKey }) => {
  const idx = STAGES.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
                active && "border-primary bg-primary/10 text-primary",
                done && "border-primary/40 bg-primary/5 text-primary/80",
                !active && !done && "border-border text-muted-foreground"
              )}
            >
              <span className={cn(
                "grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold",
                active && "bg-primary text-primary-foreground",
                done && "bg-primary/30 text-primary-foreground",
                !active && !done && "bg-muted text-muted-foreground"
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </div>
            {i < STAGES.length - 1 && <div className="h-px w-4 bg-border" />}
          </div>
        );
      })}
    </div>
  );
};
