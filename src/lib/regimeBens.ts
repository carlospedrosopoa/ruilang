export const REGIMES_BENS = [
  {
    id: "comunhao_parcial",
    label: "Comunhão Parcial de Bens",
    estadoCivil: ["Casado(a)", "União Estável"]
  },
  {
    id: "comunhao_universal",
    label: "Comunhão Universal de Bens",
    estadoCivil: ["Casado(a)", "União Estável"]
  },
  {
    id: "separacao_total",
    label: "Separação Total de Bens",
    estadoCivil: ["Casado(a)", "União Estável"]
  },
  {
    id: "separacao_obrigatoria",
    label: "Separação Obrigatória de Bens (legal)",
    estadoCivil: ["Casado(a)"]
  },
  {
    id: "participacao_final_aquestos",
    label: "Participação Final nos Aquestos",
    estadoCivil: ["Casado(a)"]
  },
  {
    id: "uniao_estavel_sem_pacto",
    label: "União Estável sem pacto (presume Comunhão Parcial)",
    estadoCivil: ["União Estável"]
  },
  {
    id: "uniao_estavel_com_pacto",
    label: "União Estável com pacto",
    estadoCivil: ["União Estável"]
  },
] as const;

export type RegimeBensId = (typeof REGIMES_BENS)[number]["id"];

export function getRegimeLabel(id: RegimeBensId | string | undefined | null): string {
  if (!id) return "";
  const regime = REGIMES_BENS.find(r => r.id === id);
  return regime?.label || String(id);
}

export function getRegimesByEstadoCivil(estadoCivil: string): typeof REGIMES_BENS {
  return REGIMES_BENS.filter(r => r.estadoCivil.includes(estadoCivil));
}

export function normalizeRegimeBens(value: string | undefined | null): RegimeBensId | null {
  if (!value) return null;
  
  const clean = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.includes("parcial") || clean.includes("comunhao parcial")) return "comunhao_parcial";
  if (clean.includes("universal") || clean.includes("comunhao universal")) return "comunhao_universal";
  if (clean.includes("separacao total") || clean.includes("separar total")) return "separacao_total";
  if (clean.includes("obrigatoria") || clean.includes("separacao obrigatoria") || clean.includes("legal")) return "separacao_obrigatoria";
  if (clean.includes("participacao") || clean.includes("aquestos")) return "participacao_final_aquestos";
  if (clean.includes("uniao estavel sem pacto") || (clean.includes("uniao estavel") && clean.includes("sem pacto"))) return "uniao_estavel_sem_pacto";
  if (clean.includes("uniao estavel com pacto") || (clean.includes("uniao estavel") && clean.includes("com pacto"))) return "uniao_estavel_com_pacto";

  const directMatch = REGIMES_BENS.find(r => 
    r.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(clean)
  );
  if (directMatch) return directMatch.id;

  return null;
}
