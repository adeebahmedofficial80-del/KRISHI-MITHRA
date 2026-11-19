import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Lightbulb,
  MessageSquareShare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {TranslationPack} from '../data/translations';
import {askKrishiAdvisor} from '../services/aiClient';
import {marketProvider} from '../services/marketProvider';
import {
  ChatSpace,
  fetchChatSpaces,
  fetchGoogleContacts,
  FpoContact,
  sendChatMessage,
} from '../services/workspaceClient';
import {
  FarmNote,
  LanguageCode,
  LocationOption,
  WeatherSnapshot,
} from '../types/krishi';

interface InsightsViewProps {
  t: TranslationPack;
  language: LanguageCode;
  location: LocationOption;
  weather: WeatherSnapshot | null;
  farmNotes: FarmNote[];
  workspaceToken: string | null;
  onSaveNote: (input: {id?: string; title: string; content: string; cropId: string}) => void;
  onDeleteNote: (noteId: string) => void;
  onConnectWorkspace: () => Promise<void>;
  onOpenCropDetail: (cropId: string) => void;
  onNotify: (msg: string) => void;
  audioActiveKey: string | null;
  audioLoadingKey: string | null;
  onListen: (params: {
    key: string;
    text: string;
    language: LanguageCode;
  }) => void;
}

