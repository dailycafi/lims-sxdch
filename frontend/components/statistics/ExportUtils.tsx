import { Button } from '@/components/button';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  ArrowDownTrayIcon,
  DocumentTextIcon,
  PrinterIcon,
} from '@heroicons/react/20/solid';

export interface ExportOptions {
  type: string;
  filters?: Record<string, any>;
  title?: string;
}

/**
 * Export data to Excel format
 */
export async function exportToExcel(options: ExportOptions): Promise<void> {
  try {
    const response = await api.get('/statistics/export', {
      params: {
        format: 'excel',
        type: options.type,
        ...options.filters,
      },
      responseType: 'blob',
    });

    const filename = `${options.title || options.type}_${new Date().toISOString().split('T')[0]}.xlsx`;
    downloadBlob(response.data, filename);
    toast.success('Excel导出成功');
  } catch (error) {
    toast.error('Excel导出失败');
    throw error;
  }
}

/**
 * Export data to PDF format
 */
export async function exportToPDF(options: ExportOptions): Promise<void> {
  try {
    const response = await api.get('/statistics/export', {
      params: {
        format: 'pdf',
        type: options.type,
        ...options.filters,
      },
      responseType: 'blob',
    });

    const filename = `${options.title || options.type}_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadBlob(response.data, filename);
    toast.success('PDF导出成功');
  } catch (error) {
    toast.error('PDF导出失败');
    throw error;
  }
}

/**
 * Print data using browser's print dialog
 */
export function printData(elementId: string, title?: string): void {
  const element = document.getElementById(elementId);
  if (!element) {
    toast.error('打印内容未找到');
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('无法打开打印窗口，请检查浏览器弹窗设置');
    return;
  }

  const styles = Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules || [])
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title || '统计查询报告'}</title>
        <style>
          ${styles}
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            padding: 20px;
            background: white;
          }
          .print-header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
          }
          .print-title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
          }
          .print-date {
            font-size: 14px;
            color: #6b7280;
            margin-top: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
          }
          th {
            background-color: #f9fafb;
            font-weight: 600;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div class="print-title">${title || '统计查询报告'}</div>
          <div class="print-date">打印时间: ${new Date().toLocaleString('zh-CN')}</div>
        </div>
        ${element.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

interface ExportButtonsProps {
  exportType: string;
  filters?: Record<string, any>;
  title?: string;
  printElementId?: string;
  className?: string;
}

/**
 * Reusable export buttons component
 */
export function ExportButtons({
  exportType,
  filters,
  title,
  printElementId,
  className = '',
}: ExportButtonsProps) {
  const handleExportExcel = async () => {
    try {
      await exportToExcel({ type: exportType, filters, title });
    } catch (error) {
      // Error handled in exportToExcel
    }
  };

  const handleExportPDF = async () => {
    try {
      await exportToPDF({ type: exportType, filters, title });
    } catch (error) {
      // Error handled in exportToPDF
    }
  };

  const handlePrint = () => {
    if (printElementId) {
      printData(printElementId, title);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button color="white" onClick={handleExportExcel}>
        <ArrowDownTrayIcon className="h-4 w-4" />
        导出Excel
      </Button>
      <Button color="white" onClick={handleExportPDF}>
        <DocumentTextIcon className="h-4 w-4" />
        导出PDF
      </Button>
      {printElementId && (
        <Button color="white" onClick={handlePrint}>
          <PrinterIcon className="h-4 w-4" />
          打印
        </Button>
      )}
    </div>
  );
}
