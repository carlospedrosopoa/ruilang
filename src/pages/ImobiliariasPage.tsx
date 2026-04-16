import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Building2, Plus, Pencil, Trash2, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const estadosBR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface Imobiliaria {
  id: string;
  nome: string;
  creci: string;
  responsavel: string | null;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  cep: string | null;
  email: string | null;
}

const emptyForm = {
  nome: "",
  creci: "",
  responsavel: "",
  telefone: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  estado: "RS",
  cep: "",
  email: "",
};

const ImobiliariasPage = () => {
  const navigate = useNavigate();
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userTenantId, setUserTenantId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"owner" | "admin" | "member">("admin");
  const [userPassword, setUserPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("imobiliarias").select("*").order("nome");
    if (error) {
      const hint =
        error.message?.toLowerCase().includes("invalid api key") ||
        error.message?.toLowerCase().includes("jwt") ||
        error.message?.toLowerCase().includes("unauthorized")
          ? " Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (sem aspas) no deploy."
          : "";
      toast.error(`Erro ao carregar imobiliárias: ${error.message}.${hint}`);
      setImobiliarias([]);
      setLoading(false);
      return;
    }
    setImobiliarias((data as Imobiliaria[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.nome.trim() || !form.creci.trim() || !form.cidade.trim()) {
      toast.error("Preencha os campos obrigatórios (Nome, CRECI, Cidade).");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        creci: form.creci.trim(),
        responsavel: form.responsavel.trim() || null,
        telefone: form.telefone.trim() || null,
        endereco: form.endereco.trim() || null,
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim(),
        estado: form.estado,
        cep: form.cep.trim() || null,
        email: form.email.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase.from("imobiliarias").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Imobiliária atualizada!");
      } else {
        const { error } = await supabase.from("imobiliarias").insert(payload);
        if (error) throw error;
        toast.success("Imobiliária cadastrada!");
      }

      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "Erro ao salvar.";
      const hint =
        message.toLowerCase().includes("invalid api key") ||
        message.toLowerCase().includes("jwt") ||
        message.toLowerCase().includes("unauthorized")
          ? " Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (sem aspas) no deploy."
          : "";
      toast.error(`${message}.${hint}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (imob: Imobiliaria) => {
    setEditingId(imob.id);
    setForm({
      nome: imob.nome,
      creci: imob.creci,
      responsavel: imob.responsavel || "",
      telefone: imob.telefone || "",
      endereco: imob.endereco || "",
      numero: imob.numero || "",
      bairro: imob.bairro || "",
      cidade: imob.cidade,
      estado: imob.estado,
      cep: imob.cep || "",
      email: imob.email || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta imobiliária?")) return;
    const { error } = await supabase.from("imobiliarias").delete().eq("id", id);
    if (error) {
      const message = typeof error.message === "string" ? error.message : "Erro ao excluir.";
      const hint =
        message.toLowerCase().includes("invalid api key") ||
        message.toLowerCase().includes("jwt") ||
        message.toLowerCase().includes("unauthorized")
          ? " Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (sem aspas) no deploy."
          : "";
      toast.error(`${message}.${hint}`);
    } else {
      toast.success("Imobiliária excluída.");
      load();
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openCreateUser = (tenantId: string) => {
    setUserTenantId(tenantId);
    setUserEmail("");
    setUserRole("admin");
    setUserPassword("");
    setUserDialogOpen(true);
  };

  const handleCreateUser = async () => {
    if (!userTenantId) return;
    const email = userEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email,
          tenantId: userTenantId,
          role: userRole,
          password: userPassword.trim() ? userPassword.trim() : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.temporaryPassword) {
        toast.success(`Usuário criado. Senha temporária: ${data.temporaryPassword}`);
      } else {
        toast.success("Usuário criado com sucesso.");
      }
      setUserDialogOpen(false);
    } catch (err: any) {
      let message = typeof err?.message === "string" ? err.message : "Erro ao criar usuário.";
      const ctx = err?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (typeof body?.error === "string" && body.error.trim()) {
            message = body.error;
          }
        } catch {}
      }
      toast.error(message);
    } finally {
      setCreatingUser(false);
    }
  };

  const updateField = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Imobiliárias</h1>
            <p className="text-xs text-muted-foreground">Cadastro de imobiliárias parceiras</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">Imobiliárias Cadastradas</h2>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Nova Imobiliária
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : imobiliarias.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma imobiliária cadastrada.</p>
            <Button variant="outline" className="mt-4" onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Cadastrar Primeira
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {imobiliarias.map((imob) => (
              <div key={imob.id} className="border border-border rounded-xl p-5 bg-card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{imob.nome}</h3>
                    <p className="text-sm text-muted-foreground">CRECI: {imob.creci}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openCreateUser(imob.id)}>
                      <UserPlus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(imob)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(imob.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted-foreground space-y-1">
                  {imob.responsavel && <p>Responsável: {imob.responsavel}</p>}
                  {imob.telefone && <p>Tel: {imob.telefone}</p>}
                  {imob.endereco && (
                    <p>{imob.endereco}{imob.numero ? `, nº ${imob.numero}` : ""}{imob.bairro ? ` - ${imob.bairro}` : ""}</p>
                  )}
                  <p>{imob.cidade}/{imob.estado}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>E-mail</Label>
                <Input value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="usuario@imobiliaria.com" type="email" />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select value={userRole} onValueChange={(v) => setUserRole(v as any)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Senha (opcional)</Label>
                <Input value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Deixe em branco para gerar" type="password" />
              </div>
              <Button onClick={handleCreateUser} disabled={creatingUser} className="w-full">
                {creatingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Criar Usuário
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Imobiliária" : "Nova Imobiliária"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => updateField("nome", e.target.value)} placeholder="Nome da imobiliária" />
                </div>
                <div>
                  <Label>CRECI *</Label>
                  <Input value={form.creci} onChange={(e) => updateField("creci", e.target.value)} placeholder="Ex: J-24.683" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Responsável</Label>
                  <Input value={form.responsavel} onChange={(e) => updateField("responsavel", e.target.value)} placeholder="Nome do responsável" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => updateField("telefone", e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => updateField("endereco", e.target.value)} placeholder="Rua / Avenida" />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={(e) => updateField("numero", e.target.value)} placeholder="Nº" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} placeholder="Bairro" />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input value={form.cidade} onChange={(e) => updateField("cidade", e.target.value)} placeholder="Cidade" />
                </div>
                <div>
                  <Label>Estado *</Label>
                  <Select value={form.estado} onValueChange={(v) => updateField("estado", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {estadosBR.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(e) => updateField("cep", e.target.value)} placeholder="00000-000" />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@imobiliaria.com" type="email" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editingId ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default ImobiliariasPage;
