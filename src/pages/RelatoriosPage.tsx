import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  CalendarIcon, FileText, Briefcase, TrendingUp, DollarSign,
  Users, Building2, Trophy, ArrowLeft, Loader2, Filter, BarChart3,
} from "lucide-react";

interface Proposta {
  id: string;
  token: string;
  corretor_nome: string | null;
  corretor_creci: string | null;
  imobiliaria_id?: string | null;
  imobiliaria_nome: string | null;
  dados: any;
  status: string;
  created_at: string;
}

interface Submission {
  id: string;
  token: string;
  tipo_contrato: string;
  corretor_nome: string | null;
  dados: any;
  status: string;
  created_at: string;
  imobiliaria_id: string | null;
}

interface Imobiliaria {
  id: string;
  nome: string;
}

const tipoContratoLabels: Record<string, string> = {
  promessa_compra_venda: "Compra e Venda",
  promessa_compra_venda_permuta: "Compra e Venda c/ Permuta",
  cessao_direitos: "Cessão de Direitos",
  locacao: "Locação",
};

const CHART_COLORS = [
  "hsl(220, 55%, 18%)",
  "hsl(40, 70%, 50%)",
  "hsl(152, 55%, 40%)",
  "hsl(220, 55%, 40%)",
  "hsl(35, 80%, 55%)",
  "hsl(200, 60%, 45%)",
];

