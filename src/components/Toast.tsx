import {CheckCircle2, X} from 'lucide-react';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function Toast({message, onDismiss}: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-50 max-w-sm bg-[#202820] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 border border-white/10">
      <CheckCircle2 className="w-4 h-4 text-[#78A85A] shrink-0" />
      <span className="text-sm font-medium leading-snug">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close notification"
        className="ml-auto p-1 text-white/70 hover:text-white cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
