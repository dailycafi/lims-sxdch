import React, { useState, KeyboardEvent } from 'react';
import clsx from 'clsx';
import { XMarkIcon, PlusIcon } from '@heroicons/react/20/solid';

interface TagInputProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TagInput({
  value = [],
  onChange,
  placeholder = '输入后按回车添加...',
  className,
  disabled = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // 如果输入框为空且按了退格键，删除最后一个标签
      removeTag(value.length - 1);
    }
  };

  const addTag = () => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput && !value.includes(trimmedInput)) {
      onChange?.([...value, trimmedInput]);
      setInputValue('');
    }
  };

  const removeTag = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange?.(newValue);
  };

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-2 rounded-lg border border-zinc-950/10 bg-white px-3 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-white/10 dark:bg-white/5',
        disabled && 'opacity-50 cursor-not-allowed bg-zinc-50',
        className
      )}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center rounded bg-zinc-100 pl-2 pr-1 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="appearance-none border-none bg-transparent p-0 ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 focus:outline-none focus:ring-0"
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      
      {!disabled && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag} // 失去焦点时也尝试添加
          placeholder={value.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm text-zinc-900 placeholder:text-zinc-400 focus:ring-0 dark:text-white"
        />
      )}
    </div>
  );
}

