// 存储管理相关类型定义

export interface Freezer {
  id: string;
  name: string;
  location: string;
  temperature: number;
  shelves: number;
  total_boxes: number;
  used_boxes: number;
}

export interface SampleBox {
  id: number;
  code: string;
  freezer_id: string;
  shelf_level: string;
  rack_position: string;
  rows: number;
  cols: number;
  total_slots: number;
  used_slots: number;
  created_at: string;
}

export interface BoxSample {
  id: number;
  sample_code: string;
  position_in_box: string;
  status: string;
  test_type?: string;
  subject_code?: string;
  project_code?: string;
  created_at?: string;
}

// 显示模式枚举
export const DISPLAY_MODES = {
  FULL: 'full',        // 完整显示（样本编号、位置、状态等所有信息）
  MEDIUM: 'medium',    // 中等详细度（样本编号和位置）
  MINIMAL: 'minimal'   // 最小显示（只有位置）
} as const;

export type DisplayMode = typeof DISPLAY_MODES[keyof typeof DISPLAY_MODES];

// 状态颜色映射
export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  in_storage: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', label: '在库' },
  checked_out: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', label: '已领用' },
  pending: { bg: 'bg-zinc-50', border: 'border-zinc-200', text: 'text-zinc-500', dot: 'bg-zinc-400', label: '待处理' },
  transferred: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500', label: '已转移' },
  destroyed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', label: '已销毁' },
};

