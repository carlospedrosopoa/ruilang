import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

type TipoPropostaRow = {
  id: string;
  imobiliaria_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  modelo_base: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export default function TiposPropostaPage() {
  const { activeTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TipoPropostaRow[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modeloBase, setModeloBase] = useState("");
  const [ativo, setAtivo] = useState(true);

  const canLoad = Boolean(activeTenantId);

  const load = async () => {
    if (!activeTenantId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tipos_proposta")
      .select("id, imobiliaria_id, codigo, nome, descricao, modelo_base, ativo, created_at, updated_at")
      .eq("imobiliaria_id", activeTenantId)
      .order("codigo", { ascending: true });
    if (error) {
      setRows([]);
      toast.error(error.message || "Erro ao carregar tipos de proposta.");
    } else {
      setRows((data as TipoPropostaRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeTenantId]);

  const openNew = () => {
    setEditingId(null);
    setCodigo("");
    setNome("");
    setDescricao("");
    setModeloBase("");
    setAtivo(true);
    setDialogOpen(true);
  };

  const openEdit = (row: TipoPropostaRow) => {
    setEditingId(row.id);
    setCodigo(row.codigo || "");
    setNome(row.nome || "");
    setDescricao(row.descricao || "");
    setModeloBase(row.modelo_base || "");
    setAtivo(Boolean(row.ativo));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    const c = codigo.trim();
    const n = nome.trim();
    const mb = modeloBase.trim();
    if (!c) {
      toast.error("Informe o código do tipo de proposta.");
      return;
    }
    if (!n) {
      toast.error("Informe o nome do tipo de proposta.");
      return;
    }
    if (!mb) {
      toast.error("Informe o modelo base.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { data, error } = await supabase
          .from("tipos_proposta")
          .update({
            codigo: c,
            nome: n,
            descricao: descricao.trim() || null,
            modelo_base: mb,
            ativo,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", editingId)
          .select("id, imobiliaria_id, codigo, nome, descricao, modelo_base, ativo, created_at, updated_at")
          .single();
        if (error) throw error;
        setRows((prev) => prev.map((r) => (r.id === editingId ? (data as any) : r)));
      } else {
        const { data, error } = await supabase
          .from("tipos_proposta")
          .insert({
            imobiliaria_id: activeTenantId,
            codigo: c,
            nome: n,
            descricao: descricao.trim() || null,
            modelo_base: mb,
            ativo,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .select("id, imobiliaria_id, codigo, nome, descricao, modelo_base, ativo, created_at, updated_at")
          .single();
        if (error) throw error;
        setRows((prev) => [...prev, data as any].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))));
      }
      toast.success("Tipo de proposta salvo!");
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar tipo de proposta.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (row: TipoPropostaRow) => {
    try {
      const next = !row.ativo;
      const { error } = await supabase
        .from("tipos_proposta")
        .update({ ativo: next, updated_at: new Date().toISOString() } as any)
        .eq("id", row.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ativo: next } : r)));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar status.");
    }
  };

  const hasRows = rows.length > 0;
  const emptyText = useMemo(() => {
    if (!canLoad) return "Selecione uma imobiliária para visualizar os tipos de proposta.";
    return "Nenhum tipo de proposta cadastrado ainda.";
  }, [canLoad]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Tipos de Proposta</h1>
          <p className="text-muted-foreground">Cadastre e mantenha o texto base usado como modelo para geração de propostas.</p>
        </div>
        <Button onClick={openNew} disabled={!canLoad}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Tipo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !hasRows ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg text-muted-foreground">{emptyText}</div>
      ) : (
        <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[56px]" />
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.nome}</TableCell>
                    <TableCell>
                      <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Tipo de Proposta" : "Novo Tipo de Proposta"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ex: promessa_compra_venda" />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Compra e Venda" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição (opcional)" />
            </div>
            <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-foreground">Ativo</div>
                <div className="text-xs text-muted-foreground">Se desativado, não será usado na geração automática</div>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <div>
              <Label>Modelo Base *</Label>
              <Textarea
                value={modeloBase}
                onChange={(e) => setModeloBase(e.target.value)}
                className="min-h-[320px]"
                placeholder="Cole aqui o modelo base da proposta..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

