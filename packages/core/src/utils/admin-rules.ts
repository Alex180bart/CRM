/**
 * Regras que decidem se uma alteração administrativa pode acontecer.
 *
 * Funções puras, e todas devolvem **o motivo** em vez de um booleano. A
 * diferença importa na tela: "não é possível excluir" é uma parede; "não é
 * possível excluir porque duas contas de canal entregam nesta fila" é uma
 * instrução — quem lê sabe o que fazer para desbloquear.
 *
 * Ficam em `@elora/core` porque a mesma pergunta é feita em dois momentos: a tela
 * pergunta para desabilitar o botão antes do clique, e o repositório pergunta de
 * novo antes de gravar. Duplicar a lógica produziria a divergência clássica —
 * botão habilitado e escrita recusada, ou pior, botão desabilitado e escrita
 * aceita por outro caminho.
 */

import type { AccessPolicy, CustomRole, PermissionRow, RetentionPolicy } from "../types/governance";
import type { ChannelAccount, Queue, QueueDistribution, Team, User } from "../types/organization";
import type { BusinessSchedule, TimeRange } from "../types/scheduling";
import type { ClosingReason, CustomFieldDefinition, SkillDefinition } from "../types/catalog";
import { toMinutes, weeklyHours } from "./schedule";

/** Recusa com motivo, ou `null` quando pode. */
export type Refusal = string | null;

/* Pessoas -------------------------------------------------------------------- */

/**
 * Perfis que podem administrar a organização.
 *
 * A regra existe por um cenário concreto e irreversível sem back-end: excluir o
 * último administrador tranca todo mundo para fora da Administração, e não há
 * console nem banco para desfazer.
 */
const ADMIN_ROLES = new Set(["superadmin", "admin_empresa"]);

export function canDeleteUser(
  user: User,
  all: User[],
  queues: Queue[],
  currentUserId?: string,
): Refusal {
  if (user.id === currentUserId) {
    return "Você não pode excluir o próprio usuário — isso tiraria o seu acesso agora.";
  }

  if (ADMIN_ROLES.has(user.role)) {
    const remaining = all.filter(
      (item) => item.id !== user.id && ADMIN_ROLES.has(item.role),
    ).length;

    if (remaining === 0) {
      return "É o último administrador. Excluí-lo trancaria todo mundo para fora da Administração.";
    }
  }

  /**
   * Fila sem ninguém não é erro de dado: é conversa que chega e não é atendida.
   * Vale bloquear e mandar remanejar antes.
   */
  const orphaned = queues.filter((queue) => {
    const team = user.teamIds.includes(queue.teamId);
    if (!team) return false;
    return !all.some((item) => item.id !== user.id && item.teamIds.includes(queue.teamId));
  });

  if (orphaned.length > 0) {
    return `Deixaria sem ninguém: ${orphaned.map((queue) => queue.name).join(", ")}. Coloque outra pessoa no time antes.`;
  }

  return null;
}

export function canChangeRole(user: User, all: User[], nextRole: string): Refusal {
  if (!ADMIN_ROLES.has(user.role) || ADMIN_ROLES.has(nextRole)) return null;

  const remaining = all.filter((item) => item.id !== user.id && ADMIN_ROLES.has(item.role)).length;

  return remaining === 0
    ? "É o último administrador. Rebaixá-lo trancaria todo mundo para fora da Administração."
    : null;
}

/* Times ---------------------------------------------------------------------- */

export function canDeleteTeam(team: Team, queues: Queue[], users: User[]): Refusal {
  const attached = queues.filter((queue) => queue.teamId === team.id);
  if (attached.length > 0) {
    return `${attached.length} fila(s) apontam para este time: ${attached
      .map((queue) => queue.name)
      .join(", ")}. Aponte-as para outro time antes.`;
  }

  const members = users.filter((user) => user.teamIds.includes(team.id)).length;
  if (members > 0) {
    return `${members} pessoa(s) ainda estão neste time. Remova-as antes de excluir.`;
  }

  return null;
}

/* Filas ---------------------------------------------------------------------- */

export function canDeleteQueue(queue: Queue, channels: ChannelAccount[]): Refusal {
  const attached = channels.filter((channel) => channel.queueId === queue.id);

  if (attached.length > 0) {
    return `${attached.length} canal(is) entregam nesta fila: ${attached
      .map((channel) => channel.label)
      .join(", ")}. Aponte-os para outra fila antes.`;
  }

  return null;
}

