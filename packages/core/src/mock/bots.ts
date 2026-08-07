/**
 * Base de demonstração — projetos de chatbot.
 *
 * O documento do fluxo (nós + arestas) é versionado. A versão publicada é
 * imutável; o rascunho é onde a edição acontece (seção 12 do plano).
 */

import type { BotFlow, BotNode, FlowEdge } from "../types/automation";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

const triagemNodes: BotNode[] = [
  {
    id: "bn_01",
    kind: "inicio",
    label: "Mensagem recebida",
    summary: "WhatsApp Atendimento · fora de conversa ativa",
    position: { x: 0, y: 260 },
    config: {
      gatilho: "mensagem_recebida",
      canal: "whatsapp",
      numero: "+55 11 3000-1000",
    },
    outputs: [{ id: "out", label: "Início" }],
  },
  {
    id: "bn_02",
    kind: "mensagem",
    label: "Saudação",
    summary: "Olá, {{contato.primeiro_nome}}! Sou o assistente da Contabilidade Facilitada.",
    position: { x: 280, y: 260 },
    config: {
      texto:
        "Olá, {{contato.primeiro_nome}}! Sou o assistente da Contabilidade Facilitada. Vou te direcionar em instantes.",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "bn_03",
    kind: "pergunta",
    label: "Menu de assunto",
    summary: "Lista com 4 opções · variável assunto",
    position: { x: 560, y: 260 },
    config: {
      pergunta: "Sobre qual assunto você precisa de ajuda?",
      variavel: "assunto",
      tipo: "selecao",
      opcoes: ["Fiscal e impostos", "Boletos e financeiro", "Documentos", "Falar com atendente"],
      timeoutMinutos: 10,
    },
    outputs: [
      { id: "fiscal", label: "Fiscal e impostos" },
      { id: "financeiro", label: "Boletos e financeiro" },
      { id: "documentos", label: "Documentos" },
      { id: "humano", label: "Falar com atendente" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ],
  },
  {
    id: "bn_04",
    kind: "ia",
    label: "Classificar intenção fiscal",
    summary: "Saída estruturada · schema intencao_fiscal",
    position: { x: 860, y: 40 },
    config: {
      tarefa: "classificacao",
      intencoes: [
        "segunda via de guia",
        "dúvida sobre imposto",
        "documento pendente",
        "outro assunto",
      ],
      instrucao:
        "Leia a última mensagem e classifique o assunto fiscal. Não confirme nem conteste valores — só direcione.",
      acoes: ["consultar_crm", "buscar_conhecimento", "transferir_humano"],
      modelo: "gemini-2.5-flash",
      temperatura: 0.15,
      confiancaMinima: 75,
      variavel: "intencao",
      custoMaximoCentavos: 8,
      timeoutSegundos: 10,
    },
    outputs: [
      { id: "segunda_via_de_guia", label: "segunda via de guia" },
      { id: "duvida_sobre_imposto", label: "dúvida sobre imposto" },
      { id: "documento_pendente", label: "documento pendente" },
      { id: "outro_assunto", label: "outro assunto" },
      { id: "erro", label: "Falha ou baixa confiança", fallback: true },
    ],
  },
  {
    id: "bn_05",
    kind: "condicao",
    label: "É cliente ativo?",
    summary: "contato.ciclo_de_vida = cliente",
    position: { x: 1140, y: 40 },
    config: {
      campo: "contato.ciclo_de_vida",
      operador: "igual_a",
      valor: "cliente",
      simulationPort: "sim",
    },
    outputs: [
      { id: "sim", label: "Sim" },
      { id: "nao", label: "Não" },
    ],
  },
  {
    id: "bn_06",
    kind: "crm",
    label: "Marcar prioridade",
    summary: "Adiciona a tag Urgente ao contato",
    position: { x: 1420, y: -80 },
    config: {
      acao: "adicionar_tag",
      tag: "Urgente",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "bn_07",
    kind: "transferir",
    label: "Transferir — Suporte fiscal",
    summary: "Com resumo do atendimento e SLA de 15 min",
    position: { x: 1700, y: 40 },
    config: {
      fila: "Suporte fiscal",
      prioridade: "alta",
      incluirResumo: true,
    },
    outputs: [],
  },
  {
    id: "bn_08",
    kind: "http",
    label: "Consultar boleto no ERP",
    summary: "GET /financeiro/boletos · timeout 8s",
    position: { x: 860, y: 320 },
    config: {
      metodo: "GET",
      url: "https://erp.interno/financeiro/boletos?documento={{contato.documento}}",
      timeoutSegundos: 8,
      credencial: "erp_financeiro",
    },
    outputs: [
      { id: "sucesso", label: "Encontrado" },
      { id: "falha", label: "Erro ou não encontrado", fallback: true },
    ],
  },
  {
    id: "bn_09",
    kind: "mensagem",
    label: "Enviar 2ª via",
    summary: "Documento anexado + link de pagamento",
    position: { x: 1140, y: 320 },
    config: {
      texto: "Aqui está a segunda via do seu boleto com vencimento em {{boleto.vencimento}}.",
      anexo: "{{boleto.arquivo}}",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "bn_10",
    kind: "pergunta",
    label: "Qual documento?",
    summary: "Texto livre · variável documento_solicitado",
    position: { x: 860, y: 600 },
    config: {
      pergunta: "Qual documento você precisa? Pode descrever com suas palavras.",
      variavel: "documento_solicitado",
      tipo: "texto",
      timeoutMinutos: 15,
    },
    outputs: [
      { id: "out", label: "Respondido" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ],
  },
  {
    id: "bn_11",
    kind: "transferir",
    label: "Transferir — Regularização",
    summary: "Fila de regularização documental",
    position: { x: 1140, y: 600 },
    config: {
      fila: "Regularização documental",
      prioridade: "normal",
      incluirResumo: true,
    },
    outputs: [],
  },
  {
    id: "bn_12",
    kind: "finalizar",
    label: "Encerrar sessão",
    summary: "Registra resultado e dispara evento bot.session_ended",
    position: { x: 1420, y: 320 },
    config: {
      resultado: "resolvido_pelo_bot",
      resolverConversa: true,
    },
    outputs: [],
  },
];

const triagemEdges: FlowEdge[] = [
  { id: "be_01", source: "bn_01", sourcePort: "out", target: "bn_02" },
  { id: "be_02", source: "bn_02", sourcePort: "out", target: "bn_03" },
  { id: "be_03", source: "bn_03", sourcePort: "fiscal", target: "bn_04", label: "Fiscal" },
  { id: "be_04", source: "bn_03", sourcePort: "financeiro", target: "bn_08", label: "Financeiro" },
  { id: "be_05", source: "bn_03", sourcePort: "documentos", target: "bn_10", label: "Documentos" },
  { id: "be_06", source: "bn_03", sourcePort: "humano", target: "bn_07", label: "Atendente" },
  { id: "be_07", source: "bn_03", sourcePort: "sem_resposta", target: "bn_12", label: "Timeout" },
  // A classificação abre um ramo por intenção: é o que a IA decide, não uma
  // saída única "ok" que jogaria tudo no mesmo caminho.
  { id: "be_08", source: "bn_04", sourcePort: "segunda_via_de_guia", target: "bn_05" },
  { id: "be_08b", source: "bn_04", sourcePort: "duvida_sobre_imposto", target: "bn_05" },
  { id: "be_08c", source: "bn_04", sourcePort: "documento_pendente", target: "bn_10" },
  { id: "be_08d", source: "bn_04", sourcePort: "outro_assunto", target: "bn_07" },
  { id: "be_09", source: "bn_04", sourcePort: "erro", target: "bn_07", label: "Fallback" },
  { id: "be_10", source: "bn_05", sourcePort: "sim", target: "bn_06", label: "Sim" },
  { id: "be_11", source: "bn_05", sourcePort: "nao", target: "bn_07", label: "Não" },
  { id: "be_12", source: "bn_06", sourcePort: "out", target: "bn_07" },
  { id: "be_13", source: "bn_08", sourcePort: "sucesso", target: "bn_09" },
  { id: "be_14", source: "bn_08", sourcePort: "falha", target: "bn_07", label: "Fallback" },
  { id: "be_15", source: "bn_09", sourcePort: "out", target: "bn_12" },
  { id: "be_16", source: "bn_10", sourcePort: "out", target: "bn_11" },
  { id: "be_17", source: "bn_10", sourcePort: "sem_resposta", target: "bn_12", label: "Timeout" },
];

/**
 * O rascunho carrega um bloco novo ainda não conectado, para exercitar a
 * validação de publicação: caminho sem saída (erro) e nó inalcançável (alerta).
 */
const triagemDraftNodes: BotNode[] = [
  ...triagemNodes,
  {
    id: "bn_13",
    kind: "ia",
    label: "Resumo para o atendente",
    summary: "Gera resumo do histórico antes do transbordo",
    position: { x: 1420, y: 180 },
    config: {
      tarefa: "resumo",
      instrucao:
        "Resuma o atendimento em até 4 linhas para quem vai assumir: o que o cliente quer, o que já foi verificado e o que falta.",
      acoes: ["consultar_crm"],
      modelo: "gemini-2.5-flash-lite",
      temperatura: 0.3,
      custoMaximoCentavos: 12,
      timeoutSegundos: 15,
    },
    outputs: [
      { id: "ok", label: "Resumo pronto" },
      { id: "erro", label: "Falha", fallback: true },
    ],
  },
];

const qualificacaoNodes: BotNode[] = [
  {
    id: "qn_01",
    kind: "inicio",
    label: "Lead entrou pelo anúncio",
    summary: "Instagram e WhatsApp Comercial",
    position: { x: 0, y: 200 },
    config: { gatilho: "mensagem_recebida", canal: "instagram" },
    outputs: [{ id: "out", label: "Início" }],
  },
  {
    id: "qn_02",
    kind: "mensagem",
    label: "Boas-vindas",
    summary: "Apresenta a simulação gratuita",
    position: { x: 280, y: 200 },
    config: {
      texto:
        "Que bom te ver por aqui! Posso fazer uma simulação gratuita do regime tributário ideal para o seu negócio. Vamos lá?",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "qn_03",
    kind: "pergunta",
    label: "Faturamento mensal",
    summary: "Número · variável faturamento",
    position: { x: 560, y: 200 },
    config: {
      pergunta: "Qual é o faturamento médio mensal da empresa?",
      variavel: "faturamento",
      tipo: "numero",
      timeoutMinutos: 20,
    },
    outputs: [
      { id: "out", label: "Respondido" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ],
  },
  {
    id: "qn_04",
    kind: "pergunta",
    label: "Folha de pagamento",
    summary: "Número · variável folha",
    position: { x: 840, y: 200 },
    config: {
      pergunta: "E qual é o valor da folha de pagamento, incluindo pró-labore?",
      variavel: "folha",
      tipo: "numero",
      timeoutMinutos: 20,
    },
    outputs: [
      { id: "out", label: "Respondido" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ],
  },
  {
    id: "qn_05",
    kind: "variavel",
    label: "Calcular fator R",
    summary: "fator_r = folha / faturamento",
    position: { x: 1120, y: 200 },
    config: {
      nome: "fator_r",
      expressao: "folha / faturamento",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "qn_06",
    kind: "condicao",
    label: "Fator R ≥ 28%?",
    summary: "Define o caminho da recomendação",
    position: { x: 1400, y: 200 },
    config: {
      campo: "fator_r",
      operador: "maior_ou_igual",
      valor: "0.28",
      simulationPort: "sim",
    },
    outputs: [
      { id: "sim", label: "Sim" },
      { id: "nao", label: "Não" },
    ],
  },
  {
    id: "qn_07",
    kind: "mensagem",
    label: "Recomendar Anexo III",
    summary: "Simples Nacional tende a ser vantajoso",
    position: { x: 1680, y: 60 },
    config: {
      texto:
        "Com esse fator R, o Simples Nacional pelo Anexo III tende a ser mais vantajoso. Vou te passar para um consultor detalhar os números.",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "qn_08",
    kind: "mensagem",
    label: "Recomendar análise comparativa",
    summary: "Presumido pode ser melhor",
    position: { x: 1680, y: 340 },
    config: {
      texto:
        "No seu caso vale comparar Simples e Lucro Presumido com cuidado. Um consultor vai te mostrar os dois cenários.",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "qn_09",
    kind: "crm",
    label: "Criar lead qualificado",
    summary: "Cria negócio no funil de vendas · etapa Qualificação",
    position: { x: 1960, y: 200 },
    config: {
      acao: "criar_negocio",
      funil: "Vendas — contabilidade",
      etapa: "Qualificação",
      proprietario: "roteamento_por_carga",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "qn_10",
    kind: "transferir",
    label: "Transferir — Comercial",
    summary: "Fila comercial com resumo da simulação",
    position: { x: 2240, y: 200 },
    config: {
      fila: "Comercial — novos leads",
      prioridade: "alta",
      incluirResumo: true,
    },
    outputs: [],
  },
  {
    id: "qn_11",
    kind: "aguardar",
    label: "Aguardar 1 dia",
    summary: "Reengajamento de quem abandonou",
    position: { x: 840, y: 460 },
    config: { duracaoHoras: 24 },
    outputs: [{ id: "out", label: "Prazo cumprido" }],
  },
  {
    id: "qn_12",
    kind: "mensagem",
    label: "Reengajar",
    summary: "Template aprovado reengajamento_simulacao",
    position: { x: 1120, y: 460 },
    config: {
      template: "reengajamento_simulacao",
      texto: "Ainda quer terminar sua simulação? Leva menos de 2 minutos.",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "qn_13",
    kind: "finalizar",
    label: "Encerrar sem qualificação",
    summary: "Registra resultado abandono",
    position: { x: 1400, y: 460 },
    config: { resultado: "abandono", resolverConversa: false },
    outputs: [],
  },
];

const qualificacaoEdges: FlowEdge[] = [
  { id: "qe_01", source: "qn_01", sourcePort: "out", target: "qn_02" },
  { id: "qe_02", source: "qn_02", sourcePort: "out", target: "qn_03" },
  { id: "qe_03", source: "qn_03", sourcePort: "out", target: "qn_04" },
  { id: "qe_04", source: "qn_03", sourcePort: "sem_resposta", target: "qn_11", label: "Timeout" },
  { id: "qe_05", source: "qn_04", sourcePort: "out", target: "qn_05" },
  { id: "qe_06", source: "qn_04", sourcePort: "sem_resposta", target: "qn_11", label: "Timeout" },
  { id: "qe_07", source: "qn_05", sourcePort: "out", target: "qn_06" },
  { id: "qe_08", source: "qn_06", sourcePort: "sim", target: "qn_07", label: "Fator R alto" },
  { id: "qe_09", source: "qn_06", sourcePort: "nao", target: "qn_08", label: "Fator R baixo" },
  { id: "qe_10", source: "qn_07", sourcePort: "out", target: "qn_09" },
  { id: "qe_11", source: "qn_08", sourcePort: "out", target: "qn_09" },
  { id: "qe_12", source: "qn_09", sourcePort: "out", target: "qn_10" },
  { id: "qe_13", source: "qn_11", sourcePort: "out", target: "qn_12" },
  { id: "qe_14", source: "qn_12", sourcePort: "out", target: "qn_13" },
];

/**
 * Fluxo do webchat do site.
 *
 * Escrito **para o canal**, não reaproveitado de outro. A diferença que importa:
 * quem chega aqui já preencheu nome, WhatsApp e assunto no formulário, e o fluxo
 * parte disso. Reaproveitar o fluxo de anúncio produzia a conversa sem sentido
 * que motivou este arquivo: o visitante dizia "quero abrir uma empresa" e o bot
 * perguntava o faturamento e a folha de pagamento da empresa que ele ainda não
 * tem.
 *
 * Três decisões de canal:
 *
 * 1. **Respostas rápidas em vez de texto livre.** No site o visitante está com o
 *    mouse na mão; digitar é atrito, e opção clicável também impede resposta que
 *    o fluxo não sabe interpretar.
 * 2. **Sem espera longa.** Bloco de aguardar um dia não existe numa sessão de
 *    navegador: quem fechou a aba não volta para o mesmo chat.
 * 3. **Caminho curto até gente.** O objetivo do webchat é qualificar em três ou
 *    quatro trocas e transferir, não resolver sozinho.
 */
const siteNodes: BotNode[] = [
  {
    id: "wn_01",
    kind: "inicio",
    label: "Visitante abriu o chat do site",
    summary: "Widget do site institucional, com nome e assunto do formulário",
    position: { x: 0, y: 120 },
    config: { gatilho: "webchat_aberto", canal: "webchat" },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "wn_02",
    kind: "mensagem",
    label: "Cumprimentar pelo nome",
    summary: "Usa o nome capturado no formulário",
    position: { x: 260, y: 120 },
    config: {
      texto:
        "Oi, {{contato.nome}}! Vi que seu assunto é {{assunto}}. Deixa eu entender rapidinho para te passar à pessoa certa.",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "wn_03",
    kind: "pergunta",
    label: "Situação atual",
    summary: "Resposta rápida · variável situacao",
    position: { x: 520, y: 120 },
    config: {
      pergunta: "Hoje a sua empresa já existe?",
      variavel: "situacao",
      tipo: "selecao",
      opcoes: ["Ainda não abri", "Já tenho CNPJ", "Sou MEI e quero mudar"],
      timeoutMinutos: 10,
    },
    outputs: [
      { id: "abrir", label: "Ainda não abri" },
      { id: "tem_cnpj", label: "Já tenho CNPJ" },
      { id: "mei", label: "Sou MEI e quero mudar" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ],
  },
  {
    id: "wn_04",
    kind: "pergunta",
    label: "Prazo",
    summary: "Resposta rápida · variável prazo",
    position: { x: 800, y: 0 },
    config: {
      pergunta: "Para quando você precisa disso resolvido?",
      variavel: "prazo",
      tipo: "selecao",
      opcoes: ["Esta semana", "Este mês", "Só pesquisando"],
      timeoutMinutos: 10,
    },
    outputs: [
      { id: "urgente", label: "Esta semana" },
      { id: "mes", label: "Este mês" },
      { id: "pesquisa", label: "Só pesquisando" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ],
  },
  {
    id: "wn_05",
    kind: "pergunta",
    label: "Faixa de faturamento",
    summary: "Resposta rápida · variável faixa",
    position: { x: 800, y: 240 },
    config: {
      pergunta: "Qual a faixa de faturamento mensal hoje?",
      variavel: "faixa",
      tipo: "selecao",
      opcoes: ["Até 10 mil", "10 a 30 mil", "30 a 80 mil", "Acima de 80 mil"],
      timeoutMinutos: 10,
    },
    outputs: [
      { id: "ate10", label: "Até 10 mil" },
      { id: "ate30", label: "10 a 30 mil" },
      { id: "ate80", label: "30 a 80 mil" },
      { id: "acima", label: "Acima de 80 mil" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ],
  },
  {
    id: "wn_06",
    kind: "mensagem",
    label: "Confirmar entendimento",
    summary: "Repete o que foi capturado antes de transferir",
    position: { x: 1080, y: 120 },
    config: {
      texto:
        "Perfeito. Anotei: {{assunto}} · {{situacao}}. Um consultor entra aqui em instantes com essa informação em mãos.",
    },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "wn_07",
    kind: "crm",
    label: "Registrar lead",
    summary: "Cria contato e negócio na etapa Qualificação",
    position: { x: 1340, y: 120 },
    config: { acao: "criar_negocio", funil: "Vendas — contabilidade", etapa: "Qualificação" },
    outputs: [{ id: "out", label: "Continuar" }],
  },
  {
    id: "wn_08",
    kind: "transferir",
    label: "Transferir — Comercial",
    summary: "Fila comercial com o resumo da conversa",
    position: { x: 1600, y: 120 },
    config: { fila: "Comercial — novos leads", prioridade: "alta", incluirResumo: true },
    outputs: [],
  },
  {
    id: "wn_09",
    kind: "finalizar",
    label: "Encerrar sem resposta",
    summary: "Visitante saiu antes de responder",
    position: { x: 800, y: 420 },
    config: { resultado: "abandono", resolverConversa: false },
    outputs: [],
  },
];

const siteEdges: FlowEdge[] = [
  { id: "we_01", source: "wn_01", sourcePort: "out", target: "wn_02" },
  { id: "we_02", source: "wn_02", sourcePort: "out", target: "wn_03" },
  // Quem ainda não abriu não tem faturamento para informar: o caminho pergunta
  // prazo. Perguntar faturamento de empresa inexistente foi exatamente o defeito
  // do fluxo reaproveitado.
  { id: "we_03", source: "wn_03", sourcePort: "abrir", target: "wn_04", label: "Ainda não abri" },
  { id: "we_04", source: "wn_03", sourcePort: "tem_cnpj", target: "wn_05", label: "Já tem CNPJ" },
  { id: "we_05", source: "wn_03", sourcePort: "mei", target: "wn_05", label: "MEI" },
  { id: "we_06", source: "wn_03", sourcePort: "sem_resposta", target: "wn_09", label: "Timeout" },
  { id: "we_07", source: "wn_04", sourcePort: "urgente", target: "wn_06" },
  { id: "we_08", source: "wn_04", sourcePort: "mes", target: "wn_06" },
  { id: "we_09", source: "wn_04", sourcePort: "pesquisa", target: "wn_06" },
  { id: "we_10", source: "wn_04", sourcePort: "sem_resposta", target: "wn_09" },
  { id: "we_11", source: "wn_05", sourcePort: "ate10", target: "wn_06" },
  { id: "we_12", source: "wn_05", sourcePort: "ate30", target: "wn_06" },
  { id: "we_13", source: "wn_05", sourcePort: "ate80", target: "wn_06" },
  { id: "we_14", source: "wn_05", sourcePort: "acima", target: "wn_06" },
  { id: "we_15", source: "wn_05", sourcePort: "sem_resposta", target: "wn_09" },
  { id: "we_16", source: "wn_06", sourcePort: "out", target: "wn_07" },
  { id: "we_17", source: "wn_07", sourcePort: "out", target: "wn_08" },
];

export const botFlows: BotFlow[] = [
  {
    id: "bot_triagem",
    organizationId: ORG_ID,
    name: "Triagem fiscal",
    description:
      "Recebe qualquer mensagem no WhatsApp de atendimento, identifica o assunto e direciona para a fila correta.",
    channels: ["whatsapp", "webchat"],
    limits: {
      maxSteps: 40,
      maxDurationMinutes: 60,
      maxHttpCalls: 5,
      maxAiCostCents: 40,
    },
    activeVersionId: "botv_triagem_3",
    draftVersionId: "botv_triagem_4",
    versions: [
      {
        id: "botv_triagem_3",
        flowId: "bot_triagem",
        version: 3,
        status: "publicado",
        nodes: triagemNodes,
        edges: triagemEdges,
        publishedAt: offsetIso({ days: -11 }),
        publishedBy: "usr_marina",
        changeNote: "Adicionado caminho de documentos e fallback do bloco de IA.",
      },
      {
        id: "botv_triagem_4",
        flowId: "bot_triagem",
        version: 4,
        status: "rascunho",
        nodes: triagemDraftNodes,
        edges: triagemEdges,
        changeNote: "Em construção: resumo gerado por IA antes do transbordo.",
      },
    ],
    stats: {
      sessions30d: 4218,
      resolvedByBotPct: 38,
      handoffPct: 57,
      avgStepsPerSession: 6.4,
    },
    createdAt: offsetIso({ days: -160 }),
    updatedAt: offsetIso({ days: -1 }),
  },
  {
    id: "bot_qualificacao",
    organizationId: ORG_ID,
    name: "Qualificação comercial",
    description:
      "Simula o regime tributário a partir de faturamento e folha, cria o negócio no funil e transfere ao consultor.",
    channels: ["instagram", "whatsapp", "webchat"],
    limits: {
      maxSteps: 30,
      maxDurationMinutes: 2880,
      maxHttpCalls: 3,
      maxAiCostCents: 25,
    },
    activeVersionId: "botv_qualificacao_2",
    draftVersionId: "botv_qualificacao_2",
    versions: [
      {
        id: "botv_qualificacao_2",
        flowId: "bot_qualificacao",
        version: 2,
        status: "publicado",
        nodes: qualificacaoNodes,
        edges: qualificacaoEdges,
        publishedAt: offsetIso({ days: -26 }),
        publishedBy: "usr_bruno",
        changeNote: "Incluído reengajamento em 24h para quem abandona a simulação.",
      },
    ],
    stats: {
      sessions30d: 1873,
      resolvedByBotPct: 21,
      handoffPct: 64,
      avgStepsPerSession: 9.1,
    },
    createdAt: offsetIso({ days: -90 }),
    updatedAt: offsetIso({ days: -26 }),
  },
  {
    id: "bot_webchat_site",
    organizationId: ORG_ID,
    name: "Recepção do site",
    description:
      "Cumprimenta pelo nome, entende a situação em duas perguntas de clique e transfere ao consultor com o resumo.",
    channels: ["webchat"],
    limits: {
      maxSteps: 20,
      // Sessão de navegador, não conversa de dias: meia hora é o horizonte real.
      maxDurationMinutes: 30,
      maxHttpCalls: 2,
      maxAiCostCents: 10,
    },
    activeVersionId: "botv_site_1",
    draftVersionId: "botv_site_1",
    versions: [
      {
        id: "botv_site_1",
        flowId: "bot_webchat_site",
        version: 1,
        status: "publicado",
        nodes: siteNodes,
        edges: siteEdges,
        publishedAt: offsetIso({ days: -21 }),
        publishedBy: "usr_bruno",
        changeNote: "Primeira publicação, escrita para o webchat.",
      },
    ],
    stats: {
      sessions30d: 396,
      resolvedByBotPct: 12,
      handoffPct: 81,
      avgStepsPerSession: 4.2,
    },
    createdAt: offsetIso({ days: -24 }),
    updatedAt: offsetIso({ days: -21 }),
  },
];
