/**
 * Prompts do copiloto — versionados.
 *
 * A seção 16.4 do plano pede prompts versionados e conjunto de avaliação antes
 * de publicar. Enquanto a tabela `ai_prompts` não existe, a versão vive aqui e
 * viaja em `AiRunMeta.promptVersion`: sem isso, uma queda de qualidade depois de
 * um ajuste de texto fica impossível de atribuir.
 *
 * Ao mudar o conteúdo de um prompt, **suba a versão**. É o que permite comparar
 * duas revisões sobre o mesmo conjunto de conversas.
 */

import type { AiConversationContext, AiEmailDraftInput, AiToneAdjustment } from "@crm/core";
import {
  AI_EMAIL_OBJECTIVE_LABEL,
  AI_EMAIL_TONE_LABEL,
  AI_TONE_LABEL,
  formatDateTime,
  offsetIso,
} from "@crm/core";

export const PROMPT_VERSIONS = {
  // v4 acrescentou a tabulação (`proposals`) e o estado do cadastro no contexto.
  analisar_conversa: "copiloto.analise.v4",
  sugerir_resposta: "copiloto.sugestao.v3",
  reescrever: "copiloto.reescrita.v2",
  perguntar: "copiloto.pergunta.v2",
  redigir_email: "studio.email.v1",
} as const;

/**
 * Fundamento comum a todas as tarefas.
 *
 * Três regras carregam quase toda a qualidade: falar de contabilidade
 * brasileira com o vocabulário certo, nunca inventar número ou prazo que não
 * esteja na conversa, e assumir que o texto será lido por um cliente pagante.
 * O modelo propõe; quem envia é o atendente.
 */
const SYSTEM_BASE = `Você é o copiloto de atendimento da Contabilidade Facilitada, um escritório de contabilidade brasileiro que atende micro e pequenas empresas, MEIs, clínicas e alunos de cursos próprios.

Contexto do ofício: você conhece Simples Nacional, Lucro Presumido, Lucro Real, MEI, DAS, DCTFWeb, eSocial, SPED, retenções (INSS, ISS, IRRF), pró-labore, fator R, certidões e obrigações acessórias. Use o termo técnico correto em português do Brasil.

Regras que não se quebram:
1. Não invente valor, alíquota, código de receita, data de vencimento ou nome de documento que não esteja na conversa. Se o dado não está lá, diga que precisa ser verificado.
2. Não prometa prazo em nome do escritório. Quem promete prazo é o atendente.
3. Não dê parecer jurídico nem garanta resultado de fiscalização.
4. Nunca peça senha, código de acesso do gov.br, token ou dado de cartão.
5. Trate o cliente pelo primeiro nome, com você, sem "prezado" e sem gerúndio de call center ("vou estar verificando").
6. Não repita o que o cliente acabou de dizer antes de responder.

Você é um assistente do atendente humano. Nada que você escreve é enviado ao cliente sem revisão.`;

/** Uma conversa não cabe inteira no prompt — e as últimas trocas é que decidem. */
const MAX_CONTEXT_MESSAGES = 40;

