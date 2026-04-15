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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const token = String(body?.token || "").trim();
    const update = body?.update;

    if (!token) return jsonResponse({ error: "Missing token" }, 400);

    const { data: existing, error: findError } = await admin
      .from("propostas")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (findError) return jsonResponse({ error: findError.message }, 400);
    if (!existing) return jsonResponse({ error: "Not found" }, 404);

    if (!update) return jsonResponse({ proposta: existing });

    const patch: any = {};
    if (typeof update?.dados !== "undefined") patch.dados = update.dados;
    if (typeof update?.documentos !== "undefined") patch.documentos = update.documentos;
    if (typeof update?.status === "string") patch.status = update.status;
    if (typeof update?.proposta_texto === "string") patch.proposta_texto = update.proposta_texto;
    if (typeof update?.corretor_nome === "string") patch.corretor_nome = update.corretor_nome;
    if (typeof update?.corretor_creci === "string") patch.corretor_creci = update.corretor_creci;
    if (typeof update?.corretor_telefone === "string") patch.corretor_telefone = update.corretor_telefone;
    if (typeof update?.imobiliaria_nome === "string") patch.imobiliaria_nome = update.imobiliaria_nome;

    if (existing.status !== "rascunho") {
      if ("dados" in patch || "documentos" in patch || ("status" in patch && patch.status !== existing.status)) {
        return jsonResponse({ error: "Proposta is not editable" }, 400);
      }
    }

    if (typeof patch.status === "string" && !["rascunho", "enviado"].includes(patch.status)) {
      return jsonResponse({ error: "Invalid status" }, 400);
    }

    const { data: updated, error: updateError } = await admin
      .from("propostas")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) return jsonResponse({ error: updateError.message }, 400);

    return jsonResponse({ proposta: updated });
  } catch (e) {
    console.error("public-proposta error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});

