import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AiProvider = "openai" | "gemini";

function getProviderFromRequest(body: any): AiProvider | null {
  const p = body?.ai?.provider;
  if (p === "openai" || p === "gemini") return p;
  return null;
}

function getDefaultProvider(): AiProvider {
  const raw = (Deno.env.get("AI_PROVIDER_DEFAULT") || "").toLowerCase();
  return raw === "gemini" ? "gemini" : "openai";
}

function isFailoverEnabled() {
  const raw = (Deno.env.get("AI_FAILOVER_ENABLED") || "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function callOpenAiText(params: { apiKey: string; model: string; systemPrompt: string; userPrompt: string }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Credenciais inválidas. Verifique OPENAI_API_KEY.");
    if (response.status === 429) throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
    const t = await response.text();
    console.error("AI error:", response.status, t);
    throw new Error(`Erro do provedor OpenAI (${response.status})`);
  }

  const data = await response.json();
  return (data?.choices?.[0]?.message?.content || "").trim();
}

async function callGeminiText(params: { apiKey: string; model: string; systemPrompt: string; userPrompt: string }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: params.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Credenciais inválidas. Verifique GEMINI_API_KEY.");
    if (response.status === 429) throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
    const t = await response.text();
    console.error("Gemini error:", response.status, t);
    throw new Error(`Erro do provedor Gemini (${response.status})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") || "";
  return text.trim();
}

const tipoLabels: Record<string, string> = {
  promessa_compra_venda: "Contrato de Promessa de Compra e Venda de Imóvel",
  promessa_compra_venda_permuta: "Contrato de Promessa de Compra e Venda de Imóvel com Permuta",
  cessao_direitos: "Contrato de Cessão de Direitos Possessórios",
  locacao: "Contrato de Locação de Imóvel",
};

function getClausulasEspecificasTipo(tipo: string): string {
  switch (tipo) {
    case "promessa_compra_venda":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA PROMESSA DE COMPRA E VENDA:
1. OBJETO E DESCRIÇÃO COMPLETA DO IMÓVEL - com dados registrais, matrícula, confrontações, área total (ad corpus ou ad mensuram conforme indicado)
2. PREÇO E FORMA DE PAGAMENTO - discriminar arras confirmatórias (art. 418 CC), sinal, parcelas com valores FIXOS, data de vencimento
3. IMISSÃO NA POSSE - definir momento exato da entrega da posse (precária ou definitiva), estado de conservação, inventário de bens se houver
4. OBRIGAÇÕES DO PROMITENTE VENDEDOR:
   - Outorga de escritura definitiva no prazo estipulado após quitação
   - Apresentar certidões negativas: IPTU, ITR (rural), condomínio, forenses, trabalhistas, fiscais (federal/estadual/municipal), protesto
   - Garantir inexistência de ônus, gravames, penhoras, arrestos, sequestros, ações reais ou pessoais reipersecutórias
   - Responsabilidade por evicção (arts. 447 a 457 CC)
   - Manter o imóvel livre e desembaraçado até a transferência
5. OBRIGAÇÕES DO PROMITENTE COMPRADOR:
   - Pagamento pontual das parcelas
   - Responsabilidade por tributos e encargos a partir da imissão na posse (IPTU, taxas, condomínio)
   - Conservação do imóvel
   - Não ceder direitos sem anuência do vendedor
6. CLÁUSULA PENAL MORATÓRIA - multa por atraso no pagamento (máximo 2% para relações consumeristas, livre para civis)
7. CLÁUSULA PENAL COMPENSATÓRIA - multa por inadimplemento definitivo/rescisão
8. JUROS DE MORA - taxa mensal aplicável
9. PARCELAS FIXAS - todas as parcelas têm valores FIXOS, SEM correção monetária, SEM atualização por qualquer índice. O valor de cada parcela é o valor nominal acordado e não sofre reajuste.
10. CLÁUSULA RESOLUTIVA - expressa ou tácita, com procedimento de notificação extrajudicial (art. 474 CC)
11. IRREVOGABILIDADE E IRRETRATABILIDADE - art. 463 CC
12. DIREITO À ADJUDICAÇÃO COMPULSÓRIA - art. 1.418 CC e Súmula 239 STJ
13. BENFEITORIAS - regime aplicável (necessárias, úteis, voluptuárias) conforme arts. 1.219 a 1.222 CC
14. SUB-ROGAÇÃO E CESSÃO - condições para cessão de direitos a terceiros
15. DESPESAS DE TRANSFERÊNCIA - ITBI, emolumentos cartorários, escritura, registro
16. VÍCIOS REDIBITÓRIOS - prazo e condições (arts. 441 a 446 CC)
17. CASO FORTUITO E FORÇA MAIOR - art. 393 CC
18. LGPD - tratamento de dados pessoais das partes
19. FORO DE ELEIÇÃO - comarca competente
20. DISPOSIÇÕES FINAIS - comunicações, contagem de prazos, integralidade do instrumento`;

    case "promessa_compra_venda_permuta":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA PROMESSA DE COMPRA E VENDA COM PERMUTA:
1. OBJETO DUPLO - descrição detalhada de AMBOS os imóveis com dados registrais completos
2. VALORES - valor de cada imóvel, torna (diferença) a ser paga, forma de pagamento da torna
3. SIMULTANEIDADE - estabelecer se a troca é simultânea ou se há prazos diferenciados
4. TODAS as cláusulas da compra e venda simples (acima)
5. CLÁUSULAS ESPECÍFICAS DA PERMUTA:
   - Regime jurídico da troca (arts. 533 CC - aplicam-se as regras da compra e venda)
   - Evicção recíproca - cada permutante responde pela evicção do imóvel que entregou
   - Estado de conservação de cada imóvel
   - Vistoria prévia e aceite do estado dos imóveis
   - Responsabilidade por débitos anteriores de cada imóvel (IPTU, condomínio, etc.)
   - Tributos - ITBI sobre a torna ou sobre ambos conforme legislação municipal
   - Posse simultânea ou escalonada
   - Garantias recíprocas de propriedade e livre disposição
   - Certidões negativas de AMBOS os imóveis
   - Ônus e gravames de AMBOS os imóveis`;

    case "cessao_direitos":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA CESSÃO DE DIREITOS POSSESSÓRIOS:
1. NATUREZA JURÍDICA - esclarecer que se trata de cessão de direitos possessórios e NÃO de propriedade
2. ORIGEM DA POSSE - descrever como o cedente adquiriu a posse (contrato anterior, ocupação, herança, etc.)
3. CADEIA POSSESSÓRIA - listar toda a cadeia de transmissões anteriores, se houver
4. OBJETO - descrição detalhada do imóvel/terreno com localização, medidas, confrontações
5. DECLARAÇÕES DO CEDENTE:
   - Posse mansa, pacífica e ininterrupta
   - Inexistência de oposição de terceiros
   - Inexistência de ação possessória ou reivindicatória
   - Tempo de posse exercido
   - Benfeitorias realizadas
   - Quitação de tributos e encargos durante a posse
6. GARANTIAS:
   - Responsabilidade do cedente por evicção da posse
   - Compromisso de defesa da posse em caso de turbação ou esbulho por terceiros
   - Obrigação de prestar depoimento em eventual ação de usucapião
7. PREÇO E PAGAMENTO - valor da cessão e forma de pagamento
8. IMISSÃO NA POSSE - momento da transferência
9. USUCAPIÃO - cláusula sobre possibilidade de ação de usucapião pelo cessionário, com compromisso do cedente de colaborar
10. RISCOS - informar expressamente que a cessão não garante propriedade, apenas direitos possessórios
11. CLÁUSULA PENAL - multas por inadimplemento
12. IRREVOGABILIDADE
13. LGPD
14. FORO`;

    case "locacao":
      return `
CLÁUSULAS OBRIGATÓRIAS PARA LOCAÇÃO (Lei 8.245/91):
1. OBJETO - descrição do imóvel, finalidade (residencial/comercial), estado de conservação
2. PRAZO - início, término, condições de renovação
3. ALUGUEL - valor mensal, data de vencimento, forma de pagamento
4. REAJUSTE - índice (IGPM, IPCA, INPC), periodicidade (anual), data-base
5. ENCARGOS DO LOCATÁRIO:
   - IPTU (proporcional ou integral conforme pactuado)
   - Condomínio ordinário
   - Conta de água, luz, gás, internet
   - Seguro contra incêndio (art. 22, VIII da Lei 8.245/91)
   - Taxa de lixo e demais tributos
6. GARANTIA LOCATÍCIA (art. 37 da Lei 8.245/91) - apenas UMA:
   - Caução (até 3 aluguéis - art. 38 §2º)
   - Fiança
   - Seguro fiança
   - Cessão fiduciária de quotas
7. VISTORIA - laudo de vistoria inicial, condições de devolução
8. BENFEITORIAS:
   - Necessárias: indenizáveis (salvo estipulação em contrário)
   - Úteis: indenizáveis se autorizadas previamente
   - Voluptuárias: não indenizáveis, podem ser retiradas sem dano
9. CESSÃO E SUBLOCAÇÃO - vedação ou condições (art. 13)
10. DEVERES DO LOCADOR (art. 22):
   - Entregar o imóvel em condições
   - Garantir uso pacífico
   - Manter forma e destino
   - Responder por vícios anteriores
11. DEVERES DO LOCATÁRIO (art. 23):
   - Pagar pontualmente
   - Usar conforme destinação
   - Restituir no estado recebido
   - Não modificar sem consentimento
   - Permitir vistoria
12. MULTA POR RESCISÃO ANTECIPADA - proporcional ao tempo restante (art. 4º)
13. DIREITO DE PREFERÊNCIA - em caso de venda do imóvel (arts. 27 a 34)
14. DENÚNCIA - prazos e formas conforme art. 46 (prazo determinado) e art. 47 (prazo indeterminado)
15. AÇÃO DE DESPEJO - hipóteses (arts. 9 e 59)
16. RENOVATÓRIA (comercial) - requisitos do art. 51
17. LGPD
18. FORO`;

    default:
      return "";
  }
}

