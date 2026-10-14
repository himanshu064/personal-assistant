"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const MAX_SECONDS = 60;

/** Picks an audio format this browser can record (Firefox: ogg, others: webm or mp4). */
function pickMimeType(): string | undefined {
  const types = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

/**
 * Records a short voice clip, for browsers without built in speech
 * recognition. Stops on its own after a minute.
 */
export function useAudioRecorder({ onRecorded }: { onRecorded: (audio: Blob) => void }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
    () => false,
  );
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRecordedRef = useRef(onRecorded);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access is blocked. Allow it in your browser settings, or type instead.");
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      setRecording(false);
      const audio = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (audio.size > 0) onRecordedRef.current(audio);
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    timerRef.current = setTimeout(stop, MAX_SECONDS * 1000);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, recording, error, start, stop };
}
