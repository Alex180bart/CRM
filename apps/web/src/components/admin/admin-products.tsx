"use client";

import { useState } from "react";
import type { Product, ProductKind, ProductRecurrence } from "@elora/core";
import {
  CHECKOUT_MODE_LABEL,
  PRODUCT_KIND_LABEL,
  RECURRENCE_LABEL,
  RECURRENCE_SUFFIX,
  formatCurrencyCents,
  validateCheckoutBaseUrl,
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
  Switch,
  Textarea,
  Tooltip,
  cn,
} from "@elora/ui";
import { Info, Link2, Plus, ShieldAlert, Wallet } from "lucide-react";

import { ConfirmDelete, EditorShell, Field, RowActions } from "./admin-editors";

/**
 * Catálogo de produtos e serviços — seção 26.1 (P1).
 *
 * ## Três campos que parecem cadastro e são regra de negócio
 *
 * **Chave.** Vai gravada dentro de cada item de proposta e de cada evento. Por
 * isso o formulário a trava depois de criada, e o repositório recusa a troca:
 * renomear depois renomearia o passado pela metade.
 *
 * **Teto de desconto.** É o único número que decide se a proposta sai direto ou
 * espera o gestor. Zero significa preço de tabela e nada além — e é um valor
 * legítimo, não um campo esquecido.
 *
 * **Forma de pagamento.** `link` exige endereço, e o endereço é validado aqui
 * com a **mesma função** que monta o link no envio. Validar só na hora de enviar
 * deixaria o erro aparecer com o cliente esperando — o pior instante possível.
 *
 * ## Excluir é desativar quando já houve proposta
 *
 * A tela avisa antes. Sumir com o registro quebraria toda proposta que o cita: o
 * item guarda cópia do nome e do preço, mas o vínculo com o produto — e com ele
 * o relatório por produto — se perderia.
 */

interface MutationInput {
  entity: string;
  action: "criar" | "editar" | "excluir";
  id?: string;
  data?: Record<string, unknown>;
}

