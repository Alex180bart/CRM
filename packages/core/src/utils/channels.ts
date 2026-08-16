/**
 * Catálogo de canais e o que cada um exige para conectar.
 *
 * Referência: seção 3.2 do plano ("cada canal é um adaptador, não uma regra de
 * negócio") e seção 11 (integração dos números de WhatsApp).
 *
 * O catálogo existe para responder, numa tela só, a pergunta que a operação faz
 * antes de escolher onde investir esforço: **o que dá para ligar, o que custa
 * caro e o que não existe.** Sem ele, cada canal vira uma conversa separada e a
 * mesma pergunta é refeita todo mês.
 *
 * A honestidade aqui é o produto. Um catálogo que lista LinkedIn ao lado de
 * WhatsApp, com o mesmo botão "conectar", promete o que a plataforma do LinkedIn
 * não entrega — e quem descobre isso descobre depois de vender o recurso.
 */

import type { ChannelKind } from "../types/common";

/**
 * Quanto trabalho separa este canal de estar atendendo.
 *
 * `disponivel` — a fronteira existe e falta configurar.
 * `fundacao` — a integração é conhecida e depende do back-end (fila, storage).
 * `restrito` — a plataforma do terceiro **não oferece** o que o caso pede.
 */
export type ChannelReadiness = "disponivel" | "fundacao" | "restrito";

export const CHANNEL_READINESS_LABEL: Record<ChannelReadiness, string> = {
  disponivel: "Pronto para configurar",
  fundacao: "Depende da fundação de back-end",
  restrito: "Limitado pela plataforma",
};

export interface ChannelBlueprint {
  kind: ChannelKind | "linkedin" | "telegram";
  label: string;
  /** O que este canal resolve, em uma linha. */
  purpose: string;
  readiness: ChannelReadiness;
  /** Provedor ou plataforma por trás. */
  provider: string;
  /** O que precisa acontecer antes de atender por aqui. */
  requirements: string[];
  /** A armadilha específica deste canal — o que ninguém descobre lendo a documentação. */
  caveat: string;
  /** Rota de configuração, quando existe. */
  setupHref?: string;
  /**
   * Canais que compartilham a mesma infraestrutura já montada.
   *
   * É a informação que muda a ordem de trabalho: depois do WhatsApp, ligar
   * Instagram e Messenger é barato, porque a conta, o app e o webhook já
   * existem. Sem isso, a operação trata os três como três projetos.
   */
  sharesInfraWith?: string[];
}