/**
 * SLA de primeira resposta maior que o de solução é contradição, não preferência.
 *
 * Aceitar produziria uma fila cujo painel mostra "dentro do SLA de solução" e
 * "estourado na primeira resposta" ao mesmo tempo — e ninguém confia num painel
 * que se contradiz.
 */
export function checkQueueSla(firstResponse: number, resolution: number): Refusal {
  if (firstResponse <= 0 || resolution <= 0) {
    return "Os prazos de SLA precisam ser maiores que zero.";
  }
  if (firstResponse > resolution) {
    return "O prazo de primeira resposta não pode ser maior que o de solução.";
  }
  return null;
}

/**
 * A configuração de distribuição é coerente?
 *
 * As recusas aqui foram escolhidas pelo mesmo critério do resto do arquivo: só
 * entra o que produz uma fila **silenciosamente parada**. Fila parada é o pior
 * defeito deste módulo porque não gera erro em lugar nenhum — as conversas
 * simplesmente esperam, e alguém percebe quando o SLA já estourou.
 */
export function checkDistribution(
  distribution: QueueDistribution,
  queue: { teamId: string; id?: string },
  users: User[],
  skills: SkillDefinition[],
): Refusal {
  if (distribution.model === "manual") return null;

  const team = users.filter((user) => user.teamIds.includes(queue.teamId));
  if (team.length === 0) {
    return "O time responsável não tem ninguém. A distribuição automática ficaria sem candidatos e a fila pararia sem avisar.";
  }

  if (distribution.model === "habilidade") {
    if (distribution.requiredSkills.length === 0) {
      return "A distribuição por habilidade precisa de ao menos uma competência exigida — sem nenhuma, ela é idêntica ao desempate escolhido.";
    }

    const unknown = distribution.requiredSkills.filter(
      (key) => !skills.some((skill) => skill.key === key && skill.active),
    );
    if (unknown.length > 0) {
      return `Competência não cadastrada ou inativa: ${unknown.join(", ")}. Cadastre em Catálogo antes de exigi-la.`;
    }

    /**
     * Exigir habilidade que ninguém do time tem trava a fila por completo, e o
     * sintoma é indistinguível de "está todo mundo ocupado". Vale recusar na
     * gravação, quando ainda há alguém olhando para o formulário.
     */
    const able = team.filter((user) =>
      distribution.requiredSkills.every((skill) => user.skills.includes(skill)),
    );
    if (able.length === 0) {
      return `Ninguém no time responsável tem ${distribution.requiredSkills.join(" + ")}. Nenhuma conversa seria distribuída.`;
    }
  }

  if (distribution.delivery === "oferta") {
    if (distribution.offerTimeoutSeconds < 10 || distribution.offerTimeoutSeconds > 600) {
      return "O tempo de aceite precisa ficar entre 10 e 600 segundos. Abaixo disso ninguém consegue reagir; acima, a conversa envelhece na oferta.";
    }
    if (distribution.maxOffers < 1 || distribution.maxOffers > 20) {
      return "O número de tentativas precisa ficar entre 1 e 20.";
    }
  }

  /**
   * Transbordo para a própria fila é laço.
   *
   * A conversa que ninguém aceitou voltaria para o mesmo lugar, seria oferecida
   * de novo às mesmas pessoas e giraria até alguém aceitar ou o processo cair.
   * Deixar o campo vazio já significa "volta para esta fila", e é o caminho que
   * o executor trata com espera; apontar explicitamente para si mesma não.
   */
  if (queue.id && distribution.overflowQueueId === queue.id) {
    return "O transbordo aponta para a própria fila. Deixe o campo vazio para devolver à fila de origem.";
  }

  return null;
}

/**
 * O pior caso da oferta cabe no SLA?
 *
 * Separado de `checkDistribution` porque é **alerta, não recusa**. Há filas em
 * que estourar o prazo na ronda de ofertas é aceitável — o gestor prefere
 * insistir a distribuir para quem não vai responder. Recusar tiraria essa
 * escolha; avisar a preserva e ainda mostra a conta.
 */
