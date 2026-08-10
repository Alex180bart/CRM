"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  EmailDesignTemplate,
  Journey,
  MessageTemplate,
  Pipeline,
  RuleActionKind,
  RuleOperator,
  RuleTriggerKind,
  Tag,
  Team,
  User,
} from "@elora/core";
import {
  formatDuration,
  RULE_ACTION_LABEL,
  RULE_OPERATOR_LABEL,
  RULE_TRIGGER_EVENT,
  RULE_TRIGGER_LABEL,
} from "@elora/core";
import {
  Badge,
  Button,
  Eyebrow,
  Input,
  Label,
  Reveal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  cn,
} from "@elora/ui";
import {
  ArrowLeft,
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
  Plus,
  Route,
  Tag as TagIcon,
  Timer,
  Trash2,
  UserPlus,
  Zap,
  type LucideIcon,
  BadgeDollarSign,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

import { WhatsAppGlyph } from "@/lib/brand-icons";

/**
 * Compositor de automação.
 *
 * A tela é a própria frase sendo escrita: **quando** → **se** → **então**. O
 * trilho entre os passos só ganha cor quando o passo acima está completo, o que
 * transforma a validação em algo que se vê de longe, sem selo de erro no meio
 * do formulário.
 *
 * A configuração de cada gatilho e de cada ação é declarada em tabela e não em
 * `if`: acrescentar um tipo novo é acrescentar uma linha, e o formulário se
 * monta sozinho a partir dos dados reais do CRM (templates aprovados, tags,
 * jornadas, etapas do funil).
 */

/* Catálogo de campos ------------------------------------------------------- */

type FieldSource =
  | "templates_whatsapp"
  | "templates_email"
  | "tags"
  | "journeys"
  | "stages"
  | "pipelines"
  | "users"
  | "teams";

interface FieldSpec {
  key: string;
  label: string;
  kind: "texto" | "numero" | "selecao" | "longo";
  source?: FieldSource;
  options?: string[];
  placeholder?: string;
  hint?: string;
}

const TRIGGER_FIELDS: Record<RuleTriggerKind, FieldSpec[]> = {
  email_aberto: [{ key: "template", label: "E-mail", kind: "selecao", source: "templates_email" }],
  email_clicado: [
    { key: "template", label: "E-mail", kind: "selecao", source: "templates_email" },
    {
      key: "link",
      label: "Link",
      kind: "texto",
      placeholder: "qualquer",
      hint: "Deixe “qualquer” para reagir a qualquer link do e-mail.",
    },
  ],
  whatsapp_botao: [
    { key: "template", label: "Template", kind: "selecao", source: "templates_whatsapp" },
    { key: "botao", label: "Botão", kind: "texto", placeholder: "Quero a simulação" },
  ],
  whatsapp_palavra_chave: [
    {
      key: "palavras",
      label: "Palavras-chave",
      kind: "longo",
      placeholder: "cancelar, sair, parar",
      hint: "Separe por vírgula. A comparação ignora acentos e maiúsculas.",
    },
  ],
  formulario_respondido: [
    { key: "formulario", label: "Formulário", kind: "texto", placeholder: "Simulador de impostos" },
  ],
  campanha_entregue: [{ key: "campanha", label: "Campanha", kind: "texto" }],
  sem_resposta: [
    { key: "dias", label: "Dias sem resposta", kind: "numero", placeholder: "3" },
    { key: "etapa", label: "Etapa do funil", kind: "selecao", source: "stages" },
  ],
  tag_adicionada: [{ key: "tag", label: "Tag", kind: "selecao", source: "tags" }],
  etapa_alterada: [
    { key: "funil", label: "Funil", kind: "selecao", source: "pipelines" },
    { key: "etapa", label: "Etapa de destino", kind: "selecao", source: "stages" },
  ],
  contato_criado: [
    {
      key: "origem",
      label: "Origem",
      kind: "selecao",
      options: ["Qualquer", "Site", "WhatsApp", "Importação", "Indicação"],
    },
  ],
  /**
   * Os dois gatilhos comerciais não pedem parâmetro nenhum.
   *
   * "Aceitou uma proposta" e "teve a compra aprovada" já são específicos o
   * bastante: filtrar por produto aqui obrigaria a escolher um item do catálogo
   * na montagem da regra, e a regra deixaria de valer para o produto lançado
   * depois. Quem precisa desse recorte usa condição, que é onde recorte mora.
   */
  proposta_aceita: [],
  compra_aprovada: [],
};


const ACTION_FIELDS: Record<RuleActionKind, FieldSpec[]> = {
  enviar_whatsapp: [
    { key: "template", label: "Template aprovado", kind: "selecao", source: "templates_whatsapp" },
  ],
  enviar_email: [{ key: "template", label: "E-mail", kind: "selecao", source: "templates_email" }],
  criar_tarefa: [
    { key: "titulo", label: "Título da tarefa", kind: "texto", placeholder: "Ligar para o lead" },
    { key: "prazoHoras", label: "Prazo (horas)", kind: "numero", placeholder: "4" },
    { key: "responsavel", label: "Responsável", kind: "selecao", source: "users" },
  ],
  adicionar_tag: [{ key: "tag", label: "Tag", kind: "selecao", source: "tags" }],
  remover_tag: [{ key: "tag", label: "Tag", kind: "selecao", source: "tags" }],
  mover_etapa: [
    { key: "funil", label: "Funil", kind: "selecao", source: "pipelines" },
    { key: "etapa", label: "Etapa", kind: "selecao", source: "stages" },
  ],
  atribuir_dono: [
    {
      key: "regra",
      label: "Critério",
      kind: "selecao",
      options: ["menor_carga", "rodizio", "pessoa_fixa"],
    },
    { key: "time", label: "Time", kind: "selecao", source: "teams" },
  ],
  notificar_equipe: [
    { key: "time", label: "Time", kind: "selecao", source: "teams" },
    {
      key: "prioridade",
      label: "Prioridade",
      kind: "selecao",
      options: ["alta", "normal", "baixa"],
    },
  ],
  iniciar_jornada: [{ key: "jornada", label: "Jornada", kind: "selecao", source: "journeys" }],
  webhook: [
    { key: "url", label: "URL", kind: "texto", placeholder: "https://" },
    { key: "metodo", label: "Método", kind: "selecao", options: ["POST", "PUT"] },
  ],
  atualizar_campo: [
    { key: "campo", label: "Campo", kind: "texto", placeholder: "contato.score" },
    { key: "valor", label: "Novo valor", kind: "texto", placeholder: "+15" },
  ],
};

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

/** Atrasos oferecidos em minutos. Nomes humanos porque ninguém pensa em 2880. */
const DELAY_CHOICES = [0, 2, 15, 60, 240, 1440, 2880, 10080];

/** Campos do contato e do negócio disponíveis para condição. */
const CONDITION_FIELDS = [
  { field: "contato.ciclo_de_vida", label: "Ciclo de vida" },
  { field: "contato.score", label: "Score de engajamento" },
  { field: "contato.cidade", label: "Cidade" },
  { field: "contato.dono", label: "Responsável" },
  { field: "contato.consentimento", label: "Consentimento de marketing" },
  { field: "negocio.etapa", label: "Etapa do negócio" },
  { field: "negocio.valor", label: "Valor do negócio" },
  { field: "conversa.canal", label: "Canal da conversa" },
];

/* Estado ------------------------------------------------------------------- */

interface DraftCondition {
  id: string;
  field: string;
  operator: RuleOperator;
  value: string;
}

interface DraftAction {
  id: string;
  kind: RuleActionKind;
  config: Record<string, string>;
  delayMinutes: number;
}

export function RuleComposer({
  messageTemplates,
  emailTemplates,
  tags,
  journeys,
  pipelines,
  users,
  teams,
}: {
  messageTemplates: MessageTemplate[];
  emailTemplates: EmailDesignTemplate[];
  tags: Tag[];
  journeys: Journey[];
  pipelines: Pipeline[];
  users: User[];
  teams: Team[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerKind, setTriggerKind] = useState<RuleTriggerKind | null>(null);
  const [triggerConfig, setTriggerConfig] = useState<Record<string, string>>({});
  const [conditionMatch, setConditionMatch] = useState<"todas" | "qualquer">("todas");
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [actions, setActions] = useState<DraftAction[]>([]);
  const [frequencyDays, setFrequencyDays] = useState("7");
  const [seq, setSeq] = useState(0);

  /** Ids estáveis sem depender de `Date.now()` — o servidor e o cliente veriam valores diferentes. */
  function nextId(prefix: string) {
    setSeq((value) => value + 1);
    return `${prefix}_${seq + 1}`;
  }

  const options: Record<FieldSource, string[]> = useMemo(
    () => ({
      templates_whatsapp: messageTemplates
        .filter((template) => template.channel === "whatsapp" && template.status === "aprovado")
        .map((template) => template.name),
      templates_email: emailTemplates.map((template) => template.name),
      tags: tags.map((tag) => tag.name),
      journeys: journeys.map((journey) => journey.name),
      stages: pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => stage.name)),
      pipelines: pipelines.map((pipeline) => pipeline.name),
      users: users.map((user) => user.name),
      teams: teams.map((team) => team.name),
    }),
    [messageTemplates, emailTemplates, tags, journeys, pipelines, users, teams],
  );

  const triggerFields = triggerKind ? TRIGGER_FIELDS[triggerKind] : [];
  const triggerReady =
    triggerKind !== null && triggerFields.every((field) => (triggerConfig[field.key] ?? "").trim());
  const actionsReady =
    actions.length > 0 &&
    actions.every((action) =>
      ACTION_FIELDS[action.kind].every((field) => (action.config[field.key] ?? "").trim()),
    );
  const conditionsReady = conditions.every((condition) => condition.value.trim());
  const canPublish = Boolean(name.trim()) && triggerReady && actionsReady && conditionsReady;

  function updateAction(id: string, patch: Partial<DraftAction>) {
    setActions((current) =>
      current.map((action) => (action.id === id ? { ...action, ...patch } : action)),
    );
  }

  function addAction(kind: RuleActionKind) {
    setActions((current) => [...current, { id: nextId("a"), kind, config: {}, delayMinutes: 0 }]);
  }

  function publish() {
    toast.success(`“${name}” publicada`, {
      description: `Escutando ${RULE_TRIGGER_EVENT[triggerKind!]} · ${actions.length} ${
        actions.length === 1 ? "ação" : "ações"
      } · no máximo 1 vez a cada ${frequencyDays} dias por contato.`,
    });
    router.push("/automacoes");
  }

  /* Campo genérico --------------------------------------------------------- */

  function renderField(
    spec: FieldSpec,
    value: string,
    onChange: (next: string) => void,
    idPrefix: string,
  ) {
    const id = `${idPrefix}-${spec.key}`;
    const choices = spec.options ?? (spec.source ? options[spec.source] : []);

    return (
      <div key={spec.key} className="min-w-0 flex-1">
        <Label htmlFor={id} className="mb-1.5 block">
          {spec.label}
        </Label>

        {spec.kind === "selecao" ? (
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger id={id}>
              <SelectValue placeholder="Escolher" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice} value={choice}>
                  {choice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : spec.kind === "longo" ? (
          <Textarea
            id={id}
            rows={2}
            value={value}
            placeholder={spec.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <Input
            id={id}
            type={spec.kind === "numero" ? "number" : "text"}
            value={value}
            placeholder={spec.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        )}

        {spec.hint ? <p className="text-muted-foreground mt-1 text-[11px]">{spec.hint}</p> : null}
      </div>
    );
  }

  /* Passo com trilho ------------------------------------------------------- */

  function Step({
    index,
    eyebrow,
    title,
    hueFrom,
    hueTo,
    live,
    last,
    children,
  }: {
    index: number;
    eyebrow: string;
    title: string;
    hueFrom: number;
    hueTo: number;
    live: boolean;
    last?: boolean;
    children: React.ReactNode;
  }) {
    return (
      <Reveal index={index} className="flex gap-4">
        {/* Coluna do trilho */}
        <div className="flex w-8 shrink-0 flex-col items-center">
          <span
            className="figure flex size-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{
              backgroundColor: `hsl(${hueFrom} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
              color: `hsl(${hueFrom} 55% var(--hue-fg-l))`,
            }}
          >
            {index + 1}
          </span>
          {last ? null : (
            <span
              className="rule-rail mt-2 flex-1"
              data-live={live}
              style={
                {
                  "--rail-from": `${hueFrom} 70% 50%`,
                  "--rail-to": `${hueTo} 70% 50%`,
                  "--rail-index": index,
                } as React.CSSProperties
              }
              aria-hidden
            />
          )}
        </div>

        <div className="min-w-0 flex-1 pb-6">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="font-display mb-3 mt-0.5 text-sm font-semibold tracking-tight">{title}</h2>
          {children}
        </div>
      </Reveal>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[86rem] gap-6 px-5 py-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        {/* Identificação ---------------------------------------------------- */}
        <Reveal index={0} className="bg-card shadow-card mb-6 rounded-lg p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div>
              <Label htmlFor="rule-name" className="mb-1.5 block">
                Nome da automação
              </Label>
              <Input
                id="rule-name"
                value={name}
                placeholder="Clicou em “Quero a simulação”"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rule-desc" className="mb-1.5 block">
                Para que serve
              </Label>
              <Input
                id="rule-desc"
                value={description}
                placeholder="Cria a tarefa e avisa o consultor antes que o lead esfrie."
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
        </Reveal>

        {/* Quando ----------------------------------------------------------- */}
        <Step
          index={0}
          eyebrow="Quando"
          title="O que precisa acontecer"
          hueFrom={145}
          hueTo={38}
          live={triggerReady}
        >
          <ul className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(RULE_TRIGGER_LABEL) as RuleTriggerKind[]).map((kind) => {
              const meta = TRIGGER_META[kind];
              const Icon = meta.icon;
              const selected = triggerKind === kind;
              const isWhatsApp = kind === "whatsapp_botao" || kind === "whatsapp_palavra_chave";

              return (
                <li key={kind}>
                  <button
                    type="button"
                    onClick={() => {
                      setTriggerKind(kind);
                      setTriggerConfig({});
                    }}
                    aria-pressed={selected}
                    className={cn(
                      "bg-card shadow-card lift flex w-full items-center gap-2.5 rounded-lg p-3 text-left transition-all",
                      selected && "ring-accent shadow-raised ring-2",
                    )}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `hsl(${meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
                        color: `hsl(${meta.hue} 55% var(--hue-fg-l))`,
                      }}
                    >
                      {isWhatsApp ? (
                        <WhatsAppGlyph className="size-4" />
                      ) : (
                        <Icon className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {RULE_TRIGGER_LABEL[kind]}
                      </span>
                      <span className="text-muted-foreground block truncate font-mono text-[10px]">
                        {RULE_TRIGGER_EVENT[kind]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {triggerKind ? (
            <div className="bg-card shadow-card rule-slide-in flex flex-wrap gap-3 rounded-lg p-4">
              {triggerFields.map((spec) =>
                renderField(
                  spec,
                  triggerConfig[spec.key] ?? "",
                  (next) => setTriggerConfig((current) => ({ ...current, [spec.key]: next })),
                  "trigger",
                ),
              )}
            </div>
          ) : null}
        </Step>

        {/* Se ---------------------------------------------------------------- */}
        <Step
          index={1}
          eyebrow="Se"
          title="Filtros antes de agir"
          hueFrom={38}
          hueTo={218}
          live={triggerReady && conditionsReady}
        >
          <div className="bg-card shadow-card rounded-lg p-4">
            {conditions.length === 0 ? (
              <p className="text-muted-foreground mb-3 text-xs">
                Sem condições a regra roda em todo evento. Acrescente uma quando o gatilho sozinho
                for amplo demais.
              </p>
            ) : (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Precisa satisfazer</span>
                <Select
                  value={conditionMatch}
                  onValueChange={(value) => setConditionMatch(value as "todas" | "qualquer")}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">todas</SelectItem>
                    <SelectItem value="qualquer">qualquer uma</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-xs">das condições abaixo.</span>
              </div>
            )}

            <ul className="space-y-2">
              {conditions.map((condition) => (
                <li
                  key={condition.id}
                  className="bg-muted/50 rule-slide-in flex flex-wrap items-center gap-2 rounded-lg p-2.5"
                >
                  <Select
                    value={condition.field}
                    onValueChange={(value) =>
                      setConditions((current) =>
                        current.map((item) =>
                          item.id === condition.id ? { ...item, field: value } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-52 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map((field) => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) =>
                      setConditions((current) =>
                        current.map((item) =>
                          item.id === condition.id
                            ? { ...item, operator: value as RuleOperator }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(RULE_OPERATOR_LABEL) as RuleOperator[]).map((operator) => (
                        <SelectItem key={operator} value={operator}>
                          {RULE_OPERATOR_LABEL[operator]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={condition.value}
                    placeholder="valor"
                    className="h-8 w-40 text-xs"
                    aria-label="Valor da condição"
                    onChange={(event) =>
                      setConditions((current) =>
                        current.map((item) =>
                          item.id === condition.id ? { ...item, value: event.target.value } : item,
                        ),
                      )
                    }
                  />

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto"
                    aria-label="Remover condição"
                    onClick={() =>
                      setConditions((current) => current.filter((item) => item.id !== condition.id))
                    }
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              variant="ghost"
              size="xs"
              className="mt-2"
              onClick={() =>
                setConditions((current) => [
                  ...current,
                  {
                    id: nextId("c"),
                    field: CONDITION_FIELDS[0].field,
                    operator: "igual_a",
                    value: "",
                  },
                ])
              }
            >
              <Plus />
              Adicionar condição
            </Button>
          </div>
        </Step>

        {/* Então ------------------------------------------------------------ */}
        <Step
          index={2}
          eyebrow="Então"
          title="O que a automação faz"
          hueFrom={218}
          hueTo={218}
          live={actionsReady}
          last
        >
          <ul className="mb-3 space-y-2">
            {actions.map((action, position) => {
              const meta = ACTION_META[action.kind];
              const Icon = meta.icon;

              return (
                <li
                  key={action.id}
                  className="bg-card shadow-card rule-slide-in rounded-lg p-4"
                  style={{ animationDelay: `${position * 40}ms` }}
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `hsl(${meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
                        color: `hsl(${meta.hue} 55% var(--hue-fg-l))`,
                      }}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1 text-xs font-medium">
                      {RULE_ACTION_LABEL[action.kind]}
                    </span>

                    <Select
                      value={String(action.delayMinutes)}
                      onValueChange={(value) =>
                        updateAction(action.id, { delayMinutes: Number(value) })
                      }
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <Clock className="size-3" aria-hidden />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELAY_CHOICES.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {minutes === 0 ? "imediato" : `após ${formatDuration(minutes)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remover ${RULE_ACTION_LABEL[action.kind]}`}
                      onClick={() =>
                        setActions((current) => current.filter((item) => item.id !== action.id))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {ACTION_FIELDS[action.kind].map((spec) =>
                      renderField(
                        spec,
                        action.config[spec.key] ?? "",
                        (next) =>
                          updateAction(action.id, {
                            config: { ...action.config, [spec.key]: next },
                          }),
                        action.id,
                      ),
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="bg-card shadow-card rounded-lg p-4">
            <Eyebrow className="mb-2.5">Acrescentar ação</Eyebrow>
            <ul className="flex flex-wrap gap-2">
              {(Object.keys(RULE_ACTION_LABEL) as RuleActionKind[]).map((kind) => {
                const meta = ACTION_META[kind];
                const Icon = meta.icon;
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => addAction(kind)}
                      className="bg-muted/60 hover:bg-muted flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors"
                      style={{ color: `hsl(${meta.hue} 55% var(--hue-fg-l))` }}
                    >
                      <Icon className="size-3" aria-hidden />
                      <span className="text-foreground">{RULE_ACTION_LABEL[kind]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Step>
      </div>

      {/* Resumo ------------------------------------------------------------- */}
      <Reveal index={3} className="xl:sticky xl:top-20 xl:self-start">
        <div className="bg-card shadow-card rounded-lg p-5">
          <Eyebrow className="mb-2">A regra em uma frase</Eyebrow>
          <p className="text-sm leading-relaxed">
            {triggerKind ? (
              <>
                Quando o contato{" "}
                <mark className="bg-accent-soft text-accent-ink rounded px-1">
                  {RULE_TRIGGER_LABEL[triggerKind].toLowerCase()}
                </mark>
                {triggerFields.length && triggerConfig[triggerFields[0].key] ? (
                  <> ({triggerConfig[triggerFields[0].key]})</>
                ) : null}
                {conditions.length > 0 ? (
                  <>
                    , se{" "}
                    <span className="font-medium">
                      {conditionMatch === "todas" ? "todas" : "qualquer uma"}
                    </span>{" "}
                    das {conditions.length}{" "}
                    {conditions.length === 1 ? "condição bater" : "condições baterem"}
                  </>
                ) : null}
                {actions.length > 0 ? (
                  <>
                    , então{" "}
                    {actions
                      .map(
                        (action) =>
                          `${RULE_ACTION_LABEL[action.kind].toLowerCase()}${
                            action.delayMinutes > 0
                              ? ` após ${formatDuration(action.delayMinutes)}`
                              : ""
                          }`,
                      )
                      .join(", ")}
                    .
                  </>
                ) : (
                  <>, então… ainda falta dizer o que fazer.</>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                Escolha um gatilho para a frase começar a se formar.
              </span>
            )}
          </p>

          <div className="my-4 h-px bg-[hsl(var(--border))]" />

          <Label htmlFor="frequency" className="mb-1.5 block">
            No máximo 1 vez a cada
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="frequency"
              type="number"
              min={1}
              value={frequencyDays}
              className="w-20"
              onChange={(event) => setFrequencyDays(event.target.value)}
            />
            <span className="text-muted-foreground text-xs">dias, por contato</span>
          </div>
          <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
            Sem esse limite, quem toca cinco vezes no mesmo botão recebe cinco vezes a mesma coisa.
          </p>

          <div className="my-4 h-px bg-[hsl(var(--border))]" />

          <Eyebrow className="mb-2">Checagem</Eyebrow>
          <ul className="space-y-1.5">
            {[
              { ok: Boolean(name.trim()), label: "Automação tem nome" },
              { ok: triggerReady, label: "Gatilho escolhido e configurado" },
              { ok: conditionsReady, label: "Condições com valor preenchido" },
              { ok: actionsReady, label: "Ao menos uma ação completa" },
            ].map((check) => (
              <li key={check.label} className="flex items-start gap-2 text-xs">
                {check.ok ? (
                  <CheckCircle2 className="text-success mt-0.5 size-3.5 shrink-0" />
                ) : (
                  <CircleAlert className="text-muted-foreground/60 mt-0.5 size-3.5 shrink-0" />
                )}
                <span className={check.ok ? "" : "text-muted-foreground"}>{check.label}</span>
              </li>
            ))}
          </ul>

          {triggerKind ? (
            <p className="text-muted-foreground mt-4 text-[11px]">
              Escuta o evento{" "}
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">
                {RULE_TRIGGER_EVENT[triggerKind]}
              </code>
            </p>
          ) : null}

          <div className="mt-5 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/automacoes")}>
              <ArrowLeft />
              Voltar
            </Button>
            <Tooltip
              content={
                canPublish
                  ? "Passa a valer para os próximos eventos."
                  : "Complete a checagem acima para publicar."
              }
            >
              <span className="flex-1">
                <Button size="sm" className="w-full" disabled={!canPublish} onClick={publish}>
                  <Zap />
                  Publicar automação
                </Button>
              </span>
            </Tooltip>
          </div>

          {actions.length > 0 ? (
            <div className="mt-4">
              <Eyebrow className="mb-1.5">Ordem de execução</Eyebrow>
              <ol className="space-y-1">
                {[...actions]
                  .sort((a, b) => a.delayMinutes - b.delayMinutes)
                  .map((action) => (
                    <li
                      key={action.id}
                      className="text-muted-foreground flex items-center gap-1.5 text-[11px]"
                    >
                      <Badge variant="neutral">
                        {action.delayMinutes === 0 ? "agora" : formatDuration(action.delayMinutes)}
                      </Badge>
                      <span className="text-foreground truncate">
                        {RULE_ACTION_LABEL[action.kind]}
                      </span>
                    </li>
                  ))}
              </ol>
            </div>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}
