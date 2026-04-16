import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL) return jsonResponse({ error: "SUPABASE_URL is not configured" }, 500);
    if (!SERVICE_ROLE) return jsonResponse({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : authHeader;
    if (!token) return jsonResponse({ error: "Missing Authorization header" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const requesterId = userData.user.id;
    const { data: adminRow, error: adminRowError } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", requesterId)
      .maybeSingle();

    if (adminRowError) return jsonResponse({ error: adminRowError.message }, 500);
    if (!adminRow) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || "openai").toLowerCase();

    if (provider !== "openai") {
      return jsonResponse({ error: "Provider not supported in this healthcheck. Use provider=openai." }, 400);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 500);

    const model = Deno.env.get("OPENAI_MODEL_HEALTH") || "gpt-4o-mini";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Respond with exactly: ok" }],
        max_tokens: 8,
        temperature: 0,
      }),
    });

    const rateLimit = {
      requestsLimit: response.headers.get("x-ratelimit-limit-requests"),
      requestsRemaining: response.headers.get("x-ratelimit-remaining-requests"),
      requestsReset: response.headers.get("x-ratelimit-reset-requests"),
      tokensLimit: response.headers.get("x-ratelimit-limit-tokens"),
      tokensRemaining: response.headers.get("x-ratelimit-remaining-tokens"),
      tokensReset: response.headers.get("x-ratelimit-reset-tokens"),
      requestId: response.headers.get("x-request-id"),
    };

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse(
        {
          ok: false,
          provider: "openai",
          model,
          status: response.status,
          error: text.slice(0, 600),
          rateLimit,
        },
        response.status,
      );
    }

    const data = await response.json();
    const output = data?.choices?.[0]?.message?.content?.trim?.() || "";
    return jsonResponse({
      ok: true,
      provider: "openai",
      model,
      output,
      rateLimit,
    });
  } catch (e) {
    console.error("admin-ai-health error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});

