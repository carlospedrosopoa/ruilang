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
      .from("submissions")
      .select("*, imobiliarias(*)")
      .eq("token", token)
      .maybeSingle();

    if (findError) return jsonResponse({ error: findError.message }, 400);
    if (!existing) return jsonResponse({ error: "Not found" }, 404);

    if (!update) {
      if (!existing.first_opened_at) {
        await admin.from("submissions").update({ first_opened_at: new Date().toISOString() }).eq("id", existing.id);
      }
      return jsonResponse({ submission: existing });
    }

    const nextStatus = typeof update?.status === "string" ? update.status : undefined;
    const nextDados = update?.dados;
    const nextCorretorNome = typeof update?.corretor_nome === "string" ? update.corretor_nome : undefined;
    const nextCorretorTelefone = typeof update?.corretor_telefone === "string" ? update.corretor_telefone : undefined;
    const nextPropostaTexto = typeof update?.proposta_texto === "string" ? update.proposta_texto : undefined;

    const patch: any = {};
    if (typeof nextDados !== "undefined") patch.dados = nextDados;
    if (typeof nextStatus !== "undefined") patch.status = nextStatus;
    if (typeof nextCorretorNome !== "undefined") patch.corretor_nome = nextCorretorNome;
    if (typeof nextCorretorTelefone !== "undefined") patch.corretor_telefone = nextCorretorTelefone;
    if (typeof nextPropostaTexto !== "undefined") patch.proposta_texto = nextPropostaTexto;

    if (existing.status !== "rascunho") {
      if (typeof patch.status === "string" && patch.status !== existing.status) {
        return jsonResponse({ error: "Status cannot be changed after submission" }, 400);
      }
    }

    if (typeof patch.status === "string" && !["rascunho", "enviado", "contrato_gerado"].includes(patch.status)) {
      return jsonResponse({ error: "Invalid status" }, 400);
    }

    if (patch.status === "enviado" && existing.status !== "enviado" && !existing.submitted_at) {
      patch.submitted_at = new Date().toISOString();
    }
    if (typeof patch.proposta_texto === "string" && patch.proposta_texto.trim() !== "" && !existing.proposta_gerada_em) {
      patch.proposta_gerada_em = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await admin
      .from("submissions")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) return jsonResponse({ error: updateError.message }, 400);

    return jsonResponse({ submission: updated });
  } catch (e) {
    console.error("public-submission error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});

