import { useState, useCallback, useRef } from 'react';
import { DraggableElementChip } from './DraggableElementChip';
import { DropZone } from './DropZone';
import { RulePreview } from './RulePreview';
import { TemplateManager } from './TemplateManager';
import type { CodeSlot, SampleCodeElement } from './types';
import { DEFAULT_ELEMENTS } from './types';

interface SampleCodeRuleEditorProps {
  slots: CodeSlot[];
  onChange: (slots: CodeSlot[]) => void;
  elements?: SampleCodeElement[];
  projectData?: {
    sponsorCode?: string;
    labCode?: string;
  };
}

export function SampleCodeRuleEditor({
  slots,
  onChange,
  elements = DEFAULT_ELEMENTS,
  projectData
}: SampleCodeRuleEditorProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const usedElementIds = new Set(slots.map(s => s.elementId));

  const handleDragEnd = useCallback((element: SampleCodeElement) => {
    if (usedElementIds.has(element.id)) return;

    const newSlot: CodeSlot = {
      elementId: element.id,
      separator: '-',
    };
    onChange([...slots, newSlot]);
  }, [slots, onChange, usedElementIds]);

  const handleReorder = useCallback((newSlots: CodeSlot[]) => {
    onChange(newSlots);
  }, [onChange]);

  const handleRemove = useCallback((index: number) => {
    const newSlots = slots.filter((_, i) => i !== index);
    onChange(newSlots);
  }, [slots, onChange]);

  const handleSeparatorChange = useCallback((index: number, separator: string) => {
    const newSlots = slots.map((slot, i) =>
      i === index ? { ...slot, separator } : slot
    );
    onChange(newSlots);
  }, [slots, onChange]);

  const handleReset = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleApplyTemplate = useCallback((templateSlots: CodeSlot[]) => {
    onChange(templateSlots);
  }, [onChange]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-base font-semibold text-zinc-900">编号预览</span>
        </div>
        <RulePreview
          slots={slots}
          elements={elements}
          projectData={projectData}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-base font-semibold text-zinc-900">目标区域</span>
          <button
            onClick={handleReset}
            className="text-xs text-zinc-600 font-medium hover:text-zinc-900"
          >
            重置所有
          </button>
        </div>
        <div
          ref={dropZoneRef}
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={(e) => {
            if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => setIsDragOver(false)}
        >
          <DropZone
            slots={slots}
            elements={elements}
            onReorder={handleReorder}
            onRemove={handleRemove}
            onSeparatorChange={handleSeparatorChange}
            isDragOver={isDragOver}
          />
        </div>
        <p className="text-xs text-zinc-500 px-1">
          拖拽下方要素到此区域，在区域内可继续拖拽调整顺序
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-base font-semibold text-zinc-900">可用要素</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {elements.map((element) => (
              <DraggableElementChip
                key={element.id}
                element={element}
                isUsed={usedElementIds.has(element.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-4">
        <TemplateManager
          currentSlots={slots}
          onApplyTemplate={handleApplyTemplate}
        />
      </div>
    </div>
  );
}
