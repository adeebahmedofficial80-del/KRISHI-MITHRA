import {Download} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const {isInstallable, isInstalled, promptInstall} = usePWAInstall();

  if (isInstalled || !isInstallable) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EAF3E8] text-[#245C3A] border border-[#C9DEC4] text-xs font-semibold hover:bg-[#dcebd9] transition-colors cursor-pointer whitespace-nowrap"
      title="Install Krishi Mitra as an app"
    >
      <Download className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Install App</span>
    </button>
  );
}
