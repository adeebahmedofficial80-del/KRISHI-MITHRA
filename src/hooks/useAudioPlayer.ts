import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchQuickSummary, fetchTtsAudio} from '../services/aiClient';
import {LanguageCode} from '../types/krishi';

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setActiveKey(null);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const speakText = useCallback(
    async (params: {
      key: string;
      text: string;
      language: LanguageCode;
      quickSummarizeTopic?: string;
      quickSummarizePayload?: Record<string, unknown>;
    }) => {
      if (activeKey === params.key) {
        stop();
        return;
      }
      stop();
      setError(null);
      setLoadingKey(params.key);
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
        const {audioBase64, mimeType} = await fetchTtsAudio({
          text: spokenText,
          language: params.language,
        });
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          setActiveKey(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setActiveKey(null);
          setError('Unable to play generated voice audio on this device.');
          audioRef.current = null;
        };
        setActiveKey(params.key);
        await audio.play();
      } catch (err: any) {
        setError(err?.message || 'Voice readout failed.');
        setActiveKey(null);
      } finally {
        setLoadingKey(null);
      }
    },
    [activeKey, stop],
  );

  return {
    activeKey,
    loadingKey,
    error,
    clearError: () => setError(null),
    speakText,
    stop,
  };
}