function renderContext(context: AiConversationContext): string {
  const facts = context.contactFacts?.length
    ? `\nO que sabemos do contato: ${context.contactFacts.join("; ")}.`
    : "";

  const history = context.messages.slice(-MAX_CONTEXT_MESSAGES);
  const omitted = context.messages.length - history.length;
  const prefix = omitted > 0 ? `[${omitted} mensagens anteriores omitidas]\n` : "";

  const transcript = history
    .map((message) => {
      const who =
        message.role === "contato"
          ? `CLIENTE (${message.author})`
          : message.role === "agente"
            ? `ATENDENTE (${message.author})`
            : message.role === "bot"
              ? `BOT (${message.author})`
              : `NOTA INTERNA (${message.author})`;
      const files = message.attachments?.length
        ? `\n  [arquivos: ${message.attachments.join(", ")}]`
        : "";
      // O horário entra na linha porque "me liga amanhã" só vira data se houver
      // de quando parte esse "amanhã". Sem isto o modelo datava o retorno em um
      // ano qualquer do treinamento.
      const when = message.at ? `[${formatDateTime(message.at)}] ` : "";
      return `${when}${who}: ${message.body}${files}`;
    })
    .join("\n");

  /**
   * Estado do cadastro para a tabulação.
   *
   * As lacunas vêm primeiro e explicitamente rotuladas como vazias porque é a
   * lista que o modelo precisa cruzar com a conversa. Enterrá-las no meio dos
   * campos preenchidos produzia proposta para campo que já tinha valor.
   */
  const states = context.fieldStates ?? [];
  const empty = states.filter((state) => !state.filled);
  const filled = states.filter((state) => state.filled);

  const registry = states.length
    ? `\n\nEstado do cadastro deste contato:
- vazios (candidatos a tabulação): ${
        empty.length ? empty.map((state) => `${state.field} (${state.label})`).join("; ") : "nenhum"
      }
- já preenchidos: ${
        filled.length
          ? filled
              .map(
                (state) =>
                  `${state.field}${state.sample ? ` = ${state.sample}` : " (valor omitido)"}`,
              )
              .join("; ")
          : "nenhum"
      }`
    : "";

  return `Agora: ${formatDateTime(offsetIso({}))} (fuso de Brasília, -03:00)
Canal: ${context.channel}
Assunto registrado: ${context.subject}
Fila: ${context.queue} · Estado: ${context.state}
Cliente: ${context.contactName}
Atendente responsável: ${context.agentName}${facts}${registry}

Transcrição, da mais antiga para a mais recente (o horário de cada linha está entre colchetes):
${prefix}${transcript}`;
}

/**
 * Schema da análise.
 *
 * O Gemini aceita um subconjunto do OpenAPI 3 em `responseSchema`. Declarar
 * `required` e `propertyOrdering` faz diferença prática: sem ordenação, campos
 * como `summary` às vezes saem depois de `checklist` e a qualidade do resumo
 * cai, porque o modelo já se comprometeu com detalhes antes de sintetizar.
 */
