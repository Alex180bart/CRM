"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Company, Contact, LifecycleStage, Tag, User } from "@crm/core";
import { formatNumber, formatPhone, formatRelative, LIFECYCLE_LABEL } from "@crm/core";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  EmptyState,
  ProgressBar,
  SearchInput,
  TagChip,
  Tooltip,
  cn,
} from "@crm/ui";
import {
  Building2,
  ChevronDown,
  Copy,
  Download,
  LayoutGrid,
  Rows3,
  ShieldAlert,
  Tags,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ChannelIcon } from "@/lib/channel";
import { Metric, MetricStrip } from "@/components/shell/metric-strip";

const LIFECYCLE_TONE: Record<LifecycleStage, "neutral" | "info" | "success" | "accent"> = {
  visitante: "neutral",
  lead: "info",
  lead_qualificado: "info",
  oportunidade: "accent",
  cliente: "success",
  aluno: "success",
  inativo: "neutral",
};

const STAGES: LifecycleStage[] = [
  "lead",
  "lead_qualificado",
  "oportunidade",
  "cliente",
  "aluno",
  "inativo",
];

type SortKey = "nome" | "score" | "interacao";

/** Filtro aplicado, removível com um clique. */
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-primary-soft text-primary flex items-center gap-1 rounded-md py-1 pl-2 pr-1 text-[11px] font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="hover:bg-primary/15 rounded p-0.5 transition-colors"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

