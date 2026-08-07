"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  AiAgent,
  BotFlow,
  Queue,
  WebchatWidget,
  WebchatWidgetVersion,
  PrechatField,
  PrechatFieldKind,
  WidgetCorner,
  WidgetIcon,
  WidgetLauncher,
  WidgetPosition,
} from "@crm/core";
import {
  BOT_RUN_OPTIONS,
  buildEmbedSnippet,
  checkWidgetContrast,
  FLOW_STATUS_LABEL,
  formatDate,
  formatNumber,
  formatPercent,
  hasBlockingWidgetIssue,
  offsetIso,
  OUTSIDE_HOURS_LABEL,
  PRECHAT_FIELD_LABEL,
  startFlow,
  summarizeSchedule,
  validateWidget,
  WIDGET_CORNER_LABEL,
  WIDGET_LAUNCHER_LABEL,
  WIDGET_ICON_LABEL,
  WIDGET_POSITION_LABEL,
  weekdayLabel,
  type OutsideHoursBehavior,
} from "@crm/core";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Eyebrow,
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
} from "@crm/ui";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  Code2,
  Copy,
  Globe,
  History,
  Palette,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Metric, MetricStrip } from "@/components/shell/metric-strip";
import { SitePreview } from "./site-preview";
import { LauncherIcon } from "./launcher-icon";
import type { PreviewDevice, PreviewStage } from "./widget-preview";

/**
 * Editor do widget de webchat.
 *
 * O desenho segue o do E-mail Studio pelo mesmo motivo: quem configura precisa
 * ver o efeito enquanto mexe. A diferença é que aqui a prévia é o **produto**,
 * não uma aproximação — o widget que aparece à direita é o mesmo componente que
 * o visitante veria.
 *
 * Versão publicada é imutável, como fluxo e e-mail: o site do cliente carrega
 * uma versão, e mexer no rascunho não pode mudar o que já está no ar.
 */

/** Cores sugeridas: as da marca e alternativas que passam no contraste. */
const COLOR_PRESETS = [
  { hex: "#102850", label: "Azul Arena" },
  { hex: "#212D51", label: "Azul secundário" },
  { hex: "#1E7A5F", label: "Verde" },
  { hex: "#8A3FFC", label: "Roxo" },
  { hex: "#C2410C", label: "Laranja escuro" },
  { hex: "#B91C1C", label: "Vermelho" },
];

const FIELD_KINDS: PrechatFieldKind[] = ["texto", "email", "telefone", "selecao"];

/** Campos do contato que um campo do formulário pode alimentar. */
const MAPPING_TARGETS = [
  { value: "contato.nome", label: "Nome do contato" },
  { value: "contato.email", label: "E-mail" },
  { value: "contato.telefone", label: "Telefone" },
  { value: "contato.cargo", label: "Cargo" },
  { value: "campo.origem_detalhada", label: "Origem detalhada" },
  { value: "campo.regime_tributario", label: "Regime tributário" },
  { value: "", label: "Não gravar no cadastro" },
];

