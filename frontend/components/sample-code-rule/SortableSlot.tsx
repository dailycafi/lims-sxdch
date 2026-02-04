import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { CodeSlot, SampleCodeElement, ELEMENT_COLORS, SEPARATOR_OPTIONS } from './types';

interface SortableSlotProps {
  slot: CodeSlot;
  index: number;
  element: SampleCodeElement | undefined;
  isLast: boolean;
  onRemove: () => void;
  onSeparatorChange: (separator: string) => void;
}

export function SortableSlot({
  slot,
  index,
  element,
  isLast,
  onRemove,
  onSeparatorChange,
}: SortableSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `slot-${index}`,
    data: { slot, index, type: 'slot' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colors = element
    ? ELEMENT_COLORS[element.id] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }
    : { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' };

  return (
    <div className="flex items-center gap-2">
      <div
        ref={setNodeRef}
        style={style}
        className={clsx(
          'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-medium text-sm transition-all',
          colors.bg,
          colors.text,
          colors.border,
          isDragging && 'opacity-50 shadow-lg scale-105 z-50',
          'cursor-grab active:cursor-grabbing'
        )}
        {...attributes}
        {...listeners}
      >
        {element ? (
          <>
            <span className="font-bold">{element.number}</span>
            <span>{element.label}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={clsx(
                'ml-1 p-0.5 rounded hover:bg-white/50 transition-colors',
                colors.text
              )}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </>
        ) : (
          <span className="italic">Empty slot</span>
        )}
      </div>

      {/* Separator selector - only show if not the last item */}
      {!isLast && element && (
        <div className="flex items-center gap-1">
          {SEPARATOR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSeparatorChange(opt.id)}
              className={clsx(
                'w-8 h-8 rounded-md text-sm font-mono transition-all',
                slot.separator === opt.id
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {opt.label || '()'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
