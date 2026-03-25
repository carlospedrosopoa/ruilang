import { AlertTriangle, User, Home, DollarSign, Paperclip } from "lucide-react";
import { Pessoa, Imovel } from "@/types/contract";
import { PropostaPagamento, PropostaDocumento } from "@/types/proposal";

interface StepRevisaoProps {
  corretorNome: string;
  corretorCreci: string;
  imobiliariaNome: string;
  vendedores: Pessoa[];
  compradores: Pessoa[];
  imovel: Imovel;
  pagamento: PropostaPagamento;
  documentos: PropostaDocumento[];
}

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" />
      <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
    </div>
    <div className="pl-6 space-y-2 text-sm">{children}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-2">
    <span className="text-muted-foreground shrink-0">{label}:</span>
    <span className="text-foreground font-medium">{value || "—"}</span>
  </div>
);

const StepRevisao = ({
  corretorNome,
  corretorCreci,
  imobiliariaNome,
  vendedores,
  compradores,
  imovel,
  pagamento,
  documentos,
}: StepRevisaoProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">Revisão</h3>
        <p className="text-muted-foreground">Confira os dados antes de finalizar.</p>
      </div>

      <div className="border border-border rounded-lg p-6 bg-card space-y-6 divide-y divide-border">
        <Section icon={User} title="Corretor">
          <Field label="Nome" value={corretorNome} />
          <Field label="CRECI" value={corretorCreci} />
          {imobiliariaNome && <Field label="Imobiliária" value={imobiliariaNome} />}
        </Section>

        <div className="pt-4">
          <Section icon={User} title="Vendedor(es)">
            {vendedores.map((v, i) => (
              <div key={v.id} className="space-y-1">
                {vendedores.length > 1 && (
                  <p className="text-xs font-semibold text-muted-foreground">Vendedor {i + 1}</p>
                )}
                <Field label="Nome" value={v.nome} />
                <Field label="CPF" value={v.cpf} />
                <Field label="Estado Civil" value={v.estadoCivil} />
                <Field label="Endereço" value={`${v.endereco}, ${v.bairro} - ${v.cidade}/${v.estado}`} />
              </div>
            ))}
          </Section>
        </div>

        <div className="pt-4">
          <Section icon={User} title="Comprador(es)">
            {compradores.map((c, i) => (
              <div key={c.id} className="space-y-1">
                {compradores.length > 1 && (
                  <p className="text-xs font-semibold text-muted-foreground">Comprador {i + 1}</p>
                )}
                <Field label="Nome" value={c.nome} />
                <Field label="CPF" value={c.cpf} />
                <Field label="Estado Civil" value={c.estadoCivil} />
                <Field label="Endereço" value={`${c.endereco}, ${c.bairro} - ${c.cidade}/${c.estado}`} />
              </div>
            ))}
          </Section>
        </div>

        <div className="pt-4">
          <Section icon={Home} title="Imóvel">
            <Field label="Tipo" value={imovel.tipo} />
            <Field label="Localização" value={imovel.localizacao} />
            <Field label="Município" value={`${imovel.municipio}/${imovel.estadoImovel}`} />
            <Field label="Matrícula" value={imovel.matricula} />
            <Field label="Área Total" value={imovel.areaTotal} />
          </Section>
        </div>

        <div className="pt-4">
          <Section icon={DollarSign} title="Pagamento">
            <Field label="Valor Total" value={`R$ ${pagamento.valorTotal}`} />
            <Field label="Forma" value={pagamento.formaPagamento === "avista" ? "À vista" : "Parcelado"} />
            {pagamento.formaPagamento === "parcelado" && (
              <>
                {pagamento.valorEntrada && <Field label="Entrada" value={`R$ ${pagamento.valorEntrada}`} />}
                {pagamento.numeroParcelas && <Field label="Parcelas" value={`${pagamento.numeroParcelas}x`} />}
              </>
            )}
            {pagamento.observacoes && <Field label="Observações" value={pagamento.observacoes} />}
          </Section>
        </div>

        {documentos.length > 0 && (
          <div className="pt-4">
            <Section icon={Paperclip} title={`Documentos (${documentos.length})`}>
              {documentos.map((doc) => (
                <p key={doc.id} className="text-foreground">{doc.nome}</p>
              ))}
            </Section>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-accent/10 border border-accent/20">
        <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          <strong>Aviso importante:</strong> Este documento não constitui contrato, tratando-se apenas de uma proposta e coleta de dados para elaboração jurídica posterior.
        </p>
      </div>
    </div>
  );
};

export default StepRevisao;
