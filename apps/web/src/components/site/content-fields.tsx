"use client";

import * as React from "react";
import {
  CONTENT_PLACEHOLDERS,
  contentPlaceholderValues,
  freeContentId,
  type ContentIcon,
  type ContentLink,
} from "@elora/core";
import {
  Button,
  EmptyState,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@elora/ui";
import { ChevronDown, ChevronUp, Eye, Inbox, Link2, Plus, Trash2 } from "lucide-react";

import { RichLine, RichText } from "./rich-text";
import { CONTENT_ICON_NAMES, contentIcon } from "@/lib/site/icons";

/**
 * As peças de formulário do editor de conteúdo.
 *
 * ## Por que campo controlado, e não um formulário nativo
 *
 * O documento é uma árvore com listas que a pessoa reordena, acrescenta e
 * remove. Um formulário nativo exigiria nomear cada campo com o caminho dentro
 * da árvore (`landing.modules.3.body`) e remontar o objeto no servidor — e a
 * primeira reordenação quebraria a correspondência entre nome e posição.
 *
 * ## O custo do estado controlado, e como ele é contido
 *
 * Cada tecla digitada atualiza a raiz do documento, e a raiz redesenha. Com
 * algumas centenas de campos isso seria sensível. Duas coisas seguram: as abas
 * do Radix **desmontam** o painel inativo, e o rail de `content-editor-shell.tsx`
 * só monta a seção ativa. É o mesmo raciocínio de não remontar subárvore grande
 * com `key` que vale no Inbox, aplicado ao contrário: manter montado o mínimo.
 */

/* Rótulo e ajuda -------------------------------------------------------------------- */

function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{children}</p>;
}

export interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: React.ReactNode;
  placeholder?: string;
}

/**
 * Identificador estável para ligar `<label>` ao campo.
 *
 * `React.useId` e não contador de módulo: o contador produziria valor diferente
 * entre servidor e cliente e quebraria a hidratação — o defeito que este
 * repositório evita do lado do tempo com `datetime.ts` e do lado da cor com a
 * matiz derivada por FNV-1a.
 */
function useFieldId(prefix: string): string {
  return `${prefix}${React.useId()}`;
}

export function TextField({ label, value, onChange, hint, placeholder }: FieldProps) {
  const id = useFieldId("campo");

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5"
      />
      <FieldHint>{hint}</FieldHint>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: React.ReactNode;
}) {
  const id = useFieldId("numero");

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={String(value)}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="figure mt-1.5"
      />
      <FieldHint>{hint}</FieldHint>
    </div>
  );
}

/**
 * Campo de texto longo, com prévia da marcação.
 *
 * A prévia começa **desligada** e é ligada por campo. Mostrá-la sempre dobraria
 * a altura do formulário e afastaria os campos uns dos outros; escondê-la de vez
 * deixaria quem escreve descobrir o negrito errado só na página publicada.
 */
export function AreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
  placeholders = false,
}: FieldProps & { rows?: number; placeholders?: boolean }) {
  const id = useFieldId("area");
  const [preview, setPreview] = React.useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex items-center gap-2.5">
          {/*
            A contagem serve ao campo de descrição para busca, onde o Google
            corta perto de 160 caracteres — e serve de aviso discreto nos
            demais. Em `tabular-nums`, senão o número dança a cada tecla.
          */}
          <span className="text-muted-foreground/70 figure text-[10px]">{value.length}</span>
          <button
            type="button"
            onClick={() => setPreview((open) => !open)}
            className="text-muted-foreground hover:text-foreground press inline-flex items-center gap-1 rounded text-xs transition-colors"
            aria-pressed={preview}
          >
            <Eye className="size-3" aria-hidden />
            {preview ? "Ocultar prévia" : "Ver prévia"}
          </button>
        </div>
      </div>

      <Textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5"
      />

      {preview ? (
        <div className="rise-in border-input bg-surface-sunken mt-2 rounded-lg border p-3">
          <p className="text-muted-foreground mb-1.5 text-[10px] uppercase tracking-wide">
            Como aparece no site
          </p>
          {value.trim().length > 0 ? (
            <RichText className="text-foreground text-sm leading-relaxed">{value}</RichText>
          ) : (
            <p className="text-muted-foreground/70 text-sm italic">Campo vazio.</p>
          )}
        </div>
      ) : null}

      <FieldHint>
        {hint}
        {hint ? " " : null}
        Aceita <code>**negrito**</code>, <code>*itálico*</code> e <code>[texto](/endereço)</code>.
      </FieldHint>

      {placeholders ? <PlaceholderHelp /> : null}
    </div>
  );
}

/**
 * O catálogo de marcadores, ao lado do campo que os aceita.
 *
 * Recurso que ninguém sabe que existe é recurso que ninguém usa — e o efeito
 * colateral seria exatamente o que o marcador evita: alguém digita "R$ 0,0350"
 * no texto, a Meta reajusta, e o site passa a anunciar um preço que a proposta
 * não confirma.
 */
