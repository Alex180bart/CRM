"use client";

import { useMemo, useState } from "react";
import type { AgentKnowledgeSource, AiAgent, AiAgentVersion, Queue } from "@crm/core";
import {
  AGENT_EMOJI_LABEL,
  AGENT_KNOWLEDGE_MODE_LABEL,
  AGENT_LENGTH_LABEL,
  AGENT_OBJECTIVE_HINT,
  AGENT_OBJECTIVE_LABEL,
  AGENT_ROUTING_HINT,
  AGENT_ROUTING_LABEL,
  AGENT_TONE_HINT,
  AGENT_TONE_LABEL,
  AGENT_TOOLS,
  agentVersion,
  formatDate,
  hasBlockingAgentIssue,
  validateAgentVersion,
  type AgentEmojiUse,
  type AgentIdentity,
  type AgentMessageLength,
  type AgentObjective,
  type AgentRoutingMode,
  type AgentTone,
} from "@crm/core";
import {
  Badge,
  Button,
  Callout,
  Eyebrow,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusDot,
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
  BookOpen,
  CircleAlert,
  CircleCheck,
  Fingerprint,
  Gauge,
  ListChecks,
  ShieldAlert,
  Split,
  Target,
  Wrench,
} from "lucide-react";

import { AgentSimulator } from "./agent-simulator";
import { EvaluationPanel } from "./evaluation-panel";
import { KnowledgeManager } from "./knowledge-manager";

/**
 * Editor do agente.
 *
 * A configuração está dividida pelas **decisões** que alguém precisa tomar, não
 * pelos campos do tipo: quem ele é, o que persegue, o que pode ler, o que pode
 * fazer, quando desiste, quanto pode gastar e o que nunca faz. Cada aba é uma
 * pergunta que a operação já faz em voz alta ao desenhar um atendimento.
 *
 * Como no resto do repositório, a edição vive em estado local: não há camada de
 * escrita. O que **não** é teatro é a validação — ela roda sobre o que está na
 * tela e mostra na hora o que impediria a publicação.
 */
