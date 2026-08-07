"use client";

import { useState } from "react";
import type {
  AccessPolicy,
  CustomRole,
  Invitation,
  PermissionLevel,
  PermissionRow,
  Queue,
  RoleKey,
  Team,
  User,
} from "@crm/core";
import {
  INVITATION_STATUS_LABEL,
  PERMISSION_LABEL,
  ROLE_LABEL,
  canDeleteCustomRole,
  formatRelative,
} from "@crm/core";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Input,
  Label,
  Reveal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@crm/ui";
import { Info, Plus, ShieldAlert } from "lucide-react";

import { ConfirmDelete, EditorShell, Field, RowActions } from "./admin-editors";

/**
 * Perfis customizados, política de acesso e convites.
 *
 * ## O aviso no topo da política não é modéstia
 *
 * Sessão, segundo fator e bloqueio por tentativa dependem de um servidor de
 * autenticação que ainda não existe. A tela grava os valores — que é o que a
 * operação precisa decidir antes de o back-end entrar — e diz, em voz alta,
 * quais estão aplicados e quais não. Um painel de segurança que parece proteger
 * e não protege é pior que a ausência dele: ele encerra a conversa sobre o
 * assunto.
 */

interface MutationInput {
  entity: string;
  action: "criar" | "editar" | "excluir";
  id?: string;
  data?: Record<string, unknown>;
}

