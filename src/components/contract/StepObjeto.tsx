import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Imovel, estadosBR } from "@/types/contract";

interface StepObjetoProps {
  imovel: Imovel;
  onChange: (imovel: Imovel) => void;
}

const StepObjeto = ({ imovel, onChange }: StepObjetoProps) => {
  const update = (field: keyof Imovel, value: string | boolean) => {
    onChange({ ...imovel, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          Objeto do Contrato
        </h3>
        <p className="text-muted-foreground">
          Descreva o imóvel objeto da transação.
        </p>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo do Imóvel *</Label>
            <Select value={imovel.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="sala_comercial">Sala Comercial</SelectItem>
                <SelectItem value="loja">Loja</SelectItem>
                <SelectItem value="galpao">Galpão</SelectItem>
                <SelectItem value="chacara">Chácara</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Área Total *</Label>
            <Input value={imovel.areaTotal} onChange={(e) => update("areaTotal", e.target.value)} placeholder="Ex: 360,00 m²" />
          </div>

          <div>
            <Label>Localização / Denominação *</Label>
            <Input value={imovel.localizacao} onChange={(e) => update("localizacao", e.target.value)} placeholder="Ex: Praia Camboim" />
          </div>

          <div>
            <Label>Município *</Label>
            <Input value={imovel.municipio} onChange={(e) => update("municipio", e.target.value)} placeholder="Município" />
          </div>

          <div>
            <Label>Estado *</Label>
            <Select value={imovel.estadoImovel} onValueChange={(v) => update("estadoImovel", v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {estadosBR.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Lote</Label>
            <Input value={imovel.lote} onChange={(e) => update("lote", e.target.value)} placeholder="Ex: 02" />
          </div>

          <div>
            <Label>Quadra</Label>
            <Input value={imovel.quadra} onChange={(e) => update("quadra", e.target.value)} placeholder='Ex: EE' />
          </div>

          <div>
            <Label>Matrícula nº *</Label>
            <Input value={imovel.matricula} onChange={(e) => update("matricula", e.target.value)} placeholder="Nº da matrícula" />
          </div>

          <div>
            <Label>Registro de Imóveis</Label>
            <Input value={imovel.registroImoveis} onChange={(e) => update("registroImoveis", e.target.value)} placeholder="Ex: 1ª Zona de Torres/RS" />
          </div>
        </div>

        <h4 className="font-display text-lg font-semibold text-foreground pt-2">Medidas</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Frente</Label>
            <Input value={imovel.medidasFrente} onChange={(e) => update("medidasFrente", e.target.value)} placeholder="Ex: 12,00 metros" />
          </div>
          <div>
            <Label>Fundos</Label>
            <Input value={imovel.medidasFundos} onChange={(e) => update("medidasFundos", e.target.value)} placeholder="Ex: 12,00 metros" />
          </div>
          <div>
            <Label>Lateral Esquerda</Label>
            <Input value={imovel.medidasLateralEsquerda} onChange={(e) => update("medidasLateralEsquerda", e.target.value)} placeholder="Ex: 30,00 metros" />
          </div>
          <div>
            <Label>Lateral Direita</Label>
            <Input value={imovel.medidasLateralDireita} onChange={(e) => update("medidasLateralDireita", e.target.value)} placeholder="Ex: 30,00 metros" />
          </div>
        </div>

        <div>
          <Label>Descrição Detalhada</Label>
          <Textarea
            value={imovel.descricao}
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Descrição complementar do imóvel, benfeitorias, confrontações..."
            rows={3}
          />
        </div>

        <div>
          <Label>Características Adicionais</Label>
          <Textarea
            value={imovel.caracteristicas}
            onChange={(e) => update("caracteristicas", e.target.value)}
            placeholder="Demais características constantes da matrícula..."
            rows={2}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Switch
            checked={imovel.adCorpus}
            onCheckedChange={(v) => update("adCorpus", v)}
          />
          <Label className="cursor-pointer">
            Venda em caráter <strong>AD CORPUS</strong>
          </Label>
        </div>
      </div>
    </div>
  );
};

export default StepObjeto;
