import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Layers, Wand2, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Landing = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background bg-hero">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">Interior AI Studio</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild><Link to="/dashboard">Open dashboard</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
              <Button asChild><Link to="/auth">Get started</Link></Button>
            </>
          )}
        </div>
      </header>

      <main className="container">
        <section className="mx-auto max-w-3xl pt-20 pb-24 text-center animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Powered by Nano Banana
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] text-balance md:text-7xl">
            From floor plan to <span className="bg-gradient-primary bg-clip-text text-transparent">finished room</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Upload a plan, generate five concept POVs, refine the look you love, and edit it region by region — all in one studio.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button size="lg" asChild className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
              <Link to={user ? "/dashboard" : "/auth"}>
                Start a project <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-24 md:grid-cols-3">
          {[
            { icon: Layers, title: "Five POVs, instantly", body: "Generate distinct viewpoints from any floor plan in seconds." },
            { icon: Wand2, title: "Refine your way", body: "Style, mood, materials — guide the design with plain language." },
            { icon: ImageIcon, title: "Region-level edits", body: "Mark zones and revise them independently with surgical precision." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-surface p-6 shadow-elegant">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default Landing;