export function WidgetEditor({
  widget: initialWidget,
  queues,
  botFlows,
  agents,
  origin,
}: {
  widget: WebchatWidget;
  queues: Queue[];
  botFlows: BotFlow[];
  agents: AiAgent[];
  origin: string;
}) {
  const [widget, setWidget] = useState(initialWidget);
  const [viewVersionId, setViewVersionId] = useState(initialWidget.draftVersionId);
  const [stage, setStage] = useState<PreviewStage>("saudacao");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [publishOpen, setPublishOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [domainDraft, setDomainDraft] = useState("");
  const [sequence, setSequence] = useState(0);

  const version = widget.versions.find((item) => item.id === viewVersionId) ?? widget.versions[0]!;
  const readOnly = version.status !== "rascunho";

  const issues = useMemo(() => validateWidget(widget, version), [widget, version]);
  const blocked = hasBlockingWidgetIssue(issues);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "alerta");
  const contrast = checkWidgetContrast(version.appearance.brandColor);
  const selectedFlow = botFlows.find((flow) => flow.id === version.behavior.botFlowId);
  const selectedAgent = agents.find((agent) => agent.id === version.behavior.agentId);

  /**
   * As primeiras falas do fluxo escolhido.
   *
   * Sai da **versão publicada**, que é a que o widget executa. Mostrar o
   * rascunho aqui faria o editor prometer um começo de conversa que o visitante
   * não veria.
   */
  const flowOpening = useMemo(() => {
    if (!selectedFlow) return [];
    const published =
      selectedFlow.versions.find((item) => item.id === selectedFlow.activeVersionId) ??
      selectedFlow.versions.find((item) => item.status === "publicado");
    if (!published) return [];

    const state = startFlow(published.nodes, published.edges, BOT_RUN_OPTIONS);
    return state.entries
      .filter((entry) => entry.role === "bot")
      .slice(0, 3)
      .map((entry) => entry.text);
  }, [selectedFlow]);

  function updateVersion(updater: (current: WebchatWidgetVersion) => WebchatWidgetVersion) {
    setWidget((current) => ({
      ...current,
      versions: current.versions.map((item) => (item.id === version.id ? updater(item) : item)),
    }));
  }

  function patchAppearance(patch: Partial<WebchatWidgetVersion["appearance"]>) {
    updateVersion((current) => ({ ...current, appearance: { ...current.appearance, ...patch } }));
  }

  function patchMessages(patch: Partial<WebchatWidgetVersion["messages"]>) {
    updateVersion((current) => ({ ...current, messages: { ...current.messages, ...patch } }));
  }

  function patchBehavior(patch: Partial<WebchatWidgetVersion["behavior"]>) {
    updateVersion((current) => ({ ...current, behavior: { ...current.behavior, ...patch } }));
  }

  function patchPrivacy(patch: Partial<WebchatWidgetVersion["privacy"]>) {
    updateVersion((current) => ({ ...current, privacy: { ...current.privacy, ...patch } }));
  }

  function nextId(prefix: string) {
    setSequence((value) => value + 1);
    return `${prefix}_${sequence + 1}`;
  }

  function addDomain() {
    // Cola de URL inteira é o caso comum: quem copia da barra traz protocolo e
    // caminho. Guardar "https://site.com/contato" quebraria a comparação de host.
    const cleaned = domainDraft
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");

    if (!cleaned) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
      toast.error("Domínio inválido", { description: `"${cleaned}" não parece um domínio.` });
      return;
    }
    if (widget.allowedDomains.includes(cleaned)) {
      toast.info("Este domínio já está na lista.");
      setDomainDraft("");
      return;
    }

    setWidget((current) => ({
      ...current,
      allowedDomains: [...current.allowedDomains, cleaned],
    }));
    setDomainDraft("");
  }

  function publish() {
    if (blocked) {
      toast.error("Publicação bloqueada", {
        description: `${errors.length} ${errors.length === 1 ? "erro impede" : "erros impedem"} a publicação.`,
      });
      return;
    }

    const publishedAt = offsetIso({});
    const nextVersionNumber = Math.max(...widget.versions.map((item) => item.version)) + 1;

    setWidget((current) => ({
      ...current,
      activeVersionId: version.id,
      draftVersionId: `wgtv_novo_${nextVersionNumber}`,
      versions: [
        ...current.versions.map((item) =>
          item.id === version.id
            ? { ...item, status: "publicado" as const, publishedAt, changeNote }
            : item.status === "publicado"
              ? { ...item, status: "arquivado" as const }
              : item,
        ),
        // O rascunho novo nasce como cópia do que acabou de subir: a próxima
        // alteração parte do que está no ar, não de um formulário em branco.
        {
          ...version,
          id: `wgtv_novo_${nextVersionNumber}`,
          version: nextVersionNumber,
          status: "rascunho" as const,
          publishedAt: undefined,
          publishedBy: undefined,
          changeNote: undefined,
        },
      ],
    }));

    setViewVersionId(version.id);
    setPublishOpen(false);
    setChangeNote("");

    toast.success(`Versão ${version.version} publicada`, {
      description:
        "Os sites autorizados passam a carregar esta versão na próxima visita. Quem já está com o chat aberto termina na versão anterior.",
    });
  }

  const snippet = buildEmbedSnippet(widget, origin);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho do editor */}
      <div className="bg-surface shadow-inset-hairline flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Voltar para a lista">
          <Link href="/webchat">
            <ArrowLeft />
          </Link>
        </Button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display truncate text-sm font-semibold tracking-tight">
              {widget.name}
            </h2>
            <Badge variant={readOnly ? "success" : "neutral"}>
              v{version.version} · {FLOW_STATUS_LABEL[version.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground truncate text-[11px]">
            {widget.allowedDomains.length > 0
              ? widget.allowedDomains.join(" · ")
              : "Nenhum domínio autorizado"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <History />v{version.version}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Versões</DropdownMenuLabel>
              {[...widget.versions]
                .sort((a, b) => b.version - a.version)
                .map((item) => (
                  <DropdownMenuItem key={item.id} onSelect={() => setViewVersionId(item.id)}>
                    {item.id === version.id ? <Check /> : <span className="size-4" />}v
                    {item.version} · {FLOW_STATUS_LABEL[item.status]}
                    {item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setViewVersionId(widget.draftVersionId)}>
                Ir para o rascunho
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setEmbedOpen(true)}>
            <Code2 />
            Incorporar
          </Button>

          <Tooltip
            content={
              readOnly
                ? "Versão publicada é imutável. Troque para o rascunho para editar."
                : blocked
                  ? "Corrija os erros da checagem antes de publicar."
                  : "Publica esta versão nos domínios autorizados."
            }
          >
            <span>
              <Button size="sm" disabled={readOnly || blocked} onClick={() => setPublishOpen(true)}>
                <Rocket />
                Publicar
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>

      <MetricStrip className="shadow-inset-hairline border-b-0">
        <Metric label="aberturas (30 d)" value={formatNumber(widget.stats.opens30d)} />
        <Metric
          label="viraram conversa"
          value={formatPercent(widget.stats.conversionPct, 1)}
          tone={widget.stats.conversionPct >= 25 ? "success" : "neutral"}
          hint={`${formatNumber(widget.stats.conversations30d)} conversas`}
        />
        <Metric label="leads novos" value={formatNumber(widget.stats.leads30d)} tone="accent" />
        <Metric
          label="1ª resposta"
          value={`${widget.stats.medianFirstReplySeconds}s`}
          hint="mediana"
        />
        {widget.stats.csat ? (
          <Metric label="csat" value={widget.stats.csat.toFixed(1)} tone="success" />
        ) : null}
      </MetricStrip>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Configuração */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Tabs defaultValue="aparencia" className="flex min-h-0 flex-col">
            <TabsList className="shadow-inset-hairline bg-surface sticky top-0 z-10 px-4">
              <TabsTrigger value="aparencia" className="gap-1.5 py-2.5 text-xs">
                <Palette className="size-3.5" aria-hidden />
                Aparência
              </TabsTrigger>
              <TabsTrigger value="conversa" className="gap-1.5 py-2.5 text-xs">
                Mensagens
              </TabsTrigger>
              <TabsTrigger value="formulario" className="gap-1.5 py-2.5 text-xs">
                Formulário
              </TabsTrigger>
              <TabsTrigger value="atendimento" className="gap-1.5 py-2.5 text-xs">
                <Clock className="size-3.5" aria-hidden />
                Atendimento
              </TabsTrigger>
              <TabsTrigger value="privacidade" className="gap-1.5 py-2.5 text-xs">
                <ShieldCheck className="size-3.5" aria-hidden />
                Privacidade
              </TabsTrigger>
              <TabsTrigger value="dominios" className="gap-1.5 py-2.5 text-xs">
                <Globe className="size-3.5" aria-hidden />
                Domínios
                {widget.allowedDomains.length === 0 ? (
                  <Badge variant="danger">0</Badge>
                ) : (
                  <Badge variant="neutral">{widget.allowedDomains.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Aparência ------------------------------------------------- */}
            <TabsContent value="aparencia" className="m-0 space-y-4 p-4">
              <div>
                <Label className="mb-1.5 block">Cor da marca</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    value={version.appearance.brandColor}
                    disabled={readOnly}
                    onChange={(event) => patchAppearance({ brandColor: event.target.value })}
                    className="border-input h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                    aria-label="Escolher cor da marca"
                  />
                  <Input
                    value={version.appearance.brandColor}
                    readOnly={readOnly}
                    onChange={(event) => patchAppearance({ brandColor: event.target.value })}
                    className="w-28 font-mono text-xs uppercase"
                    aria-label="Cor em hexadecimal"
                  />
                  {COLOR_PRESETS.map((preset) => (
                    <Tooltip key={preset.hex} content={preset.label}>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => patchAppearance({ brandColor: preset.hex })}
                        className={cn(
                          "size-7 rounded-md transition-transform hover:scale-110",
                          version.appearance.brandColor.toUpperCase() === preset.hex &&
                            "ring-accent ring-2 ring-offset-2",
                        )}
                        style={{ backgroundColor: preset.hex }}
                        aria-label={preset.label}
                      />
                    </Tooltip>
                  ))}
                </div>

                {/* O veredito de contraste é calculado, não estimado. */}
                <div
                  className={cn(
                    "mt-2 flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] leading-relaxed",
                    contrast.verdict === "aprovado"
                      ? "bg-success-soft text-foreground"
                      : contrast.verdict === "limite"
                        ? "bg-warning-soft text-foreground"
                        : "bg-destructive-soft text-foreground",
                  )}
                >
                  {contrast.verdict === "aprovado" ? (
                    <Check className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : contrast.verdict === "limite" ? (
                    <TriangleAlert className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <CircleAlert
                      className="text-destructive mt-0.5 size-3.5 shrink-0"
                      aria-hidden
                    />
                  )}
                  <span>
                    {contrast.message}{" "}
                    <span className="text-muted-foreground">
                      A tinta do lançador será {contrast.ink}.
                    </span>
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Posição">
                  <Select
                    value={version.appearance.position}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      patchAppearance({ position: value as WidgetPosition })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WIDGET_POSITION_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Lançador">
                  <Select
                    value={version.appearance.launcher}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      patchAppearance({ launcher: value as WidgetLauncher })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WIDGET_LAUNCHER_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Cantos">
                  <Select
                    value={version.appearance.corner}
                    disabled={readOnly}
                    onValueChange={(value) => patchAppearance({ corner: value as WidgetCorner })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WIDGET_CORNER_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Iniciais do avatar" hint="Usadas quando não há logo.">
                  <Input
                    value={version.appearance.avatarInitials}
                    readOnly={readOnly}
                    maxLength={3}
                    onChange={(event) =>
                      patchAppearance({ avatarInitials: event.target.value.toUpperCase() })
                    }
                  />
                </Field>
              </div>

              {/* Ícone do lançador ------------------------------------------
                  A bolha é a peça de marca mais vista do site: aparece em toda
                  página, o tempo todo. Escolher o glifo — ou pôr o logo — é o
                  ajuste de identidade que mais rende aqui. */}
              <div>
                <Label className="mb-1.5 block">Ícone do lançador</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(WIDGET_ICON_LABEL) as WidgetIcon[]).map((option) => (
                    <Tooltip key={option} content={WIDGET_ICON_LABEL[option]}>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => patchAppearance({ icon: option })}
                        aria-pressed={version.appearance.icon === option}
                        aria-label={WIDGET_ICON_LABEL[option]}
                        className={cn(
                          "flex size-11 items-center justify-center rounded-lg transition-all",
                          version.appearance.icon === option
                            ? "ring-accent shadow-raised ring-2"
                            : "shadow-card",
                        )}
                        style={
                          {
                            backgroundColor: version.appearance.brandColor,
                            color: contrast.ink,
                            "--launcher-ink": version.appearance.brandColor,
                          } as React.CSSProperties
                        }
                      >
                        <LauncherIcon
                          icon={option}
                          logoUrl={version.appearance.logoUrl}
                          className="size-5"
                        />
                      </button>
                    </Tooltip>
                  ))}
                </div>

                {version.appearance.icon === "logo" ? (
                  <div className="mt-2">
                    <Input
                      value={version.appearance.logoUrl ?? ""}
                      readOnly={readOnly}
                      placeholder="https://seusite.com/logo.png"
                      aria-label="Endereço do logo"
                      className="text-xs"
                      onChange={(event) =>
                        patchAppearance({ logoUrl: event.target.value || undefined })
                      }
                    />
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                      Endereço de imagem, não arquivo: o upload com antivírus e URL assinada da
                      seção 11 ainda não existe, e um{" "}
                      <code className="bg-muted rounded px-1">blob:</code> morreria ao fechar a aba.
                      Use PNG ou SVG quadrado, de fundo transparente.
                    </p>
                    {!version.appearance.logoUrl ? (
                      <Callout variant="warning" className="mt-2">
                        Sem endereço, o lançador cai no balão — um quadrado vazio no canto do site
                        do cliente seria pior que um ícone genérico.
                      </Callout>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {version.appearance.launcher !== "bolha" ? (
                <Field
                  label="Rótulo do lançador"
                  hint="Frase curta. Acima de 30 caracteres a bolha vira faixa e come a página."
                >
                  <Input
                    value={version.appearance.launcherLabel}
                    readOnly={readOnly}
                    onChange={(event) => patchAppearance({ launcherLabel: event.target.value })}
                  />
                </Field>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Título do cabeçalho">
                  <Input
                    value={version.appearance.headerTitle}
                    readOnly={readOnly}
                    onChange={(event) => patchAppearance({ headerTitle: event.target.value })}
                  />
                </Field>
                <Field label="Subtítulo">
                  <Input
                    value={version.appearance.headerSubtitle}
                    readOnly={readOnly}
                    onChange={(event) => patchAppearance({ headerSubtitle: event.target.value })}
                  />
                </Field>
              </div>

              <ToggleRow
                label="Mostrar assinatura “Atendimento por CRM CF”"
                hint="Discreta, no pé da janela."
                checked={version.appearance.showBranding}
                disabled={readOnly}
                onChange={(checked) => patchAppearance({ showBranding: checked })}
              />
            </TabsContent>

            {/* Mensagens -------------------------------------------------- */}
            <TabsContent value="conversa" className="m-0 space-y-4 p-4">
              {/* Quem responde: fluxo de chatbot ou as mensagens fixas abaixo.
                  A escolha vem primeiro porque muda o que o resto significa —
                  com fluxo, a saudação vira só o texto antes de o bot assumir. */}
              <div className="bg-card shadow-card rounded-lg p-4">
                <Eyebrow className="mb-2">Quem responde</Eyebrow>

                {/**
                 * Três opções, não duas. O agente entrou como condutor
                 * alternativo ao fluxo, e a escolha é campo próprio
                 * (`responder`) em vez de deduzida da presença do
                 * identificador: assim dá para trocar de condutor sem apagar a
                 * configuração do outro, que é o que se faz ao experimentar.
                 */}
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => patchBehavior({ responder: "ninguem" })}
                    aria-pressed={version.behavior.responder === "ninguem"}
                    className={cn(
                      "bg-muted/50 rounded-lg p-3 text-left transition-all",
                      version.behavior.responder === "ninguem" &&
                        "ring-accent bg-card shadow-card ring-2",
                    )}
                  >
                    <span className="block text-xs font-medium">Só as mensagens fixas</span>
                    <span className="text-muted-foreground mt-0.5 block text-[11px] leading-relaxed">
                      A saudação abre a conversa e um atendente assume na hora.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() =>
                      patchBehavior({
                        responder: "fluxo",
                        botFlowId: version.behavior.botFlowId ?? botFlows[0]?.id,
                      })
                    }
                    aria-pressed={version.behavior.responder === "fluxo"}
                    className={cn(
                      "bg-muted/50 rounded-lg p-3 text-left transition-all",
                      version.behavior.responder === "fluxo" &&
                        "ring-accent bg-card shadow-card ring-2",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <Bot className="size-3.5" aria-hidden />
                      Um fluxo de chatbot
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[11px] leading-relaxed">
                      Caminho desenhado: menu, coleta e roteamento sempre iguais.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() =>
                      patchBehavior({
                        responder: "agente",
                        agentId: version.behavior.agentId ?? agents[0]?.id,
                      })
                    }
                    aria-pressed={version.behavior.responder === "agente"}
                    className={cn(
                      "bg-muted/50 rounded-lg p-3 text-left transition-all",
                      version.behavior.responder === "agente" &&
                        "ring-accent bg-card shadow-card ring-2",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      <Sparkles className="size-3.5" aria-hidden />
                      Um agente de IA
                    </span>
                    <span className="text-muted-foreground mt-0.5 block text-[11px] leading-relaxed">
                      Decide a cada mensagem: consulta a base e transfere sozinho.
                    </span>
                  </button>
                </div>

                {version.behavior.responder === "agente" ? (
                  <div className="mt-3">
                    <Label className="mb-1.5 block">Agente publicado</Label>
                    <div className="flex gap-2">
                      <Select
                        value={version.behavior.agentId ?? ""}
                        disabled={readOnly}
                        onValueChange={(value) => patchBehavior({ agentId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Escolha um agente" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Tooltip content="Abre a tela do agente para configurar e testar.">
                        <Button asChild variant="outline" size="sm">
                          <Link href="/agentes">
                            <Plus />
                            Configurar
                          </Link>
                        </Button>
                      </Tooltip>
                    </div>

                    {selectedAgent ? (
                      <>
                        <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
                          {selectedAgent.description}
                        </p>
                        {selectedAgent.status !== "ativo" || !selectedAgent.activeVersionId ? (
                          <Callout variant="warning" className="mt-2">
                            Este agente está pausado ou sem versão publicada. O widget só executa a
                            versão publicada de um agente ativo — enquanto isso, a conversa vai
                            direto para a fila.
                          </Callout>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}

                {version.behavior.responder === "fluxo" ? (
                  <div className="mt-3">
                    <Label className="mb-1.5 block">Fluxo publicado</Label>
                    <div className="flex gap-2">
                      <Select
                        value={version.behavior.botFlowId}
                        disabled={readOnly}
                        onValueChange={(value) => patchBehavior({ botFlowId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {botFlows.map((flow) => (
                            <SelectItem key={flow.id} value={flow.id}>
                              {flow.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Tooltip content="Abre o Chatbot Builder para criar ou ajustar um fluxo.">
                        <Button asChild variant="outline" size="sm">
                          <Link href="/chatbots">
                            <Plus />
                            Criar fluxo
                          </Link>
                        </Button>
                      </Tooltip>
                    </div>

                    {selectedFlow ? (
                      <>
                        <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
                          {selectedFlow.description}
                        </p>

                        {/* O que o fluxo de fato diz. Escolher fluxo pelo nome é
                            escolher no escuro — e o widget executa a versão
                            publicada, não o rascunho aberto no builder. */}
                        {flowOpening.length > 0 ? (
                          <div className="bg-muted/50 mt-2 rounded-lg p-2.5">
                            <Eyebrow className="mb-1.5">Começa assim</Eyebrow>
                            <ul className="space-y-1">
                              {flowOpening.map((line, index) => (
                                <li key={index} className="text-[11px] leading-relaxed">
                                  <span className="text-muted-foreground">{index + 1}.</span> {line}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <Callout variant="warning" className="mt-2">
                            Este fluxo não tem versão publicada. O widget só executa o que foi
                            publicado — enquanto isso, a conversa vai direto para a fila.
                          </Callout>
                        )}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Field
                label="Saudação"
                hint={
                  version.behavior.botFlowId
                    ? "Aparece antes de o fluxo assumir. Com chatbot, costuma valer deixá-la curta."
                    : "Primeira bolha, antes de o visitante escrever. Convida a dizer o assunto."
                }
              >
                <Textarea
                  rows={3}
                  value={version.messages.greeting}
                  readOnly={readOnly}
                  onChange={(event) => patchMessages({ greeting: event.target.value })}
                />
              </Field>

              <Field
                label="Atraso da saudação"
                hint="Zero abre junto com a janela. Alguns segundos parecem alguém digitando."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    disabled={readOnly}
                    value={version.messages.greetingDelaySeconds}
                    onChange={(event) =>
                      patchMessages({ greetingDelaySeconds: Number(event.target.value) })
                    }
                    className="accent-accent flex-1"
                    aria-label="Atraso da saudação em segundos"
                  />
                  <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                    {version.messages.greetingDelaySeconds}s
                  </span>
                </div>
              </Field>

              <Field label="Confirmação dentro do horário">
                <Textarea
                  rows={2}
                  value={version.messages.awayInside}
                  readOnly={readOnly}
                  onChange={(event) => patchMessages({ awayInside: event.target.value })}
                />
              </Field>

              <Field
                label="Fora do horário"
                hint="Diga quando você responde. “Estamos fechados” sem horário gera nova pergunta."
              >
                <Textarea
                  rows={2}
                  value={version.messages.awayOutside}
                  readOnly={readOnly}
                  onChange={(event) => patchMessages({ awayOutside: event.target.value })}
                />
              </Field>

              <Field label="Fila acima da capacidade">
                <Textarea
                  rows={2}
                  value={version.messages.queueBusy}
                  readOnly={readOnly}
                  onChange={(event) => patchMessages({ queueBusy: event.target.value })}
                />
              </Field>

              <Field label="Texto do campo de digitação">
                <Input
                  value={version.messages.placeholder}
                  readOnly={readOnly}
                  onChange={(event) => patchMessages({ placeholder: event.target.value })}
                />
              </Field>
            </TabsContent>

            {/* Formulário ------------------------------------------------- */}
            <TabsContent value="formulario" className="m-0 space-y-4 p-4">
              <ToggleRow
                label="Pedir dados antes de conversar"
                hint="Cada campo é atrito. Vale para telefone quando o time precisa retornar; raramente para mais de três."
                checked={version.behavior.prechatEnabled}
                disabled={readOnly}
                onChange={(checked) => patchBehavior({ prechatEnabled: checked })}
              />

              {version.behavior.prechatEnabled ? (
                <>
                  <Field label="Texto acima do formulário">
                    <Input
                      value={version.messages.prechatIntro}
                      readOnly={readOnly}
                      onChange={(event) => patchMessages({ prechatIntro: event.target.value })}
                    />
                  </Field>

                  <div>
                    <Eyebrow className="mb-2">Campos</Eyebrow>
                    <ul className="space-y-2">
                      {version.behavior.prechatFields.map((field, index) => (
                        <li key={field.id} className="bg-card shadow-card rounded-lg p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Badge variant="neutral">{index + 1}</Badge>
                            <Select
                              value={field.kind}
                              disabled={readOnly}
                              onValueChange={(value) =>
                                patchBehavior({
                                  prechatFields: version.behavior.prechatFields.map((item) =>
                                    item.id === field.id
                                      ? { ...item, kind: value as PrechatFieldKind }
                                      : item,
                                  ),
                                })
                              }
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_KINDS.map((kind) => (
                                  <SelectItem key={kind} value={kind}>
                                    {PRECHAT_FIELD_LABEL[kind]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <label className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px]">
                              <Checkbox
                                checked={field.required}
                                disabled={readOnly}
                                onCheckedChange={(checked) =>
                                  patchBehavior({
                                    prechatFields: version.behavior.prechatFields.map((item) =>
                                      item.id === field.id
                                        ? { ...item, required: checked === true }
                                        : item,
                                    ),
                                  })
                                }
                              />
                              obrigatório
                            </label>

                            {readOnly ? null : (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Remover campo ${field.label}`}
                                onClick={() =>
                                  patchBehavior({
                                    prechatFields: version.behavior.prechatFields.filter(
                                      (item) => item.id !== field.id,
                                    ),
                                  })
                                }
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                              value={field.label}
                              readOnly={readOnly}
                              placeholder="Rótulo"
                              className="text-xs"
                              aria-label="Rótulo do campo"
                              onChange={(event) =>
                                patchBehavior({
                                  prechatFields: version.behavior.prechatFields.map((item) =>
                                    item.id === field.id
                                      ? { ...item, label: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                            <Select
                              value={field.mapsTo ?? ""}
                              disabled={readOnly}
                              onValueChange={(value) =>
                                patchBehavior({
                                  prechatFields: version.behavior.prechatFields.map((item) =>
                                    item.id === field.id
                                      ? { ...item, mapsTo: value || undefined }
                                      : item,
                                  ),
                                })
                              }
                            >
                              <SelectTrigger className="text-xs">
                                <SelectValue placeholder="Grava em…" />
                              </SelectTrigger>
                              <SelectContent>
                                {MAPPING_TARGETS.map((target) => (
                                  <SelectItem key={target.value || "none"} value={target.value}>
                                    {target.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {field.kind === "selecao" ? (
                            <Textarea
                              rows={3}
                              className="mt-2 text-xs"
                              readOnly={readOnly}
                              placeholder={"Uma opção por linha"}
                              value={(field.options ?? []).join("\n")}
                              aria-label="Opções da seleção"
                              onChange={(event) =>
                                patchBehavior({
                                  prechatFields: version.behavior.prechatFields.map((item) =>
                                    item.id === field.id
                                      ? {
                                          ...item,
                                          options: event.target.value
                                            .split("\n")
                                            .map((line) => line.trim())
                                            .filter(Boolean),
                                        }
                                      : item,
                                  ),
                                })
                              }
                            />
                          ) : (
                            <Input
                              className="mt-2 text-xs"
                              readOnly={readOnly}
                              placeholder="Texto de exemplo dentro do campo"
                              value={field.placeholder ?? ""}
                              aria-label="Texto de exemplo"
                              onChange={(event) =>
                                patchBehavior({
                                  prechatFields: version.behavior.prechatFields.map((item) =>
                                    item.id === field.id
                                      ? { ...item, placeholder: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          )}
                        </li>
                      ))}
                    </ul>

                    {readOnly ? null : (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="mt-2"
                        onClick={() => {
                          const field: PrechatField = {
                            id: nextId("pf"),
                            kind: "texto",
                            label: "",
                            required: false,
                          };
                          patchBehavior({
                            prechatFields: [...version.behavior.prechatFields, field],
                          });
                          setStage("formulario");
                        }}
                      >
                        <Plus />
                        Acrescentar campo
                      </Button>
                    )}

                    {version.behavior.prechatFields.length > 3 ? (
                      <Callout variant="warning" className="mt-3">
                        {version.behavior.prechatFields.length} campos antes da primeira mensagem. O
                        visitante que ia perguntar o preço está preenchendo cadastro — a taxa de
                        abandono costuma dobrar a partir do quarto campo.
                      </Callout>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Sem formulário, a conversa abre direto e a identificação acontece durante o
                  atendimento — ou pela tabulação do copiloto, que extrai os dados do que foi dito.
                </p>
              )}
            </TabsContent>

            {/* Atendimento ------------------------------------------------ */}
            <TabsContent value="atendimento" className="m-0 space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fila que recebe as conversas">
                  <Select
                    value={version.behavior.queueId}
                    disabled={readOnly}
                    onValueChange={(value) => patchBehavior({ queueId: value })}
                  >
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

                <Field
                  label="Chatbot antes do humano"
                  hint="Opcional. Sem fluxo, entra direto na fila."
                >
                  <Select
                    value={version.behavior.botFlowId ?? "nenhum"}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      patchBehavior({ botFlowId: value === "nenhum" ? undefined : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem chatbot</SelectItem>
                      {botFlows.map((flow) => (
                        <SelectItem key={flow.id} value={flow.id}>
                          {flow.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div>
                <Label className="mb-1.5 block">Horário de atendimento</Label>
                <p className="text-muted-foreground mb-2 text-[11px]">
                  {summarizeSchedule(version)}
                </p>
                <ul className="space-y-1">
                  {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                    const day = version.behavior.schedule.find(
                      (item) => item.weekday === weekday,
                    ) ?? { weekday, from: null, to: null };
                    const open = Boolean(day.from && day.to);

                    return (
                      <li
                        key={weekday}
                        className="bg-muted/50 flex items-center gap-2 rounded-md px-2.5 py-1.5"
                      >
                        <Switch
                          checked={open}
                          disabled={readOnly}
                          aria-label={`Atender ${weekdayLabel(weekday)}`}
                          onCheckedChange={(checked) =>
                            patchBehavior({
                              schedule: [1, 2, 3, 4, 5, 6, 0].map((item) => {
                                const current = version.behavior.schedule.find(
                                  (entry) => entry.weekday === item,
                                ) ?? { weekday: item, from: null, to: null };
                                if (item !== weekday) return current;
                                return checked
                                  ? { weekday: item, from: "09:00", to: "18:00" }
                                  : { weekday: item, from: null, to: null };
                              }),
                            })
                          }
                        />
                        <span className="w-16 text-xs">{weekdayLabel(weekday)}</span>

                        {open ? (
                          <>
                            <Input
                              type="time"
                              value={day.from ?? ""}
                              readOnly={readOnly}
                              className="h-7 w-24 text-xs"
                              aria-label={`Abertura ${weekdayLabel(weekday)}`}
                              onChange={(event) =>
                                patchBehavior({
                                  schedule: version.behavior.schedule.map((item) =>
                                    item.weekday === weekday
                                      ? { ...item, from: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                            <span className="text-muted-foreground text-xs">até</span>
                            <Input
                              type="time"
                              value={day.to ?? ""}
                              readOnly={readOnly}
                              className="h-7 w-24 text-xs"
                              aria-label={`Fechamento ${weekdayLabel(weekday)}`}
                              onChange={(event) =>
                                patchBehavior({
                                  schedule: version.behavior.schedule.map((item) =>
                                    item.weekday === weekday
                                      ? { ...item, to: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">fechado</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <Field label="Fora do horário">
                <Select
                  value={version.behavior.outsideHours}
                  disabled={readOnly}
                  onValueChange={(value) =>
                    patchBehavior({ outsideHours: value as OutsideHoursBehavior })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OUTSIDE_HOURS_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Encerrar por inatividade (minutos)">
                  <Input
                    type="number"
                    min={5}
                    value={version.behavior.idleTimeoutMinutes}
                    readOnly={readOnly}
                    onChange={(event) =>
                      patchBehavior({ idleTimeoutMinutes: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>

              <ToggleRow
                label="Oferecer transcrição por e-mail ao encerrar"
                checked={version.behavior.offerTranscript}
                disabled={readOnly}
                onChange={(checked) => patchBehavior({ offerTranscript: checked })}
              />
            </TabsContent>

            {/* Privacidade ------------------------------------------------ */}
            <TabsContent value="privacidade" className="m-0 space-y-4 p-4">
              <ToggleRow
                label="Exigir aceite antes da primeira mensagem"
                hint="O texto exibido é o que fica gravado como prova de consentimento (seção 18)."
                checked={version.privacy.consentRequired}
                disabled={readOnly}
                onChange={(checked) => patchPrivacy({ consentRequired: checked })}
              />

              {version.privacy.consentRequired ? (
                <Field label="Texto do aceite">
                  <Textarea
                    rows={3}
                    value={version.privacy.consentText}
                    readOnly={readOnly}
                    onChange={(event) => patchPrivacy({ consentText: event.target.value })}
                  />
                </Field>
              ) : null}

              <Field label="Link da política de privacidade">
                <Input
                  value={version.privacy.privacyUrl ?? ""}
                  readOnly={readOnly}
                  placeholder="https://"
                  onChange={(event) =>
                    patchPrivacy({ privacyUrl: event.target.value || undefined })
                  }
                />
              </Field>

              <Field
                label="Retenção da transcrição (dias)"
                hint="Vale para quem não virou contato. Quem vira segue a política de retenção da organização."
              >
                <Input
                  type="number"
                  min={1}
                  value={version.privacy.transcriptRetentionDays}
                  readOnly={readOnly}
                  onChange={(event) =>
                    patchPrivacy({ transcriptRetentionDays: Number(event.target.value) })
                  }
                />
              </Field>
            </TabsContent>

            {/* Domínios --------------------------------------------------- */}
            <TabsContent value="dominios" className="m-0 space-y-4 p-4">
              <Callout variant="info" icon={<Globe />}>
                O trecho de incorporação é público — ele fica no HTML de quem visita o site. Quem
                autoriza é esta lista: o widget se recusa a carregar em domínio fora dela.
              </Callout>

              {readOnly ? null : (
                <div className="flex gap-2">
                  <Input
                    value={domainDraft}
                    placeholder="contabilidadefacilitada.com"
                    onChange={(event) => setDomainDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDomain();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={addDomain}>
                    <Plus />
                    Autorizar
                  </Button>
                </div>
              )}

              {widget.allowedDomains.length === 0 ? (
                <Callout variant="danger" icon={<CircleAlert />}>
                  Nenhum domínio autorizado. A publicação fica bloqueada — sem a lista, qualquer
                  site que copie o trecho abre conversas na sua fila.
                </Callout>
              ) : (
                <ul className="space-y-1.5">
                  {widget.allowedDomains.map((domain) => (
                    <li
                      key={domain}
                      className="bg-muted/50 flex items-center gap-2 rounded-md px-2.5 py-2"
                    >
                      <Globe className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{domain}</span>
                      {readOnly ? null : (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remover ${domain}`}
                          onClick={() =>
                            setWidget((current) => ({
                              ...current,
                              allowedDomains: current.allowedDomains.filter(
                                (item) => item !== domain,
                              ),
                            }))
                          }
                        >
                          <X />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <Eyebrow className="mb-1.5">Chave pública</Eyebrow>
                <code className="bg-muted text-muted-foreground block rounded-md px-2.5 py-2 font-mono text-[11px]">
                  {widget.embedKey}
                </code>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Prévia */}
        <div className="bg-surface-sunken hidden w-[26rem] shrink-0 flex-col overflow-y-auto p-4 xl:flex">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Eyebrow>Prévia ao vivo</Eyebrow>
            <div className="bg-muted flex items-center rounded-md p-0.5">
              {(
                [
                  { id: "fechado", label: "Fechado" },
                  { id: "saudacao", label: "Aberto" },
                  { id: "formulario", label: "Formulário" },
                  { id: "conversa", label: "Conversa" },
                  { id: "fora_do_horario", label: "Fechado hoje" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStage(option.id)}
                  aria-pressed={stage === option.id}
                  className={cn(
                    "rounded px-1.5 py-1 text-[10px] font-medium transition-colors",
                    stage === option.id
                      ? "bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <SitePreview
            version={version}
            stage={stage}
            device={device}
            onDeviceChange={setDevice}
            onStageChange={setStage}
          />

          {/* Checagem antes de publicar */}
          <div className="mt-4">
            <Eyebrow className="mb-1.5">Checagem antes de publicar</Eyebrow>
            {issues.length === 0 ? (
              <p className="text-success flex items-center gap-1.5 text-[11px]">
                <Check className="size-3.5" aria-hidden />
                Sem pendências.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {issues.map((issue) => (
                  <li
                    key={issue.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] leading-relaxed",
                      issue.severity === "erro"
                        ? "bg-destructive-soft text-foreground"
                        : "bg-warning-soft text-foreground",
                    )}
                  >
                    {issue.severity === "erro" ? (
                      <CircleAlert className="text-destructive mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <TriangleAlert className="text-warning mt-0.5 size-3.5 shrink-0" />
                    )}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Publicar --------------------------------------------------------- */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="w-[min(92vw,30rem)]">
          <DialogHeader>
            <DialogTitle>Publicar versão {version.version}</DialogTitle>
            <DialogDescription>
              A versão publicada é imutável. Quem já está com o chat aberto termina a conversa na
              versão anterior; visitas novas carregam esta.
            </DialogDescription>
          </DialogHeader>

          {warnings.length > 0 ? (
            <Callout variant="warning" className="mb-3">
              {warnings.length}{" "}
              {warnings.length === 1 ? "alerta não bloqueia" : "alertas não bloqueiam"} a
              publicação, mas valem uma olhada.
            </Callout>
          ) : null}

          <Label htmlFor="nota" className="mb-1.5 block">
            O que mudou
          </Label>
          <Textarea
            id="nota"
            rows={3}
            value={changeNote}
            placeholder="Lançador em barra e saudação mais curta."
            onChange={(event) => setChangeNote(event.target.value)}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={publish}>
              <Rocket />
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incorporar ------------------------------------------------------- */}
      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        <DialogContent className="w-[min(92vw,40rem)]">
          <DialogHeader>
            <DialogTitle>Incorporar no site</DialogTitle>
            <DialogDescription>
              Cole antes de <code className="font-mono text-[11px]">&lt;/head&gt;</code>. O script
              carrega de forma assíncrona e não bloqueia a página.
            </DialogDescription>
          </DialogHeader>

          <pre className="bg-muted text-foreground overflow-x-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed">
            {snippet}
          </pre>

          <Callout variant="neutral" className="mt-3">
            O widget só carrega em {widget.allowedDomains.length}{" "}
            {widget.allowedDomains.length === 1 ? "domínio autorizado" : "domínios autorizados"}. Em
            qualquer outro, o script se recusa a iniciar e registra a tentativa.
          </Callout>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(snippet);
                toast.success("Trecho copiado");
              }}
            >
              <Copy />
              Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {hint ? (
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{label}</p>
        {hint ? (
          <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
