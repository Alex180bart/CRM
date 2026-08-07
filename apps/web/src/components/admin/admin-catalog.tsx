"use client";

import { useState } from "react";
import type {
  CannedResponse,
  ChannelKind,
  ClosingReason,
  CustomFieldDefinition,
  CustomFieldEntity,
  CustomFieldType,
  Queue,
  SkillDefinition,
  Tag,
  User,
} from "@crm/core";
import {
  CHANNEL_LABEL,
  CUSTOM_FIELD_ENTITY_LABEL,
  CUSTOM_FIELD_TYPE_LABEL,
  canDeleteSkill,
} from "@crm/core";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
} from "@crm/ui";
import { Lock, Plus, Sigma } from "lucide-react";

import { ConfirmDelete, EditorShell, Field, RowActions } from "./admin-editors";

/**
 * Catálogo: o vocabulário que a operação usa todo dia.
 *
 * ## Uma aba com sub-abas, e não cinco abas no topo
 *
 * Habilidade, motivo de encerramento, campo personalizado, tag e resposta
 * rápida são cinco listas pequenas que se editam raramente e quase sempre em
 * sequência ("vamos organizar o catálogo"). Cinco abas de primeiro nível
 * empurrariam Auditoria e Políticas para fora da vista em telas estreitas, e
 * a navegação do módulo passaria a ser mais longa que qualquer uma das listas.
 *
 * ## A chave aparece na tela, sempre
 *
 * É ela que fica gravada no registro, é ela que a fila exige, e é ela que
 * ninguém consegue mudar depois. Esconder atrás do rótulo bonito faria a
 * pessoa descobrir a diferença só quando a distribuição parasse.
 */

interface MutationInput {
  entity: string;
  action: "criar" | "editar" | "excluir";
  id?: string;
  data?: Record<string, unknown>;
}

type Submit = (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;

/** Sugere a chave a partir do rótulo, sem impor: quem quiser, edita. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function CatalogTab({
  skills,
  closingReasons,
  customFields,
  tags,
  cannedResponses,
  queues,
  users,
  onSubmit,
}: {
  skills: SkillDefinition[];
  closingReasons: ClosingReason[];
  customFields: CustomFieldDefinition[];
  tags: Tag[];
  cannedResponses: CannedResponse[];
  queues: Queue[];
  users: User[];
  onSubmit: Submit;
}) {
  return (
    <Tabs defaultValue="habilidades">
      <TabsList className="mb-3">
        <TabsTrigger value="habilidades">Competências</TabsTrigger>
        <TabsTrigger value="motivos">Motivos de encerramento</TabsTrigger>
        <TabsTrigger value="campos">Campos personalizados</TabsTrigger>
        <TabsTrigger value="tags">Tags</TabsTrigger>
        <TabsTrigger value="respostas">Respostas rápidas</TabsTrigger>
      </TabsList>

      <TabsContent value="habilidades" className="m-0">
        <SkillsPanel skills={skills} queues={queues} users={users} onSubmit={onSubmit} />
      </TabsContent>

      <TabsContent value="motivos" className="m-0">
        <ReasonsPanel reasons={closingReasons} onSubmit={onSubmit} />
      </TabsContent>

      <TabsContent value="campos" className="m-0">
        <FieldsPanel fields={customFields} onSubmit={onSubmit} />
      </TabsContent>

      <TabsContent value="tags" className="m-0">
        <TagsPanel tags={tags} onSubmit={onSubmit} />
      </TabsContent>

      <TabsContent value="respostas" className="m-0">
        <ResponsesPanel responses={cannedResponses} onSubmit={onSubmit} />
      </TabsContent>
    </Tabs>
  );
}

/* Casca comum de lista ------------------------------------------------------- */

function PanelShell({
  hint,
  actionLabel,
  onCreate,
  children,
}: {
  hint: string;
  actionLabel: string;
  onCreate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-prose text-xs leading-relaxed">{hint}</p>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onCreate}>
          <Plus />
          {actionLabel}
        </Button>
      </div>
      <div className="bg-card shadow-card overflow-hidden rounded-lg">{children}</div>
    </div>
  );
}

function Row({
  title,
  meta,
  description,
  badges,
  editLabel,
  deleteLabel,
  deleteDisabledReason,
  onEdit,
  onDelete,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  description?: string;
  badges?: React.ReactNode;
  editLabel: string;
  deleteLabel: string;
  deleteDisabledReason?: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="hover:bg-muted/40 [&+li]:shadow-inset-hairline flex items-start gap-3 px-4 py-3 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {meta}
          {badges}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
        ) : null}
      </div>
      <RowActions
        editLabel={editLabel}
        deleteLabel={deleteLabel}
        deleteDisabledReason={deleteDisabledReason}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </li>
  );
}

