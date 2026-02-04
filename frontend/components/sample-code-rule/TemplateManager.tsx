import { useState, useEffect } from 'react';
import { BookmarkIcon, TrashIcon } from '@heroicons/react/20/solid';
import type { CodeSlot, RuleTemplate } from './types';
import { TEMPLATE_STORAGE_KEY } from './types';

interface TemplateManagerProps {
  currentSlots: CodeSlot[];
  onApplyTemplate: (slots: CodeSlot[]) => void;
}

export function TemplateManager({ currentSlots, onApplyTemplate }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch {
        setTemplates([]);
      }
    }
  }, []);

  const saveTemplates = (newTemplates: RuleTemplate[]) => {
    setTemplates(newTemplates);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(newTemplates));
  };

  const handleSave = () => {
    if (!templateName.trim() || currentSlots.length === 0) return;

    const newTemplate: RuleTemplate = {
      id: `template-${Date.now()}`,
      name: templateName.trim(),
      slots: currentSlots,
      createdAt: new Date().toISOString(),
    };

    saveTemplates([...templates, newTemplate]);
    setTemplateName('');
    setShowSaveDialog(false);
  };

  const handleDelete = (id: string) => {
    saveTemplates(templates.filter(t => t.id !== id));
  };

  const handleApply = (template: RuleTemplate) => {
    onApplyTemplate(template.slots);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">模板管理</span>
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={currentSlots.length === 0}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookmarkIcon className="w-3.5 h-3.5" />
          保存为模板
        </button>
      </div>

      {showSaveDialog && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="输入模板名称"
            className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!templateName.trim()}
              className="flex-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              保存
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false);
                setTemplateName('');
              }}
              className="flex-1 px-2 py-1 text-xs font-medium bg-zinc-200 text-zinc-700 rounded hover:bg-zinc-300 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-1.5">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg border border-zinc-200 group hover:bg-zinc-100 transition-colors"
            >
              <button
                onClick={() => handleApply(template)}
                className="flex-1 text-left text-sm text-zinc-700 hover:text-zinc-900"
              >
                {template.name}
                <span className="ml-2 text-xs text-zinc-400">
                  ({template.slots.length} 个要素)
                </span>
              </button>
              <button
                onClick={() => handleDelete(template.id)}
                className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {templates.length === 0 && !showSaveDialog && (
        <p className="text-xs text-zinc-400 text-center py-2">暂无保存的模板</p>
      )}
    </div>
  );
}
