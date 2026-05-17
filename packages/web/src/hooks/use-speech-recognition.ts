"use client";

import { useState, useCallback, useRef } from "react";
import { getToken } from "@/lib/auth";

interface SpeechRecognitionConfig {
  id: string;
  provider: string;
  credentials: Record<string, string>;
}

export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false);
  const [config, setConfig] = useState<SpeechRecognitionConfig | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConfig = useCallback(async (): Promise<SpeechRecognitionConfig | null> => {
    const token = getToken();
    console.log("[speech] loading config, token:", token ? "present" : "missing");
    const res = await fetch("/api/speech-recognition", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    console.log("[speech] config response status:", res.status);
    if (!res.ok) return null;
    const configs: SpeechRecognitionConfig[] = await res.json();
    console.log("[speech] configs found:", configs.length, configs.length > 0 ? configs[0] : "");
    return configs.length > 0 ? configs[0] : null;
  }, []);

  const start = useCallback(
    async (onText: (text: string, isFinal: boolean) => void) => {
      const cfg = await loadConfig();
      if (!cfg) {
        console.warn("[speech] no config found, aborting");
        return false;
      }
      setConfig(cfg);

      const token = getToken();
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${location.host}/ws/speech?token=${token ?? ""}&configId=${cfg.id}`;
      console.log("[speech] connecting to", wsUrl.replace(/token=[^&]+/, "token=***"));
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.error) {
            console.error("[speech] error from server:", data.error);
            return;
          }
          if (data.text) {
            console.log("[speech] result:", data.text, "isFinal:", data.isFinal);
            onText(data.text, data.isFinal);
          }
        } catch (err) {
          console.error("[speech] failed to parse message:", err);
        }
      };

      ws.onerror = (e) => {
        console.error("[speech] WebSocket error", e);
        stop();
      };

      try {
        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            console.log("[speech] WebSocket connected");
            resolve();
          };
          ws.onerror = (e) => {
            console.error("[speech] WebSocket connect failed", e);
            reject(new Error("WS connect failed"));
          };
        });
      } catch {
        return false;
      }

      // Get microphone stream
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
        });
        console.log("[speech] microphone acquired, tracks:", stream.getAudioTracks().length);
      } catch (err) {
        console.error("[speech] microphone access denied:", err);
        ws.close();
        return false;
      }
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      console.log("[speech] AudioContext sampleRate:", audioContext.sampleRate);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let audioChunkCount = 0;
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(int16.buffer);
        audioChunkCount++;
        if (audioChunkCount <= 3 || audioChunkCount % 50 === 0) {
          console.log("[speech] sent audio chunk #", audioChunkCount, "size:", int16.buffer.byteLength);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      return true;
    },
    [loadConfig]
  );

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end" }));
      wsRef.current.close();
    }
    wsRef.current = null;
    processorRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop, config };
}