/** A chave, em monoespaçado, para não ser confundida com o rótulo. */
function KeyChip({ value }: { value: string }) {
  return (
    <code className="bg-surface-sunken text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
      {value}
    </code>
  );
}

/* Competências --------------------------------------------------------------- */

function SkillsPanel({
  skills,
  queues,
  users,
  onSubmit,
}: {
  skills: SkillDefinition[];
  queues: Queue[];
  users: User[];
  onSubmit: Submit;
}) {
  const [editing, setEditing] = useState<SkillDefinition | "novo" | null>(null);
  const [deleting, setDeleting] = useState<SkillDefinition | null>(null);

  return (
    <>
      <PanelShell
        hint="Competência é o vocabulário da distribuição por habilidade. A chave é comparada pela fila e não pode mudar depois de criada."
        actionLabel="Nova competência"
        onCreate={() => setEditing("novo")}
      >
        <ul>
          {skills.map((skill) => {
            const holders = users.filter((user) => user.skills.includes(skill.key)).length;
            const required = queues.filter((queue) =>
              queue.distribution.requiredSkills.includes(skill.key),
            ).length;

            return (
              <Row
                key={skill.id}
                title={
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: `hsl(${skill.hue} 65% 50%)` }}
                      aria-hidden
                    />
                    {skill.label}
                  </span>
                }
                meta={<KeyChip value={skill.key} />}
                description={skill.description}
                badges={
                  <>
                    {!skill.active ? <Badge variant="neutral">inativa</Badge> : null}
                    <span className="text-muted-foreground text-[11px]">
                      {holders} pessoa(s) · {required} fila(s)
                    </span>
                  </>
                }
                editLabel={`Editar ${skill.label}`}
                deleteLabel={`Excluir ${skill.label}`}
                deleteDisabledReason={canDeleteSkill(skill, queues, users)}
                onEdit={() => setEditing(skill)}
                onDelete={() => setDeleting(skill)}
              />
            );
          })}
        </ul>
      </PanelShell>

      {editing ? (
        <SkillDialog
          skill={editing === "novo" ? undefined : editing}
          onOpenChange={(next) => !next && setEditing(null)}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir "${deleting.label}"?`}
          description="A competência sai do catálogo."
          onConfirm={() => onSubmit({ entity: "habilidade", action: "excluir", id: deleting.id })}
        />
      ) : null}
    </>
  );
}

function SkillDialog({
  skill,
  onOpenChange,
  onSubmit,
}: {
  skill?: SkillDefinition;
  onOpenChange: (open: boolean) => void;
  onSubmit: Submit;
}) {
  const [label, setLabel] = useState(skill?.label ?? "");
  const [key, setKey] = useState(skill?.key ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [hue, setHue] = useState(String(skill?.hue ?? 218));
  const [active, setActive] = useState(skill?.active ?? true);

  return (
    <EditorShell
      open
      onOpenChange={onOpenChange}
      title={skill ? "Editar competência" : "Nova competência"}
      description="A chave é o identificador comparado pela fila. O rótulo é o que aparece na tela."
      onSave={() =>
        onSubmit({
          entity: "habilidade",
          action: skill ? "editar" : "criar",
          id: skill?.id,
          data: { label, key: key || slugify(label), description, hue: Number(hue), active },
        })
      }
    >
      <Field label="Rótulo">
        <Input
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            if (!skill && !key) setKey("");
          }}
        />
      </Field>

      <Field label="Chave">
        <Input
          value={key || slugify(label)}
          disabled={Boolean(skill)}
          onChange={(event) => setKey(event.target.value)}
        />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          {skill
            ? "A chave não muda: ela está gravada nos perfis e nas filas que a exigem."
            : "Minúsculas, números e sublinhado. Sugerida a partir do rótulo."}
        </p>
      </Field>

      <Field label="Descrição">
        <Textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <Field label="Matiz do chip">
        <Input
          type="number"
          min={0}
          max={359}
          value={hue}
          onChange={(event) => setHue(event.target.value)}
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium">Ativa</p>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>
    </EditorShell>
  );
}

/* Motivos de encerramento ---------------------------------------------------- */

function ReasonsPanel({ reasons, onSubmit }: { reasons: ClosingReason[]; onSubmit: Submit }) {
  const [editing, setEditing] = useState<ClosingReason | "novo" | null>(null);
  const [deleting, setDeleting] = useState<ClosingReason | null>(null);

  const resolved = reasons.filter((item) => item.resolved && item.active).length;

  return (
    <>
      <PanelShell
        hint={`O motivo transforma "conversa fechada" em relatório. ${resolved} motivo(s) contam como resolvido — é o numerador da taxa de resolução.`}
        actionLabel="Novo motivo"
        onCreate={() => setEditing("novo")}
      >
        <ul>
          {[...reasons]
            .sort((a, b) => a.order - b.order)
            .map((reason) => (
              <Row
                key={reason.id}
                title={reason.label}
                meta={<KeyChip value={reason.key} />}
                description={reason.description}
                badges={
                  <>
                    <Badge variant={reason.resolved ? "success" : "neutral"}>
                      {reason.resolved ? "conta como resolvido" : "não resolvido"}
                    </Badge>
                    {reason.requiresNote ? <Badge variant="neutral">exige nota</Badge> : null}
                    {!reason.active ? <Badge variant="neutral">inativo</Badge> : null}
                  </>
                }
                editLabel={`Editar ${reason.label}`}
                deleteLabel={`Excluir ${reason.label}`}
                onEdit={() => setEditing(reason)}
                onDelete={() => setDeleting(reason)}
              />
            ))}
        </ul>
      </PanelShell>

      {editing ? (
        <ReasonDialog
          reason={editing === "novo" ? undefined : editing}
          onOpenChange={(next) => !next && setEditing(null)}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir "${deleting.label}"?`}
          description="O motivo sai da lista de encerramento."
          consequence="As conversas já encerradas com este motivo mantêm a chave gravada e continuam contando no histórico."
          onConfirm={() => onSubmit({ entity: "motivo", action: "excluir", id: deleting.id })}
        />
      ) : null}
    </>
  );
}

