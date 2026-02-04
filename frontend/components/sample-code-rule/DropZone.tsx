import { Reorder, useDragControls } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/20/solid';
import type { SampleCodeElement, CodeSlot, SeparatorOption } from './types';
import { SEPARATOR_OPTIONS } from './types';

interface DropZoneItemProps {
  slot: CodeSlot;
  element: SampleCodeElement;
  index: number;
  isLast: boolean;
  onRemove: (index: number) => void;
  onSeparatorChange: (index: number, separator: string) => void;
}

function DropZoneItem({ slot, element, index, isLast, onRemove, onSeparatorChange }: DropZoneItemProps) {
  const dragControls = useDragControls();

  const baseClasses = element.isSpecial
    ? 'bg-purple-100 text-purple-700 border-purple-300'
    : 'bg-blue-100 text-blue-700 border-blue-300';

  return (
    <Reorder.Item
      key={slot.elementId}
      value={slot}
      dragControls={dragControls}
      className="flex items-center gap-2"
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium
          cursor-grab active:cursor-grabbing select-none
          ${baseClasses}
        `}
      >
        <span className="text-base">{element.number}</span>
        <span>{element.label}</span>
        <button
          onClick={() => onRemove(index)}
          className="ml-1 p-0.5 rounded hover:bg-black/10 transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {!isLast && (
        <div className="flex items-center gap-1">
          {SEPARATOR_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSeparatorChange(index, opt.id)}
              className={`
                px-2 py-0.5 text-xs rounded transition-colors
                ${slot.separator === opt.id
                  ? 'bg-zinc-800 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </Reorder.Item>
  );
}

interface DropZoneProps {
  slots: CodeSlot[];
  elements: SampleCodeElement[];
  onReorder: (slots: CodeSlot[]) => void;
  onRemove: (index: number) => void;
  onSeparatorChange: (index: number, separator: string) => void;
  isDragOver: boolean;
}

export function DropZone({
  slots,
  elements,
  onReorder,
  onRemove,
  onSeparatorChange,
  isDragOver
}: DropZoneProps) {
  const hasSlots = slots.length > 0;

  return (
    <div
      className={`
        min-h-[100px] p-4 rounded-xl border-2 border-dashed transition-colors
        ${isDragOver
          ? 'border-green-500 bg-green-50'
          : hasSlots
            ? 'border-green-300 bg-green-50/50'
            : 'border-zinc-300 bg-zinc-50/50'
        }
      `}
    >
      {hasSlots ? (
        <Reorder.Group
          axis="x"
          values={slots}
          onReorder={onReorder}
          className="flex flex-wrap items-center gap-3"
        >
          {slots.map((slot, index) => {
            const element = elements.find(e => e.id === slot.elementId);
            if (!element) return null;

            const isLast = index === slots.length - 1;

            return (
              <DropZoneItem
                key={slot.elementId}
                slot={slot}
                element={element}
                index={index}
                isLast={isLast}
                onRemove={onRemove}
                onSeparatorChange={onSeparatorChange}
              />
            );
          })}
        </Reorder.Group>
      ) : (
        <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
          将下方的编号要素拖拽到此处
        </div>
      )}
    </div>
  );
}
