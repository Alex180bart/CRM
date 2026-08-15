"use client";

import Link from "next/link";
import * as React from "react";
import { formatDateTime, normalizeSiteContent, type SiteContent } from "@elora/core";
import {
  Button,
  Callout,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@elora/ui";
import {
  AlertTriangle,
  Check,
  Download,
  ExternalLink,
  FileJson,
  HelpCircle,
  Home,
  Layout,
  Receipt,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react";

import { ChromeEditor, FaqEditor, LandingEditor, PricingEditor } from "./content-editor-sections";
import type { ContentSource } from "@/lib/site/content-store";
import {
  reloadSiteContentAction,
  resetSiteContentAction,
  saveSiteContentAction,
} from "@/app/(site)/admin/content-actions";

/**
 * O editor de conteúdo do site.
 *
 * ## O documento inteiro vive no estado, e a gravação é uma só
 *
 * Não há gravação por campo nem por seção. O motivo é a natureza do texto de
 * marketing: mexer no título do herói costuma implicar mexer na chamada e no
 * botão, e três gravações independentes deixariam a página publicada num estado
 * intermediário que ninguém escreveu — título novo, chamada velha. Um botão
 * publica o conjunto.
 *
 * O custo é o conflito entre duas pessoas editando ao mesmo tempo, e ele é
 * tratado explicitamente: a gravação leva o carimbo da versão carregada, e o
 * servidor recusa se o arquivo mudou nesse meio-tempo.
 *
 * ## Por que "salvo" não basta como aviso
 *
 * Este editor publica direto. Não há rascunho, não há prévia isolada, não há
 * fluxo de aprovação — clicar em publicar troca o que o visitante vê. A tela diz
 * isso ao lado do botão, antes do clique: descobrir depois é o tipo de coisa que
 * faz alguém parar de usar a ferramenta.
 *
 * ## Nada anima a raiz, e o motivo é o `sticky`
 *
 * A tentação óbvia era envolver tudo numa entrada com `.rise-in`. Não dá: a
 * animação termina em `transform: translateY(0)` com `fill-mode: both`, então o
 * elemento fica com uma `transform` aplicada **para sempre** — e um ancestral com
 * `transform` vira o bloco de contenção do `position: sticky`. A barra de ações
 * pararia de grudar, sem erro e sem aviso, que é a mesma armadilha do
 * `overflow` no layout do site. O movimento vive nas peças de dentro: `.rise-in`
 * no painel de seção, `.stagger` nas linhas de lista, `.glow-pulse` no ponto de
 * estado.
 */

type EditorTab = "landing" | "faq" | "precos" | "casca";

/**
 * As quatro superfícies, numa lista só.
 *
 * Rótulo, ícone e a fatia do documento que cada uma governa. O `slice` existe
 * para o ponto de "com alterações" na aba: sem ele, cada gatilho precisaria de
 * uma comparação escrita à mão ao lado do JSX, e a que seria esquecida é sempre
 * a da aba acrescentada por último.
 */
const SURFACES = [
  {
    id: "landing" as const,
    label: "Landing page",
    icon: Home,
    slice: (content: SiteContent) => content.landing,
  },
  {
    id: "faq" as const,
    label: "Perguntas frequentes",
    icon: HelpCircle,
    slice: (content: SiteContent) => content.faq,
  },
  {
    id: "precos" as const,
    label: "Página de preços",
    icon: Receipt,
    slice: (content: SiteContent) => content.pricing,
  },
  {
    id: "casca" as const,
    label: "Cabeçalho e rodapé",
    icon: Layout,
    slice: (content: SiteContent) => [content.header, content.footer],
  },
];

export function ContentEditor({
  initial,
  source,
}: {
  initial: SiteContent;
  source: ContentSource;
}) {
  const [content, setContent] = React.useState<SiteContent>(initial);
  /** O documento como está no servidor. É a régua do "há alteração não publicada". */
  const [published, setPublished] = React.useState<SiteContent>(initial);
  const [tab, setTab] = React.useState<EditorTab>("landing");
  const [pending, startTransition] = React.useTransition();
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  /**
   * Comparação por serialização.
   *
   * Custa uma passada pelo documento a cada tecla, e o documento tem alguns
   * kilobytes — barato o suficiente para não aparecer num perfil. A alternativa
   * seria um sinalizador ligado em cada `onChange`, que erra na direção pior:
   * desfazer uma edição manualmente deixaria a tela avisando de alteração que
   * não existe mais.
   */
  const dirty = React.useMemo(
    () => JSON.stringify(content) !== JSON.stringify(published),
    [content, published],
  );

  /** Quais superfícies diferem do que está publicado — alimenta o ponto na aba. */
  const touched = React.useMemo(
    () =>
      Object.fromEntries(
        SURFACES.map((surface) => [
          surface.id,
          JSON.stringify(surface.slice(content)) !== JSON.stringify(surface.slice(published)),
        ]),
      ) as Record<EditorTab, boolean>,
    [content, published],
  );

  /**
   * Aviso do navegador ao sair com alteração pendente.
   *
   * O texto é do navegador, não nosso — desde 2017 nenhum deles exibe mensagem
   * personalizada. O que se controla é se a caixa aparece.
   */
  React.useEffect(() => {
    if (!dirty) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function publish() {
    setNotice(null);
    startTransition(async () => {
      const result = await saveSiteContentAction(content, published.updatedAt);

      if (!result.ok || !result.content) {
        setNotice({ ok: false, text: result.reason ?? "Não foi possível publicar." });
        return;
      }

      setContent(result.content);
      setPublished(result.content);
      setNotice({ ok: true, text: "Publicado. O site já está servindo esta versão." });
    });
  }

  function restoreDefaults() {
    setConfirmReset(false);
    setNotice(null);
    startTransition(async () => {
      const result = await resetSiteContentAction();

      if (!result.ok || !result.content) {
        setNotice({ ok: false, text: result.reason ?? "Não foi possível restaurar." });
        return;
      }

      setContent(result.content);
      setPublished(result.content);
      setNotice({ ok: true, text: "Conteúdo restaurado ao texto original." });
    });
  }

  function reloadFromServer() {
    setNotice(null);
    startTransition(async () => {
      const result = await reloadSiteContentAction();
      if (!result.ok || !result.content) {
        setNotice({ ok: false, text: result.reason ?? "Não foi possível recarregar." });
        return;
      }
      setContent(result.content);
      setPublished(result.content);
      setNotice({ ok: true, text: "Trazida a versão que está publicada agora." });
    });
  }

  /**
   * Exportar e importar existem por causa da hospedagem somente leitura.
   *
   * Onde o sistema de arquivos não aceita escrita — Vercel e a maioria das
   * hospedagens serverless —, publicar falha. Sem a exportação, o trabalho de uma
   * tarde ficaria preso na aba do navegador. Com ela, o caminho é conhecido:
   * baixar, comitar o arquivo, subir pelo repositório.
   */
  function exportJson() {
    const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "site-content.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setNotice(null);
    try {
      /**
       * A normalização acontece **aqui também**, e não só no servidor.
       *
       * Sem ela, um JSON com uma seção faltando encheria o formulário de campos
       * indefinidos e o React reclamaria de componente que passa de não
       * controlado para controlado — erro que aponta para o campo, e não para o
       * arquivo que o causou.
       */
      const parsed = normalizeSiteContent(JSON.parse(await file.text()));
      setContent({ ...parsed, updatedAt: published.updatedAt, updatedBy: published.updatedBy });
      setNotice({
        ok: true,
        text: "Arquivo carregado no formulário. Nada foi publicado ainda — confira e clique em publicar.",
      });
    } catch {
      setNotice({ ok: false, text: "Não foi possível ler o arquivo: não é um JSON válido." });
    }
  }

  const canPublish = dirty && source.writable && !pending;

  return (
    <div>
      {/* Barra de ações ------------------------------------------------------ */}
      <div className="border-border shadow-card bg-card sticky top-16 z-30 mb-5 rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {/*
              O ponto é o estado, e o halo é a única coisa que se move na barra
              em repouso. `.glow-pulse` acende e apaga uma camada que já nasceu no
              tamanho final — não é uma sombra que cresce, que repintaria a barra
              inteira a cada quadro. Em repouso publicado ele é um ponto morto na
              cor da borda: sem laço, sem chamar atenção para o nada.
            */}
            <span
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                dirty ? "bg-accent glow-pulse" : "bg-border-strong",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {dirty ? "Há alterações não publicadas" : "Tudo publicado"}
              </p>
              <p className="text-muted-foreground text-xs leading-snug">
                {published.updatedBy
                  ? `Última publicação por ${published.updatedBy}, em ${formatDateTime(published.updatedAt)}.`
                  : "O site está servindo o texto original do código."}{" "}
                Publicar troca o que o visitante vê, sem etapa de aprovação.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="press">
              <Link href="/" target="_blank" rel="noreferrer">
                <ExternalLink />
                Abrir o site
              </Link>
            </Button>

            <span className="bg-border mx-1 hidden h-5 w-px sm:block" aria-hidden />

            <Button variant="ghost" size="sm" className="press" onClick={exportJson}>
              <Download />
              Exportar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="press"
              onClick={() => fileInput.current?.click()}
              disabled={pending}
            >
              <Upload />
              Importar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="press"
              onClick={() => setConfirmReset(true)}
              disabled={pending}
            >
              <RotateCcw />
              Restaurar
            </Button>

            {/*
              `.sheen` só entra quando o botão pode ser clicado. Num botão
              desabilitado o brilho anunciaria uma ação que não acontece — e o
              `hover` de um elemento desabilitado é justamente onde a pessoa
              descobre que ele não responde.
            */}
            <Button
              onClick={publish}
              disabled={!canPublish}
              className={cn("press ml-1", canPublish && "sheen")}
              variant="accent"
            >
              <Save />
              {pending ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importJson(file);
            // Zerar o valor permite reimportar o mesmo arquivo depois de editá-lo
            // por fora: sem isto, o segundo `change` nunca dispara.
            event.target.value = "";
          }}
        />
      </div>

      {notice ? (
        <Callout
          variant={notice.ok ? "success" : "danger"}
          icon={notice.ok ? <Check /> : <AlertTriangle />}
          className="mb-5"
        >
          <p className="text-sm leading-relaxed">{notice.text}</p>
          {!notice.ok ? (
            <Button variant="outline" size="sm" className="mt-3" onClick={reloadFromServer}>
              <RotateCcw />
              Trazer a versão publicada
            </Button>
          ) : null}
        </Callout>
      ) : null}

      {!source.writable ? (
        <Callout variant="warning" icon={<FileJson />} className="mb-5">
          <p className="font-medium">Este servidor não aceita gravação de arquivo.</p>
          <p className="mt-1 text-sm leading-relaxed">
            O conteúdo vive em <code>{source.file}</code>, e a pasta está somente para leitura — o
            caso normal em hospedagem serverless. Edite aqui, clique em <strong>Exportar</strong> e
            publique o arquivo pelo repositório: o site passa a servi-lo no próximo build.
          </p>
        </Callout>
      ) : !source.exists ? (
        <Callout variant="info" icon={<FileJson />} className="mb-5">
          <p className="text-sm leading-relaxed">
            Nada foi editado ainda: o site serve o texto original, escrito no código. A primeira
            publicação cria <code>{source.file}</code> — um arquivo versionado pelo Git, com
            histórico e reversão como o resto do repositório.
          </p>
        </Callout>
      ) : null}

      {/* Abas ---------------------------------------------------------------- */}
      <Tabs value={tab} onValueChange={(value) => setTab(value as EditorTab)}>
        <TabsList className="flex w-full overflow-x-auto">
          {SURFACES.map((surface) => (
            <TabsTrigger key={surface.id} value={surface.id} className="shrink-0 gap-1.5">
              <surface.icon className="size-3.5" aria-hidden />
              {surface.label}
              {/*
                O ponto responde "onde eu mexi?" sem obrigar a visitar as quatro
                abas antes de publicar. Vale mais aqui do que na barra: lá o
                aviso é sim ou não; aqui ele aponta o lugar.
              */}
              {touched[surface.id] ? (
                <span className="bg-accent size-1.5 rounded-full" aria-label="com alterações" />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="landing" className="mt-5 focus-visible:outline-none">
          <LandingEditor
            value={content.landing}
            onChange={(landing) => setContent((current) => ({ ...current, landing }))}
          />
        </TabsContent>

        <TabsContent value="faq" className="mt-5 focus-visible:outline-none">
          <FaqEditor
            value={content.faq}
            onChange={(faq) => setContent((current) => ({ ...current, faq }))}
          />
        </TabsContent>

        <TabsContent value="precos" className="mt-5 focus-visible:outline-none">
          <PricingEditor
            value={content.pricing}
            onChange={(pricing) => setContent((current) => ({ ...current, pricing }))}
          />
        </TabsContent>

        <TabsContent value="casca" className="mt-5 focus-visible:outline-none">
          <ChromeEditor
            header={content.header}
            footer={content.footer}
            onHeaderChange={(header) => setContent((current) => ({ ...current, header }))}
            onFooterChange={(footer) => setContent((current) => ({ ...current, footer }))}
          />
        </TabsContent>
      </Tabs>

      {/*
        A confirmação fica num diálogo, e a recusa também apareceria aqui — não
        num toast. É a mesma disciplina da Administração: mensagem que some antes
        de a pessoa terminar de ler faz com que ela clique de novo esperando outro
        resultado.
      */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar o texto original?</DialogTitle>
            <DialogDescription>
              Todo o conteúdo publicado volta ao texto escrito no código, e o que estiver no
              formulário é descartado. A publicação anterior continua no histórico do Git, então dá
              para recuperá-la por lá — mas não por esta tela.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={restoreDefaults}>
              Restaurar padrão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