function ReasonDialog({
  reason,
  onOpenChange,
  onSubmit,
}: {
  reason?: ClosingReason;
  onOpenChange: (open: boolean) => void;
  onSubmit: Submit;
}) {
  const [label, setLabel] = useState(reason?.label ?? "");
  const [key, setKey] = useState(reason?.key ?? "");
  const [description, setDescription] = useState(reason?.description ?? "");
  const [resolved, setResolved] = useState(reason?.resolved ?? false);
  const [requiresNote, setRequiresNote] = useState(reason?.requiresNote ?? false);
  const [active, setActive] = useState(reason?.active ?? true);
  const [order, setOrder] = useState(String(reason?.order ?? 0));

  return (
    <EditorShell
      open
      onOpenChange={onOpenChange}
      title={reason ? "Editar motivo" : "Novo motivo"}
      description="Marcar como resolvido decide se a conversa conta na taxa de resolução — inclusive nos meses já fechados."
      onSave={() =>
        onSubmit({
          entity: "motivo",
          action: reason ? "editar" : "criar",
          id: reason?.id,
          data: {
            label,
            key: key || slugify(label),
            description,
            resolved,
            requiresNote,
            active,
            order: Number(order),
          },
        })
      }
    >
      <Field label="Rótulo">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} />
      </Field>

      <Field label="Chave">
        <Input
          value={key || slugify(label)}
          disabled={Boolean(reason)}
          onChange={(event) => setKey(event.target.value)}
        />
      </Field>

      <Field label="Descrição">
        <Textarea
          rows={2}
          value={description}
          placeholder="Quando o atendente deve escolher este motivo."
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <Field label="Ordem na lista">
        <Input
          type="number"
          min={0}
          value={order}
          onChange={(event) => setOrder(event.target.value)}
        />
      </Field>

      <div className="space-y-2 pt-1">
        <ToggleRow
          label="Conta como resolvido"
          hint="Entra no numerador da taxa de resolução. Virar esta chave muda o indicador de meses já fechados."
          checked={resolved}
          onChange={setResolved}
        />
        <ToggleRow
          label="Exige nota do atendente"
          hint="Ao escolher este motivo, o atendente precisa escrever o que aconteceu."
          checked={requiresNote}
          onChange={setRequiresNote}
        />
        <ToggleRow
          label="Ativo"
          hint="Inativo some da lista de encerramento sem apagar o histórico."
          checked={active}
          onChange={setActive}
        />
      </div>
    </EditorShell>
  );
}