export const CHANNEL_CATALOG: ChannelBlueprint[] = [
  {
    kind: "whatsapp",
    label: "WhatsApp",
    purpose: "O canal principal de atendimento e de campanha no Brasil.",
    readiness: "disponivel",
    provider: "WhatsApp Cloud API (Meta), direta ou por BSP",
    requirements: [
      "Meta Business Manager com verificação de negócio",
      "WABA e app no Meta for Developers",
      "Número dedicado, que sai do aplicativo ao entrar na API",
      "Templates aprovados para falar fora da janela de 24 h",
    ],
    caveat:
      "O número que entra na API deixa de funcionar no WhatsApp Business do celular — não há coexistência. Comece por um chip novo, nunca pelo número principal do comercial.",
    setupHref: "/administracao/whatsapp",
  },
  {
    kind: "instagram",
    label: "Instagram Direct",
    purpose: "Mensagem direta e resposta a comentário e story de quem já segue.",
    readiness: "fundacao",
    provider: "Messenger Platform (Meta)",
    requirements: [
      "Conta profissional do Instagram vinculada a uma página do Facebook",
      "O mesmo app da Meta usado no WhatsApp, com os campos de mensagem assinados",
      "Permissão de mensagens aprovada na análise do app",
    ],
    caveat:
      "A janela para responder é de 24 h como no WhatsApp, mas sem template equivalente: passou o prazo, só a pessoa reabrindo a conversa. E a conta precisa permitir mensagens de quem não segue, senão o lead novo não chega.",
    sharesInfraWith: ["WhatsApp", "Messenger"],
  },
  {
    kind: "messenger",
    label: "Facebook Messenger",
    purpose: "Conversa a partir da página, de anúncio Click-to-Messenger e do site.",
    readiness: "fundacao",
    provider: "Messenger Platform (Meta)",
    requirements: [
      "Página do Facebook administrada pela empresa",
      "O mesmo app da Meta, com a página assinada no webhook",
      "Permissão de mensagens aprovada na análise do app",
    ],
    caveat:
      "Mesma infraestrutura do Instagram: quem conecta um conecta o outro quase de graça. O ganho isolado costuma ser pequeno no Brasil — vale como destino de anúncio, raramente como canal de suporte.",
    sharesInfraWith: ["WhatsApp", "Instagram"],
  },
  {
    kind: "email",
    label: "E-mail",
    purpose: "Atendimento formal, envio de documento e campanha de relacionamento.",
    readiness: "fundacao",
    provider: "Provedor transacional (SES, SendGrid, Postmark)",
    requirements: [
      "Domínio com SPF, DKIM e DMARC configurados",
      "Caixa de entrada de atendimento com recebimento por webhook",
      "Trilha de bounce, complaint e descadastro",
    ],
    caveat:
      "Entregabilidade não se resolve no código: é reputação de domínio, construída com volume crescente e lista limpa. Disparar campanha grande de domínio novo é o caminho mais curto para a caixa de spam — e leva meses para desfazer.",
  },
  {
    kind: "webchat",
    label: "Webchat",
    purpose: "O chat no site da empresa, com agente de IA ou fluxo antes do humano.",
    readiness: "disponivel",
    provider: "Nosso — código próprio, sem terceiro",
    requirements: [
      "Um widget publicado, com domínio autorizado",
      "O trecho de incorporação colado no site",
    ],
    caveat:
      "É o único canal sem intermediário: nada aqui depende de aprovação de plataforma. O canal é criado junto com o widget e não se cadastra à mão.",
    setupHref: "/webchat",
  },
  {
    kind: "linkedin",
    label: "LinkedIn",
    purpose: "Prospecção e conteúdo para decisor de empresa.",
    readiness: "restrito",
    provider: "LinkedIn Marketing API",
    requirements: [
      "Página da empresa e conta de anúncios",
      "Aprovação no programa de parceiros para qualquer acesso além do básico",
    ],
    /**
     * Esta é a linha mais importante do catálogo.
     *
     * O LinkedIn não abre a caixa de mensagens para ferramenta de atendimento —
     * a API de mensagens é restrita a produtos aprovados (Recruiter, Sales
     * Navigator). Prometer "Inbox do LinkedIn" é vender o que não existe, e o
     * caminho realista é outro: puxar o lead do formulário do anúncio para o
     * CRM e continuar a conversa por e-mail ou WhatsApp.
     */
    caveat:
      "Não existe API pública de caixa de mensagens: o LinkedIn não permite que ferramenta de atendimento leia ou responda DM. O que dá para integrar é o Lead Gen Form — o lead cai no CRM e a conversa continua por outro canal.",
  },
  {
    kind: "telegram",
    label: "Telegram",
    purpose: "Alternativa sem custo por mensagem, útil para grupo e aviso.",
    readiness: "fundacao",
    provider: "Telegram Bot API",
    requirements: ["Um bot criado pelo BotFather", "Webhook público apontado para a aplicação"],
    caveat:
      "É a integração mais simples de todas — sem verificação, sem template, sem janela. Em compensação, quase nenhum cliente de contabilidade usa Telegram no Brasil: conecte por demanda observada, não por facilidade.",
  },
  {
    kind: "form",
    label: "Formulário do site",
    purpose: "Entrada de lead sem conversa — orçamento, contato, inscrição.",
    readiness: "fundacao",
    provider: "Nosso — endpoint de recebimento",
    requirements: ["Um endpoint público de recebimento", "Proteção contra envio automatizado"],
    caveat:
      "Não é canal de conversa: gera contato e tarefa, não thread. Tratá-lo como conversa enche o Inbox de itens que ninguém responde.",
  },
];

export function channelBlueprint(kind: string): ChannelBlueprint | undefined {
  return CHANNEL_CATALOG.find((item) => item.kind === kind);
}

/* Canal derivado de widget --------------------------------------------------- */

/**
 * Identificador da conta de canal de um widget.
 *
 * **Derivado, não sorteado.** O canal de webchat existe porque um widget existe;
 * gerar um identificador aleatório obrigaria a guardar a ligação em algum lugar,
 * e esse lugar seria mais um estado para dessincronizar. Assim, a ligação é a
 * própria regra de formação — e é reversível: dado o canal, sabe-se o widget.
 */
export function webchatChannelId(widgetId: string): string {
  return `chan_${widgetId}`;
}

export function widgetIdFromChannel(channelId: string): string | null {
  return channelId.startsWith("chan_wgt_") ? channelId.slice("chan_".length) : null;
}

