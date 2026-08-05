"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  BrandKit,
  ChannelAccount,
  EmailDesignTemplate,
  MessageTemplate,
  Segment,
} from "@crm/core";
import {
  applyMergeTags,
  EMAIL_MERGE_TAGS,
  formatCurrencyCents,
  formatNumber,
  formatPercent,
  TEMPLATE_STATUS_LABEL,
} from "@crm/core";
import {
  Badge,
  Button,
  Callout,
  Input,
  Label,
  ProgressBar,
  Reveal,
  Switch,
  Textarea,
  Tooltip,
  cn,
} from "@crm/ui";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Gauge,
  Mail,
  Rocket,
  Send,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ChannelIcon } from "@/lib/channel";
import { IncomingBubble, PhoneFrame } from "@/components/shared/phone-frame";

/**
 * Assistente de nova campanha.
 *
 * A ordem dos passos não é estética: ela impede o erro mais caro do módulo —
 * escrever a mensagem antes de saber para quem. Público primeiro, mensagem
 * depois, envio por último. Quando o público é grande, a aprovação aparece
 * sozinha no fim, e não como surpresa no disparo.
 *
 * A prévia acompanha do passo da mensagem em diante, porque aprovar texto cru
 * esconde onde a quebra cai e se o botão sobrevive.
 */

type WizardChannel = "whatsapp" | "email";