/* Campos personalizados ------------------------------------------------------ */

const FIELD_TYPES = Object.keys(CUSTOM_FIELD_TYPE_LABEL) as CustomFieldType[];
const FIELD_ENTITIES = Object.keys(CUSTOM_FIELD_ENTITY_LABEL) as CustomFieldEntity[];

function FieldsPanel({ fields, onSubmit }: { fields: CustomFieldDefinition[]; onSubmit: Submit }) {
  const [editing, setEditing] = useState<CustomFieldDefinition | "novo" | null>(null);
  const [deleting, setDeleting] = useState<CustomFieldDefinition | null>(null);

  return (
    <>
      <PanelShell
        hint="Campo derivado é calculado e não se edita à mão. Campo sensível é mascarado no contexto que a IA recebe."
        actionLabel="Novo campo"
        onCreate={() => setEditing("novo")}
      >
        <ul>
          {fields.map((field) => (
            <Row
              key={field.id}
              title={field.label}
              meta={<KeyChip value={`${field.entity}.${field.key}`} />}
              description={field.description}
              badges={
                <>
                  <Badge variant="neutral">{CUSTOM_FIELD_TYPE_LABEL[field.type]}</Badge>
                  {field.required ? <Badge variant="warning">obrigatório</Badge> : null}
                  {field.derived ? (
                    <Tooltip content="Calculado pelo sistema — não editável à mão">
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                        <Sigma className="size-3" aria-hidden /> derivado
                      </span>
                    </Tooltip>
                  ) : null}
                  {field.sensitive ? (
                    <Tooltip content="Mascarado no contexto enviado à IA (seção 16.4)">
                      <span className="text-accent-ink inline-flex items-center gap-1 text-[11px]">
                        <Lock className="size-3" aria-hidden /> sensível
                      </span>
                    </Tooltip>
                  ) : null}
                </>
              }
              editLabel={`Editar ${field.label}`}
              deleteLabel={`Excluir ${field.label}`}
              onEdit={() => setEditing(field)}
              onDelete={() => setDeleting(field)}
            />
          ))}
        </ul>
      </PanelShell>

      {editing ? (
        <FieldDialog
          field={editing === "novo" ? undefined : editing}
          onOpenChange={(next) => !next && setEditing(null)}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir "${deleting.label}"?`}
          description="O campo sai dos formulários e das telas."
          consequence="Os valores já gravados nos registros deixam de aparecer — e não há como recuperá-los pela interface."
          onConfirm={() => onSubmit({ entity: "campo", action: "excluir", id: deleting.id })}
        />
      ) : null}
    </>
  );
}

function FieldDialog({
  field,
  onOpenChange,
  onSubmit,
}: {
  field?: CustomFieldDefinition;
  onOpenChange: (open: boolean) => void;
  onSubmit: Submit;
}) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [key, setKey] = useState(field?.key ?? "");
  const [description, setDescription] = useState(field?.description ?? "");
  const [entity, setEntity] = useState<CustomFieldEntity>(field?.entity ?? "contato");
  const [type, setType] = useState<CustomFieldType>(field?.type ?? "texto");
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const [required, setRequired] = useState(field?.required ?? false);
  const [derived, setDerived] = useState(field?.derived ?? false);
  const [sensitive, setSensitive] = useState(field?.sensitive ?? false);
  const [active, setActive] = useState(field?.active ?? true);

  return (
    <EditorShell
      open
      onOpenChange={onOpenChange}
      title={field ? "Editar campo" : "Novo campo"}
      description="A chave é gravada em cada registro preenchido e não muda depois."
      onSave={() =>
        onSubmit({
          entity: "campo",
          action: field ? "editar" : "criar",
          id: field?.id,
          data: {
            label,
            key: key || slugify(label),
            description,
            entity,
            type,
            options: options
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            required,
            derived,
            sensitive,
            active,
          },
        })
      }
    >
      <Field label="Rótulo">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} />
      </Field>

      <Field label="Chave">
        <Input
          value={key || slugify(label)}
          disabled={Boolean(field)}
          onChange={(event) => setKey(event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Onde aparece">
          <Select value={entity} onValueChange={(value) => setEntity(value as CustomFieldEntity)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_ENTITIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {CUSTOM_FIELD_ENTITY_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Tipo">
          <Select value={type} onValueChange={(value) => setType(value as CustomFieldType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((item) => (
                <SelectItem key={item} value={item}>
                  {CUSTOM_FIELD_TYPE_LABEL[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {type === "selecao" ? (
        <Field label="Opções (uma por linha)">
          <Textarea rows={4} value={options} onChange={(event) => setOptions(event.target.value)} />
        </Field>
      ) : null}

      <Field label="Descrição">
        <Textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="space-y-2 pt-1">
        <ToggleRow
          label="Obrigatório"
          hint="Exigido no formulário. Não combina com campo derivado — ninguém teria como preenchê-lo."
          checked={required}
          onChange={setRequired}
        />
        <ToggleRow
          label="Derivado"
          hint="Calculado pelo sistema. A tela mostra e não deixa editar."
          checked={derived}
          onChange={setDerived}
        />
        <ToggleRow
          label="Sensível"
          hint="Mascarado no contexto enviado à IA e exige base legal no relatório de retenção."
          checked={sensitive}
          onChange={setSensitive}
        />
        <ToggleRow
          label="Ativo"
          hint="Inativo some das telas sem apagar valores."
          checked={active}
          onChange={setActive}
        />
      </div>
    </EditorShell>
  );
}

/* Tags ----------------------------------------------------------------------- */

function TagsPanel({ tags, onSubmit }: { tags: Tag[]; onSubmit: Submit }) {
  const [editing, setEditing] = useState<Tag | "novo" | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  return (
    <>
      <PanelShell
        hint="Tags marcam contato e conversa. Duas com o mesmo nome dividem o mesmo filtro em dois — por isso o nome repetido é recusado."
        actionLabel="Nova tag"
        onCreate={() => setEditing("novo")}
      >
        <ul className="flex flex-wrap gap-2 p-4">
          {tags.map((tag) => (
            <li key={tag.id}>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                style={{
                  backgroundColor: `hsl(${tag.hue} 70% var(--hue-bg-l) / var(--hue-bg-a))`,
                  color: `hsl(${tag.hue} 70% var(--hue-fg-l))`,
                }}
              >
                {tag.name}
                <RowActions
                  editLabel={`Editar ${tag.name}`}
                  deleteLabel={`Excluir ${tag.name}`}
                  onEdit={() => setEditing(tag)}
                  onDelete={() => setDeleting(tag)}
                />
              </span>
            </li>
          ))}
        </ul>
      </PanelShell>

      {editing ? (
        <TagDialog
          tag={editing === "novo" ? undefined : editing}
          onOpenChange={(next) => !next && setEditing(null)}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir "${deleting.name}"?`}
          description="A tag sai do catálogo."
          consequence="Os contatos e conversas marcados perdem a marcação, e os filtros salvos que a usam deixam de encontrar registros."
          onConfirm={() => onSubmit({ entity: "tag", action: "excluir", id: deleting.id })}
        />
      ) : null}
    </>
  );
}

