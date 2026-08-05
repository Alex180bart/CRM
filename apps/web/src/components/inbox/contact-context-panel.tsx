import Link from "next/link";
import type { Company, Contact, Deal, Tag, User } from "@crm/core";
import {
  formatCurrencyCents,
  formatPhone,
  formatRelative,
  LIFECYCLE_LABEL,
  maskDocument,
} from "@crm/core";
import { Avatar, Badge, Button, KeyValue, Separator, TagChip, Tooltip, cn } from "@crm/ui";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const LIFECYCLE_TONE: Record<string, "neutral" | "info" | "success" | "accent" | "warning"> = {
  visitante: "neutral",
  lead: "info",
  lead_qualificado: "info",
  oportunidade: "accent",
  cliente: "success",
  aluno: "success",
  inativo: "neutral",
};

export function ContactContextPanel({
  contact,
  company,
  owner,
  deals,
  tagById,
  conversationCount,
  className,
}: {
  contact: Contact;
  company?: Company;
  owner?: User;
  deals: Deal[];
  tagById: Map<string, Tag>;
  conversationCount: number;
  className?: string;
}) {
  const marketingConsent = contact.consents.find((consent) => consent.purpose === "marketing");
  const document = contact.identifiers.find((item) => item.kind === "cpf");
  const openDeals = deals.filter((deal) => deal.probability > 0 && deal.probability < 100);

  return (
    // O enquadramento — largura, borda e rolagem — é de quem hospeda o painel:
    // hoje uma aba da coluna da direita, e antes uma coluna própria. Fixá-lo
    // aqui foi o que impediu o reaproveitamento na primeira tentativa.
    <div className={cn("flex flex-col", className)}>
      <div className="border-border border-b p-4">
        <div className="flex items-start gap-3">
          <Avatar initials={contact.avatarInitials} hue={contact.accentHue} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{contact.fullName}</p>
            {contact.jobTitle ? (
              <p className="text-muted-foreground truncate text-xs">{contact.jobTitle}</p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <Badge variant={LIFECYCLE_TONE[contact.lifecycleStage] ?? "neutral"}>
                {LIFECYCLE_LABEL[contact.lifecycleStage]}
              </Badge>
              <Tooltip content="Score de engajamento calculado a partir de interações, campanhas e negócios.">
                <Badge variant="outline">
                  <Sparkles aria-hidden />
                  {contact.score}
                </Badge>
              </Tooltip>
            </div>
          </div>
        </div>

        {contact.duplicateOf ? (
          <div className="bg-warning-soft mt-3 flex items-start gap-2 rounded-md px-2.5 py-2">
            <ShieldAlert className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p className="text-foreground text-[11px] leading-relaxed">
              Possível duplicidade detectada pelo motor de identidade. Mesclagem pendente de
              revisão.
            </p>
          </div>
        ) : null}

        <Button asChild variant="outline" size="sm" className="mt-3 w-full">
          <Link href={`/contatos/${contact.id}`}>
            Abrir contato 360º
            <ArrowUpRight />
          </Link>
        </Button>
      </div>

      <section className="p-4">
        <h3 className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
          Dados
        </h3>
        <dl>
          {contact.phone ? (
            <KeyValue label="Telefone" value={formatPhone(contact.phone)} mono />
          ) : null}
          {contact.email ? <KeyValue label="E-mail" value={contact.email} /> : null}
          {/* Documento é o campo que o escritório mais precisa e o que mais falta.
              Mostrado mascarado; o valor inteiro fica no Contato 360º. */}
          {document ? (
            <KeyValue
              label="Documento"
              value={
                <span className="inline-flex items-center gap-1">
                  {maskDocument(document.value)}
                  {document.verified ? null : (
                    <Tooltip content="Informado em conversa, ainda não verificado.">
                      <ShieldAlert className="text-warning size-3" aria-hidden />
                    </Tooltip>
                  )}
                </span>
              }
              mono
            />
          ) : null}
          {company ? (
            <KeyValue
              label="Empresa"
              value={
                <span className="inline-flex items-center gap-1">
                  <Building2 className="text-muted-foreground size-3" aria-hidden />
                  {company.name}
                </span>
              }
            />
          ) : null}
          {contact.city ? (
            <KeyValue label="Cidade" value={`${contact.city} · ${contact.state}`} />
          ) : null}
          {owner ? <KeyValue label="Proprietário" value={owner.name} /> : null}
          <KeyValue label="Origem" value={contact.originCampaign ?? "Contato direto"} />
          {contact.lastInteractionAt ? (
            <KeyValue label="Última interação" value={formatRelative(contact.lastInteractionAt)} />
          ) : null}
        </dl>
      </section>

      <Separator />

      <section className="p-4">
        <h3 className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
          Tags
        </h3>
        {contact.tagIds.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nenhuma tag aplicada.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {contact.tagIds.map((tagId) => {
              const tag = tagById.get(tagId);
              return tag ? <TagChip key={tag.id} name={tag.name} hue={tag.hue} /> : null;
            })}
          </div>
        )}
      </section>

      <Separator />

      <section className="p-4">
        <h3 className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
          Consentimento
        </h3>
        <div className="space-y-1.5">
          {contact.consents.map((consent) => {
            const granted = consent.status === "concedido";
            return (
              <div
                key={consent.id}
                className="bg-muted/50 flex items-center gap-2 rounded-md px-2.5 py-1.5"
              >
                {granted ? (
                  <ShieldCheck className="text-success size-3.5 shrink-0" aria-hidden />
                ) : (
                  <ShieldAlert className="text-destructive size-3.5 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium capitalize">{consent.purpose}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {consent.legalBasis} · {consent.version}
                  </span>
                </span>
                <Badge variant={granted ? "success" : "danger"}>{consent.status}</Badge>
              </div>
            );
          })}
        </div>
        {marketingConsent?.status !== "concedido" ? (
          <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
            Sem consentimento de marketing, este contato é excluído automaticamente de campanhas e
            jornadas promocionais.
          </p>
        ) : null}
      </section>

      <Separator />

      <section className="p-4">
        <h3 className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
          Negócios ({deals.length})
        </h3>
        {deals.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nenhum negócio registrado.</p>
        ) : (
          <div className="space-y-1.5">
            {deals.map((deal) => (
              <div key={deal.id} className="bg-muted/50 rounded-md p-2.5">
                <p className="truncate text-xs font-medium">{deal.title}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-primary text-xs font-semibold tabular-nums">
                    {formatCurrencyCents(deal.amountCents)}
                  </span>
                  <Badge
                    variant={
                      deal.probability === 100
                        ? "success"
                        : deal.probability === 0
                          ? "neutral"
                          : "info"
                    }
                  >
                    {deal.probability === 100 ? (
                      <>
                        <CheckCircle2 aria-hidden /> ganho
                      </>
                    ) : deal.probability === 0 ? (
                      "perdido"
                    ) : (
                      `${deal.probability}%`
                    )}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        {openDeals.length > 0 ? (
          <p className="text-muted-foreground mt-2 text-[11px]">
            {openDeals.length} em aberto ·{" "}
            {formatCurrencyCents(openDeals.reduce((total, deal) => total + deal.amountCents, 0))} no
            funil
          </p>
        ) : null}
      </section>

      <Separator />

      <section className="p-4">
        <h3 className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
          Campos personalizados
        </h3>
        <dl>
          {contact.customFields.map((field) => (
            <KeyValue
              key={field.key}
              label={field.derived ? `${field.label} (derivado)` : field.label}
              value={field.value}
            />
          ))}
          <KeyValue label="Conversas registradas" value={String(conversationCount)} />
        </dl>
      </section>
    </div>
  );
}