export function InsightsView({
  t,
  language,
  location,
  weather,
  farmNotes,
  workspaceToken,
  onSaveNote,
  onDeleteNote,
  onConnectWorkspace,
  onOpenCropDetail,
  onNotify,
  audioActiveKey,
  audioLoadingKey,
  onListen,
}: InsightsViewProps) {
  const allProducts = useMemo(() => marketProvider.getAllProducts(), []);
  const calculatedInsights = useMemo(() => marketProvider.generateCalculatedInsights(), []);

  // Advisor state
  const [question, setQuestion] = useState('');
  const [contextCropId, setContextCropId] = useState('tomato');
  const [advisorAnswer, setAdvisorAnswer] = useState<string | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

  // Farm Notes CRUD state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCropId, setNoteCropId] = useState('tomato');

  // Workspace FPO Contacts & Google Chat state
  const [contacts, setContacts] = useState<FpoContact[]>([]);
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpaceName, setSelectedSpaceName] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [shareDraft, setShareDraft] = useState(() => {
    return `Krishi Mitra Daily Report (${location.name}): Tomato ₹22/kg (+8.5%), Onion ₹45/kg (+5.2%), Potato ₹24/kg (-3.4%), Banana ₹35/kg (+3.5%).`;
  });
  const [confirmChatOpen, setConfirmChatOpen] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);

  const selectedContextCrop = useMemo(
    () => allProducts.find((c) => c.id === contextCropId) || allProducts[0],
    [allProducts, contextCropId],
  );

  const handleAskAdvisor = async (customPrompt?: string) => {
    const q = (customPrompt ?? question).trim();
    if (!q) return;
    if (customPrompt) setQuestion(customPrompt);
    setAdvisorLoading(true);
    setAdvisorError(null);
    try {
      const res = await askKrishiAdvisor({
        question: q,
        cropContext: {
          crop: selectedContextCrop.name,
          variety: selectedContextCrop.variety,
          modalPriceInrPerKg: selectedContextCrop.modalPrice,
          minPrice: selectedContextCrop.minimumPrice,
          maxPrice: selectedContextCrop.maximumPrice,
          weeklyTrendPercent: selectedContextCrop.priceChangePercent,
          market: selectedContextCrop.market,
          storage: selectedContextCrop.storage,
          shelfLife: selectedContextCrop.shelfLife,
        },
        weatherContext: weather
          ? {
              location: weather.locationName,
              tempC: weather.currentTemperature,
              rainChancePercent: weather.rainProbability,
              humidityPercent: weather.humidity,
              windKmh: weather.windSpeed,
            }
          : undefined,
        locationName: `${location.name}, ${location.state}`,
        language,
      });
      setAdvisorAnswer(res.answer);
    } catch (err: any) {
      setAdvisorError(err?.message || 'Unable to contact Krishi Mitra Advisor.');
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleSaveNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    onSaveNote({
      id: editingNoteId || undefined,
      title: noteTitle,
      content: noteContent,
      cropId: noteCropId,
    });
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    onNotify(editingNoteId ? 'Farm note updated.' : 'Farm note saved.');
  };

  const handleCopyForKeep = async (note: FarmNote) => {
    const formatted = `${note.title}\n${note.content}`;
    try {
      await navigator.clipboard.writeText(formatted);
      onNotify('Copied note to clipboard — ready to paste into Google Keep.');
    } catch {
      onNotify('Note ready to copy.');
    }
  };

  const handleLoadWorkspaceData = async () => {
    if (!workspaceToken) {
      await onConnectWorkspace();
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceNotice(null);
    const notices: string[] = [];

    try {
      const loadedContacts = await fetchGoogleContacts(workspaceToken);
      setContacts(loadedContacts);
    } catch (err: any) {
      notices.push(err?.message || 'Could not load Google Contacts.');
    }

    try {
      const loadedSpaces = await fetchChatSpaces(workspaceToken);
      setSpaces(loadedSpaces);
      if (loadedSpaces.length > 0 && !selectedSpaceName) {
        setSelectedSpaceName(loadedSpaces[0].name);
      } else if (loadedSpaces.length === 0) {
        notices.push('No Google Chat spaces found for this account.');
      }
    } catch (err: any) {
      notices.push(err?.message || 'Could not load Google Chat spaces.');
    }

    if (notices.length > 0) {
      setWorkspaceNotice(notices.join(' '));
    }
    setWorkspaceLoading(false);
  };

  const handleConfirmSendChat = async () => {
    if (!workspaceToken || !selectedSpaceName || !shareDraft.trim()) return;
    setSendingChat(true);
    try {
      await sendChatMessage(workspaceToken, selectedSpaceName, shareDraft.trim());
      setConfirmChatOpen(false);
      onNotify('Daily market summary shared to Google Chat space.');
    } catch (err: any) {
      setWorkspaceNotice(err?.message || 'Unable to send Google Chat message.');
      setConfirmChatOpen(false);
    } finally {
      setSendingChat(false);
    }
  };

  const audioKey = 'advisor-answer';
  const isPlaying = audioActiveKey === audioKey;
  const isAudioLoading = audioLoadingKey === audioKey;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6">
        <h1 className="text-2xl font-bold text-[#202820]">{t.insightsTitle}</h1>
        <p className="mt-1 text-sm text-[#6B756A]">{t.insightsSubtitle}</p>
      </section>

      {/* Calculated Data Insights */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {calculatedInsights.map((ins) => (
          <button
            key={ins.id}
            type="button"
            onClick={() => onOpenCropDetail(ins.cropId)}
            className="bg-white border border-[#E4E9E0] rounded-2xl p-4 text-left hover:border-[#245C3A] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#245C3A]">
                <Lightbulb className="w-4 h-4" />
                <span>Market Data Insight</span>
              </div>
              <span className="font-mono text-xs font-bold text-[#245C3A] tabular-nums">
                {ins.metric}
              </span>
            </div>
            <h2 className="mt-2 text-base font-bold text-[#202820]">{ins.title}</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#6B756A] leading-relaxed">{ins.detail}</p>
          </button>
        ))}
      </section>

      {/* Deep-Thinking Krishi Mitra AI Advisor */}
      <section className="bg-white border border-[#E4E9E0] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3E8] text-[#245C3A] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#202820]">{t.askAdvisorTitle}</h2>
              <p className="text-xs text-[#6B756A]">
                Practical crop, harvest, storage & mandi comparison guidance in your language
              </p>
            </div>
          </div>

          <select
            aria-label="Context crop for advisor"
            value={contextCropId}
            onChange={(e) => setContextCropId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm font-medium text-[#202820]"
          >
            {allProducts.map((c) => (
              <option key={c.id} value={c.id}>
                Context: {t.cropNames[c.id] || c.name} (₹{c.modalPrice}/kg)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            `Should I harvest and sell ${selectedContextCrop.name} now or grade for Bengaluru APMC?`,
            `How do I reduce spoilage for ${selectedContextCrop.name} during rainy days?`,
            `Compare Bengaluru APMC vs Hoskote & Doddaballapur for ${selectedContextCrop.name}.`,
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => void handleAskAdvisor(preset)}
              className="px-3 py-1.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-xs font-medium text-[#202820] hover:bg-[#EAF3E8] cursor-pointer text-left"
            >
              {preset}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleAskAdvisor();
          }}
          className="space-y-3"
        >
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t.askAdvisorPlaceholder}
            className="w-full p-3.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={advisorLoading || !question.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{advisorLoading ? 'Thinking carefully...' : t.askAdvisorBtn}</span>
            </button>
          </div>
        </form>

        {advisorError && <p className="text-sm text-amber-800">{advisorError}</p>}

        {advisorAnswer && (
          <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#245C3A]">
                Advisor Guidance
              </span>
              <button
                type="button"
                disabled={isAudioLoading}
                onClick={() =>
                  onListen({
                    key: audioKey,
                    text: advisorAnswer,
                    language,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E9E0] bg-white text-xs font-semibold text-[#202820] cursor-pointer"
              >
                {isPlaying ? (
                  <VolumeX className="w-3.5 h-3.5 text-[#245C3A]" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-[#245C3A]" />
                )}
                <span>
                  {isAudioLoading
                    ? t.loadingAudio
                    : isPlaying
                      ? t.stopAudio
                      : t.listenSummary}
                </span>
              </button>
            </div>
            <div className="text-sm text-[#202820] whitespace-pre-line leading-relaxed">
              {advisorAnswer}
            </div>
          </div>
        )}
      </section>

      {/* Farm Notes + FPO Sharing Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* My Farm Notes */}
        <div className="lg:col-span-6 bg-white border border-[#E4E9E0] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-[#202820]">{t.farmNotesTitle}</h2>
              <p className="text-xs text-[#6B756A]">
                Saved locally & synced to your account when signed in
              </p>
            </div>
            <a
              href="https://keep.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#245C3A] hover:underline"
            >
              <span>Open Google Keep</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <form onSubmit={handleSaveNoteSubmit} className="space-y-2.5 bg-[#FAF9F4] p-3.5 rounded-xl border border-[#E4E9E0]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                maxLength={120}
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title (e.g. Tomato lot #3)"
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-[#E4E9E0] bg-white text-sm text-[#202820]"
              />
              <select
                aria-label="Related crop"
                value={noteCropId}
                onChange={(e) => setNoteCropId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#E4E9E0] bg-white text-sm text-[#202820]"
              >
                <option value="">General Note</option>
                {allProducts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t.cropNames[c.id] || c.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={2}
              required
              maxLength={2000}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write crate weights, buyer quotes, or irrigation logs..."
              className="w-full px-3 py-2 rounded-lg border border-[#E4E9E0] bg-white text-sm text-[#202820]"
            />
            <div className="flex items-center justify-end gap-2">
              {editingNoteId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNoteId(null);
                    setNoteTitle('');
                    setNoteContent('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B756A] cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{editingNoteId ? 'Update Note' : 'Save Note'}</span>
              </button>
            </div>
          </form>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {farmNotes.map((note) => {
              const cropLabel = note.cropId ? t.cropNames[note.cropId] || note.cropId : 'General';
              return (
                <div
                  key={note.id}
                  className="rounded-xl border border-[#E4E9E0] bg-white p-3.5 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#202820]">{note.title}</p>
                      <p className="text-[11px] text-[#245C3A] font-medium">{cropLabel}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleCopyForKeep(note)}
                        title="Copy for Google Keep"
                        className="p-1.5 rounded-lg text-[#6B756A] hover:text-[#245C3A] cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setNoteTitle(note.title);
                          setNoteContent(note.content);
                          setNoteCropId(note.cropId);
                        }}
                        title="Edit note"
                        className="p-1.5 rounded-lg text-[#6B756A] hover:text-[#202820] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        title="Delete note"
                        className="p-1.5 rounded-lg text-[#6B756A] hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#6B756A] leading-relaxed">{note.content}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* FPO Sharing & Google Contacts / Google Chat */}
        <div className="lg:col-span-6 bg-white border border-[#E4E9E0] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquareShare className="w-5 h-5 text-[#245C3A]" />
              <h2 className="text-lg font-bold text-[#202820]">{t.fpoCollabTitle}</h2>
            </div>

            <button
              type="button"
              disabled={workspaceLoading}
              onClick={() => void handleLoadWorkspaceData()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-xs font-semibold text-[#202820] hover:bg-[#EAF3E8] cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#245C3A]" />
              <span>
                {workspaceLoading
                  ? 'Loading...'
                  : workspaceToken
                    ? 'Load Contacts & Chat Spaces'
                    : 'Connect Google Workspace'}
              </span>
            </button>
          </div>

          {workspaceNotice && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
              {workspaceNotice}
            </p>
          )}

          {contacts.length > 0 && (
            <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3 space-y-2">
              <p className="text-xs font-semibold text-[#6B756A] uppercase tracking-wider">
                FPO / Buyer Contacts ({contacts.length})
              </p>
              <div className="max-h-32 overflow-y-auto divide-y divide-[#E4E9E0] text-xs">
                {contacts.slice(0, 8).map((c) => (
                  <div key={c.resourceName} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#202820] truncate">{c.name}</span>
                    <span className="text-[#6B756A] truncate">{c.phone || c.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <label
              htmlFor="fpo-share-draft"
              className="block text-xs font-semibold uppercase tracking-wider text-[#6B756A]"
            >
              Daily Mandi Report Draft
            </label>
            <textarea
              id="fpo-share-draft"
              rows={3}
              value={shareDraft}
              onChange={(e) => setShareDraft(e.target.value)}
              className="w-full p-3 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] text-sm text-[#202820]"
            />

            {spaces.length > 0 && (
              <div>
                <label
                  htmlFor="chat-space-select"
                  className="block text-xs font-semibold text-[#6B756A] mb-1"
                >
                  Google Chat Space
                </label>
                <select
                  id="chat-space-select"
                  value={selectedSpaceName}
                  onChange={(e) => setSelectedSpaceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820]"
                >
                  {spaces.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareDraft);
                    onNotify('Copied FPO market summary to clipboard.');
                  } catch {
                    onNotify('Summary ready to share.');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E9E0] bg-white text-xs font-semibold text-[#202820] hover:bg-[#FAF9F4] cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Report</span>
              </button>

              {spaces.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmChatOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#245C3A] text-white text-xs font-semibold hover:bg-[#1d4b2f] cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Google Chat</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Explicit Confirmation Modal before sending Google Chat Message */}
      {confirmChatOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-chat-title"
        >
          <div className="bg-white border border-[#E4E9E0] rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 id="confirm-chat-title" className="text-lg font-bold text-[#202820]">
                Confirm Google Chat Message
              </h3>
              <button
                type="button"
                onClick={() => setConfirmChatOpen(false)}
                className="p-1 text-[#6B756A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#6B756A]">
              Destination:{' '}
              <strong className="text-[#202820]">
                {spaces.find((s) => s.name === selectedSpaceName)?.displayName ||
                  selectedSpaceName}
              </strong>
            </p>
            <div className="rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] p-3 text-sm text-[#202820]">
              {shareDraft}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmChatOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#E4E9E0] text-sm text-[#6B756A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingChat}
                onClick={() => void handleConfirmSendChat()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#245C3A] text-white text-sm font-semibold cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{sendingChat ? 'Sending...' : 'Confirm & Send'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
