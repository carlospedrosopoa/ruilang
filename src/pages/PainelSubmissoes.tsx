import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileText, Plus, Copy, ExternalLink, Loader2, Clock, CheckCircle, FileCheck, Send, Trash2, Sparkles, Download, MoreHorizontal, ScrollText, Paperclip } from "lucide-react";
import { tiposContrato, TipoContrato } from "@/types/contract";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SubmissionDocumento = {
  id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  uploadedAt: string;
  categoria?: "escritura" | "contrato" | string;
  storagePath?: string;
};

interface Submission {
  id: string;
  token: string;
  tipo_contrato: string;
  corretor_id?: string | null;
  corretor_nome: string | null;
  corretor_telefone: string | null;
  dados: any;
  documentos?: SubmissionDocumento[] | null;
  proposta_texto?: string | null;
  proposta_gerada_em?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  imovel_id?: string | null;
  imobiliarias?: any;
}

interface Corretor {
  id: string;
  nome: string;
  creci: string | null;
  telefone: string | null;
  email: string | null;
}

interface CustomTipoContrato {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string;
  label_vendedor: string;
  label_comprador: string;
  modelo_base: string | null;
}

interface ImovelRef {
  id: string;
  titulo: string;
  dados: any;
  ativo: boolean;
}

const statusLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  rascunho: { label: "Rascunho", icon: Clock, color: "text-yellow-500" },
  enviado: { label: "Enviado", icon: CheckCircle, color: "text-green-500" },
  contrato_gerado: { label: "Contrato Gerado", icon: FileCheck, color: "text-primary" },
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

