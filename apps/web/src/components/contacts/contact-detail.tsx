"use client";

import Link from "next/link";
import type {
  Company,
  Contact,
  Conversation,
  Deal,
  Pipeline,
  Tag,
  Task,
  TimelineEntry,
  User,
} from "@crm/core";
import {
  CONVERSATION_STATE_LABEL,
  formatCountdown,
  formatCurrencyCents,
  formatDate,
  formatPhone,
  formatRelative,
  LIFECYCLE_LABEL,
} from "@crm/core";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  KeyValue,
  ProgressBar,
  StatTile,
  TagChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@crm/ui";
import {
  ArrowLeft,
  Briefcase,
  CheckSquare,
  Fingerprint,
  MessageSquare,
  Phone,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { ChannelIcon, channelStyle } from "@/lib/channel";
import { ContactTimeline } from "./contact-timeline";

export function ContactDetail({
  contact,
  company,
  owner,
  timeline,
  conversations,
  deals,
  tasks,
  pipelines,
  tags,
  duplicateOfContact,
}: {
  contact: Contact;
  company?: Company | null;
  owner?: User;
  timeline: TimelineEntry[];
  conversations: Conversation[];
  deals: Deal[];
  tasks: Task[];
  pipelines: Pipeline[];
  tags: Tag[];
  duplicateOfContact?: Contact | null;
}) {
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const stageNameById = new Map(
    pipelines.flatMap((pipeline) =>
      pipeline.stages.map((stage) => [stage.id, stage.name] as const),
    ),
  );

  const openDeals = deals.filter((deal) => deal.probability > 0 && deal.probability < 100);
  const wonDeals = deals.filter((deal) => deal.probability === 100);
  const openTasks = tasks.filter((task) => task.status === "aberta");
  const marketingConsent = contact.consents.find((consent) => consent.purpose === "marketing");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho */}
      <header className="border-border bg-surface shrink-0 border-b px-5 py-4">
        <Button asChild variant="ghost" size="xs" className="-ml-2 mb-2">
          <Link href="/contatos">
            <ArrowLeft />
            Voltar para contatos
          </Link>
        </Button>

        <div className="flex flex-wrap items-start gap-4">
          <Avatar initials={contact.avatarInitials} hue={contact.accentHue} size="xl" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">{contact.fullName}</h1>
              <Badge variant={contact.lifecycleStage === "cliente" ? "success" : "info"}>
                {LIFECYCLE_LABEL[contact.lifecycleStage]}
              </Badge>
              <Tooltip content="Score de engajamento — campo derivado, não editável manualmente.">
                <Badge variant="outline">
                  <Sparkles aria-hidden />
                  score {contact.score}
                </Badge>
              </Tooltip>
            </div>

            <p className="text-muted-foreground mt-0.5 text-sm">
              {[
                contact.jobTitle,
                company?.name,
                contact.city && `${contact.city} · ${contact.state}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {contact.tagIds.map((tagId) => {
                const tag = tagById.get(tagId);
                return tag ? <TagChip key={tag.id} name={tag.name} hue={tag.hue} /> : null;
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm">
              <Phone />
              Registrar ligação
            </Button>
            <Button variant="outline" size="sm">
              <Pencil />
              Editar
            </Button>
            <Button size="sm" asChild>
              <Link href="/inbox">
                <MessageSquare />
                Abrir conversa
              </Link>
            </Button>
          </div>
        </div>

        {contact.duplicateOf ? (
          <Callout
            variant="warning"
            icon={<ShieldAlert />}
            title="Possível duplicidade"
            className="mt-3"
          >
            Este cadastro compartilha telefone com{" "}
            <Link href={`/contatos/${contact.duplicateOf}`} className="font-medium underline">
              {duplicateOfContact?.fullName ?? contact.duplicateOf}
            </Link>
            . A mesclagem é auditável e reversível — o histórico original nunca é apagado sem
            registro.
            <div className="mt-2 flex gap-2">
              <Button
                size="xs"
                onClick={() =>
                  toast.success("Mesclagem enviada para revisão", {
                    description:
                      "Um administrador precisa aprovar. A ação é reversível e fica registrada.",
                  })
                }
              >
                Revisar mesclagem
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => toast.info("Marcado como cadastros distintos")}
              >
                Não é duplicidade
              </Button>
            </div>
          </Callout>
        ) : null}
      </header>

      {/* Indicadores */}
      <div className="border-border bg-surface grid shrink-0 grid-cols-2 gap-2 border-b px-5 pb-4 md:grid-cols-4">
        <StatTile
          label="Negócios em aberto"
          value={String(openDeals.length)}
          hint={formatCurrencyCents(openDeals.reduce((total, deal) => total + deal.amountCents, 0))}
          icon={<Briefcase />}
        />
        <StatTile
          label="Conversas"
          value={String(conversations.length)}
          hint="em todos os canais"
          icon={<MessageSquare />}
        />
        <StatTile label="Tarefas abertas" value={String(openTasks.length)} icon={<CheckSquare />} />
        <StatTile
          label="Receita ganha"
          value={formatCurrencyCents(wonDeals.reduce((total, deal) => total + deal.amountCents, 0))}
          hint={`${wonDeals.length} negócios`}
        />
      </div>

      {/* Conteúdo */}
      <Tabs defaultValue="visao" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="bg-surface shrink-0 px-5">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="timeline">
            Linha do tempo
            <Badge variant="neutral">{timeline.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="conversas">
            Conversas
            <Badge variant="neutral">{conversations.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="negocios">
            Negócios
            <Badge variant="neutral">{deals.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="identidade">Identidade e consentimento</TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Visão geral */}
          <TabsContent value="visao" className="m-0 p-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Dados cadastrais</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl>
                    {contact.phone ? (
                      <KeyValue label="Telefone" value={formatPhone(contact.phone)} mono />
                    ) : null}
                    {contact.email ? <KeyValue label="E-mail" value={contact.email} /> : null}
                    {contact.jobTitle ? <KeyValue label="Cargo" value={contact.jobTitle} /> : null}
                    {company ? <KeyValue label="Empresa" value={company.name} /> : null}
                    {company?.document ? (
                      <KeyValue label="CNPJ" value={company.document} mono />
                    ) : null}
                    {contact.city ? (
                      <KeyValue label="Localidade" value={`${contact.city} · ${contact.state}`} />
                    ) : null}
                    {owner ? <KeyValue label="Proprietário" value={owner.name} /> : null}
                    <KeyValue label="Criado em" value={formatDate(contact.createdAt)} />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Origem e engajamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl>
                    <KeyValue
                      label="Canal de origem"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <ChannelIcon kind={contact.originChannel} className="size-3" />
                          {channelStyle(contact.originChannel).label}
                        </span>
                      }
                    />
                    <KeyValue label="Campanha" value={contact.originCampaign ?? "Contato direto"} />
                    {contact.lastInteractionAt ? (
                      <KeyValue
                        label="Última interação"
                        value={formatRelative(contact.lastInteractionAt)}
                      />
                    ) : null}
                  </dl>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">Score de engajamento</span>
                      <span className="text-xs font-semibold tabular-nums">
                        {contact.score}/100
                      </span>
                    </div>
                    <ProgressBar
                      value={contact.score}
                      tone={
                        contact.score >= 70 ? "success" : contact.score >= 40 ? "accent" : "warning"
                      }
                      label="Score de engajamento"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Campos personalizados</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl>
                    {contact.customFields.map((field) => (
                      <KeyValue
                        key={field.key}
                        label={field.derived ? `${field.label} (derivado)` : field.label}
                        value={field.value}
                      />
                    ))}
                  </dl>
                  <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                    Campos derivados não são editáveis manualmente: eles registram a regra e a data
                    de cálculo.
                  </p>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Tarefas</CardTitle>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Nenhuma tarefa vinculada a este contato.
                    </p>
                  ) : (
                    <ul className="divide-border divide-y">
                      {tasks.map((task) => (
                        <li key={task.id} className="flex items-center gap-3 py-2">
                          <CheckSquare
                            className={
                              task.status === "concluida"
                                ? "text-success size-4 shrink-0"
                                : "text-muted-foreground size-4 shrink-0"
                            }
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">{task.title}</span>
                            <span className="text-muted-foreground block text-[11px]">
                              {task.kind} · {formatDate(task.dueAt)}
                            </span>
                          </span>
                          <Badge
                            variant={
                              task.status === "concluida"
                                ? "success"
                                : formatCountdown(task.dueAt).startsWith("atrasado")
                                  ? "danger"
                                  : "neutral"
                            }
                          >
                            {task.status === "concluida"
                              ? "concluída"
                              : formatCountdown(task.dueAt)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Consentimento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {contact.consents.map((consent) => {
                    const granted = consent.status === "concedido";
                    return (
                      <div
                        key={consent.id}
                        className="border-border flex items-center gap-2 rounded-md border px-2.5 py-2"
                      >
                        {granted ? (
                          <ShieldCheck className="text-success size-4 shrink-0" aria-hidden />
                        ) : (
                          <ShieldAlert className="text-destructive size-4 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium capitalize">
                            {consent.purpose}
                          </span>
                          <span className="text-muted-foreground block truncate text-[11px]">
                            {consent.source}
                          </span>
                        </span>
                        <Badge variant={granted ? "success" : "danger"}>{consent.status}</Badge>
                      </div>
                    );
                  })}
                  {marketingConsent?.status !== "concedido" ? (
                    <p className="text-muted-foreground pt-1 text-[11px] leading-relaxed">
                      Sem consentimento de marketing, campanhas e jornadas promocionais excluem este
                      contato automaticamente.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Linha do tempo */}
          <TabsContent value="timeline" className="m-0">
            <ContactTimeline entries={timeline} />
          </TabsContent>

          {/* Conversas */}
          <TabsContent value="conversas" className="m-0 p-5">
            {conversations.length === 0 ? (
              <EmptyState
                icon={<MessageSquare />}
                title="Nenhuma conversa registrada"
                description="Quando o contato escrever por qualquer canal, o atendimento aparecerá aqui com todo o histórico."
              />
            ) : (
              <ul className="space-y-2">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      href="/inbox"
                      className="border-border bg-card shadow-card hover:border-accent/40 flex items-start gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <ChannelIcon kind={conversation.channel} withBackground />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-xs font-medium">
                            {conversation.subject}
                          </span>
                          <Badge variant="neutral">
                            {CONVERSATION_STATE_LABEL[conversation.state]}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
                          {conversation.lastMessagePreview}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                        {formatRelative(conversation.lastMessageAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Negócios */}
          <TabsContent value="negocios" className="m-0 p-5">
            {deals.length === 0 ? (
              <EmptyState
                icon={<Briefcase />}
                title="Nenhum negócio"
                description="Crie um negócio para acompanhar valor, etapa, probabilidade e previsão de fechamento."
                action={
                  <Button size="sm" asChild>
                    <Link href="/pipeline">Abrir pipeline</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {deals.map((deal) => (
                  <li
                    key={deal.id}
                    className="border-border bg-card shadow-card flex items-start gap-3 rounded-lg border p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{deal.title}</span>
                      <span className="text-muted-foreground mt-0.5 block text-[11px]">
                        {deal.product} · previsão {formatDate(deal.expectedCloseDate)}
                      </span>
                      {deal.lostReason ? (
                        <span className="text-destructive mt-1 block text-[11px]">
                          Motivo da perda: {deal.lostReason}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="text-primary block text-sm font-semibold tabular-nums">
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
                        {stageNameById.get(deal.stageId) ?? deal.stageId}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Identidade e consentimento */}
          <TabsContent value="identidade" className="m-0 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Identificadores</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-3 text-[11px] leading-relaxed">
                    A identidade não depende apenas do e-mail. Telefone normalizado, e-mail
                    normalizado, IDs externos e identificadores de canal alimentam o grafo de
                    identidade.
                  </p>
                  <ul className="divide-border divide-y">
                    {contact.identifiers.map((identifier) => (
                      <li key={identifier.id} className="flex items-center gap-2 py-2">
                        <Fingerprint
                          className="text-muted-foreground size-3.5 shrink-0"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium capitalize">
                            {identifier.kind}
                          </span>
                          <span className="text-muted-foreground block truncate font-mono text-[11px]">
                            {identifier.value}
                          </span>
                        </span>
                        {identifier.primary ? <Badge variant="primary">principal</Badge> : null}
                        <Badge variant={identifier.verified ? "success" : "warning"}>
                          {identifier.verified ? "verificado" : "não verificado"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Consentimentos e bases legais</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-border divide-y">
                    {contact.consents.map((consent) => (
                      <li key={consent.id} className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium capitalize">{consent.purpose}</span>
                          <ChannelIcon kind={consent.channel} withBackground />
                          <Badge
                            variant={consent.status === "concedido" ? "success" : "danger"}
                            className="ml-auto"
                          >
                            {consent.status}
                          </Badge>
                        </div>
                        <dl className="mt-1">
                          <KeyValue label="Base legal" value={consent.legalBasis} />
                          <KeyValue label="Fonte" value={consent.source} />
                          <KeyValue label="Versão do texto" value={consent.version} />
                          <KeyValue label="Registrado em" value={formatDate(consent.occurredAt)} />
                        </dl>
                        {consent.acceptedText ? (
                          <p className="bg-muted text-muted-foreground mt-1 rounded-md px-2 py-1.5 text-[11px] italic leading-relaxed">
                            “{consent.acceptedText}”
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
