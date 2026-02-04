import { useDraggable } from '@dnd-kit/core';
import clsx from 'clsx';
import { SampleCodeElement, ELEMENT_COLORS } from './types';

interface DraggableElementProps {
  element: SampleCodeElement;
  isUsed?: boolean;
}

export function DraggableElement({ element, isUsed = false }: DraggableElementProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `source-${element.id}`,
    data: { element, type: 'source' },
    disabled: isUsed,
  });

  const colors = ELEMENT_COLORS[element.id] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'px-4 py-2.5 rounded-lg border-2 font-medium text-sm cursor-grab select-none transition-all',
        colors.bg,
        colors.text,
        colors.border,
        isDragging && 'opacity-50 shadow-lg scale-105',
        isUsed && 'opacity-40 cursor-not-allowed grayscale',
        !isUsed && 'hover:shadow-md hover:scale-[1.02] active:cursor-grabbing'
      )}
    >
      <span className="mr-1.5 font-bold">{element.number}</span>
      {element.label}
    </div>
  );
}
