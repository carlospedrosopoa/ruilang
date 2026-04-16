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

function randomPassword(length = 18) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
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

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const tenantId = String(body?.tenantId || "").trim();
    const role = String(body?.role || "member").trim();
    const requestedPassword = typeof body?.password === "string" ? body.password : "";

    if (!email || !email.includes("@")) return jsonResponse({ error: "Invalid email" }, 400);
    if (!tenantId) return jsonResponse({ error: "Missing tenantId" }, 400);
    if (!["owner", "admin", "member"].includes(role)) return jsonResponse({ error: "Invalid role" }, 400);

    const password = requestedPassword.trim() ? requestedPassword.trim() : randomPassword();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return jsonResponse(
          {
            error:
              "Este e-mail já está cadastrado no Auth. Use outro e-mail ou implemente um fluxo de convite para usuário existente.",
          },
          409,
        );
      }
      return jsonResponse({ error: createError.message }, 400);
    }
    if (!created?.user) return jsonResponse({ error: "Failed to create user" }, 500);

    const userId = created.user.id;

    const { error: memberError } = await admin.from("tenant_members").upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role,
      },
      { onConflict: "tenant_id,user_id" },
    );

    if (memberError) return jsonResponse({ error: memberError.message }, 400);

    const response: any = { userId, email, tenantId, role };
    if (!requestedPassword.trim()) response.temporaryPassword = password;

    return jsonResponse(response);
  } catch (e) {
    console.error("admin-create-user error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});

