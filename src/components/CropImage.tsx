import {Apple, Leaf, Sprout} from 'lucide-react';
import {useState} from 'react';
import {CropCategory} from '../types/krishi';

interface CropImageProps {
  src: string;
  alt: string;
  category?: CropCategory;
  className?: string;
}

export function CropImage({src, alt, category, className = ''}: CropImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    const isFruit = category === 'fruit';
    return (
      <div
        className={`flex flex-col items-center justify-center ${
          isFruit
            ? 'bg-[#FDF4E7] text-[#9A5212]'
            : 'bg-[#EAF3E8] text-[#245C3A]'
        } ${className}`}
        aria-label={alt}
      >
        {isFruit ? (
          <Apple className="w-5 h-5 opacity-85" />
        ) : category === 'vegetable' ? (
          <Leaf className="w-5 h-5 opacity-85" />
        ) : (
          <Sprout className="w-5 h-5 opacity-85" />
        )}
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
