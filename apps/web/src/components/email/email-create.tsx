"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AiEmailDraft,
  AiEmailObjective,
  AiEmailTone,
  BrandKit,
  EmailBlock,
  EmailDesignTemplate,
  EmailModule,
  EmailTemplateVersion,
} from "@elora/core";
import {
  AI_EMAIL_OBJECTIVE_LABEL,
  AI_EMAIL_TONE_LABEL,
  CURRENT_USER_ID,
  ORG_ID,
  offsetIso,
} from "@elora/core";
import {
  Badge,
  Button,
  Callout,
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
  cn,
} from "@elora/ui";
import { ArrowLeft, FileCode2, LayoutTemplate, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { EmailEditor } from "./email-editor";

/**
 * Criação de e-mail.
 *
 * Três caminhos, e a escolha entre eles é de fato uma escolha de trabalho, não
 * de gosto: quem tem o texto na cabeça dita o briefing e deixa a IA estruturar;
 * quem recebeu um HTML pronto da agência cola e não mexe; quem vai montar bloco
 * a bloco começa de um esqueleto. Os três desembocam no mesmo editor — o que
 * muda é só o ponto de partida.
 */

type Mode = "ia" | "html" | "nativo";

const MODES: Array<{
  id: Mode;
  label: string;
  description: string;
  icon: typeof Sparkles;
  hue: number;
}> = [
  {
    id: "ia",
    label: "Com IA",
    description: "Você descreve o que precisa dizer; volta assunto, texto e chamada montados.",
    icon: Sparkles,
    hue: 280,
  },
  {
    id: "html",
    label: "Colar HTML",
    description: "E-mail que já veio pronto de fora. Entra como bloco único, sem reescrita.",
    icon: FileCode2,
    hue: 190,
  },
  {
    id: "nativo",
    label: "Montar do zero",
    description: "Esqueleto com cabeçalho, corpo e rodapé de marca. Você compõe o resto.",
    icon: LayoutTemplate,
    hue: 218,
  },
];

const AUDIENCE_SUGGESTIONS = [
  "Clientes de Simples Nacional",
  "Leads que pediram simulação",
  "Alunos dos cursos",
  "Clientes de Lucro Presumido",
];

/** Estrutura mínima de um e-mail: preâmbulo de marca e rodapé com descadastro. */
function frameBlocks(brand: BrandKit, body: EmailBlock[]): EmailBlock[] {
  return [
    {
      id: "blk_novo_topo",
      kind: "imagem",
      source: `${brand.logoText}.png`,
      alt: "Contabilidade Facilitada",
      ratio: "16:9",
      locked: true,
    },
    ...body,
    {
      id: "blk_novo_rodape",
      kind: "rodape",
      address: brand.footerAddress,
      legal: brand.footerLegal,
      unsubscribeLabel: "Cancelar inscrição",
      locked: true,
    },
  ] as EmailBlock[];
}

/** Converte o rascunho do modelo em documento de blocos. */
function blocksFromDraft(draft: AiEmailDraft, brand: BrandKit): EmailBlock[] {
  const body: EmailBlock[] = [
    {
      id: "blk_novo_titulo",
      kind: "texto",
      content: draft.headline,
      align: "esquerda",
      scale: "titulo",
    },
    ...draft.paragraphs.map((paragraph, index) => ({
      id: `blk_novo_p${index + 1}`,
      kind: "texto" as const,
      content: paragraph,
      align: "esquerda" as const,
      scale: "corpo" as const,
    })),
    {
      id: "blk_novo_cta",
      kind: "botao",
      label: draft.ctaLabel,
      href: draft.ctaHref,
      align: "centro",
      variant: "primario",
    },
  ];

  if (draft.closing) {
    body.push({
      id: "blk_novo_fecho",
      kind: "texto",
      content: draft.closing,
      align: "esquerda",
      scale: "legenda",
    });
  }

  return frameBlocks(brand, body);
}

function blankBlocks(brand: BrandKit): EmailBlock[] {
  return frameBlocks(brand, [
    {
      id: "blk_novo_titulo",
      kind: "texto",
      content: "Título do e-mail",
      align: "esquerda",
      scale: "titulo",
    },
    {
      id: "blk_novo_p1",
      kind: "texto",
      content: "Primeiro parágrafo. Entregue a informação principal aqui.",
      align: "esquerda",
      scale: "corpo",
    },
    {
      id: "blk_novo_cta",
      kind: "botao",
      label: "Falar com o time",
      href: "https://contabilidadefacilitada.com/",
      align: "centro",
      variant: "primario",
    },
  ] as EmailBlock[]);
}

function htmlBlocks(html: string, brand: BrandKit): EmailBlock[] {
  return frameBlocks(brand, [{ id: "blk_novo_html", kind: "html", html } as EmailBlock]);
}

/** Monta o rascunho que o editor recebe. Fora do editor não existe persistência. */
function draftTemplate(input: {
  name: string;
  subject: string;
  preheader: string;
  blocks: EmailBlock[];
  brandKitId: string;
}): EmailDesignTemplate {
  const version: EmailTemplateVersion = {
    id: "ver_novo_1",
    templateId: "tpl_novo",
    version: 1,
    status: "rascunho",
    subject: input.subject,
    preheader: input.preheader,
    blocks: input.blocks,
    changeNote: "Rascunho criado agora. Nada foi publicado.",
  };

  return {
    id: "tpl_novo",
    organizationId: ORG_ID,
    name: input.name,
    description: "Rascunho novo — publique para valer.",
    category: "campanha",
    brandKitId: input.brandKitId,
    versions: [version],
    // Sem versão ativa de propósito: nada foi publicado ainda.
    draftVersionId: version.id,
    ownerId: CURRENT_USER_ID,
    stats: {
      sends30d: 0,
      deliveredPct: 0,
      openPct: 0,
      clickPct: 0,
      unsubscribePct: 0,
      bouncePct: 0,
    },
    createdAt: offsetIso({}),
    updatedAt: offsetIso({}),
  };
}

export function EmailCreate({
  brandKits,
  modules,
}: {
  brandKits: BrandKit[];
  modules: EmailModule[];
}) {
  const router = useRouter();
  const brand = brandKits.find((kit) => kit.isDefault) ?? brandKits[0]!;

  const [mode, setMode] = useState<Mode>("ia");
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState("");
  const [objective, setObjective] = useState<AiEmailObjective>("apresentar_servico");
  const [tone, setTone] = useState<AiEmailTone>("profissional");
  const [html, setHtml] = useState("");
  const [running, setRunning] = useState(false);
  const [template, setTemplate] = useState<EmailDesignTemplate | null>(null);
  const [aiMeta, setAiMeta] = useState<AiEmailDraft["meta"] | null>(null);

  async function generateWithAi() {
    if (brief.trim().length < 12) {
      toast.error("Descreva o e-mail com um pouco mais de detalhe.");
      return;
    }

    setRunning(true);
    try {
      const response = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, objective, tone, audience }),
      });

      const payload = (await response.json()) as
        AiEmailDraft | { error: { code: string; message: string } };

      if (!response.ok || "error" in payload) {
        const message =
          "error" in payload ? payload.error.message : "A redação do e-mail não pôde ser feita.";
        toast.error("Não deu para gerar o e-mail", { description: message });
        return;
      }

      setAiMeta(payload.meta);
      setTemplate(
        draftTemplate({
          name: name.trim() || payload.subject,
          subject: payload.subject,
          preheader: payload.preheader,
          blocks: blocksFromDraft(payload, brand),
          brandKitId: brand.id,
        }),
      );
      toast.success("Rascunho pronto", {
        description: "Revise cada bloco antes de publicar. O texto veio de um modelo, não de você.",
      });
    } catch {
      toast.error("A chamada ao modelo falhou", {
        description: "Verifique a conexão e tente de novo.",
      });
    } finally {
      setRunning(false);
    }
  }

  function startFromHtml() {
    if (html.trim().length < 20) {
      toast.error("Cole o HTML do e-mail antes de continuar.");
      return;
    }
    setTemplate(
      draftTemplate({
        name: name.trim() || "E-mail em HTML",
        subject: "",
        preheader: "",
        blocks: htmlBlocks(html.trim(), brand),
        brandKitId: brand.id,
      }),
    );
  }

  function startBlank() {
    setTemplate(
      draftTemplate({
        name: name.trim() || "E-mail sem título",
        subject: "",
        preheader: "",
        blocks: blankBlocks(brand),
        brandKitId: brand.id,
      }),
    );
  }

  if (template) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {aiMeta ? (
          <div className="bg-surface shadow-inset-hairline flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[11px]">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="text-accent size-3.5" aria-hidden />
              Rascunho gerado por modelo
            </span>
            <span className="text-muted-foreground">{aiMeta.model}</span>
            <span className="text-muted-foreground tabular-nums">
              {aiMeta.inputTokens + aiMeta.outputTokens} tokens ·{" "}
              {(aiMeta.latencyMs / 1000).toFixed(1)} s · US${" "}
              {(aiMeta.costUsdCents / 100).toFixed(4)}
            </span>
            <span className="text-muted-foreground">prompt {aiMeta.promptVersion}</span>
            {aiMeta.repaired ? <Badge variant="warning">saída reparada</Badge> : null}
          </div>
        ) : null}
        <EmailEditor template={template} brandKits={brandKits} modules={modules} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[64rem] px-5 py-6">
      <Reveal index={0} className="mb-5">
        <div className="bg-card shadow-card rounded-lg p-5">
          <Label htmlFor="email-name" className="mb-1.5 block">
            Nome interno do e-mail
          </Label>
          <Input
            id="email-name"
            value={name}
            placeholder="Migração de regime — julho"
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-muted-foreground mt-1.5 text-[11px]">
            É o nome que aparece na lista do Studio. O destinatário nunca vê.
          </p>
        </div>
      </Reveal>

      {/* Escolha do caminho */}
      <Reveal index={1} className="mb-5">
        <Eyebrow className="mb-2">Como quer começar</Eyebrow>
        <ul className="grid gap-3 md:grid-cols-3">
          {MODES.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.id;

            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => setMode(option.id)}
                  aria-pressed={selected}
                  className={cn(
                    "bg-card shadow-card lift h-full w-full rounded-lg p-4 text-left transition-all",
                    selected && "ring-accent shadow-raised ring-2",
                  )}
                >
                  <span
                    className="mb-2.5 flex size-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: `hsl(${option.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
                      color: `hsl(${option.hue} 55% var(--hue-fg-l))`,
                    }}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-display block text-sm font-semibold tracking-tight">
                    {option.label}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                    {option.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Reveal>

      {/* Configuração do caminho escolhido */}
      <Reveal index={2}>
        <div className="bg-card shadow-card rounded-lg p-5">
          {mode === "ia" ? (
            <>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="objective" className="mb-1.5 block">
                    Objetivo
                  </Label>
                  <Select
                    value={objective}
                    onValueChange={(value) => setObjective(value as AiEmailObjective)}
                  >
                    <SelectTrigger id="objective">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AI_EMAIL_OBJECTIVE_LABEL) as AiEmailObjective[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {AI_EMAIL_OBJECTIVE_LABEL[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tone" className="mb-1.5 block">
                    Tom
                  </Label>
                  <Select value={tone} onValueChange={(value) => setTone(value as AiEmailTone)}>
                    <SelectTrigger id="tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(AI_EMAIL_TONE_LABEL) as AiEmailTone[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {AI_EMAIL_TONE_LABEL[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Label htmlFor="audience" className="mb-1.5 block">
                Para quem
              </Label>
              <Input
                id="audience"
                value={audience}
                placeholder="Clientes de Simples Nacional com faturamento acima de R$ 30 mil"
                onChange={(event) => setAudience(event.target.value)}
              />
              <div className="mb-4 mt-1.5 flex flex-wrap gap-1.5">
                {AUDIENCE_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setAudience(suggestion)}
                    className="bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-[11px] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              <Label htmlFor="brief" className="mb-1.5 block">
                O que o e-mail precisa dizer
              </Label>
              <Textarea
                id="brief"
                rows={5}
                value={brief}
                placeholder="A partir de agosto o comparativo de regime sai em 48 horas em vez de uma semana. Quero avisar quem já pediu simulação e não fechou, e convidar para agendar uma conversa."
                onChange={(event) => setBrief(event.target.value)}
              />
              <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">
                Escreva como falaria para um colega. Valores e prazos citados aqui entram no texto
                como estão — o que não estiver, o modelo não inventa.
              </p>

              <Callout variant="info" className="mt-4">
                O rascunho vem estruturado, mas não revisado. Assunto, número e link passam pela sua
                conferência antes de publicar.
              </Callout>

              <Button className="mt-4" disabled={running} onClick={generateWithAi}>
                {running ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {running ? "Redigindo…" : "Gerar rascunho"}
              </Button>
            </>
          ) : mode === "html" ? (
            <>
              <Label htmlFor="html" className="mb-1.5 block">
                HTML do e-mail
              </Label>
              <Textarea
                id="html"
                rows={12}
                value={html}
                placeholder="<table>…</table>"
                className="font-mono text-[11px]"
                onChange={(event) => setHtml(event.target.value)}
              />
              <Callout variant="warning" className="mt-4">
                HTML colado entra como bloco único e não é reescrito pelo editor. A checagem de
                envio ainda roda — descadastro, texto alternativo e peso continuam sendo exigidos.
              </Callout>

              <Button className="mt-4" onClick={startFromHtml}>
                <FileCode2 />
                Abrir no editor
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-xs leading-relaxed">
                O esqueleto já vem com o cabeçalho de marca e o rodapé com endereço e descadastro,
                ambos travados. Entre os dois fica o que você monta — texto, imagem, colunas, botão.
              </p>

              {modules.length > 0 ? (
                <div className="mt-4">
                  <Eyebrow className="mb-2">Módulos disponíveis no editor</Eyebrow>
                  <div className="flex flex-wrap gap-1.5">
                    {modules.map((module) => (
                      <span
                        key={module.id}
                        className="bg-muted/70 rounded-md px-2 py-1 text-[11px]"
                      >
                        {module.name}
                        {module.locked ? (
                          <span className="text-muted-foreground"> · marca</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button className="mt-4" onClick={startBlank}>
                <LayoutTemplate />
                Abrir editor em branco
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="ml-2 mt-4"
            onClick={() => router.push("/email-studio")}
          >
            <ArrowLeft />
            Voltar
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
