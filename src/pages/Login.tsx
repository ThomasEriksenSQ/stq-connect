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
        background: "#FAFAFA",
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
          gap: "2.5rem",
        }}
      >
        <img
          src="/logo.png"
          alt="STACQ CRM"
          style={{
            width: "280px",
            height: "280px",
            objectFit: "contain",
          }}
        />

        <div
          style={{
            width: "100%",
            background: "#fff",
            border: "1px solid #E5E7EB",
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
                  textTransform: "uppercase",
                  color: "#6B7280",
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
                  background: "#FAFAFA",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  color: "#111",
                  fontSize: "0.9375rem",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#c84a00")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#6B7280",
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
                  background: "#FAFAFA",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  color: "#111",
                  fontSize: "0.9375rem",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#c84a00")}
                onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                background: loading ? "#d4844a" : "linear-gradient(135deg, #c84a00 0%, #e06000 100%)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 1px 3px rgba(200,74,0,0.3)",
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
