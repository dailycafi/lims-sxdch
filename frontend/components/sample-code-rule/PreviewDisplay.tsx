import clsx from 'clsx';
import { CodeSlot, SampleCodeElement, ELEMENT_COLORS, SEPARATOR_OPTIONS } from './types';

interface PreviewDisplayProps {
  slots: CodeSlot[];
  elements: SampleCodeElement[];
  projectData?: {
    sponsor_project_code?: string;
    lab_project_code?: string;
  };
}

export function PreviewDisplay({ slots, elements, projectData }: PreviewDisplayProps) {
  const enabledSlots = slots.filter((s) => !!s.elementId);

  if (enabledSlots.length === 0) {
    return (
      <div className="p-6 bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-2xl border border-zinc-200 min-h-[100px] flex items-center justify-center">
        <span className="text-zinc-400 text-base italic">
          将下方的编号要素拖拽至此处进行配置...
        </span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-2xl border border-zinc-200 min-h-[100px]">
      <div className="flex flex-wrap items-center gap-1 text-lg font-mono">
        {enabledSlots.map((slot, index) => {
          const element = elements.find((e) => e.id === slot.elementId);
          if (!element) return null;

          const isLast = index === enabledSlots.length - 1;
          const colors = ELEMENT_COLORS[element.id] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };

          // Get display value based on element type
          let displayValue = element.label;
          if (element.id === 'sponsor_code' && projectData?.sponsor_project_code) {
            displayValue = projectData.sponsor_project_code;
          } else if (element.id === 'lab_code' && projectData?.lab_project_code) {
            displayValue = projectData.lab_project_code;
          }

          return (
            <span key={`preview-${index}`} className="flex items-center">
              <span
                className={clsx(
                  'px-2 py-1 rounded text-sm font-medium',
                  colors.bg,
                  colors.text
                )}
              >
                {displayValue}
              </span>
              {!isLast && slot.separator && (
                <span className="text-zinc-500 mx-0.5 font-bold">
                  {slot.separator}
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Element legend */}
      <div className="mt-4 pt-4 border-t border-zinc-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {enabledSlots.map((slot, index) => {
            const element = elements.find((e) => e.id === slot.elementId);
            if (!element) return null;

            const colors = ELEMENT_COLORS[element.id] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
            const separatorLabel = SEPARATOR_OPTIONS.find((s) => s.id === slot.separator)?.label;

            return (
              <div key={`legend-${index}`} className="flex items-center gap-2">
                <span
                  className={clsx(
                    'w-5 h-5 rounded flex items-center justify-center text-xs font-bold',
                    colors.bg,
                    colors.text
                  )}
                >
                  {element.number}
                </span>
                <span className="text-zinc-700">{element.label}</span>
                {slot.separator && (
                  <span className="text-zinc-400">({separatorLabel})</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
