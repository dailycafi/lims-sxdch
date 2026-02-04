import { motion } from 'framer-motion';
import type { SampleCodeElement } from './types';

interface DraggableElementChipProps {
  element: SampleCodeElement;
  isUsed: boolean;
  onDragEnd: (element: SampleCodeElement) => void;
}

export function DraggableElementChip({ element, isUsed, onDragEnd }: DraggableElementChipProps) {
  const baseClasses = element.isSpecial
    ? 'bg-purple-100 text-purple-700 border-purple-300'
    : 'bg-blue-100 text-blue-700 border-blue-300';

  const disabledClasses = isUsed ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing';

  return (
    <motion.div
      drag={!isUsed}
      dragSnapToOrigin
      whileDrag={{ scale: 1.1, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 50 }}
      whileHover={!isUsed ? { scale: 1.02 } : undefined}
      onDragEnd={() => {
        if (!isUsed) {
          onDragEnd(element);
        }
      }}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium
        select-none transition-colors
        ${baseClasses}
        ${disabledClasses}
      `}
    >
      <span className="text-base">{element.number}</span>
      <span>{element.label}</span>
    </motion.div>
  );
}
