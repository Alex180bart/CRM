"use client";

import type { FlowNode, FlowPort } from "@crm/core";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Tooltip,
  cn,
} from "@crm/ui";
import { Info, Plus, Trash2 } from "lucide-react";

/**
 * Configuração do bloco de IA.
 *
 * O bloco genérico de chave/valor não serve aqui por um motivo concreto: na
 * classificação, **as intenções configuradas viram as saídas do bloco**. Editar
 * a lista de intenções num campo de texto separado por vírgula esconderia o
 * efeito mais importante da configuração — o fluxo ganhar ou perder ramos.
 *
 * O que fica gravado em `node.config` continua sendo o registro plano que o
 * documento de fluxo aceita; este componente só é a lente sobre ele.
 */

type AiTaskKind = "classificacao" | "extracao" | "resposta" | "resumo" | "triagem";

const TASK_META: Record<
  AiTaskKind,
  { label: string; description: string; producesBranches: boolean }
> = {
  classificacao: {
    label: "Classificar intenção",
    description:
      "O modelo escolhe uma das intenções da lista. Cada intenção vira uma saída do bloco.",
    producesBranches: true,
  },
  extracao: {
    label: "Extrair dados",
    description:
      "Lê a conversa e devolve os campos declarados. Campo não encontrado volta vazio, não inventado.",
    producesBranches: false,
  },
  resposta: {
    label: "Responder ao contato",
    description:
      "Redige a próxima mensagem a partir da base de conhecimento. Nada é enviado sem passar pelas guardas.",
    producesBranches: false,
  },
  resumo: {
    label: "Resumir a conversa",
    description: "Sintetiza o atendimento numa variável, útil antes de transferir para humano.",
    producesBranches: false,
  },
  triagem: {
    label: "Triar urgência",
    description: "Devolve baixa, normal, alta ou crítica. Cada nível vira uma saída.",
    producesBranches: true,
  },
};

const MODELS = [
  { id: "gemini-2.5-flash", label: "Flash — equilíbrio", hint: "US$ 0,30/1M entrada" },
  { id: "gemini-2.5-flash-lite", label: "Flash Lite — barato", hint: "US$ 0,10/1M entrada" },
];

/**
 * Ações que o modelo pode executar sozinho.
 *
 * Cada uma é uma ferramenta oferecida ao modelo dentro do bloco. A lista é
 * curta de propósito: ferramenta que ninguém revisa é ferramenta que age errado
 * em produção. `transferir_humano` fica ligada por padrão — um bot sem saída
 * para gente é a reclamação número um de quem atende.
 */
const TOOLS = [
  {
    id: "consultar_crm",
    label: "Consultar o CRM",
    description: "Ler dados do contato, do negócio e das tarefas antes de responder.",
  },
  {
    id: "buscar_conhecimento",
    label: "Buscar na base de conhecimento",
    description: "Procurar a resposta nos artigos publicados em vez de improvisar.",
  },
  {
    id: "criar_tarefa",
    label: "Criar tarefa",
    description: "Abrir tarefa para o consultor quando identificar algo que exige pessoa.",
  },
  {
    id: "agendar_retorno",
    label: "Agendar retorno",
    description: "Marcar horário na agenda do responsável.",
  },
  {
    id: "transferir_humano",
    label: "Transferir para humano",
    description: "Desistir e passar adiante quando não tiver confiança na resposta.",
  },
];

/** Triagem tem níveis fixos: são os mesmos do SLA, não uma lista livre. */
const TRIAGE_LEVELS = ["baixa", "normal", "alta", "critica"];

