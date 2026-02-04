import { formatDateTime } from '@/lib/date-utils';
import { Badge } from '@/components/badge';
import clsx from 'clsx';
import {
  BeakerIcon,
  ArrowUpOnSquareIcon,
  ArrowDownOnSquareIcon,
  ArrowsRightLeftIcon,
  TrashIcon,
  ArchiveBoxIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/20/solid';

export interface TimelineEvent {
  id: number;
  event_type: string;
  event_detail: string;
  operator: string;
  timestamp: string;
  location?: string;
  notes?: string;
}

interface SampleTimelineProps {
  events: TimelineEvent[];
  sampleCode: string;
  currentStatus: string;
}

const eventTypeConfig: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}> = {
  receive: {
    icon: BeakerIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: '接收',
  },
  inventory: {
    icon: ClipboardDocumentCheckIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: '入库',
  },
  checkout: {
    icon: ArrowUpOnSquareIcon,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: '领用',
  },
  return: {
    icon: ArrowDownOnSquareIcon,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: '归还',
  },
  transfer: {
    icon: ArrowsRightLeftIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: '转移',
  },
  destroy: {
    icon: TrashIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: '销毁',
  },
  archive: {
    icon: ArchiveBoxIcon,
    color: 'text-zinc-600',
    bgColor: 'bg-zinc-100',
    label: '归档',
  },
};

const statusColors: Record<string, "blue" | "green" | "yellow" | "red" | "purple" | "zinc"> = {
  pending: 'yellow',
  received: 'blue',
  in_storage: 'green',
  checked_out: 'yellow',
  transferred: 'purple',
  destroyed: 'red',
  archived: 'zinc',
};

const statusLabels: Record<string, string> = {
  pending: '待接收',
  received: '已接收',
  in_storage: '在库',
  checked_out: '已领用',
  transferred: '已转移',
  destroyed: '已销毁',
  archived: '已归档',
};

export function SampleTimeline({ events, sampleCode, currentStatus }: SampleTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        暂无该样本的操作记录
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sample Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div>
          <div className="text-sm text-zinc-500">样本编号</div>
          <div className="text-xl font-bold text-zinc-900 font-mono">{sampleCode}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-zinc-500 mb-1">当前状态</div>
          <Badge color={statusColors[currentStatus] || 'zinc'} className="text-sm">
            {statusLabels[currentStatus] || currentStatus}
          </Badge>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-300 via-zinc-200 to-zinc-100" />

        {/* Events */}
        <div className="space-y-6">
          {events.map((event, index) => {
            const config = eventTypeConfig[event.event_type] || {
              icon: CheckCircleIcon,
              color: 'text-zinc-600',
              bgColor: 'bg-zinc-100',
              label: event.event_type,
            };
            const IconComponent = config.icon;
            const isFirst = index === 0;
            const isLast = index === events.length - 1;

            return (
              <div
                key={event.id}
                className={clsx(
                  'relative flex items-start gap-4 group',
                  isFirst && 'animate-fade-in'
                )}
              >
                {/* Icon */}
                <div
                  className={clsx(
                    'relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full shadow-sm border-2 border-white transition-transform group-hover:scale-110',
                    config.bgColor
                  )}
                >
                  <IconComponent className={clsx('h-8 w-8', config.color)} />
                </div>

                {/* Content */}
                <div
                  className={clsx(
                    'flex-1 min-w-0 p-4 rounded-lg border bg-white shadow-sm transition-shadow group-hover:shadow-md',
                    isFirst ? 'border-blue-200 bg-blue-50/30' : 'border-zinc-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx('font-semibold', config.color)}>
                          {config.label}
                        </span>
                        {isFirst && (
                          <Badge color="blue" className="text-xs">
                            最新
                          </Badge>
                        )}
                      </div>
                      <p className="text-zinc-700">{event.event_detail}</p>
                      {event.location && (
                        <p className="text-sm text-zinc-500 mt-1">
                          位置: {event.location}
                        </p>
                      )}
                      {event.notes && (
                        <p className="text-sm text-zinc-500 mt-1 italic">
                          备注: {event.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium text-zinc-900">
                        {event.operator}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {formatDateTime(event.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* End indicator */}
        <div className="relative flex items-center gap-4 mt-6">
          <div className="relative z-10 flex h-8 w-16 flex-shrink-0 items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-zinc-300" />
          </div>
          <div className="text-sm text-zinc-400">
            样本创建时间线起点
          </div>
        </div>
      </div>
    </div>
  );
}
