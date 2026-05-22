import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { tiposContrato } from "@/types/contract";

type TipoContratoLabels = {
  parteA: string;
  parteB: string;
  parteAPlural: string;
  parteBPlural: string;
  simetricas: boolean;
  objeto: string;
  acao: string;
  tipoContratoId: string | null;
  tipoNome: string | null;
  loading: boolean;
};

function pluralizePt(input: string) {
  const base = String(input || "").trim();
  if (!base) return "";
  const last = base.slice(-1);
  if (last === "r") return `${base}es`;
  return `${base}s`;
}

const BUILTIN: Record<
  string,
  Omit<TipoContratoLabels, "tipoContratoId" | "tipoNome" | "loading"> & { tipoNome: string }
> = {
  promessa_compra_venda: {
    parteA: "Vendedor",
    parteB: "Comprador",
    parteAPlural: "Vendedores",
    parteBPlural: "Compradores",
    simetricas: false,
    objeto: "Imóvel",
    acao: "compra e venda",
    tipoNome: "Promessa de Compra e Venda",
  },
  promessa_compra_venda_permuta: {
    parteA: "Vendedor",
    parteB: "Comprador",
    parteAPlural: "Vendedores",
    parteBPlural: "Compradores",
    simetricas: false,
    objeto: "Imóvel",
    acao: "compra e venda",
    tipoNome: "Promessa de Compra e Venda com Permuta",
  },
  locacao: {
    parteA: "Locador",
    parteB: "Locatário",
    parteAPlural: "Locadores",
    parteBPlural: "Locatários",
    simetricas: false,
    objeto: "Imóvel",
    acao: "locação",
    tipoNome: "Contrato de Locação",
  },
  cessao_direitos: {
    parteA: "Cedente",
    parteB: "Cessionário",
    parteAPlural: "Cedentes",
    parteBPlural: "Cessionários",
    simetricas: false,
    objeto: "Imóvel",
    acao: "cessão de direitos possessórios",
    tipoNome: "Cessão de Direitos Possessórios",
  },
};

export function useTipoContratoLabels(params: { tipoCodigo: string; imobiliariaId: string | null }) {
  const { tipoCodigo, imobiliariaId } = params;
  const [row, setRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!imobiliariaId) {
        setRow(null);
        return;
      }
      setLoading(true);
      try {
        const { data } = await supabase
          .from("tipos_contrato")
          .select(
            "id, codigo, nome, label_vendedor, label_comprador, label_parte_a, label_parte_b, label_parte_a_plural, label_parte_b_plural, partes_simetricas, label_objeto, label_acao",
          )
          .eq("imobiliaria_id", imobiliariaId)
          .eq("codigo", tipoCodigo)
          .maybeSingle();
        if (!cancelled) setRow(data || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [imobiliariaId, tipoCodigo]);

  return useMemo<TipoContratoLabels>(() => {
    const built = BUILTIN[tipoCodigo] || {
      parteA: "Vendedor",
      parteB: "Comprador",
      parteAPlural: "Vendedores",
      parteBPlural: "Compradores",
      simetricas: false,
      objeto: "Imóvel",
      acao: "compra e venda",
      tipoNome: tiposContrato.find((t) => String(t.id) === tipoCodigo)?.nome || null,
    };

    const parteA = String(row?.label_parte_a || row?.label_vendedor || built.parteA || "Vendedor").trim() || "Vendedor";
    const rawParteB = String(row?.label_parte_b || row?.label_comprador || built.parteB || "Comprador").trim() || "Comprador";
    const simetricas = Boolean(row?.partes_simetricas) || Boolean(built.simetricas);
    const parteB = simetricas ? parteA : rawParteB;

    const parteAPlural =
      String(row?.label_parte_a_plural || "").trim() ||
      String(built.parteAPlural || "").trim() ||
      pluralizePt(parteA);
    const rawParteBPlural =
      String(row?.label_parte_b_plural || "").trim() ||
      String(built.parteBPlural || "").trim() ||
      pluralizePt(parteB);
    const parteBPlural = simetricas ? parteAPlural : rawParteBPlural;

    const objeto = String(row?.label_objeto || built.objeto || "Imóvel").trim() || "Imóvel";
    const acao = String(row?.label_acao || built.acao || "compra e venda").trim() || "compra e venda";
    const tipoNome = String(row?.nome || "").trim() || built.tipoNome || null;
    const tipoContratoId = typeof row?.id === "string" && row.id.trim() ? row.id.trim() : null;

    return {
      parteA,
      parteB,
      parteAPlural,
      parteBPlural,
      simetricas,
      objeto,
      acao,
      tipoContratoId,
      tipoNome,
      loading,
    };
  }, [row, tipoCodigo, loading]);
}