function readList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function toPortId(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

export function AiNodeConfig({
  node,
  readOnly,
  onChangeConfig,
  onChangeOutputs,
}: {
  node: FlowNode;
  readOnly: boolean;
  onChangeConfig: (key: string, value: string | number | boolean | string[]) => void;
  onChangeOutputs: (outputs: FlowPort[]) => void;
}) {
  const task = (String(node.config.tarefa ?? "classificacao") as AiTaskKind) ?? "classificacao";
  const meta = TASK_META[task] ?? TASK_META.classificacao;
  const intents = readList(node.config.intencoes);
  const fields = readList(node.config.campos);
  const tools = readList(node.config.acoes);
  const temperature = Number(node.config.temperatura ?? 0.3);
  const confidence = Number(node.config.confiancaMinima ?? 70);

  /**
   * Portas derivadas da tarefa.
   *
   * A saída de exceção fica sempre por último e nunca é gerada a partir da
   * lista: sem um caminho de falha o fluxo trava quando o modelo cai, e é
   * exatamente o momento em que menos se pode travar.
   */
  function syncOutputs(nextTask: AiTaskKind, nextIntents: string[]) {
    const fallback: FlowPort = { id: "erro", label: "Falha ou baixa confiança", fallback: true };

    if (nextTask === "classificacao") {
      const ports = nextIntents.map((intent) => ({ id: toPortId(intent), label: intent }));
      onChangeOutputs([...ports, { id: "outro", label: "Nenhuma das intenções" }, fallback]);
      return;
    }
    if (nextTask === "triagem") {
      onChangeOutputs([...TRIAGE_LEVELS.map((level) => ({ id: level, label: level })), fallback]);
      return;
    }
    onChangeOutputs([{ id: "ok", label: "Sucesso" }, fallback]);
  }

  function setIntents(next: string[]) {
    onChangeConfig("intencoes", next);
    if (meta.producesBranches) syncOutputs(task, next);
  }

  return (
    <div className="space-y-4 p-4">
      {/* Tarefa ------------------------------------------------------------ */}
      <div className="space-y-1.5">
        <Label htmlFor="ia-tarefa">O que a IA faz aqui</Label>
        <Select
          value={task}
          disabled={readOnly}
          onValueChange={(value) => {
            const next = value as AiTaskKind;
            onChangeConfig("tarefa", next);
            syncOutputs(next, intents);
          }}
        >
          <SelectTrigger id="ia-tarefa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TASK_META) as AiTaskKind[]).map((key) => (
              <SelectItem key={key} value={key}>
                {TASK_META[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-[11px] leading-relaxed">{meta.description}</p>
      </div>

      {/* Intenções (classificação) ----------------------------------------- */}
      {task === "classificacao" ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>Intenções</Label>
            <Tooltip content="Cada intenção vira uma saída do bloco no canvas.">
              <Info className="text-muted-foreground size-3.5" aria-hidden />
            </Tooltip>
          </div>

          <ul className="space-y-1.5">
            {intents.map((intent, index) => (
              <li key={`${intent}-${index}`} className="flex items-center gap-1.5">
                <Input
                  value={intent}
                  readOnly={readOnly}
                  className="h-8 text-xs"
                  aria-label={`Intenção ${index + 1}`}
                  onChange={(event) => {
                    const next = [...intents];
                    next[index] = event.target.value;
                    setIntents(next);
                  }}
                />
                {readOnly ? null : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remover intenção ${intent}`}
                    onClick={() => setIntents(intents.filter((_, item) => item !== index))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {readOnly ? null : (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIntents([...intents, `intenção ${intents.length + 1}`])}
            >
              <Plus />
              Acrescentar intenção
            </Button>
          )}

          {intents.length < 2 ? (
            <p className="text-warning text-[11px] leading-relaxed">
              Com menos de duas intenções não há o que classificar — o bloco sempre cairia na mesma
              saída.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Campos (extração) -------------------------------------------------- */}
      {task === "extracao" ? (
        <div className="space-y-1.5">
          <Label htmlFor="ia-campos">Campos a extrair</Label>
          <Textarea
            id="ia-campos"
            rows={3}
            readOnly={readOnly}
            value={fields.join("\n")}
            placeholder={"cnpj\ncompetencia\nvalor_do_das"}
            className="font-mono text-[11px]"
            onChange={(event) =>
              onChangeConfig(
                "campos",
                event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              )
            }
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Um por linha. Cada campo vira uma variável do fluxo com o mesmo nome.
          </p>
        </div>
      ) : null}

      {/* Instrução ---------------------------------------------------------- */}
      <div className="space-y-1.5">
        <Label htmlFor="ia-instrucao">Instrução</Label>
        <Textarea
          id="ia-instrucao"
          rows={4}
          readOnly={readOnly}
          value={String(node.config.instrucao ?? "")}
          placeholder="Leia a conversa e decida o que o contato quer. Se ele citar um valor de imposto, não confirme nem conteste — encaminhe."
          className="text-xs"
          onChange={(event) => onChangeConfig("instrucao", event.target.value)}
        />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Use <code className="bg-muted rounded px-1">{"{{contato.nome}}"}</code> e{" "}
          <code className="bg-muted rounded px-1">{"{{conversa.ultima_mensagem}}"}</code> para
          referenciar variáveis do fluxo.
        </p>
      </div>

      {/* Ações -------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <Label>Ações permitidas</Label>
        <ul className="space-y-1">
          {TOOLS.map((tool) => {
            const enabled = tools.includes(tool.id);
            return (
              <li key={tool.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md p-1.5 transition-colors",
                    !readOnly && "hover:bg-muted",
                    readOnly && "cursor-default",
                  )}
                >
                  <Checkbox
                    checked={enabled}
                    disabled={readOnly}
                    className="mt-0.5"
                    onCheckedChange={(checked) =>
                      onChangeConfig(
                        "acoes",
                        checked === true
                          ? [...tools, tool.id]
                          : tools.filter((item) => item !== tool.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">{tool.label}</span>
                    <span className="text-muted-foreground block text-[11px] leading-relaxed">
                      {tool.description}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {!tools.includes("transferir_humano") ? (
          <p className="text-warning text-[11px] leading-relaxed">
            Sem transferência para humano, o contato que a IA não resolver fica sem saída.
          </p>
        ) : null}
      </div>

      {/* Modelo e limites ---------------------------------------------------- */}
      <div className="space-y-1.5">
        <Label htmlFor="ia-modelo">Modelo</Label>
        <Select
          value={String(node.config.modelo ?? MODELS[0].id)}
          disabled={readOnly}
          onValueChange={(value) => onChangeConfig("modelo", value)}
        >
          <SelectTrigger id="ia-modelo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-[11px]">
          {MODELS.find((model) => model.id === String(node.config.modelo ?? MODELS[0].id))?.hint}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="ia-temperatura">Variação da resposta</Label>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {temperature.toFixed(2)}
          </span>
        </div>
        <input
          id="ia-temperatura"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={temperature}
          disabled={readOnly}
          className="accent-accent w-full"
          onChange={(event) => onChangeConfig("temperatura", Number(event.target.value))}
        />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {temperature <= 0.3
            ? "Baixa: mesma entrada tende à mesma saída. É o que se quer para classificar e extrair."
            : temperature <= 0.6
              ? "Média: alguma variação de redação, decisão ainda estável."
              : "Alta: bom para redigir, arriscado para decidir caminho do fluxo."}
        </p>
      </div>

      {meta.producesBranches ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="ia-confianca">Confiança mínima</Label>
            <span className="text-muted-foreground text-[11px] tabular-nums">{confidence}%</span>
          </div>
          <input
            id="ia-confianca"
            type="range"
            min={0}
            max={100}
            step={5}
            value={confidence}
            disabled={readOnly}
            className="accent-accent w-full"
            onChange={(event) => onChangeConfig("confiancaMinima", Number(event.target.value))}
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Abaixo disso o bloco sai pelo caminho de exceção em vez de escolher um ramo no chute.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="ia-custo">Custo máximo (centavos)</Label>
          <Input
            id="ia-custo"
            type="number"
            min={1}
            readOnly={readOnly}
            value={String(node.config.custoMaximoCentavos ?? 10)}
            className="text-xs"
            onChange={(event) => onChangeConfig("custoMaximoCentavos", Number(event.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ia-timeout">Timeout (segundos)</Label>
          <Input
            id="ia-timeout"
            type="number"
            min={1}
            readOnly={readOnly}
            value={String(node.config.timeoutSegundos ?? 12)}
            className="text-xs"
            onChange={(event) => onChangeConfig("timeoutSegundos", Number(event.target.value))}
          />
        </div>
      </div>

      {/* Saídas resultantes -------------------------------------------------- */}
      <div>
        <Label className="mb-1.5 block">Saídas deste bloco</Label>
        <ul className="space-y-1">
          {node.outputs.map((port) => (
            <li
              key={port.id}
              className="bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5"
            >
              <span className="truncate text-xs">{port.label}</span>
              <Badge variant={port.fallback ? "warning" : "neutral"}>
                {port.fallback ? "exceção" : "saída"}
              </Badge>
            </li>
          ))}
        </ul>
        {meta.producesBranches ? (
          <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
            As saídas acompanham a lista acima. Renomear uma intenção rompe a conexão que saía dela
            — reconecte no canvas.
          </p>
        ) : null}
      </div>
    </div>
  );
}