export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "Resumo em 2 a 3 frases: o que o cliente quer, o que já foi feito e onde a conversa parou.",
    },
    intent: {
      type: "string",
      description: "A intenção em no máximo 6 palavras. Ex.: 'contestar valor do DAS de julho'.",
    },
    sentiment: { type: "string", enum: ["positivo", "neutro", "impaciente", "irritado"] },
    urgency: { type: "string", enum: ["baixa", "normal", "alta", "critica"] },
    extracted: {
      type: "array",
      description:
        "Dados concretos ditos na conversa: valores, competências, CNPJ, prazos, códigos, nomes de documento. Só o que está escrito. Máximo 6.",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          evidence: {
            type: "string",
            description: "Trecho curto da conversa que sustenta o valor.",
          },
        },
        required: ["label", "value"],
        propertyOrdering: ["label", "value", "evidence"],
      },
    },
    nextStep: {
      type: "string",
      description: "A única próxima ação do atendente, no imperativo, começando por um verbo.",
    },
    checklist: {
      type: "array",
      description:
        "3 a 5 verificações necessárias para resolver o caso. Marque done=true só quando a conversa mostrar que já foi feito.",
      items: {
        type: "object",
        properties: { label: { type: "string" }, done: { type: "boolean" } },
        required: ["label", "done"],
        propertyOrdering: ["label", "done"],
      },
    },
    suggestedReply: {
      type: "string",
      description:
        "Resposta pronta para o cliente, 2 a 4 frases, sem saudação repetida se a conversa já começou. Sem inventar dado.",
    },
    suggestedTags: {
      type: "array",
      description: "Até 3 assuntos em minúsculas com underscore. Ex.: 'apuracao_das'.",
      items: { type: "string" },
    },
    openQuestions: {
      type: "array",
      description:
        "O que falta saber para resolver, e que só uma pessoa pode obter (consultar sistema, falar com área interna). Até 3.",
      items: { type: "string" },
    },
    proposals: {
      type: "array",
      description:
        "Tabulação: o que a conversa revelou e o CRM deveria registrar. Só o que o cliente escreveu explicitamente. Máximo 6.",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["preencher_campo", "vincular_empresa", "criar_tarefa", "mover_etapa"],
          },
          field: {
            type: "string",
            description:
              "Só em preencher_campo. Um caminho EXATO da lista de campos vazios do cadastro. Nunca invente caminho.",
          },
          label: { type: "string", description: "Rótulo humano curto. Ex.: 'CPF', 'Retorno'." },
          value: {
            type: "string",
            description:
              "O valor como o cliente escreveu, sem reformatar. Em criar_tarefa, o título da tarefa no imperativo.",
          },
          evidence: {
            type: "string",
            description: "Trecho literal da conversa que sustenta a proposta. Obrigatório.",
          },
          confidence: {
            type: "integer",
            description:
              "0 a 100. Alto só quando o cliente afirmou o dado sobre si mesmo. Dado de terceiro citado de passagem é baixo.",
          },
          dueAt: {
            type: "string",
            description:
              "Só em criar_tarefa. Data e hora ISO 8601 com fuso -03:00, derivada do que o cliente pediu.",
          },
        },
        required: ["kind", "label", "value", "evidence", "confidence"],
        propertyOrdering: ["kind", "field", "label", "value", "evidence", "confidence", "dueAt"],
      },
    },
  },
  required: [
    "summary",
    "intent",
    "sentiment",
    "urgency",
    "extracted",
    "nextStep",
    "checklist",
    "suggestedReply",
    "suggestedTags",
    "openQuestions",
    "proposals",
  ],
  propertyOrdering: [
    "summary",
    "intent",
    "sentiment",
    "urgency",
    "extracted",
    "nextStep",
    "checklist",
    "suggestedReply",
    "suggestedTags",
    "openQuestions",
    "proposals",
  ],
} as const;

export function analysisPrompt(context: AiConversationContext): {
  system: string;
  user: string;
} {
  return {
    system: `${SYSTEM_BASE}

Tarefa: ler a conversa e devolver a leitura estruturada que o atendente usaria para assumir o caso agora, sem ler tudo de novo. Responda apenas com o JSON do schema.

Sobre \`proposals\` — a tabulação. Você propõe o que o CRM deveria registrar; quem grava é o atendente, com um clique. Regras:

1. **Só o que o cliente escreveu.** Se ele mandou o CPF, proponha \`preencher_campo\` com \`field: "contato.documento"\` e o valor como veio. Se ninguém escreveu, não proponha — lacuna vazia é melhor que dado inventado.
2. **Só campo vazio.** A lista de campos vazios está no contexto. Propor campo já preenchido só se faz sentido quando o cliente corrigiu explicitamente ("mudei de telefone, agora é ..."). O caminho em \`field\` tem de ser um dos listados, escrito igual.
3. **Dado de terceiro não é do contato.** "O CPF do meu sócio é ..." não preenche o cadastro de quem está falando: confiança baixa ou nada.
4. **Pedido de retorno vira tarefa.** "Me liga amanhã de manhã", "me procura depois do dia 10", "retorna na terça" → \`criar_tarefa\` com título no imperativo e \`dueAt\` calculado a partir da última mensagem da transcrição. De manhã é 09:00, à tarde é 14:00, sem hora dita é 09:00.
5. **Empresa e etapa.** CNPJ ou razão social dita com o contato sem empresa → \`vincular_empresa\`. Intenção clara de fechar ou desistir → \`mover_etapa\` com a etapa no \`value\`. Nos dois, confiança alta só com afirmação inequívoca.
6. **\`evidence\` é obrigatório e literal.** É por ele que o atendente confere sem reler a conversa. Trecho copiado, não parafraseado.`,
    user: `${renderContext(context)}

Produza a análise. Atenção ao sentimento: cobrança de prazo repetida é impaciência, ameaça de trocar de escritório ou reclamação de erro nosso é irritação.

Para a tabulação, releia a transcrição procurando: documento, telefone, e-mail, cargo, cidade, dados dos campos personalizados vazios, pedido de retorno com data e menção a empresa. Se não houver nada disso, devolva \`proposals\` vazio — lista vazia é resposta válida e preferível a proposta fraca.`,
  };
}

