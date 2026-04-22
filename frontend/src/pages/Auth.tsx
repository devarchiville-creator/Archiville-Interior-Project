// import { useEffect, useState } from "react";
// import { useNavigate, Link } from "react-router-dom";
// import { z } from "zod";
// import { supabase } from "@/integrations/supabase/client";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Card } from "@/components/ui/card";
// import { toast } from "@/hooks/use-toast";
// import { Sparkles, Loader2 } from "lucide-react";

// const schema = z.object({
//   email: z.string().trim().email("Enter a valid email").max(255),
//   password: z.string().min(6, "At least 6 characters").max(72),
// });

// const Auth = () => {
//   const nav = useNavigate();
//   const [mode, setMode] = useState<"signin" | "signup">("signin");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       if (session) nav("/dashboard", { replace: true });
//     });
//   }, [nav]);

//   const onSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     const parsed = schema.safeParse({ email, password });
//     if (!parsed.success) {
//       toast({ title: "Check your input", description: parsed.error.errors[0].message, variant: "destructive" });
//       return;
//     }
//     setLoading(true);
//     try {
//       if (mode === "signup") {
//         const { error } = await supabase.auth.signUp({
//           email,
//           password,
//           options: { emailRedirectTo: `${window.location.origin}/dashboard` },
//         });
//         if (error) throw error;
//         toast({ title: "Account created", description: "You're signed in." });
//       } else {
//         const { error } = await supabase.auth.signInWithPassword({ email, password });
//         if (error) throw error;
//       }
//       nav("/dashboard", { replace: true });
//     } catch (err: any) {
//       toast({ title: "Something went wrong", description: err.message ?? "Try again", variant: "destructive" });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="flex min-h-screen items-center justify-center bg-background bg-hero p-4">
//       <Card className="w-full max-w-md border-border bg-card/80 p-8 shadow-elegant backdrop-blur">
//         <Link to="/" className="mb-8 flex items-center gap-2">
//           <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary shadow-glow">
//             <Sparkles className="h-4 w-4 text-primary-foreground" />
//           </div>
//           <span className="font-display text-lg font-semibold">Interior AI Studio</span>
//         </Link>
//         <h1 className="font-display text-3xl">{mode === "signin" ? "Welcome back" : "Create account"}</h1>
//         <p className="mt-1 text-sm text-muted-foreground">
//           {mode === "signin" ? "Sign in to continue your projects." : "Start designing in seconds."}
//         </p>
//         <form onSubmit={onSubmit} className="mt-6 space-y-4">
//           <div className="space-y-2">
//             <Label htmlFor="email">Email</Label>
//             <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
//           </div>
//           <div className="space-y-2">
//             <Label htmlFor="password">Password</Label>
//             <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "signin" ? "current-password" : "new-password"} />
//           </div>
//           <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
//             {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
//           </Button>
//         </form>
//         <button
//           onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
//           className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground"
//         >
//           {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
//         </button>
//       </Card>
//     </div>
//   );
// };

// export default Auth;
