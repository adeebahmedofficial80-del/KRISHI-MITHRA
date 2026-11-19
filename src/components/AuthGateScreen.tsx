import {AlertCircle, CloudSun, Loader2, Mic, ShieldCheck, Sprout} from 'lucide-react';
import React, {useState} from 'react';
import {LANGUAGE_OPTIONS} from '../data/translations';
import {LanguageCode} from '../types/krishi';

const OFFICIAL_LOGO_URL = '/assets/aistudio/1b0ca66f-3975-4c99-adee-4dfad66df9ff_06020d3d.png';

interface AuthGateScreenProps {
  selectedLanguage: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  onGoogleSignIn: (farmerName: string) => Promise<void>;
  externalError?: string | null;
}

function formatAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
    return 'Google sign-in window was closed before completing. Please try again when ready.';
  }
  if (msg.includes('popup-blocked')) {
    return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
  }
  if (msg.includes('network-request-failed')) {
    return 'Network connection interrupted during sign-in. Please check your internet and retry.';
  }
  if (msg.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this preview host';
    return `Domain "${host}" is not authorized in Firebase Authentication settings. Please add it under Authorized Domains in Firebase Console.`;
  }
  return msg || 'Unable to sign in with Google right now. Please try again.';
}

export function AuthGateScreen({
  selectedLanguage,
  onChangeLanguage,
  onGoogleSignIn,
  externalError,
}: AuthGateScreenProps) {
  const [farmerName, setFarmerName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = farmerName.trim();
    if (!trimmed) {
      setValidationError('Please enter your name so KRISHI-MITHRA can personalize your dashboard.');
      return;
    }
    if (trimmed.length < 2) {
      setValidationError('Please enter at least 2 characters for your name.');
      return;
    }

    setValidationError(null);
    setAuthError(null);
    setSubmitting(true);
    try {
      await onGoogleSignIn(trimmed);
    } catch (err: unknown) {
      setAuthError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = validationError || authError || externalError;

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#202820] flex flex-col">
      {/* Top minimal bar with language selector */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#050705] overflow-hidden border border-[#245C3A]/30 flex items-center justify-center shrink-0">
            <img
              src={OFFICIAL_LOGO_URL}
              alt="KRISHI-MITHRA official emblem"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-[#202820] leading-none">
              KRISHI-MITHRA
            </p>
            <p className="text-[11px] text-[#5B675B] mt-0.5">Smart Farmer Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white border border-[#E2E6DC] rounded-xl p-1">
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = selectedLanguage === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => onChangeLanguage(opt.code)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[#245C3A] text-white'
                    : 'text-[#5B675B] hover:bg-[#F1F4EC] hover:text-[#202820]'
                }`}
              >
                {opt.nativeLabel}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main split showcase & authentication card */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          {/* Left: Official Brand Presentation */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-3xl bg-[#050705] border border-[#1E3B28] p-6 sm:p-8 flex flex-col items-center text-center shadow-sm">
              <div className="w-52 h-52 sm:w-64 sm:h-64 flex items-center justify-center">
                <img
                  src={OFFICIAL_LOGO_URL}
                  alt="KRISHI-MITHRA Official Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#A8D5A2] font-semibold mt-2">
                Better Prices · Better Decisions · Better Harvests
              </p>
              <p className="text-sm text-[#D7E2D6] mt-2 max-w-md leading-relaxed">
                Your trusted Indian agricultural companion for daily APMC mandi rates, live local
                weather, crop advisories, and personalized morning voice briefings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-[#E2E6DC] rounded-2xl p-3.5">
                <Sprout className="w-5 h-5 text-[#245C3A] mb-2" />
                <p className="text-xs font-semibold text-[#202820]">44+ Indian Crops</p>
                <p className="text-[11px] text-[#5B675B] mt-0.5 leading-snug">
                  Track vegetables & fruits you actually grow with Gemini Search live mandi sync.
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DC] rounded-2xl p-3.5">
                <CloudSun className="w-5 h-5 text-[#245C3A] mb-2" />
                <p className="text-xs font-semibold text-[#202820]">Live Local Weather</p>
                <p className="text-[11px] text-[#5B675B] mt-0.5 leading-snug">
                  7-day forecasts, rain alerts, and crop-sensitive field guidance.
                </p>
              </div>
              <div className="bg-white border border-[#E2E6DC] rounded-2xl p-3.5">
                <Mic className="w-5 h-5 text-[#245C3A] mb-2" />
                <p className="text-xs font-semibold text-[#202820]">Voice Briefings</p>
                <p className="text-[11px] text-[#5B675B] mt-0.5 leading-snug">
                  Personalized spoken morning summary in 5 Indian languages.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Sign-In & Compulsory Farmer Name Form */}
          <div className="lg:col-span-6">
            <div className="bg-white border border-[#E2E6DC] rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245C3A] bg-[#EAF3E8] px-3 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Farmer Account Access
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#202820] tracking-tight mt-3">
                  Sign in to KRISHI-MITHRA
                </h1>
                <p className="text-sm text-[#5B675B] mt-1.5 leading-relaxed">
                  Enter your name and continue with Google to save your location, tracked crops,
                  price alerts, and farm notes securely in your personal profile.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="farmer-name-input"
                    className="block text-sm font-semibold text-[#202820] mb-1.5"
                  >
                    What should we call you? <span className="text-[#B83B30]">*</span>
                  </label>
                  <input
                    id="farmer-name-input"
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="name"
                    value={farmerName}
                    onChange={(e) => {
                      setFarmerName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="Enter your name"
                    className={`w-full px-4 py-3 rounded-xl border text-base bg-[#F7F8F4] text-[#202820] placeholder:text-[#869186] focus:outline-none focus:ring-2 transition-colors ${
                      validationError
                        ? 'border-[#B83B30] focus:ring-[#B83B30]/20 bg-white'
                        : 'border-[#D4DCD0] focus:border-[#245C3A] focus:ring-[#245C3A]/20 focus:bg-white'
                    }`}
                  />
                  <p className="text-xs text-[#5B675B] mt-1.5">
                    We use this name to greet you on your dashboard and in your spoken morning
                    updates.
                  </p>
                </div>

                {activeError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FDF2F2] border border-[#F3C6C2] text-xs text-[#9E2B25]"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{activeError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-[#245C3A] hover:bg-[#1D4B2F] disabled:opacity-60 text-white font-semibold text-sm sm:text-base transition-colors cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing in with Google...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                          />
                          <path
                            fill="#34A853"
                            d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                          />
                        </svg>
                      </span>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#E8ECE4] text-xs text-[#5B675B] space-y-1.5">
                <p>
                  New accounts start with a clean dashboard (0 crops selected) so you only track
                  what you grow.
                </p>
                <p>
                  Returning farmers will automatically restore their saved location, crops, and
                  alerts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