export function suggestPrompt(
  context: AiConversationContext,
  draft?: string,
  instruction?: string,
): { system: string; user: string } {
  const base = draft?.trim()
    ? `O atendente já começou a escrever. Complete e melhore a partir do rascunho, preservando a intenção dele:\n"""\n${draft.trim()}\n"""`
    : "O atendente ainda não escreveu nada. Escreva a resposta do zero.";

  const extra = instruction?.trim() ? `\n\nInstrução do atendente: ${instruction.trim()}` : "";

  return {
    system: `${SYSTEM_BASE}

Tarefa: escrever a próxima mensagem do atendente para o cliente. Devolva **apenas o texto da mensagem** — sem aspas ao redor, sem "Olá! Segue a sugestão:", sem assinatura, sem comentário seu.

Formato: 2 a 4 frases. Se o canal for WhatsApp ou Instagram, escreva curto e sem formatação. Se for e-mail, pode usar dois parágrafos.`,
    user: `${renderContext(context)}

${base}${extra}`,
  };
}

const TONE_INSTRUCTION: Record<AiToneAdjustment, string> = {
  formal: "Deixe mais formal, mantendo o tratamento por você. Sem rigidez de ofício público.",
  cordial: "Deixe mais cordial e acolhedor, sem virar bajulação nem usar diminutivo.",
  direto: "Deixe direto: corte rodeio, vá ao ponto na primeira frase.",
  empatico:
    "Reconheça o incômodo do cliente antes de resolver, em uma frase, sem pedir desculpas repetidas.",
  resumir: "Reduza para no máximo duas frases, preservando todo dado concreto.",
  detalhar:
    "Explique o porquê e o passo a passo, sem acrescentar nenhum dado que não esteja no texto original.",
  revisar:
    "Corrija ortografia, concordância, pontuação e regência. Preserve o conteúdo, o tom e o comprimento.",
};

export function rewritePrompt(
  context: AiConversationContext,
  draft: string,
  tone: AiToneAdjustment,
): { system: string; user: string } {
  return {
    system: `${SYSTEM_BASE}

Tarefa: reescrever o rascunho do atendente. Devolva **apenas o texto reescrito**, sem aspas, sem comentário e sem explicar o que mudou.

Não acrescente informação nova. Se o rascunho estiver ambíguo, mantenha a ambiguidade — inventar precisão é pior que preservá-la.`,
    user: `${renderContext(context)}

Rascunho do atendente:
"""
${draft.trim()}
"""

Ajuste pedido — ${AI_TONE_LABEL[tone]}: ${TONE_INSTRUCTION[tone]}`,
  };
}

/* Redação de e-mail --------------------------------------------------------- */

/**
 * Schema do rascunho de e-mail.
 *
 * A ordenação importa aqui pelo mesmo motivo da análise: pedindo `subject`
 * primeiro, o modelo se compromete com uma promessa antes de escrever o corpo, e
 * o corpo sai coerente com ela. Na ordem inversa, o assunto vira resumo tardio.
 */
