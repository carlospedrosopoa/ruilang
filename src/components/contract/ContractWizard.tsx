import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, ArrowRight, FileText, Sparkles, Copy, Download, FileDown, Loader2, Check } from "lucide-react";
import StepIndicator from "./StepIndicator";
import StepVendedores from "./StepVendedores";
import StepCompradores from "./StepCompradores";
import StepObjeto from "./StepObjeto";
import StepPagamento from "./StepPagamento";
import StepPermuta from "./StepPermuta";
import StepLocacao from "./StepLocacao";
import StepPerfil from "./StepPerfil";
import {
  TipoContrato,
  tiposContrato,
  Pessoa,
  Imovel,
  ImovelPermuta,
  Pagamento,
  Locacao,
  PerfilContrato,
  perfisContrato,
  criarPessoaVazia,
  criarImovelVazio,
  criarImovelPermutaVazio,
  criarPagamentoVazio,
  criarLocacaoVazia,
} from "@/types/contract";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const labelByTipo: Record<string, { vendedor: string; comprador: string }> = {
  promessa_compra_venda: { vendedor: "Vendedor", comprador: "Comprador" },
  promessa_compra_venda_permuta: { vendedor: "Vendedor", comprador: "Comprador" },
  cessao_direitos: { vendedor: "Cedente", comprador: "Cessionário" },
  locacao: { vendedor: "Locador", comprador: "Locatário" },
};

function getLabels(tipo: string) {
  return labelByTipo[tipo] || { vendedor: "Vendedor", comprador: "Comprador" };
}

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

function getSteps(tipo: string, labels: { vendedor: string; comprador: string }) {
  const steps = [
    { number: 1, label: `${labels.vendedor}(es)` },
    { number: 2, label: `${labels.comprador}(es)` },
    { number: 3, label: "Imóvel" },
  ];

  let stepNumber = 4;

  if (tipo === "promessa_compra_venda_permuta") {
    steps.push({ number: stepNumber++, label: "Permuta" });
  }

  if (tipo === "locacao") {
    steps.push({ number: stepNumber++, label: "Locação" });
  } else {
    steps.push({ number: stepNumber++, label: "Pagamento" });
  }

  steps.push({ number: stepNumber++, label: "Perfil" });
  steps.push({ number: stepNumber, label: "Gerar" });
  return steps;
}

function hasMeaningfulDraftData(dados: any) {
  if (!dados || typeof dados !== "object") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const hasAnyText = (obj: any, ignoreKeys: string[] = []) => {
    if (!obj || typeof obj !== "object") return false;
    for (const [k, v] of Object.entries(obj)) {
      if (ignoreKeys.includes(k)) continue;
      if (typeof v === "string" && v.trim()) return true;
    }
    return false;
  };
  const toList = (v: any) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === "object") return Object.values(v);
    return [];
  };
  const hasPessoa = (list: any[]) =>
    toList(list).some((p) => {
      if (!p || typeof p !== "object") return false;
      if (hasAnyText(p, ["id", "conjugeDeId"])) return true;
      if (p.conjuge && hasAnyText(p.conjuge, [])) return true;
      return false;
    });
  const hasImovel = (i: any) => i && typeof i === "object" && hasAnyText(i, ["adCorpus"]);
  const hasPagamento = (p: any) =>
    p &&
    typeof p === "object" &&
    (hasAnyText(p, []) || (Array.isArray(p.parcelas) && p.parcelas.some((x: any) => hasAnyText(x, ["id"]))));
  const hasLocacao = (l: any) => l && typeof l === "object" && hasAnyText(l, []);
  const perfil = typeof dados.perfilContrato === "string" ? dados.perfilContrato.trim() : "";
  const hasPerfil = Boolean(perfil && (perfil !== "equilibrado" || uuidRegex.test(perfil)));
  return (
    hasPessoa(dados.vendedores) ||
    hasPessoa(dados.compradores) ||
    hasImovel(dados.imovel) ||
    hasPagamento(dados.pagamento) ||
    hasLocacao(dados.locacao) ||
    hasPerfil ||
    Boolean(String(dados.peculiaridades || "").trim())
  );
}

