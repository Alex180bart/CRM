/**
 * Mutações administrativas.
 *
 * Uma rota para todas as entidades, e não uma por entidade, porque o que muda
 * entre elas é só o corpo: a autenticação, o ator da auditoria e o formato do
 * erro são idênticos. Oito rotas repetindo isso seriam oito lugares para
 * esquecer o registro de auditoria.
 *
 * A rota é **fina de propósito**. Ela não decide se a alteração pode acontecer —
 * quem decide é o repositório, com as regras de `utils/admin-rules.ts`. Aqui só
 * se confere que o corpo tem a forma esperada e se traduz a recusa em HTTP.
 *
 * ## O ator ainda não é real
 *
 * Sem autenticação, o ator da auditoria é o usuário fixo do protótipo. É a mesma
 * lacuna do freio de uso do AI Gateway, e some junto: quando a sessão existir,
 * este é o único ponto que muda, e o registro passa a dizer quem de fato mexeu.
 * **Não confie neste campo para nada além de demonstração.**
 */

import type {
  AdminActor,
  AdminWriteResult,
  ChannelKind,
  CheckoutMode,
  CustomFieldEntity,
  CustomFieldType,
  ProductCheckout,
  ProductRecurrence,
  DistributionModel,
  DistributionTiebreak,
  PermissionLevel,
  QueueDelivery,
  QueueDistribution,
  RoleKey,
  ScheduleDay,
  ScheduleException,
  TimeRange,
} from "@elora/core";
import { CURRENT_USER_ID, DEFAULT_DISTRIBUTION, repositories } from "@elora/core";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400): Response {
  return Response.json({ ok: false, reason: message }, { status });
}

/** Recusa de regra de negócio é 409, não 400: o corpo estava certo. */
function respond(result: AdminWriteResult): Response {
  return Response.json(result, { status: result.ok ? 200 : 409 });
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function ids(value: unknown, max = 20): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string").slice(0, max);
}

/**
 * A distribuição chega inteira ou não chega.
 *
 * Aceitá-la em pedaços — só o modelo, só o tempo de aceite — obrigaria esta rota
 * a mesclar com o valor atual, e mesclar aqui significaria ler o registro antes
 * de gravar: exatamente a decisão de negócio que a rota não deve tomar. O
 * formulário já tem o objeto completo em mãos; mandar tudo é mais barato e não
 * abre a porta para uma combinação que nenhuma tela produziria.
 */
function distribution(value: unknown): QueueDistribution | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;

  return {
    model: (text(raw.model, 20) || DEFAULT_DISTRIBUTION.model) as DistributionModel,
    tiebreak: (text(raw.tiebreak, 20) || DEFAULT_DISTRIBUTION.tiebreak) as DistributionTiebreak,
    delivery: (text(raw.delivery, 10) || DEFAULT_DISTRIBUTION.delivery) as QueueDelivery,
    offerTimeoutSeconds:
      integer(raw.offerTimeoutSeconds) ?? DEFAULT_DISTRIBUTION.offerTimeoutSeconds,
    maxOffers: integer(raw.maxOffers) ?? DEFAULT_DISTRIBUTION.maxOffers,
    respectCapacity: raw.respectCapacity !== false,
    requireAvailable: raw.requireAvailable !== false,
    requiredSkills: ids(raw.requiredSkills, 10) ?? [],
    overflowQueueId: text(raw.overflowQueueId, 64) || undefined,
    pauseOutsideSchedule: raw.pauseOutsideSchedule !== false,
  };
}

function ranges(value: unknown): TimeRange[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({ from: text(item.from, 5), to: text(item.to, 5) }))
    .filter((range) => range.from && range.to)
    .slice(0, 6);
}

function scheduleDays(value: unknown): ScheduleDay[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({ weekday: integer(item.weekday) ?? 0, ranges: ranges(item.ranges) }))
    .slice(0, 7);
}