function getPerfilInstrucoes(perfil: string, tipo: string): string {
  const isLocacao = tipo === "locacao";
  const partePrincipal = isLocacao ? "LOCADOR" : "VENDEDOR";
  const parteSecundaria = isLocacao ? "LOCATÁRIO" : "COMPRADOR";

  switch (perfil) {
    case "blindagem_vendedor":
      return isLocacao
        ? `PERFIL: BLINDAGEM MÁXIMA PARA O LOCADOR

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. GARANTIA REFORÇADA:
   - Exigir caução de 3 meses de aluguel (máximo legal)
   - Alternativamente, exigir fiador com imóvel quitado na mesma comarca
   - Cláusula de substituição de garantia em caso de insuficiência

2. MULTA RESCISÓRIA AGRAVADA:
   - Multa de 3 aluguéis vigentes em caso de rescisão antecipada pelo locatário
   - SEM redução proporcional ao tempo cumprido (afastar art. 4º quando possível)

3. BENFEITORIAS:
   - PROIBIR qualquer benfeitoria sem autorização EXPRESSA E POR ESCRITO do locador
   - Renúncia expressa ao direito de indenização por benfeitorias úteis e voluptuárias
   - Renúncia ao direito de retenção (art. 35 Lei 8.245/91)

4. VISTORIA E DEVOLUÇÃO:
   - Devolução no EXATO estado da vistoria inicial, sob pena de cobrança integral dos reparos
   - Prazo de 48h para desocupação após notificação por inadimplência

5. REAJUSTE:
   - Índice mais favorável ao locador (IGPM ou IPCA, o que for maior)
   - Cláusula de revisional antecipada se defasagem superior a 20%

6. INADIMPLÊNCIA:
   - Multa moratória de 10% + juros de 1% a.m. + correção monetária
   - Vencimento antecipado de TODAS as obrigações
   - Perda da caução em favor do locador
   - Despejo liminar por falta de pagamento (art. 59, §1º, IX)

7. SOLIDARIEDADE - todos os locatários são solidariamente responsáveis

8. VEDAÇÕES AO LOCATÁRIO:
   - Proibida cessão, sublocação ou empréstimo do imóvel
   - Proibida alteração da destinação
   - Proibida guarda de materiais inflamáveis ou perigosos
   - Proibido uso que perturbe vizinhos`

        : `PERFIL: BLINDAGEM MÁXIMA PARA O ${partePrincipal}

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. ARRAS CONFIRMATÓRIAS (art. 418 CC):
   - Em caso de rescisão pelo ${parteSecundaria}, NÃO haverá devolução dos valores pagos a título de arras
   - As arras serão RETIDAS integralmente como pré-fixação de perdas e danos
   - O ${partePrincipal} poderá ainda cobrar indenização suplementar se o prejuízo exceder o valor das arras (art. 419 CC)

2. BENFEITORIAS - VEDAÇÃO TOTAL:
   - PROIBIR qualquer benfeitoria no imóvel até a quitação integral
   - Caso o ${parteSecundaria} realize benfeitorias sem autorização, estas NÃO serão indenizadas em hipótese alguma
   - Todas as benfeitorias aderirão ao imóvel em favor do ${partePrincipal}
   - Renúncia expressa ao direito de retenção por benfeitorias (arts. 1.219 e 1.220 CC)

3. POSSE PRECÁRIA:
   - Conceder apenas posse PRECÁRIA e DIRETA até a quitação integral
   - A posse é exercida a título de COMODATO/TOLERÂNCIA vinculada ao contrato
   - Em hipótese alguma a posse será considerada "ad usucapionem"
   - Proibida cessão, empréstimo ou sublocação da posse a terceiros

4. RESCISÃO PELO ${parteSecundaria}:
   - Perda integral das arras e de TODOS os valores pagos a qualquer título
   - Multa compensatória de 20% a 30% do valor total do contrato
   - Pagamento de aluguel mensal pelo período de ocupação (valor de mercado ou % do valor do imóvel/mês)
   - Indenização por danos ao imóvel
   - Prazo de 30 dias para desocupação sob pena de multa diária

5. CLÁUSULA RESOLUTIVA EXPRESSA:
   - A falta de pagamento de QUALQUER parcela por mais de 30 dias importará na resolução de pleno direito
   - Notificação extrajudicial com prazo de 15 dias para purgação da mora
   - Após o prazo, resolução automática sem necessidade de interpelação judicial

6. CLÁUSULA PENAL MORATÓRIA REFORÇADA:
   - Multa de 10% sobre a parcela em atraso
   - Juros de mora de 1% ao mês
   - As parcelas são de valor FIXO, SEM correção monetária
   - Vencimento antecipado de TODAS as parcelas vincendas

7. MANUTENÇÃO E ENCARGOS:
   - TODAS as despesas de manutenção, conservação e reparos são do ${parteSecundaria} desde a imissão na posse
   - IPTU, taxas, condomínio e quaisquer tributos são do ${parteSecundaria}
   - Seguro do imóvel por conta do ${parteSecundaria}

8. ESCRITURA:
   - Somente após quitação integral de TODAS as obrigações
   - TODAS as despesas (ITBI, emolumentos, certidões, registro) por conta exclusiva do ${parteSecundaria}
   - Prazo de 90 dias após quitação para lavratura da escritura

9. CESSÃO DE DIREITOS:
   - PROIBIDA cessão de direitos pelo ${parteSecundaria} sem anuência EXPRESSA E POR ESCRITO do ${partePrincipal}
   - Em caso de cessão autorizada, o ${parteSecundaria} original permanece solidariamente responsável

10. PROCURAÇÃO IRREVOGÁVEL:
    - O ${parteSecundaria} outorga procuração irrevogável ao ${partePrincipal} para fins de resolução contratual e retomada da posse em caso de inadimplemento`;

    case "blindagem_comprador":
      return isLocacao
        ? `PERFIL: BLINDAGEM MÁXIMA PARA O LOCATÁRIO

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. ESTABILIDADE DA LOCAÇÃO:
   - Prazo mínimo de 30 meses (garante denúncia vazia apenas ao final)
   - Renovação automática por prazo indeterminado (art. 46 §1º)
   - Direito de preferência em caso de venda (arts. 27-34) com averbação na matrícula

2. BENFEITORIAS:
   - Direito a indenização por benfeitorias necessárias E úteis
   - Direito de retenção até pagamento (art. 35)
   - Benfeitorias úteis autorizadas previamente de forma ampla

3. MULTA PROPORCIONAL:
   - Multa rescisória proporcional ao tempo restante (art. 4º Lei 8.245/91)
   - SEM multa se a rescisão decorrer de transferência de emprego

4. GARANTIAS DO LOCADOR:
   - Locador declara e garante ser proprietário legítimo
   - Locador apresenta matrícula atualizada e certidões negativas
   - Em caso de venda, novo proprietário deve respeitar o contrato (art. 8º com averbação)

5. MANUTENÇÃO:
   - Reparos estruturais por conta do locador
   - Vícios anteriores à locação por conta do locador
   - Prazo de 48h para reparos emergenciais pelo locador

6. PENALIDADES AO LOCADOR:
   - Multa de 3 aluguéis se retomar o imóvel indevidamente
   - Indenização por lucros cessantes em caso de locação comercial
   - Devolução em dobro de valores cobrados indevidamente

7. RENOVATÓRIA (COMERCIAL):
   - Direito à renovatória (art. 51) com prazo mínimo de 5 anos
   - Proteção ao ponto comercial e fundo de comércio`

        : `PERFIL: BLINDAGEM MÁXIMA PARA O ${parteSecundaria}

DIRETRIZES IMPERATIVAS - aplique TODAS estas proteções:

1. GARANTIA DE ESCRITURA:
   - Em caso de impossibilidade de outorga de escritura pelo ${partePrincipal}, este deverá:
      a) Devolver TODOS os valores pagos
      b) Acrescidos de multa compensatória de 20% do valor total do contrato
      c) Juros legais de 1% ao mês desde a citação
   - Prazo máximo de 30 dias para devolução integral

2. EVICÇÃO INTEGRAL:
   - O ${partePrincipal} assume responsabilidade INTEGRAL e ILIMITADA pela evicção (art. 447 CC)
   - Inclui restituição do preço atualizado, despesas do contrato, custas judiciais, honorários e lucros cessantes
   - Renúncia à limitação do art. 449 CC (evicção parcial)

3. POSSE DEFINITIVA:
   - Posse DEFINITIVA, JUSTA e de BOA-FÉ imediatamente após assinatura do contrato e pagamento do sinal
   - Posse com natureza "ad usucapionem" desde a imissão
   - Direito de uso, gozo, fruição e disposição do imóvel

4. ADJUDICAÇÃO COMPULSÓRIA:
   - Garantia expressa de adjudicação compulsória (art. 1.418 CC)
   - O contrato vale como título para registro e serve de base para adjudicação
   - Referência à Súmula 239 STJ (dispensa registro do compromisso)

5. DIREITO DE RETENÇÃO:
   - Direito de retenção por benfeitorias necessárias e úteis (art. 1.219 CC)
   - Indenização integral por benfeitorias necessárias realizadas
   - Autorização ampla para benfeitorias úteis e necessárias

6. CLÁUSULA PENAL EM FAVOR DO ${parteSecundaria}:
   - Multa de 30% do valor total por descumprimento pelo ${partePrincipal}
   - Multa diária de 0,5% do valor do imóvel por atraso na entrega da posse
   - Multa diária de 0,1% por atraso na outorga de escritura após quitação

8. RESCISÃO PELO ${partePrincipal}:
   - Devolução integral de TODOS os valores pagos
   - Acrescidos de correção monetária e juros
   - Multa compensatória de 20% do valor total
   - Indenização por benfeitorias e acessões
   - Prazo de 180 dias de permanência na posse após notificação

9. IRRETRATABILIDADE REFORÇADA:
   - Contrato irrevogável e irretratável por ambas as partes
   - Cláusula penal em caso de arrependimento do ${partePrincipal}
   - Vedação de venda a terceiros durante a vigência

10. SUCESSÃO:
    - Direitos e obrigações transmissíveis aos herdeiros e sucessores
    - Em caso de falecimento do ${partePrincipal}, herdeiros devem cumprir o contrato`;

    case "equilibrado":
    default:
      return `PERFIL: CONTRATO EQUILIBRADO E JUSTO

DIRETRIZES - aplique equilíbrio em TODAS as cláusulas:

1. ARRAS CONFIRMATÓRIAS (regra padrão do art. 418 CC):
   - Rescisão pelo ${parteSecundaria}: perda das arras em favor do ${partePrincipal}
   - Rescisão pelo ${partePrincipal}: devolução das arras em dobro ao ${parteSecundaria}

2. MULTAS RECÍPROCAS E PROPORCIONAIS:
   - Multa compensatória de 10% do valor total para AMBAS as partes
   - Multa moratória de 2% sobre parcela em atraso
   - Juros de mora de 1% ao mês
   - Parcelas com valores FIXOS, SEM correção monetária por qualquer índice

3. BENFEITORIAS:
   - Necessárias: sempre indenizáveis com direito de retenção
   - Úteis: indenizáveis se previamente autorizadas por escrito
   - Voluptuárias: não indenizáveis, podem ser levantadas sem dano ao imóvel

4. POSSE:
   - Posse provisória vinculada ao contrato após pagamento do sinal
   - Conversão em posse definitiva após quitação integral

5. RESCISÃO COM NOTIFICAÇÃO:
   - Notificação extrajudicial com prazo de 30 dias para purgação da mora
   - Em caso de resolução: devolução dos valores pagos com desconto de 10% a título de cláusula penal e despesas administrativas

6. ENCARGOS REPARTIDOS:
   - ITBI por conta do ${parteSecundaria} (praxe de mercado)
   - Certidões e emolumentos repartidos igualmente
   - Tributos: ${partePrincipal} até a imissão na posse, ${parteSecundaria} após

7. EVICÇÃO:
   - Responsabilidade conforme regras gerais do Código Civil (arts. 447-457)

8. CERTIDÕES:
   - ${partePrincipal} apresenta certidões básicas do imóvel e pessoais
   - Prazo razoável de 30 dias para apresentação

9. ESCRITURA:
   - Outorga em prazo razoável após quitação (60 dias)
   - Despesas de escritura e registro por conta do ${parteSecundaria}

10. BOA-FÉ E FUNÇÃO SOCIAL:
    - Interpretação conforme princípios da boa-fé objetiva (art. 422 CC)
    - Função social do contrato (art. 421 CC)
    - Vedação ao enriquecimento sem causa`;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { contrato } = body ?? {};
    if (!contrato) throw new Error("Missing 'contrato' in request body");

    const tipoLabel = tipoLabels[contrato.tipoContrato] || "Contrato Imobiliário";
    const clausulasTipo = getClausulasEspecificasTipo(contrato.tipoContrato);
    const perfilTexto = getPerfilInstrucoes(contrato.perfilContrato || "equilibrado", contrato.tipoContrato);

    const systemPrompt = `Você é um advogado sênior especialista em direito imobiliário brasileiro, com mais de 20 anos de experiência na elaboração de minutas contratuais para escritórios de advocacia de alto padrão. Sua tarefa é gerar minutas contratuais COMPLETAS, PROFISSIONAIS e JURIDICAMENTE BLINDADAS.

${perfilTexto}

${clausulasTipo}

REGRAS GERAIS DE REDAÇÃO:
- Linguagem jurídica formal brasileira, precisa e sem ambiguidades
- Usar terminologia técnica correta (promitente vendedor/comprador, cedente/cessionário, locador/locatário)
- Qualificar COMPLETAMENTE todas as partes com TODOS os dados fornecidos (nome, nacionalidade, profissão, estado civil, regime de bens se casado, RG/CNH, CPF, filiação, endereço completo)
- Se houver cônjuge, qualificá-lo como interveniente-anuente
- Numerar as cláusulas: CLÁUSULA PRIMEIRA, CLÁUSULA SEGUNDA, etc.
- Subdividir parágrafos: Parágrafo Primeiro, Parágrafo Segundo ou §1º, §2º
- Incluir alíneas quando necessário: a), b), c)

LEGISLAÇÃO APLICÁVEL (citar quando pertinente):
- Código Civil Brasileiro (Lei 10.406/2002)
- Lei de Registros Públicos (Lei 6.015/73)
- Lei do Inquilinato (Lei 8.245/91) - para locação
- Código de Defesa do Consumidor quando aplicável
- Lei Geral de Proteção de Dados (Lei 13.709/2018)
- Estatuto da Cidade (Lei 10.257/2001) quando aplicável

ESTRUTURA OBRIGATÓRIA DO DOCUMENTO:
1. Título e identificação do tipo de contrato
2. Preâmbulo com qualificação completa de TODAS as partes
3. Cláusulas numeradas cobrindo TODOS os temas listados acima
4. Cláusula LGPD sobre tratamento de dados pessoais
5. Cláusula de foro de eleição
6. Disposições finais (comunicações, prazos, integralidade)
7. Local e data
8. Espaço para assinaturas das partes (com nome completo e CPF abaixo)
9. Espaço para 2 testemunhas (com nome, CPF e assinatura)
10. Aviso: "Este instrumento particular tem força de escritura pública nos termos do art. 462 do Código Civil."
11. Nota final: "RECOMENDA-SE A REVISÃO DESTE INSTRUMENTO POR ADVOGADO DE CONFIANÇA DAS PARTES."

IMPORTANTE: 
- Gere APENAS o texto do contrato, sem comentários ou explicações extras
- O contrato deve estar PRONTO PARA ASSINATURA
- Seja EXTENSO e DETALHADO - um contrato profissional tem no mínimo 5-8 páginas
- NÃO omita cláusulas por brevidade
- NÃO use formatação markdown (asteriscos, hashtags, etc). O texto deve ser PURO, sem nenhum caractere de formatação como *, **, #, ##, ---, etc.
- Use APENAS texto simples com letras maiúsculas para ênfase quando necessário
- Títulos de cláusulas em LETRAS MAIÚSCULAS sem qualquer marcação
- Descreva o imóvel objeto do contrato em um bloco separado identificado por "IMÓVEL:" no início
- REGRA OBRIGATÓRIA SOBRE PARCELAS: Todas as parcelas do contrato têm valores FIXOS e NOMINAIS. NÃO inclua cláusula de correção monetária, atualização ou reajuste das parcelas por qualquer índice (INPC, IGPM, IPCA ou outro). As multas moratórias e compensatórias devem ser mantidas normalmente.

REGRAS DE QUALIDADE E SEGURANÇA:
- NUNCA inventar dados que não foram fornecidos. Se uma informação não foi fornecida, NÃO preencha com dados fictícios.
- NÃO deixar lacunas genéricas como "a definir", "[preencher]" ou "conforme acordo". Use APENAS os dados efetivamente fornecidos.
- Garantir COERÊNCIA TOTAL entre todas as cláusulas do contrato. Valores, prazos, condições e referências a partes devem ser consistentes do início ao fim.
- Quando dados foram extraídos automaticamente de documentos, utilizá-los normalmente, mas NUNCA sobrescrever dados já preenchidos manualmente pelo operador.
- Evitar termos genéricos — ser específico e preciso em todas as cláusulas.`;

    const peculiaridadesBlock = contrato.peculiaridades
      ? `\n\nPECULIARIDADES INFORMADAS PELO OPERADOR (CRIAR CLÁUSULAS ESPECÍFICAS PARA CADA UMA):
${contrato.peculiaridades}

INSTRUÇÃO: Analise cada peculiaridade acima e crie uma ou mais cláusulas específicas para tratar dessas situações especiais, fundamentadas na legislação aplicável. Insira essas cláusulas no local mais adequado do contrato (não no final como apêndice).`
      : "";

    const userPrompt = `Gere um ${tipoLabel} completo e profissional com os seguintes dados:

DADOS DO CONTRATO:
${JSON.stringify(contrato, null, 2)}
${peculiaridadesBlock}

Gere a minuta completa com TODAS as cláusulas obrigatórias listadas nas instruções, qualificação detalhada das partes com todos os dados fornecidos, e espaço para assinaturas e testemunhas.`;

    const requestedProvider = getProviderFromRequest(body);
    const provider = requestedProvider ?? getDefaultProvider();
    const failover = isFailoverEnabled();

    const tryOrder: AiProvider[] = provider === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
    let lastError: unknown = null;
    let minuta = "";

    for (const p of tryOrder) {
      try {
        if (p === "openai") {
          const key = Deno.env.get("OPENAI_API_KEY");
          if (!key) throw new Error("OPENAI_API_KEY is not configured");
          const model = Deno.env.get("OPENAI_MODEL_CONTRACT") || "gpt-4o";
          minuta = await callOpenAiText({ apiKey: key, model, systemPrompt, userPrompt });
        } else {
          const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
          if (!key) throw new Error("GEMINI_API_KEY is not configured");
          const model = Deno.env.get("GEMINI_MODEL_CONTRACT") || "gemini-2.0-pro";
          minuta = await callGeminiText({ apiKey: key, model, systemPrompt, userPrompt });
        }
        break;
      } catch (e) {
        lastError = e;
        if (!failover) break;
      }
    }

    if (!minuta) {
      throw lastError instanceof Error ? lastError : new Error("Erro ao gerar contrato");
    }
    
    // Strip any remaining markdown formatting
    minuta = minuta.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^-{3,}$/gm, "").replace(/`/g, "");

    return new Response(JSON.stringify({ minuta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-contract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
