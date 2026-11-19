import {ArrowRight, Loader2, MapPin, Sparkles} from 'lucide-react';
import {motion, useReducedMotion} from 'motion/react';
import {useState} from 'react';
import {getTimeBasedGreeting} from '../data/translations';
import {LanguageCode} from '../types/krishi';

const OFFICIAL_LOGO_URL = '/assets/aistudio/1b0ca66f-3975-4c99-adee-4dfad66df9ff_06020d3d.png';

interface GrandOpeningScreenProps {
  farmerName: string;
  locationLabel: string;
  preferredMandi: string;
  language: LanguageCode;
  onEnterDashboard: () => Promise<void>;
}

export function GrandOpeningScreen({
  farmerName,
  locationLabel,
  preferredMandi,
  language,
  onEnterDashboard,
}: GrandOpeningScreenProps) {
  const prefersReducedMotion = useReducedMotion();
  const [entering, setEntering] = useState(false);

  const greeting = getTimeBasedGreeting(language, farmerName);

  const handleEnter = async () => {
    setEntering(true);
    try {
      await onEnterDashboard();
    } finally {
      setEntering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1A11] text-white flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Subtle atmospheric agricultural radial backdrop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 24%, rgba(74, 150, 74, 0.24) 0%, rgba(13, 26, 17, 0.96) 62%)',
        }}
      />

      <motion.div
        initial={prefersReducedMotion ? {opacity: 1} : {opacity: 0, y: 18}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut'}}
        className="relative z-10 w-full max-w-2xl rounded-3xl border border-[#2A4B34] bg-[#08110B]/90 backdrop-blur-md p-7 sm:p-10 text-center shadow-2xl"
      >
        <motion.div
          initial={prefersReducedMotion ? {opacity: 1} : {opacity: 0, scale: 0.92}}
          animate={{opacity: 1, scale: 1}}
          transition={{duration: prefersReducedMotion ? 0 : 0.55, delay: 0.08, ease: 'easeOut'}}
          className="mx-auto w-56 h-56 sm:w-64 sm:h-64 rounded-3xl bg-[#050705] border border-[#245C3A]/50 p-3 flex items-center justify-center shadow-lg"
        >
          <img
            src={OFFICIAL_LOGO_URL}
            alt="KRISHI-MITHRA Official Emblem"
            className="max-w-full max-h-full object-contain"
          />
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? {opacity: 1} : {opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: prefersReducedMotion ? 0 : 0.5, delay: 0.2}}
          className="mt-6 space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#163621] border border-[#2D6A43] text-[#A8D5A2] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to KRISHI-MITHRA</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            {greeting}
          </h1>

          <p className="text-sm sm:text-base text-[#C7D7C5] max-w-xl mx-auto leading-relaxed">
            Your Smart Farming Companion for Live Market Prices, Weather, and Advisories.
          </p>

          <p className="text-sm sm:text-base text-[#E7EFE6] max-w-lg mx-auto leading-relaxed pt-1">
            Welcome aboard, <span className="font-semibold text-[#A8D5A2]">{farmerName}</span>. Your
            farming journey just became smarter. Let&apos;s make today&apos;s decisions count.
          </p>

          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-[#102417] border border-[#22442D] text-xs text-[#C7D7C5] mt-2">
            <MapPin className="w-3.5 h-3.5 text-[#88C57F]" />
            <span>{locationLabel}</span>
            {preferredMandi && (
              <>
                <span className="text-[#4B6E55]">·</span>
                <span>Primary Mandi: {preferredMandi}</span>
              </>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? {opacity: 1} : {opacity: 0, y: 8}}
          animate={{opacity: 1, y: 0}}
          transition={{duration: prefersReducedMotion ? 0 : 0.45, delay: 0.35}}
          className="mt-8"
        >
          <button
            type="button"
            onClick={() => void handleEnter()}
            disabled={entering}
            className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-[#38864D] hover:bg-[#2F7542] disabled:opacity-60 text-white font-semibold text-base transition-colors cursor-pointer"
          >
            {entering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Opening your dashboard...</span>
              </>
            ) : (
              <>
                <span>Enter Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
