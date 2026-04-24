import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Home, Loader2, Paperclip, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import StepObjeto from "@/components/contract/StepObjeto";
import { criarImovelVazio, Imovel } from "@/types/contract";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { fileToVisionBase64Images } from "@/lib/imageUtils";

type ImovelRow = {
  id: string;
  imobiliaria_id: string;
  titulo: string;
  dados: any;
  ativo: boolean;
  vendedor_cliente_id?: string | null;
  created_at: string;
  updated_at: string;
};

type VendedorForm = {
  nome_completo: string;
  cpf: string;
  documento_tipo: string;
  documento_numero: string;
  email: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

function criarVendedorVazio(): VendedorForm {
  return {
    nome_completo: "",
    cpf: "",
    documento_tipo: "",
    documento_numero: "",
    email: "",
    telefone: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
  };
}

function safeImovelFromRow(row: ImovelRow): Imovel {
  const raw = row?.dados;
  if (raw && typeof raw === "object") return raw as Imovel;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Imovel;
    } catch {}
  }
  return criarImovelVazio();
}

function extractCityUf(imovel: any) {
  const cidade = typeof imovel?.municipio === "string" ? imovel.municipio.trim() : "";
  const uf = typeof imovel?.estadoImovel === "string" ? imovel.estadoImovel.trim() : "";
  return cidade && uf ? `${cidade}/${uf}` : cidade || uf || "—";
}

type ImovelDocumentoRow = {
  id: string;
  imovel_id: string;
  titulo: string;
  nome_arquivo: string;
  storage_path: string;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  uploaded_at: string;
};

type ClienteDocumentoRow = {
  id: string;
  cliente_id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  uploaded_at: string | null;
};

