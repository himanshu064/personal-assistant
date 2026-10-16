"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// The Web Speech API is not in TypeScript's DOM types; this is the part we use.
type SpeechRecognitionAlternative = { transcript: string; confidence?: number };
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

/** Listening ends this long after the last word heard (the user has finished speaking). */
const SILENCE_MS = 2000;
/** Nothing heard this long after tapping the mic: stop (some browsers never end by themselves). */
const NO_SPEECH_MS = 8000;
/** iPhone: the gap before listening again after a phrase ends (from the iOS guide below). */
const IOS_RESTART_MS = 200;

/**
 * The browser's speech service behaves differently per platform (researched 16 Oct 2026):
 * - desktop (Chrome, Edge, Mac Safari): continuous mode works, so it keeps listening through pauses.
 * - android: continuous mode restarts the mic with a beep; react-speech-recognition turns it off on
 *   Android and ignores the duplicate "final" results Android sends with confidence 0 (its source,
 *   lines 166 and 324). We do the same: one phrase per tap.
 * - ios: continuous mode can hang (the final text never arrives). Stable pattern: one phrase at a
 *   time, restart about 200 ms later, and join the pieces (lilting.ch, "How to Stabilize the
 *   WebSpeech API on iOS", Jan 2026).
 */
type Platform = "desktop" | "android" | "ios";

function platform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac; touch points tell them apart.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

/**
 * The language the speech service listens for: English (India) on a device set to India time,
 * otherwise the browser's language. (Whether en-IN hears Indian names better is not published;
 * it matches how the user speaks.)
 */
function speechLanguage() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zone === "Asia/Kolkata" || zone === "Asia/Calcutta") return "en-IN";
  return navigator.language || "en-US";
}

function tidy(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/** Messages for the errors a user can act on. */
const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings, or type instead.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser settings, or type instead.",
  "audio-capture": "No microphone was found. You can type instead.",
  network: "Speech recognition needs an internet connection. You can type instead.",
};

/**
 * The browser's free speech to text (Chrome, Edge, Safari including iPhone).
 * Shows words live, as one line, while the user speaks, and calls onFinal once
 * with the whole sentence: about 2 seconds after the last word, or when stopped.
 * How pauses are handled depends on the platform (see Platform above).
 * `supported` is false in browsers without it (mainly Firefox).
 */
export function useSpeechRecognition({ onFinal }: { onFinal: (text: string) => void }) {
  const supported = useSyncExternalStore(noopSubscribe, () => getCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinal);
  /** Text from earlier phrases of this turn (iPhone joins several). */
  const committedRef = useRef("");
  /** The current phrase: finished words, and words still being heard. */
  const sessionRef = useRef({ final: "", interim: "" });
  /** True while the user wants to keep talking (cleared by stop, silence or finishing). */
  const wantedRef = useRef(false);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** False once the component is gone: nothing is handed over after that. */
  const aliveRef = useRef(true);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const clearTimers = () => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    if (restartRef.current) clearTimeout(restartRef.current);
    silenceRef.current = restartRef.current = null;
  };

  /** Ends the turn and hands over the whole sentence, once. */
  const finish = useCallback(() => {
    wantedRef.current = false;
    clearTimers();
    setListening(false);
    const text = committedRef.current;
    committedRef.current = "";
    if (text && aliveRef.current) onFinalRef.current(text);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recognitionRef.current || wantedRef.current) return;
    const where = platform();
    wantedRef.current = true;
    committedRef.current = "";
    setTranscript("");
    setError(null);
    setListening(true);

    /** Silence for SILENCE_MS after the last word (NO_SPEECH_MS before the first) ends the turn. */
    const armSilence = (ms = SILENCE_MS) => {
      if (silenceRef.current) clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => {
        wantedRef.current = false;
        if (recognitionRef.current) recognitionRef.current.stop();
        else finish();
      }, ms);
    };

    const listen = () => {
      const recognition = new Ctor();
      recognition.lang = speechLanguage();
      recognition.continuous = where === "desktop";
      recognition.interimResults = true;
      sessionRef.current = { final: "", interim: "" };

      recognition.onresult = (event) => {
        // Rebuilt from all of this phrase's results each time, so nothing is repeated.
        const finals: string[] = [];
        const interims: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            // Android can send finished words twice, the copy with confidence 0: skip the copy
            // only (a lone confidence 0 result is kept, so no sentence is lost).
            const words = tidy(result[0].transcript);
            const repeated = finals.some((kept) => kept.toLowerCase() === words.toLowerCase());
            if (where === "android" && result[0].confidence === 0 && repeated) continue;
            finals.push(words);
          } else {
            interims.push(result[0].transcript);
          }
        }
        sessionRef.current = { final: tidy(finals.join(" ")), interim: tidy(interims.join(" ")) };
        setTranscript(tidy(`${committedRef.current} ${sessionRef.current.final} ${sessionRef.current.interim}`));
        armSilence();
      };
      recognition.onerror = (event) => {
        // "no-speech" and "aborted" are normal endings, not problems to report.
        if (event.error !== "no-speech" && event.error !== "aborted") {
          wantedRef.current = false;
          // iPhone, listening again after a pause was refused: what was heard is still used, quietly.
          if (committedRef.current) return;
          setError(ERROR_MESSAGES[event.error] ?? "Voice input stopped. Try again or type instead.");
        }
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        // Words still marked "interim" when the phrase ended count too.
        const heard = tidy(`${sessionRef.current.final} ${sessionRef.current.interim}`);
        committedRef.current = tidy(`${committedRef.current} ${heard}`);
        // iPhone: the phrase ended at a pause; listen again and join the next piece.
        // A phrase that heard nothing means the user has finished.
        if (where === "ios" && wantedRef.current && heard) {
          restartRef.current = setTimeout(() => {
            if (wantedRef.current) listen();
            else finish();
          }, IOS_RESTART_MS);
          return;
        }
        finish();
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        if (!committedRef.current) setError("Voice input could not start. Try again or type instead.");
        finish();
      }
    };

    armSilence(NO_SPEECH_MS);
    listen();
  }, [finish]);

  /** "Stop": ends the turn now; whatever was heard is handed over. */
  const stop = useCallback(() => {
    wantedRef.current = false;
    if (recognitionRef.current) recognitionRef.current.stop();
    else finish(); // between two iPhone phrases
  }, [finish]);

  // Stop listening if the component goes away mid sentence (abort hands nothing over).
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      wantedRef.current = false;
      clearTimers();
      recognitionRef.current?.abort();
    };
  }, []);

  return { supported, listening, transcript, error, start, stop };
}