export function warnOfferBudget(
  distribution: QueueDistribution,
  firstResponseSlaMinutes: number,
): string | null {
  if (distribution.delivery !== "oferta" || distribution.model === "manual") return null;

  const worstCase = (distribution.offerTimeoutSeconds * distribution.maxOffers) / 60;
  if (worstCase <= firstResponseSlaMinutes) return null;

  return `No pior caso a ronda de ofertas leva ${worstCase.toFixed(1)} min — mais que o SLA de primeira resposta (${firstResponseSlaMinutes} min). A conversa chegaria em alguém já atrasada.`;
}

/* Canais --------------------------------------------------------------------- */

/**
 * Canal de webchat não se exclui por aqui.
 *
 * Ele é **derivado** do widget: existe porque um widget existe, e some quando o
 * widget some. Permitir excluí-lo na Administração criaria um widget publicado
 * apontando para uma conta de canal que não existe — e o sintoma apareceria como
 * conversa do site caindo em lugar nenhum.
 */
export function canDeleteChannel(channel: ChannelAccount): Refusal {
  if (channel.kind === "webchat") {
    return "Canal de webchat é criado e removido junto com o widget. Exclua o widget em Webchat.";
  }
  return null;
}

/**
 * Duas contas com o mesmo endereço é o defeito que não dá para depurar.
 *
 * O endereço — número em E.164, caixa de e-mail, usuário do bot — é o que o
 * provedor usa para dizer de onde a mensagem veio. Cadastrado duas vezes, a
 * mensagem que chega casa com as duas contas, e qual delas atende passa a
 * depender da ordem da lista. O sintoma aparece como "a conversa foi para a fila
 * errada, às vezes", que é a pior forma de um defeito se apresentar.
 *
 * A comparação normaliza o que varia sem mudar a identidade: espaço, caixa e a
 * pontuação de telefone. `+55 11 93000-1000` e `+5511930001000` são o mesmo
 * número, e recusar só a repetição literal deixaria passar o caso comum.
 */
export function canCreateChannel(
  address: string,
  kind: string,
  existing: ChannelAccount[],
): Refusal {
  const value = address.trim();
  if (!value) return "Informe o endereço da conta.";

  const normalized = normalizeAddress(value, kind);
  const clash = existing.find(
    (account) => normalizeAddress(account.address, account.kind) === normalized,
  );

  if (clash) {
    return `Já existe uma conta com este endereço: "${clash.label}". Duas contas com o mesmo endereço fazem a mensagem cair na fila errada de forma intermitente.`;
  }

  if (kind === "whatsapp" && !/^\+?\d{10,15}$/.test(value.replace(/[\s()-]/g, ""))) {
    return "Número de WhatsApp precisa estar em formato internacional, com país e DDD.";
  }

  if (kind === "email" && !value.includes("@")) {
    return "Informe um endereço de e-mail válido.";
  }

  return null;
}

function normalizeAddress(address: string, kind: string): string {
  const value = address.trim().toLowerCase();
  // Telefone perde pontuação; endereço de texto perde só espaço e caixa.
  return kind === "whatsapp" || kind === "phone" ? value.replace(/[^\d]/g, "") : value;
}

/* Escalas -------------------------------------------------------------------- */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Faixas de um dia: formato, ordem e sobreposição.
 *
 * A sobreposição é o caso que parece inofensivo e não é. "09:00–13:00" mais
 * "12:00–18:00" não quebra a pergunta "está aberto?" — as duas respondem sim no
 * meio-dia. Quebra a **contagem**: as horas semanais somam a mesma hora duas
 * vezes, e o número que a operação usa para dimensionar equipe fica inflado sem
 * nada na tela indicando o motivo.
 */
export function checkRanges(ranges: TimeRange[]): Refusal {
  for (const range of ranges) {
    if (!TIME_PATTERN.test(range.from) || !TIME_PATTERN.test(range.to)) {
      return `Horário inválido: "${range.from}–${range.to}". Use HH:MM em 24 horas.`;
    }
    if (toMinutes(range.to) <= toMinutes(range.from)) {
      return `A faixa ${range.from}–${range.to} termina antes de começar. Expediente que vira o dia precisa de duas faixas.`;
    }
  }

  const sorted = [...ranges].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (toMinutes(current.from) < toMinutes(previous.to)) {
      return `As faixas ${previous.from}–${previous.to} e ${current.from}–${current.to} se sobrepõem: as horas semanais contariam o mesmo período duas vezes.`;
    }
  }

  return null;
}

