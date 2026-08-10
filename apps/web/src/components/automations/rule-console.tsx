"use client";

import { useMemo, useState } from "react";
import type {
  AutomationRule,
  Contact,
  RuleActionKind,
  RuleRun,
  RuleTriggerKind,
  User,
} from "@elora/core";
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelative,
  RULE_ACTION_LABEL,
  RULE_OPERATOR_LABEL,
  RULE_TRIGGER_EVENT,
  RULE_TRIGGER_LABEL,
} from "@elora/core";
import {
  Avatar,
  Badge,
  Button,
  Eyebrow,
  Reveal,
  RevealScope,
  SearchInput,
  StatTile,
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
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock,
  Filter,
  FormInput,
  Globe,
  MailOpen,
  MousePointerClick,
  Pencil,
  Route,
  SkipForward,
  Tag as TagIcon,
  Target,
  Timer,
  UserPlus,
  Zap,
  type LucideIcon,
  BadgeDollarSign,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

import { WhatsAppGlyph } from "@/lib/brand-icons";

/**
 * Console de automações.
 *
 * A regra é lida como frase: **quando** algo acontece, **se** as condições
 * baterem, **então** estas ações rodam. O cartão desenha exatamente essa
 * sequência, porque é assim que quem configura pensa — e é o que permite
 * conferir uma automação sem abrir o editor.
 */

const TRIGGER_META: Record<RuleTriggerKind, { icon: LucideIcon; hue: number }> = {
  email_aberto: { icon: MailOpen, hue: 208 },
  email_clicado: { icon: MousePointerClick, hue: 208 },
  whatsapp_botao: { icon: MousePointerClick, hue: 145 },
  whatsapp_palavra_chave: { icon: Filter, hue: 145 },
  formulario_respondido: { icon: FormInput, hue: 280 },
  campanha_entregue: { icon: Zap, hue: 330 },
  sem_resposta: { icon: Timer, hue: 38 },
  tag_adicionada: { icon: TagIcon, hue: 280 },
  etapa_alterada: { icon: Route, hue: 30 },
  contato_criado: { icon: UserPlus, hue: 218 },
  proposta_aceita: { icon: FileCheck, hue: 174 },
  compra_aprovada: { icon: BadgeDollarSign, hue: 145 },
};

const ACTION_META: Record<RuleActionKind, { icon: LucideIcon; hue: number }> = {
  enviar_whatsapp: { icon: MousePointerClick, hue: 145 },
  enviar_email: { icon: MailOpen, hue: 208 },
  criar_tarefa: { icon: CheckCircle2, hue: 208 },
  adicionar_tag: { icon: TagIcon, hue: 280 },
  remover_tag: { icon: TagIcon, hue: 0 },
  mover_etapa: { icon: Route, hue: 30 },
  atribuir_dono: { icon: UserPlus, hue: 218 },
  notificar_equipe: { icon: BellRing, hue: 330 },
  iniciar_jornada: { icon: Route, hue: 250 },
  webhook: { icon: Globe, hue: 190 },
  atualizar_campo: { icon: Pencil, hue: 218 },
};

function TriggerIcon({ kind }: { kind: RuleTriggerKind }) {
  const meta = TRIGGER_META[kind];
  const Icon = meta.icon;
  const isWhatsApp = kind === "whatsapp_botao" || kind === "whatsapp_palavra_chave";

  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
      style={{
        backgroundColor: `hsl(${meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
        color: `hsl(${meta.hue} 55% var(--hue-fg-l))`,
      }}
    >
      {isWhatsApp ? <WhatsAppGlyph className="size-4" /> : <Icon className="size-4" aria-hidden />}
    </span>
  );
}

function describeTrigger(rule: AutomationRule): string {
  const { kind, config } = rule.trigger;
  switch (kind) {
    case "whatsapp_botao":
      return `botão “${config.botao}” do template ${config.template}`;
    case "whatsapp_palavra_chave":
      return `palavras: ${config.palavras}`;
    case "email_clicado":
    case "email_aberto":
      return `template ${config.template}`;
    case "formulario_respondido":
      return `formulário “${config.formulario}”`;
    case "sem_resposta":
      return `${config.dias} dias na etapa “${config.etapa}”`;
    case "tag_adicionada":
      return `tag “${config.tag}”`;
    default:
      return Object.values(config).join(" · ");
  }
}

function describeAction(kind: RuleActionKind, config: Record<string, string | number>): string {
  const values = Object.entries(config)
    .map(([key, value]) => (key === "template" || key === "tag" ? `${value}` : `${value}`))
    .join(" · ");
  return values || RULE_ACTION_LABEL[kind];
}

export function RuleConsole({
  rules: initialRules,
  runs,
  users,
  contacts,
}: {
  rules: AutomationRule[];
  runs: RuleRun[];
  users: User[];
  contacts: Contact[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const contactById = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);
  const ruleById = useMemo(() => new Map(rules.map((rule) => [rule.id, rule])), [rules]);

  const filtered = rules.filter((rule) =>
    search.trim()
      ? `${rule.name} ${rule.description} ${RULE_TRIGGER_LABEL[rule.trigger.kind]}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      : true,
  );

  const totals = rules.reduce(
    (acc, rule) => ({
      runs: acc.runs + rule.stats.runs30d,
      errors: acc.errors + rule.stats.errors,
      conversions: acc.conversions + rule.stats.conversions,
      active: acc.active + (rule.enabled ? 1 : 0),
    }),
    { runs: 0, errors: 0, conversions: 0, active: 0 },
  );

  function toggle(ruleId: string) {
    setRules((current) =>
      current.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule)),
    );
    const rule = rules.find((item) => item.id === ruleId);
    toast.success(rule?.enabled ? `"${rule.name}" desligada` : `"${rule?.name}" ligada`, {
      description: "A mudança vale para os próximos eventos. Execuções em andamento seguem.",
    });
  }

  return (
    <RevealScope>
      <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
        {/* Indicadores */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal index={0}>
            <StatTile
              label="Regras ligadas"
              value={`${totals.active}/${rules.length}`}
              hint="reagindo a eventos agora"
              icon={<Zap />}
            />
          </Reveal>
          <Reveal index={1}>
            <StatTile
              label="Execuções (30 d)"
              value={formatNumber(totals.runs)}
              hint="disparos avaliados pelo motor"
            />
          </Reveal>
          <Reveal index={2}>
            <StatTile
              label="Taxa de sucesso"
              value={formatPercent(
                ((totals.runs - totals.errors) / Math.max(totals.runs, 1)) * 100,
                1,
              )}
              trend={{
                direction: totals.errors > 10 ? "down" : "up",
                label: `${totals.errors} erros`,
                good: totals.errors <= 10,
              }}
            />
          </Reveal>
          <Reveal index={3}>
            <StatTile
              label="Conversões atribuídas"
              value={formatNumber(totals.conversions)}
              hint="negócios e reuniões vindos das regras"
              icon={<Target />}
            />
          </Reveal>
        </div>

        <Tabs defaultValue="regras">
          <TabsList className="mb-5">
            <TabsTrigger value="regras">
              Regras
              <Badge variant="neutral">{rules.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="historico">
              Histórico
              <Badge variant="neutral">{runs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="eventos">Catálogo de eventos</TabsTrigger>
          </TabsList>

          {/* Regras ------------------------------------------------------- */}
          <TabsContent value="regras" className="m-0">
            <Reveal index={4} className="mb-4">
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch("")}
                placeholder="Buscar regra ou gatilho"
                className="w-80"
                aria-label="Buscar automações"
              />
            </Reveal>

            <ul className="space-y-3">
              {filtered.map((rule, index) => {
                const owner = userById.get(rule.ownerId);
                const expanded = expandedId === rule.id;
                const successRate = (rule.stats.success / Math.max(rule.stats.runs30d, 1)) * 100;

                return (
                  <Reveal key={rule.id} index={Math.min(index + 5, 9)} as="li">
                    <div
                      className={cn(
                        "bg-card shadow-card rounded-lg transition-opacity",
                        !rule.enabled && "opacity-65",
                      )}
                    >
                      <div className="flex flex-wrap items-start gap-3 p-5">
                        <TriggerIcon kind={rule.trigger.kind} />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                              {rule.name}
                            </h3>
                            <Badge variant={rule.enabled ? "success" : "neutral"}>
                              <StatusDot
                                tone={rule.enabled ? "success" : "neutral"}
                                pulse={rule.enabled}
                              />
                              {rule.enabled ? "ligada" : "desligada"}
                            </Badge>
                            {rule.stats.errors > 0 ? (
                              <Tooltip content="Execuções que falharam nos últimos 30 dias.">
                                <Badge variant="danger">
                                  <CircleAlert aria-hidden />
                                  {rule.stats.errors}
                                </Badge>
                              </Tooltip>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                            {rule.description}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          {rule.stats.runs30d > 0 ? (
                            <div className="text-right">
                              <p className="figure text-base font-semibold">
                                {formatNumber(rule.stats.runs30d)}
                              </p>
                              <p className="text-muted-foreground text-[10px]">execuções 30 d</p>
                            </div>
                          ) : null}
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={() => toggle(rule.id)}
                            aria-label={`${rule.enabled ? "Desligar" : "Ligar"} ${rule.name}`}
                          />
                        </div>
                      </div>

                      {/* A frase: quando → se → então */}
                      <div className="flex flex-wrap items-stretch gap-2 px-5 pb-4">
                        <div className="bg-muted/50 min-w-0 flex-1 rounded-lg p-3">
                          <Eyebrow className="mb-1">Quando</Eyebrow>
                          <p className="text-xs font-medium">
                            {RULE_TRIGGER_LABEL[rule.trigger.kind]}
                          </p>
                          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                            {describeTrigger(rule)}
                          </p>
                        </div>

                        <span className="text-muted-foreground/50 flex items-center">
                          <ArrowRight className="size-4" aria-hidden />
                        </span>

                        <div className="bg-muted/50 min-w-0 flex-1 rounded-lg p-3">
                          <Eyebrow className="mb-1">
                            Se {rule.conditions.length > 1 ? `(${rule.conditionMatch})` : ""}
                          </Eyebrow>
                          {rule.conditions.length === 0 ? (
                            <p className="text-muted-foreground text-xs">
                              Sem condições — sempre roda.
                            </p>
                          ) : (
                            <ul className="space-y-0.5">
                              {rule.conditions.map((condition) => (
                                <li key={condition.id} className="truncate text-[11px]">
                                  <span className="font-medium">{condition.fieldLabel}</span>{" "}
                                  <span className="text-muted-foreground">
                                    {RULE_OPERATOR_LABEL[condition.operator]}
                                  </span>{" "}
                                  <span className="font-medium">{condition.value}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <span className="text-muted-foreground/50 flex items-center">
                          <ArrowRight className="size-4" aria-hidden />
                        </span>

                        <div className="bg-muted/50 min-w-0 flex-[1.4] rounded-lg p-3">
                          <Eyebrow className="mb-1.5">Então</Eyebrow>
                          <ul className="flex flex-wrap gap-1.5">
                            {rule.actions.map((action) => {
                              const meta = ACTION_META[action.kind];
                              const Icon = meta.icon;
                              return (
                                <Tooltip
                                  key={action.id}
                                  content={describeAction(action.kind, action.config)}
                                >
                                  <li
                                    className="bg-card shadow-card flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
                                    style={{ color: `hsl(${meta.hue} 55% var(--hue-fg-l))` }}
                                  >
                                    <Icon className="size-3 shrink-0" aria-hidden />
                                    <span className="text-foreground">
                                      {RULE_ACTION_LABEL[action.kind]}
                                    </span>
                                    {action.delayMinutes > 0 ? (
                                      <span className="text-muted-foreground flex items-center gap-0.5">
                                        <Clock className="size-2.5" aria-hidden />
                                        {formatDuration(action.delayMinutes)}
                                      </span>
                                    ) : null}
                                  </li>
                                </Tooltip>
                              );
                            })}
                          </ul>
                        </div>
                      </div>

                      {/* Rodapé */}
                      <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
                        {owner ? (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                            <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
                            {owner.name}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground text-[11px]">
                          1 vez a cada {rule.maxPerContactPerDays} dias por contato
                        </span>
                        {rule.stats.lastRunAt ? (
                          <span className="text-muted-foreground text-[11px]">
                            última execução {formatRelative(rule.stats.lastRunAt)}
                          </span>
                        ) : null}
                        {rule.stats.runs30d > 0 ? (
                          <span
                            className={cn(
                              "text-[11px] font-medium",
                              successRate >= 97 ? "text-success" : "text-warning",
                            )}
                          >
                            {formatPercent(successRate, 1)} de sucesso
                          </span>
                        ) : null}

                        <Button
                          variant="ghost"
                          size="xs"
                          className="ml-auto"
                          onClick={() => setExpandedId(expanded ? null : rule.id)}
                        >
                          {expanded ? "Ocultar execuções" : "Ver execuções"}
                        </Button>
                      </div>

                      {expanded ? (
                        <ul className="px-5 pb-4">
                          {runs
                            .filter((run) => run.ruleId === rule.id)
                            .map((run) => (
                              <li
                                key={run.id}
                                className="shadow-inset-hairline flex items-start gap-2.5 py-2"
                              >
                                {run.status === "sucesso" ? (
                                  <CheckCircle2 className="text-success mt-0.5 size-3.5 shrink-0" />
                                ) : run.status === "erro" ? (
                                  <CircleAlert className="text-destructive mt-0.5 size-3.5 shrink-0" />
                                ) : (
                                  <SkipForward className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-medium">
                                    {contactById.get(run.contactId)?.fullName ?? run.contactId}
                                  </span>
                                  <span className="text-muted-foreground block text-[11px]">
                                    {run.detail}
                                  </span>
                                </span>
                                <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                                  {formatRelative(run.occurredAt)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : null}
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </TabsContent>

          {/* Histórico ---------------------------------------------------- */}
          <TabsContent value="historico" className="m-0">
            <Reveal index={0}>
              <div className="bg-card shadow-card rounded-lg">
                <ul>
                  {runs.map((run) => {
                    const rule = ruleById.get(run.ruleId);
                    return (
                      <li
                        key={run.id}
                        className="shadow-inset-hairline flex items-start gap-3 p-4 last:shadow-none"
                      >
                        {run.status === "sucesso" ? (
                          <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                        ) : run.status === "erro" ? (
                          <CircleAlert className="text-destructive mt-0.5 size-4 shrink-0" />
                        ) : (
                          <SkipForward className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium">{rule?.name ?? run.ruleId}</span>
                            <Badge
                              variant={
                                run.status === "sucesso"
                                  ? "success"
                                  : run.status === "erro"
                                    ? "danger"
                                    : "neutral"
                              }
                            >
                              {run.status}
                            </Badge>
                            <span className="text-muted-foreground text-[11px]">
                              {contactById.get(run.contactId)?.fullName ?? run.contactId}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                            {run.detail}
                          </p>
                          {run.correlationId ? (
                            <p className="text-muted-foreground/70 mt-0.5 font-mono text-[10px]">
                              {run.correlationId}
                            </p>
                          ) : null}
                        </div>

                        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                          {formatRelative(run.occurredAt)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Reveal>
          </TabsContent>

          {/* Catálogo de eventos ------------------------------------------ */}
          <TabsContent value="eventos" className="m-0">
            <Reveal index={0}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <p className="text-muted-foreground mb-4 max-w-3xl text-xs leading-relaxed">
                  Toda automação escuta um evento de domínio. O nome do evento é contrato: renomear
                  exige migração e período de convivência. É por ele que se rastreia uma execução
                  até a origem.
                </p>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-left text-[11px]">
                      <th className="pb-2 font-medium">Gatilho</th>
                      <th className="pb-2 font-medium">Evento</th>
                      <th className="pb-2 text-right font-medium">Regras usando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(RULE_TRIGGER_LABEL) as RuleTriggerKind[]).map((kind) => {
                      const usage = rules.filter((rule) => rule.trigger.kind === kind).length;
                      return (
                        <tr key={kind} className="shadow-inset-hairline">
                          <td className="py-2.5">
                            <span className="flex items-center gap-2">
                              <TriggerIcon kind={kind} />
                              {RULE_TRIGGER_LABEL[kind]}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                              {RULE_TRIGGER_EVENT[kind]}
                            </code>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {usage > 0 ? (
                              <Badge variant="primary">{usage}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </TabsContent>
        </Tabs>
      </div>
    </RevealScope>
  );
}
