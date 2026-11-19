import {BellRing, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {CropProduct} from '../types/krishi';

interface PriceAlertModalProps {
  crop: CropProduct | null;
  cropDisplayName: string;
  onClose: () => void;
  onSave: (input: {
    cropId: string;
    targetPrice: number;
    condition: 'above' | 'below';
    channel: 'app' | 'sms_demo' | 'whatsapp_demo';
  }) => void;
}

export function PriceAlertModal({crop, cropDisplayName, onClose, onSave}: PriceAlertModalProps) {
  const [targetPrice, setTargetPrice] = useState<string>('25');
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [channel, setChannel] = useState<'app' | 'sms_demo' | 'whatsapp_demo'>('app');

  useEffect(() => {
    if (crop) {
      setTargetPrice(String(Math.round(crop.modalPrice * 1.1)));
      setCondition('above');
    }
  }, [crop]);

  if (!crop) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(targetPrice);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    onSave({
      cropId: crop.id,
      targetPrice: numeric,
      condition,
      channel,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-alert-modal-title"
    >
      <div className="bg-white border border-[#E4E9E0] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3E8] text-[#245C3A] flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 id="price-alert-modal-title" className="text-lg font-bold text-[#202820]">
                Set Price Alert
              </h3>
              <p className="text-xs text-[#6B756A]">
                {cropDisplayName} · Today ₹{crop.modalPrice}/kg
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-[#6B756A] hover:bg-[#FAF9F4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#6B756A] uppercase tracking-wider mb-1.5">
              Alert Condition
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCondition('above')}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
                  condition === 'above'
                    ? 'bg-[#EAF3E8] border-[#245C3A] text-[#245C3A]'
                    : 'bg-white border-[#E4E9E0] text-[#202820] hover:bg-[#FAF9F4]'
                }`}
              >
                Rises above (≥)
              </button>
              <button
                type="button"
                onClick={() => setCondition('below')}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border cursor-pointer transition-colors ${
                  condition === 'below'
                    ? 'bg-[#EAF3E8] border-[#245C3A] text-[#245C3A]'
                    : 'bg-white border-[#E4E9E0] text-[#202820] hover:bg-[#FAF9F4]'
                }`}
              >
                Drops below (≤)
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="alert-target-price"
              className="block text-xs font-semibold text-[#6B756A] uppercase tracking-wider mb-1.5"
            >
              Target Modal Price (₹ per kg)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-semibold text-[#6B756A]">
                ₹
              </span>
              <input
                id="alert-target-price"
                type="number"
                min={1}
                max={100000}
                step={1}
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full pl-8 pr-14 py-2.5 rounded-xl border border-[#E4E9E0] bg-[#FAF9F4] font-mono text-base font-semibold text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#6B756A]">
                / kg
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="alert-channel"
              className="block text-xs font-semibold text-[#6B756A] uppercase tracking-wider mb-1.5"
            >
              Notification Channel Preference
            </label>
            <select
              id="alert-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'app' | 'sms_demo' | 'whatsapp_demo')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E9E0] bg-white text-sm text-[#202820] focus:outline-none focus:ring-2 focus:ring-[#245C3A]"
            >
              <option value="app">In-app dashboard alert</option>
              <option value="sms_demo">SMS alert (preview preference)</option>
              <option value="whatsapp_demo">WhatsApp alert (preview preference)</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E4E9E0] text-sm font-medium text-[#6B756A] hover:bg-[#FAF9F4] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#245C3A] text-white text-sm font-semibold hover:bg-[#1d4b2f] transition-colors cursor-pointer"
            >
              Save Price Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
