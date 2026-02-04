import type { CodeSlot, SampleCodeElement } from './types';

interface RulePreviewProps {
  slots: CodeSlot[];
  elements: SampleCodeElement[];
  projectData?: {
    sponsorCode?: string;
    labCode?: string;
  };
}

export function RulePreview({ slots, elements, projectData }: RulePreviewProps) {
  if (slots.length === 0) {
    return (
      <div className="p-6 bg-zinc-50/80 rounded-2xl border border-zinc-200/60 flex items-center justify-center min-h-[80px] shadow-sm">
        <span className="text-zinc-400 text-sm">请配置编号规则</span>
      </div>
    );
  }

  const getDisplayValue = (elementId: string, element: SampleCodeElement): string => {
    if (elementId === 'sponsor_code') {
      return projectData?.sponsorCode || 'SPONSOR';
    }
    if (elementId === 'lab_code') {
      return projectData?.labCode || 'LAB';
    }
    return element.label;
  };

  return (
    <div className="p-6 bg-zinc-50/80 rounded-2xl border border-zinc-200/60 min-h-[80px] shadow-sm">
      <div className="font-mono text-lg tracking-wide flex flex-wrap items-center">
        {slots.map((slot, index) => {
          const element = elements.find(e => e.id === slot.elementId);
          if (!element) return null;

          const isLast = index === slots.length - 1;
          const displayValue = getDisplayValue(slot.elementId, element);

          return (
            <span key={slot.elementId} className="flex items-center">
              <span
                className={`
                  px-2 py-0.5 rounded
                  ${element.isSpecial
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                  }
                `}
              >
                {displayValue}
              </span>
              {!isLast && slot.separator && (
                <span className="mx-1 text-zinc-500 font-bold">{slot.separator}</span>
              )}
            </span>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500 mt-3">
        * 编号将按照配置的顺序自动拼接
      </p>
    </div>
  );
}
