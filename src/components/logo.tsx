import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-full h-14 w-14", className)}>
      <Package className="h-7 w-7" />
    </div>
  );
}