export function AgentEditor({
  agent,
  queues,
  knowledge,
}: {
  agent: AiAgent;
  queues: Queue[];
  knowledge: AgentKnowledgeSource[];
}) {
  const [versionId, setVersionId] = useState(agent.draftVersionId);
  const stored = agentVersion(agent, versionId) ?? agent.versions[0]!;

  const [version, setVersion] = useState<AiAgentVersion>(stored);
  const [touched, setTouched] = useState(false);
  /**
   * A biblioteca de fontes vive em estado local porque é aqui que ela cresce:
   * o que a rota de ingestão devolve não tem onde ser gravado ainda. Recarregar
   * a página perde o que foi lido — e é honesto que perca, em vez de a tela
   * fingir uma persistência que não existe.
   */
  const [sources, setSources] = useState<AgentKnowledgeSource[]>(knowledge);

  // Trocar de versão descarta a edição local: é o comportamento honesto quando
  // não há onde salvar, e evita levar campo de rascunho para dentro da publicada.
  function switchVersion(next: string) {
    const target = agentVersion(agent, next);
    if (!target) return;
    setVersionId(next);
    setVersion(target);
    setTouched(false);
  }

  function patch(mutate: (draft: AiAgentVersion) => AiAgentVersion) {
    setVersion((current) => mutate(structuredClone(current)));
    setTouched(true);
  }

  const issues = useMemo(() => validateAgentVersion(version, sources), [version, sources]);
  const blocked = hasBlockingAgentIssue(issues);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "alerta");

  const queueById = new Map(queues.map((queue) => [queue.id, queue]));
  const published = version.status === "publicado";

  return (
    <div className="mx-auto w-full max-w-[92rem] px-5 py-5">
      {/* Barra de versão --------------------------------------------------- */}
      <div className="bg-card shadow-card mb-4 flex flex-wrap items-center gap-3 rounded-lg p-3">
        <Select value={versionId} onValueChange={switchVersion}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agent.versions.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                v{item.version} — {item.status}
                {item.id === agent.activeVersionId ? " (no ar)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {agent.status === "ativo" && agent.activeVersionId === version.id ? (
          <Badge variant="success">
            <StatusDot tone="success" pulse />
            atendendo agora
          </Badge>
        ) : null}
        {touched ? <Badge variant="warning">alterado nesta tela</Badge> : null}
        {version.publishedAt ? (
          <span className="text-muted-foreground text-[11px]">
            publicada em {formatDate(version.publishedAt)}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {blocked ? (
            <Tooltip content={`${errors.length} erro(s) impedem a publicação`}>
              <Badge variant="danger">
                <CircleAlert aria-hidden />
                {errors.length} erro{errors.length > 1 ? "s" : ""}
              </Badge>
            </Tooltip>
          ) : (
            <Badge variant="success">
              <CircleCheck aria-hidden />
              sem erro
            </Badge>
          )}
          {warnings.length > 0 ? (
            <Badge variant="warning">{warnings.length} alerta(s)</Badge>
          ) : null}
          <Button size="sm" disabled title="A camada de escrita ainda não existe">
            Publicar
          </Button>
        </div>
      </div>

      {/**
       * A versão publicada é imutável, como fluxo, jornada e widget. Sem este
       * aviso, alguém edita a publicada, testa, e não entende por que o widget
       * no ar continua com o comportamento antigo.
       */}
      {published ? (
        <Callout variant="neutral" className="mb-4" icon={<ShieldAlert />}>
          Esta é a versão publicada e ela é imutável — é dela que o webchat depende agora. Para
          mudar o comportamento, edite o rascunho e publique.
        </Callout>
      ) : null}

      {issues.length > 0 ? (
        <div className="mb-4 space-y-2">
          {[...errors, ...warnings].map((issue) => (
            <Callout
              key={issue.id}
              variant={issue.severity === "erro" ? "danger" : "warning"}
              icon={issue.severity === "erro" ? <CircleAlert /> : <ShieldAlert />}
            >
              {issue.message}
            </Callout>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        {/* Configuração ---------------------------------------------------- */}
        <Tabs defaultValue="identidade">
          <TabsList className="h-auto w-full flex-wrap">
            <TabsTrigger value="identidade" className="px-2 py-1.5 text-xs">
              <Fingerprint className="size-3.5" aria-hidden />
              Identidade
            </TabsTrigger>
            <TabsTrigger value="missao" className="px-2 py-1.5 text-xs">
              <Target className="size-3.5" aria-hidden />
              Missão
            </TabsTrigger>
            <TabsTrigger value="conhecimento" className="px-2 py-1.5 text-xs">
              <BookOpen className="size-3.5" aria-hidden />
              Conhecimento
            </TabsTrigger>
            <TabsTrigger value="ferramentas" className="px-2 py-1.5 text-xs">
              <Wrench className="size-3.5" aria-hidden />
              Ferramentas
            </TabsTrigger>
            <TabsTrigger value="transferencia" className="px-2 py-1.5 text-xs">
              <Split className="size-3.5" aria-hidden />
              Transferência
            </TabsTrigger>
            <TabsTrigger value="limites" className="px-2 py-1.5 text-xs">
              <Gauge className="size-3.5" aria-hidden />
              Limites
            </TabsTrigger>
            <TabsTrigger value="avaliacao" className="px-2 py-1.5 text-xs">
              <ListChecks className="size-3.5" aria-hidden />
              Avaliação
            </TabsTrigger>
          </TabsList>

          {/* Identidade -------------------------------------------------- */}
          <TabsContent value="identidade">
            <Section title="Quem ele é" hint="É como o agente se apresenta e como escreve.">
              <Field label="Nome de apresentação" htmlFor="ag-nome">
                <Input
                  id="ag-nome"
                  value={version.identity.displayName}
                  onChange={(event) =>
                    patch((draft) => {
                      draft.identity.displayName = event.target.value;
                      return draft;
                    })
                  }
                />
              </Field>

              <Field label="Papel" htmlFor="ag-papel">
                <Input
                  id="ag-papel"
                  value={version.identity.role}
                  onChange={(event) =>
                    patch((draft) => {
                      draft.identity.role = event.target.value;
                      return draft;
                    })
                  }
                />
              </Field>

              <Field label="Tom" htmlFor="ag-tom">
                <Select
                  value={version.identity.tone}
                  onValueChange={(value) =>
                    patch((draft) => {
                      draft.identity.tone = value as AgentTone;
                      return draft;
                    })
                  }
                >
                  <SelectTrigger id="ag-tom">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGENT_TONE_LABEL) as AgentTone[]).map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {AGENT_TONE_LABEL[tone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Hint>{AGENT_TONE_HINT[version.identity.tone]}</Hint>
              </Field>

              <Field label="Primeira mensagem" htmlFor="ag-saudacao">
                <Textarea
                  id="ag-saudacao"
                  rows={3}
                  value={version.identity.greeting}
                  placeholder="Deixe vazio para o agente abrir falando do assunto que a pessoa trouxe."
                  onChange={(event) =>
                    patch((draft) => {
                      draft.identity.greeting = event.target.value;
                      return draft;
                    })
                  }
                />
                <Hint>
                  Saudação fixa não gasta chamada ao modelo. Vazia, o agente abre pelo contexto do
                  formulário — e custa um turno a mais.
                </Hint>
              </Field>

              <Toggle
                checked={version.identity.discloseAi}
                label="Assume que é uma inteligência artificial se perguntarem"
                hint="Desligar não é fingir ser pessoa: é só não levantar o assunto."
                onChange={(checked) =>
                  patch((draft) => {
                    draft.identity.discloseAi = checked;
                    return draft;
                  })
                }
              />
            </Section>

            <Section
              title="Rosto"
              hint="É a imagem que aparece ao lado de cada resposta, no widget e no Inbox."
            >
              <div className="flex items-start gap-3">
                <AgentAvatar identity={version.identity} size={44} />
                <div className="min-w-0 flex-1 space-y-3">
                  <Field label="Endereço da foto" htmlFor="ag-avatar">
                    <Input
                      id="ag-avatar"
                      value={version.identity.avatarUrl ?? ""}
                      placeholder="https://.../alice.png"
                      onChange={(event) =>
                        patch((draft) => {
                          draft.identity.avatarUrl = event.target.value.trim() || undefined;
                          return draft;
                        })
                      }
                    />
                    <Hint>
                      Endereço externo, não upload: não há armazenamento de mídia neste protótipo
                      (seção 11 é back-end). Vazio cai nas iniciais, que é melhor que um quadrado
                      quebrado na frente do visitante.
                    </Hint>
                  </Field>

                  <Field label="Iniciais" htmlFor="ag-iniciais">
                    <Input
                      id="ag-iniciais"
                      maxLength={2}
                      className="w-20"
                      value={version.identity.avatarInitials}
                      onChange={(event) =>
                        patch((draft) => {
                          draft.identity.avatarInitials = event.target.value
                            .toUpperCase()
                            .slice(0, 2);
                          return draft;
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            </Section>

            <Section
              title="Como ele escreve"
              hint="O tom é a atitude; isto é a forma. Separados porque juntos virariam vinte tons onde metade é combinação da outra."
            >
              <Field label="Comprimento da resposta" htmlFor="ag-comprimento">
                <Select
                  value={version.identity.style.messageLength}
                  onValueChange={(value) =>
                    patch((draft) => {
                      draft.identity.style.messageLength = value as AgentMessageLength;
                      return draft;
                    })
                  }
                >
                  <SelectTrigger id="ag-comprimento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGENT_LENGTH_LABEL) as AgentMessageLength[]).map((option) => (
                      <SelectItem key={option} value={option}>
                        {AGENT_LENGTH_LABEL[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Emoji" htmlFor="ag-emoji">
                <Select
                  value={version.identity.style.emojiUse}
                  onValueChange={(value) =>
                    patch((draft) => {
                      draft.identity.style.emojiUse = value as AgentEmojiUse;
                      return draft;
                    })
                  }
                >
                  <SelectTrigger id="ag-emoji">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGENT_EMOJI_LABEL) as AgentEmojiUse[]).map((option) => (
                      <SelectItem key={option} value={option}>
                        {AGENT_EMOJI_LABEL[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Toggle
                checked={version.identity.style.useFirstName}
                label="Trata pelo primeiro nome"
                onChange={(checked) =>
                  patch((draft) => {
                    draft.identity.style.useFirstName = checked;
                    return draft;
                  })
                }
              />

              <Toggle
                checked={version.identity.style.explainJargon}
                label="Traduz o jargão contábil"
                hint="Muda mais a percepção de qualidade que o tom: quem não conhece a sigla não pergunta, sai da conversa."
                onChange={(checked) =>
                  patch((draft) => {
                    draft.identity.style.explainJargon = checked;
                    return draft;
                  })
                }
              />

              <Field label="Assinatura ao encerrar" htmlFor="ag-assinatura">
                <Input
                  id="ag-assinatura"
                  value={version.identity.style.signature}
                  placeholder="Qualquer coisa, é só chamar por aqui."
                  onChange={(event) =>
                    patch((draft) => {
                      draft.identity.style.signature = event.target.value;
                      return draft;
                    })
                  }
                />
              </Field>
            </Section>
          </TabsContent>

          {/* Missão ------------------------------------------------------- */}
          <TabsContent value="missao">
            <Section title="O que ele persegue" hint="Muda o critério de quando parar.">
              <Field label="Objetivo" htmlFor="ag-objetivo">
                <Select
                  value={version.mission.objective}
                  onValueChange={(value) =>
                    patch((draft) => {
                      draft.mission.objective = value as AgentObjective;
                      return draft;
                    })
                  }
                >
                  <SelectTrigger id="ag-objetivo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGENT_OBJECTIVE_LABEL) as AgentObjective[]).map((objective) => (
                      <SelectItem key={objective} value={objective}>
                        {AGENT_OBJECTIVE_LABEL[objective]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Hint>{AGENT_OBJECTIVE_HINT[version.mission.objective]}</Hint>
              </Field>

              <LineList
                label="Ele atende"
                value={version.mission.scope}
                placeholder={"abertura de empresa\ntroca de contador"}
                onChange={(next) =>
                  patch((draft) => {
                    draft.mission.scope = next;
                    return draft;
                  })
                }
              />

              <LineList
                label="Ele não atende — transfere ao encontrar"
                value={version.mission.outOfScope}
                placeholder={"valor de mensalidade\nparecer sobre fiscalização"}
                onChange={(next) =>
                  patch((draft) => {
                    draft.mission.outOfScope = next;
                    return draft;
                  })
                }
              />

              <Field label="Critério de sucesso" htmlFor="ag-sucesso">
                <Textarea
                  id="ag-sucesso"
                  rows={3}
                  value={version.mission.successCriteria}
                  onChange={(event) =>
                    patch((draft) => {
                      draft.mission.successCriteria = event.target.value;
                      return draft;
                    })
                  }
                />
              </Field>
            </Section>
          </TabsContent>

          {/* Conhecimento -------------------------------------------------- */}
          <TabsContent value="conhecimento">
            <Section
              title="O que ele pode afirmar"
              hint="A indexação com pgvector é da seção 16.2 e é trabalho de back-end. O que existe hoje é busca léxica sobre estes artigos."
            >
              <Field label="Modo" htmlFor="ag-modo">
                <Select
                  value={version.knowledge.mode}
                  onValueChange={(value) =>
                    patch((draft) => {
                      draft.knowledge.mode = value as AiAgentVersion["knowledge"]["mode"];
                      return draft;
                    })
                  }
                >
                  <SelectTrigger id="ag-modo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(AGENT_KNOWLEDGE_MODE_LABEL) as Array<
                        keyof typeof AGENT_KNOWLEDGE_MODE_LABEL
                      >
                    ).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {AGENT_KNOWLEDGE_MODE_LABEL[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Hint>
                  {version.knowledge.mode === "somente_base"
                    ? "Fora da base, ele não sabe — e transfere. É o modo certo para assunto onde errar custa dinheiro do cliente."
                    : "Pode usar conhecimento geral do ofício para explicar conceito, nunca para afirmar valor, alíquota ou data."}
                </Hint>
              </Field>

              <KnowledgeManager
                sources={sources}
                selectedIds={version.knowledge.sourceIds}
                readOnly={published}
                onToggle={(id, enabled) =>
                  patch((draft) => {
                    draft.knowledge.sourceIds = enabled
                      ? [...draft.knowledge.sourceIds, id]
                      : draft.knowledge.sourceIds.filter((item) => item !== id);
                    return draft;
                  })
                }
                onAdd={(source) => {
                  setSources((current) => [source, ...current]);
                  // Fonte recém-lida entra ligada: quem acabou de colar o link
                  // quer usá-la. Pendente não entra — ligar o que não tem texto
                  // só produziria busca vazia.
                  if (source.status === "pronto") {
                    patch((draft) => {
                      draft.knowledge.sourceIds = [...draft.knowledge.sourceIds, source.id];
                      return draft;
                    });
                  } else {
                    setTouched(true);
                  }
                }}
                onRemove={(id) => {
                  setSources((current) => current.filter((source) => source.id !== id));
                  patch((draft) => {
                    draft.knowledge.sourceIds = draft.knowledge.sourceIds.filter(
                      (item) => item !== id,
                    );
                    return draft;
                  });
                }}
              />

              <Toggle
                checked={version.knowledge.citeSources}
                label="Citar o artigo de onde veio a resposta"
                hint="Ajuda quem audita a conversa a conferir sem procurar."
                onChange={(checked) =>
                  patch((draft) => {
                    draft.knowledge.citeSources = checked;
                    return draft;
                  })
                }
              />
            </Section>
          </TabsContent>

          {/* Ferramentas --------------------------------------------------- */}
          <TabsContent value="ferramentas">
            <Section
              title="O que ele pode fazer"
              hint="Leitura executa na hora. Escrita nunca executa sozinha aqui: vira pedido que uma pessoa confirma no Inbox (seção 16.4)."
            >
              <ul className="space-y-2">
                {AGENT_TOOLS.map((tool) => {
                  const policy = version.tools.find((item) => item.toolId === tool.id);
                  const enabled = policy?.enabled ?? false;

                  return (
                    <li
                      key={tool.id}
                      className={cn(
                        "rounded-lg p-2.5 transition-colors",
                        enabled ? "bg-muted/60" : "bg-muted/20",
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-2">
                        <Switch
                          checked={enabled}
                          className="mt-0.5"
                          onCheckedChange={(checked) =>
                            patch((draft) => {
                              const existing = draft.tools.find((item) => item.toolId === tool.id);
                              if (existing) existing.enabled = checked;
                              else
                                draft.tools.push({
                                  toolId: tool.id,
                                  enabled: checked,
                                  requiresConfirmation: tool.impact === "escrita",
                                });
                              return draft;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{tool.label}</span>
                            <Badge variant={tool.impact === "escrita" ? "warning" : "neutral"}>
                              {tool.impact}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground block text-[11px] leading-relaxed">
                            {tool.description}
                          </span>
                        </span>
                      </label>

                      {enabled && tool.impact === "escrita" ? (
                        <label className="mt-2 flex cursor-pointer items-center gap-2 pl-8 text-[11px]">
                          <Switch
                            checked={policy?.requiresConfirmation ?? true}
                            onCheckedChange={(checked) =>
                              patch((draft) => {
                                const existing = draft.tools.find(
                                  (item) => item.toolId === tool.id,
                                );
                                if (existing) existing.requiresConfirmation = checked;
                                return draft;
                              })
                            }
                          />
                          <span className={policy?.requiresConfirmation ? "" : "text-warning"}>
                            {policy?.requiresConfirmation
                              ? "Uma pessoa confirma antes de gravar"
                              : "Grava sem ninguém conferir"}
                          </span>
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Section>
          </TabsContent>

          {/* Transferência ------------------------------------------------- */}
          <TabsContent value="transferencia">
            <Section
              title="Quando ele desiste"
              hint="Transferir não é falha do agente: é o resultado correto quando o assunto sai do escopo."
            >
              <Field label="Como o destino é decidido" htmlFor="ag-roteamento">
                <Select
                  value={version.handoff.routing}
                  onValueChange={(value) =>
                    patch((draft) => {
                      draft.handoff.routing = value as AgentRoutingMode;
                      return draft;
                    })
                  }
                >
                  <SelectTrigger id="ag-roteamento">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(AGENT_ROUTING_LABEL) as AgentRoutingMode[]).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {AGENT_ROUTING_LABEL[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Hint>{AGENT_ROUTING_HINT[version.handoff.routing]}</Hint>
              </Field>

              {version.handoff.routing !== "regras" ? (
                <div className="space-y-1.5">
                  <Label>Setores que a IA pode escolher</Label>
                  <ul className="space-y-1">
                    {queues.map((queue) => {
                      const all = version.handoff.queueIds.length === 0;
                      const enabled = all || version.handoff.queueIds.includes(queue.id);

                      return (
                        <li key={queue.id}>
                          <label className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded-md p-1.5 transition-colors">
                            <Switch
                              checked={enabled}
                              className="mt-0.5"
                              onCheckedChange={(checked) =>
                                patch((draft) => {
                                  // Lista vazia significa "todas". Ao desmarcar
                                  // a primeira, ela precisa virar a lista real
                                  // menos aquela — senão o clique não faz nada.
                                  const current =
                                    draft.handoff.queueIds.length === 0
                                      ? queues.map((item) => item.id)
                                      : draft.handoff.queueIds;

                                  draft.handoff.queueIds = checked
                                    ? [...current, queue.id]
                                    : current.filter((id) => id !== queue.id);
                                  return draft;
                                })
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium">{queue.name}</span>
                              <span className="text-muted-foreground block text-[11px] leading-relaxed">
                                {queue.description}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <Hint>
                    É pela <strong>descrição</strong> que o agente escolhe, não pelo nome — nome de
                    fila é abreviação interna. Se a descrição não disser o que aquele setor resolve,
                    o roteamento vira adivinhação.
                  </Hint>
                </div>
              ) : null}

              <Field label="Fila padrão" htmlFor="ag-fila">
                <Select
                  value={version.handoff.defaultQueueId}
                  onValueChange={(value) =>
                    patch((draft) => {
                      draft.handoff.defaultQueueId = value;
                      return draft;
                    })
                  }
                >
                  <SelectTrigger id="ag-fila">
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

              <div className="space-y-1.5">
                <Label>
                  Regras de encaminhamento
                  {version.handoff.routing === "automatico" ? " (ignoradas neste modo)" : ""}
                </Label>
                <ul className="space-y-2">
                  {version.handoff.rules.map((rule) => (
                    <li key={rule.id} className="bg-muted/50 rounded-lg p-2.5">
                      <p className="text-[11px] leading-relaxed">
                        <span className="text-muted-foreground">Se </span>
                        {rule.when}
                      </p>
                      <p className="mt-1 text-[11px] font-medium">
                        → {queueById.get(rule.queueId)?.name ?? rule.queueId}
                      </p>
                    </li>
                  ))}
                </ul>
                <Hint>
                  A condição é lida pelo modelo; a fila é resolvida pela aplicação. É o que impede
                  uma fila inventada de mandar a conversa para lugar nenhum.
                </Hint>
              </div>

              <Toggle
                checked={version.handoff.transferOnRequest}
                label="Transfere quando o contato pede uma pessoa"
                hint="Ignorar o pedido é a reclamação número um de quem conversa com bot."
                onChange={(checked) =>
                  patch((draft) => {
                    draft.handoff.transferOnRequest = checked;
                    return draft;
                  })
                }
              />
              <Toggle
                checked={version.handoff.transferOnUncertainty}
                label="Transfere quando a confiança fica abaixo do piso"
                onChange={(checked) =>
                  patch((draft) => {
                    draft.handoff.transferOnUncertainty = checked;
                    return draft;
                  })
                }
              />
              <Toggle
                checked={version.handoff.summarize}
                label="Manda resumo para quem assume"
                hint="Sem ele, quem pega a conversa relê tudo — o custo que o agente deveria poupar."
                onChange={(checked) =>
                  patch((draft) => {
                    draft.handoff.summarize = checked;
                    return draft;
                  })
                }
              />
            </Section>
          </TabsContent>

          {/* Limites e guardas --------------------------------------------- */}
          <TabsContent value="limites">
            <Section title="Freios" hint="Os tetos valem por conversa, não por turno.">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Máximo de turnos" htmlFor="ag-turnos">
                  <Input
                    id="ag-turnos"
                    type="number"
                    min={2}
                    value={String(version.limits.maxTurns)}
                    onChange={(event) =>
                      patch((draft) => {
                        draft.limits.maxTurns = Number(event.target.value);
                        return draft;
                      })
                    }
                  />
                </Field>
                <Field label="Ferramentas por turno" htmlFor="ag-ferr">
                  <Input
                    id="ag-ferr"
                    type="number"
                    min={0}
                    value={String(version.limits.maxToolCallsPerTurn)}
                    onChange={(event) =>
                      patch((draft) => {
                        draft.limits.maxToolCallsPerTurn = Number(event.target.value);
                        return draft;
                      })
                    }
                  />
                </Field>
                <Field label="Teto de custo (¢)" htmlFor="ag-custo">
                  <Input
                    id="ag-custo"
                    type="number"
                    min={1}
                    value={String(version.limits.costCeilingCents)}
                    onChange={(event) =>
                      patch((draft) => {
                        draft.limits.costCeilingCents = Number(event.target.value);
                        return draft;
                      })
                    }
                  />
                </Field>
                <Field label="Piso de confiança" htmlFor="ag-piso">
                  <Input
                    id="ag-piso"
                    type="number"
                    min={0}
                    max={100}
                    value={String(version.guards.confidenceFloor)}
                    onChange={(event) =>
                      patch((draft) => {
                        draft.guards.confidenceFloor = Number(event.target.value);
                        return draft;
                      })
                    }
                  />
                </Field>
              </div>

              <LineList
                label="Assuntos proibidos"
                value={version.guards.forbiddenTopics}
                onChange={(next) =>
                  patch((draft) => {
                    draft.guards.forbiddenTopics = next;
                    return draft;
                  })
                }
              />

              <LineList
                label="Nunca pede"
                value={version.guards.neverAsk}
                onChange={(next) =>
                  patch((draft) => {
                    draft.guards.neverAsk = next;
                    return draft;
                  })
                }
              />

              <Field label="O que ele diz quando não sabe" htmlFor="ag-fallback">
                <Textarea
                  id="ag-fallback"
                  rows={3}
                  value={version.guards.fallbackMessage}
                  onChange={(event) =>
                    patch((draft) => {
                      draft.guards.fallbackMessage = event.target.value;
                      return draft;
                    })
                  }
                />
              </Field>
            </Section>
          </TabsContent>

          {/* Avaliação ------------------------------------------------------ */}
          <TabsContent value="avaliacao">
            <Section
              title="Conjunto de avaliação"
              hint="Seção 16.4: casos que rodam antes de publicar. Roda de verdade — é o que permite responder se a próxima versão do prompt melhorou ou piorou, com evidência em vez de impressão."
            >
              <EvaluationPanel agentId={agent.id} version={stored} readOnly={published} />
            </Section>
          </TabsContent>
        </Tabs>

        {/* Simulador --------------------------------------------------------- */}
        <div className="min-w-0">
          <AgentSimulator agentId={agent.id} version={stored} queues={queues} stale={touched} />
        </div>
      </div>
    </div>
  );
}

/* Peças da tela -------------------------------------------------------------- */

/**
 * Rosto do agente.
 *
 * A foto vem do endereço que a organização informou — host desconhecido em
 * tempo de build, então o otimizador do Next não se aplica, como no logo do
 * lançador do webchat. Sem endereço, as iniciais: quadrado quebrado ao lado de
 * cada resposta é pior que duas letras.
 */
export function AgentAvatar({ identity, size = 32 }: { identity: AgentIdentity; size?: number }) {
  if (identity.avatarUrl) {
    return (
      // O host da imagem é da organização e desconhecido em tempo de build, então
      // o otimizador do Next não se aplica.
      <img
        src={identity.avatarUrl}
        alt=""
        aria-hidden
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="bg-primary/10 text-primary flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {identity.avatarInitials || "IA"}
    </span>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card shadow-card mt-3 rounded-lg p-4">
      <Eyebrow className="mb-1">{title}</Eyebrow>
      {hint ? (
        <p className="text-muted-foreground mb-3 text-[11px] leading-relaxed">{hint}</p>
      ) : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-[11px] leading-relaxed">{children}</p>;
}

function Toggle({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded-md p-1.5 transition-colors">
      <Switch checked={checked} className="mt-0.5" onCheckedChange={onChange} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs">{label}</span>
        {hint ? (
          <span className="text-muted-foreground block text-[11px] leading-relaxed">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

/** Lista de linhas — um item por linha, que é como se pensa escopo e proibição. */
function LineList({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea
        rows={Math.min(Math.max(value.length + 1, 3), 8)}
        value={value.join("\n")}
        placeholder={placeholder}
        className="text-xs"
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          )
        }
      />
    </div>
  );
}