function TagDialog({
  tag,
  onOpenChange,
  onSubmit,
}: {
  tag?: Tag;
  onOpenChange: (open: boolean) => void;
  onSubmit: Submit;
}) {
  const [name, setName] = useState(tag?.name ?? "");
  const [hue, setHue] = useState(String(tag?.hue ?? 218));

  return (
    <EditorShell
      open
      onOpenChange={onOpenChange}
      title={tag ? "Editar tag" : "Nova tag"}
      description="A cor sai da matiz: saturação e luminosidade vêm do tema, e é isso que faz o chip funcionar no modo escuro."
      onSave={() =>
        onSubmit({
          entity: "tag",
          action: tag ? "editar" : "criar",
          id: tag?.id,
          data: { name, hue: Number(hue) },
        })
      }
    >
      <Field label="Nome">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label="Matiz (0–359)">
        <Input
          type="number"
          min={0}
          max={359}
          value={hue}
          onChange={(event) => setHue(event.target.value)}
        />
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-muted-foreground text-xs">Prévia:</span>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs"
          style={{
            backgroundColor: `hsl(${Number(hue) || 0} 70% var(--hue-bg-l) / var(--hue-bg-a))`,
            color: `hsl(${Number(hue) || 0} 70% var(--hue-fg-l))`,
          }}
        >
          {name || "Exemplo"}
        </span>
      </div>
    </EditorShell>
  );
}

