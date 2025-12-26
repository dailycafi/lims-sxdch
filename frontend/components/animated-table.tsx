import { motion, AnimatePresence } from 'framer-motion';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from './table';
import { Text } from './text';
import React from 'react';

interface AnimatedTableProps {
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyText?: string;
  colSpan?: number;
}

export function AnimatedTable({ 
  children, 
  loading = false, 
  empty = false,
  emptyIcon: EmptyIcon,
  emptyText = '暂无数据',
  colSpan = 1
}: AnimatedTableProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-white rounded-xl shadow-sm ring-1 ring-zinc-950/5 overflow-hidden"
    >
      <div className="p-6">
        <Table bleed={false} striped>
          {children}
        </Table>
      </div>
    </motion.div>
  );
}

export function AnimatedTableRow({ 
  children, 
  index = 0,
  className,
  ...props 
}: { children: React.ReactNode; index?: number; className?: string }) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`hover:bg-zinc-50/50 transition-colors ${className || ''}`}
    >
      {children}
    </motion.tr>
  );
}

export function AnimatedEmptyState({ 
  icon: Icon, 
  text, 
  colSpan 
}: { 
  icon?: React.ComponentType<{ className?: string }>; 
  text: string; 
  colSpan: number;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3"
        >
          {Icon && <Icon className="h-12 w-12 text-zinc-300" />}
          <Text className="text-zinc-500">{text}</Text>
        </motion.div>
      </TableCell>
    </TableRow>
  );
}

// 骨架屏加载效果
export function AnimatedSkeletonRows({ colSpan, rowCount = 5 }: { colSpan: number; rowCount?: number }) {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, index) => (
        <TableRow key={index}>
          <TableCell colSpan={colSpan} className="p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="p-4"
            >
              <div className="flex gap-4">
                {Array.from({ length: colSpan }).map((_, colIndex) => (
                  <div key={colIndex} className="flex-1">
                    <motion.div
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: colIndex * 0.1 }}
                      className="h-4 bg-gray-200 rounded"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// 增强的加载状态组件
export function AnimatedLoadingState({ 
  colSpan, 
  variant = 'skeleton',
  text = '加载中...'
}: { 
  colSpan: number;
  variant?: 'spinner' | 'dots' | 'pulse' | 'skeleton' | 'lottie';
  text?: string;
}) {
  const renderLoadingContent = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                  className="w-2 h-2 bg-zinc-900 rounded-full"
                />
              ))}
            </div>
            <Text className="text-zinc-500">{text}</Text>
          </div>
        );
      
      case 'pulse':
        return (
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-12 h-12 bg-zinc-200 rounded-lg"
            />
            <Text className="text-zinc-500">{text}</Text>
          </div>
        );

      case 'lottie':
        return (
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ scale: [0.95, 1.05, 0.95], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-100 via-indigo-100 to-purple-100 flex items-center justify-center shadow-inner"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-500 rounded-full"
              />
            </motion.div>
            <Text className="text-zinc-500">{text}</Text>
          </div>
        );
      
      case 'skeleton':
        return <AnimatedSkeletonRows colSpan={colSpan} rowCount={3} />;
      
      default:
        return (
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full"
            />
            <Text className="text-zinc-500">{text}</Text>
          </div>
        );
    }
  };

  if (variant === 'skeleton') {
    return renderLoadingContent();
  }

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-12">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex justify-center"
        >
          {renderLoadingContent()}
        </motion.div>
      </TableCell>
    </TableRow>
  );
}

// 表格数据行的交错动画
export function AnimatedTableData({
  data,
  renderRow,
  loading,
  empty,
  emptyIcon,
  emptyText = '暂无数据',
  colSpan,
  loadingVariant = 'skeleton'
}: {
  data: any[];
  renderRow: (item: any, index: number) => React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyText?: string;
  colSpan: number;
  loadingVariant?: 'spinner' | 'dots' | 'pulse' | 'skeleton' | 'lottie';
}) {
  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <AnimatedLoadingState 
          key="loading" 
          colSpan={colSpan} 
          variant={loadingVariant}
        />
      ) : data.length === 0 ? (
        <AnimatedEmptyState 
          key="empty"
          icon={emptyIcon} 
          text={emptyText} 
          colSpan={colSpan} 
        />
      ) : (
        <motion.tbody key="data">
          {data.map((item, index) => (
            <AnimatedTableRow key={item.id || index} index={index}>
              {renderRow(item, index)}
            </AnimatedTableRow>
          ))}
        </motion.tbody>
      )}
    </AnimatePresence>
  );
}
