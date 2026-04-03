# Arquitetura do Projeto (RUI)

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Componentes UI no padrão shadcn/ui (em `src/components/ui`)
- Supabase (Database + Storage + Edge Functions)
- React Router (rotas)
- Notificações: Sonner + shadcn/toast

## Estrutura de Pastas

- `src/App.tsx`: composição dos providers globais e definição de rotas
- `src/pages/*`: páginas (orquestram estado, efeitos e integração com Supabase)
- `src/components/ui/*`: primitives e componentes shadcn/ui
- `src/components/contract/*`: wizard/steps para coleta e geração de contratos
- `src/components/proposal/*`: wizard/steps para proposta imobiliária
- `src/integrations/supabase/*`: cliente e tipagens do banco
- `src/types/*`: tipos de domínio (`contract`, `proposal`)
- `supabase/functions/*`: Edge Functions (IA/geração)
- `supabase/migrations/*`: schema do banco (tabelas/policies/buckets)

## Rotas Principais

Definidas em `src/App.tsx`:

- `/` → `src/pages/Index.tsx` → `src/pages/Dashboard.tsx`
- `/contrato/:tipo` → `src/pages/ContratoPage.tsx` → `src/components/contract/ContractWizard.tsx`
- `/coleta/:token` → `src/pages/ColetaPage.tsx`
- `/painel` → `src/pages/PainelSubmissoes.tsx`
- `/imobiliarias` → `src/pages/ImobiliariasPage.tsx`
- `/proposta/:token` → `src/pages/PropostaPage.tsx`
- `/relatorios` → `src/pages/RelatoriosPage.tsx`
- `*` → `src/pages/NotFound.tsx`

## Como os Dados Fluem

### Padrão geral (UI)

- A página/wizard mantém o estado principal com `useState`.
- Cada passo (`Step*`) recebe `value`/`onChange` via props.
- Componentes de formulário (ex.: `PessoaForm`) emitem alterações via `onChange` e a página consolida o objeto final.

Em termos práticos:

`Page/Wizard` → passa `dados` e callbacks → `Step` → passa `pessoa/imóvel/pagamento` → `Form` → `onChange` → sobe para o `Page/Wizard`.

### Fluxo: criação e coleta de dados (Contrato)

1. `Dashboard` cria um registro em `public.submissions` (`insert`) e gera um link:
   - Link: `/coleta/:token`
   - O `token` é gerado no banco.
2. `ColetaPage` busca a submission por `token` (`select`) e inicializa o estado do wizard a partir de `submissions.dados`.
3. A cada avanço de step, o rascunho pode ser salvo em background (`update`) enquanto `status` estiver `rascunho`.
4. Ao final, `ColetaPage` marca `status = "enviado"` (`update`).

### Fluxo: geração de minuta (Contrato)

1. No `PainelSubmissoes`, ao clicar em “Gerar Contrato”, navega para:
   - `/contrato/:tipo?submissionId=<id>`
2. `ContractWizard` carrega `submissions.dados` via `submissionId` e posiciona o usuário no step “Perfil” quando já existem dados.
3. No step “Gerar”, o wizard monta o payload `contrato` e chama:
   - `supabase.functions.invoke("generate-contract", { body: { contrato } })`
4. A minuta gerada fica no estado local (`minuta`) e pode ser copiada/baixada (.txt) e exportada para `.docx` via:
   - `supabase.functions.invoke("generate-docx", { body: { minuta, tipoContrato } })`

### Fluxo: proposta imobiliária

1. `PainelSubmissoes` cria um registro em `public.propostas` e gera link:
   - `/proposta/:token`
2. `PropostaPage` busca `propostas` por `token` e executa um wizard com steps.
3. `StepDocumentos` faz upload para `Supabase Storage` no bucket `proposta-docs` e mantém a lista no estado da página para persistir em `propostas.documentos`.
4. Ao enviar, `PropostaPage` marca `status = "enviado"`.
5. Após envio, a página permite gerar texto de proposta via:
   - `supabase.functions.invoke("generate-proposal", { body: { dados, tipoContrato, imobiliaria } })`
6. O texto pode ser editado no `ProposalEditor` (“Modo Advogado”) e salvo em `propostas.proposta_texto`. Também exporta `.docx` via `generate-docx`.

### Fluxo: extração de documentos (IA)

- Em `PessoaForm`, o usuário anexa imagens/PDF e a página chama:
  - `supabase.functions.invoke("extract-document", { body: { images } })`
- O retorno é mesclado no estado da `Pessoa` sem sobrescrever campos já preenchidos.

### Fluxo: relatórios

- `RelatoriosPage` carrega:
  - `propostas`, `submissions` e `imobiliarias`
- Os filtros e KPIs são calculados via `useMemo` no front, usando os campos `dados` (json) para extrair valores.

## Modelo de Dados (Supabase)

Tipagens estão em `src/integrations/supabase/types.ts` e schema em `supabase/migrations/*`.

- `public.submissions`
  - `token` (link), `tipo_contrato`, `corretor_*`, `dados` (jsonb), `status`, `imobiliaria_id`
- `public.propostas`
  - `token` (link), `corretor_*`, `imobiliaria_nome`, `dados` (jsonb), `documentos` (jsonb), `proposta_texto`, `status`
- `public.imobiliarias`
  - cadastro de imobiliárias (nome, creci, endereço, etc.)
- `storage.proposta-docs`
  - bucket público para anexos de proposta

## Gerenciamento de Estado e Efeitos

- Estado: `useState` local (pages/wizards) + props para steps
- Efeitos: `useEffect` para carregar dados do Supabase e salvar rascunhos
- Existe `QueryClientProvider` no `App.tsx`, mas o padrão atual dos fluxos principais não usa `useQuery/useMutation` (predomina `useEffect` + `useState`)