const ContractWizard = () => {
  const { tipo: tipoParam } = useParams<{ tipo: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tipo = (tipoParam as string) || "promessa_compra_venda";
  const forceStartAtFirst = searchParams.get("new") === "1";
  const [customTipoInfo, setCustomTipoInfo] = useState<any | null>(null);
  const [tipoContratoId, setTipoContratoId] = useState<string | null>(null);
  const tipoInfo = tiposContrato.find((t) => t.id === (tipo as any)) || customTipoInfo;
  const labels = customTipoInfo
    ? { vendedor: customTipoInfo.label_vendedor || "Vendedor", comprador: customTipoInfo.label_comprador || "Comprador" }
    : getLabels(tipo);
  const steps = useMemo(() => getSteps(tipo, labels), [tipo, labels.vendedor, labels.comprador]);
  const totalSteps = steps.length;
  const submissionId = searchParams.get("submissionId");

  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [stepKey, setStepKey] = useState(0);
  const [vendedores, setVendedores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [compradores, setCompradores] = useState<Pessoa[]>([criarPessoaVazia()]);
  const [imovel, setImovel] = useState<Imovel>(criarImovelVazio());
  const [imovelPermuta, setImovelPermuta] = useState<ImovelPermuta>(criarImovelPermutaVazio());
  const [pagamento, setPagamento] = useState<Pagamento>(criarPagamentoVazio());
  const [locacao, setLocacao] = useState<Locacao>(criarLocacaoVazia());
  const [perfilContrato, setPerfilContrato] = useState<PerfilContrato>("equilibrado");
  const [imobiliariaId, setImobiliariaId] = useState<string | null>(null);
  const [customPerfis, setCustomPerfis] = useState<Array<{ id: string; nome: string }>>([]);
  const [tipoOptions, setTipoOptions] = useState<Array<{ codigo: string; nome: string }>>(
    () => tiposContrato.map((t) => ({ codigo: String(t.id), nome: t.nome })),
  );
  const [peculiaridades, setPeculiaridades] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [minuta, setMinuta] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const didLoadSubmissionRef = useRef(false);
  const didSyncTipoFromSubmissionRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);

  const tipoNome =
    tipoInfo?.nome ||
    tipoOptions.find((t) => t.codigo === tipo)?.nome ||
    String(tipo);

  useEffect(() => {
    if (currentStep > totalSteps) setCurrentStep(totalSteps);
  }, [currentStep, totalSteps]);

  useEffect(() => {
    const loadTipo = async () => {
      if (!imobiliariaId) {
        setCustomTipoInfo(null);
        setTipoContratoId(null);
        return;
      }
      const { data } = await supabase
        .from("tipos_contrato")
        .select("id, codigo, nome, descricao, label_vendedor, label_comprador")
        .eq("imobiliaria_id", imobiliariaId)
        .eq("codigo", tipo)
        .maybeSingle();

      setCustomTipoInfo(data || null);
      setTipoContratoId((data as any)?.id || null);
    };
    loadTipo();
  }, [imobiliariaId, tipo]);

  useEffect(() => {
    const loadTipos = async () => {
      const builtins = tiposContrato.map((t) => ({ codigo: String(t.id), nome: t.nome }));
      if (!imobiliariaId) {
        setTipoOptions(builtins);
        return;
      }

      const { data, error } = await supabase
        .from("tipos_contrato")
        .select("codigo, nome, ativo")
        .eq("imobiliaria_id", imobiliariaId)
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      if (error) {
        setTipoOptions(builtins);
        return;
      }

      const rows = ((data as any[]) || [])
        .map((t) => ({ codigo: String(t.codigo || "").trim(), nome: String(t.nome || "").trim() }))
        .filter((t) => Boolean(t.codigo && t.nome));

      if (!rows.length) {
        setTipoOptions(builtins);
        return;
      }

      const dedup = new Map<string, { codigo: string; nome: string }>();
      for (const t of rows) {
        const key = t.codigo.toLowerCase();
        if (!dedup.has(key)) dedup.set(key, t);
      }
      setTipoOptions(Array.from(dedup.values()));
    };
    loadTipos();
  }, [imobiliariaId]);

  useEffect(() => {
    if (!submissionId) return;
    const loadSubmission = async () => {
      const selectFull = "dados, imobiliaria_id, tipo_contrato, contract_texto";
      const selectFallback = "dados, imobiliaria_id, tipo_contrato";

      let data: any = null;
      let error: any = null;

      {
        const res = await supabase.from("submissions").select(selectFull).eq("id", submissionId).single();
        data = res.data;
        error = res.error;
      }

      if (error) {
        const msg = String(error?.message || "");
        if (msg.toLowerCase().includes("contract_texto")) {
          const retry = await supabase.from("submissions").select(selectFallback).eq("id", submissionId).single();
          data = retry.data;
          error = retry.error;
        }
      }

      if (error) {
        toast.error(error.message || "Não foi possível carregar os dados do contrato.");
        didLoadSubmissionRef.current = true;
        return;
      }

      {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const rawTipo = typeof data?.tipo_contrato === "string" ? data.tipo_contrato.trim() : "";
        const imobId = typeof data?.imobiliaria_id === "string" ? data.imobiliaria_id : null;
        let resolvedTipo = rawTipo;
        if (resolvedTipo && uuidRegex.test(resolvedTipo) && imobId) {
          const res = await supabase.from("tipos_contrato").select("codigo").eq("imobiliaria_id", imobId).eq("id", resolvedTipo).maybeSingle();
          const codigo = (res.data as any)?.codigo;
          if (typeof codigo === "string" && codigo.trim()) resolvedTipo = codigo.trim();
        }

        if (resolvedTipo && resolvedTipo !== tipo && !didSyncTipoFromSubmissionRef.current) {
          didSyncTipoFromSubmissionRef.current = true;
          const nextParams = new URLSearchParams(searchParams);
          const url = `/contrato/${encodeURIComponent(resolvedTipo)}${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
          navigate(url, { replace: true });
          return;
        }
      }

      if (data?.dados) {
        let d: any = data.dados as any;
        if (typeof d === "string") {
          try {
            d = JSON.parse(d);
          } catch {
            d = null;
          }
        }
        if (!d || typeof d !== "object") {
          didLoadSubmissionRef.current = true;
          return;
        }

        const normalizePessoa = (p: any): Pessoa => {
          const base = criarPessoaVazia();
          if (!p || typeof p !== "object") return base;
          const id = typeof p.id === "string" && p.id.trim() ? p.id : crypto.randomUUID();
          return { ...base, ...p, id } as Pessoa;
        };
        const normalizePessoaList = (list: any): Pessoa[] => {
          if (!list) return [];
          const arr = Array.isArray(list) ? list : typeof list === "object" ? Object.values(list) : [];
          return arr.map(normalizePessoa);
        };

        const vend = normalizePessoaList(d.vendedores);
        const comp = normalizePessoaList(d.compradores);
        if (vend.length) setVendedores(vend);
        if (comp.length) setCompradores(comp);
        if (d.imovel && typeof d.imovel === "object") setImovel({ ...criarImovelVazio(), ...d.imovel } as any);
        if (d.imovelPermuta && typeof d.imovelPermuta === "object") setImovelPermuta({ ...criarImovelPermutaVazio(), ...d.imovelPermuta } as any);
        if (d.pagamento && typeof d.pagamento === "object") setPagamento({ ...criarPagamentoVazio(), ...d.pagamento } as any);
        if (d.locacao && typeof d.locacao === "object") setLocacao({ ...criarLocacaoVazia(), ...d.locacao } as any);
        if (typeof d.perfilContrato === "string" && d.perfilContrato.trim()) setPerfilContrato(d.perfilContrato as any);
        if (typeof d.peculiaridades === "string") setPeculiaridades(d.peculiaridades);

        const hasData = hasMeaningfulDraftData(d);
        if (forceStartAtFirst) {
          setCurrentStep(1);
        } else if (typeof data.contract_texto === "string" && data.contract_texto.trim()) {
          setMinuta(data.contract_texto);
          const gerarStep = steps.findIndex((s) => s.label === "Gerar");
          if (gerarStep >= 0) setCurrentStep(gerarStep + 1);
        } else if (hasData) {
          const perfilStep = steps.findIndex((s) => s.label === "Perfil");
          if (perfilStep >= 0) setCurrentStep(perfilStep + 1);
        } else {
          setCurrentStep(1);
        }
      }
      if (data?.imobiliaria_id) setImobiliariaId(data.imobiliaria_id as any);
      didLoadSubmissionRef.current = true;
    };
    loadSubmission();
  }, [submissionId, steps, forceStartAtFirst]);

  useEffect(() => {
    if (!submissionId) return;
    if (!didLoadSubmissionRef.current) return;

    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      const dados: any = {
        vendedores,
        compradores,
        imovel,
        imovelPermuta,
        pagamento,
        locacao,
        perfilContrato,
        peculiaridades,
      };

      if (!hasMeaningfulDraftData(dados)) return;

      await supabase
        .from("submissions")
        .update({ dados } as any)
        .eq("id", submissionId);
    }, 650);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    };
  }, [submissionId, tipo, vendedores, compradores, imovel, imovelPermuta, pagamento, locacao, perfilContrato, peculiaridades]);

  useEffect(() => {
    const loadPerfis = async () => {
      if (!imobiliariaId || !tipoContratoId) {
        setCustomPerfis([]);
        return;
      }
      const { data } = await supabase
        .from("perfis_contrato")
        .select("codigo, nome")
        .eq("imobiliaria_id", imobiliariaId)
        .eq("tipo_contrato_id", tipoContratoId)
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      setCustomPerfis(((data as any[]) || []).map((p) => ({ id: p.codigo, nome: p.nome })));
    };
    loadPerfis();
  }, [imobiliariaId, tipoContratoId]);

  useEffect(() => {
    if (!customPerfis.length) return;
    const ids = new Set(customPerfis.map((p) => p.id));
    if (ids.has(String(perfilContrato))) return;
    const preferred =
      customPerfis.find((p) => p.nome.toLowerCase().includes("equilibr"))?.id ||
      customPerfis[0]?.id ||
      null;
    if (preferred) setPerfilContrato(preferred as any);
  }, [customPerfis, perfilContrato]);

  const next = () => {
    if (currentStep < totalSteps) {
      setDirection("forward");
      setStepKey(k => k + 1);
      setCurrentStep(currentStep + 1);
    }
  };
  const prev = () => {
    if (currentStep > 1) {
      setDirection("backward");
      setStepKey(k => k + 1);
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step < 1 || step > totalSteps) return;
    if (step === currentStep) return;
    setDirection(step > currentStep ? "forward" : "backward");
    setStepKey((k) => k + 1);
    setCurrentStep(step);
  };

  const handleTipoChange = async (nextTipo: string) => {
    const novoTipo = String(nextTipo || "").trim();
    if (!novoTipo || novoTipo === tipo) return;

    try {
      if (submissionId) {
        if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;

        const dados: any = {
          vendedores,
          compradores,
          imovel,
          imovelPermuta,
          pagamento,
          locacao,
          perfilContrato,
          peculiaridades,
        };

        const { error } = await supabase
          .from("submissions")
          .update({ tipo_contrato: novoTipo, contract_texto: null, dados } as any)
          .eq("id", submissionId);
        if (error) throw error;
      }

      setMinuta(null);

      const nextParams = new URLSearchParams(searchParams);
      const url = `/contrato/${encodeURIComponent(novoTipo)}${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
      navigate(url);
      toast.success("Tipo de contrato alterado. Revise os dados e gere novamente.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível alterar o tipo de contrato.");
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const contrato = {
        tipoContrato: tipo,
        tipoContratoNome: tipoNome || null,
        perfilContrato,
        peculiaridades: peculiaridades.trim() || undefined,
        vendedores,
        compradores,
        imovel,
        ...(tipo === "promessa_compra_venda_permuta" ? { imovelPermuta } : {}),
        ...(tipo === "locacao" ? { locacao } : { pagamento }),
      };

      const { data, error } = await supabase.functions.invoke("generate-contract", {
        body: { contrato, submissionId, imobiliariaId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMinuta(data.minuta);
      toast.success("Minuta gerada com sucesso!");
    } catch (err: any) {
      console.error("Error generating contract:", err);
      let message = err?.message || "Erro ao gerar contrato. Tente novamente.";

      const status =
        err?.status ??
        err?.context?.status ??
        err?.context?.response?.status ??
        err?.context?.res?.status ??
        null;

      const tryReadBody = async (resp: any) => {
        try {
          if (!resp || typeof resp !== "object") return null;
          const clone = typeof resp.clone === "function" ? resp.clone() : resp;
          if (typeof clone.json === "function") {
            try {
              return await clone.json();
            } catch {}
          }
          if (typeof clone.text === "function") {
            const t = await clone.text();
            if (!t || !String(t).trim()) return null;
            try {
              return JSON.parse(t);
            } catch {
              return { error: String(t).trim() };
            }
          }
          return null;
        } catch {
          return null;
        }
      };

      const ctx = err?.context;
      if (ctx) {
        if (typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (typeof body?.error === "string" && body.error.trim()) message = body.error;
          } catch {}
        } else if (ctx.response) {
          const body = await tryReadBody(ctx.response);
          if (typeof body?.error === "string" && body.error.trim()) message = body.error;
        }
      }

      if (status && !message.includes(String(status))) {
        message = `HTTP ${status} — ${message}`;
      }
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (minuta) {
      navigator.clipboard.writeText(minuta);
      toast.success("Minuta copiada!");
    }
  };

  const handleDownloadTxt = () => {
    if (minuta) {
      const blob = new Blob([minuta], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato_${tipo}_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const handleDownloadDocx = async () => {
    if (!minuta) return;
    setIsExportingDocx(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-docx", {
        body: {
          minuta,
          tipoContrato: tipo,
          tipoContratoNome: tipoNome || null,
          format: "visual_law",
          imobiliariaId,
          signatures: {
            conjugeVendedor: vendedores.some((v) => Boolean((v as any)?.conjugeDeId)),
            conjugeComprador: compradores.some((c) => Boolean((c as any)?.conjugeDeId)),
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const byteChars = atob(data.docx);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const downloadName = `contrato_${tipo}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("DOCX baixado com sucesso!");

      if (submissionId) {
        const safeName = safeStorageFileName(downloadName);
        const storagePath = `submissions/${submissionId}/contrato/${Date.now()}_${safeName}`;
        const file = new File([blob], downloadName, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const { error: upErr } = await supabase.storage.from("proposta-docs").upload(storagePath, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("proposta-docs").getPublicUrl(storagePath);

        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id || null;

        const { data: fresh, error: freshErr } = await supabase
          .from("submissions")
          .select("documentos, imovel_id")
          .eq("id", submissionId)
          .single();
        if (freshErr) throw freshErr;

        const existingDocs = Array.isArray((fresh as any)?.documentos) ? ((fresh as any).documentos as any[]) : [];
        const nextDocs: any[] = [...existingDocs];
        const doc = {
          id: crypto.randomUUID(),
          nome: downloadName,
          tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          tamanho: byteArray.length,
          url: urlData.publicUrl,
          uploadedAt: new Date().toISOString(),
          categoria: "contrato",
          storagePath,
        };
        nextDocs.push(doc);

        const { error: updErr } = await supabase
          .from("submissions")
          .update({ documentos: nextDocs } as any)
          .eq("id", submissionId);
        if (updErr) throw updErr;

        const imovelId = (fresh as any)?.imovel_id as string | null;
        if (imovelId) {
          const { error: imErr } = await supabase.from("imovel_documentos").insert({
            imovel_id: imovelId,
            titulo: `Contrato - ${tipoNome || tipo}`.slice(0, 180),
            nome_arquivo: downloadName,
            storage_path: storagePath,
            tipo: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            tamanho: byteArray.length,
            url: urlData.publicUrl,
            uploaded_by: userId,
          } as any);
          if (imErr) throw imErr;
        }
      }
    } catch (err: any) {
      console.error("Error exporting DOCX:", err);
      toast.error("Erro ao exportar DOCX. Tente novamente.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <StepVendedores
          vendedores={vendedores}
          onChange={setVendedores}
          titulo={labels.vendedor}
          tituloPlural={`${labels.vendedor}(es)`}
        />
      );
    }
    if (currentStep === 2) {
      return (
        <StepCompradores
          compradores={compradores}
          onChange={setCompradores}
          titulo={labels.comprador}
          tituloPlural={`${labels.comprador}(es)`}
        />
      );
    }
    if (currentStep === 3) {
      return <StepObjeto imovel={imovel} onChange={setImovel} />;
    }

    const currentStepObj = steps[currentStep - 1];
    if (currentStepObj.label === "Permuta") {
      return <StepPermuta imovelPermuta={imovelPermuta} onChange={setImovelPermuta} />;
    }
    if (currentStepObj.label === "Locação") {
      return <StepLocacao locacao={locacao} onChange={setLocacao} />;
    }
    if (currentStepObj.label === "Pagamento") {
      return <StepPagamento pagamento={pagamento} onChange={setPagamento} />;
    }
    if (currentStepObj.label === "Perfil") {
      return (
        <StepPerfil
          tipoContrato={tipo as TipoContrato}
          tipoContratoId={tipoContratoId}
          perfilContrato={perfilContrato}
          onChange={setPerfilContrato}
          peculiaridades={peculiaridades}
          onPeculiaridadesChange={setPeculiaridades}
          imobiliariaId={imobiliariaId}
        />
      );
    }
    if (currentStepObj.label === "Gerar") {
      if (minuta) {
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
                    <Check className="w-4 h-4 text-success" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground tracking-tight">Minuta Gerada</h3>
                </div>
                <p className="text-muted-foreground text-sm">Revise o texto e faça os ajustes necessários.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadTxt} className="text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> .txt
                </Button>
                <Button size="sm" onClick={handleDownloadDocx} disabled={isExportingDocx} className="text-xs bg-primary">
                  {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
                  {isExportingDocx ? "Gerando..." : "Baixar .docx"}
                </Button>
              </div>
            </div>
            <div className="border border-border rounded-xl p-6 sm:p-8 bg-card shadow-card">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-body leading-relaxed">{minuta}</pre>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent/[0.06] border border-accent/15">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <p className="text-xs text-muted-foreground">
                Esta minuta foi gerada por inteligência artificial e deve ser revisada por um advogado antes da assinatura.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-1 tracking-tight">Resumo e Geração</h3>
            <p className="text-muted-foreground">Confira os dados antes de gerar a minuta.</p>
          </div>
          <div className="border border-border rounded-xl p-6 bg-card shadow-card space-y-5">
            <h4 className="font-display font-semibold text-foreground text-sm uppercase tracking-wider text-muted-foreground">Resumo dos Dados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</span>
                <span className="text-foreground font-medium">{tipoInfo?.nome}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Perfil</span>
                <span className="text-foreground font-medium">
                  {perfisContrato.find(p => p.id === perfilContrato)?.nome || customPerfis.find((p) => p.id === perfilContrato)?.nome || String(perfilContrato)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{labels.vendedor}(es)</span>
                <span className="text-foreground font-medium">{vendedores.map((v) => v.nome || "—").join(", ")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{labels.comprador}(es)</span>
                <span className="text-foreground font-medium">{compradores.map((c) => c.nome || "—").join(", ")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Imóvel</span>
                <span className="text-foreground font-medium">{imovel.localizacao || "—"}, {imovel.municipio || "—"}/{imovel.estadoImovel || "—"}</span>
              </div>
              {tipo !== "locacao" && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Total</span>
                    <span className="text-foreground font-medium">R$ {pagamento.valorTotal || "—"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Honorários</span>
                    <span className="text-foreground font-medium">R$ {pagamento.valorHonorarios || "—"}</span>
                  </div>
                </>
              )}
              {tipo === "locacao" && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aluguel</span>
                  <span className="text-foreground font-medium">R$ {locacao.valorAluguel || "—"}</span>
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent shrink-0" />
                <p className="text-xs text-muted-foreground">
                  A minuta gerada por IA é um modelo e deve ser revisada por um advogado antes da assinatura.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const isLastStep = currentStep === totalSteps;

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <header className="gradient-primary border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/painel")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/images/logo-pactadoc.png" alt="PactaDoc" className="h-8 w-auto" />
            <div>
              <h1 className="font-display text-lg font-bold text-primary-foreground tracking-tight">PactaDoc</h1>
              <p className="text-[10px] text-primary-foreground/50 font-medium uppercase tracking-wider">{tipoNome || "Contrato"}</p>
              {submissionId ? (
                <button
                  type="button"
                  className="mt-0.5 text-[10px] text-primary-foreground/70 font-medium tracking-wide hover:text-primary-foreground/90 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(submissionId);
                    toast.success("ID do contrato copiado.");
                  }}
                >
                  ID: {submissionId.slice(0, 8)}
                </button>
              ) : null}
            </div>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <StepIndicator steps={steps} currentStep={currentStep} onStepChange={goToStep} />

        <div className="mt-8 border border-border rounded-xl p-4 bg-card shadow-card">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label>Tipo de contrato</Label>
              <Select value={tipo} onValueChange={handleTipoChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipoOptions.map((t) => (
                    <SelectItem key={t.codigo} value={t.codigo}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                Ao alterar o tipo, o contrato anterior é descartado e você deve gerar novamente após revisar os dados.
              </p>
            </div>
          </div>
        </div>

        {generateError ? (
          <div className="mt-6">
            <Alert variant="destructive">
              <AlertTitle>Erro ao gerar contrato</AlertTitle>
              <AlertDescription>
                <div className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-destructive/90">
                  {generateError}
                </div>
                <div className="mt-4 flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(generateError);
                      toast.success("Erro copiado.");
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1.5" />
                    Copiar erro
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setGenerateError(null)}>
                    Limpar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div
          key={stepKey}
          className={`min-h-[400px] mt-12 ${direction === "forward" ? "step-slide-enter-forward" : "step-slide-enter-backward"}`}
        >
          {renderStep()}
        </div>

        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
          <Button variant="outline" onClick={currentStep === 1 ? () => navigate("/painel") : prev} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? "Voltar" : "Anterior"}
          </Button>

          {!isLastStep ? (
            <Button onClick={next} className="gap-2 bg-primary shadow-card hover:shadow-elevated transition-all">
              Próximo
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : !minuta ? (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground shadow-card hover:shadow-elevated transition-all font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analisando dados e gerando contrato...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Minuta com IA
                </>
              )}
            </Button>
          ) : (
            <Button onClick={() => { setMinuta(null); handleGenerate(); }} disabled={isGenerating} variant="outline" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Regerar
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ContractWizard;