export function ContactsTable({
  contacts,
  companies,
  users,
  tags,
}: {
  contacts: Contact[];
  companies: Company[];
  users: User[];
  tags: Tag[];
}) {
  const [search, setSearch] = useState("");
  const [stages, setStages] = useState<LifecycleStage[]>([]);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [sort, setSort] = useState<SortKey>("interacao");
  const [selected, setSelected] = useState<string[]>([]);
  /**
   * Tabela para conferir, cartão para conhecer. Quem procura um contato conhecido
   * quer a linha densa; quem está entendendo a carteira quer ver rosto, empresa e
   * tags juntos. Não é preferência estética: são duas tarefas diferentes.
   */
  const [view, setView] = useState<"tabela" | "cartoes">("tabela");

  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);
  const userById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const tagById = useMemo(() => new Map(tags.map((item) => [item.id, item])), [tags]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = contacts.filter((contact) => {
      if (onlyDuplicates && !contact.duplicateOf) return false;
      if (stages.length > 0 && !stages.includes(contact.lifecycleStage)) return false;
      if (ownerIds.length > 0 && (!contact.ownerId || !ownerIds.includes(contact.ownerId)))
        return false;
      if (tagIds.length > 0 && !tagIds.some((tagId) => contact.tagIds.includes(tagId)))
        return false;
      if (term) {
        const company = contact.companyId ? companyById.get(contact.companyId)?.name : "";
        const haystack = [contact.fullName, contact.email, contact.phone, contact.city, company]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sort === "nome") return a.fullName.localeCompare(b.fullName, "pt-BR");
      if (sort === "score") return b.score - a.score;
      return (
        Date.parse(b.lastInteractionAt ?? b.updatedAt) -
        Date.parse(a.lastInteractionAt ?? a.updatedAt)
      );
    });
  }, [contacts, search, stages, ownerIds, tagIds, onlyDuplicates, sort, companyById]);

  const duplicateCount = contacts.filter((contact) => contact.duplicateOf).length;
  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const clientCount = contacts.filter(
    (contact) => contact.lifecycleStage === "cliente" || contact.lifecycleStage === "aluno",
  ).length;
  const hotCount = contacts.filter((contact) => contact.score >= 70).length;
  const activeFilters = stages.length + ownerIds.length + tagIds.length + (onlyDuplicates ? 1 : 0);

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function clearFilters() {
    setStages([]);
    setOwnerIds([]);
    setTagIds([]);
    setOnlyDuplicates(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MetricStrip className="shadow-inset-hairline border-b-0">
        <Metric label="contatos" value={formatNumber(contacts.length)} />
        <Metric label="clientes e alunos" value={formatNumber(clientCount)} tone="success" />
        <Metric label="score alto" value={formatNumber(hotCount)} tone="accent" hint="70 ou mais" />
        <Metric
          label="duplicidades"
          value={formatNumber(duplicateCount)}
          tone={duplicateCount > 0 ? "warning" : "neutral"}
        />
      </MetricStrip>

      {/* Barra de filtros */}
      <div className="bg-surface shadow-inset-hairline flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder="Buscar por nome, e-mail, telefone, empresa ou cidade"
          className="w-80"
          aria-label="Buscar contatos"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Estágio
              {stages.length > 0 ? <Badge variant="primary">{stages.length}</Badge> : null}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Ciclo de vida</DropdownMenuLabel>
            {STAGES.map((stage) => (
              <DropdownMenuItem
                key={stage}
                onSelect={(event) => {
                  event.preventDefault();
                  toggle(stages, stage, setStages);
                }}
              >
                <Checkbox checked={stages.includes(stage)} tabIndex={-1} />
                {LIFECYCLE_LABEL[stage]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Proprietário
              {ownerIds.length > 0 ? <Badge variant="primary">{ownerIds.length}</Badge> : null}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Responsável pelo contato</DropdownMenuLabel>
            {users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onSelect={(event) => {
                  event.preventDefault();
                  toggle(ownerIds, user.id, setOwnerIds);
                }}
              >
                <Checkbox checked={ownerIds.includes(user.id)} tabIndex={-1} />
                <Avatar initials={user.initials} hue={user.accentHue} size="xs" />
                {user.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Tags />
              Tags
              {tagIds.length > 0 ? <Badge variant="primary">{tagIds.length}</Badge> : null}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Tags aplicadas</DropdownMenuLabel>
            {tags.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onSelect={(event) => {
                  event.preventDefault();
                  toggle(tagIds, tag.id, setTagIds);
                }}
              >
                <Checkbox checked={tagIds.includes(tag.id)} tabIndex={-1} />
                <TagChip name={tag.name} hue={tag.hue} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip content="Cadastros que o motor de identidade marcou como possível duplicidade.">
          <Button
            variant={onlyDuplicates ? "accent" : "outline"}
            size="sm"
            onClick={() => setOnlyDuplicates((value) => !value)}
          >
            <Copy />
            Duplicidades
            <Badge variant={onlyDuplicates ? "neutral" : "warning"}>{duplicateCount}</Badge>
          </Button>
        </Tooltip>

        <div className="ml-auto flex items-center gap-2">
          {/* Alternador de visão */}
          <div className="bg-muted flex items-center rounded-md p-0.5">
            {(
              [
                { id: "tabela", label: "Tabela", icon: Rows3 },
                { id: "cartoes", label: "Cartões", icon: LayoutGrid },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <Tooltip key={option.id} content={`Ver em ${option.label.toLowerCase()}`}>
                  <button
                    type="button"
                    onClick={() => setView(option.id)}
                    aria-pressed={view === option.id}
                    aria-label={`Ver em ${option.label.toLowerCase()}`}
                    className={cn(
                      "flex size-7 items-center justify-center rounded transition-colors",
                      view === option.id
                        ? "bg-card text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </button>
                </Tooltip>
              );
            })}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Ordenar:{" "}
                {sort === "nome" ? "nome" : sort === "score" ? "score" : "última interação"}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSort("interacao")}>
                Última interação
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("nome")}>Nome</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort("score")}>Score</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info("Exportação registrada em auditoria", {
                description: `${filtered.length} contatos seriam exportados. Toda exportação grava autor, filtro e horário.`,
              })
            }
          >
            <Download />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filtros ativos: sem esta linha, um filtro esquecido dentro de um menu
          faz a lista parecer vazia sem explicação. */}
      {activeFilters > 0 ? (
        <div className="bg-surface shadow-inset-hairline flex shrink-0 flex-wrap items-center gap-1.5 px-4 py-2">
          <span className="text-muted-foreground text-[11px]">Filtrando por</span>

          {stages.map((stage) => (
            <FilterChip
              key={stage}
              label={LIFECYCLE_LABEL[stage]}
              onRemove={() => toggle(stages, stage, setStages)}
            />
          ))}
          {ownerIds.map((ownerId) => (
            <FilterChip
              key={ownerId}
              label={userById.get(ownerId)?.name ?? ownerId}
              onRemove={() => toggle(ownerIds, ownerId, setOwnerIds)}
            />
          ))}
          {tagIds.map((tagId) => (
            <FilterChip
              key={tagId}
              label={tagById.get(tagId)?.name ?? tagId}
              onRemove={() => toggle(tagIds, tagId, setTagIds)}
            />
          ))}
          {onlyDuplicates ? (
            <FilterChip label="Só duplicidades" onRemove={() => setOnlyDuplicates(false)} />
          ) : null}

          <Button variant="ghost" size="xs" className="ml-1" onClick={clearFilters}>
            Limpar tudo
          </Button>
        </div>
      ) : null}

      {/* Ações em massa */}
      {selected.length > 0 ? (
        <div className="bg-primary-soft shadow-inset-hairline flex shrink-0 items-center gap-2 px-4 py-2">
          <Users className="text-primary size-4" aria-hidden />
          <span className="text-primary text-xs font-medium">
            {selected.length}{" "}
            {selected.length === 1 ? "contato selecionado" : "contatos selecionados"}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                toast.success("Tag aplicada em massa", {
                  description: `${selected.length} contatos atualizados. Cada alteração gera evento contact.tagged.`,
                })
              }
            >
              <Tags />
              Aplicar tag
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                toast.success("Proprietário alterado", {
                  description: `${selected.length} contatos redistribuídos conforme a regra da equipe.`,
                })
              }
            >
              <UserCog />
              Alterar proprietário
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setSelected([])}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Tabela */}
      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Nenhum contato encontrado"
            description="Ajuste a busca ou os filtros. Contatos são criados por formulários, campanhas, mensagens recebidas e importação controlada."
          />
        ) : view === "cartoes" ? (
          <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((contact) => {
              const company = contact.companyId ? companyById.get(contact.companyId) : undefined;
              const owner = contact.ownerId ? userById.get(contact.ownerId) : undefined;

              return (
                <li key={contact.id}>
                  <Link
                    href={`/contatos/${contact.id}`}
                    className="lift press bg-card shadow-card focus-visible:ring-accent group flex h-full flex-col rounded-lg p-4 focus-visible:outline-none focus-visible:ring-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar initials={contact.avatarInitials} hue={contact.accentHue} size="md" />
                      <div className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="group-hover:text-primary truncate text-sm font-medium">
                            {contact.fullName}
                          </span>
                          {contact.duplicateOf ? (
                            <ShieldAlert className="text-warning size-3.5 shrink-0" aria-hidden />
                          ) : null}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                          <ChannelIcon kind={contact.originChannel} className="size-3" />
                          {contact.phone ? formatPhone(contact.phone) : contact.email}
                        </span>
                      </div>
                      <Badge variant={LIFECYCLE_TONE[contact.lifecycleStage]}>
                        {LIFECYCLE_LABEL[contact.lifecycleStage]}
                      </Badge>
                    </div>

                    {company ? (
                      <span className="text-muted-foreground mt-2.5 flex items-center gap-1.5 text-[11px]">
                        <Building2 className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{company.name}</span>
                      </span>
                    ) : null}

                    <div className="mt-3">
                      <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px]">
                        <span>Score de engajamento</span>
                        <span className="tabular-nums">{contact.score}</span>
                      </div>
                      <ProgressBar
                        value={contact.score}
                        tone={
                          contact.score >= 70
                            ? "success"
                            : contact.score >= 40
                              ? "accent"
                              : "warning"
                        }
                        label={`Score ${contact.score}`}
                      />
                    </div>

                    {contact.tagIds.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {contact.tagIds.slice(0, 3).map((tagId) => {
                          const tag = tagById.get(tagId);
                          return tag ? (
                            <TagChip key={tag.id} name={tag.name} hue={tag.hue} />
                          ) : null;
                        })}
                        {contact.tagIds.length > 3 ? (
                          <span className="text-muted-foreground text-[11px]">
                            +{contact.tagIds.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="text-muted-foreground mt-auto flex items-center justify-between gap-2 pt-3 text-[11px]">
                      {owner ? (
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
                          <span className="truncate">{owner.name}</span>
                        </span>
                      ) : (
                        <span>sem responsável</span>
                      )}
                      <span className="shrink-0 tabular-nums">
                        {contact.lastInteractionAt
                          ? formatRelative(contact.lastInteractionAt)
                          : "—"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface-sunken sticky top-0 z-10 text-left">
              <tr className="shadow-inset-hairline">
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelected(checked === true ? filtered.map((contact) => contact.id) : [])
                    }
                    aria-label="Selecionar todos os contatos filtrados"
                  />
                </th>
                <th className="text-muted-foreground px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Contato
                </th>
                <th className="text-muted-foreground px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Empresa
                </th>
                <th className="text-muted-foreground px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Estágio
                </th>
                <th className="text-muted-foreground px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Score
                </th>
                <th className="text-muted-foreground px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Proprietário
                </th>
                <th className="text-muted-foreground px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
                  Tags
                </th>
                <th className="text-muted-foreground px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide">
                  Última interação
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => {
                const company = contact.companyId ? companyById.get(contact.companyId) : undefined;
                const owner = contact.ownerId ? userById.get(contact.ownerId) : undefined;
                const checked = selected.includes(contact.id);

                return (
                  <tr
                    key={contact.id}
                    className={cn(
                      "shadow-inset-hairline hover:bg-muted/50 group transition-colors",
                      checked && "bg-accent-soft/40",
                    )}
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(selected, contact.id, setSelected)}
                        aria-label={`Selecionar ${contact.fullName}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/contatos/${contact.id}`} className="flex items-center gap-2.5">
                        <Avatar
                          initials={contact.avatarInitials}
                          hue={contact.accentHue}
                          size="sm"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="group-hover:text-primary truncate font-medium">
                              {contact.fullName}
                            </span>
                            {contact.duplicateOf ? (
                              <Tooltip content="Possível duplicidade — mesclagem pendente de revisão.">
                                <ShieldAlert className="text-warning size-3.5 shrink-0" />
                              </Tooltip>
                            ) : null}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                            <ChannelIcon kind={contact.originChannel} className="size-3" />
                            {contact.phone ? formatPhone(contact.phone) : contact.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="max-w-40 px-3 py-2">
                      <span className="text-muted-foreground block truncate text-xs">
                        {company?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={LIFECYCLE_TONE[contact.lifecycleStage]}>
                        {LIFECYCLE_LABEL[contact.lifecycleStage]}
                      </Badge>
                    </td>
                    <td className="w-24 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-xs font-medium tabular-nums">
                          {contact.score}
                        </span>
                        <ProgressBar
                          value={contact.score}
                          tone={
                            contact.score >= 70
                              ? "success"
                              : contact.score >= 40
                                ? "accent"
                                : "warning"
                          }
                          className="w-12"
                          label={`Score ${contact.score}`}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {owner ? (
                        <span className="flex items-center gap-1.5">
                          <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
                          <span className="truncate text-xs">{owner.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="max-w-44 px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {contact.tagIds.slice(0, 2).map((tagId) => {
                          const tag = tagById.get(tagId);
                          return tag ? (
                            <TagChip key={tag.id} name={tag.name} hue={tag.hue} />
                          ) : null;
                        })}
                        {contact.tagIds.length > 2 ? (
                          <span className="text-muted-foreground text-[11px]">
                            +{contact.tagIds.length - 2}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">
                      {contact.lastInteractionAt ? formatRelative(contact.lastInteractionAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-surface text-muted-foreground shadow-inset-hairline flex shrink-0 items-center justify-between px-4 py-2 text-[11px]">
        <span className="tabular-nums">
          {filtered.length} de {contacts.length} contatos
        </span>
        <span>
          Listas grandes usarão paginação e virtualização quando a base real for conectada.
        </span>
      </div>
    </div>
  );
}
