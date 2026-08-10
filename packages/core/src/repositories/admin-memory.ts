/**
 * Escrita administrativa sobre o armazém em memória.
 *
 * Toda função aqui segue a mesma sequência, e a ordem não é negociável:
 *
 * 1. **encontra** o registro — inexistente é recusa, não exceção;
 * 2. **pergunta à regra** em `utils/admin-rules.ts` — a mesma que a tela usou
 *    para desabilitar o botão, para que as duas nunca discordem;
 * 3. **grava** no armazém;
 * 4. **registra na auditoria**, com autor, horário e o que mudou.
 *
 * O passo 4 é o que justifica a escrita morar no repositório. Deixá-la em cada
 * chamador significaria que a próxima tela a gravar esqueceria o registro — e a
 * seção 18 exige que alteração de permissão e de configuração fique auditada.
 * Aqui não existe caminho de escrita sem rastro, porque não há como escrever sem
 * passar por estas funções.
 */

import type {
  AuditEntry,
  CustomRole,
  FeatureFlag,
  Invitation,
  PermissionRow,
  RetentionPolicy,
} from "../types/governance";
import type { ChannelAccount, Queue, RoleKey, Team, User } from "../types/organization";
import type { PermissionLevel } from "../types/governance";
import type { BusinessSchedule } from "../types/scheduling";
import type { ClosingReason, CustomFieldDefinition, SkillDefinition } from "../types/catalog";
import type { Tag } from "../types/crm";
import type { CannedResponse } from "../types/inbox";
import type { Id } from "../types/common";
import type { Product } from "../types/commerce";
import { PRODUCT_KIND_LABEL, RECURRENCE_SUFFIX } from "../types/commerce";
import { validateCheckoutBaseUrl } from "../utils/commerce";
import { formatCurrencyCents } from "../utils/format";
import {
  DENSITY_LABEL,
  MODE_LABEL,
  PALETTE_CATALOG,
  isAppearanceMode,
  isDensityKey,
  isPaletteKey,
} from "../types/appearance";
import {
  canChangeRole,
  canCreateChannel,
  canDeleteChannel,
  canDeleteCustomRole,
  canDeleteQueue,
  canDeleteSchedule,
  canDeleteSkill,
  canDeleteTeam,
  canDeleteUser,
  canEditPermission,
  canEditRetention,
  checkAccessPolicy,
  checkCatalogKey,
  checkClosingReason,
  checkCustomField,
  checkCustomRole,
  checkDistribution,
  checkInviteEmail,
  checkQueueSla,
  checkRetentionDays,
  checkSchedule,
} from "../utils/admin-rules";
import { offsetIso } from "../utils/datetime";
import { CURRENT_USER_ID, ORG_ID } from "../mock/organization";
import { publishEvent } from "./events-memory";
import { store } from "./store";
import type { AdminActor, AdminRepository, AdminWriteResult } from "./types";

/* Apoios --------------------------------------------------------------------- */

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

function ok<T>(data?: T): AdminWriteResult<T> {
  return { ok: true, data };
}

function no(reason: string): AdminWriteResult<never> {
  return { ok: false, reason };
}

/**
 * Registra a alteração.
 *
 * `severity` sai do que foi mexido, não do verbo. Excluir uma pessoa e alterar a
 * matriz de permissões são críticos porque mudam quem alcança o quê; renomear um
 * time é informativo. Classificar por verbo — "excluir é sempre crítico" —
 * encheria o registro de ruído e faria a operação parar de ler o que importa.
 */
function audit(
  actor: AdminActor,
  input: {
    action: string;
    target: string;
    detail: string;
    category?: AuditEntry["category"];
    severity?: AuditEntry["severity"];
  },
): void {
  const entry: AuditEntry = {
    id: nextId("aud"),
    occurredAt: offsetIso({}),
    actorId: actor.id,
    actorLabel: actor.label,
    action: input.action,
    category: input.category ?? "configuracao",
    target: input.target,
    detail: input.detail,
    severity: input.severity ?? "informativo",
  };

  // No topo: a auditoria é lida do mais recente para o mais antigo.
  store.audit.unshift(entry);
}