const PainelSubmissoes = () => {
  const navigate = useNavigate();
  const { activeTenantId, isPlatformAdmin, memberships } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoTipo, setNovoTipo] = useState<string>("promessa_compra_venda");
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [selectedCorretorId, setSelectedCorretorId] = useState<string | null>(null);
  const [imoveis, setImoveis] = useState<ImovelRef[]>([]);
  const [selectedImovelId, setSelectedImovelId] = useState<string | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalSubmissionId, setProposalSubmissionId] = useState<string | null>(null);
  const [proposalText, setProposalText] = useState<string>("");
  const [proposalDocs, setProposalDocs] = useState<SubmissionDocumento[]>([]);
  const [proposalImobiliaria, setProposalImobiliaria] = useState<any | null>(null);
  const escrituraInputRef = useRef<HTMLInputElement>(null);
  const [escrituraTarget, setEscrituraTarget] = useState<Submission | null>(null);
  const [escrituraUploadingForId, setEscrituraUploadingForId] = useState<string | null>(null);

  const [customTipos, setCustomTipos] = useState<CustomTipoContrato[]>([]);
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [editingTipo, setEditingTipo] = useState<CustomTipoContrato | null>(null);
  const [tipoNome, setTipoNome] = useState("");
  const [tipoDescricao, setTipoDescricao] = useState("");
  const [tipoLabelVendedor, setTipoLabelVendedor] = useState("Vendedor");
  const [tipoLabelComprador, setTipoLabelComprador] = useState("Comprador");
  const [tipoModeloBase, setTipoModeloBase] = useState("");
  const [savingTipo, setSavingTipo] = useState(false);

  const loadData = async () => {
    const subQuery = supabase.from("submissions").select("*, imobiliarias(*)").order("created_at", { ascending: false });

    if (!isPlatformAdmin && activeTenantId) {
      subQuery.eq("imobiliaria_id", activeTenantId);
    }

    const [subRes] = await Promise.all([subQuery]);
    setSubmissions((subRes.data as Submission[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeTenantId, isPlatformAdmin]);

  useEffect(() => {
    const loadCorretores = async () => {
      if (!activeTenantId) {
        setCorretores([]);
        setSelectedCorretorId(null);
        return;
      }
      const { data } = await supabase
        .from("corretores")
        .select("id, nome, creci, telefone, email")
        .eq("imobiliaria_id", activeTenantId)
        .order("nome");
      const list = (data as Corretor[]) || [];
      setCorretores(list);
      setSelectedCorretorId(list[0]?.id || null);
    };
    loadCorretores();
  }, [activeTenantId]);

  useEffect(() => {
    const loadImoveis = async () => {
      if (!activeTenantId) {
        setImoveis([]);
        setSelectedImovelId(null);
        return;
      }
      const { data, error } = await supabase
        .from("imoveis")
        .select("id, titulo, dados, ativo")
        .eq("imobiliaria_id", activeTenantId)
        .eq("ativo", true)
        .order("titulo");
      if (error) {
        setImoveis([]);
        setSelectedImovelId(null);
        return;
      }
      const list = (data as ImovelRef[]) || [];
      setImoveis(list);
      setSelectedImovelId(list[0]?.id || null);
    };
    loadImoveis();
  }, [activeTenantId]);

  useEffect(() => {
    const loadCustomTipos = async () => {
      if (!activeTenantId) {
        setCustomTipos([]);
        return;
      }
      const { data } = await supabase
        .from("tipos_contrato")
        .select("id, nome, descricao, icone, label_vendedor, label_comprador, modelo_base")
        .eq("imobiliaria_id", activeTenantId)
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      setCustomTipos((data as CustomTipoContrato[]) || []);
    };
    loadCustomTipos();
  }, [activeTenantId]);

  const allTipos = useMemo(() => {
    return [
      ...tiposContrato.map((t) => ({ id: t.id as string, nome: t.nome, descricao: t.descricao, icone: t.icone })),
      ...customTipos.map((t) => ({ id: t.id, nome: t.nome, descricao: t.descricao || "", icone: t.icone })),
    ];
  }, [customTipos]);

  const openCreateTipo = () => {
    setEditingTipo(null);
    setTipoNome("");
    setTipoDescricao("");
    setTipoLabelVendedor("Vendedor");
    setTipoLabelComprador("Comprador");
    setTipoModeloBase("");
    setTipoDialogOpen(true);
  };

  const openEditTipo = (ct: CustomTipoContrato) => {
    setEditingTipo(ct);
    setTipoNome(ct.nome);
    setTipoDescricao(ct.descricao || "");
    setTipoLabelVendedor(ct.label_vendedor || "Vendedor");
    setTipoLabelComprador(ct.label_comprador || "Comprador");
    setTipoModeloBase(ct.modelo_base || "");
    setTipoDialogOpen(true);
  };

  const saveTipo = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária para criar tipos.");
      return;
    }
    if (!tipoNome.trim()) {
      toast.error("Informe o nome do tipo de contrato.");
      return;
    }
    setSavingTipo(true);
    try {
      if (editingTipo) {
        const { data, error } = await supabase
          .from("tipos_contrato")
          .update({
            nome: tipoNome.trim(),
            descricao: tipoDescricao.trim() || null,
            label_vendedor: tipoLabelVendedor.trim() || "Vendedor",
            label_comprador: tipoLabelComprador.trim() || "Comprador",
            modelo_base: tipoModeloBase.trim() || null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", editingTipo.id)
          .select("id, nome, descricao, icone, label_vendedor, label_comprador, modelo_base")
          .single();
        if (error) throw error;
        setCustomTipos((prev) => prev.map((t) => (t.id === data.id ? (data as any) : t)));
        toast.success("Tipo de contrato atualizado!");
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id || null;
        const { data, error } = await supabase
          .from("tipos_contrato")
          .insert({
            imobiliaria_id: activeTenantId,
            nome: tipoNome.trim(),
            descricao: tipoDescricao.trim() || null,
            label_vendedor: tipoLabelVendedor.trim() || "Vendedor",
            label_comprador: tipoLabelComprador.trim() || "Comprador",
            modelo_base: tipoModeloBase.trim() || null,
            created_by: userId,
          } as any)
          .select("id, nome, descricao, icone, label_vendedor, label_comprador, modelo_base")
          .single();
        if (error) throw error;
        setCustomTipos((prev) => [...prev, data as any]);
        toast.success("Tipo de contrato criado!");
      }
      setTipoDialogOpen(false);
      setEditingTipo(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar tipo de contrato.");
    } finally {
      setSavingTipo(false);
    }
  };

  const deleteTipo = async (id: string) => {
    const { error } = await supabase.from("tipos_contrato").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir tipo de contrato.");
    else {
      setCustomTipos((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tipo de contrato excluído.");
    }
  };

  const handleCreateLink = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária/tenant para criar links.");
      return;
    }
    if (!selectedImovelId) {
      toast.error("Selecione um imóvel para gerar a coleta.");
      return;
    }
    setCreating(true);
    try {
      const corretor = corretores.find((c) => c.id === selectedCorretorId) || null;
      const imovelRef = imoveis.find((i) => i.id === selectedImovelId) || null;
      if (!imovelRef) {
        toast.error("Imóvel não encontrado. Recarregue a página e tente novamente.");
        return;
      }
      let imovelDados: any = imovelRef.dados;
      if (typeof imovelDados === "string") {
        try {
          imovelDados = JSON.parse(imovelDados);
        } catch {}
      }
      const { data, error } = await supabase
        .from("submissions")
        .insert({
          tipo_contrato: novoTipo,
          imobiliaria_id: activeTenantId,
          corretor_id: corretor?.id || null,
          corretor_nome: corretor?.nome || null,
          corretor_telefone: corretor?.telefone || null,
          imovel_id: imovelRef.id,
          dados: { imovel: imovelDados || {} } as any,
        } as any)
        .select()
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/coleta/${data.token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link criado e copiado!");
      setDialogOpen(false);
      loadData();
    } catch { toast.error("Erro ao criar link."); } finally { setCreating(false); }
  };

  const copyLink = (path: string, token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/${path}/${token}`);
    toast.success("Link copiado!");
  };

  const handleDeleteSubmission = async (id: string) => {
    const { error } = await supabase.from("submissions").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else { toast.success("Excluído!"); setSubmissions((prev) => prev.filter((s) => s.id !== id)); }
  };

  const handleGenerateContract = (submission: Submission) => {
    navigate(`/contrato/${submission.tipo_contrato}?submissionId=${submission.id}`);
  };

  const currentImobiliaria = useMemo(() => {
    if (!activeTenantId) return null;
    const m = memberships.find((x) => x.tenantId === activeTenantId);
    return m?.tenant || null;
  }, [activeTenantId, memberships]);

  const openProposalForSubmission = async (sub: Submission) => {
    setProposalSubmissionId(sub.id);
    setProposalText(sub.proposta_texto || "");
    const docs = Array.isArray(sub.documentos) ? (sub.documentos as SubmissionDocumento[]) : [];
    setProposalDocs(docs);
    setProposalImobiliaria(sub.imobiliarias || currentImobiliaria || null);
    setProposalOpen(true);
  };

  const openUploadEscritura = (sub: Submission) => {
    setEscrituraTarget(sub);
    escrituraInputRef.current?.click();
  };

  const handleUploadEscritura = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!escrituraTarget || files.length === 0) return;
    const target = escrituraTarget;
    setEscrituraUploadingForId(target.id);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;

      const { data: fresh, error: freshErr } = await supabase
        .from("submissions")
        .select("documentos, imovel_id")
        .eq("id", target.id)
        .single();
      if (freshErr) throw freshErr;

      const existingDocs = Array.isArray((fresh as any)?.documentos) ? ((fresh as any).documentos as any[]) : [];
      const nextDocs: any[] = [...existingDocs];
      const imovelId = (fresh as any)?.imovel_id as string | null;
      const nowIso = new Date().toISOString();
      const imovelRows: any[] = [];

      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} excede 20MB`);
          continue;
        }
        const safeName = safeStorageFileName(file.name);
        const storagePath = `submissions/${target.id}/escritura/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("proposta-docs").upload(storagePath, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("proposta-docs").getPublicUrl(storagePath);
        const url = urlData.publicUrl;

        const doc: SubmissionDocumento = {
          id: crypto.randomUUID(),
          nome: file.name,
          tipo: file.type || null,
          tamanho: file.size,
          url,
          uploadedAt: nowIso,
          categoria: "escritura",
          storagePath,
        };
        nextDocs.push(doc as any);

        if (imovelId) {
          imovelRows.push({
            imovel_id: imovelId,
            titulo: `Escritura - ${file.name}`.slice(0, 180),
            nome_arquivo: file.name,
            storage_path: storagePath,
            tipo: file.type || null,
            tamanho: file.size,
            url,
            uploaded_by: userId,
          });
        }
      }

      const { error: updErr } = await supabase
        .from("submissions")
        .update({ documentos: nextDocs } as any)
        .eq("id", target.id);
      if (updErr) throw updErr;

      if (imovelRows.length > 0) {
        const { error: imErr } = await supabase.from("imovel_documentos").insert(imovelRows as any);
        if (imErr) throw imErr;
      }

      toast.success("Escritura anexada.");
      setProposalDocs(nextDocs as any);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao anexar escritura.");
    } finally {
      setEscrituraUploadingForId(null);
      if (escrituraInputRef.current) escrituraInputRef.current.value = "";
    }
  };

  const generateProposalForSubmission = async (sub: Submission) => {
    setProposalSubmissionId(sub.id);
    setProposalText(sub.proposta_texto || "");
    setProposalOpen(true);
    setProposalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: {
          dados: sub.dados,
          tipoContrato: sub.tipo_contrato,
          imobiliaria: sub.imobiliarias || currentImobiliaria || null,
          imobiliariaId: (sub as any).imobiliaria_id || activeTenantId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const proposta = String(data.proposta || "");
      if (!proposta) throw new Error("Proposta vazia.");

      await supabase.from("submissions").update({
        proposta_texto: proposta,
        proposta_gerada_em: new Date().toISOString(),
      } as any).eq("id", sub.id);

      setProposalText(proposta);
      toast.success("Proposta gerada e salva na coleta.");
      await loadData();
    } catch (e: any) {
      let message = e?.message;
      const ctx = e?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) message = body.error;
        } catch {}
      }
      toast.error(message || "Erro ao gerar proposta.");
    } finally {
      setProposalLoading(false);
    }
  };

  const copyProposal = async () => {
    if (!proposalText) return;
    await navigator.clipboard.writeText(proposalText);
    toast.success("Proposta copiada!");
  };

  const downloadProposal = () => {
    if (!proposalText) return;
    const blob = new Blob([proposalText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadProposalPdf = () => {
    if (!proposalText) return;

    const imob = proposalImobiliaria || null;
    const nome = typeof imob?.nome === "string" ? imob.nome.trim() : "";
    const creci = typeof imob?.creci === "string" ? imob.creci.trim() : "";
    const logoUrl = typeof imob?.logo_url === "string" ? imob.logo_url.trim() : "";
    const site = typeof imob?.site_url === "string" ? imob.site_url.trim() : "";
    const whatsapp = typeof imob?.whatsapp_atendimento === "string" ? imob.whatsapp_atendimento.trim() : "";
    const endereco = [imob?.endereco, imob?.numero ? `nº ${imob.numero}` : "", imob?.bairro, imob?.cidade && imob?.estado ? `${imob.cidade}/${imob.estado}` : ""]
      .filter((x: any) => typeof x === "string" && x.trim())
      .map((x: string) => x.trim())
      .join(" • ");

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const title = "Proposta de Negócio";
    const textHtml = escapeHtml(proposalText).replace(/\n/g, "<br/>");

    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      html, body { padding: 0; margin: 0; background: #ffffff; color: #0b1220; font-family: Inter, Arial, sans-serif; }
      .header { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 10px; margin-bottom: 16px; }
      .logo { height: 44px; width: auto; object-fit: contain; }
      .brand { display: flex; flex-direction: column; gap: 2px; }
      .brand .name { font-size: 14px; font-weight: 700; letter-spacing: 0.2px; }
      .brand .meta { font-size: 11px; color: rgba(11,18,32,0.72); line-height: 1.4; }
      .doc-title { font-size: 15px; font-weight: 800; margin: 0 0 10px 0; }
      .content { font-size: 12px; line-height: 1.6; white-space: normal; }
      .content pre { margin: 0; font-family: inherit; white-space: pre-wrap; }
      .footer { margin-top: 14px; font-size: 10px; color: rgba(11,18,32,0.6); }
    </style>
  </head>
  <body>
    <div class="header">
      ${logoUrl ? `<img id="pactadocLogo" class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(nome || "Logo")}" crossorigin="anonymous" referrerpolicy="no-referrer" />` : ""}
      <div class="brand">
        <div class="name">${escapeHtml(nome || "Imobiliária")}${creci ? ` • CRECI ${escapeHtml(creci)}` : ""}</div>
        <div class="meta">${escapeHtml(endereco || "")}${(site || whatsapp) ? `${endereco ? "<br/>" : ""}${escapeHtml([site ? `Site: ${site}` : "", whatsapp ? `WhatsApp: ${whatsapp}` : ""].filter(Boolean).join(" • "))}` : ""}</div>
      </div>
    </div>
    <h1 class="doc-title">${escapeHtml(title)}</h1>
    <div class="content"><pre>${textHtml}</pre></div>
    <div class="footer">Gerado em ${new Date().toLocaleDateString("pt-BR")}.</div>
    <script>
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const waitLogo = () =>
        new Promise((resolve) => {
          const img = document.getElementById("pactadocLogo");
          if (!img) return resolve();
          if (img.complete && img.naturalWidth > 0) return resolve();
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });

      window.onload = async () => {
        try {
          await Promise.race([waitLogo(), sleep(1800)]);
          if (document.fonts && document.fonts.ready) {
            await Promise.race([document.fonts.ready, sleep(800)]);
          }
          await sleep(150);
          window.focus();
          requestAnimationFrame(() => window.print());
        } catch {
          window.focus();
          window.print();
        }
      };
      window.onafterprint = () => {
        setTimeout(() => window.close(), 200);
      };
    </script>
  </body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Não foi possível abrir a janela do PDF. Verifique o bloqueador de pop-up.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <input
        ref={escrituraInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleUploadEscritura}
      />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-bold text-foreground">Coletas</h2>
        </div>

        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Nova Coleta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Coleta</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Tipo de Contrato</Label>
                  <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allTipos.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" className="px-0" onClick={openCreateTipo}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Criar Novo Tipo de Contrato
                    </Button>
                    {customTipos.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="px-0"
                        onClick={() => {
                          const ct = customTipos.find((x) => x.id === novoTipo);
                          if (ct) openEditTipo(ct);
                          else toast.error("Selecione um tipo personalizado para editar.");
                        }}
                      >
                        Editar Tipo Selecionado
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <Label>Imóvel *</Label>
                  {imoveis.length === 0 ? (
                    <div className="mt-2 border border-dashed border-border rounded-lg p-3 text-sm text-muted-foreground">
                      Nenhum imóvel cadastrado. Cadastre um imóvel para gerar coletas.
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDialogOpen(false);
                            navigate("/imoveis");
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Cadastrar Imóvel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Select value={selectedImovelId || ""} onValueChange={(v) => setSelectedImovelId(v || null)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {imoveis.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.titulo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Corretor</Label>
                  <Select value={selectedCorretorId || ""} onValueChange={(v) => setSelectedCorretorId(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {corretores.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateLink} disabled={creating || imoveis.length === 0} className="w-full">
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Criar e Copiar Link
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto" />
          <h3 className="font-display text-xl font-bold text-foreground">Nenhuma coleta ainda</h3>
          <p className="text-muted-foreground">Crie uma coleta para enviar ao corretor.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="whitespace-nowrap">Criado em</TableHead>
                  <TableHead className="text-right w-[420px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => {
                  const tipoInfo = allTipos.find((t) => t.id === sub.tipo_contrato);
                  const statusInfo = statusLabels[sub.status] || statusLabels.rascunho;
                  const StatusIcon = statusInfo.icon;
                  const hasProposal = Boolean(sub.proposta_texto && String(sub.proposta_texto).trim());
                  const im = sub?.dados?.imovel;
                  const imLocalizacao = typeof im?.localizacao === "string" ? im.localizacao.trim() : "";
                  const imCidade = typeof im?.municipio === "string" ? im.municipio.trim() : "";
                  const imUf = typeof im?.estadoImovel === "string" ? im.estadoImovel.trim() : "";
                  const imLabel = imLocalizacao || (imCidade ? `${imCidade}${imUf ? `/${imUf}` : ""}` : "—");

                  const badgeClass =
                    sub.status === "enviado"
                      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
                      : sub.status === "rascunho"
                        ? "bg-amber-400/15 text-amber-100 border-amber-300/50 shadow-[0_0_18px_rgba(250,204,21,0.25)]"
                        : "bg-muted/30 text-foreground border-border";

                  return (
                    <TableRow key={sub.id} className="hover:bg-white/5">
                      <TableCell className="py-5">
                        <Badge variant="outline" className={`gap-1.5 ${badgeClass}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="font-medium text-foreground">{tipoInfo?.nome || sub.tipo_contrato}</div>
                        <div className="text-xs text-muted-foreground">ID: {sub.id}</div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="text-sm text-foreground">{imLabel}</div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="text-sm text-foreground">
                          {sub.corretor_nome || "—"}
                        </div>
                        {sub.corretor_telefone ? (
                          <div className="text-xs text-muted-foreground">{sub.corretor_telefone}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-5 whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(sub.created_at)}
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {sub.status === "enviado" && hasProposal ? (
                            <Button size="sm" onClick={() => openProposalForSubmission(sub)}>
                              <FileText className="w-4 h-4 mr-1.5" />
                              Ver Proposta
                            </Button>
                          ) : null}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem
                                onClick={() => {
                                  const link = `${window.location.origin}/coleta/${sub.token}`;
                                  const msg = encodeURIComponent(
                                    `Olá! Segue o link para preenchimento dos dados do contrato (${tipoInfo?.nome}):\n\n${link}\n\nPreencha todos os campos e clique em "Enviar Dados" ao final.`,
                                  );
                                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                                }}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyLink("coleta", sub.token)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copiar link
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem onClick={() => window.open(`/coleta/${sub.token}`, "_blank")}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir coleta
                              </DropdownMenuItem>

                              {sub.status === "enviado" ? (
                                <>
                                  <DropdownMenuItem onClick={() => generateProposalForSubmission(sub)}>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Gerar proposta
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleGenerateContract(sub)}>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Gerar contrato
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openUploadEscritura(sub)}
                                    disabled={escrituraUploadingForId === sub.id}
                                  >
                                    {escrituraUploadingForId === sub.id ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <ScrollText className="w-4 h-4 mr-2" />
                                    )}
                                    Anexar escritura
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => openUploadEscritura(sub)}
                                  disabled={escrituraUploadingForId === sub.id}
                                >
                                  {escrituraUploadingForId === sub.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <ScrollText className="w-4 h-4 mr-2" />
                                  )}
                                  Anexar escritura
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteSubmission(sub.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={proposalOpen} onOpenChange={setProposalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposta (Coleta)</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              {proposalSubmissionId ? `Coleta: ${proposalSubmissionId}` : ""}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyProposal} disabled={!proposalText}>
                <Copy className="w-4 h-4 mr-1" />Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={downloadProposal} disabled={!proposalText}>
                <Download className="w-4 h-4 mr-1" />Baixar
              </Button>
              <Button variant="outline" size="sm" onClick={downloadProposalPdf} disabled={!proposalText}>
                <Download className="w-4 h-4 mr-1" />PDF
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">Anexos</div>
              {proposalSubmissionId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const sub = submissions.find((s) => s.id === proposalSubmissionId) || null;
                    if (sub) openUploadEscritura(sub);
                  }}
                  disabled={!proposalSubmissionId}
                >
                  <Paperclip className="w-4 h-4 mr-1" />
                  Anexar escritura
                </Button>
              ) : null}
            </div>
            {proposalDocs.length === 0 ? (
              <div className="mt-2 text-sm text-muted-foreground border border-white/10 rounded-lg bg-white/5 backdrop-blur-md p-3">
                Nenhum anexo ainda.
              </div>
            ) : (
              <div className="mt-2 grid gap-2">
                {proposalDocs.map((d) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md px-3 py-2 hover:bg-white/10"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">{d.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {(d.categoria || "documento").toString().toUpperCase()} • {new Date(d.uploadedAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 border border-border rounded-lg bg-muted/20 max-h-[50vh] overflow-auto p-3">
            {proposalLoading ? (
              <div className="py-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-foreground">{proposalText || "Nenhuma proposta gerada ainda."}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={tipoDialogOpen} onOpenChange={setTipoDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingTipo ? "Editar Tipo de Contrato" : "Criar Tipo de Contrato"}</DialogTitle>
            <DialogDescription>
              Define um novo tipo de contrato para a imobiliária atual. Opcionalmente cole um modelo base para manter a minuta consistente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={tipoNome} onChange={(e) => setTipoNome(e.target.value)} placeholder="Ex: Contrato de Arrendamento" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={tipoDescricao} onChange={(e) => setTipoDescricao(e.target.value)} placeholder="Breve descrição" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Label do Vendedor</Label>
                <Input value={tipoLabelVendedor} onChange={(e) => setTipoLabelVendedor(e.target.value)} placeholder="Ex: Cedente" />
              </div>
              <div>
                <Label>Label do Comprador</Label>
                <Input value={tipoLabelComprador} onChange={(e) => setTipoLabelComprador(e.target.value)} placeholder="Ex: Cessionário" />
              </div>
            </div>
            <div>
              <Label>Modelo Base (opcional)</Label>
              <Textarea
                value={tipoModeloBase}
                onChange={(e) => setTipoModeloBase(e.target.value)}
                className="min-h-[220px]"
                placeholder="Cole aqui o texto do contrato base (sem peculiaridades)."
              />
            </div>
            {editingTipo ? (
              <div className="flex justify-between items-center">
                <Button variant="destructive" onClick={() => deleteTipo(editingTipo.id)}>
                  Excluir
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setTipoDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={saveTipo} disabled={savingTipo}>
                    {savingTipo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <DialogFooter>
                <Button variant="outline" onClick={() => setTipoDialogOpen(false)}>Cancelar</Button>
                <Button onClick={saveTipo} disabled={savingTipo}>
                  {savingTipo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Criar
                </Button>
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PainelSubmissoes;
