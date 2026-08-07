"use client";

import { useMemo, useState } from "react";
import type { Queue, QueueDistribution, SkillDefinition, User } from "@crm/core";
import {
  DISTRIBUTION_MODEL_HINT,
  DISTRIBUTION_MODEL_LABEL,
  QUEUE_DELIVERY_LABEL,
  decideAssignment,
  warnOfferBudget,
} from "@crm/core";
import type { DistributionModel, DistributionTiebreak, QueueDelivery } from "@crm/core";
import {
  Badge,
  Callout,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from "@crm/ui";
import { ArrowRight, CircleAlert, Info, UserX } from "lucide-react";

/**
 * Configuração de distribuição de uma fila, com prévia da decisão.
 *
 * ## Por que o simulador está grudado no formulário
 *
 * "Roleta com desempate por menor carga, respeitando capacidade, exigindo
 * presença disponível" são quatro chaves cuja combinação ninguém consegue
 * simular de cabeça. Sem prévia, a única forma de descobrir o efeito seria
 * esperar a próxima conversa real cair — o que significa descobrir errando, na
 * frente do cliente.
 *
 * A prévia é honesta porque chama **a mesma função** que o roteamento chamaria:
 * `decideAssignment` é pura, e é por isso que ela pôde ser escrita assim. Uma
 * simulação aproximada, escrita à parte, seria pior que nenhuma — daria
 * confiança em algo que diverge do comportamento real justamente nos casos de
 * borda que a pessoa está tentando entender.
 *
 * ## A carga da prévia é fictícia, e a tela diz isso
 *
 * Sem back-end não existe "conversas abertas por atendente" de verdade. O
 * simulador usa uma carga derivada do próprio cadastro, com o aviso escrito ao
 * lado. Inventar números sem avisar transformaria a prévia numa mentira
 * convincente sobre quem está sobrecarregado.
 */

const MODELS: DistributionModel[] = [
  "manual",
  "roleta",
  "menor_carga",
  "proprietario",
  "habilidade",
];

export function DistributionEditor({
  value,
  onChange,
  teamId,
  queueId,
  queues,
  users,
  skills,
  firstResponseSlaMinutes,
}: {
  value: QueueDistribution;
  onChange: (next: QueueDistribution) => void;
  teamId: string;
  queueId?: string;
  queues: Queue[];
  users: User[];
  skills: SkillDefinition[];
  firstResponseSlaMinutes: number;
}) {
  const set = <K extends keyof QueueDistribution>(key: K, next: QueueDistribution[K]) =>
    onChange({ ...value, [key]: next });

  const team = useMemo(
    () => users.filter((user) => user.teamIds.includes(teamId)),
    [users, teamId],
  );

  const budgetWarning = warnOfferBudget(value, firstResponseSlaMinutes);
  const usesTiebreak = value.model === "proprietario" || value.model === "habilidade";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Modelo de distribuição</Label>
        <Select
          value={value.model}
          onValueChange={(next) => set("model", next as DistributionModel)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((model) => (
              <SelectItem key={model} value={model}>
                {DISTRIBUTION_MODEL_LABEL[model]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {DISTRIBUTION_MODEL_HINT[value.model]}
        </p>
      </div>

      {value.model === "manual" ? (
        <Callout variant="info" icon={<Info />}>
          Em modo manual nada é atribuído automaticamente. As demais opções desta seção só passam a
          valer quando você escolhe um dos modelos automáticos.
        </Callout>
      ) : null}

      {value.model !== "manual" ? (
        <>
          {usesTiebreak ? (
            <div className="space-y-1.5">
              <Label>Desempate</Label>
              <Select
                value={value.tiebreak}
                onValueChange={(next) => set("tiebreak", next as DistributionTiebreak)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roleta">Roleta (rodízio)</SelectItem>
                  <SelectItem value="menor_carga">Menor carga</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {value.model === "proprietario"
                  ? "Usado quando o contato não tem responsável, ou quando o responsável não está elegível."
                  : "Usado para escolher entre as pessoas que têm as competências exigidas."}
              </p>
            </div>
          ) : null}

          {value.model === "habilidade" ? (
            <div className="space-y-1.5">
              <Label>Competências exigidas</Label>
              <ul className="grid gap-1 sm:grid-cols-2">
                {skills
                  .filter((skill) => skill.active)
                  .map((skill) => {
                    const able = team.filter((user) => user.skills.includes(skill.key)).length;
                    return (
                      <li key={skill.id}>
                        <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                          <Checkbox
                            checked={value.requiredSkills.includes(skill.key)}
                            onCheckedChange={(checked) =>
                              set(
                                "requiredSkills",
                                checked === true
                                  ? [...value.requiredSkills, skill.key]
                                  : value.requiredSkills.filter((item) => item !== skill.key),
                              )
                            }
                          />
                          <span className="flex-1 truncate">{skill.label}</span>
                          {/* O contador é o que evita exigir competência que ninguém do time tem. */}
                          <span
                            className={cn(
                              "text-[10px] tabular-nums",
                              able === 0 ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {able} no time
                          </span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Entrega</Label>
            <Select
              value={value.delivery}
              onValueChange={(next) => set("delivery", next as QueueDelivery)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direta">{QUEUE_DELIVERY_LABEL.direta}</SelectItem>
                <SelectItem value="oferta">{QUEUE_DELIVERY_LABEL.oferta}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {value.delivery === "oferta"
                ? "A conversa é reservada para uma pessoa por vez. Sem aceite no prazo, passa à próxima e quem não aceitou vai para o fim do rodízio."
                : "A conversa é atribuída na hora, sem aceite. Se a pessoa não estiver de fato à mesa, a conversa fica parada com aparência de atendida."}
            </p>
          </div>

          {value.delivery === "oferta" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tempo de aceite (s)</Label>
                <Input
                  type="number"
                  min={10}
                  max={600}
                  value={value.offerTimeoutSeconds}
                  onChange={(event) => set("offerTimeoutSeconds", Number(event.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tentativas</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={value.maxOffers}
                  onChange={(event) => set("maxOffers", Number(event.target.value) || 0)}
                />
              </div>
            </div>
          ) : null}

          {budgetWarning ? (
            <Callout variant="warning" icon={<CircleAlert />}>
              {budgetWarning}
            </Callout>
          ) : null}

          <div className="space-y-2 pt-1">
            <ToggleRow
              label="Respeitar a capacidade de cada pessoa"
              hint="Acima do número de conversas simultâneas configurado no perfil, ninguém recebe mais."
              checked={value.respectCapacity}
              onChange={(next) => set("respectCapacity", next)}
            />
            <ToggleRow
              label="Só distribuir para quem está disponível"
              hint='Desligado, "Ausente" e "Ocupado" também recebem. "Offline" nunca recebe, em nenhuma configuração.'
              checked={value.requireAvailable}
              onChange={(next) => set("requireAvailable", next)}
            />
            <ToggleRow
              label="Parar fora do horário da escala"
              hint="Fora do expediente a conversa fica na fila em vez de ser atribuída a quem não está trabalhando."
              checked={value.pauseOutsideSchedule}
              onChange={(next) => set("pauseOutsideSchedule", next)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Transbordo</Label>
            <Select
              value={value.overflowQueueId ?? "__none__"}
              onValueChange={(next) =>
                set("overflowQueueId", next === "__none__" ? undefined : next)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Devolver a esta mesma fila</SelectItem>
                {queues
                  .filter((queue) => queue.id !== queueId)
                  .map((queue) => (
                    <SelectItem key={queue.id} value={queue.id}>
                      {queue.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Para onde vai a conversa que ninguém aceitou depois de todas as tentativas.
            </p>
          </div>

          <DistributionPreview
            distribution={value}
            teamId={teamId}
            queueId={queueId}
            users={users}
          />
        </>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-muted-foreground text-[11px] leading-relaxed">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* Prévia --------------------------------------------------------------------- */

/**
 * Carga fictícia, derivada e estável.
 *
 * O número sai do próprio cadastro (capacidade e posição do identificador) para
 * que a prévia não mude a cada tecla — uma carga sorteada faria a decisão pular
 * de pessoa em pessoa enquanto alguém digita, e a prévia deixaria de ensinar
 * qualquer coisa sobre o modelo escolhido.
 */
function simulatedLoad(user: User, index: number): number {
  if (user.presence === "offline") return 0;
  return Math.min(user.capacity, (index * 2 + user.name.length) % (user.capacity + 1));
}

function DistributionPreview({
  distribution,
  teamId,
  queueId,
  users,
}: {
  distribution: QueueDistribution;
  teamId: string;
  queueId?: string;
  users: User[];
}) {
  const [ownerId, setOwnerId] = useState<string>("__none__");

  const candidates = useMemo(
    () =>
      users
        .filter((user) => user.teamIds.includes(teamId))
        .map((user, index) => ({ user, openConversations: simulatedLoad(user, index) })),
    [users, teamId],
  );

  const decision = useMemo(
    () =>
      decideAssignment({
        queue: {
          id: queueId ?? "preview",
          organizationId: "preview",
          name: "Prévia",
          description: "",
          channels: [],
          teamId,
          firstResponseSlaMinutes: 15,
          resolutionSlaMinutes: 480,
          color: "218",
          distribution,
          createdAt: "",
          updatedAt: "",
        },
        candidates,
        contactOwnerId: ownerId === "__none__" ? undefined : ownerId,
        // A prévia assume expediente aberto: fechado, a única resposta possível
        // seria "ninguém recebe", que não ensina nada sobre o modelo.
        scheduleOpen: true,
      }),
    [distribution, candidates, ownerId, teamId, queueId],
  );

  const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? id;

  return (
    <div className="bg-surface-sunken space-y-2.5 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-xs font-semibold tracking-tight">Prévia da decisão</p>
        <Badge variant="neutral">carga fictícia</Badge>
      </div>

      {distribution.model === "proprietario" ? (
        <div className="space-y-1">
          <Label className="text-[11px]">Simular contato cujo responsável é</Label>
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Contato sem responsável</SelectItem>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.user.id} value={candidate.user.id}>
                  {candidate.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {decision.outcome === "reter" ? (
        <Callout variant="warning" icon={<UserX />}>
          {decision.reason}
        </Callout>
      ) : (
        <>
          <p className="text-xs leading-relaxed">{decision.reason}</p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {decision.order.map((id, index) => (
              <li key={id} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <ArrowRight className="text-muted-foreground size-3" aria-hidden />
                ) : null}
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px]",
                    index === 0
                      ? "bg-accent/15 text-accent-ink font-medium"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  {index + 1}. {nameOf(id)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      {decision.excluded.length > 0 ? (
        <details className="text-muted-foreground text-[11px]">
          <summary className="cursor-pointer select-none">
            {decision.excluded.length} pessoa(s) fora desta rodada
          </summary>
          <ul className="mt-1.5 space-y-0.5">
            {decision.excluded.map((item) => (
              <li key={item.userId}>
                <span className="text-foreground">{item.name}</span> — {item.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-muted-foreground text-[10px] leading-relaxed">
        A ocupação usada aqui é fictícia — não há back-end contando conversas abertas. O que a
        prévia demonstra de verdade é a <strong>regra</strong>: a mesma função decide o roteamento
        real quando a camada de escrita entrar.
      </p>
    </div>
  );
}
