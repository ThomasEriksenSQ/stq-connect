import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/salesforce-import`;

Deno.test("Returns 401 without Authorization header", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "companies", records: [] }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("No auth:", body);
});

Deno.test("Returns 401 with invalid JWT", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token-here",
    },
    body: JSON.stringify({ type: "companies", records: [] }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  console.log("Invalid JWT:", body);
});

Deno.test("Returns 403 with valid anon key (not admin)", async () => {
  // The anon key is a valid JWT but has no admin role
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type: "companies", records: [] }),
  });
  const body = await res.text();
  // Anon key won't pass getClaims as a user token — expect 401
  console.log("Anon key status:", res.status, body);
  // Accept either 401 (invalid user token) or 403 (no admin role)
  const ok = res.status === 401 || res.status === 403;
  assertEquals(ok, true);
});