function PlaceholderHelp() {
  const values = contentPlaceholderValues();

  return (
    <details className="mt-2">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
        Marcadores disponíveis ({CONTENT_PLACEHOLDERS.length})
      </summary>
      <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
        {CONTENT_PLACEHOLDERS.map((item) => (
          <li key={item.key} className="flex flex-wrap items-baseline gap-x-2">
            <code className="text-foreground">{`{${item.key}}`}</code>
            <span>{item.description}</span>
            <span className="figure text-accent-ink">→ {values[item.key]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* Ícone ----------------------------------------------------------------------------- */

export function IconField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ContentIcon;
  onChange: (value: ContentIcon) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as ContentIcon)}>
        {/*
          O gatilho não desenha o ícone por conta própria: `SelectValue` do Radix
          já renderiza os filhos do item selecionado, e o item **é** ícone mais
          nome. A primeira versão punha os dois, e o resultado era o ícone
          aparecendo duas vezes lado a lado, uma em âmbar e outra em tinta de
          texto — parecia um segundo controle.
        */}
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTENT_ICON_NAMES.map((name) => {
            const Option = contentIcon(name);
            return (
              <SelectItem key={name} value={name}>
                <span className="flex items-center gap-2">
                  <Option className="text-accent size-4" aria-hidden />
                  {name}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

/* Link ------------------------------------------------------------------------------ */

/**
 * Rótulo e endereço lado a lado.
 *
 * O endereço aceita caminho interno (`/precos`), âncora (`#produto`) e URL
 * completa. Rótulo vazio **esconde o botão** na página — é como se remove um
 * botão do herói sem precisar de um interruptor separado, e a ajuda diz isso,
 * senão o campo em branco parece defeito.
 */
export function LinkField({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: ContentLink;
  onChange: (value: ContentLink) => void;
  optional?: boolean;
}) {
  const hidden = optional && value.label.trim().length === 0;

  return (
    <fieldset className="border-border bg-surface-sunken/60 rounded-lg border p-3 transition-colors">
      <legend className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs font-medium">
        <Link2 className="size-3" aria-hidden />
        {label}
        {/*
          O selo diz o efeito, não o estado do campo. "Rótulo vazio" seria
          descrever o formulário; "não aparece no site" é a consequência, que é
          o que a pessoa precisa saber para decidir se aquilo é intencional.
        */}
        {hidden ? (
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-normal">
            não aparece no site
          </span>
        ) : null}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Rótulo"
          value={value.label}
          onChange={(next) => onChange({ ...value, label: next })}
          hint={optional ? "Vazio esconde o botão." : undefined}
        />
        <TextField
          label="Endereço"
          value={value.href}
          onChange={(next) => onChange({ ...value, href: next })}
          placeholder="/precos"
        />
      </div>
    </fieldset>
  );
}

/* Lista ----------------------------------------------------------------------------- */

/**
 * Cabeçalho de uma lista: rótulo, explicação e o botão de acrescentar.
 *
 * Extraído porque `ListEditor` e `StringListEditor` desenhavam o mesmo bloco com
 * duas cópias que já tinham começado a divergir no espaçamento.
 */
function ListHeader({
  label,
  description,
  addLabel,
  onAdd,
}: {
  label: string;
  description?: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{description}</p>
        ) : null}
      </div>
      <Button type="button" size="sm" variant="outline" className="press shrink-0" onClick={onAdd}>
        <Plus />
        {addLabel}
      </Button>
    </div>
  );
}

/**
 * As três ações de uma linha: subir, descer e remover.
 *
 * Nascem a 55% de opacidade e chegam a 100% no `hover` da linha ou quando algo
 * dentro dela recebe foco. **Não** somem por completo: numa tela de toque não
 * existe `hover`, e um botão invisível é um botão que não existe. O que se ganha
 * é a lista em repouso ficar legível — com nove conjuntos de três botões em
 * tinta cheia, o olho lê a barra de ferramentas antes de ler o conteúdo.
 */
function RowActions({
  index,
  total,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-55 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label="Mover para cima"
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={() => onMove(1)}
        disabled={index === total - 1}
        aria-label="Mover para baixo"
      >
        <ChevronDown />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        onClick={onRemove}
        aria-label="Remover"
        className="text-destructive hover:bg-destructive-soft"
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/**
 * O escalonamento de entrada de uma linha.
 *
 * Teto de dez índices: uma lista de trinta itens com 28 ms por posição levaria
 * quase um segundo para terminar de aparecer, e a última linha chegaria depois
 * de a pessoa já ter clicado na primeira. É o mesmo teto que a lista de
 * conversas do Inbox aplica.
 */
function staggerStyle(index: number): React.CSSProperties {
  return { "--stagger-index": Math.min(index, 10) } as React.CSSProperties;
}

/**
 * Lista com acrescentar, remover e reordenar.
 *
 * ## Por que setas e não arrastar
 *
 * O arrastar existe no repositório (`@dnd-kit` no Pipeline e no Journey Builder)
 * e é o gesto certo para quadro com dezenas de cartões. Aqui a lista tem de três
 * a oito itens dentro de um formulário rolável — arrastar num contêiner que rola
 * é justamente o caso em que o gesto falha mais, e a seta funciona por teclado
 * sem trabalho adicional.
 *
 * ## O identificador do item novo é determinístico
 *
 * `freeContentId` procura o primeiro número livre em vez de sortear. Sorteio
 * produziria chave diferente entre servidor e cliente na prévia — o mesmo
 * defeito de hidratação que `datetime.ts` evita do lado do tempo.
 */
export function ListEditor<T extends { id: string }>({
  label,
  description,
  items,
  onChange,
  create,
  render,
  addLabel = "Acrescentar item",
  titleOf,
}: {
  label: string;
  description?: string;
  items: T[];
  onChange: (items: T[]) => void;
  /** Molde do item novo. Recebe o identificador já livre. */
  create: (id: string) => T;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel?: string;
  titleOf: (item: T, index: number) => string;
}) {
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <ListHeader
        label={label}
        description={description}
        addLabel={addLabel}
        onAdd={() =>
          onChange([
            ...items,
            create(
              freeContentId(
                "item",
                items.map((item) => item.id),
              ),
            ),
          ])
        }
      />

      {items.length === 0 ? (
        <EmptyState
          compact
          className="border-input mt-3 rounded-lg border border-dashed"
          icon={<Inbox />}
          title="Nenhum item"
          description="A seção inteira deixa de aparecer no site enquanto a lista estiver vazia — não fica um título órfão sobre espaço em branco."
        />
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              style={staggerStyle(index)}
              className="stagger border-border bg-surface-sunken hover:border-border-strong group rounded-lg border p-3 transition-colors"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="bg-muted text-muted-foreground figure flex size-5 shrink-0 items-center justify-center rounded text-[10px]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {titleOf(item, index)}
                </span>
                <RowActions
                  index={index}
                  total={items.length}
                  onMove={(direction) => move(index, direction)}
                  onRemove={() => onChange(items.filter((entry) => entry.id !== item.id))}
                />
              </div>

              <div className="space-y-3">
                {render(item, (patch) =>
                  onChange(
                    items.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)),
                  ),
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Lista de textos soltos — segmentos da marquise, itens da lista de IA.
 *
 * Sem identificador: são strings, e a chave de render é a posição. É aceitável
 * exatamente aqui porque não há campo com foco dentro de um item composto — o
 * campo **é** o item, e reordenar move o valor junto com o foco.
 */
export function StringListEditor({
  label,
  description,
  items,
  onChange,
  addLabel = "Acrescentar",
  multiline = false,
}: {
  label: string;
  description?: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
  multiline?: boolean;
}) {
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function update(index: number, next: string) {
    onChange(items.map((entry, position) => (position === index ? next : entry)));
  }

  return (
    <div>
      <ListHeader
        label={label}
        description={description}
        addLabel={addLabel}
        onAdd={() => onChange([...items, ""])}
      />

      {items.length === 0 ? (
        <EmptyState
          compact
          className="border-input mt-3 rounded-lg border border-dashed"
          icon={<Inbox />}
          title="Nenhum item"
          description="A peça deixa de aparecer no site enquanto a lista estiver vazia."
        />
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li
              key={`item-${index}`}
              style={staggerStyle(index)}
              className="stagger group flex items-start gap-2"
            >
              {multiline ? (
                <Textarea
                  rows={2}
                  value={item}
                  onChange={(event) => update(index, event.target.value)}
                  aria-label={`${label} ${index + 1}`}
                />
              ) : (
                <Input
                  value={item}
                  onChange={(event) => update(index, event.target.value)}
                  aria-label={`${label} ${index + 1}`}
                />
              )}
              <RowActions
                index={index}
                total={items.length}
                onMove={(direction) => move(index, direction)}
                onRemove={() => onChange(items.filter((_, position) => position !== index))}
              />
            </li>
          ))}
        </ul>
      )}

      {multiline ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Aceita <code>**negrito**</code>, <code>*itálico*</code> e <code>[texto](/endereço)</code>.
        </p>
      ) : null}
    </div>
  );
}

/* Cabeçalho de seção da página ------------------------------------------------------ */

export function HeadingFields({
  value,
  onChange,
}: {
  value: { eyebrow: string; title: string; body: string };
  onChange: (value: { eyebrow: string; title: string; body: string }) => void;
}) {
  return (
    <>
      <TextField
        label="Sobrelinha"
        value={value.eyebrow}
        onChange={(next) => onChange({ ...value, eyebrow: next })}
        hint="O rótulo pequeno em âmbar acima do título."
      />
      <AreaField
        label="Título"
        rows={2}
        value={value.title}
        onChange={(next) => onChange({ ...value, title: next })}
      />
      <AreaField
        label="Chamada"
        value={value.body}
        onChange={(next) => onChange({ ...value, body: next })}
        hint="Vazio esconde o parágrafo."
      />
    </>
  );
}

/** Prévia de uma linha, para o cabeçalho do editor mostrar o que está escrito. */
export function InlinePreview({ children }: { children: string }) {
  return (
    <span className="text-muted-foreground text-xs">
      <RichLine>{children}</RichLine>
    </span>
  );
}
