import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWindowSize } from '@/hooks/useWindowSize';
import clsx from 'clsx';
import { SampleBox, BoxSample, DISPLAY_MODES, STATUS_COLORS } from './types';

interface BoxGridViewProps {
  box: SampleBox;
  samples: BoxSample[];
  onSampleClick?: (sample: BoxSample) => void;
  selectedSampleId?: number | null;
  highlightedPosition?: string | null;
  onPositionHover?: (position: string | null) => void;
}

export function BoxGridView({ 
  box, 
  samples,
  onSampleClick,
  selectedSampleId,
  highlightedPosition,
  onPositionHover
}: BoxGridViewProps) {
  const { rows, cols } = box;
  const { width } = useWindowSize();
  const [displayMode, setDisplayMode] = useState(DISPLAY_MODES.FULL);
  
  // 根据窗口宽度和盒子尺寸动态计算显示模式
  useEffect(() => {
    if (!width || !cols) return;
    
    // 计算每个单元格的大致宽度（考虑对话框宽度约为窗口的80%）
    const dialogWidth = Math.min(width * 0.9, 1200);
    const cellWidth = dialogWidth / cols;
    
    if (cellWidth >= 80) {
      setDisplayMode(DISPLAY_MODES.FULL);
    } else if (cellWidth >= 50) {
      setDisplayMode(DISPLAY_MODES.MEDIUM);
    } else {
      setDisplayMode(DISPLAY_MODES.MINIMAL);
    }
  }, [width, cols]);
  
  // 构建位置到样本的映射
  const sampleMap = useMemo(() => {
    const map: Record<string, BoxSample> = {};
    samples.forEach(s => {
      if (s.position_in_box) {
        map[s.position_in_box] = s;
      }
    });
    return map;
  }, [samples]);

  // 根据显示模式渲染不同内容
  const renderSampleContent = (sample: BoxSample | undefined, position: string, statusStyle: typeof STATUS_COLORS[string] | null) => {
    if (!sample) {
      return (
        <div className="h-full flex items-center justify-center text-zinc-400 text-xs font-mono">
          {position}
        </div>
      );
    }

    // 状态指示器（所有模式都显示）
    const statusIndicator = (
      <div className={clsx('absolute top-1 right-1 w-2 h-2 rounded-full', statusStyle?.dot)} />
    );

    // 最小模式：只显示位置
    if (displayMode === DISPLAY_MODES.MINIMAL) {
      return (
        <div className="h-full flex flex-col justify-between text-[10px]">
          {statusIndicator}
          <div className="flex items-center justify-center h-full">
            <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-mono">
              {position}
            </span>
          </div>
        </div>
      );
    }

    // 中等模式：显示简短编号和位置
    if (displayMode === DISPLAY_MODES.MEDIUM) {
      return (
        <div className="h-full flex flex-col justify-between text-[10px]">
          {statusIndicator}
          <div className={clsx('font-medium truncate', statusStyle?.text)} title={sample.sample_code}>
            {sample.sample_code.length > 6 ? sample.sample_code.slice(-6) : sample.sample_code}
          </div>
          <div className="mt-auto">
            <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-mono">
              {position}
            </span>
          </div>
        </div>
      );
    }

    // 完整模式：显示所有信息
    return (
      <div className="h-full flex flex-col justify-between text-[10px]">
        {statusIndicator}
        <div className={clsx('font-medium truncate', statusStyle?.text)} title={sample.sample_code}>
          {sample.sample_code.length > 8 ? sample.sample_code.slice(-8) : sample.sample_code}
        </div>
        {sample.test_type && (
          <div className="text-zinc-400 truncate text-[9px]" title={sample.test_type}>
            {sample.test_type}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-1">
          <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-mono">
            {position}
          </span>
          <span className={clsx('px-1 py-0.5 rounded text-[8px]', statusStyle?.bg, statusStyle?.text)}>
            {statusStyle?.label}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-zinc-50 border rounded-lg p-4">
      {/* 显示模式指示器 */}
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
        <span>样本分布 ({samples.length} / {rows * cols})</span>
        <span className="text-zinc-400">
          {displayMode === DISPLAY_MODES.FULL ? '详细视图' : 
           displayMode === DISPLAY_MODES.MEDIUM ? '简洁视图' : '紧凑视图'}
        </span>
      </div>
      
      <div 
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
        }}
      >
        {Array.from({ length: rows * cols }).map((_, index) => {
          const row = String.fromCharCode(65 + Math.floor(index / cols));
          const col = (index % cols) + 1;
          const position = `${row}${col}`;
          const sample = sampleMap[position];
          const statusStyle = sample ? (STATUS_COLORS[sample.status] || STATUS_COLORS.pending) : null;
          
          return (
            <motion.div
              key={position}
              whileHover={{ scale: 1.03, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              className={clsx(
                'aspect-square border rounded-md p-1.5 cursor-pointer relative transition-all',
                sample ? statusStyle?.bg : 'bg-white',
                sample ? statusStyle?.border : 'border-zinc-200',
                highlightedPosition === position && 'ring-2 ring-blue-500',
                selectedSampleId === sample?.id && 'ring-2 ring-blue-600 bg-blue-50'
              )}
              onClick={() => sample && onSampleClick?.(sample)}
              onMouseEnter={() => onPositionHover?.(position)}
              onMouseLeave={() => onPositionHover?.(null)}
              title={sample ? `${sample.sample_code} - ${statusStyle?.label || sample.status}` : `空位 ${position}`}
            >
              {renderSampleContent(sample, position, statusStyle)}
            </motion.div>
          );
        })}
      </div>
      
      {/* 图例 */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span>在库</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>已领用</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>已转移</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-zinc-300" />
          <span>空位</span>
        </div>
      </div>
    </div>
  );
}