type Submit = (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;

const KINDS: ProductKind[] = ["servico", "produto"];
const RECURRENCES: ProductRecurrence[] = ["unico", "mensal", "trimestral", "semestral", "anual"];

/** "R$ 499,00" digitado vira 49900. Aceita ponto, vírgula e texto solto. */
function parseMoney(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatMoneyInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ProductsTab({
  products,
  onSubmit,
  busy,
}: {
  products: Product[];
  onSubmit: Submit;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<Product | "novo" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const active = products.filter((product) => product.active);
  const inactive = products.filter((product) => !product.active);

  return (
    <div className="space-y-4">
      <Reveal index={0}>
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>Comercial</Eyebrow>
              <h3 className="mt-1 text-base font-semibold">Produtos e serviços</h3>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                O que o time pode propor na conversa, com preço, o que está incluso e o teto de
                desconto que cada vendedor concede sozinho. A IA lê este catálogo para responder
                valores — e só ele.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral">
                {active.length} ativo{active.length === 1 ? "" : "s"}
              </Badge>
              <Button size="sm" className="press" disabled={busy} onClick={() => setEditing("novo")}>
                <Plus className="size-4" />
                Novo
              </Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {products.length === 0 ? (
              <Callout icon={<Info className="size-4" />}>
                Nenhum produto cadastrado. Enquanto o catálogo estiver vazio, o agente de IA não cita
                valor nenhum — de propósito.
              </Callout>
            ) : null}

            {[...active, ...inactive].map((product, index) => (
              <ProductRow
                key={product.id}
                product={product}
                index={index}
                onEdit={() => setEditing(product)}
                onDelete={() => setDeleting(product)}
              />
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal index={1}>
        <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
          <strong>A cobrança integrada ainda não existe.</strong> Produto no modo “ferramenta
          financeira integrada” é aceito e cadastrado, mas nenhuma proposta com ele gera link
          automático — não há provedor conectado, e não haverá antes do back-end. Para vender hoje,
          use o modo de link próprio, que funciona de ponta a ponta com o nome do vendedor embutido.
        </Callout>
      </Reveal>

      {editing ? (
        <ProductDialog
          key={editing === "novo" ? "novo" : editing.id}
          open
          onOpenChange={(next) => !next && setEditing(null)}
          product={editing === "novo" ? null : editing}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir ${deleting.name}?`}
          description="O produto sai do catálogo e deixa de aparecer na montagem de proposta."
          consequence="Se este produto já apareceu em alguma proposta, ele será desativado em vez de excluído — sumir com o registro quebraria o histórico daquelas vendas."
          onConfirm={async () => {
            const result = await onSubmit({
              entity: "produto",
              action: "excluir",
              id: deleting.id,
            });
            if (result.ok) setDeleting(null);
            return result;
          }}
        />
      ) : null}

    </div>
  );
}

function ProductRow({
  product,
  index,
  onEdit,
  onDelete,
}: {
  product: Product;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const CheckoutIcon = product.checkout.mode === "link" ? Link2 : Wallet;

  return (
    <div
      className={cn(
        "stagger hover:bg-muted/50 flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        !product.active && "opacity-60",
      )}
      style={{ "--stagger-index": Math.min(index, 8) } as React.CSSProperties}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <Badge variant="neutral">{PRODUCT_KIND_LABEL[product.kind]}</Badge>
          {product.active ? null : <Badge variant="warning">Inativo</Badge>}
        </div>
        <p className="text-muted-foreground truncate text-xs">{product.summary}</p>
      </div>

      <div className="text-right">
        <p className="figure text-sm font-semibold">
          {formatCurrencyCents(product.priceCents)}
          <span className="text-muted-foreground text-xs font-normal">
            {RECURRENCE_SUFFIX[product.recurrence]}
          </span>
        </p>
        <p className="text-muted-foreground text-[11px]">
          {product.maxDiscountPct === 0
            ? "sem desconto"
            : `teto ${product.maxDiscountPct}% de desconto`}
        </p>
      </div>

      <Tooltip content={CHECKOUT_MODE_LABEL[product.checkout.mode]}>
        <span className="text-muted-foreground">
          <CheckoutIcon className="size-4" aria-hidden />
        </span>
      </Tooltip>

      <RowActions
        onEdit={onEdit}
        onDelete={onDelete}
        editLabel="Editar produto"
        deleteLabel="Excluir produto"
      />
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  product,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSubmit: Submit;
}) {
  const [key, setKey] = useState(product?.key ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "servico");
  const [summary, setSummary] = useState(product?.summary ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(formatMoneyInput(product?.priceCents ?? 0));
  const [recurrence, setRecurrence] = useState<ProductRecurrence>(product?.recurrence ?? "unico");
  const [maxDiscount, setMaxDiscount] = useState(String(product?.maxDiscountPct ?? 0));
  const [includes, setIncludes] = useState((product?.includes ?? []).join("\n"));
  const [salesNotes, setSalesNotes] = useState(product?.salesNotes ?? "");
  const [mode, setMode] = useState(product?.checkout.mode ?? "link");
  const [baseUrl, setBaseUrl] = useState(product?.checkout.baseUrl ?? "");
  const [active, setActive] = useState(product?.active ?? true);

  /**
   * O aviso do endereço aparece **enquanto se digita**, com a mesma função que o
   * repositório usa para recusar. Duas réguas diferentes produziriam o par de
   * sempre: campo verde e gravação recusada.
   */
  const urlCheck = mode === "link" && baseUrl.trim() ? validateCheckoutBaseUrl(baseUrl) : null;

  return (
    <EditorShell
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={product ? `Editar ${product.name}` : "Novo produto ou serviço"}
      description="Preço, o que está incluso e como o cliente paga. O teto de desconto define o que sai sem passar pelo gestor."
      onSave={async () => {
        const data = {
          key,
          name,
          kind,
          summary,
          description,
          priceCents: parseMoney(price),
          recurrence,
          maxDiscountPct: Number(maxDiscount) || 0,
          includes: includes
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          salesNotes,
          checkout: { mode, baseUrl: mode === "link" ? baseUrl.trim() : undefined },
          active,
        };

        return onSubmit(
          product
            ? { entity: "produto", action: "editar", id: product.id, data }
            : { entity: "produto", action: "criar", data },
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field label="Chave">
          <Input
            value={key}
            disabled={Boolean(product)}
            onChange={(event) => setKey(event.target.value)}
            placeholder="abertura_mei"
          />
          {product ? (
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Não muda depois de criada: já está gravada em propostas e eventos.
            </p>
          ) : null}
        </Field>

        <Field label="Tipo">
          <Select value={kind} onValueChange={(value) => setKind(value as ProductKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((item) => (
                <SelectItem key={item} value={item}>
                  {PRODUCT_KIND_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Cobrança">
          <Select
            value={recurrence}
            onValueChange={(value) => setRecurrence(value as ProductRecurrence)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCES.map((item) => (
                <SelectItem key={item} value={item}>
                  {RECURRENCE_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Preço (R$)">
          <Input
            value={price}
            inputMode="decimal"
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => setPrice(formatMoneyInput(parseMoney(price)))}
          />
        </Field>

        <Field label="Teto de desconto (%)">
          <Input
            value={maxDiscount}
            inputMode="numeric"
            onChange={(event) => setMaxDiscount(event.target.value.replace(/[^\d]/g, ""))}
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Acima disso, a proposta espera o gestor. Zero é preço de tabela.
          </p>
        </Field>
      </div>

      <Field label="Resumo">
        <Input
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Uma linha, aparece no cartão da conversa."
        />
      </Field>

      <Field label="Descrição">
        <Textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <Field label="O que está incluso (um por linha)">
        <Textarea rows={3} value={includes} onChange={(event) => setIncludes(event.target.value)} />
      </Field>

      <Field label="Orientação para a IA (interna)">
        <Textarea
          rows={3}
          value={salesNotes}
          onChange={(event) => setSalesNotes(event.target.value)}
          placeholder="Argumentos, objeções conhecidas e o que não prometer."
        />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          O agente lê isto para se orientar e é instruído a nunca ler em voz alta. Não escreva aqui
          nada que não possa ser parafraseado ao cliente.
        </p>
      </Field>

      <div className="border-border space-y-3 border-t pt-3">
        <Label>Como o cliente paga</Label>
        <div className="flex flex-wrap gap-2">
          {(["link", "integrado"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={mode === item ? "primary" : "outline"}
              className="press"
              onClick={() => setMode(item)}
            >
              {item === "link" ? <Link2 className="size-4" /> : <Wallet className="size-4" />}
              {CHECKOUT_MODE_LABEL[item]}
            </Button>
          ))}
        </div>

        {mode === "link" ? (
          <Field label="Endereço de pagamento">
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://pagar.suaempresa.com.br/abertura-mei"
            />
            {urlCheck && !urlCheck.ok ? (
              <p className="text-destructive text-[11px] leading-relaxed">{urlCheck.reason}</p>
            ) : (
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Cadastre sem identificação de vendedor. O nome de quem vendeu é acrescentado no
                envio, junto do identificador da proposta e das UTMs.
              </p>
            )}
          </Field>
        ) : (
          <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
            Nenhum provedor financeiro está conectado. Este produto pode ser cadastrado e proposto,
            mas o link de pagamento não será gerado no aceite — alguém precisa enviá-lo à mão.
          </Callout>
        )}
      </div>

      <div className="border-border flex items-center justify-between border-t pt-3">
        <div>
          <p className="text-sm font-medium">Ativo</p>
          <p className="text-muted-foreground text-xs">
            Inativo some da montagem de proposta e da resposta da IA, e continua nas propostas
            antigas.
          </p>
        </div>
        <Switch checked={active} onCheckedChange={setActive} aria-label="Produto ativo" />
      </div>
    </EditorShell>
  );
}