function sanitizeForPath(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function safeStorageFileName(originalName: string) {
  const name = String(originalName || "").trim();
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const safeBase = sanitizeForPath(base) || "arquivo";
  const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext.toLowerCase() : "";
  return `${safeBase}${safeExt}`.slice(0, 120);
}

type DocContext = "imovel" | "vendedor";

type StagedDoc = {
  id: string;
  context: DocContext;
  title: string;
  file: File;
};

const ImoveisPage = () => {
  const { activeTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [imoveis, setImoveis] = useState<ImovelRow[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [imovel, setImovel] = useState<Imovel>(criarImovelVazio());
  const [ativo, setAtivo] = useState(true);
  const [vendedor, setVendedor] = useState<VendedorForm>(criarVendedorVazio());
  const [vendedorClienteId, setVendedorClienteId] = useState<string | null>(null);

  const [documentos, setDocumentos] = useState<ImovelDocumentoRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [vendedorDocs, setVendedorDocs] = useState<ClienteDocumentoRow[]>([]);
  const [vendedorDocsLoading, setVendedorDocsLoading] = useState(false);
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docUploading, setDocUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>([]);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [docContext, setDocContext] = useState<DocContext>("imovel");
  const [quickDocsOpen, setQuickDocsOpen] = useState(false);
  const [quickDocsImovel, setQuickDocsImovel] = useState<{ id: string; titulo: string } | null>(null);
  const [quickDocs, setQuickDocs] = useState<ImovelDocumentoRow[]>([]);
  const [quickDocsLoading, setQuickDocsLoading] = useState(false);

  const uploadDocumentoToImovelAndMaybeCliente = async (args: {
    imovelId: string;
    title: string;
    file: File;
    userId: string | null;
    clienteIdToLink?: string | null;
  }) => {
    const safeTitle = sanitizeForPath(args.title);
    const safeName = safeStorageFileName(args.file.name);
    const filePath = `imoveis/${args.imovelId}/${Date.now()}_${safeTitle}_${safeName}`;

    const upload = await supabase.storage.from("proposta-docs").upload(filePath, args.file);
    if (upload.error) throw upload.error;

    const { data: urlData } = supabase.storage.from("proposta-docs").getPublicUrl(filePath);

    const { error: insError } = await supabase.from("imovel_documentos").insert({
      imovel_id: args.imovelId,
      titulo: args.title,
      nome_arquivo: args.file.name,
      storage_path: filePath,
      tipo: args.file.type || null,
      tamanho: args.file.size,
      url: urlData.publicUrl,
      uploaded_at: new Date().toISOString(),
      uploaded_by: args.userId,
    } as any);
    if (insError) throw insError;

    if (args.clienteIdToLink) {
      const { error: cErr } = await supabase.from("cliente_documentos").upsert(
        {
          cliente_id: args.clienteIdToLink,
          nome: args.title,
          tipo: args.file.type || null,
          tamanho: args.file.size,
          url: urlData.publicUrl,
          uploaded_at: new Date().toISOString(),
        } as any,
        { onConflict: "cliente_id,url" },
      );
      if (cErr) throw cErr;
    }
  };

  const load = async () => {
    if (!activeTenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("imoveis")
      .select("id, imobiliaria_id, titulo, dados, ativo, vendedor_cliente_id, created_at, updated_at")
      .eq("imobiliaria_id", activeTenantId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message || "Erro ao carregar imóveis.");
      setImoveis([]);
    } else {
      setImoveis((data as ImovelRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeTenantId]);

  const loadDocs = async (imovelId: string) => {
    setDocsLoading(true);
    const { data, error } = await supabase
      .from("imovel_documentos")
      .select("id, imovel_id, titulo, nome_arquivo, storage_path, tipo, tamanho, url, uploaded_at")
      .eq("imovel_id", imovelId)
      .order("uploaded_at", { ascending: false });
    if (error) {
      setDocumentos([]);
      toast.error(error.message || "Erro ao carregar anexos do imóvel.");
    } else {
      setDocumentos((data as ImovelDocumentoRow[]) || []);
    }
    setDocsLoading(false);
  };

  const loadQuickDocs = async (imovelId: string) => {
    setQuickDocsLoading(true);
    const { data, error } = await supabase
      .from("imovel_documentos")
      .select("id, imovel_id, titulo, nome_arquivo, storage_path, tipo, tamanho, url, uploaded_at")
      .eq("imovel_id", imovelId)
      .order("uploaded_at", { ascending: false });
    if (error) {
      setQuickDocs([]);
      toast.error(error.message || "Erro ao carregar anexos do imóvel.");
    } else {
      setQuickDocs((data as ImovelDocumentoRow[]) || []);
    }
    setQuickDocsLoading(false);
  };

  const openQuickDocs = (row: ImovelRow) => {
    setQuickDocsImovel({ id: row.id, titulo: row.titulo });
    setQuickDocsOpen(true);
    loadQuickDocs(row.id);
  };

  const loadVendedor = async (clienteId: string | null) => {
    if (!clienteId) {
      setVendedor(criarVendedorVazio());
      return;
    }
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome_completo, cpf, documento_tipo, documento_numero, email, telefone, endereco, bairro, cidade, estado, cep")
      .eq("id", clienteId)
      .single();
    if (error || !data) {
      setVendedor(criarVendedorVazio());
      return;
    }
    setVendedor({
      nome_completo: data.nome_completo || "",
      cpf: data.cpf || "",
      documento_tipo: data.documento_tipo || "",
      documento_numero: data.documento_numero || "",
      email: data.email || "",
      telefone: data.telefone || "",
      endereco: data.endereco || "",
      bairro: data.bairro || "",
      cidade: data.cidade || "",
      estado: data.estado || "",
      cep: data.cep || "",
    });
  };

  const loadVendedorDocs = async (clienteId: string | null) => {
    if (!clienteId) {
      setVendedorDocs([]);
      return;
    }
    setVendedorDocsLoading(true);
    const { data, error } = await supabase
      .from("cliente_documentos")
      .select("id, cliente_id, nome, tipo, tamanho, url, uploaded_at")
      .eq("cliente_id", clienteId)
      .order("uploaded_at", { ascending: false, nullsFirst: false });
    if (error) {
      setVendedorDocs([]);
      toast.error(error.message || "Erro ao carregar anexos do vendedor.");
    } else {
      setVendedorDocs((data as ClienteDocumentoRow[]) || []);
    }
    setVendedorDocsLoading(false);
  };

  const openNew = () => {
    setEditingId(null);
    setTitulo("");
    setImovel(criarImovelVazio());
    setAtivo(true);
    setDocumentos([]);
    setVendedor(criarVendedorVazio());
    setVendedorClienteId(null);
    setVendedorDocs([]);
    setStagedDocs([]);
    setDialogOpen(true);
  };

  const openEdit = (row: ImovelRow) => {
    setEditingId(row.id);
    setTitulo(row.titulo || "");
    setImovel(safeImovelFromRow(row));
    setAtivo(Boolean(row.ativo));
    loadDocs(row.id);
    const clienteId = row.vendedor_cliente_id || null;
    setVendedorClienteId(clienteId);
    loadVendedor(clienteId);
    loadVendedorDocs(clienteId);
    setStagedDocs([]);
    setDialogOpen(true);
  };

  const upsertVendedorCliente = async () => {
    if (!activeTenantId) throw new Error("Selecione uma imobiliária.");
    const nome = vendedor.nome_completo.trim();
    if (!nome) throw new Error("Informe o nome do vendedor.");

    const payload = {
      vendedor: {
        nome_completo: nome,
        cpf: vendedor.cpf.trim(),
        documento_tipo: vendedor.documento_tipo.trim(),
        documento_numero: vendedor.documento_numero.trim(),
        email: vendedor.email.trim(),
        telefone: vendedor.telefone.trim(),
        endereco: vendedor.endereco.trim(),
        bairro: vendedor.bairro.trim(),
        cidade: vendedor.cidade.trim(),
        estado: vendedor.estado.trim(),
        cep: vendedor.cep.trim(),
      },
    };

    if (vendedorClienteId) {
      const { data, error } = await supabase
        .from("clientes")
        .update({
          nome_completo: nome,
          cpf: vendedor.cpf.trim() || null,
          documento_tipo: vendedor.documento_tipo.trim() || null,
          documento_numero: vendedor.documento_numero.trim() || null,
          email: vendedor.email.trim() || null,
          telefone: vendedor.telefone.trim() || null,
          endereco: vendedor.endereco.trim() || null,
          bairro: vendedor.bairro.trim() || null,
          cidade: vendedor.cidade.trim() || null,
          estado: vendedor.estado.trim() || null,
          cep: vendedor.cep.trim() || null,
          payload: payload as any,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", vendedorClienteId)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    }

    const cpf = vendedor.cpf.trim();
    if (cpf) {
      const { data } = await supabase
        .from("clientes")
        .select("id")
        .eq("imobiliaria_id", activeTenantId)
        .eq("cpf", cpf)
        .limit(1);
      const existingId = (data as any[])?.[0]?.id as string | undefined;
      if (existingId) {
        const { error } = await supabase
          .from("clientes")
          .update({
            nome_completo: nome,
            email: vendedor.email.trim() || null,
            telefone: vendedor.telefone.trim() || null,
            endereco: vendedor.endereco.trim() || null,
            bairro: vendedor.bairro.trim() || null,
            cidade: vendedor.cidade.trim() || null,
            estado: vendedor.estado.trim() || null,
            cep: vendedor.cep.trim() || null,
            payload: payload as any,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existingId);
        if (error) throw error;
        setVendedorClienteId(existingId);
        return existingId;
      }
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        imobiliaria_id: activeTenantId,
        tipo_pessoa: "vendedor",
        nome_completo: nome,
        cpf: vendedor.cpf.trim() || null,
        documento_tipo: vendedor.documento_tipo.trim() || null,
        documento_numero: vendedor.documento_numero.trim() || null,
        email: vendedor.email.trim() || null,
        telefone: vendedor.telefone.trim() || null,
        endereco: vendedor.endereco.trim() || null,
        bairro: vendedor.bairro.trim() || null,
        cidade: vendedor.cidade.trim() || null,
        estado: vendedor.estado.trim() || null,
        cep: vendedor.cep.trim() || null,
        payload: payload as any,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    setVendedorClienteId(data.id);
    return data.id as string;
  };

  const save = async () => {
    if (!activeTenantId) {
      toast.error("Selecione uma imobiliária.");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Informe um título para o imóvel.");
      return;
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;
      const clienteId = await upsertVendedorCliente();

      if (editingId) {
        const { data, error } = await supabase
          .from("imoveis")
          .update({
            titulo: titulo.trim(),
            dados: imovel as any,
            ativo,
            updated_at: new Date().toISOString(),
            updated_by: userId,
            vendedor_cliente_id: clienteId,
          } as any)
          .eq("id", editingId)
          .select("id, imobiliaria_id, titulo, dados, ativo, vendedor_cliente_id, created_at, updated_at")
          .single();
        if (error) throw error;
        setImoveis((prev) => prev.map((i) => (i.id === editingId ? (data as any) : i)));
        setVendedorClienteId(clienteId);
        if (stagedDocs.length > 0) {
          for (const doc of stagedDocs) {
            await uploadDocumentoToImovelAndMaybeCliente({
              imovelId: editingId,
              title: doc.title,
              file: doc.file,
              userId,
              clienteIdToLink: doc.context === "vendedor" ? clienteId : null,
            });
          }
          setStagedDocs([]);
          await loadDocs(editingId);
        }
        await loadVendedorDocs(clienteId);
        toast.success("Imóvel atualizado!");
      } else {
        const { data, error } = await supabase
          .from("imoveis")
          .insert({
            imobiliaria_id: activeTenantId,
            titulo: titulo.trim(),
            dados: imovel as any,
            ativo,
            created_by: userId,
            updated_by: userId,
            vendedor_cliente_id: clienteId,
          } as any)
          .select("id, imobiliaria_id, titulo, dados, ativo, vendedor_cliente_id, created_at, updated_at")
          .single();
        if (error) throw error;
        setImoveis((prev) => [data as any, ...prev]);
        setEditingId(data.id);
        setVendedorClienteId(clienteId);
        if (stagedDocs.length > 0) {
          for (const doc of stagedDocs) {
            await uploadDocumentoToImovelAndMaybeCliente({
              imovelId: data.id,
              title: doc.title,
              file: doc.file,
              userId,
              clienteIdToLink: doc.context === "vendedor" ? clienteId : null,
            });
          }
          setStagedDocs([]);
        }
        await loadDocs(data.id);
        await loadVendedorDocs(clienteId);
        toast.success("Imóvel cadastrado!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar imóvel.");
    } finally {
      setSaving(false);
    }
  };

  const openAddDocumento = (context: DocContext) => {
    setDocContext(context);
    docFileInputRef.current?.click();
  };

  const handlePickDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPendingFiles(files);
    setDocTitle("");
    setDocUploadOpen(true);
    if (docFileInputRef.current) docFileInputRef.current.value = "";
  };

  const mergeVendedorFromExtract = (dados: any) => {
    if (!dados || typeof dados !== "object") return;
    setVendedor((prev) => {
      const next = { ...prev };
      const map: Record<string, keyof VendedorForm> = {
        nome: "nome_completo",
        cpf: "cpf",
        documentoTipo: "documento_tipo",
        documentoNumero: "documento_numero",
        email: "email",
        telefone: "telefone",
        endereco: "endereco",
        bairro: "bairro",
        cidade: "cidade",
        estado: "estado",
        cep: "cep",
      };
      for (const [k, v] of Object.entries(map)) {
        const raw = (dados as any)[k];
        if (typeof raw === "string" && raw.trim()) {
          (next as any)[v] = raw.trim();
        }
      }
      return next;
    });
  };

  const uploadCurrentDocumento = async () => {
    const file = pendingFiles[0];
    if (!file) return;
    const title = docTitle.trim();
    if (!title) {
      toast.error("Informe um título para o documento.");
      return;
    }

    setDocUploading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || null;

      if (docContext === "vendedor") {
        try {
          const images = await fileToVisionBase64Images(file);
          const { data, error } = await supabase.functions.invoke("extract-document", {
            body: { images, ai: { provider: "openai" } },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          mergeVendedorFromExtract(data.dados);
          toast.success("Dados do vendedor extraídos. Verifique e complete os campos.");
        } catch (err: any) {
          let message = err?.message;
          const ctx = err?.context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = await ctx.json();
              if (body?.error) message = body.error;
            } catch {}
          }
          toast.error(message || "Erro ao extrair dados do vendedor.");
        }
      }

      if (!editingId) {
        setStagedDocs((prev) => [
          ...prev,
          { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, context: docContext, title, file },
        ]);
        toast.success("Documento adicionado. Salve o imóvel para enviar.");
      } else {
        if (docContext === "vendedor" && !vendedorClienteId) {
          setStagedDocs((prev) => [
            ...prev,
            { id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, context: docContext, title, file },
          ]);
          toast.success("Documento do vendedor adicionado. Salve o imóvel para vincular o vendedor e enviar.");
        } else {
          await uploadDocumentoToImovelAndMaybeCliente({
            imovelId: editingId,
            title,
            file,
            userId,
            clienteIdToLink: docContext === "vendedor" ? vendedorClienteId : null,
          });
          toast.success("Documento anexado ao imóvel.");
          await loadDocs(editingId);
          if (docContext === "vendedor") {
            await loadVendedorDocs(vendedorClienteId);
          }
        }
      }

      const rest = pendingFiles.slice(1);
      setPendingFiles(rest);
      setDocTitle("");
      if (rest.length === 0) setDocUploadOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao anexar documento.");
    } finally {
      setDocUploading(false);
    }
  };

  const removeDocumento = async (doc: ImovelDocumentoRow) => {
    const ok = window.confirm(`Excluir o anexo "${doc.titulo}"?`);
    if (!ok) return;
    try {
      const { count: imovelRefs } = await supabase
        .from("imovel_documentos")
        .select("id", { count: "exact", head: true })
        .eq("storage_path", doc.storage_path);
      const { count: clienteRefs } = await supabase
        .from("cliente_documentos")
        .select("id", { count: "exact", head: true })
        .eq("url", doc.url);
      let submissionRefs = 0;
      try {
        const { count } = await supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .contains("documentos", [{ url: doc.url }] as any);
        submissionRefs = count || 0;
      } catch {
        submissionRefs = 0;
      }

      const { error } = await supabase.from("imovel_documentos").delete().eq("id", doc.id);
      if (error) throw error;
      const safeToDeleteFile = (imovelRefs || 0) <= 1 && (clienteRefs || 0) === 0 && submissionRefs === 0;
      if (safeToDeleteFile && doc.storage_path) {
        await supabase.storage.from("proposta-docs").remove([doc.storage_path]);
      }
      setDocumentos((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Anexo excluído.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir anexo.");
    }
  };

  const remove = async (row: ImovelRow) => {
    const ok = window.confirm(`Excluir o imóvel "${row.titulo}"?`);
    if (!ok) return;
    const { error } = await supabase.from("imoveis").delete().eq("id", row.id);
    if (error) toast.error(error.message || "Erro ao excluir imóvel.");
    else {
      setImoveis((prev) => prev.filter((i) => i.id !== row.id));
      toast.success("Imóvel excluído!");
    }
  };

  const removeVendedorDocumento = async (doc: ClienteDocumentoRow) => {
    const ok = window.confirm(`Excluir o anexo "${doc.nome}" do vendedor?`);
    if (!ok) return;
    try {
      const { error } = await supabase.from("cliente_documentos").delete().eq("id", doc.id);
      if (error) throw error;
      setVendedorDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success("Anexo do vendedor excluído.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir anexo do vendedor.");
    }
  };

  const displayFileFromUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname || "";
      const last = path.split("/").filter(Boolean).slice(-1)[0] || "";
      return decodeURIComponent(last) || url;
    } catch {
      return url;
    }
  };

  const rows = useMemo(() => {
    return imoveis.map((r) => {
      const d = safeImovelFromRow(r);
      return {
        ...r,
        _imovel: d,
        _local: extractCityUf(d),
      };
    });
  }, [imoveis]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Imóveis</h1>
          <p className="text-muted-foreground">Cadastre imóveis para gerar coletas a partir deles.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Imóvel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Home className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum imóvel cadastrado.</p>
          <Button variant="outline" className="mt-4" onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" />
            Cadastrar Primeiro
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[108px]">Ações</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openQuickDocs(r)}>
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(r)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {r.titulo}
                      <div className="text-xs text-muted-foreground mt-1">{r._imovel?.localizacao || "—"}</div>
                    </TableCell>
                    <TableCell>{r._local}</TableCell>
                    <TableCell className="capitalize">{r._imovel?.tipo || "—"}</TableCell>
                    <TableCell>{r._imovel?.matricula || "—"}</TableCell>
                    <TableCell>
                      {r.ativo ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog
        open={quickDocsOpen}
        onOpenChange={(o) => {
          setQuickDocsOpen(o);
          if (!o) {
            setQuickDocsImovel(null);
            setQuickDocs([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Anexos do imóvel{quickDocsImovel ? ` — ${quickDocsImovel.titulo}` : ""}</DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            {quickDocsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : quickDocs.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-white/10 rounded-lg bg-white/5 backdrop-blur-md p-4">
                Nenhum anexo disponível para este imóvel.
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden shadow-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5 hover:bg-white/5">
                      <TableHead>Título</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead className="whitespace-nowrap">Enviado em</TableHead>
                      <TableHead className="text-right w-[90px]">Abrir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quickDocs.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-foreground">{d.titulo}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span className="truncate max-w-[360px]">{d.nome_arquivo || displayFileFromUrl(d.url)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(d.uploaded_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon">
                            <a href={d.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Imóvel" : "Novo Imóvel"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <Label>Título *</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Terreno Balneário São Jorge - Lote 19" />
              </div>
              <div className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-foreground">Ativo</div>
                  <div className="text-xs text-muted-foreground">Disponível para gerar coletas</div>
                </div>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>

            <StepObjeto imovel={imovel} onChange={setImovel} />

            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-foreground">Anexos do imóvel</div>
                  <div className="text-xs text-muted-foreground">Documentos e fotos vinculados a este imóvel (com título).</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openAddDocumento("imovel")}>
                  <Upload className="w-4 h-4 mr-2" />
                  Anexar arquivo
                </Button>
              </div>

              {!editingId ? (
                stagedDocs.filter((d) => d.context === "imovel").length === 0 ? (
                  <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-3">
                    Você pode adicionar anexos agora, e eles serão enviados quando salvar o imóvel.
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead className="text-right w-[120px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stagedDocs
                          .filter((d) => d.context === "imovel")
                          .map((d) => (
                            <TableRow key={d.id}>
                              <TableCell className="font-medium text-foreground">{d.title}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  <span className="truncate max-w-[360px]">{d.file.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setStagedDocs((prev) => prev.filter((x) => x.id !== d.id))}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : docsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : documentos.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-3">
                  Nenhum anexo ainda.
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Arquivo</TableHead>
                        <TableHead className="whitespace-nowrap">Enviado em</TableHead>
                        <TableHead className="text-right w-[140px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documentos.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-foreground">{d.titulo}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span className="truncate max-w-[360px]">{d.nome_arquivo}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {new Date(d.uploaded_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" asChild>
                                <a href={d.url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeDocumento(d)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="border border-border rounded-xl p-4 bg-card space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-foreground">Vendedor do imóvel</div>
                  <div className="text-xs text-muted-foreground">
                    Este vendedor será cadastrado como cliente e vinculado ao imóvel. Os anexos do vendedor também ficam disponíveis no imóvel.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddDocumento("vendedor")}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Documento do vendedor (IA)
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label>Nome do vendedor *</Label>
                  <Input value={vendedor.nome_completo} onChange={(e) => setVendedor((p) => ({ ...p, nome_completo: e.target.value }))} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={vendedor.cpf} onChange={(e) => setVendedor((p) => ({ ...p, cpf: e.target.value }))} />
                </div>
                <div>
                  <Label>Documento (tipo)</Label>
                  <Input value={vendedor.documento_tipo} onChange={(e) => setVendedor((p) => ({ ...p, documento_tipo: e.target.value }))} placeholder="RG/CNH" />
                </div>
                <div>
                  <Label>Documento (nº)</Label>
                  <Input value={vendedor.documento_numero} onChange={(e) => setVendedor((p) => ({ ...p, documento_numero: e.target.value }))} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={vendedor.telefone} onChange={(e) => setVendedor((p) => ({ ...p, telefone: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>E-mail</Label>
                  <Input value={vendedor.email} onChange={(e) => setVendedor((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="md:col-span-3">
                  <Label>Endereço</Label>
                  <Input value={vendedor.endereco} onChange={(e) => setVendedor((p) => ({ ...p, endereco: e.target.value }))} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={vendedor.bairro} onChange={(e) => setVendedor((p) => ({ ...p, bairro: e.target.value }))} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={vendedor.cidade} onChange={(e) => setVendedor((p) => ({ ...p, cidade: e.target.value }))} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={vendedor.estado} onChange={(e) => setVendedor((p) => ({ ...p, estado: e.target.value }))} />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input value={vendedor.cep} onChange={(e) => setVendedor((p) => ({ ...p, cep: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">Anexos do vendedor</div>

                {!editingId ? (
                  stagedDocs.filter((d) => d.context === "vendedor").length === 0 ? (
                    <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-3">
                      Nenhum anexo do vendedor ainda. Você pode anexar agora e ele será enviado quando salvar o imóvel.
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Arquivo</TableHead>
                            <TableHead className="text-right w-[120px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stagedDocs
                            .filter((d) => d.context === "vendedor")
                            .map((d) => (
                              <TableRow key={d.id}>
                                <TableCell className="font-medium text-foreground">{d.title}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    <span className="truncate max-w-[360px]">{d.file.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setStagedDocs((prev) => prev.filter((x) => x.id !== d.id))}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : !vendedorClienteId ? (
                  stagedDocs.filter((d) => d.context === "vendedor").length === 0 ? (
                    <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-3">
                      Nenhum anexo do vendedor ainda. Você pode anexar agora, e ele será enviado quando salvar o imóvel.
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Arquivo</TableHead>
                            <TableHead className="text-right w-[120px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stagedDocs
                            .filter((d) => d.context === "vendedor")
                            .map((d) => (
                              <TableRow key={d.id}>
                                <TableCell className="font-medium text-foreground">{d.title}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    <span className="truncate max-w-[360px]">{d.file.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setStagedDocs((prev) => prev.filter((x) => x.id !== d.id))}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ) : vendedorDocsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : vendedorDocs.length === 0 ? (
                  <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-3">Nenhum anexo do vendedor ainda.</div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead className="whitespace-nowrap">Enviado em</TableHead>
                          <TableHead className="text-right w-[140px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendedorDocs.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="font-medium text-foreground">{d.nome}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span className="truncate max-w-[360px]">{displayFileFromUrl(d.url)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString("pt-BR") : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" asChild>
                                  <a href={d.url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => removeVendedorDocumento(d)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setDocUploadOpen(false);
                setPendingFiles([]);
                setDocTitle("");
              }}
            >
              Fechar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docUploadOpen} onOpenChange={setDocUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Título do documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-sm text-muted-foreground">
              {pendingFiles[0]?.name ? `Arquivo: ${pendingFiles[0].name}` : ""}
            </div>
            <div>
              <Label>Título *</Label>
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder={docContext === "vendedor" ? "Ex: CNH do Vendedor" : "Ex: Matrícula do Imóvel"}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {docContext === "vendedor"
                ? "Esse título ficará salvo no vendedor e também ficará disponível no imóvel."
                : "Esse título ficará salvo e será exibido na consulta do imóvel."}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDocUploadOpen(false);
                setPendingFiles([]);
                setDocTitle("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={uploadCurrentDocumento} disabled={docUploading}>
              {docUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar anexo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={docFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handlePickDocumento}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
      />
    </div>
  );
};

export default ImoveisPage;