export function checkSchedule(schedule: {
  name: string;
  days: BusinessSchedule["days"];
  exceptions: BusinessSchedule["exceptions"];
}): Refusal {
  if (!schedule.name.trim()) return "A escala precisa de um nome.";

  for (const day of schedule.days) {
    const refusal = checkRanges(day.ranges);
    if (refusal) return refusal;
  }

  for (const exception of schedule.exceptions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.date)) {
      return `Data de exceção inválida: "${exception.date}". Use AAAA-MM-DD.`;
    }
    if (!exception.label.trim()) {
      return `A exceção de ${exception.date} precisa de um nome — é ele que aparece no aviso de fechado.`;
    }
    const refusal = checkRanges(exception.ranges);
    if (refusal) return refusal;
  }

  const duplicated = schedule.exceptions
    .map((item) => item.date)
    .filter((date, index, all) => all.indexOf(date) !== index);
  if (duplicated.length > 0) {
    return `A data ${duplicated[0]} aparece duas vezes nas exceções. Qual delas vale passaria a depender da ordem da lista.`;
  }

  if (schedule.days.every((day) => day.ranges.length === 0)) {
    return "Nenhum dia com atendimento: esta escala nunca abriria, e toda fila ligada a ela pararia de distribuir.";
  }

  return null;
}

/** Alerta — não recusa: escala enxuta é escolha legítima, mas vale mostrar a conta. */
export function warnScheduleCoverage(schedule: BusinessSchedule): string | null {
  const hours = weeklyHours(schedule);
  if (hours >= 20) return null;
  return `Esta escala cobre ${hours} h por semana. Confira se é mesmo a intenção antes de ligar filas a ela.`;
}

/**
 * Escala em uso não se exclui.
 *
 * Sem esta recusa, excluir deixaria filas e pessoas apontando para um
 * identificador morto — e `evaluateSchedule` trata escala ausente como **sempre
 * aberta**. Ou seja: o efeito colateral de excluir uma escala seria abrir o
 * atendimento 24 horas por dia, em silêncio.
 */
export function canDeleteSchedule(scheduleId: string, queues: Queue[], users: User[]): Refusal {
  const usedByQueues = queues.filter((queue) => queue.scheduleId === scheduleId);
  if (usedByQueues.length > 0) {
    return `${usedByQueues.length} fila(s) seguem esta escala: ${usedByQueues
      .map((queue) => queue.name)
      .join(", ")}. Sem escala, elas passariam a atender em qualquer horário.`;
  }

  const usedByUsers = users.filter((user) => user.scheduleId === scheduleId);
  if (usedByUsers.length > 0) {
    return `${usedByUsers.length} pessoa(s) seguem esta escala. Aponte-as para outra antes.`;
  }

  return null;
}

/* Catálogo ------------------------------------------------------------------- */

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

/**
 * A chave é imutável e tem forma fixa.
 *
 * Ela vai para dentro de conversa, contato e evento. Aceitar acento, espaço ou
 * maiúscula produziria a mesma chave escrita de duas formas em dois lugares —
 * e o relatório mostraria "Fiscal" e "fiscal" como categorias diferentes, sem
 * que ninguém consiga juntar depois.
 */
export function checkCatalogKey(key: string, existing: string[], currentKey?: string): Refusal {
  const value = key.trim();
  if (!KEY_PATTERN.test(value)) {
    return "A chave precisa começar com letra e usar só minúsculas, números e sublinhado (2 a 40 caracteres).";
  }
  if (value !== currentKey && existing.includes(value)) {
    return `A chave "${value}" já existe. Chave repetida faz dois registros disputarem o mesmo campo.`;
  }
  return null;
}

