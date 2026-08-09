"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AccessPolicy,
  AuditEntry,
  BusinessSchedule,
  CannedResponse,
  ChannelAccount,
  ClosingReason,
  CustomFieldDefinition,
  CustomRole,
  FeatureFlag,
  Invitation,
  Organization,
  PermissionLevel,
  PermissionRow,
  Queue,
  RetentionPolicy,
  RoleKey,
  SkillDefinition,
  Tag,
  Team,
  User,
} from "@elora/core";
import {
  CHANNEL_LABEL,
  CURRENT_USER_ID,
  evaluateSchedule,
  now,
  summarizeDistribution,
  canDeleteQueue,
  canDeleteTeam,
  canDeleteUser,
  canEditPermission,
  canEditRetention,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelative,
  PERMISSION_LABEL,
  PRESENCE_LABEL,
  ROLE_LABEL,
} from "@elora/core";
import {
  Avatar,
  Badge,
  Button,
  Eyebrow,
  KeyValue,
  PresenceDot,
  ProgressBar,
  Reveal,
  RevealScope,
  SearchInput,
  StatusDot,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  cn,
} from "@elora/ui";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Library,
  UserCog,
  Plus,
  Database,
  KeyRound,
  PlugZap,
  Radio,
  ScrollText,
  ShieldCheck,
  ToggleLeft,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ChannelDialog,
  ConfirmDelete,
  QueueDialog,
  RowActions,
  TeamDialog,
  UserDialog,
  useAdminMutation,
} from "./admin-editors";
import { ChannelCatalog } from "./channel-catalog";
import { ConnectDialog, NewChannelDialog } from "./channel-connect";
import { SchedulesTab } from "./admin-schedules";
import { CatalogTab } from "./admin-catalog";
import { AccessTab } from "./admin-access";

import { ChannelIcon } from "@/lib/channel";

const ROLES_IN_MATRIX: RoleKey[] = [
  "admin_empresa",
  "gestor_atendimento",
  "atendente",
  "gestor_comercial",
  "marketing",
  "analista_dados",
  "auditor_dpo",
];

const PERMISSION_TONE: Record<string, string> = {
  nenhum: "text-muted-foreground/50",
  ver: "text-muted-foreground",
  editar: "text-info",
  publicar: "text-accent-ink",
  administrar: "text-primary font-semibold",
};

const AUDIT_TONE = {
  informativo: "neutral",
  atencao: "warning",
  critico: "danger",
} as const;

export interface AdminData {
  organization: Organization;
  users: User[];
  teams: Team[];
  queues: Queue[];
  channelAccounts: ChannelAccount[];
  permissions: PermissionRow[];
  audit: AuditEntry[];
  flags: FeatureFlag[];
  retention: RetentionPolicy[];
  schedules: BusinessSchedule[];
  skills: SkillDefinition[];
  closingReasons: ClosingReason[];
  customFields: CustomFieldDefinition[];
  tags: Tag[];
  cannedResponses: CannedResponse[];
  customRoles: CustomRole[];
  accessPolicy: AccessPolicy;
  invitations: Invitation[];
}

