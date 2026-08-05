"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Attachment } from "@crm/core";
import { Button, Tooltip, cn } from "@crm/ui";
import { Check, Mic, Pause, Play, Square, Trash2 } from "lucide-react";

/**
 * Gravação de áudio do compositor.
 *
 * "Muita qualidade" aqui é uma decisão de codec, não de marketing: Opus a
 * 128 kbps em 48 kHz mono. Opus é o codec que o próprio WhatsApp usa e, nessa
 * taxa, voz fica transparente — dobrar o bitrate só engordaria o arquivo.
 * Mono porque voz não tem informação estereofônica: a mesma banda concentrada
 * num canal soa melhor do que espalhada em dois.
 *
 * Cancelamento de eco e supressão de ruído ficam **ligados**. São gravações de
 * atendimento feitas em escritório, não captação musical — o que importa é a
 * voz inteligível, não o ambiente fiel.
 */

const TARGET_BITRATE = 128_000;
const TARGET_SAMPLE_RATE = 48_000;

/** Ordem de preferência: o primeiro que o navegador suportar é o escolhido. */
const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatDuration(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

type Phase = "ocioso" | "gravando" | "pausado" | "revisando";

export function AudioRecorder({
  disabled,
  onReady,
}: {
  disabled?: boolean;
  onReady: (attachment: Attachment) => void;
}) {
  const [phase, setPhase] = useState<Phase>("ocioso");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startedAtRef = useRef(0);

  /** Solta microfone, análise e temporizador — nesta ordem. */
  const teardown = useCallback(() => {
    if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    if (tickRef.current !== undefined) clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close().catch(() => undefined);
    streamRef.current = null;
    audioContextRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      teardown();
      if (preview) URL.revokeObjectURL(preview.url);
    };
    // A lista vazia é proposital: a limpeza roda só na saída do componente, e
    // `preview` é lido pela referência do fecho no momento em que isso acontece.
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: TARGET_BITRATE,
      });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType ?? "audio/webm" });
        setPreview({ url: URL.createObjectURL(blob), blob });
        setPhase("revisando");
        teardown();
      };

      // Fatias de 1 s: se a aba morrer no meio, o que já foi capturado sobrevive.
      recorder.start(1000);

      // Medidor de nível para a onda — é o retorno de que o microfone pegou.
      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const sample = () => {
        analyser.getByteTimeDomainData(buffer);
        let peak = 0;
        for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128) / 128);
        setLevels((current) => [...current.slice(-59), peak]);
        frameRef.current = requestAnimationFrame(sample);
      };
      frameRef.current = requestAnimationFrame(sample);

      startedAtRef.current = Date.now();
      setSeconds(0);
      tickRef.current = setInterval(() => {
        setSeconds((Date.now() - startedAtRef.current) / 1000);
      }, 200);

      setLevels([]);
      setPhase("gravando");
    } catch (cause) {
      teardown();
      setPhase("ocioso");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "O navegador negou o acesso ao microfone. Libere a permissão e tente de novo."
          : "Não foi possível acessar o microfone.",
      );
    }
  }

  function stop() {
    recorderRef.current?.stop();
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      if (tickRef.current !== undefined) clearInterval(tickRef.current);
      setPhase("pausado");
    } else if (recorder.state === "paused") {
      recorder.resume();
      const resumeBase = Date.now() - seconds * 1000;
      tickRef.current = setInterval(() => setSeconds((Date.now() - resumeBase) / 1000), 200);
      setPhase("gravando");
    }
  }

  function discard() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setLevels([]);
    setSeconds(0);
    setPhase("ocioso");
  }

  function confirm() {
    if (!preview) return;
    const extension = preview.blob.type.includes("ogg") ? "ogg" : "webm";
    onReady({
      id: `att_audio_${Date.now()}`,
      fileName: `mensagem-de-voz.${extension}`,
      mimeType: preview.blob.type,
      sizeBytes: preview.blob.size,
      kind: "audio",
      url: preview.url,
      durationSeconds: Math.round(seconds),
    });
    setPreview(null);
    setLevels([]);
    setSeconds(0);
    setPhase("ocioso");
  }

  /* Ocioso: só o botão de microfone --------------------------------------- */
  if (phase === "ocioso") {
    return (
      <>
        <Tooltip content={error ?? "Gravar mensagem de voz (Opus 128 kbps)"}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={start}
            aria-label="Gravar mensagem de voz"
            className={cn(error && "text-destructive")}
          >
            <Mic />
          </Button>
        </Tooltip>
      </>
    );
  }

  /* Revisão: ouvir antes de enviar ---------------------------------------- */
  if (phase === "revisando" && preview) {
    return (
      <div className="bg-accent-soft flex w-full items-center gap-2 rounded-lg px-2 py-1.5">
        <audio src={preview.url} controls className="h-8 min-w-0 flex-1" />
        <span className="text-accent-ink shrink-0 text-[11px] font-medium tabular-nums">
          {formatDuration(seconds)} · {Math.round(preview.blob.size / 1024)} KB
        </span>
        <Tooltip content="Descartar gravação">
          <Button variant="ghost" size="icon-sm" onClick={discard} aria-label="Descartar gravação">
            <Trash2 />
          </Button>
        </Tooltip>
        <Button size="xs" variant="accent" onClick={confirm}>
          <Check />
          Anexar
        </Button>
      </div>
    );
  }

  /* Gravando ou pausado ---------------------------------------------------- */
  return (
    <div className="bg-destructive-soft flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5">
      <span className="relative flex size-2.5 shrink-0">
        <span className="bg-destructive size-2.5 rounded-full" />
        {phase === "gravando" ? (
          <span className="bg-destructive absolute inset-0 animate-ping rounded-full opacity-70" />
        ) : null}
      </span>

      <span className="text-destructive shrink-0 text-xs font-semibold tabular-nums">
        {formatDuration(seconds)}
      </span>

      {/* Onda ao vivo: prova de que o microfone está captando. */}
      <div className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
        {levels.map((level, index) => (
          <span
            key={index}
            className="bg-destructive/70 w-[3px] shrink-0 rounded-full"
            style={{ height: `${Math.max(3, Math.min(24, level * 60))}px` }}
          />
        ))}
      </div>

      <Tooltip content={phase === "gravando" ? "Pausar" : "Continuar"}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={togglePause}
          aria-label={phase === "gravando" ? "Pausar gravação" : "Continuar gravação"}
        >
          {phase === "gravando" ? <Pause /> : <Play />}
        </Button>
      </Tooltip>

      <Button size="xs" variant="danger" onClick={stop}>
        <Square />
        Concluir
      </Button>
    </div>
  );
}
