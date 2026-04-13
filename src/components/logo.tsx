import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden flex items-center justify-center rounded-lg", className)}>
      <img 
        src="/icons/icon-512x512.png" 
        alt="Orderia Logo" 
        className="h-full w-full object-contain"
      />
    </div>
  );
}