export function AdminConsole(data: AdminData) {
  const [auditSearch, setAuditSearch] = useState("");
  const router = useRouter();
  const { mutate } = useAdminMutation();

  /**
   * Um estado por diálogo, guardando o registro em edição.
   *
   * `null` fecha, objeto abre em edição, `"novo"` abre em criação. Guardar o
   * registro inteiro — e não só o identificador — é o que permite ao formulário
   * nascer preenchido sem uma segunda busca.
   */
  const [userDialog, setUserDialog] = useState<User | "novo" | null>(null);
  const [teamDialog, setTeamDialog] = useState<Team | "novo" | null>(null);
  const [queueDialog, setQueueDialog] = useState<Queue | "novo" | null>(null);
  const [channelDialog, setChannelDialog] = useState<ChannelAccount | null>(null);
  const [newChannel, setNewChannel] = useState(false);
  const [connecting, setConnecting] = useState<ChannelAccount | null>(null);

  /**
   * Quais segredos cada conta já tem — **por nome**, nunca por valor.
   *
   * Vem do servidor numa chamada só para todas as contas: a aba desenha a lista
   * inteira de uma vez, e uma requisição por conta transformaria oito contas em
   * oito idas ao servidor para responder a mesma pergunta.
   */
  const [secrets, setSecrets] = useState<Record<string, string[]>>({});

  const loadSecrets = useCallback(async () => {
    try {
      const response = await fetch("/api/canais/conexao", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { secrets: Record<string, string[]> };
        setSecrets(payload.secrets);
      }
    } catch {
      // Sem esta leitura a tela ainda funciona: mostra tudo como não gravado,
      // que é o padrão seguro — no máximo pede para preencher de novo.
    }
  }, []);

  useEffect(() => {
    void loadSecrets();
  }, [loadSecrets]);
  const [deleting, setDeleting] = useState<{
    entity: "usuario" | "time" | "fila" | "canal";
    id: string;
    name: string;
    consequence?: string;
  } | null>(null);

  const teamById = new Map(data.teams.map((team) => [team.id, team]));

  const filteredAudit = data.audit.filter((entry) => {
    if (!auditSearch.trim()) return true;
    const term = auditSearch.trim().toLowerCase();
    return [entry.actorLabel, entry.action, entry.target, entry.detail]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  /**
   * A flag agora grava de verdade.
   *
   * Antes isto virava estado local e um toast: a tela dizia "registrado na
   * auditoria" sem registrar nada. O texto estava certo sobre a intenção e
   * errado sobre o fato — que é exatamente o tipo de mentira que a interface não
   * deve contar.
   */
  async function toggleFlag(key: string) {
    const flag = data.flags.find((item) => item.key === key);
    if (!flag) return;

    const result = await mutate({
      entity: "flag",
      action: "editar",
      id: key,
      data: { enabled: !flag.enabled },
    });

    if (!result.ok) {
      toast.error("Não foi possível alterar", { description: result.reason });
      return;
    }

    toast.success(flag.enabled ? `"${flag.label}" desligada` : `"${flag.label}" ligada`, {
      description: "Registrado na auditoria com autor e horário.",
    });
  }

  async function setPermission(resource: string, role: RoleKey, level: PermissionLevel) {
    const result = await mutate({
      entity: "permissao",
      action: "editar",
      data: { resource, role, level },
    });

    if (!result.ok) toast.error("Permissão não alterada", { description: result.reason });
  }

  async function setRetention(category: string, patch: Record<string, unknown>) {
    const result = await mutate({
      entity: "retencao",
      action: "editar",
      id: category,
      data: patch,
    });
    if (!result.ok) toast.error("Retenção não alterada", { description: result.reason });
  }

  return (
    <RevealScope>
      <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
        <Tabs defaultValue="pessoas">
          <TabsList className="mb-5">
            <TabsTrigger value="pessoas">
              <Users className="size-3" />
              Pessoas e times
            </TabsTrigger>
            <TabsTrigger value="filas">
              <Building2 className="size-3" />
              Filas e distribuição
            </TabsTrigger>
            <TabsTrigger value="escalas">
              <CalendarClock className="size-3" />
              Escalas
            </TabsTrigger>
            <TabsTrigger value="canais">
              <Radio className="size-3" />
              Canais
            </TabsTrigger>
            <TabsTrigger value="catalogo">
              <Library className="size-3" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="permissoes">
              <KeyRound className="size-3" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="acesso">
              <UserCog className="size-3" />
              Perfis e acesso
            </TabsTrigger>
            <TabsTrigger value="auditoria">
              <ScrollText className="size-3" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="politicas">
              <ShieldCheck className="size-3" />
              Políticas
            </TabsTrigger>
          </TabsList>

          {/* Pessoas ------------------------------------------------------ */}
          <TabsContent value="pessoas" className="m-0 space-y-4">
            <Reveal index={0}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-sm font-semibold tracking-tight">
                      {data.organization.name}
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {data.organization.timezone} · {data.users.length} usuários ·{" "}
                      {data.teams.length} times
                    </p>
                  </div>
                  <Badge variant="primary">multiempresa habilitado</Badge>
                </div>
              </div>
            </Reveal>

            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <Reveal index={1}>
                <div className="bg-card shadow-card rounded-lg p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Eyebrow>Usuários</Eyebrow>
                    <Button variant="outline" size="xs" onClick={() => setUserDialog("novo")}>
                      <Plus />
                      Convidar
                    </Button>
                  </div>
                  <ul className="space-y-1">
                    {data.users.map((user) => (
                      <li
                        key={user.id}
                        className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
                      >
                        <span className="relative">
                          <Avatar initials={user.initials} hue={user.accentHue} size="sm" />
                          <PresenceDot
                            presence={user.presence}
                            className="ring-card absolute -bottom-0.5 -right-0.5"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{user.name}</span>
                          <span className="text-muted-foreground block truncate text-[11px]">
                            {user.email}
                          </span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-1 sm:flex">
                          {user.teamIds.map((teamId) => (
                            <Badge key={teamId} variant="neutral">
                              {teamById.get(teamId)?.name ?? teamId}
                            </Badge>
                          ))}
                        </span>
                        <Badge variant="primary" className="shrink-0">
                          {ROLE_LABEL[user.role]}
                        </Badge>
                        <Tooltip
                          content={`${PRESENCE_LABEL[user.presence]} · capacidade ${user.capacity}`}
                        >
                          <span className="text-muted-foreground w-10 shrink-0 text-right text-[11px] tabular-nums">
                            {user.capacity}
                          </span>
                        </Tooltip>
                        <RowActions
                          editLabel={`Editar ${user.name}`}
                          deleteLabel={`Excluir ${user.name}`}
                          deleteDisabledReason={canDeleteUser(
                            user,
                            data.users,
                            data.queues,
                            CURRENT_USER_ID,
                          )}
                          onEdit={() => setUserDialog(user)}
                          onDelete={() =>
                            setDeleting({
                              entity: "usuario",
                              id: user.id,
                              name: user.name,
                              consequence:
                                "As conversas atribuídas a esta pessoa ficam sem responsável e voltam para a fila.",
                            })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal index={2}>
                <div className="bg-card shadow-card rounded-lg p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Eyebrow>Times</Eyebrow>
                    <Button variant="outline" size="xs" onClick={() => setTeamDialog("novo")}>
                      <Plus />
                      Novo time
                    </Button>
                  </div>
                  <ul className="space-y-2.5">
                    {data.teams.map((team) => {
                      const members = data.users.filter((user) => user.teamIds.includes(team.id));
                      const available = members.filter(
                        (user) => user.presence === "disponivel",
                      ).length;
                      return (
                        <li key={team.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium">{team.name}</span>
                            <span className="flex items-center gap-1">
                              <span className="text-muted-foreground text-[11px] tabular-nums">
                                {available} de {members.length} disponíveis
                              </span>
                              <RowActions
                                editLabel={`Editar ${team.name}`}
                                deleteLabel={`Excluir ${team.name}`}
                                deleteDisabledReason={canDeleteTeam(team, data.queues, data.users)}
                                onEdit={() => setTeamDialog(team)}
                                onDelete={() =>
                                  setDeleting({ entity: "time", id: team.id, name: team.name })
                                }
                              />
                            </span>
                          </div>
                          <ProgressBar
                            value={members.length > 0 ? (available / members.length) * 100 : 0}
                            tone={
                              available === 0
                                ? "danger"
                                : available < members.length / 2
                                  ? "warning"
                                  : "success"
                            }
                            label={`Disponibilidade do time ${team.name}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Reveal>
            </div>
          </TabsContent>

          {/* Filas -------------------------------------------------------- */}
          <TabsContent value="filas" className="m-0 space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setQueueDialog("novo")}>
                <Plus />
                Nova fila
              </Button>
            </div>
            <ul className="grid gap-3 lg:grid-cols-2">
              {data.queues.map((queue, index) => {
                const queueSchedule = data.schedules.find((item) => item.id === queue.scheduleId);
                const scheduleState = queueSchedule
                  ? evaluateSchedule(queueSchedule, now().toISOString())
                  : undefined;

                return (
                  <Reveal key={queue.id} index={Math.min(index, 6)} as="li">
                    <div className="bg-card shadow-card h-full rounded-lg p-5">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-1 size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: `hsl(${queue.color} 65% 50%)` }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <RowActions
                            editLabel={`Editar ${queue.name}`}
                            deleteLabel={`Excluir ${queue.name}`}
                            deleteDisabledReason={canDeleteQueue(queue, data.channelAccounts)}
                            onEdit={() => setQueueDialog(queue)}
                            onDelete={() =>
                              setDeleting({
                                entity: "fila",
                                id: queue.id,
                                name: queue.name,
                                consequence:
                                  "As conversas que estavam nesta fila perdem o destino e precisam ser remanejadas à mão.",
                              })
                            }
                          />
                          <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                            {queue.name}
                          </h3>
                          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                            {queue.description}
                          </p>
                        </div>
                        <Badge variant="neutral">{teamById.get(queue.teamId)?.name}</Badge>
                      </div>

                      <dl className="mt-4">
                        {/**
                         * A distribuição vem antes do SLA de propósito.
                         *
                         * É a linha que responde "para quem isto cai?", que é a
                         * primeira pergunta de quem abre a lista de filas. O SLA
                         * responde "em quanto tempo", que só importa depois.
                         */}
                        <KeyValue label="Distribuição" value={summarizeDistribution(queue)} />
                        <KeyValue
                          label="Escala"
                          value={
                            queueSchedule
                              ? `${queueSchedule.name}${scheduleState?.open === false ? " — fechada agora" : ""}`
                              : "Sem escala — qualquer horário"
                          }
                        />
                        <KeyValue
                          label="SLA de primeira resposta"
                          value={formatDuration(queue.firstResponseSlaMinutes)}
                        />
                        <KeyValue
                          label="SLA de resolução"
                          value={formatDuration(queue.resolutionSlaMinutes)}
                        />
                        <KeyValue
                          label="Canais"
                          value={
                            <span className="inline-flex items-center gap-1">
                              {queue.channels.map((channel) => (
                                <ChannelIcon key={channel} kind={channel} withBackground />
                              ))}
                            </span>
                          }
                        />
                      </dl>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </TabsContent>

          {/* Escalas ------------------------------------------------------ */}
          <TabsContent value="escalas" className="m-0">
            <SchedulesTab
              schedules={data.schedules}
              queues={data.queues}
              users={data.users}
              onSubmit={mutate}
            />
          </TabsContent>

          {/* Catálogo ----------------------------------------------------- */}
          <TabsContent value="catalogo" className="m-0">
            <CatalogTab
              skills={data.skills}
              closingReasons={data.closingReasons}
              customFields={data.customFields}
              tags={data.tags}
              cannedResponses={data.cannedResponses}
              queues={data.queues}
              users={data.users}
              onSubmit={mutate}
            />
          </TabsContent>

          {/* Perfis e acesso ---------------------------------------------- */}
          <TabsContent value="acesso" className="m-0">
            <AccessTab
              customRoles={data.customRoles}
              policy={data.accessPolicy}
              invitations={data.invitations}
              permissions={data.permissions}
              queues={data.queues}
              teams={data.teams}
              users={data.users}
              onSubmit={mutate}
            />
          </TabsContent>

          {/* Canais ------------------------------------------------------- */}
          <TabsContent value="canais" className="m-0">
            {/**
             * A conexão de WhatsApp tem página própria porque o processo é longo,
             * atravessa o painel da Meta e tem espera de dias no meio. Espremê-lo
             * aqui faria a etapa que trava — a verificação de negócio — passar
             * despercebida no meio da lista de contas já conectadas.
             */}
            <div className="bg-card shadow-card mb-3 flex flex-wrap items-center gap-3 rounded-lg p-4">
              <span
                className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg"
                aria-hidden
              >
                <PlugZap className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Conectar um número de WhatsApp</h3>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                  As seis etapas na ordem certa, o endereço do webhook para copiar e o teste que
                  prova que ele está de pé.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/administracao/whatsapp">
                  Abrir
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>

            <ChannelCatalog accounts={data.channelAccounts} />

            <div className="mb-2 mt-5 flex items-center justify-between">
              <Eyebrow>Contas conectadas</Eyebrow>
              <Button variant="outline" size="sm" onClick={() => setNewChannel(true)}>
                <Plus />
                Nova conta
              </Button>
            </div>
            <ul className="space-y-3">
              {data.channelAccounts.map((account, index) => {
                const usage =
                  account.dailyLimit && account.sentToday
                    ? (account.sentToday / account.dailyLimit) * 100
                    : null;

                return (
                  <Reveal key={account.id} index={Math.min(index, 6)} as="li">
                    <div className="bg-card shadow-card rounded-lg p-5">
                      <div className="flex flex-wrap items-start gap-4">
                        <ChannelIcon kind={account.kind} withBackground />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {account.kind === "webchat" ? null : (
                              <Button
                                variant={
                                  account.connection?.state === "nao_configurado" ||
                                  !account.connection
                                    ? "primary"
                                    : "outline"
                                }
                                size="xs"
                                onClick={() => setConnecting(account)}
                              >
                                <PlugZap />
                                {account.connection?.secretRef ? "Reconfigurar" : "Conectar"}
                              </Button>
                            )}
                            <RowActions
                              editLabel={`Editar ${account.label}`}
                              deleteLabel={`Excluir ${account.label}`}
                              deleteDisabledReason={
                                account.kind === "webchat"
                                  ? "Canal de webchat é criado e removido junto com o widget. Exclua o widget em Webchat."
                                  : null
                              }
                              onEdit={() => setChannelDialog(account)}
                              onDelete={() =>
                                setDeleting({
                                  entity: "canal",
                                  id: account.id,
                                  name: account.label,
                                  consequence:
                                    "As conversas em andamento neste canal deixam de receber e de enviar mensagem.",
                                })
                              }
                            />
                            <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                              {account.label}
                            </h3>
                            <Badge
                              variant={
                                account.status === "conectado"
                                  ? "success"
                                  : account.status === "degradado"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              <StatusDot
                                tone={
                                  account.status === "conectado"
                                    ? "success"
                                    : account.status === "degradado"
                                      ? "warning"
                                      : "danger"
                                }
                                pulse={account.status !== "conectado"}
                              />
                              {account.status}
                            </Badge>
                            {account.qualityRating ? (
                              <Tooltip content="Qualidade reportada pelo provedor. Frequência alta derruba este índice.">
                                <Badge
                                  variant={
                                    account.qualityRating === "alta"
                                      ? "success"
                                      : account.qualityRating === "media"
                                        ? "warning"
                                        : "danger"
                                  }
                                >
                                  qualidade {account.qualityRating}
                                </Badge>
                              </Tooltip>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                            {account.address} · {CHANNEL_LABEL[account.kind]}
                          </p>
                          {account.lastSyncAt ? (
                            <p className="text-muted-foreground mt-1 text-[11px]">
                              Última sincronização {formatRelative(account.lastSyncAt)}
                            </p>
                          ) : null}
                        </div>

                        {usage !== null ? (
                          <div className="w-52 shrink-0">
                            <div className="mb-1 flex items-baseline justify-between gap-2">
                              <span className="text-muted-foreground text-[11px]">
                                Uso do limite diário
                              </span>
                              <span className="text-[11px] font-medium tabular-nums">
                                {formatPercent(usage)}
                              </span>
                            </div>
                            <ProgressBar
                              value={usage}
                              tone={usage > 70 ? "warning" : "success"}
                              label="Uso do limite diário"
                            />
                            <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
                              {formatNumber(account.sentToday ?? 0)} de{" "}
                              {formatNumber(account.dailyLimit ?? 0)} hoje
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {account.status === "degradado" ? (
                        <p className="bg-warning-soft text-foreground mt-3 rounded-md px-3 py-2 text-[11px] leading-relaxed">
                          Este número está em qualidade média. Reduza a frequência de campanhas
                          antes que o provedor limite o envio — a reputação é um ativo do negócio.
                        </p>
                      ) : null}
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </TabsContent>

          {/* Permissões --------------------------------------------------- */}
          <TabsContent value="permissoes" className="m-0">
            <Reveal index={0}>
              <div className="bg-card shadow-card overflow-x-auto rounded-lg p-5">
                <p className="text-muted-foreground mb-4 max-w-3xl text-xs leading-relaxed">
                  Além do perfil, o sistema aceita permissão granular por recurso e escopo. A
                  verificação acontece no servidor: o que a interface esconde, a API também recusa.
                </p>

                <table className="w-full min-w-[52rem] text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-left text-[11px]">
                      <th className="pb-2 font-medium">Recurso</th>
                      {ROLES_IN_MATRIX.map((role) => (
                        <th key={role} className="pb-2 text-center font-medium">
                          {ROLE_LABEL[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.permissions.map((row) => (
                      <tr key={row.resource} className="shadow-inset-hairline">
                        <td className="max-w-64 py-2.5 pr-4">
                          <span className="block font-medium">{row.label}</span>
                          <span className="text-muted-foreground block text-[11px]">
                            {row.description}
                          </span>
                        </td>
                        {ROLES_IN_MATRIX.map((role) => {
                          const level = row.levels[role] ?? "nenhum";
                          return (
                            <td key={role} className="py-2.5 text-center">
                              {/**
                               * A célula é um select nativo, não um menu.
                               *
                               * São sete perfis por linha e sete níveis por
                               * célula: um componente rico multiplicaria por
                               * quarenta e nove uma árvore de portal, e a tabela
                               * inteira passaria a custar caro para desenhar. O
                               * select do sistema resolve, é acessível por
                               * teclado e não pesa.
                               */}
                              <select
                                value={level}
                                aria-label={`${row.label} para ${ROLE_LABEL[role]}`}
                                className={cn(
                                  "rounded bg-transparent text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]",
                                  PERMISSION_TONE[level],
                                )}
                                onChange={(event) =>
                                  void setPermission(
                                    row.resource,
                                    role,
                                    event.target.value as PermissionLevel,
                                  )
                                }
                              >
                                {(Object.keys(PERMISSION_LABEL) as PermissionLevel[]).map(
                                  (item) => (
                                    <option
                                      key={item}
                                      value={item}
                                      disabled={Boolean(canEditPermission(row, role, item))}
                                    >
                                      {item === "nenhum" ? "—" : PERMISSION_LABEL[item]}
                                    </option>
                                  ),
                                )}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </TabsContent>

          {/* Auditoria ---------------------------------------------------- */}
          <TabsContent value="auditoria" className="m-0 space-y-4">
            <Reveal index={0} className="flex flex-wrap items-center gap-3">
              <SearchInput
                value={auditSearch}
                onChange={(event) => setAuditSearch(event.target.value)}
                onClear={() => setAuditSearch("")}
                placeholder="Buscar por autor, ação ou alvo"
                className="w-80"
                aria-label="Buscar na auditoria"
              />
              <p className="text-muted-foreground text-[11px]">
                Log imutável. Exportações também são registradas.
              </p>
            </Reveal>

            <Reveal index={1}>
              <ul className="bg-card shadow-card rounded-lg">
                {filteredAudit.map((entry) => (
                  <li
                    key={entry.id}
                    className="shadow-inset-hairline flex items-start gap-3 p-4 last:shadow-none"
                  >
                    <span
                      className={cn(
                        "mt-1 size-2 shrink-0 rounded-full",
                        entry.severity === "critico"
                          ? "bg-destructive"
                          : entry.severity === "atencao"
                            ? "bg-warning"
                            : "bg-muted-foreground/40",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                          {entry.action}
                        </code>
                        <span className="text-xs font-medium">{entry.actorLabel}</span>
                        <Badge variant={AUDIT_TONE[entry.severity]}>{entry.category}</Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {entry.detail}
                      </p>
                      <p className="text-muted-foreground/80 mt-1 flex flex-wrap gap-x-3 text-[11px]">
                        <span>{formatDateTime(entry.occurredAt)}</span>
                        <span>alvo: {entry.target}</span>
                        {entry.ip ? <span>ip: {entry.ip}</span> : null}
                        {entry.correlationId ? (
                          <span className="font-mono">{entry.correlationId}</span>
                        ) : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </TabsContent>

          {/* Políticas ---------------------------------------------------- */}
          <TabsContent value="politicas" className="m-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Reveal index={0}>
                <div className="bg-card shadow-card rounded-lg p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ToggleLeft className="text-muted-foreground size-4" aria-hidden />
                    <h2 className="font-display text-sm font-semibold tracking-tight">
                      Feature flags
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {data.flags.map((flag) => (
                      <li key={flag.key} className="flex items-start gap-3">
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => toggleFlag(flag.key)}
                          className="mt-0.5"
                          aria-label={flag.label}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-xs font-medium">{flag.label}</span>
                            {flag.enabled && flag.rolloutPct < 100 ? (
                              <Badge variant="info">{formatPercent(flag.rolloutPct)}</Badge>
                            ) : null}
                          </span>
                          <span className="text-muted-foreground block text-[11px] leading-relaxed">
                            {flag.description}
                          </span>
                          <span className="text-muted-foreground/70 mt-0.5 block font-mono text-[10px]">
                            {flag.key} · {flag.owner}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal index={1}>
                <div className="bg-card shadow-card rounded-lg p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Database className="text-muted-foreground size-4" aria-hidden />
                    <h2 className="font-display text-sm font-semibold tracking-tight">
                      Retenção de dados
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {data.retention.map((policy) => (
                      <li
                        key={policy.category}
                        className="shadow-inset-hairline pb-3 last:pb-0 last:shadow-none"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium">{policy.category}</span>
                          <Badge
                            variant={
                              policy.action === "excluir"
                                ? "danger"
                                : policy.action === "anonimizar"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {policy.action}
                          </Badge>
                          {policy.legalHold ? <Badge variant="info">legal hold</Badge> : null}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                          {policy.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <label className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                            Reter por
                            <input
                              type="number"
                              min={1}
                              defaultValue={policy.retentionDays}
                              disabled={Boolean(canEditRetention(policy))}
                              aria-label={`Dias de retenção de ${policy.category}`}
                              className="border-input w-20 rounded-md border bg-transparent px-1.5 py-0.5 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] disabled:opacity-50"
                              onBlur={(event) => {
                                const days = Number(event.target.value);
                                if (days !== policy.retentionDays) {
                                  void setRetention(policy.category, { retentionDays: days });
                                }
                              }}
                            />
                            dias
                          </label>

                          {/**
                           * O bloqueio legal é o único campo que continua editável
                           * quando ele mesmo está ativo — é o interruptor que
                           * destrava os outros. Sem essa exceção, ativar o
                           * bloqueio seria irreversível pela tela.
                           */}
                          <label className="flex items-center gap-1.5 text-[11px]">
                            <Switch
                              checked={policy.legalHold}
                              aria-label={`Bloqueio legal de ${policy.category}`}
                              onCheckedChange={(checked) =>
                                void setRetention(policy.category, { legalHold: checked })
                              }
                            />
                            bloqueio legal
                          </label>
                        </div>
                        {canEditRetention(policy) ? (
                          <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                            {canEditRetention(policy)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>

            <Reveal index={2}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="text-success size-4" aria-hidden />
                  <h2 className="font-display text-sm font-semibold tracking-tight">
                    Privacidade por desenho
                  </h2>
                </div>
                <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
                  Antes de adicionar qualquer campo pessoal ao CRM, quatro perguntas precisam de
                  resposta escrita: por que ele é necessário, quem pode acessá-lo, por quanto tempo
                  será mantido e como o titular exerce seus direitos. Sem as quatro respostas, o
                  campo não entra.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Solicitações de titulares
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Relatório de incidentes
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    Contratos com operadores
                  </Button>
                </div>
                <p className="text-muted-foreground mt-2 text-[11px]">
                  Estes fluxos entram junto com a fundação de back-end, quando houver dado real a
                  proteger.
                </p>
              </div>
            </Reveal>
          </TabsContent>
        </Tabs>

        {/**
         * Os diálogos ficam fora das abas de propósito.
         *
         * Dentro, o Radix desmonta o conteúdo da aba inativa — e um diálogo aberto
         * sumiria se algo trocasse a aba embaixo dele. A `key` força o formulário a
         * nascer com os valores do registro escolhido, que é o único lugar deste
         * repositório onde remontar é o comportamento certo: o estado interno do
         * formulário **precisa** ser descartado ao trocar de registro.
         */}
        {userDialog ? (
          <UserDialog
            key={userDialog === "novo" ? "novo" : userDialog.id}
            open
            onOpenChange={(next) => !next && setUserDialog(null)}
            user={userDialog === "novo" ? undefined : userDialog}
            teams={data.teams}
            skills={data.skills}
            schedules={data.schedules}
            customRoles={data.customRoles}
            onSubmit={mutate}
          />
        ) : null}

        {teamDialog ? (
          <TeamDialog
            key={teamDialog === "novo" ? "novo" : teamDialog.id}
            open
            onOpenChange={(next) => !next && setTeamDialog(null)}
            team={teamDialog === "novo" ? undefined : teamDialog}
            onSubmit={mutate}
          />
        ) : null}

        {queueDialog ? (
          <QueueDialog
            key={queueDialog === "novo" ? "novo" : queueDialog.id}
            open
            onOpenChange={(next) => !next && setQueueDialog(null)}
            queue={queueDialog === "novo" ? undefined : queueDialog}
            teams={data.teams}
            queues={data.queues}
            users={data.users}
            skills={data.skills}
            schedules={data.schedules}
            onSubmit={mutate}
          />
        ) : null}

        {channelDialog ? (
          <ChannelDialog
            key={channelDialog.id}
            open
            onOpenChange={(next) => !next && setChannelDialog(null)}
            channel={channelDialog}
            queues={data.queues}
            onSubmit={mutate}
          />
        ) : null}

        {newChannel ? (
          <NewChannelDialog
            open
            onOpenChange={setNewChannel}
            queues={data.queues}
            onSubmit={(input) => mutate(input)}
          />
        ) : null}

        {connecting ? (
          <ConnectDialog
            key={connecting.id}
            open
            onOpenChange={(next) => !next && setConnecting(null)}
            account={connecting}
            presentSecrets={secrets[connecting.id] ?? []}
            onDone={() => {
              void loadSecrets();
              router.refresh();
            }}
          />
        ) : null}

        {deleting ? (
          <ConfirmDelete
            open
            onOpenChange={(next) => !next && setDeleting(null)}
            title={`Excluir ${deleting.name}?`}
            description="A exclusão é registrada na auditoria com autor e horário."
            consequence={deleting.consequence}
            onConfirm={() =>
              mutate({ entity: deleting.entity, action: "excluir", id: deleting.id })
            }
          />
        ) : null}
      </div>
    </RevealScope>
  );
}
