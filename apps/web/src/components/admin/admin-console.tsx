"use client";

import { useState } from "react";
import type {
  AuditEntry,
  ChannelAccount,
  FeatureFlag,
  Organization,
  PermissionRow,
  Queue,
  RetentionPolicy,
  RoleKey,
  Team,
  User,
} from "@crm/core";
import {
  CHANNEL_LABEL,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelative,
  PERMISSION_LABEL,
  PRESENCE_LABEL,
  ROLE_LABEL,
} from "@crm/core";
import {
  Avatar,
  Badge,
  Button,
  Eyebrow,
  KeyValue,
  ProgressBar,
  PresenceDot,
  Reveal,
  SearchInput,
  StatusDot,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  cn,
} from "@crm/ui";
import {
  Building2,
  Database,
  KeyRound,
  Radio,
  ScrollText,
  ShieldCheck,
  ToggleLeft,
  Users,
} from "lucide-react";
import { toast } from "sonner";

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
}

export function AdminConsole(data: AdminData) {
  const [auditSearch, setAuditSearch] = useState("");
  const [flags, setFlags] = useState(data.flags);

  const teamById = new Map(data.teams.map((team) => [team.id, team]));

  const filteredAudit = data.audit.filter((entry) => {
    if (!auditSearch.trim()) return true;
    const term = auditSearch.trim().toLowerCase();
    return [entry.actorLabel, entry.action, entry.target, entry.detail]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  function toggleFlag(key: string) {
    setFlags((current) =>
      current.map((flag) => (flag.key === key ? { ...flag, enabled: !flag.enabled } : flag)),
    );
    const flag = flags.find((item) => item.key === key);
    toast.success(flag?.enabled ? `"${flag.label}" desligada` : `"${flag?.label}" ligada`, {
      description: "A alteração é registrada na auditoria com autor e horário.",
    });
  }

  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
      <Tabs defaultValue="pessoas">
        <TabsList className="mb-5">
          <TabsTrigger value="pessoas">
            <Users className="size-3" />
            Pessoas e times
          </TabsTrigger>
          <TabsTrigger value="filas">
            <Building2 className="size-3" />
            Filas
          </TabsTrigger>
          <TabsTrigger value="canais">
            <Radio className="size-3" />
            Canais
          </TabsTrigger>
          <TabsTrigger value="permissoes">
            <KeyRound className="size-3" />
            Permissões
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
                <Eyebrow className="mb-3">Usuários</Eyebrow>
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
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal index={2}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <Eyebrow className="mb-3">Times</Eyebrow>
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
                          <span className="text-muted-foreground text-[11px] tabular-nums">
                            {available} de {members.length} disponíveis
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
        <TabsContent value="filas" className="m-0">
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.queues.map((queue, index) => (
              <Reveal key={queue.id} index={Math.min(index, 6)} as="li">
                <div className="bg-card shadow-card h-full rounded-lg p-5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: `hsl(${queue.color} 65% 50%)` }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
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
            ))}
          </ul>
        </TabsContent>

        {/* Canais ------------------------------------------------------- */}
        <TabsContent value="canais" className="m-0">
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
                        Este número está em qualidade média. Reduza a frequência de campanhas antes
                        que o provedor limite o envio — a reputação é um ativo do negócio.
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
                            <span className={cn("text-[11px]", PERMISSION_TONE[level])}>
                              {level === "nenhum" ? "—" : PERMISSION_LABEL[level]}
                            </span>
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
                  {flags.map((flag) => (
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
                      <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                        Retenção de {formatNumber(policy.retentionDays)} dias (
                        {Math.round(policy.retentionDays / 365)}{" "}
                        {Math.round(policy.retentionDays / 365) === 1 ? "ano" : "anos"})
                      </p>
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
                será mantido e como o titular exerce seus direitos. Sem as quatro respostas, o campo
                não entra.
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
    </div>
  );
}
