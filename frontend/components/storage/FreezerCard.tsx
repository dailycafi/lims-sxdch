import { motion } from 'framer-motion';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { CubeIcon, EyeIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { Freezer } from './types';

interface FreezerCardProps {
  freezer: Freezer;
  onClick: () => void;
  isSelected: boolean;
}

export function FreezerCard({ freezer, onClick, isSelected }: FreezerCardProps) {
  const usagePercent = freezer.total_boxes > 0 
    ? Math.round((freezer.used_boxes / freezer.total_boxes) * 100) 
    : 0;
  
  const getUsageColor = () => {
    if (usagePercent >= 90) return 'bg-red-500';
    if (usagePercent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0, 0, 0, 0.15)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'bg-white border-2 rounded-xl overflow-hidden cursor-pointer transition-all',
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-zinc-200 hover:border-blue-300'
      )}
      onClick={onClick}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CubeIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900">{freezer.name}</h3>
              <p className="text-xs text-zinc-500">{freezer.location}</p>
            </div>
          </div>
          <Badge color={freezer.temperature <= -70 ? 'blue' : freezer.temperature <= -20 ? 'cyan' : 'yellow'}>
            {freezer.temperature}°C
          </Badge>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">层数</span>
            <span className="font-medium">{freezer.shelves} 层</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">样本盒</span>
            <span className="font-medium">{freezer.used_boxes} / {freezer.total_boxes}</span>
          </div>
          
          {/* 使用率进度条 */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-500">使用率</span>
              <span className={clsx(
                'font-medium',
                usagePercent >= 90 ? 'text-red-600' : usagePercent >= 70 ? 'text-amber-600' : 'text-emerald-600'
              )}>
                {usagePercent}%
              </span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <motion.div
                className={clsx('h-full rounded-full', getUsageColor())}
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100">
        <Button plain className="w-full justify-center text-sm">
          <EyeIcon className="w-4 h-4" />
          查看详情
        </Button>
      </div>
    </motion.div>
  );
}

