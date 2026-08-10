"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Attachment, CannedResponse, ChannelKind, AiToneAdjustment } from "@elora/core";
import { AI_TONE_LABEL, formatBytes, minutesSince } from "@elora/core";
import {
  Badge,
  Button,
  Callout,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Tooltip,
  cn,
} from "@elora/ui";
import {
  AlertTriangle,
  Check,
  CornerUpLeft,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Pencil,
  Send,
  Sparkles,
  StickyNote,
  Wand2,
  X,
  Zap,
} from "lucide-react";

import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  revokeDraft,
  toAttachment,
  toDraftAttachments,
  type DraftAttachment,
} from "@/lib/attachments";
import { AudioRecorder } from "./audio-recorder";
import { EmojiPicker } from "./emoji-picker";
import { LinkAttachButton, LinkChip } from "./link-attach";

export type ComposerMode = "resposta" | "nota";

export interface ComposerQuote {
  messageId: string;
  authorLabel: string;
  preview: string;
  attachmentLabel?: string;
}

export interface ComposerSubmission {
  mode: ComposerMode;
  body: string;
  asTemplate: boolean;
  attachments: Attachment[];
  quote?: ComposerQuote;
}

/**
 * Ações de IA disponíveis ao compositor.
 *
 * O compositor recebe funções, não o repositório: assim ele não sabe que existe
 * um gateway, um provedor ou um contexto de conversa — só que alguém consegue
 * transformar o rascunho dele em outro texto. É o que permite testá-lo e o que
 * mantém a montagem do contexto num lugar só.
 */
export interface ComposerCopilot {
  available: boolean;
  suggest: (draft: string) => Promise<string | null>;
  rewrite: (draft: string, tone: AiToneAdjustment) => Promise<string | null>;
}

/**
 * Superfície imperativa do compositor.
 *
 * Existe porque duas coisas fora dele precisam alcançá-lo: o arraste de arquivo,
 * que mira a conversa inteira, e o copiloto no painel da direita, que entrega um
 * texto para o atendente revisar. A alternativa seria içar o rascunho para o
 * `InboxWorkspace` e fazê-lo redescer por propriedade — o que colocaria cada
 * tecla digitada a reconstruir a árvore da conversa.
 */
export interface ComposerHandle {
  addFiles: (files: File[]) => void;
  /** Troca o rascunho e põe o cursor no fim, para o atendente continuar dali. */
  setBody: (text: string) => void;
  focus: () => void;
}

const WHATSAPP_WINDOW_MINUTES = 24 * 60;
const MAX_TEXTAREA_HEIGHT = 200;

const TONES: AiToneAdjustment[] = [
  "cordial",
  "formal",
  "direto",
  "empatico",
  "resumir",
  "detalhar",
  "revisar",
];

export const Composer = forwardRef<
  ComposerHandle,
  {
    /**
     * Conversa a que este rascunho pertence.
     *
     * O compositor não é mais remontado a cada troca de conversa — remontá-lo
     * custava recriar seis raízes de Radix e pagar um passe completo de estilo e
     * layout. Em troca, ele precisa saber quando a conversa mudou para descartar
     * o rascunho: um texto escrito para um cliente não pode aparecer na conversa
     * do seguinte.
     */
    conversationId: string;
    channel: ChannelKind;
    cannedResponses: CannedResponse[];
    lastInboundAt?: string;
    disabled?: boolean;
    disabledReason?: string;
    quote?: ComposerQuote;
    onClearQuote?: () => void;
    copilot: ComposerCopilot;
    /**
     * Ações extras na barra, ao lado do gravador de voz.
     *
     * Chega pronta, como nó, e o compositor só a desenha. É o que mantém este
     * arquivo ignorante de comércio — do mesmo jeito que ele recebe funções de
     * IA em vez do gateway. Sem isso, montar proposta obrigaria o compositor a
     * conhecer produto, catálogo e a rota de escrita.
     */
    quickActions?: React.ReactNode;
    onSend: (input: ComposerSubmission) => void;
  }
