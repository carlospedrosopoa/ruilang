import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, TrendingUp, Link2, Users, FileText, Sparkles, FileCheck, List } from "lucide-react";

type Submission = {
  id: string;
  corretor_id: string | null;
  corretor_nome: string | null;
  tipo_contrato: string;
  status: string;
  created_at: string;
  first_opened_at: string | null;
  submitted_at: string | null;
  proposta_gerada_em: string | null;
  contract_generated_at: string | null;
  imobiliaria_id: string | null;
};

type Corretor = { id: string; nome: string };
type Imobiliaria = { id: string; nome: string };

function diffHours(a: string, b: string) {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
  return (db - da) / (1000 * 60 * 60);
}

function durationHours(from: string | null, to: string | null, fallbackFrom?: string) {
  const start = from || fallbackFrom;
  if (!start || !to) return null;
  return diffHours(start, to);
}

function avg(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function formatDuration(valueHours: number | null) {
  if (valueHours === null) return "-";
  const totalMinutes = Math.max(1, Math.round(valueHours * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

export default function DashboardFluxoPage() {
  const { activeTenantId, isPlatformAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);

  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filterImobiliaria, setFilterImobiliaria] = useState("all");
  const [filterCorretor, setFilterCorretor] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [analiticoOpen, setAnaliticoOpen] = useState(false);
  const [analiticoCorretorId, setAnaliticoCorretorId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const subsQuery = supabase
        .from("submissions")
        .select(
          "id, corretor_id, corretor_nome, tipo_contrato, status, created_at, first_opened_at, submitted_at, proposta_gerada_em, contract_generated_at, imobiliaria_id",
        )
        .order("created_at", { ascending: false })
        .limit(5000);

      const corrQuery = supabase.from("corretores").select("id, nome").order("nome");
      const imobQuery = supabase.from("imobiliarias").select("id, nome").order("nome");

      if (!isPlatformAdmin && activeTenantId) {
        subsQuery.eq("imobiliaria_id", activeTenantId);
        corrQuery.eq("imobiliaria_id", activeTenantId);
        imobQuery.eq("id", activeTenantId);
      }

      const [subsRes, corrRes, imobRes] = await Promise.all([subsQuery, corrQuery, imobQuery]);

      setSubmissions((subsRes.data as Submission[]) || []);
      setCorretores((corrRes.data as Corretor[]) || []);
      setImobiliarias((imobRes.data as Imobiliaria[]) || []);
      setLoading(false);
    };

    load();
  }, [activeTenantId, isPlatformAdmin]);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const created = parseISO(s.created_at);
      if (dateFrom && created < dateFrom) return false;
      if (dateTo && created > dateTo) return false;
      if (filterTipo !== "all" && s.tipo_contrato !== filterTipo) return false;
      if (filterCorretor !== "all") {
        if (filterCorretor === "sem") {
          if (s.corretor_id) return false;
        } else {
          if (s.corretor_id !== filterCorretor) return false;
        }
      }
      if (filterImobiliaria !== "all" && s.imobiliaria_id !== filterImobiliaria) return false;
      return true;
    });
  }, [submissions, dateFrom, dateTo, filterTipo, filterCorretor, filterImobiliaria]);

  const kpis = useMemo(() => {
    const totalLinks = filtered.length;
    const opened = filtered.filter((s) => Boolean(s.first_opened_at)).length;
    const submitted = filtered.filter((s) => Boolean(s.submitted_at) || s.status === "enviado" || s.status === "contrato_gerado").length;
    const propostasGeradas = filtered.filter((s) => Boolean(s.proposta_gerada_em)).length;
    const contratosGerados = filtered.filter((s) => Boolean(s.contract_generated_at) || s.status === "contrato_gerado").length;

    const toFirstOpen = filtered
      .map((s) => (s.first_opened_at ? diffHours(s.created_at, s.first_opened_at) : null))
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgToFirstOpen = avg(toFirstOpen);

    const openToSubmit = filtered
      .map((s) => durationHours(s.first_opened_at, s.submitted_at))
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgOpenToSubmit = avg(openToSubmit);

    const submitToProposal = filtered
      .map((s) => durationHours(s.submitted_at, s.proposta_gerada_em))
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgSubmitToProposal = avg(submitToProposal);

    const proposalToContract = filtered
      .map((s) => durationHours(s.proposta_gerada_em, s.contract_generated_at))
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgProposalToContract = avg(proposalToContract);

    const submitToContract = filtered
      .map((s) => durationHours(s.submitted_at, s.contract_generated_at))
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgSubmitToContract = avg(submitToContract);

    const totalToContract = filtered
      .map((s) => durationHours(s.created_at, s.contract_generated_at))
      .filter((v): v is number => typeof v === "number" && v >= 0);
    const avgPrazo = avg(totalToContract);

    return {
      totalLinks,
      opened,
      submitted,
      propostasGeradas,
      contratosGerados,
      avgToFirstOpen,
      avgOpenToSubmit,
      avgSubmitToProposal,
      avgProposalToContract,
      avgSubmitToContract,
      avgPrazo,
    };
  }, [filtered]);

  const byCorretor = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        corretor: string;
        links: number;
        opened: number;
        submitted: number;
        avgPrazo: number | null;
      }
    >();
    for (const s of filtered) {
      const id = s.corretor_id || "sem";
      const nome =
        s.corretor_nome ||
        corretores.find((c) => c.id === s.corretor_id)?.nome ||
        "Sem corretor";
      const current = map.get(id) || { id, corretor: nome, links: 0, opened: 0, submitted: 0, avgPrazo: null };
      current.links++;
      if (s.first_opened_at) current.opened++;
      if (s.submitted_at || s.status === "enviado" || s.status === "contrato_gerado") current.submitted++;
      map.set(id, current);
    }

    const prazosBy = new Map<string, number[]>();
    for (const s of filtered) {
      if (!s.contract_generated_at) continue;
      const h = durationHours(s.created_at, s.contract_generated_at);
      if (h === null || h < 0) continue;
      const key = s.corretor_id || "sem";
      const list = prazosBy.get(key) || [];
      list.push(h);
      prazosBy.set(key, list);
    }

    for (const [key, row] of map.entries()) {
      row.avgPrazo = avg(prazosBy.get(key) || []);
    }

    return Array.from(map.values()).sort((a, b) => b.links - a.links);
  }, [filtered, corretores]);

  const analiticoRows = useMemo(() => {
    if (!analiticoCorretorId) return [];
    const rows = filtered.filter((s) => {
      if (analiticoCorretorId === "sem") return !s.corretor_id;
      return s.corretor_id === analiticoCorretorId;
    });
    return rows
      .slice()
      .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime());
  }, [analiticoCorretorId, filtered]);

  const openAnalitico = (corretorId: string) => {
    setAnaliticoCorretorId(corretorId);
    setAnaliticoOpen(true);
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setFilterImobiliaria("all");
    setFilterCorretor("all");
    setFilterTipo("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Fluxo de coletas e geração de documentos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearFilters}>Limpar filtros</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="border border-border rounded-xl bg-card p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left text-xs h-9", !dateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                        {dateFrom ? format(dateFrom, "dd/MM/yy") : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left text-xs h-9", !dateTo && "text-muted-foreground")}>
                        <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                        {dateTo ? format(dateTo, "dd/MM/yy") : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Imobiliária</Label>
                  <Select value={filterImobiliaria} onValueChange={setFilterImobiliaria}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {imobiliarias.map((i) => (<SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Corretor</Label>
                  <Select value={filterCorretor} onValueChange={setFilterCorretor}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sem">Sem corretor</SelectItem>
                      {corretores.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="promessa_compra_venda">Compra e Venda</SelectItem>
                      <SelectItem value="promessa_compra_venda_permuta">Compra e Venda c/ Permuta</SelectItem>
                      <SelectItem value="cessao_direitos">Cessão de Direitos</SelectItem>
                      <SelectItem value="locacao">Locação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button className="w-full h-9" onClick={() => {}}>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Atualizar
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <Kpi icon={Link2} label="Links" value={formatDuration(kpis.avgToFirstOpen)} meta={`${kpis.totalLinks} links`} />
              <Kpi icon={CalendarIcon} label="1ª Abertura" value={formatDuration(kpis.avgOpenToSubmit)} meta={`${kpis.opened} abertos`} />
              <Kpi icon={Users} label="Enviadas" value={formatDuration(kpis.avgSubmitToProposal)} meta={`${kpis.submitted} enviadas`} />
              <Kpi icon={Sparkles} label="Propostas" value={formatDuration(kpis.avgProposalToContract)} meta={`${kpis.propostasGeradas} propostas`} />
              <Kpi icon={FileCheck} label="Contratos" value={formatDuration(kpis.avgSubmitToContract)} meta={`${kpis.contratosGerados} contratos`} />
              <Kpi icon={FileText} label="Prazo Médio" value={formatDuration(kpis.avgPrazo)} meta="Link → Contrato" />
            </div>

            <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
              <h2 className="font-display text-sm font-bold text-foreground mb-4">Por Corretor</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Corretor</TableHead>
                    <TableHead className="text-center">Links</TableHead>
                    <TableHead className="text-center">Abertos</TableHead>
                    <TableHead className="text-center">Enviados</TableHead>
                    <TableHead className="text-right">Prazo Médio</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCorretor.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.corretor}</TableCell>
                      <TableCell className="text-center">{r.links}</TableCell>
                      <TableCell className="text-center">{r.opened}</TableCell>
                      <TableCell className="text-center">{r.submitted}</TableCell>
                      <TableCell className="text-right">{formatDuration(r.avgPrazo)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openAnalitico(r.id)}>
                          <List className="w-4 h-4 mr-1.5" />
                          Analítico
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                Prazo médio: tempo entre a criação do link e a geração do contrato.
              </p>
            </div>
          </>
      )}

      <Dialog open={analiticoOpen} onOpenChange={setAnaliticoOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Analítico por Corretor</DialogTitle>
          </DialogHeader>
          <div className="border border-border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Link</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>1ª Abertura</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead>Proposta</TableHead>
                  <TableHead>Contrato</TableHead>
                      <TableHead className="text-right">Prazo (Link→Contrato)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analiticoRows.map((s) => {
                  const prazo = durationHours(s.created_at, s.contract_generated_at);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{s.tipo_contrato}</TableCell>
                      <TableCell className="text-xs">{s.status}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(s.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-xs">
                        {s.first_opened_at ? format(parseISO(s.first_opened_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {s.submitted_at ? format(parseISO(s.submitted_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">{s.proposta_gerada_em ? "sim" : "-"}</TableCell>
                      <TableCell className="text-xs">{s.contract_generated_at ? "sim" : "-"}</TableCell>
                      <TableCell className="text-right text-xs">{formatDuration(prazo)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Dica: se submitted_at estiver vazio em links antigos, ele só aparece quando o corretor reenviar a coleta.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: any;
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="border border-border rounded-xl bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-xl font-bold text-foreground">{value}</div>
      {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
    </div>
  );
}
