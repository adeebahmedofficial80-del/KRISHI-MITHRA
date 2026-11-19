import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchDailyBriefing, fetchQuickSummary, fetchTtsAudio} from '../services/aiClient';
import {DailyBriefingResponse, LanguageCode} from '../types/krishi';

export type AudioPlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused';

const SPEECH_LOCALE_MAP: Record<LanguageCode, string> = {
  en: 'en-IN',
  kn: 'kn-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  ta: 'ta-IN',
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const usingSpeechSynthRef = useRef<boolean>(false);
  const requestSeqRef = useRef<number>(0);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<AudioPlaybackStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<DailyBriefingResponse | null>(null);

  const stop = useCallback(() => {
    requestSeqRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (usingSpeechSynthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    usingSpeechSynthRef.current = false;
    setActiveKey(null);
    setLoadingKey(null);
    setStatus('idle');
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setStatus('paused');
      return;
    }
    if (usingSpeechSynthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setStatus('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      void audioRef.current.play().then(() => {
        setStatus('playing');
      });
      return;
    }
    if (usingSpeechSynthRef.current && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setStatus('playing');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playAudioPayload = useCallback(
    async (
      key: string,
      seq: number,
      audioBase64: string | null,
      mimeType: string | null,
      fallbackText: string,
      language: LanguageCode,
    ) => {
      if (requestSeqRef.current !== seq) return;

      if (audioBase64) {
        const audio = new Audio(`data:${mimeType || 'audio/wav'};base64,${audioBase64}`);
        audioRef.current = audio;
        usingSpeechSynthRef.current = false;

        audio.onended = () => {
          setActiveKey(null);
          setStatus('idle');
          audioRef.current = null;
        };
        audio.onerror = () => {
          setActiveKey(null);
          setStatus('idle');
          setError('Unable to play generated voice audio on this device. You can read the briefing text below.');
          audioRef.current = null;
        };

        setActiveKey(key);
        setStatus('playing');
        await audio.play();
        return;
      }

      // Graceful browser speech fallback if Gemini TTS was unavailable
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && fallbackText) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(fallbackText);
        utter.lang = SPEECH_LOCALE_MAP[language] || 'en-IN';
        utter.rate = 0.96;
        usingSpeechSynthRef.current = true;
        utter.onend = () => {
          usingSpeechSynthRef.current = false;
          setActiveKey(null);
          setStatus('idle');
        };
        utter.onerror = () => {
          usingSpeechSynthRef.current = false;
          setActiveKey(null);
          setStatus('idle');
        };
        setActiveKey(key);
        setStatus('playing');
        window.speechSynthesis.speak(utter);
        return;
      }

      setStatus('idle');
      setActiveKey(null);
    },
    [],
  );

  const playDailyBriefing = useCallback(
    async (params: {
      farmerName: string;
      locationId: string;
      state?: string;
      district?: string;
      taluk?: string;
      preferredMandi?: string;
      savedCropIds: string[];
      language: LanguageCode;
      forceRefresh?: boolean;
    }) => {
      const key = 'home-daily-briefing';

      // Prevent duplicate concurrent requests while loading
      if (loadingKey === key) return;

      // Toggle pause/resume if already active for this briefing and not forcing refresh
      if (!params.forceRefresh && activeKey === key) {
        if (status === 'playing') {
          pause();
          return;
        }
        if (status === 'paused') {
          resume();
          return;
        }
      }

      stop();
      const seq = requestSeqRef.current;
      setError(null);
      setLoadingKey(key);
      setStatus('loading');

      try {
        const result = await fetchDailyBriefing(params);
        if (requestSeqRef.current !== seq) return;

        setBriefing(result);
        setLoadingKey(null);

        if (result.audioError && !result.audioBase64) {
          setError('Gemini voice synthesis was unavailable; showing full briefing text with device voice fallback.');
        }

        await playAudioPayload(
          key,
          seq,
          result.audioBase64,
          result.mimeType,
          result.briefingText,
          params.language,
        );
      } catch (err: unknown) {
        if (requestSeqRef.current !== seq) return;
        setError(getErrorMessage(err, 'Unable to prepare your morning update right now.'));
        setActiveKey(null);
        setLoadingKey(null);
        setStatus('idle');
      }
    },
    [activeKey, loadingKey, pause, playAudioPayload, resume, status, stop],
  );

  const speakText = useCallback(
    async (params: {
      key: string;
      text: string;
      language: LanguageCode;
      quickSummarizeTopic?: string;
      quickSummarizePayload?: Record<string, unknown>;
    }) => {
      if (loadingKey === params.key) return;
      if (activeKey === params.key) {
        if (status === 'playing') {
          pause();
          return;
        }
        if (status === 'paused') {
          resume();
          return;
        }
      }

      stop();
      const seq = requestSeqRef.current;
      setError(null);
      setLoadingKey(params.key);
      setStatus('loading');

      try {
        let spokenText = params.text;
        if (params.quickSummarizeTopic && params.quickSummarizePayload) {
          try {
            const generated = await fetchQuickSummary({
              topic: params.quickSummarizeTopic,
              payload: params.quickSummarizePayload,
              language: params.language,
            });
            if (generated.trim()) {
              spokenText = generated.trim();
            }
          } catch {
            // Fall back to direct text if quick summary fails
          }
        }

        let audioBase64: string | null = null;
        let mimeType: string | null = null;
        try {
          const tts = await fetchTtsAudio({
            text: spokenText,
            language: params.language,
          });
          audioBase64 = tts.audioBase64;
          mimeType = tts.mimeType;
        } catch {
          audioBase64 = null;
        }

        if (requestSeqRef.current !== seq) return;
        setLoadingKey(null);

        await playAudioPayload(
          params.key,
          seq,
          audioBase64,
          mimeType,
          spokenText,
          params.language,
        );
      } catch (err: unknown) {
        if (requestSeqRef.current !== seq) return;
        setError(getErrorMessage(err, 'Voice readout failed.'));
        setActiveKey(null);
        setLoadingKey(null);
        setStatus('idle');
      }
    },
    [activeKey, loadingKey, pause, playAudioPayload, resume, status, stop],
  );

  return {
    activeKey,
    loadingKey,
    status,
    error,
    briefing,
    clearError: () => setError(null),
    clearBriefing: () => setBriefing(null),
    playDailyBriefing,
    speakText,
    pause,
    resume,
    stop,
  };
}