>(function Composer(
  {
    conversationId,
    channel,
    cannedResponses,
    lastInboundAt,
    disabled,
    disabledReason,
    quote,
    onClearQuote,
    copilot,
    quickActions,
    onSend,
  },
  ref,
) {
  const [mode, setMode] = useState<ComposerMode>("resposta");
  const [body, setBody] = useState("");
  const [drafts, setDrafts] = useState<DraftAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"sugerindo" | "reescrevendo" | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  /** Áudio já gravado e confirmado, aguardando o envio junto da mensagem. */
  const [recordedAudio, setRecordedAudio] = useState<Attachment | null>(null);
  /**
   * Anexos por link já resolvidos pelo servidor.
   *
   * Ficam separados dos rascunhos de arquivo porque não têm `File` nem object URL
   * para revogar: já nascem no formato canônico, com título e capa resolvidos.
   */
  const [linkAttachments, setLinkAttachments] = useState<Attachment[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  /**
   * Fora da janela de 24 horas, o WhatsApp só aceita template aprovado
   * (seção 11 do plano). A interface precisa deixar isso explícito antes do
   * envio, e não depois da falha do provedor.
   */
  const outsideWindow = useMemo(() => {
    if (channel !== "whatsapp" || !lastInboundAt) return false;
    return minutesSince(lastInboundAt) > WHATSAPP_WINDOW_MINUTES;
  }, [channel, lastInboundAt]);

  const requiresTemplate = mode === "resposta" && outsideWindow;
  const validDrafts = drafts.filter((draft) => !draft.error);
  /** Arquivo, link e gravação disputam o mesmo teto por mensagem. */
  const attachmentCount = drafts.length + linkAttachments.length + (recordedAudio ? 1 : 0);
  const trayFull = attachmentCount >= MAX_ATTACHMENTS_PER_MESSAGE;
  const canSend =
    (body.trim().length > 0 ||
      validDrafts.length > 0 ||
      linkAttachments.length > 0 ||
      recordedAudio !== null) &&
    !disabled &&
    !busy;

  /* Troca de conversa ------------------------------------------------------ */

  /**
   * Descarta o rascunho ao mudar de conversa.
   *
   * Antes isto era efeito colateral de uma remontagem — a árvore inteira era
   * jogada fora e nascia limpa. Sem a remontagem, a limpeza precisa ser
   * explícita, e é melhor assim: fica visível **o que** se descarta, e os object
   * URLs dos anexos abandonados são devolvidos em vez de vazarem.
   */
  useEffect(() => {
    setBody("");
    setSuggestion(null);
    setMode("resposta");
    setRecordedAudio(null);
    setLinkAttachments([]);
    setDrafts((current) => {
      current.forEach(revokeDraft);
      return [];
    });
  }, [conversationId]);

  /* Altura automática ------------------------------------------------------ */

  // O campo cresce com o texto até um teto e então rola. Textarea de altura fixa
  // esconde o que foi escrito; sem teto, o campo engole a conversa.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [body]);

  /**
   * Rascunho abandonado precisa devolver a memória.
   *
   * O espelho em ref existe porque a limpeza de desmontagem não pode ler estado
   * pelo `setState` — na saída do componente o React já não aplica atualização.
   * Sem isto, trocar de conversa com três imagens na bandeja deixaria os três
   * arquivos presos na memória da aba.
   *
   * Anexo já enviado não é revogado aqui: a bolha recém-criada aponta para o
   * mesmo object URL e precisa dele pelo resto da sessão.
   */
  const draftsRef = useRef<DraftAttachment[]>([]);
  draftsRef.current = drafts;

  useEffect(() => {
    return () => {
      draftsRef.current.forEach(revokeDraft);
    };
  }, []);

  /* Anexos ---------------------------------------------------------------- */

  /**
   * Vagas já tomadas por link e gravação.
   *
   * Espelhado em ref porque `addFiles` é chamado de fora (arraste na conversa) e
   * precisa ler o valor corrente sem que a identidade da função mude a cada
   * anexo — o `useImperativeHandle` a expõe para a conversa inteira.
   */
  const otherAttachmentsRef = useRef(0);
  otherAttachmentsRef.current = linkAttachments.length + (recordedAudio ? 1 : 0);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setDrafts((current) => {
      const room = MAX_ATTACHMENTS_PER_MESSAGE - current.length - otherAttachmentsRef.current;
      if (room <= 0) return current;
      return [...current, ...toDraftAttachments(files.slice(0, room))];
    });
  }, []);

  function removeDraft(id: string) {
    setDrafts((current) => {
      const target = current.find((draft) => draft.id === id);
      if (target) revokeDraft(target);
      return current.filter((draft) => draft.id !== id);
    });
  }

  useImperativeHandle(ref, () => ({
    addFiles,
    setBody: (text: string) => {
      setMode("resposta");
      setBody(text);
      setSuggestion(null);
      requestAnimationFrame(() => {
        const element = textareaRef.current;
        element?.focus();
        element?.setSelectionRange(text.length, text.length);
      });
    },
    focus: () => textareaRef.current?.focus(),
  }));

  /* Inserção de texto ----------------------------------------------------- */

  /**
   * Insere na posição do cursor, não no fim.
   *
   * Quem já escreveu a frase e volta para acrescentar um emoji no meio espera
   * que ele apareça onde o cursor está. Acrescentar no fim é o comportamento
   * fácil e o errado.
   */
  const insertAtCursor = useCallback((text: string) => {
    const element = textareaRef.current;
    if (!element) {
      setBody((current) => current + text);
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;

    setBody((current) => `${current.slice(0, start)}${text}${current.slice(end)}`);

    // O cursor precisa ser reposicionado depois que o React aplicou o valor.
    requestAnimationFrame(() => {
      element.focus();
      const caret = start + text.length;
      element.setSelectionRange(caret, caret);
    });
  }, []);

  function applyCanned(response: CannedResponse) {
    setBody((current) => (current.trim() ? `${current}\n${response.body}` : response.body));
    setQuickOpen(false);
    textareaRef.current?.focus();
  }

  /* Copiloto -------------------------------------------------------------- */

  async function requestSuggestion() {
    setBusy("sugerindo");
    const text = await copilot.suggest(body.trim());
    setBusy(null);
    // A sugestão não sobrescreve o rascunho: entra numa faixa acima do campo
    // para o atendente comparar, aceitar ou descartar. Substituir o que ele
    // digitou sem pedir é a forma mais rápida de perder a confiança dele.
    if (text) setSuggestion(text);
  }

  async function applyTone(tone: AiToneAdjustment) {
    const draft = body.trim();
    if (!draft) return;
    setBusy("reescrevendo");
    const text = await copilot.rewrite(draft, tone);
    setBusy(null);
    if (text) setSuggestion(text);
  }

  function acceptSuggestion(edit: boolean) {
    if (!suggestion) return;
    setBody(suggestion);
    setSuggestion(null);
    if (edit) {
      requestAnimationFrame(() => {
        const element = textareaRef.current;
        element?.focus();
        element?.setSelectionRange(suggestion.length, suggestion.length);
      });
    }
  }

  /* Envio ----------------------------------------------------------------- */

  function submit() {
    if (!canSend) return;

    onSend({
      mode,
      body: body.trim(),
      asTemplate: requiresTemplate,
      attachments: [
        ...validDrafts.map(toAttachment),
        ...linkAttachments,
        ...(recordedAudio ? [recordedAudio] : []),
      ],
      quote: mode === "resposta" ? quote : undefined,
    });

    // Os object URLs seguem vivos de propósito: a bolha recém-criada os usa
    // para mostrar a imagem. Quem os revoga é a troca de conversa.
    setDrafts([]);
    setLinkAttachments([]);
    setRecordedAudio(null);
    setBody("");
    setSuggestion(null);
    onClearQuote?.();
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }
    // Barra num campo vazio abre as respostas rápidas, como num terminal.
    if (event.key === "/" && body.length === 0 && mode === "resposta") {
      event.preventDefault();
      setQuickOpen(true);
      return;
    }
    if (event.key === "Escape") {
      if (suggestion) {
        setSuggestion(null);
        return;
      }
      if (quote) onClearQuote?.();
    }
  }

  const availableResponses = cannedResponses.filter((response) =>
    response.channels.includes(channel),
  );

  if (disabled) {
    return (
      <div className="border-border bg-surface shrink-0 border-t px-4 py-3">
        <Callout variant="neutral" icon={<AlertTriangle />}>
          {disabledReason ?? "Esta conversa está encerrada. Reabra para voltar a responder."}
        </Callout>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border bg-surface relative shrink-0 border-t transition-colors",
        dragging && "bg-accent-soft/60",
      )}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDragLeave={() => {
        // Contador de profundidade: sem ele, passar por um filho dispara
        // dragleave e a moldura pisca durante todo o arraste.
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        addFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {dragging ? (
        <div className="border-accent bg-surface/80 pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-accent-ink flex items-center gap-2 text-xs font-semibold">
            <Paperclip className="size-4" aria-hidden />
            Solte para anexar
          </p>
        </div>
      ) : null}

      {/* Sugestão do copiloto -------------------------------------------- */}
      {suggestion ? (
        <div className="animate-fade-up bg-accent-soft/70 shadow-card mx-3 mt-3 overflow-hidden rounded-lg">
          <div className="flex items-center gap-2 px-3 pt-2">
            <Sparkles className="text-accent-ink size-3.5" aria-hidden />
            <span className="text-accent-ink text-[11px] font-semibold uppercase tracking-wide">
              Sugestão do copiloto
            </span>
            <span className="text-muted-foreground text-[11px]">· revise antes de enviar</span>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              aria-label="Descartar sugestão"
              className="text-muted-foreground hover:bg-surface hover:text-foreground ml-auto rounded p-1 transition-colors"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>

          <p className="text-foreground whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed">
            {suggestion}
          </p>

          <div className="flex items-center gap-1.5 px-3 pb-2.5">
            <Button size="xs" variant="accent" onClick={() => acceptSuggestion(false)}>
              <Check />
              Usar
            </Button>
            <Button size="xs" variant="outline" onClick={() => acceptSuggestion(true)}>
              <Pencil />
              Usar e editar
            </Button>
            <span className="text-muted-foreground ml-auto text-[10px]">Esc descarta</span>
          </div>
        </div>
      ) : null}

      {/* Citação ---------------------------------------------------------- */}
      {quote && mode === "resposta" ? (
        <div className="animate-fade-up bg-muted/70 mx-3 mt-3 flex items-start gap-2 rounded-lg px-3 py-2">
          <CornerUpLeft className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
          <div className="border-chat-quote min-w-0 flex-1 border-l-2 pl-2">
            <p className="text-chat-quote text-[11px] font-semibold">{quote.authorLabel}</p>
            <p className="text-muted-foreground truncate text-[11px]">
              {quote.preview || quote.attachmentLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClearQuote}
            aria-label="Remover citação"
            className="text-muted-foreground hover:bg-surface hover:text-foreground rounded p-1 transition-colors"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* Alternador de modo ---------------------------------------------- */}
      <div className="flex items-center gap-1 px-3 pt-2">
        <ModeTab
          active={mode === "resposta"}
          onClick={() => setMode("resposta")}
          icon={<Send className="size-3.5" aria-hidden />}
          label="Resposta"
          activeClass="bg-primary-soft text-primary"
        />
        <ModeTab
          active={mode === "nota"}
          onClick={() => setMode("nota")}
          icon={<StickyNote className="size-3.5" aria-hidden />}
          label="Nota interna"
          activeClass="bg-warning-soft text-warning-foreground"
        />

        {requiresTemplate ? (
          <Badge variant="warning" className="ml-auto">
            <AlertTriangle aria-hidden />
            Fora da janela de 24 h — exige template
          </Badge>
        ) : null}
      </div>

      {/**
       * Campo.
       *
       * O traço é `border-input`, não `border-border`. A caixa parece decoração,
       * mas é o limite do campo de mensagem — o `textarea` dentro dela tem
       * `border-0` justamente porque quem desenha a moldura é esta div. Como
       * limite de componente de interface, ela precisa dos 3:1 da WCAG 1.4.11;
       * com o traço estrutural ficava em 1,86:1 e o campo desaparecia quando o
       * texto de exemplo saía.
       *
       * No modo nota o âmbar cumpre o mesmo papel, e mais escuro do que era.
       */}
      <div
        className={cn(
          "m-3 rounded-lg border transition-colors",
          mode === "nota" ? "border-warning/70 bg-warning-soft/40" : "border-input bg-surface",
        )}
      >
        {drafts.length > 0 || linkAttachments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 p-2">
            <AttachmentTray drafts={drafts} onRemove={removeDraft} />
            {linkAttachments.map((attachment) => (
              <LinkChip
                key={attachment.id}
                attachment={attachment}
                onRemove={() =>
                  setLinkAttachments((current) =>
                    current.filter((item) => item.id !== attachment.id),
                  )
                }
              />
            ))}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length === 0) return;
            // Print de tela colado é o anexo mais comum num atendimento.
            event.preventDefault();
            addFiles(files);
          }}
          rows={1}
          placeholder={
            mode === "nota"
              ? "Nota visível apenas para o time. Use @ para mencionar alguém."
              : requiresTemplate
                ? "Selecione um template aprovado ou escreva o conteúdo que será submetido."
                : "Escreva sua resposta. / abre respostas rápidas, Ctrl+Enter envia."
          }
          aria-label={mode === "nota" ? "Nota interna" : "Resposta ao contato"}
          className="text-foreground placeholder:text-muted-foreground/70 block max-h-[12.5rem] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-0"
        />

        <Separator />

        <div className="flex items-center gap-0.5 p-1.5">
          <Popover open={quickOpen} onOpenChange={setQuickOpen}>
            <Tooltip content="Respostas rápidas (/)">
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Respostas rápidas">
                  <Zap />
                </Button>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent className="w-80 p-1" align="start" side="top">
              <p className="text-muted-foreground px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide">
                Respostas rápidas
              </p>
              {availableResponses.length === 0 ? (
                <p className="text-muted-foreground px-2 py-3 text-xs">
                  Nenhuma resposta rápida configurada para este canal.
                </p>
              ) : (
                availableResponses.map((response) => (
                  <button
                    key={response.id}
                    type="button"
                    onClick={() => applyCanned(response)}
                    className="hover:bg-muted flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2 text-xs font-medium">
                      {response.title}
                      <code className="bg-muted text-muted-foreground rounded px-1 text-[10px]">
                        {response.shortcut}
                      </code>
                    </span>
                    <span className="text-muted-foreground line-clamp-2 text-[11px]">
                      {response.body}
                    </span>
                  </button>
                ))
              )}
            </PopoverContent>
          </Popover>

          <Tooltip content="Anexar do computador">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Anexar arquivo do computador"
              onClick={() => fileInputRef.current?.click()}
              disabled={trayFull}
            >
              <Paperclip />
            </Button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              // Zerar permite reescolher o mesmo arquivo depois de removê-lo.
              event.target.value = "";
            }}
          />

          {/* Dois botões em vez de um menu: anexar por link é ação frequente o
              bastante para não merecer um clique a mais de submenu. O próprio
              componente carrega sua dica — envolvê-lo por fora inseriria um
              `span` entre o gatilho e o botão e quebraria a composição do Radix. */}
          <LinkAttachButton
            disabled={trayFull}
            onAttach={(attachment) => setLinkAttachments((current) => [...current, attachment])}
          />

          <EmojiPicker onSelect={insertAtCursor} />

          {recordedAudio ? (
            <span className="bg-accent-soft text-accent-ink mr-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium">
              <Mic className="size-3" aria-hidden />
              Voz · {recordedAudio.durationSeconds}s
              <button
                type="button"
                onClick={() => setRecordedAudio(null)}
                aria-label="Remover a gravação"
                className="opacity-70 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : null}

          <AudioRecorder
            disabled={trayFull}
            onReady={(attachment) => setRecordedAudio(attachment)}
          />

          {quickActions}

          {copilot.available && mode === "resposta" ? (
            <>
              <span className="bg-border mx-1 h-5 w-px" aria-hidden />

              <Tooltip content={body.trim() ? "Melhorar o rascunho" : "Escrever resposta com IA"}>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={requestSuggestion}
                  disabled={busy !== null}
                  className="text-accent-ink hover:bg-accent-soft"
                >
                  {busy === "sugerindo" ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Sparkles aria-hidden />
                  )}
                  {body.trim() ? "Melhorar" : "Sugerir"}
                </Button>
              </Tooltip>

              <DropdownMenu>
                <Tooltip content="Ajustar tom do rascunho">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ajustar tom"
                      disabled={busy !== null || body.trim().length === 0}
                    >
                      {busy === "reescrevendo" ? (
                        <Loader2 className="animate-spin" aria-hidden />
                      ) : (
                        <Wand2 />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </Tooltip>
                <DropdownMenuContent align="start" side="top" className="w-56">
                  <DropdownMenuLabel>Reescrever o rascunho</DropdownMenuLabel>
                  {TONES.slice(0, 4).map((tone) => (
                    <DropdownMenuItem key={tone} onSelect={() => void applyTone(tone)}>
                      {AI_TONE_LABEL[tone]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {TONES.slice(4).map((tone) => (
                    <DropdownMenuItem key={tone} onSelect={() => void applyTone(tone)}>
                      {AI_TONE_LABEL[tone]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}

          <span className="text-muted-foreground ml-auto mr-1 hidden text-[11px] sm:inline">
            Ctrl + Enter
          </span>

          <Button
            size="sm"
            variant={mode === "nota" ? "subtle" : "accent"}
            onClick={submit}
            disabled={!canSend}
            className="press"
          >
            {mode === "nota" ? (
              <>
                <StickyNote /> Salvar nota
              </>
            ) : (
              <>
                <Send /> Enviar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

function ModeTab({
  active,
  onClick,
  icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        active ? activeClass : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Fichas dos arquivos escolhidos do computador.
 *
 * A bandeja que as contém fica **dentro** da moldura do campo, acima do texto,
 * porque anexo e mensagem são um envio só — uma lista separada faria parecer que
 * são duas ações. Arquivo e link dividem a mesma bandeja pelo mesmo motivo, e é
 * por isso que este componente devolve fragmento, não caixa própria.
 *
 * O arquivo recusado permanece visível com o motivo em vez de desaparecer: quem
 * escolheu um arquivo de 40 MB precisa saber por que ele não vai.
 */
function AttachmentTray({
  drafts,
  onRemove,
}: {
  drafts: DraftAttachment[];
  onRemove: (id: string) => void;
}) {
  return (
    <>
      {drafts.map((draft) => (
        <div
          key={draft.id}
          className={cn(
            "animate-scale-in bg-muted/80 shadow-card group relative flex items-center gap-2 overflow-hidden rounded-md pr-7",
            draft.error && "bg-destructive-soft",
          )}
        >
          {draft.previewUrl && draft.kind === "imagem" ? (
            // Object URL local: sem host conhecido em tempo de build, o
            // otimizador de imagem do Next não tem o que fazer aqui.
            <img src={draft.previewUrl} alt="" className="size-10 shrink-0 object-cover" />
          ) : (
            <span className="bg-surface text-muted-foreground flex size-10 shrink-0 items-center justify-center">
              <FileText className="size-4" aria-hidden />
            </span>
          )}

          <span className="min-w-0 max-w-40 py-1">
            <span className="block truncate text-[11px] font-medium">{draft.file.name}</span>
            <span
              className={cn(
                "block text-[10px] tabular-nums",
                draft.error ? "text-destructive font-medium" : "text-muted-foreground",
              )}
            >
              {draft.error ?? formatBytes(draft.file.size)}
            </span>
          </span>

          <button
            type="button"
            onClick={() => onRemove(draft.id)}
            aria-label={`Remover ${draft.file.name}`}
            className="text-muted-foreground hover:bg-surface hover:text-foreground absolute right-1 top-1 rounded p-0.5 transition-colors"
          >
            <X className="size-3" aria-hidden />
          </button>
        </div>
      ))}
    </>
  );
}
