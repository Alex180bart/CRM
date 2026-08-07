"use client";

import Link from "next/link";
import type { Queue, User, WebchatWidget } from "@crm/core";
import {
  checkWidgetContrast,
  FLOW_STATUS_LABEL,
  formatDate,
  formatNumber,
  formatPercent,
  hasBlockingWidgetIssue,
  isWithinSchedule,
  now,
  readableInk,
  summarizeSchedule,
  validateWidget,
} from "@crm/core";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  ProgressBar,
  Reveal,
  StatTile,
  StatusDot,
  Tooltip,
  cn,
} from "@crm/ui";
import {
  ArrowUpRight,
  CircleAlert,
  Clock,
  Globe,
  MessageSquareCode,
  MousePointerClick,
  UserPlus,
} from "lucide-react";

/**
 * Lista de widgets.
 *
 * O cartão mostra o lançador de verdade, pintado com a cor publicada. Um nome e
 * um selo de status não bastam aqui: com dois ou três widgets no ar, é a peça
 * visual que identifica qual é qual — e é ela que revela na lista o widget cuja
 * cor ficou ilegível depois de alguém "só ajustar o tom".
 */
export function WidgetList({
  widgets,
  queues,
  users,
}: {
  widgets: WebchatWidget[];
  queues: Queue[];
  users: User[];
}) {
  // Instante ancorado. `new Date()` aqui divergiria entre servidor e cliente e
  // quebraria a hidratação exatamente nesta linha.
  const reference = now();
  const queueById = new Map(queues.map((queue) => [queue.id, queue]));
  const userById = new Map(users.map((user) => [user.id, user]));

  const totals = widgets.reduce(
    (acc, widget) => ({
      opens: acc.opens + widget.stats.opens30d,
      conversations: acc.conversations + widget.stats.conversations30d,
      leads: acc.leads + widget.stats.leads30d,
    }),
    { opens: 0, conversations: 0, leads: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal index={0}>
          <StatTile
            label="Aberturas (30 d)"
            value={formatNumber(totals.opens)}
            hint="cliques no lançador"
            icon={<MousePointerClick />}
          />
        </Reveal>
        <Reveal index={1}>
          <StatTile
            label="Viraram conversa"
            value={formatPercent((totals.conversations / Math.max(totals.opens, 1)) * 100, 1)}
            hint={`${formatNumber(totals.conversations)} conversas abertas`}
          />
        </Reveal>
        <Reveal index={2}>
          <StatTile
            label="Leads novos"
            value={formatNumber(totals.leads)}
            hint="contatos que não existiam antes"
            icon={<UserPlus />}
          />
        </Reveal>
        <Reveal index={3}>
          <StatTile
            label="Widgets no ar"
            value={`${widgets.filter((widget) => widget.activeVersionId).length}/${widgets.length}`}
            hint="os demais estão em rascunho"
            icon={<MessageSquareCode />}
          />
        </Reveal>
      </div>

      {widgets.length === 0 ? (
        <EmptyState
          icon={<MessageSquareCode />}
          title="Nenhum widget criado"
          description="Um widget de webchat é a porta de entrada do site: escolha a cor, o que perguntar antes e qual fila recebe."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {widgets.map((widget, index) => {
            const active = widget.versions.find((item) => item.id === widget.activeVersionId);
            const draft = widget.versions.find((item) => item.id === widget.draftVersionId);
            const shown = active ?? draft ?? widget.versions[0]!;
            const queue = queueById.get(shown.behavior.queueId);
            const owner = userById.get(widget.ownerId);
            const contrast = checkWidgetContrast(shown.appearance.brandColor);
            const blocked = draft ? hasBlockingWidgetIssue(validateWidget(widget, draft)) : false;

            return (
              <Reveal key={widget.id} index={Math.min(index + 4, 9)} as="li">
                <div className="bg-card shadow-card lift flex h-full flex-col rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    {/* O lançador de verdade, na cor publicada. */}
                    <span
                      className="shadow-raised flex size-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: shown.appearance.brandColor,
                        color: readableInk(shown.appearance.brandColor).hex,
                      }}
                      aria-hidden
                    >
                      <svg viewBox="0 0 24 24" className="size-5" fill="none">
                        <path
                          d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.7A.75.75 0 0 1 4 19.1V5.5Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                        {widget.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {active ? (
                          <Badge variant="success">
                            <StatusDot tone="success" pulse />v{active.version} no ar
                          </Badge>
                        ) : (
                          <Badge variant="neutral">nunca publicado</Badge>
                        )}
                        {draft && draft.id !== widget.activeVersionId ? (
                          <Badge variant={blocked ? "danger" : "warning"}>
                            v{draft.version} {FLOW_STATUS_LABEL[draft.status]}
                          </Badge>
                        ) : null}
                        {contrast.verdict !== "aprovado" ? (
                          <Tooltip content={contrast.message}>
                            <Badge variant={contrast.verdict === "limite" ? "warning" : "danger"}>
                              <CircleAlert aria-hidden />
                              {/* A razão que importa na lista é a da peça contra a
                                  página: é ela que diz se o lançador aparece. */}
                              contraste {contrast.surfaceRatio.toFixed(1)}:1
                            </Badge>
                          </Tooltip>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    {widget.description}
                  </p>

                  <div className="bg-muted/50 mt-3 space-y-1 rounded-lg px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px]">
                      <Globe className="text-muted-foreground size-3 shrink-0" aria-hidden />
                      {widget.allowedDomains.length > 0 ? (
                        <span className="truncate font-mono">
                          {widget.allowedDomains.join(" · ")}
                        </span>
                      ) : (
                        <span className="text-destructive">sem domínio autorizado</span>
                      )}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                      <Clock className="size-3 shrink-0" aria-hidden />
                      {summarizeSchedule(shown)}
                      {/* Aberto agora ou não: é a primeira pergunta de quem abre
                          esta tela porque "o chat não respondeu o cliente". */}
                      <span
                        className={cn(
                          "ml-auto shrink-0 font-medium",
                          isWithinSchedule(shown, reference)
                            ? "text-success"
                            : "text-muted-foreground",
                        )}
                      >
                        {isWithinSchedule(shown, reference) ? "atendendo agora" : "fora do horário"}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      Fila: {queue?.name ?? "não definida"}
                      {shown.behavior.responder === "fluxo"
                        ? " · fluxo de chatbot antes do humano"
                        : shown.behavior.responder === "agente"
                          ? " · agente de IA antes do humano"
                          : ""}
                      {shown.behavior.prechatEnabled
                        ? ` · ${shown.behavior.prechatFields.length} campos antes de conversar`
                        : " · sem formulário"}
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px]">
                      <span>Aberturas que viraram conversa</span>
                      <span className="tabular-nums">
                        {formatPercent(widget.stats.conversionPct, 1)}
                      </span>
                    </div>
                    <ProgressBar
                      value={widget.stats.conversionPct}
                      tone={widget.stats.conversionPct >= 25 ? "success" : "accent"}
                      label="Conversão do widget"
                    />
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Aberturas
                      </dt>
                      <dd className="figure text-sm font-semibold">
                        {formatNumber(widget.stats.opens30d)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Leads
                      </dt>
                      <dd className="figure text-sm font-semibold">
                        {formatNumber(widget.stats.leads30d)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        1ª resposta
                      </dt>
                      <dd className="figure text-sm font-semibold">
                        {widget.stats.medianFirstReplySeconds}s
                      </dd>
                    </div>
                  </dl>

                  <div className="text-muted-foreground mt-3 flex items-center gap-2 text-[11px]">
                    {owner ? (
                      <>
                        <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
                        {owner.name}
                      </>
                    ) : null}
                    {active?.publishedAt ? (
                      <span>· no ar desde {formatDate(active.publishedAt)}</span>
                    ) : null}
                  </div>

                  <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                    <Link href={`/webchat/${widget.id}`}>
                      Personalizar
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </ul>
      )}

      <Reveal index={9} className="mt-6">
        <Eyebrow className="mb-1.5">Por que domínio autorizado importa</Eyebrow>
        <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
          O trecho de incorporação é público: ele vive no HTML de quem visita o site. Sem a lista de
          domínios, o mesmo trecho copiado para outro endereço continuaria abrindo conversas na fila
          da empresa — e o primeiro sintoma seria a fila entupida sem ninguém entender de onde vem.
        </p>
      </Reveal>
    </div>
  );
}