/* Pessoas -------------------------------------------------------------------- */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export const adminMemoryRepository: AdminRepository = {
  async createUser(actor, data) {
    const email = data.email.trim().toLowerCase();

    if (!data.name.trim()) return no("O nome é obrigatório.");
    if (!email.includes("@")) return no("Informe um e-mail válido.");

    /**
     * E-mail duplicado é recusa e não aviso.
     *
     * É por ele que a pessoa entra, e dois cadastros com o mesmo e-mail
     * produzem o pior tipo de defeito de acesso: aquele em que o
     * comportamento depende de qual registro a consulta encontrou primeiro.
     */
    if (store.users.some((user) => user.email.toLowerCase() === email)) {
      return no("Já existe alguém com este e-mail.");
    }

    const user: User = {
      ...data,
      id: nextId("usr"),
      organizationId: ORG_ID,
      email,
      name: data.name.trim(),
      initials: data.initials?.trim() || initialsOf(data.name),
      teamIds: [...data.teamIds],
      skills: [...data.skills],
    };

    store.users.push(user);
    audit(actor, {
      action: "usuario.criado",
      target: user.email,
      detail: `${user.name} entrou como ${user.role}.`,
      category: "acesso",
      severity: "atencao",
    });

    publishEvent({
      name: "user.invited",
      source: "admin",
      subjectType: "usuario",
      subjectId: user.id,
      payload: { email: user.email, role: user.role },
    });

    return ok(user);
  },

  async updateUser(actor, id, patch) {
    const user = store.users.find((item) => item.id === id);
    if (!user) return no("Usuário não encontrado.");

    if (patch.role && patch.role !== user.role) {
      const refusal = canChangeRole(user, store.users, patch.role);
      if (refusal) return no(refusal);
    }

    if (patch.email) {
      const email = patch.email.trim().toLowerCase();
      if (!email.includes("@")) return no("Informe um e-mail válido.");
      if (store.users.some((item) => item.id !== id && item.email.toLowerCase() === email)) {
        return no("Já existe alguém com este e-mail.");
      }
      patch = { ...patch, email };
    }

    const before = {
      role: user.role,
      teamIds: [...user.teamIds],
      capacity: user.capacity,
      skills: [...user.skills],
      acceptingNew: user.acceptingNew,
    };

    Object.assign(
      user,
      patch,
      patch.teamIds ? { teamIds: [...patch.teamIds] } : {},
      patch.skills ? { skills: [...patch.skills] } : {},
    );

    // O que mudou, e não o registro inteiro: auditoria que repete o objeto todo
    // não é lida, e o que não é lido não protege ninguém.
    const changes: string[] = [];
    if (patch.role && patch.role !== before.role)
      changes.push(`perfil ${before.role} → ${patch.role}`);
    if (patch.capacity !== undefined && patch.capacity !== before.capacity) {
      changes.push(`capacidade ${before.capacity} → ${patch.capacity}`);
    }
    if (patch.teamIds && patch.teamIds.join() !== before.teamIds.join()) {
      changes.push(`times: ${patch.teamIds.length} vinculado(s)`);
    }
    if (patch.skills && patch.skills.join() !== before.skills.join()) {
      changes.push(`competências: ${patch.skills.join(", ") || "nenhuma"}`);
    }
    /**
     * Pausar o recebimento entra na auditoria de propósito.
     *
     * É a explicação de "a fila está distribuindo e eu não recebo nada" — e sem
     * registro, o próprio atendente esquece que se pausou na semana passada.
     */
    if (patch.acceptingNew !== undefined && patch.acceptingNew !== before.acceptingNew) {
      changes.push(
        patch.acceptingNew ? "voltou a receber conversas novas" : "pausou o recebimento",
      );
    }

    audit(actor, {
      action: "usuario.alterado",
      target: user.email,
      detail: changes.length > 0 ? changes.join(" · ") : "dados de cadastro atualizados",
      category: "acesso",
      severity: patch.role ? "atencao" : "informativo",
    });

    return ok(user);
  },

  async deleteUser(actor, id) {
    const user = store.users.find((item) => item.id === id);
    if (!user) return no("Usuário não encontrado.");

    const refusal = canDeleteUser(user, store.users, store.queues, CURRENT_USER_ID);
    if (refusal) return no(refusal);

    store.users = store.users.filter((item) => item.id !== id);
    audit(actor, {
      action: "usuario.excluido",
      target: user.email,
      detail: `${user.name} (${user.role}) foi removido da organização.`,
      category: "acesso",
      severity: "critico",
    });

    publishEvent({
      name: "user.removed",
      source: "admin",
      subjectType: "usuario",
      subjectId: user.id,
      payload: { email: user.email, role: user.role },
    });

    return ok();
  },

  /* Times -------------------------------------------------------------------- */

  async createTeam(actor, name) {
    const label = name.trim();
    if (!label) return no("O nome do time é obrigatório.");
    if (store.teams.some((team) => team.name.toLowerCase() === label.toLowerCase())) {
      return no("Já existe um time com este nome.");
    }

    const team: Team = { id: nextId("team"), organizationId: ORG_ID, name: label };
    store.teams.push(team);
    audit(actor, { action: "time.criado", target: label, detail: "Time criado." });

    return ok(team);
  },

  async updateTeam(actor, id, name) {
    const team = store.teams.find((item) => item.id === id);
    if (!team) return no("Time não encontrado.");

    const label = name.trim();
    if (!label) return no("O nome do time é obrigatório.");

    const before = team.name;
    team.name = label;
    audit(actor, { action: "time.alterado", target: label, detail: `"${before}" → "${label}".` });

    return ok(team);
  },

  async deleteTeam(actor, id) {
    const team = store.teams.find((item) => item.id === id);
    if (!team) return no("Time não encontrado.");

    const refusal = canDeleteTeam(team, store.queues, store.users);
    if (refusal) return no(refusal);

    store.teams = store.teams.filter((item) => item.id !== id);
    audit(actor, {
      action: "time.excluido",
      target: team.name,
      detail: "Time removido.",
      severity: "atencao",
    });

    return ok();
  },

  /* Filas -------------------------------------------------------------------- */

  async createQueue(actor, data) {
    if (!data.name.trim()) return no("O nome da fila é obrigatório.");

    const refusal = checkQueueSla(data.firstResponseSlaMinutes, data.resolutionSlaMinutes);
    if (refusal) return no(refusal);

    if (data.channels.length === 0) return no("Escolha ao menos um canal que entrega nesta fila.");

    const distributionRefusal = checkDistribution(
      data.distribution,
      { teamId: data.teamId },
      store.users,
      store.skills,
    );
    if (distributionRefusal) return no(distributionRefusal);

    if (data.scheduleId && !store.schedules.some((item) => item.id === data.scheduleId)) {
      return no("A escala escolhida não existe.");
    }

    const queue: Queue = {
      ...data,
      id: nextId("queue"),
      organizationId: ORG_ID,
      name: data.name.trim(),
      channels: [...data.channels],
      distribution: { ...data.distribution, requiredSkills: [...data.distribution.requiredSkills] },
      createdAt: offsetIso({}),
      updatedAt: offsetIso({}),
    };

    store.queues.push(queue);
    audit(actor, {
      action: "fila.criada",
      target: queue.name,
      detail: `SLA ${queue.firstResponseSlaMinutes} min para primeira resposta.`,
      severity: "atencao",
    });

    publishEvent({
      name: "queue.created",
      source: "admin",
      subjectType: "fila",
      subjectId: queue.id,
      payload: { name: queue.name, teamId: queue.teamId, channels: queue.channels },
    });

    return ok(queue);
  },

  async updateQueue(actor, id, patch) {
    const queue = store.queues.find((item) => item.id === id);
    if (!queue) return no("Fila não encontrada.");

    const first = patch.firstResponseSlaMinutes ?? queue.firstResponseSlaMinutes;
    const resolution = patch.resolutionSlaMinutes ?? queue.resolutionSlaMinutes;

    const refusal = checkQueueSla(first, resolution);
    if (refusal) return no(refusal);

    if (patch.channels && patch.channels.length === 0) {
      return no("Escolha ao menos um canal que entrega nesta fila.");
    }

    /**
     * A distribuição é conferida contra o time **resultante**, não o atual.
     *
     * Trocar o time responsável e o modelo na mesma gravação é comum ("esta
     * fila passa para o comercial, e lá usamos roleta"). Validando contra o
     * time antigo, a checagem de "ninguém tem esta habilidade" olharia para as
     * pessoas erradas e aprovaria uma configuração que trava a fila.
     */
    const distribution = patch.distribution ?? queue.distribution;
    const teamId = patch.teamId ?? queue.teamId;

    const distributionRefusal = checkDistribution(
      distribution,
      { teamId, id: queue.id },
      store.users,
      store.skills,
    );
    if (distributionRefusal) return no(distributionRefusal);

    if (patch.scheduleId && !store.schedules.some((item) => item.id === patch.scheduleId)) {
      return no("A escala escolhida não existe.");
    }

    const before = {
      first: queue.firstResponseSlaMinutes,
      name: queue.name,
      model: queue.distribution.model,
      delivery: queue.distribution.delivery,
      scheduleId: queue.scheduleId,
    };

    Object.assign(
      queue,
      patch,
      patch.channels ? { channels: [...patch.channels] } : {},
      patch.distribution
        ? {
            distribution: {
              ...patch.distribution,
              requiredSkills: [...patch.distribution.requiredSkills],
            },
          }
        : {},
    );
    queue.updatedAt = offsetIso({});

    const changes: string[] = [];
    if (patch.name && patch.name !== before.name)
      changes.push(`"${before.name}" → "${patch.name}"`);
    if (first !== before.first) changes.push(`SLA de 1ª resposta ${before.first} → ${first} min`);
    if (queue.distribution.model !== before.model) {
      changes.push(`distribuição ${before.model} → ${queue.distribution.model}`);
    }
    if (queue.distribution.delivery !== before.delivery) {
      changes.push(`entrega ${before.delivery} → ${queue.distribution.delivery}`);
    }
    if (patch.scheduleId !== undefined && patch.scheduleId !== before.scheduleId) {
      const schedule = store.schedules.find((item) => item.id === patch.scheduleId);
      changes.push(schedule ? `escala: ${schedule.name}` : "escala removida");
    }

    /**
     * Mexer em distribuição é `atencao`, não informativo.
     *
     * Renomear fila não muda para onde a conversa vai; trocar o modelo muda —
     * e a pergunta "desde quando as conversas param de cair para o Rafael?"
     * precisa de uma linha com data para ser respondida.
     */
    const touchedRouting = Boolean(
      patch.distribution || patch.teamId || patch.scheduleId !== undefined,
    );

    audit(actor, {
      action: "fila.alterada",
      target: queue.name,
      detail: changes.length > 0 ? changes.join(" · ") : "configuração atualizada",
      severity: touchedRouting ? "atencao" : "informativo",
    });

    return ok(queue);
  },

  async deleteQueue(actor, id) {
    const queue = store.queues.find((item) => item.id === id);
    if (!queue) return no("Fila não encontrada.");

    const refusal = canDeleteQueue(queue, store.channelAccounts);
    if (refusal) return no(refusal);

    store.queues = store.queues.filter((item) => item.id !== id);
    audit(actor, {
      action: "fila.excluida",
      target: queue.name,
      detail: "Fila removida.",
      severity: "critico",
    });

    return ok();
  },

  /* Canais ------------------------------------------------------------------- */

  async createChannel(actor, data) {
    const refusal = canCreateChannel(data.address, data.kind, store.channelAccounts);
    if (refusal) return no(refusal);

    if (!data.label.trim()) return no("Dê um nome a esta conta.");
    if (!store.queues.some((queue) => queue.id === data.queueId)) {
      return no("A fila escolhida não existe.");
    }

    /**
     * A conta nasce **desconectada**, não "conectada".
     *
     * Cadastrar o endereço não fala com provedor nenhum. Marcá-la como conectada
     * na criação faria a lista mentir logo no primeiro instante — e o sintoma
     * apareceria como "está conectado mas não chega mensagem".
     */
    const channel: ChannelAccount = {
      id: nextId("chan"),
      organizationId: ORG_ID,
      kind: data.kind,
      label: data.label.trim(),
      address: data.address.trim(),
      queueId: data.queueId,
      status: "desconectado",
      connection: data.connection ?? {
        provider: "",
        fields: {},
        state: "nao_configurado",
      },
      createdAt: offsetIso({}),
      updatedAt: offsetIso({}),
    };

    store.channelAccounts.push(channel);
    audit(actor, {
      action: "canal.criado",
      target: channel.label,
      detail: `${channel.kind} ${channel.address} cadastrado, ainda sem conexão.`,
      severity: "atencao",
    });

    return ok(channel);
  },

  async setChannelConnection(actor, id, connection) {
    const channel = store.channelAccounts.find((item) => item.id === id);
    if (!channel) return no("Canal não encontrado.");

    if (channel.kind === "webchat") {
      return no(
        "O canal de webchat não tem provedor a conectar: ele é servido pela própria aplicação.",
      );
    }

    const before = channel.connection?.state ?? "nao_configurado";
    channel.connection = connection;
    channel.updatedAt = offsetIso({});

    // O estado operacional segue o da conexão enquanto não houver provedor
    // respondendo: dizer "conectado" na operação sem nunca ter falado com o
    // provedor seria inventar saúde.
    channel.status = connection.state === "conectado" ? "conectado" : "desconectado";

    audit(actor, {
      action: "canal.conectado",
      target: channel.label,
      detail: `Configuração de ${connection.provider}: ${before} → ${connection.state}.`,
      category: "seguranca",
      severity: "atencao",
    });

    publishEvent({
      name: "channel.connected",
      source: "admin",
      subjectType: "canal",
      subjectId: channel.id,
      payload: { kind: channel.kind, provider: connection.provider, state: connection.state },
    });

    return ok(channel);
  },

  async updateChannel(actor, id, patch) {
    const channel = store.channelAccounts.find((item) => item.id === id);
    if (!channel) return no("Canal não encontrado.");

    if (patch.queueId && !store.queues.some((queue) => queue.id === patch.queueId)) {
      return no("A fila escolhida não existe.");
    }

    const before = { queueId: channel.queueId, label: channel.label };
    Object.assign(channel, patch);

    const changes: string[] = [];
    if (patch.label && patch.label !== before.label) {
      changes.push(`"${before.label}" → "${patch.label}"`);
    }
    if (patch.queueId && patch.queueId !== before.queueId) {
      const queue = store.queues.find((item) => item.id === patch.queueId);
      changes.push(`passa a entregar em ${queue?.name ?? patch.queueId}`);
    }

    audit(actor, {
      action: "canal.alterado",
      target: channel.label,
      detail: changes.length > 0 ? changes.join(" · ") : "configuração atualizada",
    });

    return ok(channel);
  },

  async deleteChannel(actor, id) {
    const channel = store.channelAccounts.find((item) => item.id === id);
    if (!channel) return no("Canal não encontrado.");

    const refusal = canDeleteChannel(channel);
    if (refusal) return no(refusal);

    store.channelAccounts = store.channelAccounts.filter((item) => item.id !== id);
    audit(actor, {
      action: "canal.excluido",
      target: channel.label,
      detail: `${channel.kind} ${channel.address} desconectado e removido.`,
      severity: "critico",
    });

    return ok();
  },

  /* Permissões --------------------------------------------------------------- */

  async setPermission(actor, resource, role, level) {
    const row: PermissionRow | undefined = store.permissions.find(
      (item) => item.resource === resource,
    );
    if (!row) return no("Recurso não encontrado na matriz.");

    const refusal = canEditPermission(row, role, level);
    if (refusal) return no(refusal);

    const before = row.levels[role as RoleKey] ?? "nenhum";
    row.levels[role as RoleKey] = level as PermissionLevel;

    audit(actor, {
      action: "permissao.alterada",
      target: `${row.label} · ${role}`,
      detail: `${before} → ${level}.`,
      category: "seguranca",
      // Matriz de permissão é sempre crítica: ela decide quem alcança o quê.
      severity: "critico",
    });

    return ok();
  },

  /* Flags e retenção --------------------------------------------------------- */

  async updateFlag(actor, key, patch) {
    const flag: FeatureFlag | undefined = store.flags.find((item) => item.key === key);
    if (!flag) return no("Chave não encontrada.");

    if (patch.rolloutPct !== undefined && (patch.rolloutPct < 0 || patch.rolloutPct > 100)) {
      return no("A exposição precisa estar entre 0 e 100.");
    }

    const before = { enabled: flag.enabled, rollout: flag.rolloutPct };
    Object.assign(flag, patch);
    flag.updatedAt = offsetIso({});

    const changes: string[] = [];
    if (patch.enabled !== undefined && patch.enabled !== before.enabled) {
      changes.push(patch.enabled ? "ligada" : "desligada");
    }
    if (patch.rolloutPct !== undefined && patch.rolloutPct !== before.rollout) {
      changes.push(`exposição ${before.rollout}% → ${patch.rolloutPct}%`);
    }

    audit(actor, {
      action: "flag.alterada",
      target: flag.label,
      detail: changes.join(" · ") || "atualizada",
      category: "configuracao",
      severity: "atencao",
    });

    return ok();
  },

  async updateRetention(actor, category, patch) {
    const policy: RetentionPolicy | undefined = store.retention.find(
      (item) => item.category === category,
    );
    if (!policy) return no("Categoria não encontrada.");

    /**
     * O bloqueio legal pode ser **suspenso** por aqui, mas nada mais muda
     * enquanto ele estiver de pé. Separar as duas coisas é o que impede alguém
     * de encurtar a retenção "sem querer" com o bloqueio ativo.
     */
    if (patch.legalHold === undefined) {
      const refusal = canEditRetention(policy);
      if (refusal) return no(refusal);
    }

    if (patch.retentionDays !== undefined) {
      const refusal = checkRetentionDays(patch.retentionDays);
      if (refusal) return no(refusal);
    }

    const before = { days: policy.retentionDays, hold: policy.legalHold };
    Object.assign(policy, patch);

    const changes: string[] = [];
    if (patch.retentionDays !== undefined && patch.retentionDays !== before.days) {
      changes.push(`retenção ${before.days} → ${patch.retentionDays} dias`);
    }
    if (patch.legalHold !== undefined && patch.legalHold !== before.hold) {
      changes.push(patch.legalHold ? "bloqueio legal ativado" : "bloqueio legal suspenso");
    }

    audit(actor, {
      action: "retencao.alterada",
      target: policy.category,
      detail: changes.join(" · ") || "atualizada",
      category: "seguranca",
      severity: "critico",
    });

    return ok();
  },

  /* Escalas ------------------------------------------------------------------ */

  async createSchedule(actor, data) {
    const refusal = checkSchedule(data);
    if (refusal) return no(refusal);

    const schedule: BusinessSchedule = {
      ...data,
      id: nextId("sched"),
      organizationId: ORG_ID,
      name: data.name.trim(),
      createdAt: offsetIso({}),
      updatedAt: offsetIso({}),
    };

    store.schedules.push(schedule);
    audit(actor, {
      action: "escala.criada",
      target: schedule.name,
      detail: `${schedule.days.filter((day) => day.ranges.length > 0).length} dia(s) com atendimento.`,
      severity: "atencao",
    });

    return ok(schedule);
  },

  async updateSchedule(actor, id, patch) {
    const schedule = store.schedules.find((item) => item.id === id);
    if (!schedule) return no("Escala não encontrada.");

    const next = { ...schedule, ...patch };
    const refusal = checkSchedule(next);
    if (refusal) return no(refusal);

    const before = { name: schedule.name, days: JSON.stringify(schedule.days) };
    Object.assign(schedule, patch);
    schedule.updatedAt = offsetIso({});

    const changes: string[] = [];
    if (patch.name && patch.name !== before.name)
      changes.push(`"${before.name}" → "${patch.name}"`);
    if (patch.days && JSON.stringify(patch.days) !== before.days)
      changes.push("expediente alterado");
    if (patch.exceptions) changes.push(`${patch.exceptions.length} exceção(ões)`);

    /**
     * Alterar escala é `atencao`, não informativo.
     *
     * Ela decide quando a distribuição roda e quando o widget diz que está
     * fechado — mexer nela derruba atendimento de forma legítima, e é
     * exatamente por isso que precisa aparecer na auditoria de quem procura
     * "por que ninguém recebeu nada na sexta".
     */
    audit(actor, {
      action: "escala.alterada",
      target: schedule.name,
      detail: changes.join(" · ") || "configuração atualizada",
      severity: "atencao",
    });

    return ok(schedule);
  },

  async deleteSchedule(actor, id) {
    const schedule = store.schedules.find((item) => item.id === id);
    if (!schedule) return no("Escala não encontrada.");

    const refusal = canDeleteSchedule(id, store.queues, store.users);
    if (refusal) return no(refusal);

    store.schedules = store.schedules.filter((item) => item.id !== id);
    audit(actor, {
      action: "escala.excluida",
      target: schedule.name,
      detail: "Escala removida.",
      severity: "atencao",
    });

    return ok();
  },

  /* Catálogo — habilidades --------------------------------------------------- */

  async createSkill(actor, data) {
    if (!data.label.trim()) return no("A competência precisa de um rótulo.");

    const refusal = checkCatalogKey(
      data.key,
      store.skills.map((item) => item.key),
    );
    if (refusal) return no(refusal);

    const skill: SkillDefinition = {
      ...data,
      id: nextId("skill"),
      organizationId: ORG_ID,
      key: data.key.trim(),
      label: data.label.trim(),
      createdAt: offsetIso({}),
      updatedAt: offsetIso({}),
    };

    store.skills.push(skill);
    audit(actor, {
      action: "habilidade.criada",
      target: skill.label,
      detail: `chave ${skill.key}`,
    });

    return ok(skill);
  },

  async updateSkill(actor, id, patch) {
    const skill = store.skills.find((item) => item.id === id);
    if (!skill) return no("Competência não encontrada.");

    /**
     * A chave não muda depois de criada.
     *
     * Ela está gravada no perfil de cada pessoa e na exigência de cada fila.
     * Renomeá-la aqui trocaria o rótulo e deixaria as referências apontando
     * para uma chave que não existe mais — a fila pararia de distribuir e nada
     * na tela indicaria o motivo.
     */
    if (patch.key && patch.key !== skill.key) {
      return no(
        "A chave da competência não pode mudar: ela está gravada nos perfis e nas filas que a exigem.",
      );
    }

    if (patch.active === false) {
      const required = store.queues.filter((queue) =>
        queue.distribution.requiredSkills.includes(skill.key),
      );
      if (required.length > 0) {
        return no(
          `${required.length} fila(s) exigem esta competência: ${required.map((queue) => queue.name).join(", ")}. Desativá-la travaria a distribuição.`,
        );
      }
    }

    Object.assign(skill, patch);
    skill.updatedAt = offsetIso({});
    audit(actor, {
      action: "habilidade.alterada",
      target: skill.label,
      detail: patch.active === false ? "desativada" : "atualizada",
    });

    return ok(skill);
  },

  async deleteSkill(actor, id) {
    const skill = store.skills.find((item) => item.id === id);
    if (!skill) return no("Competência não encontrada.");

    const refusal = canDeleteSkill(skill, store.queues, store.users);
    if (refusal) return no(refusal);

    store.skills = store.skills.filter((item) => item.id !== id);
    audit(actor, { action: "habilidade.excluida", target: skill.label, detail: "Removida." });

    return ok();
  },

  /* Catálogo — motivos de encerramento --------------------------------------- */

  async createClosingReason(actor, data) {
    const refusal = checkClosingReason(data, store.closingReasons);
    if (refusal) return no(refusal);

    const reason: ClosingReason = {
      ...data,
      id: nextId("close"),
      organizationId: ORG_ID,
      key: data.key.trim(),
      label: data.label.trim(),
      order: data.order || store.closingReasons.length + 1,
      createdAt: offsetIso({}),
      updatedAt: offsetIso({}),
    };

    store.closingReasons.push(reason);
    audit(actor, {
      action: "motivo.criado",
      target: reason.label,
      detail: reason.resolved ? "conta como resolvido" : "não conta como resolvido",
    });

    return ok(reason);
  },

  async updateClosingReason(actor, id, patch) {
    const reason = store.closingReasons.find((item) => item.id === id);
    if (!reason) return no("Motivo não encontrado.");

    if (patch.key && patch.key !== reason.key) {
      return no("A chave do motivo não pode mudar: ela está gravada nas conversas já encerradas.");
    }

    const refusal = checkClosingReason({ ...reason, ...patch }, store.closingReasons, id);
    if (refusal) return no(refusal);

    const beforeResolved = reason.resolved;
    Object.assign(reason, patch);
    reason.updatedAt = offsetIso({});

    /**
     * Virar a marca de "resolvido" reescreve o passado do indicador.
     *
     * As conversas já encerradas guardam a chave do motivo, e a taxa de
     * resolução é calculada olhando esta marca **agora**. Trocá-la muda o
     * número de meses fechados — daí o registro em `atencao`, com o antes e o
     * depois escritos.
     */
    audit(actor, {
      action: "motivo.alterado",
      target: reason.label,
      detail:
        patch.resolved !== undefined && patch.resolved !== beforeResolved
          ? `passou a ${patch.resolved ? "contar" : "não contar"} como resolvido — a taxa histórica muda junto`
          : "atualizado",
      severity:
        patch.resolved !== undefined && patch.resolved !== beforeResolved
          ? "atencao"
          : "informativo",
    });

    return ok(reason);
  },

  async deleteClosingReason(actor, id) {
    const reason = store.closingReasons.find((item) => item.id === id);
    if (!reason) return no("Motivo não encontrado.");

    if (store.closingReasons.filter((item) => item.active).length <= 1) {
      return no("É o último motivo ativo. Sem nenhum, não seria possível encerrar conversa.");
    }

    store.closingReasons = store.closingReasons.filter((item) => item.id !== id);
    audit(actor, {
      action: "motivo.excluido",
      target: reason.label,
      detail: "As conversas encerradas com este motivo mantêm a chave gravada.",
      severity: "atencao",
    });

    return ok();
  },

  /* Catálogo — campos personalizados ----------------------------------------- */

  async createCustomField(actor, data) {
    const refusal = checkCustomField(data, store.customFields);
    if (refusal) return no(refusal);

    const field: CustomFieldDefinition = {
      ...data,
      id: nextId("cf"),
      organizationId: ORG_ID,
      key: data.key.trim(),
      label: data.label.trim(),
      options: data.options.filter(Boolean),
      createdAt: offsetIso({}),
      updatedAt: offsetIso({}),
    };

    store.customFields.push(field);
    audit(actor, {
      action: "campo.criado",
      target: `${field.entity}.${field.key}`,
      detail: `${field.label} (${field.type})${field.sensitive ? " — marcado como sensível" : ""}`,
      category: field.sensitive ? "seguranca" : "configuracao",
      severity: field.sensitive ? "atencao" : "informativo",
    });

    return ok(field);
  },

  async updateCustomField(actor, id, patch) {
    const field = store.customFields.find((item) => item.id === id);
    if (!field) return no("Campo não encontrado.");

    if (patch.key && patch.key !== field.key) {
      return no("A chave do campo não pode mudar: ela está gravada nos registros já preenchidos.");
    }

    const refusal = checkCustomField({ ...field, ...patch }, store.customFields, id);
    if (refusal) return no(refusal);

    const beforeSensitive = field.sensitive;
    Object.assign(field, patch, patch.options ? { options: patch.options.filter(Boolean) } : {});
    field.updatedAt = offsetIso({});

    /**
     * Tirar a marca de sensível é evento de segurança.
     *
     * É ela que decide se o valor é mascarado no contexto que a IA recebe
     * (seção 16.4). Removida sem registro, um documento passaria a viajar em
     * claro para o provedor e ninguém saberia dizer desde quando.
     */
    const desensitized = beforeSensitive && patch.sensitive === false;

    audit(actor, {
      action: "campo.alterado",
      target: `${field.entity}.${field.key}`,
      detail: desensitized
        ? "deixou de ser sensível — o valor passa a chegar sem máscara ao contexto da IA"
        : "atualizado",
      category: desensitized ? "seguranca" : "configuracao",
      severity: desensitized ? "critico" : "informativo",
    });

    return ok(field);
  },

  async deleteCustomField(actor, id) {
    const field = store.customFields.find((item) => item.id === id);
    if (!field) return no("Campo não encontrado.");

    store.customFields = store.customFields.filter((item) => item.id !== id);
    audit(actor, {
      action: "campo.excluido",
      target: `${field.entity}.${field.key}`,
      detail: "Os valores já gravados nos registros deixam de aparecer nas telas.",
      severity: "critico",
    });

    return ok();
  },

  /* Catálogo — tags ---------------------------------------------------------- */

  async createTag(actor, name, hue) {
    const label = name.trim();
    if (!label) return no("A tag precisa de um nome.");
    if (store.tags.some((tag) => tag.name.toLowerCase() === label.toLowerCase())) {
      return no("Já existe uma tag com este nome. Duas iguais dividem o mesmo filtro em duas.");
    }

    const tag: Tag = { id: nextId("tag"), name: label, hue };
    store.tags.push(tag);
    audit(actor, { action: "tag.criada", target: label, detail: "Tag criada." });

    return ok(tag);
  },

  async updateTag(actor, id, patch) {
    const tag = store.tags.find((item) => item.id === id);
    if (!tag) return no("Tag não encontrada.");

    if (patch.name !== undefined) {
      const label = patch.name.trim();
      if (!label) return no("A tag precisa de um nome.");
      if (
        store.tags.some((item) => item.id !== id && item.name.toLowerCase() === label.toLowerCase())
      ) {
        return no("Já existe uma tag com este nome.");
      }
      patch = { ...patch, name: label };
    }

    const before = tag.name;
    Object.assign(tag, patch);
    audit(actor, {
      action: "tag.alterada",
      target: tag.name,
      detail: before !== tag.name ? `"${before}" → "${tag.name}"` : "cor atualizada",
    });

    return ok(tag);
  },

  async deleteTag(actor, id) {
    const tag = store.tags.find((item) => item.id === id);
    if (!tag) return no("Tag não encontrada.");

    store.tags = store.tags.filter((item) => item.id !== id);
    audit(actor, {
      action: "tag.excluida",
      target: tag.name,
      detail: "Os contatos e conversas marcados perdem a marcação.",
      severity: "atencao",
    });

    return ok();
  },

  /* Catálogo — respostas rápidas --------------------------------------------- */

  async createCannedResponse(actor, data) {
    const shortcut = data.shortcut.trim().replace(/^\/*/, "");
    if (!shortcut) return no("A resposta rápida precisa de um atalho.");
    if (!data.title.trim()) return no("A resposta rápida precisa de um título.");
    if (!data.body.trim()) return no("A resposta rápida precisa de um corpo.");

    /**
     * Atalho repetido é o defeito que aparece na frente do cliente.
     *
     * Duas respostas com `/prazo` fazem o compositor escolher pela ordem da
     * lista, e o atendente envia a errada acreditando que digitou a certa.
     */
    if (
      store.cannedResponses.some((item) => item.shortcut.toLowerCase() === shortcut.toLowerCase())
    ) {
      return no(
        `O atalho "/${shortcut}" já existe. Duas respostas com o mesmo atalho fazem o compositor escolher pela ordem da lista.`,
      );
    }

    const response: CannedResponse = {
      id: nextId("canned"),
      organizationId: ORG_ID,
      shortcut,
      title: data.title.trim(),
      body: data.body.trim(),
      channels: [...data.channels],
    };

    store.cannedResponses.push(response);
    audit(actor, {
      action: "resposta_rapida.criada",
      target: `/${shortcut}`,
      detail: response.title,
    });

    return ok(response);
  },

  async updateCannedResponse(actor, id, patch) {
    const response = store.cannedResponses.find((item) => item.id === id);
    if (!response) return no("Resposta rápida não encontrada.");

    if (patch.shortcut !== undefined) {
      const shortcut = patch.shortcut.trim().replace(/^\/*/, "");
      if (!shortcut) return no("A resposta rápida precisa de um atalho.");
      if (
        store.cannedResponses.some(
          (item) => item.id !== id && item.shortcut.toLowerCase() === shortcut.toLowerCase(),
        )
      ) {
        return no(`O atalho "/${shortcut}" já existe.`);
      }
      patch = { ...patch, shortcut };
    }

    Object.assign(response, patch, patch.channels ? { channels: [...patch.channels] } : {});
    audit(actor, {
      action: "resposta_rapida.alterada",
      target: `/${response.shortcut}`,
      detail: response.title,
    });

    return ok(response);
  },

  async deleteCannedResponse(actor, id) {
    const response = store.cannedResponses.find((item) => item.id === id);
    if (!response) return no("Resposta rápida não encontrada.");

    store.cannedResponses = store.cannedResponses.filter((item) => item.id !== id);
    audit(actor, {
      action: "resposta_rapida.excluida",
      target: `/${response.shortcut}`,
      detail: response.title,
    });

    return ok();
  },

  /* Perfis customizados ------------------------------------------------------ */

  async createCustomRole(actor, data) {
    const refusal = checkCustomRole(data, store.customRoles);
    if (refusal) return no(refusal);

    const role: CustomRole = {
      ...data,
      id: nextId("role"),
      organizationId: ORG_ID,
      key: data.key.trim(),
      label: data.label.trim(),
      overrides: { ...data.overrides },
      queueIds: [...data.queueIds],
      teamIds: [...data.teamIds],
      createdAt: offsetIso({}),
      updatedAt: offsetIso({}),
    };

    store.customRoles.push(role);
    audit(actor, {
      action: "perfil.criado",
      target: role.label,
      detail: `derivado de ${role.basedOn}, ${Object.keys(role.overrides).length} ajuste(s)${role.queueIds.length > 0 ? `, restrito a ${role.queueIds.length} fila(s)` : ""}`,
      category: "seguranca",
      // Perfil é acesso: criar um define o que um grupo inteiro alcança.
      severity: "critico",
    });

    return ok(role);
  },

  async updateCustomRole(actor, id, patch) {
    const role = store.customRoles.find((item) => item.id === id);
    if (!role) return no("Perfil não encontrado.");

    if (patch.key && patch.key !== role.key) {
      return no("A chave do perfil não pode mudar: ela está gravada no cadastro de quem o usa.");
    }

    const refusal = checkCustomRole({ ...role, ...patch }, store.customRoles, id);
    if (refusal) return no(refusal);

    const before = {
      overrides: Object.keys(role.overrides).length,
      queues: role.queueIds.length,
    };

    Object.assign(
      role,
      patch,
      patch.overrides ? { overrides: { ...patch.overrides } } : {},
      patch.queueIds ? { queueIds: [...patch.queueIds] } : {},
      patch.teamIds ? { teamIds: [...patch.teamIds] } : {},
    );
    role.updatedAt = offsetIso({});

    const changes: string[] = [];
    if (patch.overrides && Object.keys(patch.overrides).length !== before.overrides) {
      changes.push(
        `${before.overrides} → ${Object.keys(role.overrides).length} ajuste(s) de permissão`,
      );
    }
    if (patch.queueIds && patch.queueIds.length !== before.queues) {
      changes.push(
        role.queueIds.length === 0
          ? "alcance ampliado para todas as filas"
          : `alcance restrito a ${role.queueIds.length} fila(s)`,
      );
    }

    audit(actor, {
      action: "perfil.alterado",
      target: role.label,
      detail: changes.join(" · ") || "atualizado",
      category: "seguranca",
      severity: "critico",
    });

    return ok(role);
  },

  async deleteCustomRole(actor, id) {
    const role = store.customRoles.find((item) => item.id === id);
    if (!role) return no("Perfil não encontrado.");

    const refusal = canDeleteCustomRole(role, store.users);
    if (refusal) return no(refusal);

    store.customRoles = store.customRoles.filter((item) => item.id !== id);
    audit(actor, {
      action: "perfil.excluido",
      target: role.label,
      detail: "Perfil removido.",
      category: "seguranca",
      severity: "critico",
    });

    return ok();
  },

  /* Acesso ------------------------------------------------------------------- */

  async updateAccessPolicy(actor, patch) {
    const refusal = checkAccessPolicy(patch);
    if (refusal) return no(refusal);

    const before = { ...store.accessPolicy };

    Object.assign(
      store.accessPolicy,
      patch,
      patch.requireTwoFactorFor ? { requireTwoFactorFor: [...patch.requireTwoFactorFor] } : {},
      patch.allowedEmailDomains
        ? {
            allowedEmailDomains: patch.allowedEmailDomains.map((item) => item.trim().toLowerCase()),
          }
        : {},
      patch.allowedIpRanges
        ? { allowedIpRanges: patch.allowedIpRanges.map((item) => item.trim()) }
        : {},
    );
    store.accessPolicy.updatedAt = offsetIso({});

    const changes: string[] = [];
    if (
      patch.sessionIdleMinutes !== undefined &&
      patch.sessionIdleMinutes !== before.sessionIdleMinutes
    ) {
      changes.push(`inatividade ${before.sessionIdleMinutes} → ${patch.sessionIdleMinutes} min`);
    }
    if (patch.requireTwoFactorFor) {
      const removed = before.requireTwoFactorFor.filter(
        (role) => !store.accessPolicy.requireTwoFactorFor.includes(role),
      );
      if (removed.length > 0) changes.push(`2FA deixou de ser exigido de: ${removed.join(", ")}`);
      const added = store.accessPolicy.requireTwoFactorFor.filter(
        (role) => !before.requireTwoFactorFor.includes(role),
      );
      if (added.length > 0) changes.push(`2FA passou a ser exigido de: ${added.join(", ")}`);
    }
    if (patch.allowedEmailDomains) {
      changes.push(
        store.accessPolicy.allowedEmailDomains.length === 0
          ? "domínios de convite liberados para qualquer um"
          : `domínios de convite: ${store.accessPolicy.allowedEmailDomains.join(", ")}`,
      );
    }
    if (patch.allowedIpRanges) {
      changes.push(
        store.accessPolicy.allowedIpRanges.length === 0
          ? "restrição de origem removida"
          : `origens autorizadas: ${store.accessPolicy.allowedIpRanges.join(", ")}`,
      );
    }

    audit(actor, {
      action: "acesso.alterado",
      target: "Política de acesso",
      detail: changes.join(" · ") || "atualizada",
      category: "seguranca",
      severity: "critico",
    });

    return ok(store.accessPolicy);
  },

  async createInvitation(actor, data) {
    const refusal = checkInviteEmail(data.email, store.accessPolicy, store.users);
    if (refusal) return no(refusal);

    const email = data.email.trim().toLowerCase();

    const pending = store.invitations.find(
      (item) => item.email.toLowerCase() === email && item.status === "pendente",
    );
    if (pending) return no("Já existe um convite pendente para este e-mail.");

    const known =
      BUILT_IN_ROLES.has(data.role) ||
      store.customRoles.some((role) => role.key === data.role && role.active);
    if (!known) return no("O perfil escolhido não existe ou está inativo.");

    const invitation: Invitation = {
      id: nextId("inv"),
      email,
      role: data.role,
      teamIds: [...data.teamIds],
      invitedByLabel: actor.label,
      createdAt: offsetIso({}),
      // Sete dias é o prazo que a política de acesso assume; convite eterno
      // vira porta aberta em caixa de e-mail que ninguém mais lê.
      expiresAt: offsetIso({ days: 7 }),
      status: "pendente",
    };

    store.invitations.unshift(invitation);
    audit(actor, {
      action: "convite.criado",
      target: email,
      detail: `perfil ${data.role}, expira em 7 dias`,
      category: "acesso",
      severity: "atencao",
    });

    return ok(invitation);
  },

  async revokeInvitation(actor, id) {
    const invitation = store.invitations.find((item) => item.id === id);
    if (!invitation) return no("Convite não encontrado.");
    if (invitation.status === "aceito") {
      return no("Este convite já foi aceito. Para tirar o acesso, exclua a pessoa em Pessoas.");
    }

    invitation.status = "revogado";
    audit(actor, {
      action: "convite.revogado",
      target: invitation.email,
      detail: "Convite revogado antes do aceite.",
      category: "acesso",
      severity: "atencao",
    });

    return ok();
  },

  /* Catálogo comercial -------------------------------------------------------- */

  /**
   * Produto novo.
   *
   * A chave é conferida contra o catálogo inteiro, incluindo inativos: produto
   * inativo continua citado dentro de propostas antigas, e reaproveitar a chave
   * faria duas ofertas diferentes compartilharem identidade no relatório.
   */
  async createProduct(actor, data) {
    const key = data.key.trim().toLowerCase();
    const keyRefusal = checkCatalogKey(
      key,
      store.products.map((item) => item.key),
    );
    if (keyRefusal) return no(keyRefusal);
    if (!data.name.trim()) return no("O nome é obrigatório.");
    if (!Number.isFinite(data.priceCents) || data.priceCents < 0) {
      return no("O preço precisa ser um valor válido.");
    }

    const priceCheck = checkProductPricing(data);
    if (!priceCheck.ok) return no(priceCheck.reason);

    const timestamp = offsetIso({});
    const product: Product = {
      ...data,
      key,
      id: nextId("prod"),
      organizationId: ORG_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    store.products.push(product);

    audit(actor, {
      action: "produto.criado",
      target: product.name,
      detail: `${PRODUCT_KIND_LABEL[product.kind]} por ${formatCurrencyCents(product.priceCents)}${RECURRENCE_SUFFIX[product.recurrence]}, teto de desconto ${product.maxDiscountPct}%.`,
    });

    return ok(product);
  },

  async updateProduct(actor, id, patch) {
    const product = store.products.find((item) => item.id === id);
    if (!product) return no("Produto não encontrado.");

    /**
     * A chave é imutável depois de criada, como habilidade e motivo de
     * encerramento. Ela viaja dentro de cada `ProposalItem` e de cada evento
     * publicado — renomeá-la renomearia metade do passado, e o relatório
     * passaria a mostrar duas linhas para a mesma oferta.
     */
    if (patch.key !== undefined && patch.key !== product.key) {
      return no("A chave do produto não muda depois de criada: ela já está gravada em propostas e eventos.");
    }

    const merged = { ...product, ...patch };
    const priceCheck = checkProductPricing(merged);
    if (!priceCheck.ok) return no(priceCheck.reason);

    Object.assign(product, patch, { key: product.key, updatedAt: offsetIso({}) });

    audit(actor, {
      action: "produto.editado",
      target: product.name,
      detail: describeProductPatch(patch),
    });

    return ok(product);
  },

  /**
   * Excluir é **desativar**, e a diferença importa.
   *
   * Sumir com o registro quebraria toda proposta que o cita: o item guarda uma
   * cópia do nome e do preço, mas o `productId` deixaria de resolver, e o
   * relatório por produto perderia as vendas já feitas. Inativo some da montagem
   * de proposta nova e da resposta da IA, que é o efeito que quem clica espera.
   */
  async deleteProduct(actor, id) {
    const product = store.products.find((item) => item.id === id);
    if (!product) return no("Produto não encontrado.");

    const used = store.proposals.some((proposal) =>
      proposal.items.some((item) => item.productId === id),
    );

    if (!used) {
      store.products = store.products.filter((item) => item.id !== id);
      audit(actor, {
        action: "produto.excluido",
        target: product.name,
        detail: "Excluído do catálogo. Nunca foi usado em proposta.",
        severity: "atencao",
      });
      return ok();
    }

    product.active = false;
    product.updatedAt = offsetIso({});

    audit(actor, {
      action: "produto.desativado",
      target: product.name,
      detail: "Já usado em proposta: foi desativado em vez de excluído, para não quebrar o histórico.",
      severity: "atencao",
    });

    return ok();
  },

  /* Aparência ---------------------------------------------------------------- */

  /**
   * Paleta e padrões visuais da organização.
   *
   * **A validação não é cerimônia.** `data-palette` com um valor que não existe
   * em `tokens.css` não produz erro nenhum: o navegador simplesmente não casa o
   * seletor, e a instalação inteira volta para a paleta padrão sem que nada
   * avise. O sintoma chega como "escolhi petróleo e continua índigo", que é
   * indistinguível de um defeito de gravação.
   *
   * A gravidade é `atencao`, não `informativo`: mudar a paleta muda a tela de
   * todo mundo da organização ao mesmo tempo, e quem abrir um chamado dizendo
   * "o sistema está diferente hoje" precisa que a auditoria responda em uma
   * linha.
   */
  async updateAppearance(actor, patch) {
    const current = store.appearance;
    const next = { ...current };
    const changes: string[] = [];

    if (patch.palette !== undefined) {
      if (!isPaletteKey(patch.palette)) return no("Paleta desconhecida.");
      if (patch.palette !== current.palette) {
        const label = PALETTE_CATALOG.find((item) => item.key === patch.palette)?.label;
        changes.push(`paleta para ${label ?? patch.palette}`);
      }
      next.palette = patch.palette;
    }

    if (patch.defaultMode !== undefined) {
      if (!isAppearanceMode(patch.defaultMode)) return no("Modo de exibição desconhecido.");
      if (patch.defaultMode !== current.defaultMode) {
        changes.push(`modo padrão para ${MODE_LABEL[patch.defaultMode].toLowerCase()}`);
      }
      next.defaultMode = patch.defaultMode;
    }

    if (patch.defaultDensity !== undefined) {
      if (!isDensityKey(patch.defaultDensity)) return no("Densidade desconhecida.");
      if (patch.defaultDensity !== current.defaultDensity) {
        changes.push(`densidade padrão para ${DENSITY_LABEL[patch.defaultDensity].toLowerCase()}`);
      }
      next.defaultDensity = patch.defaultDensity;
    }

    if (patch.allowPersonalOverride !== undefined) {
      const allow = patch.allowPersonalOverride === true;
      if (allow !== current.allowPersonalOverride) {
        changes.push(
          allow
            ? "escolha individual de tema liberada"
            : "escolha individual de tema bloqueada para toda a organização",
        );
      }
      next.allowPersonalOverride = allow;
    }

    if (changes.length === 0) return ok(current);

    store.appearance = next;

    audit(actor, {
      action: "aparencia.alterada",
      target: "Aparência da organização",
      detail: `Alterado: ${changes.join("; ")}.`,
      severity: "atencao",
    });

    return ok(next);
  },
};

const BUILT_IN_ROLES = new Set<string>([
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

/**
 * Coerência entre preço, desconto e forma de pagamento.
 *
 * As três recusas foram escolhidas pelo dano silencioso, não por rigor:
 *
 * - teto acima de 100% permitiria proposta com valor negativo, que o link de
 *   pagamento aceitaria e a conciliação nunca fecharia;
 * - modo `link` sem endereço só falharia no instante do aceite do cliente — o
 *   pior momento possível para descobrir, com a pessoa esperando;
 * - endereço que não é http(s) vira `href` de um botão que o cliente clica, e
 *   `javascript:` ali executa no nosso domínio.
 */
function checkProductPricing(product: {
  maxDiscountPct: number;
  checkout: { mode: string; baseUrl?: string };
}): { ok: true } | { ok: false; reason: string } {
  if (product.maxDiscountPct < 0 || product.maxDiscountPct > 100) {
    return { ok: false, reason: "O teto de desconto precisa ficar entre 0% e 100%." };
  }

  if (product.checkout.mode === "link") {
    if (!product.checkout.baseUrl?.trim()) {
      return {
        ok: false,
        reason: "No modo de link próprio, o endereço de pagamento é obrigatório.",
      };
    }
    const url = validateCheckoutBaseUrl(product.checkout.baseUrl);
    if (!url.ok) return { ok: false, reason: url.reason ?? "Endereço de pagamento inválido." };
  }

  return { ok: true };
}

function describeProductPatch(patch: Partial<Product>): string {
  const parts: string[] = [];
  if (patch.name !== undefined) parts.push(`nome para "${patch.name}"`);
  if (patch.priceCents !== undefined) parts.push(`preço para ${formatCurrencyCents(patch.priceCents)}`);
  if (patch.maxDiscountPct !== undefined) parts.push(`teto de desconto para ${patch.maxDiscountPct}%`);
  if (patch.recurrence !== undefined) parts.push(`recorrência para ${patch.recurrence}`);
  if (patch.checkout !== undefined) parts.push("forma de pagamento");
  if (patch.active !== undefined) parts.push(patch.active ? "reativado" : "desativado");
  return parts.length ? `Alterado: ${parts.join("; ")}.` : "Alteração de conteúdo.";
}

/** Identificadores usados pelas leituras do repositório em memória. */
export type { Id };