export function checkClosingReason(
  reason: Pick<ClosingReason, "key" | "label" | "resolved">,
  all: ClosingReason[],
  currentId?: string,
): Refusal {
  if (!reason.label.trim()) return "O motivo precisa de um rótulo.";

  const others = all.filter((item) => item.id !== currentId);
  const refusal = checkCatalogKey(
    reason.key,
    others.map((item) => item.key),
  );
  if (refusal) return refusal;

  /**
   * Zerar os motivos resolvidos apaga o numerador da taxa de resolução.
   *
   * Sem nenhum motivo marcado como resolvido, toda conversa fechada conta como
   * não resolvida e o painel passa a mostrar 0% para sempre — número que parece
   * um colapso operacional e é só configuração.
   */
  if (!reason.resolved && currentId) {
    const remaining = others.filter((item) => item.resolved && item.active).length;
    if (remaining === 0) {
      return "É o último motivo marcado como resolvido. Sem nenhum, a taxa de resolução ficaria travada em zero.";
    }
  }

  return null;
}

export function checkCustomField(
  field: Pick<CustomFieldDefinition, "key" | "label" | "type" | "options" | "required" | "derived">,
  all: CustomFieldDefinition[],
  currentId?: string,
): Refusal {
  if (!field.label.trim()) return "O campo precisa de um rótulo.";

  const others = all.filter((item) => item.id !== currentId);
  const refusal = checkCatalogKey(
    field.key,
    others.map((item) => item.key),
    all.find((item) => item.id === currentId)?.key,
  );
  if (refusal) return refusal;

  if (field.type === "selecao" && field.options.filter(Boolean).length < 2) {
    return "Campo de seleção precisa de ao menos duas opções — com uma só, é texto fixo.";
  }

  /**
   * Obrigatório e derivado ao mesmo tempo é um formulário que não se pode
   * salvar: o campo é exigido e ninguém tem como preenchê-lo, porque o valor
   * vem do cálculo.
   */
  if (field.required && field.derived) {
    return "Campo derivado não pode ser obrigatório: ninguém consegue preenchê-lo à mão para satisfazer a exigência.";
  }

  return null;
}

export function canDeleteSkill(skill: SkillDefinition, queues: Queue[], users: User[]): Refusal {
  const required = queues.filter((queue) => queue.distribution.requiredSkills.includes(skill.key));
  if (required.length > 0) {
    return `${required.length} fila(s) exigem esta competência: ${required
      .map((queue) => queue.name)
      .join(", ")}. Elas parariam de distribuir.`;
  }

  const holders = users.filter((user) => user.skills.includes(skill.key)).length;
  if (holders > 0) {
    return `${holders} pessoa(s) declaram esta competência. Remova-a dos perfis antes de excluir.`;
  }

  return null;
}

/* Perfis customizados -------------------------------------------------------- */

export function checkCustomRole(
  role: Pick<CustomRole, "key" | "label" | "basedOn">,
  all: CustomRole[],
  currentId?: string,
): Refusal {
  if (!role.label.trim()) return "O perfil precisa de um nome.";

  /**
   * Chave de perfil customizado não pode colidir com a de um embutido: a
   * resolução de permissão consulta os dois pelo mesmo identificador, e a
   * colisão faria o perfil da organização sombrear silenciosamente o do
   * produto — inclusive o de superadministrador.
   */
  if (BUILT_IN_ROLE_KEYS.has(role.key)) {
    return `"${role.key}" é a chave de um perfil embutido. Escolha outra: a colisão faria este perfil sombrear o do produto.`;
  }

  const others = all.filter((item) => item.id !== currentId);
  return checkCatalogKey(
    role.key,
    others.map((item) => item.key),
    all.find((item) => item.id === currentId)?.key,
  );
}

const BUILT_IN_ROLE_KEYS = new Set([
  "superadmin",
  "admin_empresa",
  "gestor_atendimento",
  "atendente",
  "gestor_comercial",
  "marketing",
  "criador_automacoes",
  "analista_dados",
  "auditor_dpo",
]);

export function canDeleteCustomRole(role: CustomRole, users: User[]): Refusal {
  const holders = users.filter((user) => (user.role as string) === role.key).length;
  if (holders > 0) {
    return `${holders} pessoa(s) usam este perfil. Mova-as para outro antes de excluir — sem perfil, elas ficariam sem nenhum acesso.`;
  }
  return null;
}

/* Acesso --------------------------------------------------------------------- */

const CIDR_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(\/(3[0-2]|[12]?\d))?$/;
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/;

