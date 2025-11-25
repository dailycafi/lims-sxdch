import { motion } from 'framer-motion';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { PencilIcon, TrashIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { SampleBox } from './types';

interface BoxCardProps {
  box: SampleBox;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function BoxCard({ box, onClick, onEdit, onDelete }: BoxCardProps) {
  const usagePercent = box.total_slots > 0 
    ? Math.round((box.used_slots / box.total_slots) * 100) 
    : 0;

  const getBadgeColor = () => {
    if (usagePercent === 0) return 'green';
    if (usagePercent === 100) return 'red';
    if (usagePercent >= 80) return 'yellow';
    return 'green';
  };

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1)' }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-zinc-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all"
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-zinc-900">{box.code}</h4>
          <Badge color={getBadgeColor()}>
            {box.used_slots} / {box.total_slots}
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">位置</span>
            <span className="font-mono text-xs">{box.shelf_level}-{box.rack_position}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">规格</span>
            <span>{box.rows} × {box.cols}</span>
          </div>
          
          {/* 进度条 */}
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                usagePercent === 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
        
        <div className="mt-3 flex justify-between items-center">
          <Button plain onClick={onClick} className="text-xs">
            查看详情
          </Button>
          <div className="flex gap-1">
            {onEdit && (
              <button
                className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title="编辑"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button
                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="删除"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

