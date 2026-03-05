import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error("Feil e-post eller passord");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dark">
      <div className="w-full max-w-[340px] space-y-10 animate-fade-up">
        <div className="space-y-2">
          <h1 className="text-[28px] font-bold tracking-tight">STACQ</h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            Logg inn for å fortsette
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-label">E-post</label>
            <Input
              type="email"
              placeholder="din@epost.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 bg-card border-border/60 text-[15px] rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-label">Passord</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 bg-card border-border/60 text-[15px] rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full h-11 rounded-xl text-[14px] font-semibold" disabled={loading}>
            {loading ? "Logger inn..." : "Logg inn"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
