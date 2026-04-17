import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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

type Corretor = {
  id: string;
  imobiliaria_id: string;
  nome: string;
  creci: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
};

const emptyForm = {
  nome: "",
  creci: "",
  telefone: "",
  email: "",
};

export default function CorretoresPage() {
  const navigate = useNavigate();
  const { activeTenantId } = useAuth();
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
    });
    setDialogOpen(true);
  };

  const updateField = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária/tenant para cadastrar corretores.");
      return;
    }
    if (!form.nome.trim()) {
      toast.error("Informe o nome do corretor.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        imobiliaria_id: activeTenantId,
        nome: form.nome.trim(),
        creci: form.creci.trim() || null,
        telefone: form.telefone.trim() || null,
        email: form.email.trim().toLowerCase() || null,
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
    const { error } = await supabase.from("corretores").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else {
      toast.success("Excluído!");
      setCorretores((prev) => prev.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/painel")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Voltar</span>
          </button>
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
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">Corretores</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : corretores.length === 0 ? (
          <div className="border border-border rounded-xl p-10 text-center bg-card">
            <p className="text-muted-foreground">Nenhum corretor cadastrado.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {corretores.map((c) => (
              <div key={c.id} className="border border-border rounded-xl p-5 bg-card flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">{c.nome}</h3>
                  <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
                    <p>{c.creci ? `CRECI: ${c.creci}` : "CRECI: -"}</p>
                    <p>{c.telefone || "-"}</p>
                    <p>{c.email || "-"}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