const STEPS = [
  { id: "canal", label: "Canal e objetivo" },
  { id: "publico", label: "Público" },
  { id: "mensagem", label: "Mensagem" },
  { id: "envio", label: "Envio e proteções" },
  { id: "revisao", label: "Revisão" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/** Preço médio por mensagem, em centavos — usado só na estimativa de custo. */
const UNIT_COST_CENTS = { whatsapp: 74, email: 2 };

export function CampaignWizard({
  segments,
  messageTemplates,
  emailTemplates,
  brandKits,
  channelAccounts,
}: {
  segments: Segment[];
  messageTemplates: MessageTemplate[];
  emailTemplates: EmailDesignTemplate[];
  brandKits: BrandKit[];
  channelAccounts: ChannelAccount[];
}) {
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [channel, setChannel] = useState<WizardChannel>("whatsapp");
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"agora" | "agendar">("agendar");
  const [scheduledAt, setScheduledAt] = useState("2026-08-05T10:00");
  const [batchSize, setBatchSize] = useState(60);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [quietStart, setQuietStart] = useState(9);
  const [quietEnd, setQuietEnd] = useState(20);
  const [frequencyCapDays, setFrequencyCapDays] = useState(7);
  const [requireConsent, setRequireConsent] = useState(true);
  const [respectSuppression, setRespectSuppression] = useState(true);
  const [autoCancelErrorPct, setAutoCancelErrorPct] = useState(8);
  const [abTest, setAbTest] = useState(false);

  const step = STEPS[stepIndex]!;
  const segment = segments.find((item) => item.id === segmentId);

  const availableAccounts = useMemo(
    () => channelAccounts.filter((account) => account.kind === channel),
    [channelAccounts, channel],
  );

  const availableTemplates = useMemo(
    () =>
      channel === "whatsapp"
        ? messageTemplates.filter((template) => template.channel === "whatsapp")
        : [],
    [channel, messageTemplates],
  );

  const whatsappTemplate = availableTemplates.find((item) => item.id === templateId);
  const emailTemplate = emailTemplates.find((item) => item.id === templateId);

  const audience = segment?.eligibleSize ?? 0;
  const excluded = segment ? segment.estimatedSize - segment.eligibleSize : 0;
  const estimatedCost = audience * UNIT_COST_CENTS[channel];
  const needsApproval = audience > 250;
  const hoursToFinish = batchSize > 0 ? (audience / batchSize) * (intervalMinutes / 60) : 0;

  /* Validação por passo ---------------------------------------------------- */

  const stepErrors: Record<StepId, string | null> = {
    canal:
      name.trim().length === 0
        ? "Dê um nome à campanha."
        : objective.trim().length === 0
          ? "Descreva o objetivo — é o que orienta a aprovação."
          : accountId.length === 0
            ? "Escolha por qual canal a campanha sai."
            : null,
    publico: !segment
      ? "Escolha um segmento."
      : audience === 0
        ? "O segmento não tem contatos elegíveis."
        : null,
    mensagem:
      templateId.length === 0
        ? "Escolha o conteúdo que será enviado."
        : channel === "whatsapp" && whatsappTemplate?.status !== "aprovado"
          ? "O template escolhido não está aprovado pelo provedor."
          : null,
    envio: quietEnd <= quietStart ? "A janela de envio precisa terminar depois de começar." : null,
    revisao: null,
  };

  const currentError = stepErrors[step.id];
  const canAdvance = currentError === null;

  function next() {
    if (!canAdvance) return;
    setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
  }

  function create() {
    toast.success(`Campanha "${name}" criada`, {
      description: needsApproval
        ? `Enviada para aprovação: ${formatNumber(audience)} contatos ultrapassam o limite de 250.`
        : `Agendada para ${formatNumber(audience)} contatos elegíveis.`,
    });
    router.push("/campanhas");
  }

  /* Prévia ----------------------------------------------------------------- */

  function renderPreview() {
    if (channel === "whatsapp") {
      if (!whatsappTemplate) {
        return (
          <PhoneFrame subtitle="aguardando conteúdo">
            <div className="m-auto max-w-[80%] rounded-lg bg-[#FFF3C4] px-3 py-2 text-center text-[10px] leading-relaxed text-[#5B5039]">
              Escolha um template para ver como a mensagem chega no aparelho do contato.
            </div>
          </PhoneFrame>
        );
      }

      return (
        <PhoneFrame>
          <IncomingBubble
            header={whatsappTemplate.headerText}
            body={applyMergeTags(
              whatsappTemplate.body.replace(/\{\{(\d+)\}\}/g, (_, index: string) => {
                const variable = whatsappTemplate.variables[Number(index) - 1];
                const tag = EMAIL_MERGE_TAGS.find((item) => item.token === `{{${variable}}}`);
                return tag?.sample ?? variable ?? "…";
              }),
              EMAIL_MERGE_TAGS,
            )}
            footer={whatsappTemplate.footerText}
            buttons={whatsappTemplate.buttons}
          />
        </PhoneFrame>
      );
    }

    /* Prévia de e-mail: caixa de entrada + corpo resumido. */
    const brand = brandKits.find((kit) => kit.id === emailTemplate?.brandKitId) ?? brandKits[0];
    const version = emailTemplate?.versions.find(
      (item) => item.id === emailTemplate.activeVersionId,
    );

    return (
      <div className="mx-auto w-full max-w-[26rem]">
        <div className="shadow-overlay overflow-hidden rounded-xl bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Caixa de entrada</p>
          </div>
          <div className="flex gap-3 px-4 py-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: brand?.primaryColor ?? "#102850" }}
            >
              CF
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-900">
                {brand?.logoText ?? "Contabilidade Facilitada"}
              </p>
              <p className="truncate text-[12.5px] font-medium text-slate-800">
                {version
                  ? applyMergeTags(version.subject, EMAIL_MERGE_TAGS)
                  : "Escolha um e-mail para ver o assunto"}
              </p>
              <p className="truncate text-[11.5px] text-slate-500">
                {version
                  ? applyMergeTags(version.preheader, EMAIL_MERGE_TAGS)
                  : "A prévia da caixa aparece aqui"}
              </p>
            </div>
            <span className="shrink-0 text-[10px] text-slate-400">14:32</span>
          </div>

          {version ? (
            <div
              className="border-t border-slate-200 px-4 py-4"
              style={{ backgroundColor: brand?.backgroundColor ?? "#F4F6FA" }}
            >
              {version.blocks.slice(0, 4).map((block) => {
                if (block.kind === "texto") {
                  return (
                    <p
                      key={block.id}
                      className={cn(
                        "mb-2 whitespace-pre-wrap",
                        block.scale === "titulo"
                          ? "text-[17px] font-bold"
                          : block.scale === "subtitulo"
                            ? "text-[14px] font-semibold"
                            : "text-[12.5px] leading-relaxed",
                      )}
                      style={{ color: brand?.textColor ?? "#1B2B45" }}
                    >
                      {applyMergeTags(block.content, EMAIL_MERGE_TAGS)}
                    </p>
                  );
                }
                if (block.kind === "botao") {
                  return (
                    <span
                      key={block.id}
                      className="mb-2 inline-block rounded-md px-3 py-2 text-[12px] font-bold"
                      style={{ backgroundColor: brand?.accentColor ?? "#FF9933", color: "#12233D" }}
                    >
                      {block.label}
                    </span>
                  );
                }
                return null;
              })}
              <p className="mt-2 text-[10px] text-slate-500">…continua no corpo do e-mail</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
      {/* Cabeçalho e trilha de passos */}
      <Reveal index={0} as="header" className="mb-6">
        <Button asChild variant="ghost" size="xs" className="-ml-2 mb-2">
          <Link href="/campanhas">
            <ArrowLeft />
            Voltar para campanhas
          </Link>
        </Button>

        <h1 className="font-display text-xl font-semibold tracking-tight">Nova campanha</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Público antes da mensagem: é o que evita escrever para quem não pode receber.
        </p>

        <ol className="mt-5 flex flex-wrap items-center gap-1">
          {STEPS.map((item, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li key={item.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => index <= stepIndex && setStepIndex(index)}
                  disabled={index > stepIndex}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors",
                    current
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-success-soft text-success hover:bg-success-soft/70"
                        : "text-muted-foreground/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full text-[10px]",
                      current
                        ? "bg-primary-foreground/20"
                        : done
                          ? "bg-success text-success-foreground"
                          : "bg-muted",
                    )}
                  >
                    {done ? <Check className="size-2.5" /> : index + 1}
                  </span>
                  {item.label}
                </button>
                {index < STEPS.length - 1 ? (
                  <span className={cn("h-px w-4", done ? "bg-success" : "bg-border")} aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Formulário do passo */}
        <Reveal index={1} className="min-w-0">
          <div className="bg-card shadow-card rounded-lg p-5">
            {/* 1 — Canal e objetivo ------------------------------------- */}
            {step.id === "canal" ? (
              <div className="space-y-5">
                <div>
                  <Label className="mb-2 block">Canal</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: "whatsapp",
                          label: "WhatsApp",
                          hint: "Template aprovado, janela de 24 h",
                        },
                        {
                          id: "email",
                          label: "E-mail",
                          hint: "Peça do E-mail Studio, com descadastro",
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setChannel(option.id);
                          setTemplateId("");
                          setAccountId("");
                        }}
                        aria-pressed={channel === option.id}
                        className={cn(
                          "rounded-lg p-3 text-left transition-all",
                          channel === option.id
                            ? "bg-accent-soft ring-accent ring-2"
                            : "bg-muted/50 hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {option.id === "whatsapp" ? (
                            <ChannelIcon kind="whatsapp" withBackground />
                          ) : (
                            <ChannelIcon kind="email" withBackground />
                          )}
                          <span className="text-sm font-semibold">{option.label}</span>
                        </span>
                        <span className="text-muted-foreground mt-1 block text-[11px]">
                          {option.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="campaign-name">Nome da campanha</Label>
                  <Input
                    id="campaign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Migração de contador — setembro"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="campaign-objective">Objetivo</Label>
                  <Textarea
                    id="campaign-objective"
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    placeholder="O que esta campanha precisa produzir? Ex.: gerar reuniões de diagnóstico com leads qualificados."
                    className="min-h-20 text-xs"
                  />
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    O objetivo aparece para quem aprova. Sem ele, a aprovação vira carimbo.
                  </p>
                </div>

                <div>
                  <Label className="mb-2 block">Número / remetente</Label>
                  <div className="space-y-1.5">
                    {availableAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => setAccountId(account.id)}
                        aria-pressed={accountId === account.id}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left transition-all",
                          accountId === account.id
                            ? "bg-accent-soft ring-accent ring-2"
                            : "bg-muted/50 hover:bg-muted",
                        )}
                      >
                        <ChannelIcon kind={account.kind} withBackground />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {account.label}
                          </span>
                          <span className="text-muted-foreground block truncate font-mono text-[10px]">
                            {account.address}
                          </span>
                        </span>
                        {account.qualityRating ? (
                          <Badge
                            variant={
                              account.qualityRating === "alta"
                                ? "success"
                                : account.qualityRating === "media"
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {account.qualityRating}
                          </Badge>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* 2 — Público ---------------------------------------------- */}
            {step.id === "publico" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  {segments.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSegmentId(item.id)}
                      aria-pressed={segmentId === item.id}
                      className={cn(
                        "w-full rounded-lg p-3 text-left transition-all",
                        segmentId === item.id
                          ? "bg-accent-soft ring-accent ring-2"
                          : "bg-muted/50 hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Users className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                        <span className="truncate text-xs font-semibold">{item.name}</span>
                        <Badge variant={item.dynamic ? "info" : "neutral"} className="ml-auto">
                          {item.dynamic ? "dinâmico" : "estático"}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground mt-1 block text-[11px]">
                        {item.description}
                      </span>
                      <span className="mt-2 flex items-baseline gap-3">
                        <span className="figure text-success text-lg font-semibold">
                          {formatNumber(item.eligibleSize)}
                        </span>
                        <span className="text-muted-foreground text-[11px]">elegíveis de</span>
                        <span className="text-muted-foreground text-xs font-medium">
                          {formatNumber(item.estimatedSize)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>

                {segment && segment.exclusions.length > 0 ? (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
                      Quem fica de fora e por quê
                    </p>
                    <ul className="space-y-1">
                      {segment.exclusions.map((exclusion) => (
                        <li
                          key={exclusion.reason}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="text-muted-foreground truncate">{exclusion.reason}</span>
                          <span className="shrink-0 font-medium tabular-nums">
                            {formatNumber(exclusion.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                      A prévia de elegíveis e excluídos é obrigatória antes de liberar o disparo.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* 3 — Mensagem --------------------------------------------- */}
            {step.id === "mensagem" ? (
              <div className="space-y-3">
                {channel === "whatsapp" ? (
                  availableTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setTemplateId(template.id)}
                      aria-pressed={templateId === template.id}
                      className={cn(
                        "w-full rounded-lg p-3 text-left transition-all",
                        templateId === template.id
                          ? "bg-accent-soft ring-accent ring-2"
                          : "bg-muted/50 hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs font-semibold">
                          {template.name}
                        </span>
                        <Badge
                          variant={
                            template.status === "aprovado"
                              ? "success"
                              : template.status === "rejeitado"
                                ? "danger"
                                : "warning"
                          }
                          className="ml-auto"
                        >
                          {TEMPLATE_STATUS_LABEL[template.status]}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground mt-1 line-clamp-2 block text-[11px] leading-relaxed">
                        {template.body}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-[10px] capitalize">
                        {template.category}
                      </span>
                    </button>
                  ))
                ) : (
                  <>
                    {emailTemplates.map((template) => {
                      const active = template.versions.find(
                        (item) => item.id === template.activeVersionId,
                      );
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setTemplateId(template.id)}
                          aria-pressed={templateId === template.id}
                          disabled={!active}
                          className={cn(
                            "w-full rounded-lg p-3 text-left transition-all disabled:opacity-50",
                            templateId === template.id
                              ? "bg-accent-soft ring-accent ring-2"
                              : "bg-muted/50 hover:bg-muted",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Mail className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                            <span className="truncate text-xs font-semibold">{template.name}</span>
                            <Badge variant={active ? "success" : "warning"} className="ml-auto">
                              {active ? `v${active.version} publicada` : "sem versão publicada"}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground mt-1 block text-[11px]">
                            {template.description}
                          </span>
                        </button>
                      );
                    })}
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href="/email-studio">Criar um e-mail no Studio</Link>
                    </Button>
                  </>
                )}

                <div className="bg-muted/50 flex items-start gap-2 rounded-lg p-3">
                  <Switch
                    checked={abTest}
                    onCheckedChange={setAbTest}
                    className="mt-0.5"
                    aria-label="Teste A/B"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">Dividir em teste A/B</span>
                    <span className="text-muted-foreground block text-[11px] leading-relaxed">
                      Metade do público recebe cada variante. O resultado sai por taxa de resposta,
                      não por abertura.
                    </span>
                  </span>
                </div>
              </div>
            ) : null}

            {/* 4 — Envio e proteções ------------------------------------ */}
            {step.id === "envio" ? (
              <div className="space-y-5">
                <div>
                  <Label className="mb-2 block">Quando disparar</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "agora", label: "Assim que aprovado" },
                        { id: "agendar", label: "Agendar" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setScheduleMode(option.id)}
                        aria-pressed={scheduleMode === option.id}
                        className={cn(
                          "rounded-lg p-2.5 text-center text-xs font-medium transition-all",
                          scheduleMode === option.id
                            ? "bg-accent-soft ring-accent ring-2"
                            : "bg-muted/50 hover:bg-muted",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {scheduleMode === "agendar" ? (
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      className="mt-2 text-xs"
                      aria-label="Data e hora do disparo"
                    />
                  ) : null}
                </div>

                <div>
                  <Label className="mb-2 flex items-center gap-1.5">
                    <Gauge className="size-3.5" aria-hidden />
                    Velocidade
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[11px]">
                        Lote: {batchSize} mensagens
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={200}
                        step={10}
                        value={batchSize}
                        onChange={(event) => setBatchSize(Number(event.target.value))}
                        className="w-full accent-[hsl(var(--accent))]"
                        aria-label="Tamanho do lote"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[11px]">
                        Intervalo: {intervalMinutes} min
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={60}
                        step={5}
                        value={intervalMinutes}
                        onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                        className="w-full accent-[hsl(var(--accent))]"
                        aria-label="Intervalo entre lotes"
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                    Nesta velocidade, o disparo leva cerca de{" "}
                    <strong className="text-foreground">
                      {hoursToFinish < 1
                        ? `${Math.round(hoursToFinish * 60)} minutos`
                        : `${hoursToFinish.toFixed(1).replace(".", ",")} horas`}
                    </strong>
                    . Velocidade alta derruba a qualidade do número.
                  </p>
                </div>

                <div>
                  <Label className="mb-2 flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden />
                    Janela de envio
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={quietStart}
                      onChange={(event) => setQuietStart(Number(event.target.value))}
                      className="w-20 text-xs"
                      aria-label="Hora inicial"
                    />
                    <span className="text-muted-foreground text-xs">às</span>
                    <Input
                      type="number"
                      min={1}
                      max={23}
                      value={quietEnd}
                      onChange={(event) => setQuietEnd(Number(event.target.value))}
                      className="w-20 text-xs"
                      aria-label="Hora final"
                    />
                    <span className="text-muted-foreground text-[11px]">
                      horário local do contato
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="text-success size-3.5" aria-hidden />
                    Proteções
                  </Label>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-3">
                      <Switch
                        checked={requireConsent}
                        onCheckedChange={setRequireConsent}
                        className="mt-0.5"
                        aria-label="Exigir consentimento"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">
                          Exigir consentimento de marketing
                        </span>
                        <span className="text-muted-foreground block text-[11px] leading-relaxed">
                          Contatos sem consentimento saem do público antes da fila.
                        </span>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Switch
                        checked={respectSuppression}
                        onCheckedChange={setRespectSuppression}
                        className="mt-0.5"
                        aria-label="Respeitar supressão"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">
                          Respeitar lista de supressão
                        </span>
                        <span className="text-muted-foreground block text-[11px] leading-relaxed">
                          Descadastros, bounces permanentes e reclamações nunca recebem.
                        </span>
                      </span>
                    </li>
                  </ul>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[11px]">
                        Frequência: 1 a cada {frequencyCapDays} dias
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={30}
                        value={frequencyCapDays}
                        onChange={(event) => setFrequencyCapDays(Number(event.target.value))}
                        className="w-full accent-[hsl(var(--accent))]"
                        aria-label="Limite de frequência"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[11px]">
                        Cancelar se erro passar de {autoCancelErrorPct}%
                      </span>
                      <input
                        type="range"
                        min={2}
                        max={20}
                        value={autoCancelErrorPct}
                        onChange={(event) => setAutoCancelErrorPct(Number(event.target.value))}
                        className="w-full accent-[hsl(var(--accent))]"
                        aria-label="Cancelamento automático por erro"
                      />
                    </div>
                  </div>
                </div>

                {!requireConsent ? (
                  <Callout variant="warning" icon={<AlertTriangle />}>
                    Sem exigir consentimento, esta campanha só pode ser de **utilidade** — cobrança,
                    obrigação fiscal, aviso de serviço. Conteúdo promocional sem consentimento é
                    infração à LGPD.
                  </Callout>
                ) : null}
              </div>
            ) : null}

            {/* 5 — Revisão ---------------------------------------------- */}
            {step.id === "revisao" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Público elegível", value: formatNumber(audience), tone: "success" },
                    { label: "Excluídos", value: formatNumber(excluded), tone: "warning" },
                    {
                      label: "Custo estimado",
                      value: formatCurrencyCents(estimatedCost),
                      tone: "neutral",
                    },
                    {
                      label: "Duração do disparo",
                      value:
                        hoursToFinish < 1
                          ? `${Math.round(hoursToFinish * 60)} min`
                          : `${hoursToFinish.toFixed(1).replace(".", ",")} h`,
                      tone: "neutral",
                    },
                  ].map((item) => (
                    <div key={item.label} className="bg-muted/50 rounded-lg p-3">
                      <p className="text-muted-foreground text-[11px]">{item.label}</p>
                      <p
                        className={cn(
                          "figure mt-0.5 text-xl font-semibold",
                          item.tone === "success" && "text-success",
                          item.tone === "warning" && "text-warning",
                        )}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <ul className="space-y-2">
                  {[
                    { ok: true, label: `Canal: ${channel === "whatsapp" ? "WhatsApp" : "E-mail"}` },
                    { ok: true, label: `Segmento: ${segment?.name}` },
                    {
                      ok: channel !== "whatsapp" || whatsappTemplate?.status === "aprovado",
                      label: `Conteúdo: ${whatsappTemplate?.name ?? emailTemplate?.name ?? "—"}`,
                    },
                    {
                      ok: requireConsent,
                      label: requireConsent
                        ? "Consentimento verificado antes da fila"
                        : "Sem exigência de consentimento — só para utilidade",
                    },
                    { ok: respectSuppression, label: "Lista de supressão respeitada" },
                    {
                      ok: true,
                      label: `Janela de ${quietStart}h às ${quietEnd}h · 1 a cada ${frequencyCapDays} dias`,
                    },
                  ].map((check) => (
                    <li key={check.label} className="flex items-start gap-2 text-xs">
                      {check.ok ? (
                        <CheckCircle2
                          className="text-success mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                      ) : (
                        <AlertTriangle
                          className="text-warning mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                      )}
                      <span className={check.ok ? "" : "text-warning"}>{check.label}</span>
                    </li>
                  ))}
                </ul>

                {needsApproval ? (
                  <Callout variant="info" icon={<ShieldCheck />} title="Vai para aprovação">
                    {formatNumber(audience)} contatos ultrapassam o limite de 250 definido pela
                    política. A campanha é criada como <strong>Em aprovação</strong> e só dispara
                    depois da revisão.
                  </Callout>
                ) : (
                  <Callout variant="success" icon={<CheckCircle2 />}>
                    Público abaixo do limite de aprovação. Você mesmo pode liberar o disparo.
                  </Callout>
                )}
              </div>
            ) : null}

            {/* Navegação */}
            <div className="mt-6 flex items-center gap-2 pt-4 shadow-[inset_0_1px_0_0_hsl(var(--border))]">
              {currentError ? (
                <span className="text-warning flex items-center gap-1.5 text-[11px]">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {currentError}
                </span>
              ) : null}

              <div className="ml-auto flex items-center gap-2">
                {stepIndex > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setStepIndex(stepIndex - 1)}>
                    <ArrowLeft />
                    Voltar
                  </Button>
                ) : null}

                {stepIndex < STEPS.length - 1 ? (
                  <Button size="sm" onClick={next} disabled={!canAdvance}>
                    Continuar
                    <ArrowRight />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toast.info("Teste interno enviado", {
                          description:
                            "A lista interna recebe a mensagem com os valores de amostra. Nada conta nas métricas.",
                        })
                      }
                    >
                      <Send />
                      Enviar teste
                    </Button>
                    <Button size="sm" onClick={create}>
                      <Rocket />
                      {needsApproval ? "Enviar para aprovação" : "Criar campanha"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Prévia */}
        <Reveal index={2} className="min-w-0">
          <div className="lg:sticky lg:top-20">
            <div className="mb-3 flex items-center gap-2">
              <Target className="text-muted-foreground size-4" aria-hidden />
              <h2 className="font-display text-sm font-semibold tracking-tight">
                Como o contato vai ver
              </h2>
              <Tooltip content="As merge tags aparecem com valores de amostra, como no envio de teste.">
                <Badge variant="neutral" className="ml-auto">
                  amostra
                </Badge>
              </Tooltip>
            </div>

            {renderPreview()}

            {segment ? (
              <div className="bg-card shadow-card mt-4 rounded-lg p-4">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground text-[11px]">Do segmento ao elegível</span>
                  <span className="text-[11px] font-medium tabular-nums">
                    {formatPercent((audience / Math.max(segment.estimatedSize, 1)) * 100)}
                  </span>
                </div>
                <ProgressBar
                  value={(audience / Math.max(segment.estimatedSize, 1)) * 100}
                  tone="success"
                  label="Proporção de elegíveis"
                />
                <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                  {formatNumber(audience)} de {formatNumber(segment.estimatedSize)} contatos passam
                  por consentimento, supressão e limite de frequência.
                </p>
              </div>
            ) : null}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
