"use client";

// Thin wrapper over the browser Web Speech API (SpeechRecognition). Free,
// on-device, no API keys. Feature-detected — unsupported browsers (e.g. Firefox)
// simply don't get the mic button. Types are loose because the API isn't in
// the standard TS DOM lib.
import { useCallback, useEffect, useRef, useState } from "react";

function getCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useSpeech(onTranscript: (text: string) => void, onDone?: (finalText: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);
  const finalRef = useRef("");

  useEffect(() => { setSupported(!!getCtor()); }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";
    rec.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) finalRef.current = (finalRef.current + " " + final).trim();
      onTranscript((finalRef.current + " " + interim).trim());
    };
    rec.onend = () => { setListening(false); onDone?.(finalRef.current.trim()); };
    rec.onerror = () => { setListening(false); };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }, [onTranscript, onDone]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
