"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The Web Speech API is not in TypeScript's DOM types; this is the part we use.
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { isFinal: boolean; 0: SpeechRecognitionAlternative; length: number };
type SpeechRecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionErrorEvent = { error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

/** Messages for the errors a user can act on. */
const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings, or type instead.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser settings, or type instead.",
  "audio-capture": "No microphone was found. You can type instead.",
  network: "Speech recognition needs an internet connection. You can type instead.",
};

/**
 * The browser's free speech to text (Chrome, Edge, Safari including iPhone).
 * Shows words live while the user speaks and stops on its own after a pause.
 * `supported` is false in browsers without it (mainly Firefox).
 */
export function useSpeechRecognition({ onFinal }: { onFinal: (text: string) => void }) {
  const supported = useSyncExternalStore(noopSubscribe, () => getCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    finalRef.current = "";
    setTranscript("");
    setError(null);

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript((finalRef.current + interim).trim());
    };
    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are normal endings, not problems to report.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(ERROR_MESSAGES[event.error] ?? "Voice input stopped. Try again or type instead.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      const text = finalRef.current.trim();
      if (text) onFinalRef.current(text);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("Voice input could not start. Try again or type instead.");
    }
  }, []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  // Stop listening if the component goes away mid sentence.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, transcript, error, start, stop };
}