/**
 * Deriva a conta de canal a partir do widget.
 *
 * É o que torna o webchat automático: criar um widget cria o canal, e excluir o
 * widget o remove. Antes, o widget apontava para uma conta cadastrada à mão na
 * Administração — e a primeira coisa que alguém esquecia era criar essa conta,
 * produzindo um widget publicado que abre conversa sem destino.
 *
 * Derivar em vez de gravar tem uma consequência que vale enunciar: **não existe
 * estado a dessincronizar.** Não há como o nome do canal divergir do nome do
 * widget, nem como sobrar um canal órfão de um widget excluído, porque o canal
 * não é guardado em lugar nenhum — ele é calculado.
 *
 * O que ele **não** pode derivar é o que não está no widget: o `status` sai da
 * publicação e do domínio autorizado, porque é isso que decide se o widget
 * atende de verdade. Widget sem versão publicada, ou sem domínio, é canal
 * desconectado — e é honesto que apareça assim na lista.
 */
export function deriveWebchatChannel(widget: {
  id: string;
  organizationId: string;
  name: string;
  embedKey: string;
  allowedDomains: string[];
  activeVersionId?: string;
  versions: Array<{ id: string; behavior: { queueId: string } }>;
  createdAt: string;
  updatedAt: string;
}): {
  id: string;
  organizationId: string;
  kind: "webchat";
  label: string;
  address: string;
  queueId: string;
  status: "conectado" | "degradado" | "desconectado";
  createdAt: string;
  updatedAt: string;
} {
  const active = widget.versions.find((version) => version.id === widget.activeVersionId);
  const published = Boolean(active);
  const hasDomain = widget.allowedDomains.length > 0;

  return {
    id: webchatChannelId(widget.id),
    organizationId: widget.organizationId,
    kind: "webchat",
    label: widget.name,
    // O endereço do webchat é o domínio onde ele vive: é o que identifica a
    // conta na lista, do mesmo jeito que o número identifica o WhatsApp.
    address: widget.allowedDomains[0] ?? "sem domínio autorizado",
    queueId: active?.behavior.queueId ?? widget.versions[0]?.behavior.queueId ?? "",
    status: published && hasDomain ? "conectado" : published ? "degradado" : "desconectado",
    createdAt: widget.createdAt,
    updatedAt: widget.updatedAt,
  };
}

/* Provedores e o que cada um exige ------------------------------------------- */

/**
 * Um campo do formulário de conexão.
 *
 * `secret` decide o caminho do valor: campo comum vai para o repositório e volta
 * para a tela; campo secreto vai para o cofre do servidor e **nunca** volta. É a
 * única diferença que importa, e por isso ela é um booleano no lugar de duas
 * listas paralelas que alguém esqueceria de manter em sincronia.
 */
export interface ConnectionField {
  key: string;
  label: string;
  /** Onde a pessoa encontra este valor no painel do provedor. */
  hint: string;
  secret: boolean;
  placeholder?: string;
  optional?: boolean;
}

