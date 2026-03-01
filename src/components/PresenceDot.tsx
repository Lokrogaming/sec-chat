import { cn } from '@/lib/utils';

interface PresenceDotProps {
  online: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export default function PresenceDot({ online, className, size = 'sm' }: PresenceDotProps) {
  return (
    <span
      className={cn(
        'block rounded-full border-2 border-card',
        size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
        online
          ? 'bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]'
          : 'bg-muted-foreground/40',
        className
      )}
      title={online ? 'Online' : 'Offline'}
    />
  );
}
