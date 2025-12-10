import React, { useState } from 'react';
import { Checkbox } from '@/components/checkbox';
import { PlusIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

export interface MatrixFilterProps {
  title: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onAddOption?: (opt: string) => void;
  action?: React.ReactNode;
  emptyText?: string;
  className?: string;
  height?: string;
}

export function MatrixFilter({
  title,
  options,
  selected,
  onChange,
  onAddOption,
  action,
  emptyText = "暂无选项",
  className,
  height = "h-[200px]"
}: MatrixFilterProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newOption, setNewOption] = useState('');

  const toggleSelection = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter(i => i !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const onAdd = () => {
    if (newOption.trim() && onAddOption) {
      onAddOption(newOption.trim());
      setNewOption('');
      setIsAdding(false);
    }
  };

  return (
    <div className={clsx("flex flex-col border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm", className)}>
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-2 flex items-center justify-between shrink-0">
        <span className="font-medium text-sm text-zinc-700">{title}</span>
        <div className="flex items-center gap-2">
          {onAddOption && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-zinc-400 hover:text-zinc-700 transition-colors"
              title="添加选项"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          )}
          <Checkbox
            checked={options.length > 0 && selected.length === options.length}
            indeterminate={selected.length > 0 && selected.length < options.length}
            onChange={toggleAll}
            disabled={options.length === 0}
          />
        </div>
      </div>

      {isAdding && (
        <div className="p-2 border-b border-zinc-100 bg-zinc-50 flex gap-1">
          <input
            autoFocus
            className="flex-1 px-2 py-1 text-sm border border-zinc-300 rounded focus:outline-none focus:border-blue-500"
            value={newOption}
            onChange={e => setNewOption(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAdd()}
            placeholder="输入并回车"
          />
          <button onClick={onAdd} className="text-blue-600 px-1 hover:text-blue-800">
            <CheckCircleIcon className="w-5 h-5" />
          </button>
          <button onClick={() => setIsAdding(false)} className="text-zinc-400 px-1 hover:text-zinc-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className={clsx("flex-1 overflow-y-auto p-2 space-y-1", height)}>
        {options.length > 0 ? (
          options.map((opt, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 rounded text-sm transition-colors cursor-pointer" 
              onClick={() => toggleSelection(opt)}
            >
              <Checkbox
                checked={selected.includes(opt)}
                onChange={() => { }} // handled by parent div click
                className="pointer-events-none"
              />
              <span className="truncate select-none text-zinc-700" title={opt}>{opt}</span>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-zinc-400 text-xs">
            <span>{emptyText}</span>
            {onAddOption && (
              <button onClick={() => setIsAdding(true)} className="mt-2 text-blue-500 hover:text-blue-600 underline">
                点击添加
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* 底部操作栏 (例如导入按钮) */}
      {action && (
        <div className="border-t border-zinc-100 bg-zinc-50 p-2 flex justify-center">
            {action}
        </div>
      )}
    </div>
  );
}

