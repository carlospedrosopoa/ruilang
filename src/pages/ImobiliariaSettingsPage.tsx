import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Image as ImageIcon, Loader2, Save, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ImobiliariaRow = {
  id: string;
  nome: string;
  creci: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  cep: string | null;
  logo_url: string | null;
  logo_storage_path: string | null;
  rede_social_url: string | null;
  whatsapp_atendimento: string | null;
  site_url: string | null;
};

function sanitizeForPath(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeStorageFileName(originalName: string) {
  const name = String(originalName || "");
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const safeBase = sanitizeForPath(base) || "arquivo";
  const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext.toLowerCase() : "";
  return `${safeBase}${safeExt}`.slice(0, 120);
}

export default function ImobiliariaSettingsPage() {
  const { activeTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [row, setRow] = useState<ImobiliariaRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nome: "",
    creci: "",
    email: "",
    telefone: "",
    whatsapp_atendimento: "",
    site_url: "",
    rede_social_url: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    logo_url: "",
    logo_storage_path: "",
  });

  const canEdit = Boolean(activeTenantId);

  const load = async () => {
    if (!activeTenantId) {
      setRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("imobiliarias")
      .select(
        "id, nome, creci, email, telefone, endereco, numero, bairro, cidade, estado, cep, logo_url, logo_storage_path, rede_social_url, whatsapp_atendimento, site_url",
      )
      .eq("id", activeTenantId)
      .single();
    if (error) {
      toast.error(error.message || "Erro ao carregar dados da imobiliária.");
      setRow(null);
      setLoading(false);
      return;
    }
    const r = data as any as ImobiliariaRow;
    setRow(r);
    setForm({
      nome: r.nome || "",
      creci: r.creci || "",
      email: r.email || "",
      telefone: r.telefone || "",
      whatsapp_atendimento: r.whatsapp_atendimento || "",
      site_url: r.site_url || "",
      rede_social_url: r.rede_social_url || "",
      endereco: r.endereco || "",
      numero: r.numero || "",
      bairro: r.bairro || "",
      cidade: r.cidade || "",
      estado: r.estado || "",
      cep: r.cep || "",
      logo_url: r.logo_url || "",
      logo_storage_path: r.logo_storage_path || "",
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeTenantId]);

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const displayName = useMemo(() => {
    return row?.nome || "Imobiliária";
  }, [row?.nome]);

  const save = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    if (!form.nome.trim()) {
      toast.error("Informe o nome da imobiliária.");
      return;
    }
    if (!form.creci.trim()) {
      toast.error("Informe o CRECI.");
      return;
    }
    if (!form.cidade.trim()) {
      toast.error("Informe a cidade.");
      return;
    }
    if (!form.estado.trim()) {
      toast.error("Informe a UF.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome.trim(),
        creci: form.creci.trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        whatsapp_atendimento: form.whatsapp_atendimento.trim() || null,
        site_url: form.site_url.trim() || null,
        rede_social_url: form.rede_social_url.trim() || null,
        endereco: form.endereco.trim() || null,
        numero: form.numero.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim(),
        estado: form.estado.trim().toUpperCase(),
        cep: form.cep.trim() || null,
        logo_url: form.logo_url.trim() || null,
        logo_storage_path: form.logo_storage_path.trim() || null,
      };
      const { data: updatedRow, error } = await supabase
        .from("imobiliarias")
        .update(payload)
        .eq("id", activeTenantId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updatedRow?.id) throw new Error("Sem permissão para salvar as configurações desta imobiliária.");
      toast.success("Configurações salvas.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = () => {
    if (!canEdit) return;
    fileRef.current?.click();
  };

  const onUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTenantId) return;
    setUploadingLogo(true);
    try {
      if (file.size > 6 * 1024 * 1024) throw new Error("A logo deve ter até 6MB.");
      const safeName = safeStorageFileName(file.name);
      const storagePath = `imobiliarias/${activeTenantId}/logo/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("proposta-docs").upload(storagePath, file, { upsert: true } as any);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("proposta-docs").getPublicUrl(storagePath);
      const url = urlData.publicUrl;

      const previous = form.logo_storage_path.trim();
      update("logo_url", url);
      update("logo_storage_path", storagePath);

      const { data: logoUpdRow, error: updErr } = await supabase
        .from("imobiliarias")
        .update({ logo_url: url, logo_storage_path: storagePath } as any)
        .eq("id", activeTenantId)
        .select("id")
        .maybeSingle();
      if (updErr) throw updErr;
      if (!logoUpdRow?.id) throw new Error("Sem permissão para atualizar a logo desta imobiliária.");

      if (previous && previous !== storagePath) {
        await supabase.storage.from("proposta-docs").remove([previous]);
      }

      toast.success("Logo atualizada.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar logo.");
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Configurações da Imobiliária</h1>
            <p className="text-muted-foreground">Dados usados nos conteúdos gerados e no atendimento.</p>
          </div>
        </div>
        <Button onClick={save} disabled={!canEdit || saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUploadLogo} />

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !row ? (
        <div className="border border-white/10 rounded-xl p-10 text-center bg-white/5 backdrop-blur-md shadow-card">
          <p className="text-muted-foreground">Selecione uma imobiliária para editar as configurações.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 border border-white/10 bg-white/5 backdrop-blur-md shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Identidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Imobiliária</Label>
                <Input value={displayName} disabled />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(ev) => update("nome", ev.target.value)} placeholder="Nome da imobiliária" />
              </div>
              <div>
                <Label>CRECI *</Label>
                <Input value={form.creci} onChange={(ev) => update("creci", ev.target.value)} placeholder="CRECI" />
              </div>
              <div>
                <Label>Logomarca</Label>
                <div className="mt-1.5 border border-white/10 rounded-xl bg-white/5 backdrop-blur-md p-4">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="w-full max-h-40 object-contain" />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="w-4 h-4" />
                      Nenhuma logo enviada
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Button variant="outline" onClick={onPickLogo} disabled={uploadingLogo}>
                    {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Enviar logo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border border-white/10 bg-white/5 backdrop-blur-md shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Contato e Endereço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={(ev) => update("email", ev.target.value)} placeholder="email@imobiliaria.com" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(ev) => update("telefone", ev.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>WhatsApp de atendimento</Label>
                  <Input value={form.whatsapp_atendimento} onChange={(ev) => update("whatsapp_atendimento", ev.target.value)} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label>Site</Label>
                  <Input value={form.site_url} onChange={(ev) => update("site_url", ev.target.value)} placeholder="https://..." />
                </div>
                <div className="md:col-span-2">
                  <Label>Rede social</Label>
                  <Input value={form.rede_social_url} onChange={(ev) => update("rede_social_url", ev.target.value)} placeholder="https://instagram.com/..." />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(ev) => update("endereco", ev.target.value)} placeholder="Rua, avenida..." />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={(ev) => update("numero", ev.target.value)} placeholder="Ex: 123" />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(ev) => update("bairro", ev.target.value)} placeholder="Bairro" />
                </div>
                <div>
                  <Label>Cidade *</Label>
                  <Input value={form.cidade} onChange={(ev) => update("cidade", ev.target.value)} placeholder="Cidade" />
                </div>
                <div>
                  <Label>UF *</Label>
                  <Input value={form.estado} onChange={(ev) => update("estado", ev.target.value)} placeholder="UF" maxLength={2} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={(ev) => update("cep", ev.target.value)} placeholder="Somente números" inputMode="numeric" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
