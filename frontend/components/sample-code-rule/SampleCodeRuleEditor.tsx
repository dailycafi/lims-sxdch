import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import clsx from 'clsx';
import { ArrowPathIcon } from '@heroicons/react/20/solid';
import { DraggableElement } from './DraggableElement';
import { SortableSlot } from './SortableSlot';
import { DropZone } from './DropZone';
import { PreviewDisplay } from './PreviewDisplay';
import {
  CodeSlot,
  SampleCodeElement,
  SAMPLE_CODE_ELEMENTS,
  ELEMENT_COLORS,
} from './types';

interface SampleCodeRuleEditorProps {
  slots: CodeSlot[];
  onSlotsChange: (slots: CodeSlot[]) => void;
  projectData?: {
    sponsor_project_code?: string;
    lab_project_code?: string;
  };
}

export function SampleCodeRuleEditor({
  slots,
  onSlotsChange,
  projectData,
}: SampleCodeRuleEditorProps) {
  const [activeElement, setActiveElement] = useState<SampleCodeElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get used element IDs
  const usedElementIds = new Set(slots.map((s) => s.elementId).filter(Boolean));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.type === 'source') {
      setActiveElement(data.element);
    } else if (data?.type === 'slot') {
      const element = SAMPLE_CODE_ELEMENTS.find((e) => e.id === data.slot.elementId);
      setActiveElement(element || null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveElement(null);

    if (!over) return;

    const activeData = active.data.current;
    const overId = over.id;

    // Case 1: Dragging from source to drop zone
    if (activeData?.type === 'source' && overId === 'target-zone') {
      const element = activeData.element as SampleCodeElement;
      // Add new slot with this element
      const newSlots = [
        ...slots,
        { elementId: element.id, separator: '-' },
      ];
      onSlotsChange(newSlots);
      return;
    }

    // Case 2: Dragging from source to a specific slot position
    if (activeData?.type === 'source' && String(overId).startsWith('slot-')) {
      const element = activeData.element as SampleCodeElement;
      const targetIndex = parseInt(String(overId).replace('slot-', ''), 10);

      // Insert new slot at position
      const newSlots = [...slots];
      newSlots.splice(targetIndex + 1, 0, { elementId: element.id, separator: '-' });
      onSlotsChange(newSlots);
      return;
    }

    // Case 3: Reordering slots within the target zone
    if (activeData?.type === 'slot' && String(overId).startsWith('slot-')) {
      const activeIndex = activeData.index;
      const overIndex = parseInt(String(overId).replace('slot-', ''), 10);

      if (activeIndex !== overIndex) {
        const newSlots = arrayMove(slots, activeIndex, overIndex);
        onSlotsChange(newSlots);
      }
      return;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Could add visual feedback here if needed
  };

  const handleRemoveSlot = useCallback(
    (index: number) => {
      const newSlots = slots.filter((_, i) => i !== index);
      onSlotsChange(newSlots);
    },
    [slots, onSlotsChange]
  );

  const handleSeparatorChange = useCallback(
    (index: number, separator: string) => {
      const newSlots = slots.map((slot, i) =>
        i === index ? { ...slot, separator } : slot
      );
      onSlotsChange(newSlots);
    },
    [slots, onSlotsChange]
  );

  const handleReset = () => {
    onSlotsChange([]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="space-y-6">
        {/* Preview Area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-base font-semibold text-zinc-900">
              编号预览
            </span>
          </div>
          <PreviewDisplay
            slots={slots}
            elements={SAMPLE_CODE_ELEMENTS}
            projectData={projectData}
          />
        </div>

        {/* Target Zone */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-base font-semibold text-zinc-900">
              已选要素（可拖拽排序）
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-zinc-600 font-medium hover:text-zinc-900 flex items-center gap-1"
            >
              <ArrowPathIcon className="w-3.5 h-3.5" />
              重置
            </button>
          </div>

          <DropZone id="target-zone">
            {slots.length === 0 ? (
              <div className="flex items-center justify-center h-[80px] text-zinc-400 text-sm">
                拖拽下方要素到此处
              </div>
            ) : (
              <SortableContext
                items={slots.map((_, i) => `slot-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-wrap gap-3">
                  {slots.map((slot, index) => {
                    const element = SAMPLE_CODE_ELEMENTS.find(
                      (e) => e.id === slot.elementId
                    );
                    const isLast =
                      index === slots.length - 1 ||
                      slots.slice(index + 1).every((s) => !s.elementId);

                    return (
                      <SortableSlot
                        key={`slot-${index}`}
                        slot={slot}
                        index={index}
                        element={element}
                        isLast={isLast}
                        onRemove={() => handleRemoveSlot(index)}
                        onSeparatorChange={(sep) => handleSeparatorChange(index, sep)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            )}
          </DropZone>
        </div>

        {/* Source Elements */}
        <div className="space-y-3">
          <div className="px-1">
            <span className="text-base font-semibold text-zinc-900">
              可用要素（拖拽添加）
            </span>
          </div>
          <div className="p-4 bg-white rounded-xl border border-zinc-200">
            <div className="flex flex-wrap gap-3">
              {SAMPLE_CODE_ELEMENTS.map((element) => (
                <DraggableElement
                  key={element.id}
                  element={element}
                  isUsed={usedElementIds.has(element.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeElement && (
          <div
            className={clsx(
              'px-4 py-2.5 rounded-lg border-2 font-medium text-sm shadow-xl',
              ELEMENT_COLORS[activeElement.id]?.bg || 'bg-gray-100',
              ELEMENT_COLORS[activeElement.id]?.text || 'text-gray-800',
              ELEMENT_COLORS[activeElement.id]?.border || 'border-gray-300'
            )}
          >
            <span className="mr-1.5 font-bold">{activeElement.number}</span>
            {activeElement.label}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