export function checkAccessPolicy(policy: Partial<AccessPolicy>): Refusal {
  if (policy.sessionIdleMinutes !== undefined) {
    if (policy.sessionIdleMinutes < 5 || policy.sessionIdleMinutes > 10_080) {
      return "A inatividade da sessão precisa ficar entre 5 minutos e 7 dias.";
    }
  }

  if (policy.sessionMaxDays !== undefined) {
    if (policy.sessionMaxDays < 1 || policy.sessionMaxDays > 365) {
      return "A validade máxima da sessão precisa ficar entre 1 e 365 dias.";
    }
  }

  if (policy.maxFailedLogins !== undefined) {
    if (policy.maxFailedLogins < 3 || policy.maxFailedLogins > 20) {
      return "O limite de tentativas precisa ficar entre 3 e 20. Abaixo de 3, erro de digitação tranca quem tem a senha certa.";
    }
  }

  if (policy.lockoutMinutes !== undefined) {
    if (policy.lockoutMinutes < 1 || policy.lockoutMinutes > 1_440) {
      return "O bloqueio precisa durar entre 1 minuto e 24 horas.";
    }
  }

  for (const domain of policy.allowedEmailDomains ?? []) {
    if (!DOMAIN_PATTERN.test(domain.trim().toLowerCase())) {
      return `"${domain}" não é um domínio válido. Escreva sem "@" e sem protocolo — exemplo: contabilidadefacilitada.com.`;
    }
  }

  for (const range of policy.allowedIpRanges ?? []) {
    if (!CIDR_PATTERN.test(range.trim())) {
      return `"${range}" não é uma faixa CIDR válida. Exemplo: 200.150.10.0/24.`;
    }
  }

  return null;
}

/**
 * O e-mail convidado cabe na política de domínios?
 *
 * É o único controle de `AccessPolicy` que a aplicação já aplica de verdade
 * hoje — os outros dependem do servidor de autenticação. Vale mantê-lo estrito
 * por isso mesmo: é a única parte da tela que não é promessa.
 */
export function checkInviteEmail(email: string, policy: AccessPolicy, users: User[]): Refusal {
  const value = email.trim().toLowerCase();
  if (!value.includes("@")) return "Informe um e-mail válido.";

  if (users.some((user) => user.email.toLowerCase() === value)) {
    return "Esta pessoa já tem acesso. Edite o cadastro em vez de convidar de novo.";
  }

  if (policy.allowedEmailDomains.length === 0) return null;

  const domain = value.split("@")[1] ?? "";
  if (!policy.allowedEmailDomains.some((allowed) => allowed.toLowerCase() === domain)) {
    return `O domínio "${domain}" não está na lista autorizada (${policy.allowedEmailDomains.join(", ")}).`;
  }

  return null;
}

/* Políticas ------------------------------------------------------------------ */

/**
 * Retenção sob bloqueio legal não muda por tela.
 *
 * `legalHold` existe justamente para congelar o dado enquanto há processo ou
 * investigação. Permitir encurtar o prazo ali transformaria um controle de
 * conformidade num campo de formulário.
 */
export function canEditRetention(policy: RetentionPolicy): Refusal {
  return policy.legalHold
    ? "Esta categoria está sob bloqueio legal. Suspenda o bloqueio antes de alterar a retenção."
    : null;
}

export function checkRetentionDays(days: number): Refusal {
  if (!Number.isFinite(days) || days < 1) return "A retenção precisa ser de pelo menos um dia.";
  // Dez anos cobre a exigência fiscal mais longa que este produto encontra.
  if (days > 3_650) return "Acima de dez anos, a retenção precisa de justificativa documentada.";
  return null;
}

/* Permissões ----------------------------------------------------------------- */

/**
 * O superadministrador não perde acesso a recurso.
 *
 * É o perfil que existe para destravar os outros. Rebaixá-lo numa linha da
 * matriz cria a situação em que ninguém consegue mais conceder aquele acesso —
 * inclusive o acesso à própria matriz.
 */
export function canEditPermission(row: PermissionRow, role: string, level: string): Refusal {
  if (role === "superadmin" && level !== "administrar") {
    return "O superadministrador mantém acesso total: é o perfil que destrava os outros.";
  }

  if (row.resource === "administracao" && role === "admin_empresa" && level === "nenhum") {
    return "Sem acesso à Administração, o administrador da empresa não consegue nem desfazer esta alteração.";
  }

  return null;
}
