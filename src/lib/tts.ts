import { useCallback, useEffect, useRef, useState } from 'react';
import { ipc } from './ipc-client';

/**
 * TTS 播放控制：用户主动点击才发声，绝不自动朗读。
 * 主实现：Edge-TTS（走代理，音色自然）→ 通过 IPC 合成 mp3 播放。
 * 兜底：Edge 合成失败（代理未开/断网）→ 回退系统语音（speechSynthesis）。
 * 同一时刻只播一句（播新句自动停旧句）。
 */
export function useTTS() {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentKeyRef = useRef<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    currentKeyRef.current = null;
    setPlayingKey(null);
    setBusyKey(null);
  }, []);

  const playAudio = useCallback((key: string, base64Audio: string) => {
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    // WAV 以 "RIFF" 开头，MP3 以 0xFF 开头
    const isWav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const blob = new Blob([bytes], { type: isWav ? 'audio/wav' : 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    currentKeyRef.current = key;
    setPlayingKey(key);
    audio.onended = () => {
      if (currentKeyRef.current === key) {
        currentKeyRef.current = null;
        setPlayingKey(null);
      }
    };
    audio.onerror = () => {
      if (currentKeyRef.current === key) {
        currentKeyRef.current = null;
        setPlayingKey(null);
      }
    };
    void audio.play();
  }, []);

  /** 系统语音兜底 */
  const playSystem = useCallback((key: string, text: string, voiceKeyword?: string, rateStr?: string, pitchStr?: string) => {
    if (!('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text.slice(0, 500));
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.filter((v) => v.lang.toLowerCase().startsWith('zh'));
    const base = zh.find((v) => v.lang === 'zh-CN') ?? zh[0];
    if (base) utter.voice = base;
    utter.rate = rateStr ? Math.max(0.5, Math.min(2, 1 + (parseFloat(rateStr) || 0) / 100)) : 1;
    utter.pitch = pitchStr ? Math.max(0.5, Math.min(2, 1 + (parseFloat(pitchStr) || 0) / 50)) : 1;
    utter.onend = () => {
      if (currentKeyRef.current === key) {
        currentKeyRef.current = null;
        setPlayingKey(null);
      }
    };
    utter.onerror = () => {
      if (currentKeyRef.current === key) {
        currentKeyRef.current = null;
        setPlayingKey(null);
      }
    };
    currentKeyRef.current = key;
    setPlayingKey(key);
    window.speechSynthesis.speak(utter);
  }, []);

  const speak = useCallback(
    async (key: string, text: string, voice: string, rate?: string, pitch?: string, sid?: number) => {
      if (currentKeyRef.current === key) {
        stop();
        return;
      }
      stop();
      setBusyKey(key);
      try {
        const r = await ipc.tts.synth({ text, voice, rate, pitch, sid });
        if (r.ok && r.audio) {
          setBusyKey(null);
          playAudio(key, r.audio);
          return;
        }
        // Edge 失败 → 系统语音兜底
        setBusyKey(null);
        playSystem(key, text, voice, rate, pitch);
      } catch {
        setBusyKey(null);
        playSystem(key, text, voice, rate, pitch);
      }
    },
    [stop, playAudio, playSystem],
  );

  useEffect(() => stop, [stop]);

  return { speakingKey: playingKey, busyKey, speak, stop };
}