const extractValor = (dados: any): number => {
  if (!dados) return 0;
  const pagamento = dados.pagamento;
  if (!pagamento) return 0;
  const raw = pagamento.valorTotal || pagamento.valor_total || pagamento.preco || "0";
  const str = String(raw).replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(str) || 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const RelatoriosPage = () => {
  const navigate = useNavigate();
  const { activeTenantId, isPlatformAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filterImobiliaria, setFilterImobiliaria] = useState("all");
  const [filterCorretor, setFilterCorretor] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const propQuery = supabase.from("propostas").select("*").order("created_at", { ascending: false });
      const subQuery = supabase.from("submissions").select("*").order("created_at", { ascending: false });
      const imobQuery = supabase.from("imobiliarias").select("id, nome").order("nome");

      if (!isPlatformAdmin && activeTenantId) {
        propQuery.eq("imobiliaria_id", activeTenantId);
        subQuery.eq("imobiliaria_id", activeTenantId);
        imobQuery.eq("id", activeTenantId);
      }

      const [propRes, subRes, imobRes] = await Promise.all([propQuery, subQuery, imobQuery]);
      setPropostas((propRes.data as Proposta[]) || []);
      setSubmissions((subRes.data as Submission[]) || []);
      setImobiliarias((imobRes.data as Imobiliaria[]) || []);
      setLoading(false);
    };
    load();
  }, [activeTenantId, isPlatformAdmin]);

  // Filtered data
  const filteredPropostas = useMemo(() => {
    return propostas.filter((p) => {
      const d = parseISO(p.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (filterImobiliaria !== "all" && p.imobiliaria_nome !== filterImobiliaria) return false;
      if (filterCorretor !== "all" && p.corretor_nome !== filterCorretor) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [propostas, dateFrom, dateTo, filterImobiliaria, filterCorretor, filterStatus]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const d = parseISO(s.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (filterTipo !== "all" && s.tipo_contrato !== filterTipo) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      if (filterImobiliaria !== "all") {
        const imob = imobiliarias.find((i) => i.nome === filterImobiliaria);
        if (imob && s.imobiliaria_id !== imob.id) return false;
        if (!imob) return false;
      }
      if (filterCorretor !== "all" && s.corretor_nome !== filterCorretor) return false;
      return true;
    });
  }, [submissions, dateFrom, dateTo, filterImobiliaria, filterCorretor, filterTipo, filterStatus, imobiliarias]);

  // Unique values for filters
  const corretores = useMemo(() => {
    const set = new Set<string>();
    propostas.forEach((p) => p.corretor_nome && set.add(p.corretor_nome));
    submissions.forEach((s) => s.corretor_nome && set.add(s.corretor_nome));
    return Array.from(set).sort();
  }, [propostas, submissions]);

  const imobiliariasNomes = useMemo(() => {
    const set = new Set<string>();
    propostas.forEach((p) => p.imobiliaria_nome && set.add(p.imobiliaria_nome));
    imobiliarias.forEach((i) => set.add(i.nome));
    return Array.from(set).sort();
  }, [propostas, imobiliarias]);

  // KPIs
  const kpis = useMemo(() => {
    const totalPropostas = filteredPropostas.length;
    const totalContratos = filteredSubmissions.filter((s) => s.status === "enviado" || s.status === "contrato_gerado").length;
    const taxa = totalPropostas > 0 ? ((totalContratos / totalPropostas) * 100) : 0;

    let valorTotal = 0;
    filteredPropostas.forEach((p) => { valorTotal += extractValor(p.dados); });
    filteredSubmissions.forEach((s) => { valorTotal += extractValor(s.dados); });

    const totalNeg = totalPropostas + filteredSubmissions.length;
    const ticket = totalNeg > 0 ? valorTotal / totalNeg : 0;

    return { totalPropostas, totalContratos, taxa, valorTotal, ticket };
  }, [filteredPropostas, filteredSubmissions]);

  // Corretor report
  const corretorReport = useMemo(() => {
    const map = new Map<string, { nome: string; creci: string; propostas: number; contratos: number; volume: number }>();
    filteredPropostas.forEach((p) => {
      const key = p.corretor_nome || "Desconhecido";
      const existing = map.get(key) || { nome: key, creci: p.corretor_creci || "-", propostas: 0, contratos: 0, volume: 0 };
      existing.propostas++;
      existing.volume += extractValor(p.dados);
      map.set(key, existing);
    });
    filteredSubmissions.forEach((s) => {
      const key = s.corretor_nome || "Desconhecido";
      const existing = map.get(key) || { nome: key, creci: "-", propostas: 0, contratos: 0, volume: 0 };
      if (s.status === "enviado" || s.status === "contrato_gerado") existing.contratos++;
      existing.volume += extractValor(s.dados);
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
  }, [filteredPropostas, filteredSubmissions]);

  // Imobiliaria report
  const imobiliariaReport = useMemo(() => {
    const map = new Map<string, { nome: string; propostas: number; contratos: number; volume: number; corretores: Set<string> }>();
    filteredPropostas.forEach((p) => {
      const key = p.imobiliaria_nome || "Sem imobiliária";
      const existing = map.get(key) || { nome: key, propostas: 0, contratos: 0, volume: 0, corretores: new Set() };
      existing.propostas++;
      existing.volume += extractValor(p.dados);
      if (p.corretor_nome) existing.corretores.add(p.corretor_nome);
      map.set(key, existing);
    });
    filteredSubmissions.forEach((s) => {
      const imob = imobiliarias.find((i) => i.id === s.imobiliaria_id);
      const key = imob?.nome || "Sem imobiliária";
      const existing = map.get(key) || { nome: key, propostas: 0, contratos: 0, volume: 0, corretores: new Set() };
      if (s.status === "enviado" || s.status === "contrato_gerado") existing.contratos++;
      existing.volume += extractValor(s.dados);
      if (s.corretor_nome) existing.corretores.add(s.corretor_nome);
      map.set(key, existing);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, corretoresAtivos: r.corretores.size }))
      .sort((a, b) => b.volume - a.volume);
  }, [filteredPropostas, filteredSubmissions, imobiliarias]);

  // Chart: propostas por mês
  const propostasPorMes = useMemo(() => {
    const all = [...filteredPropostas.map((p) => parseISO(p.created_at)), ...filteredSubmissions.map((s) => parseISO(s.created_at))];
    if (all.length === 0) return [];
    const sorted = all.sort((a, b) => a.getTime() - b.getTime());
    const months = eachMonthOfInterval({ start: startOfMonth(sorted[0]), end: endOfMonth(sorted[sorted.length - 1]) });
    return months.map((m) => {
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const props = filteredPropostas.filter((p) => isWithinInterval(parseISO(p.created_at), { start, end })).length;
      const contr = filteredSubmissions.filter((s) => isWithinInterval(parseISO(s.created_at), { start, end })).length;
      return { mes: format(m, "MMM/yy", { locale: ptBR }), Propostas: props, Contratos: contr };
    });
  }, [filteredPropostas, filteredSubmissions]);

  // Chart: contratos por tipo
  const contratosPorTipo = useMemo(() => {
    const map = new Map<string, number>();
    filteredSubmissions.forEach((s) => {
      const label = tipoContratoLabels[s.tipo_contrato] || s.tipo_contrato;
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredSubmissions]);

  // Chart: faturamento por mês
  const faturamentoPorMes = useMemo(() => {
    const all = [
      ...filteredPropostas.map((p) => ({ date: parseISO(p.created_at), valor: extractValor(p.dados) })),
      ...filteredSubmissions.map((s) => ({ date: parseISO(s.created_at), valor: extractValor(s.dados) })),
    ];
    if (all.length === 0) return [];
    const sorted = all.sort((a, b) => a.date.getTime() - b.date.getTime());
    const months = eachMonthOfInterval({ start: startOfMonth(sorted[0].date), end: endOfMonth(sorted[sorted.length - 1].date) });
    let acum = 0;
    return months.map((m) => {
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const mensal = all.filter((a) => isWithinInterval(a.date, { start, end })).reduce((sum, a) => sum + a.valor, 0);
      acum += mensal;
      return { mes: format(m, "MMM/yy", { locale: ptBR }), Mensal: mensal, Acumulado: acum };
    });
  }, [filteredPropostas, filteredSubmissions]);

  // Ranking
  const ranking = useMemo(() => {
    return [...corretorReport].sort((a, b) => b.propostas + b.contratos - (a.propostas + a.contratos)).slice(0, 5);
  }, [corretorReport]);

  const rankingVolume = useMemo(() => {
    return [...corretorReport].sort((a, b) => b.volume - a.volume).slice(0, 5);
  }, [corretorReport]);

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setFilterImobiliaria("all");
    setFilterCorretor("all");
    setFilterTipo("all");
    setFilterStatus("all");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src="/images/logo-sielichow.png" alt="Sielichow" className="h-9 w-auto" />
              <div>
                <h1 className="font-display text-xl font-bold text-primary-foreground tracking-tight">Relatórios</h1>
                <p className="text-xs text-primary-foreground/60 font-medium tracking-wide uppercase">Análise de Desempenho</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/painel")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <Briefcase className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Painel</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Filters */}
            <div className="border border-border rounded-xl bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Filtros</h2>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-xs text-muted-foreground">
                  Limpar filtros
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Date From */}
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
                {/* Date To */}
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
                {/* Imobiliária */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Imobiliária</Label>
                  <Select value={filterImobiliaria} onValueChange={setFilterImobiliaria}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {imobiliariasNomes.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Corretor */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Corretor</Label>
                  <Select value={filterCorretor} onValueChange={setFilterCorretor}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {corretores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Tipo Contrato */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(tipoContratoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Status */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="contrato_gerado">Contrato Gerado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard icon={Briefcase} label="Propostas" value={String(kpis.totalPropostas)} color="text-primary" />
              <KpiCard icon={FileText} label="Contratos" value={String(kpis.totalContratos)} color="text-accent" />
              <KpiCard icon={TrendingUp} label="Conversão" value={`${kpis.taxa.toFixed(1)}%`} color="text-success" />
              <KpiCard icon={DollarSign} label="Valor Negociado" value={formatCurrency(kpis.valorTotal)} color="text-primary" small />
              <KpiCard icon={DollarSign} label="Ticket Médio" value={formatCurrency(kpis.ticket)} color="text-accent" small />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Propostas por mês */}
              <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
                <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Propostas e Contratos por Mês
                </h3>
                {propostasPorMes.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={propostasPorMes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                      <XAxis dataKey="mes" fontSize={11} tick={{ fill: "hsl(220,10%,46%)" }} />
                      <YAxis fontSize={11} tick={{ fill: "hsl(220,10%,46%)" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,15%,90%)", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Propostas" fill="hsl(220, 55%, 18%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Contratos" fill="hsl(40, 70%, 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              {/* Contratos por tipo */}
              <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
                <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" /> Contratos por Tipo
                </h3>
                {contratosPorTipo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={contratosPorTipo} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false} fontSize={10}>
                        {contratosPorTipo.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,15%,90%)", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>

              {/* Faturamento */}
              <div className="border border-border rounded-xl bg-card p-5 shadow-sm lg:col-span-2">
                <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-success" /> Evolução de Faturamento
                </h3>
                {faturamentoPorMes.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={faturamentoPorMes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                      <XAxis dataKey="mes" fontSize={11} tick={{ fill: "hsl(220,10%,46%)" }} />
                      <YAxis fontSize={11} tick={{ fill: "hsl(220,10%,46%)" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(220,15%,90%)", fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="Mensal" stroke="hsl(40, 70%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="Acumulado" stroke="hsl(220, 55%, 18%)" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </div>
            </div>

            {/* Tables & Rankings */}
            <Tabs defaultValue="corretores" className="space-y-4">
              <TabsList>
                <TabsTrigger value="corretores" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Corretores</TabsTrigger>
                <TabsTrigger value="imobiliarias" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Imobiliárias</TabsTrigger>
                <TabsTrigger value="ranking" className="gap-1.5 text-xs"><Trophy className="w-3.5 h-3.5" /> Ranking</TabsTrigger>
              </TabsList>

              {/* Corretor table */}
              <TabsContent value="corretores">
                <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">Nome</th>
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">CRECI</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs">Propostas</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs">Contratos</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs">Conversão</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {corretorReport.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhum dado encontrado</td></tr>
                        ) : corretorReport.map((r, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{r.nome}</td>
                            <td className="px-4 py-3 text-muted-foreground">{r.creci}</td>
                            <td className="px-4 py-3 text-center">{r.propostas}</td>
                            <td className="px-4 py-3 text-center">{r.contratos}</td>
                            <td className="px-4 py-3 text-center">
                              {r.propostas > 0 ? `${((r.contratos / r.propostas) * 100).toFixed(0)}%` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.volume)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* Imobiliaria table */}
              <TabsContent value="imobiliarias">
                <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs">Imobiliária</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs">Propostas</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs">Contratos</th>
                          <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs">Volume</th>
                          <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs">Corretores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imobiliariaReport.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Nenhum dado encontrado</td></tr>
                        ) : imobiliariaReport.map((r, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{r.nome}</td>
                            <td className="px-4 py-3 text-center">{r.propostas}</td>
                            <td className="px-4 py-3 text-center">{r.contratos}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.volume)}</td>
                            <td className="px-4 py-3 text-center">{r.corretoresAtivos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* Ranking */}
              <TabsContent value="ranking">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
                    <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-accent" /> Top 5 Mais Produtivos
                    </h3>
                    <div className="space-y-3">
                      {ranking.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                      ) : ranking.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            i === 0 ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                          )}>
                            {i + 1}º
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{r.nome}</p>
                            <p className="text-xs text-muted-foreground">{r.propostas + r.contratos} negociações</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border border-border rounded-xl bg-card p-5 shadow-sm">
                    <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" /> Maior Volume Financeiro
                    </h3>
                    <div className="space-y-3">
                      {rankingVolume.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                      ) : rankingVolume.map((r, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            i === 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {i + 1}º
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{r.nome}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(r.volume)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

function KpiCard({ icon: Icon, label, value, color, small }: { icon: React.ElementType; label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="border border-border rounded-xl bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", color)} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn("font-display font-bold text-foreground", small ? "text-lg" : "text-2xl")}>{value}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
      Sem dados para exibir
    </div>
  );
}

export default RelatoriosPage;
