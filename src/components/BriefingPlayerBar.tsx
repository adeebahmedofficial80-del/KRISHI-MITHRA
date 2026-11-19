import {
  AlertCircle,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {AudioPlaybackStatus} from '../hooks/useAudioPlayer';
import {DailyBriefingResponse} from '../types/krishi';

interface BriefingPlayerBarProps {
  status: AudioPlaybackStatus;
  isLoading: boolean;
  briefing: DailyBriefingResponse | null;
  error: string | null;
  onPlayOrToggle: () => void;
  onRefresh: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDismiss: () => void;
}

export function BriefingPlayerBar({
  status,
  isLoading,
  briefing,
  error,
  onPlayOrToggle,
  onRefresh,
  onPause,
  onResume,
  onStop,
  onDismiss,
}: BriefingPlayerBarProps) {
  if (!isLoading && !briefing && !error) {
    return null;
  }

  return (
    <section
      aria-live="polite"
      className="bg-white border border-[#D4E2D0] rounded-2xl p-4 sm:p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#EAF3E8] text-[#245C3A] flex items-center justify-center shrink-0">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#202820]">
              {isLoading
                ? 'Preparing your morning update...'
                : status === 'playing'
                  ? 'Playing your personalized daily briefing'
                  : status === 'paused'
                    ? 'Briefing paused'
                    : 'Your personalized daily briefing'}
            </p>
            {briefing && !isLoading && (
              <p className="text-[11px] text-[#5B675B]">
                {briefing.dataSources.weatherSource}
                {' · '}
                {briefing.dataSources.marketStatus === 'gemini_grounded'
                  ? `Gemini Live Search (${briefing.dataSources.marketObservationDate || 'Latest'})`
                  : briefing.dataSources.marketStatus === 'cached_grounded'
                    ? `Cached Gemini Search (${briefing.dataSources.marketObservationDate || 'Recent'})`
                    : 'Verified market prices pending'}
                {briefing.cached ? ' · Instant cache' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isLoading && briefing && (
            <>
              {status === 'playing' ? (
                <button
                  type="button"
                  onClick={onPause}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#245C3A] text-white text-xs font-semibold hover:bg-[#1D4B2F] transition-colors cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </button>
              ) : status === 'paused' ? (
                <button
                  type="button"
                  onClick={onResume}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#245C3A] text-white text-xs font-semibold hover:bg-[#1D4B2F] transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPlayOrToggle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#245C3A] text-white text-xs font-semibold hover:bg-[#1D4B2F] transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Replay
                </button>
              )}

              {(status === 'playing' || status === 'paused') && (
                <button
                  type="button"
                  onClick={onStop}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#D4DCD0] text-[#3C483C] hover:bg-[#F1F4EC] text-xs font-medium transition-colors cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  Stop
                </button>
              )}

              <button
                type="button"
                onClick={onRefresh}
                title="Generate fresh briefing"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#D4DCD0] text-[#3C483C] hover:bg-[#F1F4EC] text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close briefing panel"
            className="p-1.5 rounded-lg text-[#5B675B] hover:bg-[#F1F4EC] hover:text-[#202820] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-[#FDF6EB] border border-[#EBD5B3] px-3.5 py-2.5 text-xs text-[#7D4E10]">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 font-semibold underline hover:text-[#5B3708] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {briefing?.briefingText && (
        <div className="rounded-xl bg-[#F7F8F4] border border-[#E5EAE0] px-4 py-3 text-sm text-[#2A332A] leading-relaxed">
          {briefing.briefingText}
        </div>
      )}
    </section>
  );
}
