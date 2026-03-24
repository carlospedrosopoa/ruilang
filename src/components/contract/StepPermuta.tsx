import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImovelPermuta, estadosBR } from "@/types/contract";

interface StepPermutaProps {
  imovelPermuta: ImovelPermuta;
  onChange: (imovelPermuta: ImovelPermuta) => void;
}

const StepPermuta = ({ imovelPermuta, onChange }: StepPermutaProps) => {
  const update = (field: keyof ImovelPermuta, value: string) => {
    onChange({ ...imovelPermuta, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-foreground mb-1">
          Imóvel Dado em Permuta
        </h3>
        <p className="text-muted-foreground">
          Descreva o imóvel que será dado como parte do pagamento (permuta).
        </p>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-4 bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo do Imóvel *</Label>
            <Select value={imovelPermuta.tipo} onValueChange={(v) => update("tipo", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="sala_comercial">Sala Comercial</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Área Total *</Label>
            <Input value={imovelPermuta.areaTotal} onChange={(e) => update("areaTotal", e.target.value)} placeholder="Ex: 200,00 m²" />
          </div>

          <div>
            <Label>Localização *</Label>
            <Input value={imovelPermuta.localizacao} onChange={(e) => update("localizacao", e.target.value)} placeholder="Endereço do imóvel" />
          </div>

          <div>
            <Label>Município *</Label>
            <Input value={imovelPermuta.municipio} onChange={(e) => update("municipio", e.target.value)} placeholder="Município" />
          </div>

          <div>
            <Label>Estado *</Label>
            <Select value={imovelPermuta.estadoImovel} onValueChange={(v) => update("estadoImovel", v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {estadosBR.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Matrícula nº</Label>
            <Input value={imovelPermuta.matricula} onChange={(e) => update("matricula", e.target.value)} placeholder="Nº da matrícula" />
          </div>

          <div>
            <Label>Registro de Imóveis</Label>
            <Input value={imovelPermuta.registroImoveis} onChange={(e) => update("registroImoveis", e.target.value)} placeholder="Cartório" />
          </div>

          <div>
            <Label>Valor Estimado (R$) *</Label>
            <Input value={imovelPermuta.valorEstimado} onChange={(e) => update("valorEstimado", e.target.value)} placeholder="Ex: 50.000,00" />
          </div>
        </div>

        <div>
          <Label>Descrição</Label>
          <Textarea
            value={imovelPermuta.descricao}
            onChange={(e) => update("descricao", e.target.value)}
            placeholder="Descrição do imóvel dado em permuta..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
};

export default StepPermuta;
