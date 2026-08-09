"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BusinessSchedule,
  ChannelAccount,
  ChannelKind,
  CustomRole,
  Queue,
  QueueDistribution,
  RoleKey,
  SkillDefinition,
  Team,
  User,
} from "@elora/core";
import {
  CHANNEL_LABEL,
  DEFAULT_DISTRIBUTION,
  ROLE_LABEL,
  summarizeBusinessSchedule,
} from "@elora/core";

import { DistributionEditor } from "./queue-distribution";
import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
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
  Tooltip,
  cn,
} from "@elora/ui";
import { CircleAlert, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Edição e exclusão na Administração.
 *
 * ## Por que a tela não guarda o estado
 *
 * A escrita vai para `/api/admin`, que grava no repositório, e a tela chama
 * `router.refresh()` — o Server Component busca de novo e redesenha. Nenhuma
 * cópia do dado vive aqui.
 *
 * A alternativa comum, atualizar um estado local otimista, criaria duas verdades
 * sobre o mesmo registro: a que a tela mostra e a que o servidor tem. Elas
 * divergem no primeiro caso em que a escrita é **recusada** — e recusa é comum
 * aqui de propósito, porque as regras existem justamente para impedir a
 * exclusão que trancaria alguém para fora.
 *
 * ## A recusa é conteúdo, não erro
 *
 * "Não é possível excluir" é uma parede. "2 canais entregam nesta fila: WhatsApp
 * Atendimento, atendimento@… — aponte-os para outra fila antes" é uma
 * instrução. Por isso o motivo vem do servidor escrito por extenso e aparece
 * dentro do diálogo, não como um toast que some em três segundos.
 */

interface MutationInput {
  entity: string;
  action: "criar" | "editar" | "excluir";
  id?: string;
  data?: Record<string, unknown>;
}

export function useAdminMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function mutate(input: MutationInput): Promise<{ ok: boolean; reason?: string }> {
    setBusy(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const result = (await response.json()) as { ok: boolean; reason?: string };

      if (result.ok) {
        // O refresh é o que traz o dado novo: a fonte continua sendo o servidor.
        startTransition(() => router.refresh());
      }

      return result;
    } catch {
      return { ok: false, reason: "Não foi possível falar com o servidor." };
    } finally {
      setBusy(false);
    }
  }

  return { mutate, busy: busy || pending };
}

/* Ações de linha ------------------------------------------------------------- */

export function RowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  deleteDisabledReason,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel: string;
  deleteLabel: string;
  /** Quando presente, a exclusão fica desabilitada e o motivo vira dica. */
  deleteDisabledReason?: string | null;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {onEdit ? (
        <Tooltip content={editLabel}>
          <Button variant="ghost" size="icon-xs" aria-label={editLabel} onClick={onEdit}>
            <Pencil />
          </Button>
        </Tooltip>
      ) : null}

      {onDelete ? (
        /**
         * O botão desabilitado continua explicando o porquê.
         *
         * Desabilitar sem dizer o motivo é a pior combinação: quem lê conclui
         * que o produto está quebrado. Com a dica, a mesma tela vira orientação.
         */
        <Tooltip content={deleteDisabledReason ?? deleteLabel}>
          <span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={deleteLabel}
              disabled={Boolean(deleteDisabledReason)}
              className="hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </span>
        </Tooltip>
      ) : null}
    </span>
  );
}

/* Confirmação de exclusão ---------------------------------------------------- */

