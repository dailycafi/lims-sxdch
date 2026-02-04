import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';

interface DropZoneProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function DropZone({ id, children, className }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'min-h-[120px] p-4 rounded-xl border-2 border-dashed transition-all',
        isOver
          ? 'border-blue-500 bg-blue-50'
          : 'border-zinc-300 bg-zinc-50/50',
        className
      )}
    >
      {children}
    </div>
  );
}