type Submit = (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;

const LEVELS: PermissionLevel[] = ["nenhum", "ver", "editar", "publicar", "administrar"];

const BASE_ROLES: RoleKey[] = [
  "gestor_atendimento",
  "atendente",
  "gestor_comercial",
  "marketing",
  "criador_automacoes",
  "analista_dados",
  "auditor_dpo",
];

export function AccessTab({
  customRoles,
  policy,
  invitations,
  permissions,
  queues,
  teams,
  users,
  onSubmit,
}: {
  customRoles: CustomRole[];
  policy: AccessPolicy;
  invitations: Invitation[];
  permissions: PermissionRow[];
  queues: Queue[];
  teams: Team[];
  users: User[];
  onSubmit: Submit;
}) {
  return (
    <Tabs defaultValue="perfis">
      <TabsList className="mb-3">
        <TabsTrigger value="perfis">Perfis personalizados</TabsTrigger>
        <TabsTrigger value="politica">Política de acesso</TabsTrigger>
        <TabsTrigger value="convites">Convites</TabsTrigger>
      </TabsList>

      <TabsContent value="perfis" className="m-0">
        <RolesPanel
          roles={customRoles}
          permissions={permissions}
          queues={queues}
          teams={teams}
          users={users}
          onSubmit={onSubmit}
        />
      </TabsContent>

      <TabsContent value="politica" className="m-0">
        <PolicyPanel policy={policy} onSubmit={onSubmit} />
      </TabsContent>

      <TabsContent value="convites" className="m-0">
        <InvitesPanel
          invitations={invitations}
          customRoles={customRoles}
          teams={teams}
          policy={policy}
          onSubmit={onSubmit}
        />
      </TabsContent>
    </Tabs>
  );
}

/* Perfis --------------------------------------------------------------------- */

function RolesPanel({
  roles,
  permissions,
  queues,
  teams,
  users,
  onSubmit,
}: {
  roles: CustomRole[];
  permissions: PermissionRow[];
  queues: Queue[];
  teams: Team[];
  users: User[];
  onSubmit: Submit;
}) {
  const [editing, setEditing] = useState<CustomRole | "novo" | null>(null);
  const [deleting, setDeleting] = useState<CustomRole | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-prose text-xs leading-relaxed">
          O perfil personalizado parte de um embutido e guarda só a diferença — assim ele não
          congela no dia em que foi criado, e recurso novo do produto aparece nele sozinho. O
          alcance por fila e time responde a outra pergunta: não <em>o que</em> pode fazer, mas{" "}
          <em>sobre quais dados</em>.
        </p>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditing("novo")}>
          <Plus />
          Novo perfil
        </Button>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {roles.map((role, index) => {
          const holders = users.filter((user) => (user.role as string) === role.key).length;

          return (
            <Reveal key={role.id} index={Math.min(index, 6)} as="li">
              <div className="bg-card shadow-card h-full space-y-3 rounded-lg p-5">
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1">
                    <RowActions
                      editLabel={`Editar ${role.label}`}
                      deleteLabel={`Excluir ${role.label}`}
                      deleteDisabledReason={canDeleteCustomRole(role, users)}
                      onEdit={() => setEditing(role)}
                      onDelete={() => setDeleting(role)}
                    />
                    <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                      {role.label}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {role.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">parte de {ROLE_LABEL[role.basedOn]}</Badge>
                  {!role.active ? <Badge variant="neutral">inativo</Badge> : null}
                  <span className="text-muted-foreground text-[11px]">{holders} pessoa(s)</span>
                </div>

                {Object.keys(role.overrides).length > 0 ? (
                  <ul className="space-y-0.5">
                    {Object.entries(role.overrides).map(([resource, level]) => (
                      <li key={resource} className="text-xs">
                        <span className="text-muted-foreground">
                          {permissions.find((row) => row.resource === resource)?.label ?? resource}
                        </span>{" "}
                        → <span className="font-medium">{PERMISSION_LABEL[level]}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Sem ajustes de permissão — herda tudo do perfil de origem.
                  </p>
                )}

                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {role.queueIds.length === 0
                    ? "Alcança todas as filas."
                    : `Restrito a: ${role.queueIds
                        .map((id) => queues.find((queue) => queue.id === id)?.name ?? id)
                        .join(", ")}.`}
                  {role.teamIds.length > 0
                    ? ` Dados de ${role.teamIds
                        .map((id) => teams.find((team) => team.id === id)?.name ?? id)
                        .join(", ")}.`
                    : ""}
                </p>
              </div>
            </Reveal>
          );
        })}
      </ul>

      {roles.length === 0 ? (
        <p className="text-muted-foreground bg-card shadow-card rounded-lg p-6 text-center text-xs">
          Nenhum perfil personalizado. Os nove perfis embutidos continuam valendo.
        </p>
      ) : null}

      {editing ? (
        <RoleDialog
          role={editing === "novo" ? undefined : editing}
          permissions={permissions}
          queues={queues}
          teams={teams}
          onOpenChange={(next) => !next && setEditing(null)}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir "${deleting.label}"?`}
          description="O perfil sai da lista de escolha."
          onConfirm={() => onSubmit({ entity: "perfil", action: "excluir", id: deleting.id })}
        />
      ) : null}
    </div>
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function RoleDialog({
  role,
  permissions,
  queues,
  teams,
  onOpenChange,
  onSubmit,
}: {
  role?: CustomRole;
  permissions: PermissionRow[];
  queues: Queue[];
  teams: Team[];
  onOpenChange: (open: boolean) => void;
  onSubmit: Submit;
}) {
  const [label, setLabel] = useState(role?.label ?? "");
  const [key, setKey] = useState(role?.key ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [basedOn, setBasedOn] = useState<RoleKey>(role?.basedOn ?? "atendente");
  const [overrides, setOverrides] = useState<Record<string, PermissionLevel>>(
    role?.overrides ?? {},
  );
  const [queueIds, setQueueIds] = useState<string[]>(role?.queueIds ?? []);
  const [teamIds, setTeamIds] = useState<string[]>(role?.teamIds ?? []);
  const [active, setActive] = useState(role?.active ?? true);

  return (
    <EditorShell
      open
      wide
      onOpenChange={onOpenChange}
      title={role ? "Editar perfil" : "Novo perfil"}
      description="Escolha um perfil de origem e ajuste só o que precisa ser diferente."
      onSave={() =>
        onSubmit({
          entity: "perfil",
          action: role ? "editar" : "criar",
          id: role?.id,
          data: {
            label,
            key: key || slugify(label),
            description,
            basedOn,
            overrides,
            queueIds,
            teamIds,
            active,
          },
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">
          <Input value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <Field label="Chave">
          <Input
            value={key || slugify(label)}
            disabled={Boolean(role)}
            onChange={(event) => setKey(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Descrição">
        <Textarea
          rows={2}
          value={description}
          placeholder="Quem usa este perfil e por quê."
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <Field label="Parte do perfil">
        <Select value={basedOn} onValueChange={(value) => setBasedOn(value as RoleKey)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BASE_ROLES.map((item) => (
              <SelectItem key={item} value={item}>
                {ROLE_LABEL[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Tudo que não for ajustado abaixo continua igual a este perfil — inclusive recursos que o
          produto ainda vai ganhar.
        </p>
      </Field>

      <Field label="Ajustes de permissão">
        <ul className="space-y-1">
          {permissions.map((row) => {
            const inherited = row.levels[basedOn] ?? "nenhum";
            const current = overrides[row.resource];

            return (
              <li key={row.resource} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs">{row.label}</span>
                <span className="text-muted-foreground w-24 shrink-0 text-right text-[11px]">
                  herda: {PERMISSION_LABEL[inherited]}
                </span>
                <Select
                  value={current ?? "__inherit__"}
                  onValueChange={(value) =>
                    setOverrides((currentMap) => {
                      const next = { ...currentMap };
                      if (value === "__inherit__") delete next[row.resource];
                      else next[row.resource] = value as PermissionLevel;
                      return next;
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__inherit__">Herdar</SelectItem>
                    {LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {PERMISSION_LABEL[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
      </Field>

      <Field label="Alcance por fila">
        <ul className="grid grid-cols-2 gap-1">
          {queues.map((queue) => (
            <li key={queue.id}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                <Checkbox
                  checked={queueIds.includes(queue.id)}
                  onCheckedChange={(checked) =>
                    setQueueIds((current) =>
                      checked === true
                        ? [...current, queue.id]
                        : current.filter((id) => id !== queue.id),
                    )
                  }
                />
                <span className="truncate">{queue.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Nenhuma marcada significa todas — é o comportamento dos perfis embutidos.
        </p>
      </Field>

      <Field label="Alcance por time">
        <ul className="grid grid-cols-2 gap-1">
          {teams.map((team) => (
            <li key={team.id}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                <Checkbox
                  checked={teamIds.includes(team.id)}
                  onCheckedChange={(checked) =>
                    setTeamIds((current) =>
                      checked === true
                        ? [...current, team.id]
                        : current.filter((id) => id !== team.id),
                    )
                  }
                />
                <span className="truncate">{team.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </Field>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium">Ativo</p>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>
    </EditorShell>
  );
}

/* Política ------------------------------------------------------------------- */

const TWO_FACTOR_ROLES: RoleKey[] = [
  "superadmin",
  "admin_empresa",
  "gestor_atendimento",
  "atendente",
  "gestor_comercial",
  "marketing",
  "analista_dados",
  "auditor_dpo",
];

function PolicyPanel({ policy, onSubmit }: { policy: AccessPolicy; onSubmit: Submit }) {
  const [idle, setIdle] = useState(String(policy.sessionIdleMinutes));
  const [maxDays, setMaxDays] = useState(String(policy.sessionMaxDays));
  const [twoFactor, setTwoFactor] = useState<RoleKey[]>(policy.requireTwoFactorFor);
  const [domains, setDomains] = useState(policy.allowedEmailDomains.join("\n"));
  const [ranges, setRanges] = useState(policy.allowedIpRanges.join("\n"));
  const [maxFailed, setMaxFailed] = useState(String(policy.maxFailedLogins));
  const [lockout, setLockout] = useState(String(policy.lockoutMinutes));
  const [justify, setJustify] = useState(policy.requireExportJustification);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setRefusal(null);
    const result = await onSubmit({
      entity: "acesso",
      action: "editar",
      data: {
        sessionIdleMinutes: Number(idle),
        sessionMaxDays: Number(maxDays),
        requireTwoFactorFor: twoFactor,
        allowedEmailDomains: domains
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        allowedIpRanges: ranges
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        maxFailedLogins: Number(maxFailed),
        lockoutMinutes: Number(lockout),
        requireExportJustification: justify,
      },
    });
    setBusy(false);
    if (!result.ok) setRefusal(result.reason ?? "A alteração foi recusada.");
  };

  return (
    <div className="space-y-3">
      {/**
       * O aviso vem antes dos campos, não depois.
       *
       * Depois, seria lido por quem já configurou tudo acreditando estar
       * protegido — e a leitura viraria decepção em vez de contexto.
       */}
      <Callout variant="info" icon={<Info />} title="O que já vale e o que ainda não">
        <p className="leading-relaxed">
          <strong>Aplicado hoje:</strong> os domínios de e-mail autorizados, conferidos a cada
          convite. <strong>Ainda não aplicado:</strong> sessão, segundo fator, bloqueio por
          tentativa e faixas de origem — todos dependem do servidor de autenticação, que é trabalho
          de back-end. Os valores ficam gravados e auditados; o que não existe é quem os faça valer.
        </p>
      </Callout>

      <div className="bg-card shadow-card space-y-4 rounded-lg p-5">
        <section className="space-y-3">
          <h3 className="font-display text-xs font-semibold tracking-tight">Sessão</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Encerrar após inatividade (min)">
              <Input
                type="number"
                min={5}
                value={idle}
                onChange={(event) => setIdle(event.target.value)}
              />
            </Field>
            <Field label="Validade máxima (dias)">
              <Input
                type="number"
                min={1}
                value={maxDays}
                onChange={(event) => setMaxDays(event.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-xs font-semibold tracking-tight">
            Segundo fator obrigatório
          </h3>
          <ul className="grid gap-1 sm:grid-cols-3">
            {TWO_FACTOR_ROLES.map((role) => (
              <li key={role}>
                <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                  <Checkbox
                    checked={twoFactor.includes(role)}
                    onCheckedChange={(checked) =>
                      setTwoFactor((current) =>
                        checked === true
                          ? [...current, role]
                          : current.filter((item) => item !== role),
                      )
                    }
                  />
                  <span className="truncate">{ROLE_LABEL[role]}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Domínios de e-mail autorizados (um por linha)">
            <Textarea
              rows={3}
              value={domains}
              placeholder="contabilidadefacilitada.com"
              onChange={(event) => setDomains(event.target.value)}
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Vazio aceita qualquer domínio. É o único controle desta tela conferido de verdade hoje
              — no convite.
            </p>
          </Field>

          <Field label="Faixas de origem em CIDR (uma por linha)">
            <Textarea
              rows={3}
              value={ranges}
              placeholder="200.150.10.0/24"
              onChange={(event) => setRanges(event.target.value)}
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Vazio aceita qualquer origem. Depende do back-end para valer.
            </p>
          </Field>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Tentativas antes de bloquear">
            <Input
              type="number"
              min={3}
              value={maxFailed}
              onChange={(event) => setMaxFailed(event.target.value)}
            />
          </Field>
          <Field label="Duração do bloqueio (min)">
            <Input
              type="number"
              min={1}
              value={lockout}
              onChange={(event) => setLockout(event.target.value)}
            />
          </Field>
        </section>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-xs font-medium">
              Exigir justificativa ao exportar dado pessoal
            </Label>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              A seção 18 exige registro de exportação. A justificativa é o que transforma o registro
              em resposta a uma auditoria.
            </p>
          </div>
          <Switch checked={justify} onCheckedChange={setJustify} />
        </div>

        {refusal ? (
          <Callout variant="danger" icon={<ShieldAlert />}>
            {refusal}
          </Callout>
        ) : null}

        <div className="flex justify-end">
          <Button size="sm" disabled={busy} onClick={save}>
            Salvar política
          </Button>
        </div>
      </div>
    </div>
  );
}

/* Convites ------------------------------------------------------------------- */

function InvitesPanel({
  invitations,
  customRoles,
  teams,
  policy,
  onSubmit,
}: {
  invitations: Invitation[];
  customRoles: CustomRole[];
  teams: Team[];
  policy: AccessPolicy;
  onSubmit: Submit;
}) {
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Invitation | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-prose text-xs leading-relaxed">
          Quem foi convidado ainda não é usuário — por isso o convite vive separado. Contá-lo como
          pessoa faria a regra que impede excluir o último administrador contar quem nunca entrou.
          {policy.allowedEmailDomains.length > 0
            ? ` Só são aceitos e-mails em: ${policy.allowedEmailDomains.join(", ")}.`
            : ""}
        </p>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCreating(true)}>
          <Plus />
          Convidar
        </Button>
      </div>

      <div className="bg-card shadow-card overflow-hidden rounded-lg">
        <ul>
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="[&+li]:shadow-inset-hairline flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{invitation.email}</span>
                  <Badge
                    variant={
                      invitation.status === "pendente"
                        ? "warning"
                        : invitation.status === "aceito"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {INVITATION_STATUS_LABEL[invitation.status]}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {ROLE_LABEL[invitation.role as RoleKey] ??
                    customRoles.find((role) => role.key === invitation.role)?.label ??
                    invitation.role}{" "}
                  · convidado por {invitation.invitedByLabel} {formatRelative(invitation.createdAt)}
                </p>
              </div>

              {invitation.status === "pendente" || invitation.status === "expirado" ? (
                <Button variant="ghost" size="xs" onClick={() => setRevoking(invitation)}>
                  Revogar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {invitations.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-xs">Nenhum convite.</p>
        ) : null}
      </div>

      {creating ? (
        <InviteDialog
          customRoles={customRoles}
          teams={teams}
          onOpenChange={setCreating}
          onSubmit={onSubmit}
        />
      ) : null}

      {revoking ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setRevoking(null)}
          title={`Revogar o convite de ${revoking.email}?`}
          description="O link deixa de funcionar."
          onConfirm={() => onSubmit({ entity: "convite", action: "excluir", id: revoking.id })}
        />
      ) : null}
    </div>
  );
}

function InviteDialog({
  customRoles,
  teams,
  onOpenChange,
  onSubmit,
}: {
  customRoles: CustomRole[];
  teams: Team[];
  onOpenChange: (open: boolean) => void;
  onSubmit: Submit;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("atendente");
  const [teamIds, setTeamIds] = useState<string[]>([]);

  return (
    <EditorShell
      open
      onOpenChange={onOpenChange}
      title="Convidar pessoa"
      description="O convite vale por sete dias. Nada é enviado por e-mail ainda — falta o back-end de mensageria."
      onSave={() =>
        onSubmit({ entity: "convite", action: "criar", data: { email, role, teamIds } })
      }
    >
      <Field label="E-mail">
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>

      <Field label="Perfil">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ROLE_LABEL) as RoleKey[]).map((item) => (
              <SelectItem key={item} value={item}>
                {ROLE_LABEL[item]}
              </SelectItem>
            ))}
            {customRoles
              .filter((item) => item.active)
              .map((item) => (
                <SelectItem key={item.id} value={item.key}>
                  {item.label} (personalizado)
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Times">
        <ul className="space-y-1">
          {teams.map((team) => (
            <li key={team.id}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                <Checkbox
                  checked={teamIds.includes(team.id)}
                  onCheckedChange={(checked) =>
                    setTeamIds((current) =>
                      checked === true
                        ? [...current, team.id]
                        : current.filter((id) => id !== team.id),
                    )
                  }
                />
                {team.name}
              </label>
            </li>
          ))}
        </ul>
      </Field>
    </EditorShell>
  );
}