export function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  consequence,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** O que a exclusão causa. Some quando não há consequência a anunciar. */
  consequence?: string;
  onConfirm: () => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRefusal(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(92vw,28rem)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          {consequence ? (
            <Callout variant="warning" icon={<CircleAlert />}>
              {consequence}
            </Callout>
          ) : null}

          {/**
           * A recusa aparece **aqui dentro**, e não como toast.
           *
           * O motivo costuma ter duas linhas e listar nomes — "aponte estes três
           * canais para outra fila antes". Num toast, some antes de a pessoa
           * terminar de ler, e ela clica de novo esperando outro resultado.
           */}
          {refusal ? (
            <Callout variant="danger" icon={<CircleAlert />} title="Não foi possível excluir">
              {refusal}
            </Callout>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setRefusal(null);
              const result = await onConfirm();
              setBusy(false);

              if (result.ok) {
                toast.success("Excluído", {
                  description: "A alteração ficou registrada na auditoria.",
                });
                onOpenChange(false);
                return;
              }
              setRefusal(result.reason ?? "A exclusão foi recusada.");
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Formulário genérico -------------------------------------------------------- */

export function EditorShell({
  open,
  onOpenChange,
  title,
  description,
  onSave,
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSave: () => Promise<{ ok: boolean; reason?: string }>;
  /** Formulário com abas ou prévia lado a lado precisa de mais largura. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRefusal(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className={cn("w-[min(92vw,32rem)]", wide && "w-[min(94vw,40rem)]")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {children}
          {refusal ? (
            <Callout variant="danger" icon={<CircleAlert />}>
              {refusal}
            </Callout>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setRefusal(null);
              const result = await onSave();
              setBusy(false);

              if (result.ok) {
                toast.success("Salvo", {
                  description: "A alteração ficou registrada na auditoria.",
                });
                onOpenChange(false);
                return;
              }
              setRefusal(result.reason ?? "A alteração foi recusada.");
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/* Usuário -------------------------------------------------------------------- */

export function UserDialog({
  open,
  onOpenChange,
  user,
  teams,
  skills,
  schedules,
  customRoles,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente cria; presente edita. */
  user?: User;
  teams: Team[];
  skills: SkillDefinition[];
  schedules: BusinessSchedule[];
  customRoles: CustomRole[];
  onSubmit: (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "atendente");
  const [capacity, setCapacity] = useState(String(user?.capacity ?? 5));
  const [teamIds, setTeamIds] = useState<string[]>(user?.teamIds ?? []);
  const [userSkills, setUserSkills] = useState<string[]>(user?.skills ?? []);
  const [acceptingNew, setAcceptingNew] = useState(user?.acceptingNew ?? true);
  const [scheduleId, setScheduleId] = useState(user?.scheduleId ?? "__queue__");

  return (
    <EditorShell
      open={open}
      onOpenChange={onOpenChange}
      title={user ? "Editar pessoa" : "Convidar pessoa"}
      description={
        user
          ? "Perfil, capacidade, competências e escala. A alteração de perfil é registrada como atenção na auditoria."
          : "O e-mail é o identificador de acesso e não pode repetir."
      }
      onSave={() =>
        onSubmit({
          entity: "usuario",
          action: user ? "editar" : "criar",
          id: user?.id,
          data: {
            name,
            email,
            role,
            capacity: Number(capacity),
            teamIds,
            skills: userSkills,
            acceptingNew,
            scheduleId: scheduleId === "__queue__" ? "" : scheduleId,
          },
        })
      }
    >
      <Field label="Nome">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="E-mail">
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
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
              {/* Perfis da organização entram na mesma lista: separá-los em
                  outro campo obrigaria quem cadastra a saber de antemão se o
                  perfil que procura é do produto ou da casa. */}
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

        <Field label="Capacidade">
          <Input
            type="number"
            min={1}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Conversas simultâneas que o roteamento pode atribuir.
          </p>
        </Field>
      </div>

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

      <Field label="Competências">
        <ul className="grid grid-cols-2 gap-1">
          {skills
            .filter((skill) => skill.active)
            .map((skill) => (
              <li key={skill.id}>
                <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                  <Checkbox
                    checked={userSkills.includes(skill.key)}
                    onCheckedChange={(checked) =>
                      setUserSkills((current) =>
                        checked === true
                          ? [...current, skill.key]
                          : current.filter((item) => item !== skill.key),
                      )
                    }
                  />
                  <span className="truncate">{skill.label}</span>
                </label>
              </li>
            ))}
        </ul>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Lista vazia significa que a pessoa não recebe conversa de fila que exige competência — não
          que recebe todas.
        </p>
      </Field>

      <Field label="Escala">
        <Select value={scheduleId} onValueChange={setScheduleId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__queue__">Seguir a escala da fila</SelectItem>
            {schedules.map((schedule) => (
              <SelectItem key={schedule.id} value={schedule.id}>
                {schedule.name} — {summarizeBusinessSchedule(schedule)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/**
       * A pausa fica junto do cadastro porque quem administra também a usa para
       * o outro lado: tirar alguém do rodízio no dia de folga sem mexer na
       * presença, que continua sendo informação de quem está à mesa.
       */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-xs font-medium">Aceita conversas novas</p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Desligado, a pessoa continua atendendo o que já tem e sai da distribuição automática.
          </p>
        </div>
        <Switch checked={acceptingNew} onCheckedChange={setAcceptingNew} />
      </div>
    </EditorShell>
  );
}

/* Time ----------------------------------------------------------------------- */

export function TeamDialog({
  open,
  onOpenChange,
  team,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  onSubmit: (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [name, setName] = useState(team?.name ?? "");

  return (
    <EditorShell
      open={open}
      onOpenChange={onOpenChange}
      title={team ? "Editar time" : "Novo time"}
      description="O time é o que liga pessoas a filas — é por ele que o roteamento encontra quem atende."
      onSave={() =>
        onSubmit({
          entity: "time",
          action: team ? "editar" : "criar",
          id: team?.id,
          data: { name },
        })
      }
    >
      <Field label="Nome">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
    </EditorShell>
  );
}

/* Fila ----------------------------------------------------------------------- */

const CHANNEL_OPTIONS: ChannelKind[] = [
  "whatsapp",
  "email",
  "instagram",
  "messenger",
  "webchat",
  "form",
  "phone",
];

export function QueueDialog({
  open,
  onOpenChange,
  queue,
  teams,
  queues,
  users,
  skills,
  schedules,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue?: Queue;
  teams: Team[];
  queues: Queue[];
  users: User[];
  skills: SkillDefinition[];
  schedules: BusinessSchedule[];
  onSubmit: (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [name, setName] = useState(queue?.name ?? "");
  const [description, setDescription] = useState(queue?.description ?? "");
  const [teamId, setTeamId] = useState(queue?.teamId ?? teams[0]?.id ?? "");
  const [channels, setChannels] = useState<ChannelKind[]>(queue?.channels ?? ["whatsapp"]);
  const [first, setFirst] = useState(String(queue?.firstResponseSlaMinutes ?? 15));
  const [resolution, setResolution] = useState(String(queue?.resolutionSlaMinutes ?? 480));
  const [scheduleId, setScheduleId] = useState(queue?.scheduleId ?? "__none__");
  const [distribution, setDistribution] = useState<QueueDistribution>(
    queue?.distribution ?? DEFAULT_DISTRIBUTION,
  );

  /**
   * Duas abas, e não um formulário de trinta campos.
   *
   * Identificação e distribuição são editadas em momentos diferentes: o nome e
   * o SLA se escrevem uma vez, a distribuição se ajusta ao longo de meses.
   * Empilhadas, a prévia de distribuição — que é a parte que ensina — nasceria
   * abaixo da dobra do diálogo, e quem só quer trocar o modelo rolaria por
   * campos que não vai tocar.
   */
  return (
    <EditorShell
      open={open}
      onOpenChange={onOpenChange}
      title={queue ? "Editar fila" : "Nova fila"}
      description="A descrição não é enfeite: é por ela que o agente de IA escolhe o setor no roteamento automático."
      wide
      onSave={() =>
        onSubmit({
          entity: "fila",
          action: queue ? "editar" : "criar",
          id: queue?.id,
          data: {
            name,
            description,
            teamId,
            channels,
            firstResponseSlaMinutes: Number(first),
            resolutionSlaMinutes: Number(resolution),
            scheduleId: scheduleId === "__none__" ? "" : scheduleId,
            distribution,
          },
        })
      }
    >
      <Tabs defaultValue="identificacao">
        <TabsList className="mb-3">
          <TabsTrigger value="identificacao">Identificação e SLA</TabsTrigger>
          <TabsTrigger value="distribuicao">Distribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="identificacao" className="m-0 space-y-3">
          <Field label="Nome">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <Field label="Descrição">
            <Textarea
              rows={3}
              value={description}
              placeholder="O que este setor resolve. Escreva pensando em quem não conhece a estrutura interna."
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <Field label="Time responsável">
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Canais que entregam aqui">
            <ul className="grid grid-cols-2 gap-1">
              {CHANNEL_OPTIONS.map((kind) => (
                <li key={kind}>
                  <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                    <Checkbox
                      checked={channels.includes(kind)}
                      onCheckedChange={(checked) =>
                        setChannels((current) =>
                          checked === true
                            ? [...current, kind]
                            : current.filter((item) => item !== kind),
                        )
                      }
                    />
                    {CHANNEL_LABEL[kind]}
                  </label>
                </li>
              ))}
            </ul>
          </Field>

          <Field label="Escala de atendimento">
            <Select value={scheduleId} onValueChange={setScheduleId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem escala — atende em qualquer horário</SelectItem>
                {schedules.map((schedule) => (
                  <SelectItem key={schedule.id} value={schedule.id}>
                    {schedule.name} — {summarizeBusinessSchedule(schedule)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="1ª resposta (min)">
              <Input
                type="number"
                min={1}
                value={first}
                onChange={(event) => setFirst(event.target.value)}
              />
            </Field>
            <Field label="Solução (min)">
              <Input
                type="number"
                min={1}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
              />
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="distribuicao" className="m-0">
          <DistributionEditor
            value={distribution}
            onChange={setDistribution}
            teamId={teamId}
            queueId={queue?.id}
            queues={queues}
            users={users}
            skills={skills}
            firstResponseSlaMinutes={Number(first) || 15}
          />
        </TabsContent>
      </Tabs>
    </EditorShell>
  );
}

/* Canal ---------------------------------------------------------------------- */

export function ChannelDialog({
  open,
  onOpenChange,
  channel,
  queues,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ChannelAccount;
  queues: Queue[];
  onSubmit: (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [label, setLabel] = useState(channel.label);
  const [queueId, setQueueId] = useState(channel.queueId);
  const [dailyLimit, setDailyLimit] = useState(String(channel.dailyLimit ?? ""));

  const derived = channel.kind === "webchat";

  return (
    <EditorShell
      open={open}
      onOpenChange={onOpenChange}
      title="Editar canal"
      description={
        derived
          ? "Este canal é derivado de um widget de webchat. O nome vem do widget; aqui muda só o destino."
          : "Nome de exibição, fila de destino e limite diário de envio."
      }
      onSave={() =>
        onSubmit({
          entity: "canal",
          action: "editar",
          id: channel.id,
          data: {
            label: derived ? undefined : label,
            queueId,
            dailyLimit: dailyLimit ? Number(dailyLimit) : undefined,
          },
        })
      }
    >
      {derived ? null : (
        <Field label="Nome">
          <Input value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
      )}

      <Field label="Fila de destino">
        <Select value={queueId} onValueChange={setQueueId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {queues.map((queue) => (
              <SelectItem key={queue.id} value={queue.id}>
                {queue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {channel.kind === "whatsapp" ? (
        <Field label="Limite diário de envio">
          <Input
            type="number"
            min={1}
            value={dailyLimit}
            onChange={(event) => setDailyLimit(event.target.value)}
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            É o teto que a Meta atribui ao número, e sobe com qualidade e volume. O valor aqui serve
            para a fila de envio frear antes de o provedor recusar.
          </p>
        </Field>
      ) : null}

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Estado da conexão ({channel.status}) e qualidade vêm do provedor e não se editam por aqui —
        seriam um número inventado sobre a saúde real do canal.
      </p>
    </EditorShell>
  );
}