export interface ProviderSpec {
  id: string;
  label: string;
  /** Canais que este provedor atende. */
  kinds: string[];
  /** O que o campo `address` da conta significa neste provedor. */
  addressLabel: string;
  addressPlaceholder: string;
  fields: ConnectionField[];
  /**
   * O que a conexão ainda não faz de verdade.
   *
   * Presente significa que preencher o formulário registra a configuração mas
   * não coloca o canal para funcionar. Escrito por provedor porque o motivo
   * muda: o WhatsApp já recebe e falta persistir; o e-mail não tem nem worker
   * de envio.
   */
  gap?: string;
}

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    id: "meta_cloud",
    label: "WhatsApp Cloud API",
    kinds: ["whatsapp"],
    addressLabel: "Número em E.164",
    addressPlaceholder: "+5511930001000",
    fields: [
      {
        key: "phoneNumberId",
        label: "ID do número",
        hint: "Painel da Meta → WhatsApp → Configuração da API. Não é o telefone: é um número longo de identificação.",
        secret: false,
        placeholder: "106540352242922",
      },
      {
        key: "wabaId",
        label: "ID da conta do WhatsApp Business",
        hint: "A WABA que agrupa os números. Aparece no topo da configuração da API.",
        secret: false,
        placeholder: "102290129340398",
      },
      {
        key: "appSecret",
        label: "Segredo do app",
        hint: "Meta for Developers → Configurações → Básico. Valida a assinatura de cada corpo recebido.",
        secret: true,
      },
      {
        key: "accessToken",
        label: "Token de acesso permanente",
        hint: "De um usuário do sistema no Business Manager. O token do painel de teste expira em 24 h.",
        secret: true,
      },
    ],
    gap: "O webhook já recebe e valida. Falta persistir a mensagem, deduplicar por identificador e abrir a conversa — a fundação de back-end.",
  },
  {
    id: "meta_messenger",
    label: "Messenger e Instagram",
    kinds: ["messenger", "instagram"],
    addressLabel: "Nome de usuário ou página",
    addressPlaceholder: "@contabilaurora",
    fields: [
      {
        key: "pageId",
        label: "ID da página do Facebook",
        hint: "Mesmo app da Meta usado no WhatsApp. A página precisa estar assinada nos campos de mensagem.",
        secret: false,
      },
      {
        key: "igUserId",
        label: "ID da conta do Instagram",
        hint: "Só para Instagram Direct. Sai da conta profissional vinculada à página.",
        secret: false,
        optional: true,
      },
      {
        key: "appSecret",
        label: "Segredo do app",
        hint: "O mesmo do WhatsApp quando o app é o mesmo — e vale repetir aqui para cada conta ser independente.",
        secret: true,
      },
      {
        key: "pageAccessToken",
        label: "Token da página",
        hint: "Gerado por página, não por app. Cada página tem o seu.",
        secret: true,
      },
    ],
    gap: "Falta o adaptador de recebimento e envio. A infraestrutura é a mesma do WhatsApp: conectado um, o caminho já está aberto.",
  },
  {
    id: "smtp",
    label: "E-mail transacional",
    kinds: ["email"],
    addressLabel: "Endereço de envio",
    addressPlaceholder: "atendimento@contabilaurora.com.br",
    fields: [
      {
        key: "domain",
        label: "Domínio de envio",
        hint: "Precisa ter SPF, DKIM e DMARC publicados antes de qualquer disparo.",
        secret: false,
        placeholder: "contabilaurora.com.br",
      },
      {
        key: "region",
        label: "Região ou endpoint",
        hint: "Depende do provedor — SES usa região, SendGrid e Postmark usam um endpoint fixo.",
        secret: false,
        optional: true,
      },
      {
        key: "apiKey",
        label: "Chave de API",
        hint: "Do provedor transacional. Precisa de permissão de envio e de leitura de eventos.",
        secret: true,
      },
    ],
    gap: "Falta o worker de envio, o recebimento por webhook e a trilha de bounce e descadastro.",
  },
  {
    id: "telegram",
    label: "Telegram Bot",
    kinds: ["telegram"],
    addressLabel: "Nome do bot",
    addressPlaceholder: "@contabilaurora_bot",
    fields: [
      {
        key: "botUsername",
        label: "Usuário do bot",
        hint: "O que o BotFather devolveu ao criar.",
        secret: false,
      },
      {
        key: "botToken",
        label: "Token do bot",
        hint: "Também do BotFather. É a credencial completa: quem tem o token controla o bot.",
        secret: true,
      },
    ],
    gap: "Falta o adaptador. É a integração mais simples das listadas — sem verificação, template ou janela.",
  },
];

export function providerSpec(id: string): ProviderSpec | undefined {
  return PROVIDER_SPECS.find((spec) => spec.id === id);
}

/** Provedores que atendem um tipo de canal. */
export function providersForKind(kind: string): ProviderSpec[] {
  return PROVIDER_SPECS.filter((spec) => spec.kinds.includes(kind));
}

/**
 * Tipos de canal que aceitam mais de uma conta cadastrada à mão.
 *
 * O webchat fica de fora porque é derivado do widget, e `internal` porque não é
 * canal de terceiro. Listar os dois no seletor de "nova conta" ofereceria um
 * caminho que a validação recusaria em seguida.
 */
export const CONNECTABLE_KINDS = ["whatsapp", "instagram", "messenger", "email", "telegram"];

/**
 * A conexão está completa?
 *
 * Recebe **os nomes** dos segredos gravados, nunca os valores. O servidor sabe
 * quais chaves existem no cofre e responde só isso; é o bastante para a tela
 * decidir entre "configurar" e "reconfigurar", e nada além disso precisa
 * atravessar a rede.
 *
 * Um provedor tem mais de um segredo — o WhatsApp tem segredo do app e token de
 * acesso —, então uma referência única não responderia "o que falta": diria
 * apenas que algo foi gravado alguma vez.
 */
export function connectionMissingFields(
  spec: ProviderSpec,
  connection?: { fields: Record<string, string> },
  presentSecrets: string[] = [],
): string[] {
  const missing: string[] = [];

  for (const field of spec.fields) {
    if (field.optional) continue;

    if (field.secret) {
      if (!presentSecrets.includes(field.key)) missing.push(field.label);
      continue;
    }

    if (!connection?.fields[field.key]?.trim()) missing.push(field.label);
  }

  return missing;
}
