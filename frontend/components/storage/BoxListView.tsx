import React from 'react';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { InformationCircleIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { BoxSample, STATUS_COLORS } from './types';

interface BoxListViewProps {
  samples: BoxSample[];
  onSampleClick?: (sample: BoxSample) => void;
  selectedSampleId?: number | null;
}

export function BoxListView({ samples, onSampleClick, selectedSampleId }: BoxListViewProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <Table striped>
        <TableHead>
          <TableRow>
            <TableHeader>位置</TableHeader>
            <TableHeader>样本编号</TableHeader>
            <TableHeader>项目</TableHeader>
            <TableHeader>检测类型</TableHeader>
            <TableHeader>状态</TableHeader>
            <TableHeader>操作</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {samples.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                该样本盒暂无样本
              </TableCell>
            </TableRow>
          ) : (
            samples.map((sample) => {
              const statusStyle = STATUS_COLORS[sample.status] || STATUS_COLORS.pending;
              return (
                <TableRow 
                  key={sample.id}
                  className={clsx(
                    'cursor-pointer hover:bg-zinc-50',
                    selectedSampleId === sample.id && 'bg-blue-50'
                  )}
                  onClick={() => onSampleClick?.(sample)}
                >
                  <TableCell>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-mono">
                      {sample.position_in_box}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{sample.sample_code}</TableCell>
                  <TableCell>{sample.project_code || '-'}</TableCell>
                  <TableCell>{sample.test_type || '-'}</TableCell>
                  <TableCell>
                    <Badge color={
                      sample.status === 'in_storage' ? 'green' :
                      sample.status === 'checked_out' ? 'yellow' :
                      sample.status === 'transferred' ? 'purple' :
                      sample.status === 'destroyed' ? 'red' : 'zinc'
                    }>
                      {statusStyle.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button plain onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSampleClick?.(sample); }}>
                      <InformationCircleIcon className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

