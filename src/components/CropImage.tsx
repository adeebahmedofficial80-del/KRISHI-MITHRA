import {Sprout} from 'lucide-react';
import {useState} from 'react';

interface CropImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function CropImage({src, alt, className = ''}: CropImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-[#EAF3E8] text-[#245C3A] ${className}`}
        aria-label={alt}
      >
        <Sprout className="w-6 h-6 opacity-80" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover bg-[#FAF9F4] ${className}`}
    />
  );
}