/* Respostas rápidas ---------------------------------------------------------- */

const CHANNEL_OPTIONS: ChannelKind[] = ["whatsapp", "email", "instagram", "messenger", "webchat"];

function ResponsesPanel({
  responses,
  onSubmit,
}: {
  responses: CannedResponse[];
  onSubmit: Submit;
}) {
  const [editing, setEditing] = useState<CannedResponse | "novo" | null>(null);
  const [deleting, setDeleting] = useState<CannedResponse | null>(null);

  return (
    <>
      <PanelShell
        hint="O atalho é digitado no compositor. Dois iguais fazem o compositor escolher pela ordem da lista, e o atendente envia a resposta errada acreditando ter digitado a certa."
        actionLabel="Nova resposta"
        onCreate={() => setEditing("novo")}
      >
        <ul>
          {responses.map((response) => (
            <Row
              key={response.id}
              title={response.title}
              meta={<KeyChip value={`/${response.shortcut}`} />}
              description={response.body.slice(0, 160)}
              badges={
                <span className="text-muted-foreground text-[11px]">
                  {response.channels.map((kind) => CHANNEL_LABEL[kind]).join(", ") ||
                    "todos os canais"}
                </span>
              }
              editLabel={`Editar ${response.title}`}
              deleteLabel={`Excluir ${response.title}`}
              onEdit={() => setEditing(response)}
              onDelete={() => setDeleting(response)}
            />
          ))}
        </ul>
      </PanelShell>

      {editing ? (
        <ResponseDialog
          response={editing === "novo" ? undefined : editing}
          onOpenChange={(next) => !next && setEditing(null)}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir "${deleting.title}"?`}
          description={`O atalho /${deleting.shortcut} deixa de funcionar no compositor.`}
          onConfirm={() => onSubmit({ entity: "resposta", action: "excluir", id: deleting.id })}
        />
      ) : null}
    </>
  );
}

function ResponseDialog({
  response,
  onOpenChange,
  onSubmit,
}: {
  response?: CannedResponse;
  onOpenChange: (open: boolean) => void;
  onSubmit: Submit;
}) {
  const [shortcut, setShortcut] = useState(response?.shortcut ?? "");
  const [title, setTitle] = useState(response?.title ?? "");
  const [body, setBody] = useState(response?.body ?? "");
  const [channels, setChannels] = useState<ChannelKind[]>(response?.channels ?? []);

  return (
    <EditorShell
      open
      onOpenChange={onOpenChange}
      title={response ? "Editar resposta rápida" : "Nova resposta rápida"}
      description="Escreva como quem fala com o cliente, não como quem preenche formulário."
      onSave={() =>
        onSubmit({
          entity: "resposta",
          action: response ? "editar" : "criar",
          id: response?.id,
          data: { shortcut, title, body, channels },
        })
      }
    >
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <Field label="Atalho">
          <Input
            value={shortcut}
            placeholder="prazo"
            onChange={(event) => setShortcut(event.target.value)}
          />
        </Field>
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
      </div>

      <Field label="Texto">
        <Textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
      </Field>

      <Field label="Canais">
        <ul className="grid grid-cols-2 gap-1">
          {CHANNEL_OPTIONS.map((kind) => (
            <li key={kind}>
              <label className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors">
                <Checkbox
                  checked={channels.includes(kind)}
                  onCheckedChange={(checked) =>
                    setChannels((current) =>
                      checked === true
                        ? [...current, kind]
                        : current.filter((item) => item !== kind),
                    )
                  }
                />
                {CHANNEL_LABEL[kind]}
              </label>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Nenhum marcado significa disponível em todos.
        </p>
      </Field>
    </EditorShell>
  );
}

/* Apoio ---------------------------------------------------------------------- */

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Label className="text-xs font-medium">{label}</Label>
        <p className="text-muted-foreground text-[11px] leading-relaxed">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
