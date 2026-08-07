"use client";

import Link from "next/link";
import type { ChannelAccount } from "@crm/core";
import { CHANNEL_CATALOG, CHANNEL_READINESS_LABEL } from "@crm/core";
import { Badge, Button, Eyebrow, Tooltip, cn } from "@crm/ui";
import { ArrowUpRight, Ban, CircleAlert, Link2, Plus, TriangleAlert } from "lucide-react";

import { ChannelIcon } from "@/lib/channel";

/**
 * Catálogo de canais que dá para conectar.
 *
 * Fica acima da lista de contas já conectadas porque responde a outra pergunta.
 * A lista responde "o que está no ar"; o catálogo responde **"o que dá para
 * ligar, o que custa caro e o que não existe"** — que é a pergunta feita antes
 * de decidir onde investir esforço.
 *
 * Três decisões de desenho carregam o valor desta tela:
 *
 * 1. **O estado é por dificuldade, não por disponibilidade.** "Pronto para
 *    configurar", "depende da fundação" e "limitado pela plataforma" dizem o que
 *    fazer a seguir; um "em breve" para tudo não diz nada.
 * 2. **A ressalva é obrigatória.** Cada canal tem uma armadilha que não está na
 *    documentação, e é ela que decide o cronograma — o número que sai do
 *    aplicativo, a janela sem template do Instagram, a reputação de domínio no
 *    e-mail.
 * 3. **O que compartilha infraestrutura fica dito.** Depois do WhatsApp, ligar
 *    Instagram e Messenger é barato porque a conta, o app e o webhook já existem.
 *    Sem essa informação, a operação trata os três como três projetos.
 */
export function ChannelCatalog({ accounts }: { accounts: ChannelAccount[] }) {
  const connectedKinds = new Set(accounts.map((account) => account.kind));

  return (
    <div>
      <Eyebrow className="mb-2">Canais que dá para conectar</Eyebrow>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CHANNEL_CATALOG.map((blueprint) => {
          const connected = connectedKinds.has(blueprint.kind as ChannelAccount["kind"]);
          const restricted = blueprint.readiness === "restrito";

          return (
            <li
              key={blueprint.kind}
              className={cn(
                "bg-card shadow-card flex flex-col rounded-lg p-4",
                restricted && "opacity-80",
              )}
            >
              <div className="flex items-start gap-2.5">
                {/**
                 * O glifo de marca só aparece para canal que o produto conhece.
                 * LinkedIn e Telegram não estão em `ChannelKind` — desenhá-los
                 * com o ícone genérico é honesto: eles ainda não são canal aqui.
                 */}
                {isKnownKind(blueprint.kind) ? (
                  <ChannelIcon kind={blueprint.kind} withBackground />
                ) : (
                  <span
                    className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
                    aria-hidden
                  >
                    <Link2 className="size-4" />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-sm font-semibold">{blueprint.label}</h3>
                    {connected ? (
                      <Badge variant="success">no ar</Badge>
                    ) : (
                      <Badge
                        variant={
                          blueprint.readiness === "disponivel"
                            ? "primary"
                            : blueprint.readiness === "restrito"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {restricted ? <Ban aria-hidden /> : null}
                        {CHANNEL_READINESS_LABEL[blueprint.readiness]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                    {blueprint.purpose}
                  </p>
                </div>
              </div>

              <p className="text-muted-foreground mt-2.5 text-[11px]">
                <span className="font-medium">Por trás:</span> {blueprint.provider}
              </p>

              <ul className="text-muted-foreground mt-2 space-y-0.5">
                {blueprint.requirements.map((requirement) => (
                  <li key={requirement} className="flex gap-1.5 text-[11px] leading-relaxed">
                    <span aria-hidden>·</span>
                    {requirement}
                  </li>
                ))}
              </ul>

              {/**
               * A ressalva usa o tom de alerta mesmo quando o canal está pronto.
               * Ela não é sobre o estado da integração: é sobre o que dói depois
               * de conectar, e é a parte que costuma ser lida tarde demais.
               */}
              <p
                className={cn(
                  "mt-2.5 flex gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-relaxed",
                  restricted ? "bg-destructive-soft" : "bg-warning-soft",
                )}
              >
                {restricted ? (
                  <CircleAlert className="text-destructive mt-0.5 size-3 shrink-0" aria-hidden />
                ) : (
                  <TriangleAlert className="text-warning mt-0.5 size-3 shrink-0" aria-hidden />
                )}
                {blueprint.caveat}
              </p>

              {blueprint.sharesInfraWith?.length ? (
                <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
                  Usa a mesma infraestrutura de {blueprint.sharesInfraWith.join(" e ")} — conectado
                  um, os outros saem quase de graça.
                </p>
              ) : null}

              <div className="mt-auto pt-3">
                {blueprint.setupHref ? (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={blueprint.setupHref}>
                      {connected ? "Gerenciar" : "Configurar"}
                      <ArrowUpRight />
                    </Link>
                  </Button>
                ) : (
                  <Tooltip
                    content={
                      restricted
                        ? "A plataforma não oferece o que este caso pede."
                        : "A configuração entra junto com a fundação de back-end."
                    }
                  >
                    <span className="block">
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        <Plus />
                        Conectar
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Os canais que o modelo de dados já conhece — os demais são plano, não produto. */
function isKnownKind(kind: string): kind is ChannelAccount["kind"] {
  return [
    "whatsapp",
    "email",
    "instagram",
    "messenger",
    "webchat",
    "form",
    "phone",
    "internal",
  ].includes(kind);
}
