import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(var(--background))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        <img src="/STACQ_logo_black.png" alt="STACQ" style={{ width: "140px", height: "auto", objectFit: "contain" }} />

        <div
          style={{
            width: "100%",
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            padding: "2rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                E-POST
              </label>
              <input
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  padding: "0.625rem 0.875rem",
                  color: "hsl(var(--foreground))",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "border-color 0.15s",
                  width: "100%",
                  boxSizing: "border-box" as const,
                }}
                onFocus={(e) => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={(e) => (e.target.style.borderColor = "hsl(var(--border))")}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                PASSORD
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  padding: "0.625rem 0.875rem",
                  color: "hsl(var(--foreground))",
                  fontSize: "0.875rem",
                  outline: "none",
                  transition: "border-color 0.15s",
                  width: "100%",
                  boxSizing: "border-box" as const,
                }}
                onFocus={(e) => (e.target.style.borderColor = "hsl(var(--ring))")}
                onBlur={(e) => (e.target.style.borderColor = "hsl(var(--border))")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.25rem",
                padding: "0.625rem 1rem",
                background: "hsl(var(--primary))",
                border: "none",
                borderRadius: "8px",
                color: "hsl(var(--primary-foreground))",
                fontSize: "0.8125rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {loading ? "Logger inn..." : "Logg inn"}
            </button>
          </form>
        </div>

        
      </div>
    </div>
  );
};

export default Login;
