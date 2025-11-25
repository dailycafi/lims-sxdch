import React from 'react';
import clsx from 'clsx';
import { Text } from '@/components/text';

export interface StorageBoxSample {
  id: number;
  sample_code: string;
  position_in_box: string; // e.g., "A1" or "1"
  status: string;
  test_type?: string;
  tooltip?: string;
}

interface StorageBoxGridProps {
  name?: string;
  rows?: number; // default 10
  cols?: number; // default 10
  samples: StorageBoxSample[];
  onSampleClick?: (sample: StorageBoxSample) => void;
  onEmptyClick?: (position: string) => void;
  readOnly?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-zinc-200 border-zinc-300 text-zinc-500',
  received: 'bg-blue-100 border-blue-300 text-blue-700',
  in_storage: 'bg-emerald-100 border-emerald-300 text-emerald-700',
  checked_out: 'bg-amber-100 border-amber-300 text-amber-700',
  transferred: 'bg-purple-100 border-purple-300 text-purple-700',
  destroyed: 'bg-red-100 border-red-300 text-red-700',
  returned: 'bg-cyan-100 border-cyan-300 text-cyan-700',
  archived: 'bg-zinc-600 border-zinc-700 text-white',
};

// Helper to generate position labels (A1, A2... or 1, 2...)
const getPositionLabel = (row: number, col: number, totalCols: number, mode: 'alpha-numeric' | 'numeric' = 'numeric') => {
  if (mode === 'alpha-numeric') {
    const rowLabel = String.fromCharCode(65 + row); // A, B, C...
    const colLabel = col + 1;
    return `${rowLabel}${colLabel}`;
  }
  // Numeric: 1, 2, 3...
  return String(row * totalCols + col + 1);
};

export function StorageBoxGrid({
  name,
  rows = 10,
  cols = 10,
  samples,
  onSampleClick,
  onEmptyClick,
  readOnly = false,
  className,
}: StorageBoxGridProps) {
  // Map samples to positions for easy lookup
  const sampleMap = React.useMemo(() => {
    const map = new Map<string, StorageBoxSample>();
    samples.forEach(s => map.set(s.position_in_box, s));
    return map;
  }, [samples]);

  return (
    <div className={clsx("inline-block", className)}>
      {name && <Text className="font-medium mb-2 text-center">{name}</Text>}
      <div 
        className="grid gap-1 bg-zinc-100 p-2 rounded-lg border border-zinc-200"
        style={{ 
          gridTemplateColumns: `repeat(${cols}, minmax(2.5rem, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(2.5rem, 1fr))`
        }}
      >
        {Array.from({ length: rows }).map((_, rowIndex) => (
          Array.from({ length: cols }).map((_, colIndex) => {
            const position = getPositionLabel(rowIndex, colIndex, cols, 'numeric'); // Defaulting to numeric 1-100 for now
            const sample = sampleMap.get(position);
            const colorClass = sample ? (STATUS_COLORS[sample.status] || 'bg-zinc-200 border-zinc-300') : 'bg-white border-zinc-200 hover:bg-zinc-50';
            
            return (
              <div
                key={position}
                className={clsx(
                  "relative flex items-center justify-center aspect-square border rounded text-xs font-medium transition-colors cursor-pointer",
                  colorClass,
                  readOnly && !sample && "cursor-default",
                  !readOnly && !sample && "hover:border-zinc-400"
                )}
                title={sample ? `${sample.sample_code} (${sample.status})` : `Empty: ${position}`}
                onClick={() => {
                  if (sample && onSampleClick) {
                    onSampleClick(sample);
                  } else if (!sample && onEmptyClick && !readOnly) {
                    onEmptyClick(position);
                  }
                }}
              >
                {sample ? (
                  <span className="truncate w-full text-center px-0.5 text-[10px]">
                    {sample.sample_code.split('-').pop()} 
                    {/* Show only last part (e.g. '31') to save space, full code in tooltip */}
                  </span>
                ) : (
                  <span className="text-zinc-300 text-[10px]">{position}</span>
                )}
              </div>
            );
          })
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-zinc-600 justify-center">
        {Object.entries(STATUS_COLORS).map(([status, color]) => {
          // Simplified legend colors
          const bgClass = color.split(' ')[0];
          return (
            <div key={status} className="flex items-center gap-1.5">
              <div className={clsx("w-3 h-3 rounded border border-black/10", bgClass)} />
              <span className="capitalize">{status.replace('_', ' ')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

