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
    <div style={{
      minHeight: "100vh",
      background: "#0a0705",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(ellipse, rgba(180,60,0,0.2) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-100px", left: "50%",
        transform: "translateX(-50%)",
        width: "800px", height: "300px",
        background: "radial-gradient(ellipse, rgba(200,80,0,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: "400px",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "2rem",
        position: "relative", zIndex: 1,
      }}>
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", inset: "-20px",
            background: "radial-gradient(ellipse, rgba(200,80,0,0.3) 0%, transparent 70%)",
            borderRadius: "50%", filter: "blur(20px)",
          }} />
          <img
            src="/logo.png"
            alt="STACQ CRM"
            style={{
              width: "200px", height: "200px",
              objectFit: "contain", position: "relative",
              filter: "drop-shadow(0 0 30px rgba(200,80,0,0.5)) drop-shadow(0 0 60px rgba(180,60,0,0.3))",
            }}
          />
        </div>

        <div style={{
          width: "100%",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(200,100,0,0.2)",
          borderRadius: "16px", padding: "2rem",
          backdropFilter: "blur(10px)",
          boxShadow: "0 0 40px rgba(180,60,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{
                fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(200,120,50,0.8)",
              }}>E-POST</label>
              <input
                type="email" placeholder="din@epost.no"
                value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(200,100,0,0.25)",
                  borderRadius: "8px", padding: "0.75rem 1rem",
                  color: "#f5e6d3", fontSize: "0.9375rem", outline: "none",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(200,100,0,0.6)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(200,100,0,0.25)"}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{
                fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(200,120,50,0.8)",
              }}>PASSORD</label>
              <input
                type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={6}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(200,100,0,0.25)",
                  borderRadius: "8px", padding: "0.75rem 1rem",
                  color: "#f5e6d3", fontSize: "0.9375rem", outline: "none",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(200,100,0,0.6)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(200,100,0,0.25)"}
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                marginTop: "0.5rem", padding: "0.875rem",
                background: loading ? "rgba(150,60,0,0.4)" : "linear-gradient(135deg, #c84a00 0%, #e06000 50%, #c84a00 100%)",
                border: "1px solid rgba(220,100,0,0.4)",
                borderRadius: "8px", color: "#fff",
                fontSize: "0.875rem", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 0 20px rgba(200,80,0,0.4), 0 4px 12px rgba(0,0,0,0.4)",
                transition: "all 0.2s",
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
