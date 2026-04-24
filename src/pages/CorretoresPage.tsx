import { Fragment, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, UserCog, Percent, MapPin, Phone, Mail, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Corretor = {
  id: string;
  imobiliaria_id: string;
  nome: string;
  creci: string | null;
  telefone: string | null;
  email: string | null;
  comissao_percentual: number | null;
  cpf: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  ativo: boolean;
  created_at?: string;
};

const emptyForm = {
  nome: "",
  creci: "",
  telefone: "",
  email: "",
  comissao_percentual: "6",
  cpf: "",
  endereco: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
};

export default function CorretoresPage() {
  const { activeTenantId } = useAuth();
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const normalizeDigits = (value: string) => value.replace(/\D/g, "");

  const parsePercent = (value: string) => {
    const raw = value.trim();
    if (!raw) return null;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    if (n < 0 || n > 100) return null;
    return Math.round(n * 100) / 100;
  };

  const load = async () => {
    setLoading(true);
    const query = supabase.from("corretores").select("*").order("nome");
    if (activeTenantId) query.eq("imobiliaria_id", activeTenantId);
    const { data, error } = await query;
    if (error) toast.error("Erro ao carregar corretores.");
    setCorretores((data as Corretor[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeTenantId]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Corretor) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome || "",
      creci: c.creci || "",
      telefone: c.telefone || "",
      email: c.email || "",
      comissao_percentual:
        typeof c.comissao_percentual === "number" && Number.isFinite(c.comissao_percentual)
          ? String(c.comissao_percentual)
          : c.comissao_percentual == null
            ? ""
            : String(c.comissao_percentual),
      cpf: c.cpf || "",
      endereco: c.endereco || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
      estado: c.estado || "",
      cep: c.cep || "",
    });
    setDialogOpen(true);
  };

  const updateField = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const toggleExpanded = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAtivo = async (c: Corretor) => {
    try {
      const next = !c.ativo;
      const { error } = await supabase
        .from("corretores")
        .update({ ativo: next, updated_at: new Date().toISOString() } as any)
        .eq("id", c.id);
      if (error) throw error;
      setCorretores((prev) => prev.map((x) => (x.id === c.id ? { ...x, ativo: next } : x)));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar status.");
    }
  };

  const handleSave = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária/tenant para cadastrar corretores.");
      return;
    }
    if (!form.nome.trim()) {
      toast.error("Informe o nome do corretor.");
      return;
    }
    const percent = parsePercent(form.comissao_percentual);
    if (percent == null) {
      toast.error("Informe a % de comissão (0 a 100).");
      return;
    }
    setSaving(true);
    try {
      const cpf = normalizeDigits(form.cpf);
      const cep = normalizeDigits(form.cep);
      const payload: any = {
        imobiliaria_id: activeTenantId,
        nome: form.nome.trim(),
        creci: form.creci.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim().toLowerCase() || null,
        comissao_percentual: percent,
        cpf: cpf || null,
        endereco: form.endereco.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim().toUpperCase() || null,
        cep: cep || null,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from("corretores").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Corretor atualizado.");
      } else {
        const { error } = await supabase.from("corretores").insert(payload);
        if (error) throw error;
        toast.success("Corretor criado.");
      }

      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar corretor.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("Deseja excluir este corretor?");
    if (!ok) return;
    const { error } = await supabase.from("corretores").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else {
      toast.success("Excluído!");
      setCorretores((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return corretores;
    return corretores.filter((c) => {
      const hay = [
        c.nome,
        c.creci,
        c.telefone,
        c.email,
        c.cpf,
        c.cidade,
        c.estado,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [corretores, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <UserCog className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Corretores</h1>
            <p className="text-muted-foreground">Cadastre e gerencie corretores da imobiliária.</p>
          </div>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF, CRECI, e-mail ou telefone"
          className="w-full sm:w-96"
        />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Novo Corretor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Corretor" : "Novo Corretor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => updateField("nome", e.target.value)} placeholder="Nome do corretor" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>CRECI</Label>
                  <Input value={form.creci} onChange={(e) => updateField("creci", e.target.value)} placeholder="CRECI" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => updateField("telefone", e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div>
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>% Comissão</Label>
                  <Input
                    value={form.comissao_percentual}
                    onChange={(e) => updateField("comissao_percentual", e.target.value)}
                    placeholder="Ex: 6"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => updateField("cpf", e.target.value)}
                    placeholder="Somente números"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => updateField("endereco", e.target.value)} placeholder="Rua, número, complemento" />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} placeholder="Bairro" />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => updateField("cidade", e.target.value)} placeholder="Cidade" />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={form.estado} onChange={(e) => updateField("estado", e.target.value)} placeholder="Ex: SC" maxLength={2} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(e) => updateField("cep", e.target.value)} placeholder="Somente números" inputMode="numeric" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-xl p-10 text-center bg-card">
          <p className="text-muted-foreground">Nenhum corretor encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[34%]">Corretor</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const isExpanded = !!expanded[c.id];
                const cityUf = [c.cidade, c.estado].filter(Boolean).join(" / ") || "-";
                return (
                  <Fragment key={c.id}>
                    <TableRow>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">{c.cpf ? `CPF ${c.cpf}` : "CPF não informado"}</p>
                          <p className="text-[11px] text-muted-foreground">{c.creci ? `CRECI ${c.creci}` : "CRECI não informado"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2 text-sm text-foreground">
                          <Percent className="w-4 h-4 text-muted-foreground" />
                          <span>{typeof c.comissao_percentual === "number" ? `${c.comissao_percentual}%` : "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{c.telefone || "-"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="max-w-[210px] truncate">{c.email || "-"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{cityUf}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={c.ativo ? "border-emerald-500/30 text-emerald-200 bg-emerald-500/10" : ""}>
                          {c.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            Editar
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleExpanded(c.id)}>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded ? (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6}>
                          <div className="grid lg:grid-cols-2 gap-4">
                            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Dados para Nota Fiscal
                              </p>
                              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                <p className="inline-flex items-center gap-1.5">
                                  <IdCard className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">CPF:</span> {c.cpf || "-"}
                                </p>
                                <p className="inline-flex items-center gap-1.5">
                                  <Percent className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Comissão:</span>{" "}
                                  {typeof c.comissao_percentual === "number" ? `${c.comissao_percentual}%` : "-"}
                                </p>
                                <p className="sm:col-span-2 inline-flex items-center gap-1.5">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Endereço:</span>{" "}
                                  {[c.endereco, c.bairro, c.cidade, c.estado, c.cep].filter(Boolean).join(" • ") || "-"}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Ações
                              </p>
                              <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                                <div className="space-y-0.5">
                                  <div className="text-sm font-semibold text-foreground">Ativo</div>
                                  <div className="text-xs text-muted-foreground">Controla a disponibilidade deste corretor</div>
                                </div>
                                <Switch checked={c.ativo} onCheckedChange={() => toggleAtivo(c)} />
                              </div>
                              <Button variant="destructive" onClick={() => handleDelete(c.id)} className="w-full">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir corretor
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
