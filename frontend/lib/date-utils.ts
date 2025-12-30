/**
 * 日期时间工具函数
 * 统一处理后端返回的UTC时间显示
 */

function normalizeBackendDateString(dateString: string): string {
  const s = String(dateString).trim();
  if (!s) return s;

  // If backend returns an ISO string WITHOUT timezone, JS parses it as local time.
  // Our backend mostly uses UTC times (e.g. datetime.utcnow()), so treat such strings as UTC.
  // Examples:
  // - "2025-12-30T00:50:10" -> "2025-12-30T00:50:10Z"
  // - "2025-12-30 00:50:10" -> "2025-12-30T00:50:10Z"
  const isoNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  const spaceNoTz = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  const slashSpaceNoTz = /^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

  if (isoNoTz.test(s)) return `${s}Z`;
  if (spaceNoTz.test(s)) return `${s.replace(/\s+/, 'T')}Z`;
  if (slashSpaceNoTz.test(s)) {
    const [datePart, timePart] = s.split(/\s+/, 2);
    const isoDate = datePart.replaceAll('/', '-');
    return `${isoDate}T${timePart}Z`;
  }

  return s;
}

/**
 * 格式化日期时间为本地时间字符串
 * @param dateString ISO格式的日期字符串
 * @returns 本地化的日期时间字符串
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(normalizeBackendDateString(dateString));
    // 检查日期是否有效
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (error) {
    console.error('Invalid date string:', dateString, error);
    return '-';
  }
}

/**
 * 格式化日期为本地日期字符串（不含时间）
 * @param dateString ISO格式的日期字符串
 * @returns 本地化的日期字符串
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(normalizeBackendDateString(dateString));
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (error) {
    console.error('Invalid date string:', dateString, error);
    return '-';
  }
}

/**
 * 格式化时间为本地时间字符串（不含日期）
 * @param dateString ISO格式的日期字符串
 * @returns 本地化的时间字符串
 */
export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(normalizeBackendDateString(dateString));
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch (error) {
    console.error('Invalid date string:', dateString, error);
    return '-';
  }
}

/**
 * 获取相对时间描述（如：刚刚、5分钟前、2小时前等）
 * @param dateString ISO格式的日期字符串
 * @returns 相对时间描述
 */
export function getRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(normalizeBackendDateString(dateString));
    if (isNaN(date.getTime())) return '-';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return formatDate(dateString);
  } catch (error) {
    console.error('Invalid date string:', dateString, error);
    return '-';
  }
}

