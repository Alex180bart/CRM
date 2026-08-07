"use client";

import { useState } from "react";
import type { ChannelAccount, ChannelKind, Queue } from "@crm/core";
import {
  CHANNEL_LABEL,
  CONNECTABLE_KINDS,
  connectionMissingFields,
  providerSpec,
  providersForKind,
} from "@crm/core";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crm/ui";
import { CheckCircle2, CircleAlert, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Cadastro de conta e configuração de conexão.
 *
 * São dois diálogos porque são dois momentos, e juntá-los produziria um
 * formulário longo que ninguém termina: **cadastrar** é dizer que a conta
 * existe e para qual fila ela entrega — leva dez segundos; **conectar** é
 * preencher credencial que mora no painel de outro sistema, e costuma exigir
 * alternar de aba várias vezes.
 *
 * Separados, a conta aparece na lista desde o primeiro instante, com estado
 * "não configurado" — e quem voltar amanhã sabe onde parou.
 */

interface Result {
  ok: boolean;
  reason?: string;
}

/* Nova conta ----------------------------------------------------------------- */

export function NewChannelDialog({
  open,
  onOpenChange,
  queues,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queues: Queue[];
  onSubmit: (input: {
    entity: string;
    action: "criar";
    data: Record<string, unknown>;
  }) => Promise<Result>;
}) {
  const [kind, setKind] = useState<ChannelKind>("whatsapp");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [queueId, setQueueId] = useState(queues[0]?.id ?? "");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const spec = providersForKind(kind)[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRefusal(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(92vw,30rem)]">
        <DialogHeader>
          <DialogTitle>Nova conta de canal</DialogTitle>
          <DialogDescription>
            Cada número, página ou caixa de e-mail é uma conta. Você pode ter quantas quiser do
            mesmo tipo — o que não pode repetir é o endereço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="canal-tipo">Tipo</Label>
            <Select
              value={kind}
              onValueChange={(value) => {
                setKind(value as ChannelKind);
                setAddress("");
              }}
            >
              <SelectTrigger id="canal-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONNECTABLE_KINDS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {CHANNEL_LABEL[item as ChannelKind] ?? item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/**
             * O webchat não aparece na lista de propósito: ele é derivado do
             * widget. Oferecê-lo aqui abriria um caminho que a validação
             * recusaria no passo seguinte.
             */}
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Webchat não entra aqui: o canal é criado junto com o widget, em Webchat.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="canal-nome">Nome</Label>
            <Input
              id="canal-nome"
              value={label}
              placeholder="WhatsApp Comercial · Instagram @loja · Financeiro"
              onChange={(event) => setLabel(event.target.value)}
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              É como a conta aparece na lista e no Inbox. Com várias contas do mesmo tipo, o nome é
              o que distingue — "WhatsApp" e "WhatsApp 2" não ajudam ninguém.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="canal-endereco">{spec?.addressLabel ?? "Endereço"}</Label>
            <Input
              id="canal-endereco"
              value={address}
              placeholder={spec?.addressPlaceholder}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="canal-fila">Fila que recebe</Label>
            <Select value={queueId} onValueChange={setQueueId}>
              <SelectTrigger id="canal-fila">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {queues.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {refusal ? (
            <Callout variant="danger" icon={<CircleAlert />}>
              {refusal}
            </Callout>
          ) : null}

          <Callout variant="neutral">
            A conta nasce <strong>desconectada</strong>. Cadastrar o endereço não fala com provedor
            nenhum — as credenciais entram no passo seguinte.
          </Callout>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setRefusal(null);
              const result = await onSubmit({
                entity: "canal",
                action: "criar",
                data: { kind, label, address, queueId },
              });
              setBusy(false);

              if (result.ok) {
                toast.success("Conta criada", {
                  description: "Agora configure a conexão com o provedor.",
                });
                onOpenChange(false);
                return;
              }
              setRefusal(result.reason ?? "Não foi possível criar a conta.");
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Criar conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Conexão -------------------------------------------------------------------- */

export function ConnectDialog({
  open,
  onOpenChange,
  account,
  presentSecrets,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ChannelAccount;
  /** Nomes dos segredos já gravados — nunca os valores. */
  presentSecrets: string[];
  onDone: () => void;
}) {
  const options = providersForKind(account.kind);
  const [providerId, setProviderId] = useState(
    account.connection?.provider || options[0]?.id || "",
  );
  const spec = providerSpec(providerId) ?? options[0];

  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...(account.connection?.fields ?? {}),
  }));
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const missing = spec ? connectionMissingFields(spec, { fields: values }, presentSecrets) : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRefusal(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(92vw,34rem)]">
        <DialogHeader>
          <DialogTitle>Conectar {account.label}</DialogTitle>
          <DialogDescription>
            {account.address} · as credenciais são desta conta, não da instalação.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {options.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="conn-provedor">Provedor</Label>
              <Select value={providerId} onValueChange={setProviderId}>
                <SelectTrigger id="conn-provedor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {spec?.fields.map((field) => {
            const stored = field.secret && presentSecrets.includes(field.key);

            return (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor={`conn-${field.key}`}>{field.label}</Label>
                  {field.secret ? (
                    <Badge variant={stored ? "success" : "warning"}>
                      {stored ? <ShieldCheck aria-hidden /> : <KeyRound aria-hidden />}
                      {stored ? "gravado" : "segredo"}
                    </Badge>
                  ) : null}
                  {field.optional ? <Badge variant="neutral">opcional</Badge> : null}
                </div>

                <Input
                  id={`conn-${field.key}`}
                  type={field.secret ? "password" : "text"}
                  autoComplete="off"
                  value={values[field.key] ?? ""}
                  /**
                   * Segredo já gravado mostra o campo vazio com marca-d'água
                   * explicando. Não há como preenchê-lo com o valor real: o
                   * servidor não devolve segredo, e um valor falso ali seria
                   * pior — quem visse os pontinhos assumiria que está certo.
                   */
                  placeholder={stored ? "Já gravado — deixe vazio para manter" : field.placeholder}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
                <p className="text-muted-foreground text-[11px] leading-relaxed">{field.hint}</p>
              </div>
            );
          })}

          {missing.length > 0 ? (
            <Callout variant="warning" icon={<CircleAlert />}>
              Ainda falta: {missing.join(", ")}.
            </Callout>
          ) : (
            <Callout variant="success" icon={<CheckCircle2 />}>
              Configuração completa. O provedor confirma de verdade quando a primeira mensagem
              chegar — até lá, a conta fica como “aguardando verificação”.
            </Callout>
          )}

          {spec?.gap ? (
            <Callout variant="neutral" title="O que ainda não funciona">
              {spec.gap}
            </Callout>
          ) : null}

          {refusal ? (
            <Callout variant="danger" icon={<CircleAlert />}>
              {refusal}
            </Callout>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || !spec}
            onClick={async () => {
              setBusy(true);
              setRefusal(null);

              try {
                const response = await fetch("/api/canais/conexao", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    accountId: account.id,
                    provider: spec?.id,
                    values,
                  }),
                });

                const result = (await response.json()) as Result & { missing?: string[] };

                if (!result.ok) {
                  setRefusal(result.reason ?? "Não foi possível salvar a conexão.");
                  return;
                }

                toast.success("Conexão salva", {
                  description: result.missing?.length
                    ? `Ainda falta: ${result.missing.join(", ")}.`
                    : "Registrado na auditoria. O segredo ficou no servidor.",
                });
                onDone();
                onOpenChange(false);
              } catch {
                setRefusal("Não foi possível falar com o servidor.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Salvar conexão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