function scheduleExceptions(value: unknown): ScheduleException[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      date: text(item.date, 10),
      label: text(item.label, 80),
      ranges: ranges(item.ranges),
    }))
    .slice(0, 60);
}

function strings(value: unknown, max = 30, length = 120): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Forma de pagamento do produto.
 *
 * O endereço chega como texto e é recortado, mas **não é validado aqui**: quem
 * confere protocolo e formato é `validateCheckoutBaseUrl`, no repositório, com a
 * mesma função que monta o link no envio. Uma segunda validação nesta camada
 * seria a cópia que envelhece — e é justamente a checagem que impede um
 * `javascript:` de virar o `href` de um botão que o cliente clica.
 */
function checkout(value: unknown): ProductCheckout {
  const raw = (value ?? {}) as Record<string, unknown>;
  const mode: CheckoutMode = raw.mode === "integrado" ? "integrado" : "link";
  return {
    mode,
    baseUrl: mode === "link" ? text(raw.baseUrl, 500) : undefined,
    providerKey: mode === "integrado" ? text(raw.providerKey, 40) || undefined : undefined,
  };
}

/** Mapa recurso → nível, para o `overrides` do perfil customizado. */
function levels(value: unknown): Record<string, PermissionLevel> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, PermissionLevel> = {};
  for (const [key, level] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    if (typeof level === "string") result[key.slice(0, 64)] = level as PermissionLevel;
  }
  return result;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Corpo da requisição não é JSON válido.");
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const entity = text(record.entity, 32);
  const action = text(record.action, 16);
  const id = text(record.id, 64);
  const data = (record.data ?? {}) as Record<string, unknown>;

  const users = await repositories.directory.listUsers();
  const me = users.find((user) => user.id === CURRENT_USER_ID);

  const actor: AdminActor = {
    id: CURRENT_USER_ID,
    label: me?.name ?? "Administrador",
  };

  const admin = repositories.admin;

  try {
    switch (`${entity}.${action}`) {
      /* Pessoas ------------------------------------------------------------ */

      case "usuario.criar":
        return respond(
          await admin.createUser(actor, {
            name: text(data.name, 120),
            email: text(data.email, 160),
            initials: text(data.initials, 2),
            role: text(data.role, 32) as RoleKey,
            teamIds: ids(data.teamIds) ?? [],
            presence: "offline",
            capacity: integer(data.capacity) ?? 5,
            skills: ids(data.skills, 12) ?? [],
            // Quem acabou de ser cadastrado aceita conversa; a pausa é uma
            // decisão do dia a dia, não um estado inicial.
            acceptingNew: data.acceptingNew !== false,
            scheduleId: text(data.scheduleId, 64) || undefined,
            // A matiz do avatar é derivada, não escolhida: pedir cor no
            // formulário de convite é atrito sem retorno.
            accentHue: Math.floor(Math.random() * 360),
          }),
        );

      case "usuario.editar": {
        const patch: Record<string, unknown> = {};
        if (data.name !== undefined) patch.name = text(data.name, 120);
        if (data.email !== undefined) patch.email = text(data.email, 160);
        if (data.role !== undefined) patch.role = text(data.role, 32);
        if (data.capacity !== undefined) patch.capacity = integer(data.capacity);
        if (data.presence !== undefined) patch.presence = text(data.presence, 16);
        if (data.teamIds !== undefined) patch.teamIds = ids(data.teamIds) ?? [];
        if (data.skills !== undefined) patch.skills = ids(data.skills, 12) ?? [];
        if (data.acceptingNew !== undefined) patch.acceptingNew = data.acceptingNew === true;
        if (data.scheduleId !== undefined)
          patch.scheduleId = text(data.scheduleId, 64) || undefined;
        return respond(await admin.updateUser(actor, id, patch));
      }

      case "usuario.excluir":
        return respond(await admin.deleteUser(actor, id));

      /* Times -------------------------------------------------------------- */

      case "time.criar":
        return respond(await admin.createTeam(actor, text(data.name, 80)));
      case "time.editar":
        return respond(await admin.updateTeam(actor, id, text(data.name, 80)));
      case "time.excluir":
        return respond(await admin.deleteTeam(actor, id));

      /* Filas -------------------------------------------------------------- */

      case "fila.criar":
        return respond(
          await admin.createQueue(actor, {
            name: text(data.name, 80),
            description: text(data.description, 300),
            channels: (ids(data.channels) ?? []) as ChannelKind[],
            teamId: text(data.teamId, 64),
            firstResponseSlaMinutes: integer(data.firstResponseSlaMinutes) ?? 15,
            resolutionSlaMinutes: integer(data.resolutionSlaMinutes) ?? 480,
            color: text(data.color, 8) || "218",
            /**
             * Fila nova nasce **manual**, e não em roleta.
             *
             * Distribuir automaticamente uma fila recém-criada, antes de alguém
             * ter colocado gente nela, manda conversa para o vazio. Quem quer
             * rodízio liga depois, com o time montado.
             */
            distribution: distribution(data.distribution) ?? DEFAULT_DISTRIBUTION,
            scheduleId: text(data.scheduleId, 64) || undefined,
          }),
        );

      case "fila.editar": {
        const patch: Record<string, unknown> = {};
        if (data.name !== undefined) patch.name = text(data.name, 80);
        if (data.description !== undefined) patch.description = text(data.description, 300);
        if (data.teamId !== undefined) patch.teamId = text(data.teamId, 64);
        if (data.channels !== undefined) patch.channels = ids(data.channels) ?? [];
        if (data.firstResponseSlaMinutes !== undefined) {
          patch.firstResponseSlaMinutes = integer(data.firstResponseSlaMinutes);
        }
        if (data.resolutionSlaMinutes !== undefined) {
          patch.resolutionSlaMinutes = integer(data.resolutionSlaMinutes);
        }
        if (data.distribution !== undefined) patch.distribution = distribution(data.distribution);
        if (data.scheduleId !== undefined)
          patch.scheduleId = text(data.scheduleId, 64) || undefined;
        return respond(await admin.updateQueue(actor, id, patch));
      }

      case "fila.excluir":
        return respond(await admin.deleteQueue(actor, id));

      /* Canais ------------------------------------------------------------- */

      case "canal.criar":
        return respond(
          await admin.createChannel(actor, {
            kind: text(data.kind, 16) as ChannelKind,
            label: text(data.label, 120),
            address: text(data.address, 200),
            queueId: text(data.queueId, 64),
          }),
        );

      case "canal.editar": {
        const patch: Record<string, unknown> = {};
        if (data.label !== undefined) patch.label = text(data.label, 120);
        if (data.queueId !== undefined) patch.queueId = text(data.queueId, 64);
        if (data.status !== undefined) patch.status = text(data.status, 16);
        if (data.dailyLimit !== undefined) patch.dailyLimit = integer(data.dailyLimit);
        return respond(await admin.updateChannel(actor, id, patch));
      }

      case "canal.excluir":
        return respond(await admin.deleteChannel(actor, id));

      /* Permissões --------------------------------------------------------- */

      case "permissao.editar":
        return respond(
          await admin.setPermission(
            actor,
            text(data.resource, 64),
            text(data.role, 32) as RoleKey,
            text(data.level, 16) as PermissionLevel,
          ),
        );

      /* Flags e retenção --------------------------------------------------- */

      case "flag.editar": {
        const patch: Record<string, unknown> = {};
        if (data.enabled !== undefined) patch.enabled = data.enabled === true;
        if (data.rolloutPct !== undefined) patch.rolloutPct = integer(data.rolloutPct);
        return respond(await admin.updateFlag(actor, id, patch));
      }

      case "retencao.editar": {
        const patch: Record<string, unknown> = {};
        if (data.retentionDays !== undefined) patch.retentionDays = integer(data.retentionDays);
        if (data.action !== undefined) patch.action = text(data.action, 16);
        if (data.legalHold !== undefined) patch.legalHold = data.legalHold === true;
        return respond(await admin.updateRetention(actor, id, patch));
      }

      /* Escalas ------------------------------------------------------------ */

      case "escala.criar":
        return respond(
          await admin.createSchedule(actor, {
            name: text(data.name, 80),
            description: text(data.description, 300),
            timezone: text(data.timezone, 64) || "America/Sao_Paulo",
            days: scheduleDays(data.days) ?? [],
            exceptions: scheduleExceptions(data.exceptions) ?? [],
            outsideMessage: text(data.outsideMessage, 500),
          }),
        );

      case "escala.editar": {
        const patch: Record<string, unknown> = {};
        if (data.name !== undefined) patch.name = text(data.name, 80);
        if (data.description !== undefined) patch.description = text(data.description, 300);
        if (data.timezone !== undefined) patch.timezone = text(data.timezone, 64);
        if (data.days !== undefined) patch.days = scheduleDays(data.days);
        if (data.exceptions !== undefined) patch.exceptions = scheduleExceptions(data.exceptions);
        if (data.outsideMessage !== undefined) {
          patch.outsideMessage = text(data.outsideMessage, 500);
        }
        return respond(await admin.updateSchedule(actor, id, patch));
      }

      case "escala.excluir":
        return respond(await admin.deleteSchedule(actor, id));

      /* Catálogo ----------------------------------------------------------- */

      case "habilidade.criar":
        return respond(
          await admin.createSkill(actor, {
            key: text(data.key, 40),
            label: text(data.label, 80),
            description: text(data.description, 300),
            hue: integer(data.hue) ?? 218,
            active: data.active !== false,
          }),
        );

      case "habilidade.editar": {
        const patch: Record<string, unknown> = {};
        if (data.label !== undefined) patch.label = text(data.label, 80);
        if (data.description !== undefined) patch.description = text(data.description, 300);
        if (data.hue !== undefined) patch.hue = integer(data.hue);
        if (data.active !== undefined) patch.active = data.active === true;
        return respond(await admin.updateSkill(actor, id, patch));
      }

      case "habilidade.excluir":
        return respond(await admin.deleteSkill(actor, id));

      case "motivo.criar":
        return respond(
          await admin.createClosingReason(actor, {
            key: text(data.key, 40),
            label: text(data.label, 80),
            description: text(data.description, 300),
            resolved: data.resolved === true,
            requiresNote: data.requiresNote === true,
            active: data.active !== false,
            order: integer(data.order) ?? 0,
          }),
        );

      case "motivo.editar": {
        const patch: Record<string, unknown> = {};
        if (data.label !== undefined) patch.label = text(data.label, 80);
        if (data.description !== undefined) patch.description = text(data.description, 300);
        if (data.resolved !== undefined) patch.resolved = data.resolved === true;
        if (data.requiresNote !== undefined) patch.requiresNote = data.requiresNote === true;
        if (data.active !== undefined) patch.active = data.active === true;
        if (data.order !== undefined) patch.order = integer(data.order);
        return respond(await admin.updateClosingReason(actor, id, patch));
      }

      case "motivo.excluir":
        return respond(await admin.deleteClosingReason(actor, id));

      case "campo.criar":
        return respond(
          await admin.createCustomField(actor, {
            key: text(data.key, 40),
            label: text(data.label, 80),
            description: text(data.description, 300),
            entity: text(data.entity, 16) as CustomFieldEntity,
            type: text(data.type, 16) as CustomFieldType,
            options: strings(data.options, 40, 80) ?? [],
            required: data.required === true,
            derived: data.derived === true,
            sensitive: data.sensitive === true,
            active: data.active !== false,
          }),
        );

      case "campo.editar": {
        const patch: Record<string, unknown> = {};
        if (data.label !== undefined) patch.label = text(data.label, 80);
        if (data.description !== undefined) patch.description = text(data.description, 300);
        if (data.entity !== undefined) patch.entity = text(data.entity, 16);
        if (data.type !== undefined) patch.type = text(data.type, 16);
        if (data.options !== undefined) patch.options = strings(data.options, 40, 80) ?? [];
        if (data.required !== undefined) patch.required = data.required === true;
        if (data.derived !== undefined) patch.derived = data.derived === true;
        if (data.sensitive !== undefined) patch.sensitive = data.sensitive === true;
        if (data.active !== undefined) patch.active = data.active === true;
        return respond(await admin.updateCustomField(actor, id, patch));
      }

      case "campo.excluir":
        return respond(await admin.deleteCustomField(actor, id));

      case "tag.criar":
        return respond(await admin.createTag(actor, text(data.name, 60), integer(data.hue) ?? 218));

      case "tag.editar": {
        const patch: Record<string, unknown> = {};
        if (data.name !== undefined) patch.name = text(data.name, 60);
        if (data.hue !== undefined) patch.hue = integer(data.hue);
        return respond(await admin.updateTag(actor, id, patch));
      }

      case "tag.excluir":
        return respond(await admin.deleteTag(actor, id));

      case "resposta.criar":
        return respond(
          await admin.createCannedResponse(actor, {
            shortcut: text(data.shortcut, 40),
            title: text(data.title, 120),
            body: text(data.body, 4_000),
            channels: (ids(data.channels) ?? []) as ChannelKind[],
          }),
        );

      case "resposta.editar": {
        const patch: Record<string, unknown> = {};
        if (data.shortcut !== undefined) patch.shortcut = text(data.shortcut, 40);
        if (data.title !== undefined) patch.title = text(data.title, 120);
        if (data.body !== undefined) patch.body = text(data.body, 4_000);
        if (data.channels !== undefined) patch.channels = ids(data.channels) ?? [];
        return respond(await admin.updateCannedResponse(actor, id, patch));
      }

      case "resposta.excluir":
        return respond(await admin.deleteCannedResponse(actor, id));

      /* Perfis e acesso ---------------------------------------------------- */

      case "perfil.criar":
        return respond(
          await admin.createCustomRole(actor, {
            key: text(data.key, 40),
            label: text(data.label, 80),
            description: text(data.description, 300),
            basedOn: text(data.basedOn, 32) as RoleKey,
            overrides: levels(data.overrides),
            queueIds: ids(data.queueIds, 40) ?? [],
            teamIds: ids(data.teamIds) ?? [],
            active: data.active !== false,
          }),
        );

      case "perfil.editar": {
        const patch: Record<string, unknown> = {};
        if (data.label !== undefined) patch.label = text(data.label, 80);
        if (data.description !== undefined) patch.description = text(data.description, 300);
        if (data.basedOn !== undefined) patch.basedOn = text(data.basedOn, 32);
        if (data.overrides !== undefined) patch.overrides = levels(data.overrides);
        if (data.queueIds !== undefined) patch.queueIds = ids(data.queueIds, 40) ?? [];
        if (data.teamIds !== undefined) patch.teamIds = ids(data.teamIds) ?? [];
        if (data.active !== undefined) patch.active = data.active === true;
        return respond(await admin.updateCustomRole(actor, id, patch));
      }

      case "perfil.excluir":
        return respond(await admin.deleteCustomRole(actor, id));

      case "acesso.editar": {
        const patch: Record<string, unknown> = {};
        if (data.sessionIdleMinutes !== undefined) {
          patch.sessionIdleMinutes = integer(data.sessionIdleMinutes);
        }
        if (data.sessionMaxDays !== undefined) patch.sessionMaxDays = integer(data.sessionMaxDays);
        if (data.requireTwoFactorFor !== undefined) {
          patch.requireTwoFactorFor = ids(data.requireTwoFactorFor, 12) ?? [];
        }
        if (data.allowedEmailDomains !== undefined) {
          patch.allowedEmailDomains = strings(data.allowedEmailDomains, 20, 253) ?? [];
        }
        if (data.allowedIpRanges !== undefined) {
          patch.allowedIpRanges = strings(data.allowedIpRanges, 20, 43) ?? [];
        }
        if (data.maxFailedLogins !== undefined)
          patch.maxFailedLogins = integer(data.maxFailedLogins);
        if (data.lockoutMinutes !== undefined) patch.lockoutMinutes = integer(data.lockoutMinutes);
        if (data.requireExportJustification !== undefined) {
          patch.requireExportJustification = data.requireExportJustification === true;
        }
        return respond(await admin.updateAccessPolicy(actor, patch));
      }

      case "convite.criar":
        return respond(
          await admin.createInvitation(actor, {
            email: text(data.email, 160),
            role: text(data.role, 40),
            teamIds: ids(data.teamIds) ?? [],
          }),
        );

      case "convite.excluir":
        return respond(await admin.revokeInvitation(actor, id));

      /* Catálogo comercial -------------------------------------------------- */

      case "produto.criar":
        return respond(
          await admin.createProduct(actor, {
            key: text(data.key, 40),
            name: text(data.name, 120),
            kind: data.kind === "produto" ? "produto" : "servico",
            summary: text(data.summary, 200),
            description: text(data.description, 4_000),
            priceCents: Math.max(0, integer(data.priceCents) ?? 0),
            recurrence: text(data.recurrence, 16) as ProductRecurrence,
            maxDiscountPct: Math.max(0, Math.min(100, integer(data.maxDiscountPct) ?? 0)),
            includes: strings(data.includes, 12, 120) ?? [],
            salesNotes: text(data.salesNotes, 2_000),
            checkout: checkout(data.checkout),
            active: data.active !== false,
          }),
        );

      case "produto.editar": {
        const patch: Record<string, unknown> = {};
        if (data.name !== undefined) patch.name = text(data.name, 120);
        if (data.kind !== undefined) patch.kind = data.kind === "produto" ? "produto" : "servico";
        if (data.summary !== undefined) patch.summary = text(data.summary, 200);
        if (data.description !== undefined) patch.description = text(data.description, 4_000);
        if (data.priceCents !== undefined) patch.priceCents = Math.max(0, integer(data.priceCents) ?? 0);
        if (data.recurrence !== undefined) patch.recurrence = text(data.recurrence, 16);
        if (data.maxDiscountPct !== undefined) {
          patch.maxDiscountPct = Math.max(0, Math.min(100, integer(data.maxDiscountPct) ?? 0));
        }
        if (data.includes !== undefined) patch.includes = strings(data.includes, 12, 120) ?? [];
        if (data.salesNotes !== undefined) patch.salesNotes = text(data.salesNotes, 2_000);
        if (data.checkout !== undefined) patch.checkout = checkout(data.checkout);
        if (data.active !== undefined) patch.active = data.active === true;
        return respond(await admin.updateProduct(actor, id, patch));
      }

      case "produto.excluir":
        return respond(await admin.deleteProduct(actor, id));

      /* Aparência ---------------------------------------------------------- */

      /**
       * A rota não confere se a paleta existe — só recorta a string. Quem
       * recusa valor desconhecido é o repositório, e é lá que a checagem tem de
       * viver: uma segunda validação aqui seria a cópia clássica que envelhece
       * sozinha na próxima paleta adicionada.
       */
      case "aparencia.editar": {
        const patch: Record<string, unknown> = {};
        if (data.palette !== undefined) patch.palette = text(data.palette, 24);
        if (data.defaultMode !== undefined) patch.defaultMode = text(data.defaultMode, 12);
        if (data.defaultDensity !== undefined) {
          patch.defaultDensity = text(data.defaultDensity, 12);
        }
        if (data.allowPersonalOverride !== undefined) {
          patch.allowPersonalOverride = data.allowPersonalOverride === true;
        }
        return respond(await admin.updateAppearance(actor, patch));
      }

      default:
        return fail(`Operação desconhecida: ${entity}.${action}`);
    }
  } catch (error) {
    console.error("[admin] falha não prevista", error);
    return fail("A alteração falhou de forma inesperada.", 500);
  }
}