export const EMAIL_SCHEMA = {
  type: "object",
  properties: {
    subject: {
      type: "string",
      description:
        "Assunto de até 60 caracteres. Concreto, sem clickbait, sem emoji, sem CAPS. Diz o que a pessoa ganha ao abrir.",
    },
    preheader: {
      type: "string",
      description:
        "Até 110 caracteres. Complementa o assunto — nunca o repete. É a segunda linha na caixa de entrada.",
    },
    headline: {
      type: "string",
      description: "Título dentro do e-mail, até 8 palavras. Pode ser diferente do assunto.",
    },
    paragraphs: {
      type: "array",
      description:
        "2 a 4 parágrafos de 1 a 3 frases cada. O primeiro entrega a informação principal; nada de rodeio de abertura.",
      items: { type: "string" },
    },
    ctaLabel: {
      type: "string",
      description: "Texto do botão, 2 a 4 palavras, começando por verbo. Ex.: 'Agendar conversa'.",
    },
    ctaHref: {
      type: "string",
      description:
        "URL de destino. Use https://contabilidadefacilitada.com/ com um caminho plausível quando o briefing não indicar link.",
    },
    closing: {
      type: "string",
      description: "Uma frase de fechamento, sem assinatura e sem 'atenciosamente'.",
    },
  },
  required: ["subject", "preheader", "headline", "paragraphs", "ctaLabel", "ctaHref", "closing"],
  propertyOrdering: [
    "subject",
    "preheader",
    "headline",
    "paragraphs",
    "ctaLabel",
    "ctaHref",
    "closing",
  ],
} as const;

const EMAIL_TONE_INSTRUCTION: Record<AiEmailDraftInput["tone"], string> = {
  profissional: "Sóbrio e competente. Sem informalidade forçada e sem jargão de consultoria.",
  proximo: "Conversa de quem já conhece o cliente. Frases curtas, primeira pessoa do plural.",
  urgente: "O prazo é o assunto. Diga a data na primeira frase e o que acontece se passar.",
  didatico: "Explique o mecanismo antes de pedir a ação. Um conceito por parágrafo.",
};

export function emailPrompt(input: AiEmailDraftInput): { system: string; user: string } {
  return {
    system: `${SYSTEM_BASE}

Tarefa: redigir um e-mail de marketing ou de relacionamento da Contabilidade Facilitada. Responda apenas com o JSON do schema.

Regras deste formato:
- E-mail de empresa contábil é lido no meio do expediente. Vá direto: a primeira frase entrega a informação, não a saudação.
- Um e-mail, uma ação. Só existe um botão, e todo o texto converge para ele.
- Nada de "espero que esteja bem", "não perca", "imperdível", "clique aqui" ou emoji.
- Se o briefing citar valor, prazo ou alíquota, use exatamente o que está lá. Se não citar, não invente — escreva de modo que o número entre depois como variável.
- Escreva para uma pessoa, no singular, tratando por você.`,
    user: `Objetivo: ${AI_EMAIL_OBJECTIVE_LABEL[input.objective]}
Público: ${input.audience.trim() || "clientes e leads do escritório"}
Tom — ${AI_EMAIL_TONE_LABEL[input.tone]}: ${EMAIL_TONE_INSTRUCTION[input.tone]}

Briefing de quem pediu o e-mail:
"""
${input.brief.trim()}
"""

Produza o rascunho.`,
  };
}

export function askPrompt(
  context: AiConversationContext,
  question: string,
  history?: Array<{ role: "atendente" | "copiloto"; body: string }>,
): { system: string; user: string } {
  const previous = history?.length
    ? `\n\nO que já conversamos aqui:\n${history
        .map((turn) => `${turn.role === "atendente" ? "ATENDENTE" : "VOCÊ"}: ${turn.body}`)
        .join("\n")}`
    : "";

  return {
    system: `${SYSTEM_BASE}

Tarefa: responder à pergunta do atendente sobre este atendimento. Você fala **com o atendente**, não com o cliente.

Seja curto: 1 a 3 parágrafos curtos, ou uma lista quando a pergunta pedir passos. Quando a resposta depender de dado que não está na conversa nem no seu conhecimento do ofício, diga exatamente o que precisa ser consultado e onde. Não escreva mensagem pronta para o cliente a menos que seja pedido.`,
    user: `${renderContext(context)}${previous}

Pergunta do atendente: ${question.trim()}`,
  };
}
