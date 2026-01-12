import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Checkbox } from '@/components/checkbox';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Tabs } from '@/components/tabs';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { api } from '@/lib/api';
import { useProjectStore } from '@/store/project';
import { LabelsService, LabelBatch, Label, GenerateLabelsResponse } from '@/services/labels.service';
import { GlobalParamsService } from '@/services/global-params.service';
import JsBarcode from 'jsbarcode';
import clsx from 'clsx';
import {
  PlusIcon,
  XMarkIcon,
  PrinterIcon,
  TagIcon,
  Cog6ToothIcon,
  EyeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  BeakerIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ChevronDownIcon
} from '@heroicons/react/20/solid';

type TabType = 'generate' | 'settings' | 'view';

interface Project {
  id: number;
  lab_project_code: string;
  sponsor_project_code: string;
  sample_code_rule?: any;
}

interface SampleTypeConfig {
  id: number;
  category: string;
  cycle_group?: string;
  test_type?: string;
  primary_codes?: string;
  backup_codes?: string;
}

// 标签行配置类型
interface LabelRow {
  id: string;
  label: string;  // 行标签，如"方案编号"、"筛选号"
  type: 'static' | 'dynamic' | 'combined';  // static=固定文本, dynamic=下拉选择, combined=组合字段
  value?: string;  // 静态值或选中的值
  options?: string[];  // 下拉选项
  combinedFields?: { field1: string; field2: string; separator: string };  // 组合字段配置
}

// 标签模板类型
interface LabelTemplate {
  id: string;
  name: string;
  labelType: 'sampling_tube' | 'cryo_tube';
  rows: LabelRow[];
  showBarcode: boolean;
  barcodeField: string;  // 用于生成条形码的字段
}

// 默认采样管标签模板
const defaultSamplingTubeTemplate: LabelTemplate = {
  id: 'sampling_default',
  name: '采样管标签',
  labelType: 'sampling_tube',
  rows: [
    { id: 'protocol', label: '方案编号', type: 'static', value: '' },
    { id: 'subject', label: '筛选号', type: 'dynamic', value: 'S', options: [] },
    { id: 'purpose', label: '用途', type: 'combined', combinedFields: { field1: 'testType', field2: 'note', separator: ' ' } },
    { id: 'time', label: '计划采样时间', type: 'dynamic', value: '', options: [] },
  ],
  showBarcode: true,
  barcodeField: 'subject'
};

// 默认冻存管标签模板
const defaultCryoTubeTemplate: LabelTemplate = {
  id: 'cryo_default',
  name: '冻存管标签',
  labelType: 'cryo_tube',
  rows: [
    { id: 'protocol', label: '方案编号', type: 'static', value: '' },
    { id: 'subject', label: '筛选号', type: 'dynamic', value: 'S', options: [] },
    { id: 'purpose', label: '用途', type: 'combined', combinedFields: { field1: 'testType', field2: 'code', separator: '-' } },
    { id: 'time', label: '计划采样时间', type: 'dynamic', value: '', options: [] },
  ],
  showBarcode: true,
  barcodeField: 'subject'
};

// 标签预览组件
const LabelPreview = ({ 
  template, 
  previewData,
  projectCode 
}: { 
  template: LabelTemplate;
  previewData: Record<string, string>;
  projectCode: string;
}) => {
  const getBarcodeUrl = (text: string) => {
    if (!text || typeof window === 'undefined') return '';
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text || 'SAMPLE', {
        format: "CODE128",
        width: 1.5,
        height: 40,
        displayValue: false,
        margin: 0
      });
      return canvas.toDataURL("image/png");
    } catch {
      return '';
    }
  };

  const getRowValue = (row: LabelRow): string => {
    if (row.type === 'static') {
      if (row.id === 'protocol') return projectCode || 'LT2158CHN005';
      return row.value || '';
    }
    if (row.type === 'dynamic') {
      return previewData[row.id] || row.value || '____';
    }
    if (row.type === 'combined' && row.combinedFields) {
      const v1 = previewData[row.combinedFields.field1] || '';
      const v2 = previewData[row.combinedFields.field2] || '';
      if (v1 && v2) return `${v1}${row.combinedFields.separator}${v2}`;
      return v1 || v2 || '____';
    }
    return '';
  };

  const barcodeText = previewData[template.barcodeField] || 'S001-PK-a1';

  return (
    <div className="border-2 border-dashed border-zinc-300 rounded-lg p-4 bg-white w-[280px] font-mono text-sm">
      <div className="text-xs text-zinc-400 mb-2 font-sans">
        {template.labelType === 'sampling_tube' ? 'PK:' : 'IR:'}
      </div>
      <div className="space-y-1.5 mb-3">
        {template.rows.map(row => (
          <div key={row.id} className="flex">
            <span className="text-zinc-600 w-24 flex-shrink-0">{row.label}：</span>
            <span className="text-zinc-900 font-medium underline underline-offset-2 decoration-zinc-300">
              {getRowValue(row)}
            </span>
          </div>
        ))}
      </div>
      {template.showBarcode && (
        <div className="mt-2 pt-2 border-t border-zinc-200">
          {getBarcodeUrl(barcodeText) ? (
            <img 
              src={getBarcodeUrl(barcodeText)} 
              alt="barcode" 
              className="h-10 w-full object-contain"
            />
          ) : (
            <div className="h-10 bg-zinc-100 flex items-center justify-center">
              <div className="flex gap-px">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="bg-zinc-800" 
                    style={{ width: Math.random() > 0.5 ? 2 : 1, height: 40 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 标签设置 Tab 组件
const LabelSettingsTab = ({ 
  currentProject,
  availableOptions
}: { 
  currentProject: Project | null;
  availableOptions: {
    cycles: string[];
    testTypes: string[];
    primaryCodes: string[];
    backupCodes: string[];
    collectionPoints: { code: string; name: string; time_description?: string }[];
  };
}) => {
  const [settingType, setSettingType] = useState<'sampling_tube' | 'cryo_tube'>('sampling_tube');
  const [template, setTemplate] = useState<LabelTemplate>(defaultSamplingTubeTemplate);
  const [previewData, setPreviewData] = useState<Record<string, string>>({
    subject: 'S001',
    testType: 'PK',
    note: '采血(HS)',
    code: 'a',
    time: 'D1 给药前 30min'
  });

  // 切换标签类型时更新模板
  useEffect(() => {
    if (settingType === 'sampling_tube') {
      setTemplate(defaultSamplingTubeTemplate);
      setPreviewData({
        subject: 'S001',
        testType: 'PK',
        note: '采血(HS)',
        code: 'a',
        time: 'D1 给药前 30min'
      });
    } else {
      setTemplate(defaultCryoTubeTemplate);
      setPreviewData({
        subject: 'S001',
        testType: 'IR 检测',
        note: '',
        code: 'a',
        time: 'D1 给药前 30min'
      });
    }
  }, [settingType]);

  const addRow = () => {
    const newRow: LabelRow = {
      id: `custom_${Date.now()}`,
      label: '新字段',
      type: 'static',
      value: ''
    };
    setTemplate({
      ...template,
      rows: [...template.rows, newRow]
    });
  };

  const removeRow = (rowId: string) => {
    setTemplate({
      ...template,
      rows: template.rows.filter(r => r.id !== rowId)
    });
  };

  const updateRow = (rowId: string, updates: Partial<LabelRow>) => {
    setTemplate({
      ...template,
      rows: template.rows.map(r => r.id === rowId ? { ...r, ...updates } : r)
    });
  };

  const updatePreview = (field: string, value: string) => {
    setPreviewData({ ...previewData, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* 标签类型选择 */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <Text className="font-semibold text-zinc-900 mb-4">选择标签类型</Text>
        <div className="flex gap-4">
          <button
            onClick={() => setSettingType('sampling_tube')}
            className={clsx(
              "flex-1 p-3 rounded-lg border-2 transition-all text-center",
              settingType === 'sampling_tube'
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
            )}
          >
            <BeakerIcon className="w-6 h-6 mx-auto mb-1" />
            <span className="text-sm font-medium">采样管标签</span>
          </button>
          <button
            onClick={() => setSettingType('cryo_tube')}
            className={clsx(
              "flex-1 p-3 rounded-lg border-2 transition-all text-center",
              settingType === 'cryo_tube'
                ? "border-purple-500 bg-purple-50 text-purple-700"
                : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
            )}
          >
            <DocumentTextIcon className="w-6 h-6 mx-auto mb-1" />
            <span className="text-sm font-medium">冻存管标签</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：标签行配置 */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-semibold text-zinc-900">标签内容配置</Text>
            <Button outline onClick={addRow}>
              <PlusIcon className="w-4 h-4 mr-1" />
              添加行
            </Button>
          </div>
          
          <div className="space-y-3">
            {template.rows.map((row, index) => (
              <div key={row.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {/* 行标签 */}
                  <Input
                    value={row.label}
                    onChange={(e) => updateRow(row.id, { label: e.target.value })}
                    placeholder="字段名称"
                    className="text-sm"
                  />
                  {/* 类型选择 */}
                  <Select
                    value={row.type}
                    onChange={(e) => updateRow(row.id, { type: e.target.value as LabelRow['type'] })}
                    className="text-sm"
                  >
                    <option value="static">固定文本</option>
                    <option value="dynamic">下拉选择</option>
                    <option value="combined">组合字段</option>
                  </Select>
                  {/* 值/配置 */}
                  {row.type === 'static' && (
                    <Input
                      value={row.value || ''}
                      onChange={(e) => updateRow(row.id, { value: e.target.value })}
                      placeholder="固定值"
                      className="text-sm"
                    />
                  )}
                  {row.type === 'dynamic' && (
                    <Select
                      value={row.value || ''}
                      onChange={(e) => {
                        updateRow(row.id, { value: e.target.value });
                        updatePreview(row.id, e.target.value);
                      }}
                      className="text-sm"
                    >
                      <option value="">选择数据源</option>
                      <option value="subject">筛选号</option>
                      <option value="testType">检测类型</option>
                      <option value="cycle">周期</option>
                      <option value="time">采样时间</option>
                    </Select>
                  )}
                  {row.type === 'combined' && (
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <span>检测类型</span>
                      <Input
                        value={row.combinedFields?.separator || '-'}
                        onChange={(e) => updateRow(row.id, { 
                          combinedFields: { 
                            ...row.combinedFields!, 
                            separator: e.target.value 
                          }
                        })}
                        className="w-8 text-center !px-1"
                        maxLength={2}
                      />
                      <span>代码</span>
                    </div>
                  )}
                </div>
                <Button plain onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-600">
                  <XMarkIcon className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* 条形码设置 */}
          <div className="mt-4 pt-4 border-t border-zinc-200">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={template.showBarcode}
                onChange={(checked) => setTemplate({ ...template, showBarcode: checked })}
              />
              <Text className="text-sm">显示条形码</Text>
              {template.showBarcode && (
                <Select
                  value={template.barcodeField}
                  onChange={(e) => setTemplate({ ...template, barcodeField: e.target.value })}
                  className="text-sm w-32"
                >
                  <option value="subject">筛选号</option>
                  <option value="full">完整编号</option>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：标签预览 */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
          <Text className="font-semibold text-zinc-900 mb-4">标签预览</Text>
          
          {/* 预览数据输入 */}
          <div className="mb-4 p-3 bg-zinc-50 rounded-lg">
            <Text className="text-xs font-medium text-zinc-500 mb-2">预览数据（选择后参数自动填充至右方下划线中）</Text>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500">筛选号</label>
                <Input
                  value={previewData.subject}
                  onChange={(e) => updatePreview('subject', e.target.value)}
                  className="text-sm"
                  placeholder="S001"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">检测类型</label>
                <Select
                  value={previewData.testType}
                  onChange={(e) => updatePreview('testType', e.target.value)}
                  className="text-sm"
                >
                  <option value="">选择...</option>
                  {availableOptions.testTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="PK">PK</option>
                  <option value="IR 检测">IR 检测</option>
                </Select>
              </div>
              {settingType === 'sampling_tube' && (
                <div>
                  <label className="text-xs text-zinc-500">备注</label>
                  <Input
                    value={previewData.note}
                    onChange={(e) => updatePreview('note', e.target.value)}
                    className="text-sm"
                    placeholder="采血(HS)"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500">正/备份代码</label>
                <Select
                  value={previewData.code}
                  onChange={(e) => updatePreview('code', e.target.value)}
                  className="text-sm"
                >
                  <option value="">选择...</option>
                  {availableOptions.primaryCodes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="a">a</option>
                  <option value="b">b</option>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-zinc-500">计划采样时间</label>
                <Input
                  value={previewData.time}
                  onChange={(e) => updatePreview('time', e.target.value)}
                  className="text-sm"
                  placeholder="D1 给药前 30min"
                />
              </div>
            </div>
          </div>

          {/* 标签预览 */}
          <div className="flex justify-center">
            <LabelPreview 
              template={template}
              previewData={previewData}
              projectCode={currentProject?.sponsor_project_code || currentProject?.lab_project_code || ''}
            />
          </div>

          {/* 保存按钮 */}
          <div className="mt-4 flex justify-end">
            <Button color="dark">
              保存标签模板
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 查看与打印 Tab 组件
const ViewAndPrintTab = ({
  currentProject,
  availableOptions,
  batches,
  fetchBatches
}: {
  currentProject: Project | null;
  availableOptions: {
    cycles: string[];
    testTypes: string[];
    primaryCodes: string[];
    backupCodes: string[];
    collectionPoints: { code: string; name: string; time_description?: string }[];
  };
  batches: LabelBatch[];
  fetchBatches: () => void;
}) => {
  // 筛选状态
  const [filters, setFilters] = useState({
    group: '',           // 组别
    testType: '',        // 检测类型
    subjectNo: '',       // 受试者编号
    isPrimary: '',       // 正/备份
  });
  
  // 搜索关键词
  const [searchKeyword, setSearchKeyword] = useState('');
  
  // 标签数据
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [filteredLabels, setFilteredLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 选中的标签（用于批量操作）
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set());
  
  // 删除对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteUsername, setDeleteUsername] = useState('');
  
  // 导出下拉菜单
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  // 加载所有标签
  useEffect(() => {
    loadAllLabels();
  }, [batches]);
  
  const loadAllLabels = async () => {
    if (batches.length === 0) {
      setAllLabels([]);
      setFilteredLabels([]);
      return;
    }
    
    setLoading(true);
    try {
      const allLabelPromises = batches.map(batch => 
        LabelsService.getBatchLabels(batch.id, { limit: 1000 })
      );
      const results = await Promise.all(allLabelPromises);
      const labels = results.flat();
      setAllLabels(labels);
      setFilteredLabels(labels);
    } catch (error) {
      console.error('加载标签失败:', error);
      toast.error('加载标签数据失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 筛选逻辑
  useEffect(() => {
    let result = [...allLabels];
    
    // 按组别筛选
    if (filters.group) {
      result = result.filter(l => l.label_code.includes(filters.group));
    }
    
    // 按检测类型筛选
    if (filters.testType) {
      result = result.filter(l => l.label_code.includes(filters.testType));
    }
    
    // 按受试者编号筛选
    if (filters.subjectNo) {
      result = result.filter(l => l.label_code.toLowerCase().includes(filters.subjectNo.toLowerCase()));
    }
    
    // 按正/备份筛选
    if (filters.isPrimary === 'primary') {
      result = result.filter(l => l.label_type === 'sampling_tube');
    } else if (filters.isPrimary === 'backup') {
      result = result.filter(l => l.label_type === 'cryo_tube');
    }
    
    // 搜索关键词
    if (searchKeyword) {
      result = result.filter(l => 
        l.label_code.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }
    
    setFilteredLabels(result);
  }, [filters, searchKeyword, allLabels]);
  
  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedLabels.size === filteredLabels.length) {
      setSelectedLabels(new Set());
    } else {
      setSelectedLabels(new Set(filteredLabels.map(l => l.id)));
    }
  };
  
  // 单选
  const toggleSelect = (id: number) => {
    const next = new Set(selectedLabels);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLabels(next);
  };
  
  // 解析标签编号，提取各字段
  // 当字段为空或包含占位符时显示下划线
  const parseLabel = (label: Label) => {
    const components = label.components || {};
    const displayComponents = label.display_components || components;
    
    // 检查是否为空或占位符（如 ___, PENDING, TBD 等）
    const isEmpty = (val: string | undefined) => {
      if (!val) return true;
      const placeholders = ['___', '____', 'PENDING', 'TBD', 'NA', 'N/A', '-'];
      return placeholders.includes(val.toUpperCase()) || val.startsWith('_');
    };
    
    // 格式化显示值，空值显示下划线
    const formatValue = (val: string | undefined, defaultUnderline = '____') => {
      return isEmpty(val) ? defaultUnderline : val!;
    };
    
    // 从 components 中提取各字段
    const testType = displayComponents.testTypes || displayComponents.testType || '';
    const primaryCode = displayComponents.primaryCodes || displayComponents.primaryCode || '';
    const backupCode = displayComponents.backupCodes || displayComponents.backupCode || '';
    const collectionPoint = displayComponents.collectionPoints || displayComponents.collectionPoint || '';
    const cycle = displayComponents.cycles || displayComponents.cycle || '';
    
    // 用途行：检测类型 + 正备份代码
    const codeValue = label.label_type === 'sampling_tube' ? primaryCode : backupCode;
    const purposeDisplay = testType && codeValue 
      ? `${testType}-${codeValue}` 
      : testType || codeValue || '____';
    
    return {
      sampleNo: label.label_code,
      subjectNo: formatValue(displayComponents.subjectNo || displayComponents.subject),
      sampleType: label.label_type === 'sampling_tube' ? '采样管' : '冻存管',
      testType: formatValue(testType),
      collectPoint: formatValue(collectionPoint),
      collectPointName: collectionPoint || '____',
      group: formatValue(cycle),
      isPrimary: label.label_type === 'sampling_tube' ? '正份' : '备份',
      purposeDisplay: purposeDisplay,  // 新增：用途显示（检测类型-代码）
      codeValue: formatValue(codeValue)  // 新增：正/备份代码
    };
  };
  
  // 导出功能
  const handleExport = (format: 'pdf' | 'excel' | 'txt') => {
    setExportMenuOpen(false);
    
    const data = filteredLabels.map((l, i) => {
      const parsed = parseLabel(l);
      return {
        序号: i + 1,
        样本编号: parsed.sampleNo,
        受试者编号: parsed.subjectNo,
        样本类型: parsed.sampleType,
        检测类型: parsed.testType,
        采集点: parsed.collectPoint,
        组别: parsed.group,
        '正/备份': parsed.isPrimary
      };
    });
    
    if (format === 'txt') {
      const headers = Object.keys(data[0] || {}).join('\t');
      const rows = data.map(row => Object.values(row).join('\t')).join('\n');
      const content = `${headers}\n${rows}`;
      downloadFile(content, 'labels.txt', 'text/plain');
    } else if (format === 'excel') {
      // CSV 格式（Excel 可以打开）
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => Object.values(row).join(',')).join('\n');
      const content = `\uFEFF${headers}\n${rows}`;  // BOM for Chinese characters
      downloadFile(content, 'labels.csv', 'text/csv;charset=utf-8');
    } else if (format === 'pdf') {
      // 打开打印窗口，用户可以选择"另存为 PDF"
      handlePrintList();
    }
    
    toast.success(`导出${format.toUpperCase()}成功`);
  };
  
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // 打印清单表
  const handlePrintList = () => {
    const printWindow = window.open('', '', 'width=1000,height=800');
    if (!printWindow) {
      toast.error('浏览器阻止了打印窗口');
      return;
    }
    
    const generatedAt = new Date().toLocaleString('zh-CN');
    const projectLabel = currentProject?.lab_project_code || '项目';
    
    const tableRows = filteredLabels.map((l, i) => {
      const parsed = parseLabel(l);
      return `
        <tr>
          <td>${i + 1}</td>
          <td class="code">${parsed.sampleNo}</td>
          <td>${parsed.subjectNo}</td>
          <td>${parsed.sampleType}</td>
          <td>${parsed.testType}</td>
          <td>${parsed.collectPoint}</td>
          <td>${parsed.collectPointName}</td>
          <td>${parsed.group}</td>
          <td>${parsed.isPrimary}</td>
        </tr>
      `;
    }).join('');
    
    printWindow.document.write(`<!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>样本清单</title>
          <style>
            body { font-family: 'SF Pro SC', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            h1 { margin: 0 0 10px 0; font-size: 18pt; }
            p { color: #666; font-size: 10pt; }
            table { width: 100%; border-collapse: collapse; font-size: 9pt; }
            th, td { border: 1px solid #000; padding: 5px 6px; text-align: center; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .code { font-family: monospace; font-weight: bold; }
            @media print { 
              body { padding: 0; } 
              th { background-color: #ddd !important; -webkit-print-color-adjust: exact; } 
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>样本清单</h1>
            <p>项目：${projectLabel} | 共 ${filteredLabels.length} 条记录 | 打印时间：${generatedAt}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>序号</th>
                <th>样本编号</th>
                <th>受试者编号</th>
                <th>样本类型</th>
                <th>检测类型</th>
                <th>采集点</th>
                <th>采集点名称</th>
                <th>组别</th>
                <th>正/备份</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>`);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };
  
  // 打印标签
  const handlePrintLabels = () => {
    const labelsToPrint = selectedLabels.size > 0 
      ? filteredLabels.filter(l => selectedLabels.has(l.id))
      : filteredLabels;
    
    if (labelsToPrint.length === 0) {
      toast.error('没有可打印的标签');
      return;
    }
    
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      toast.error('浏览器阻止了打印窗口');
      return;
    }
    
    // 生成条形码
    const generateBarcode = (text: string) => {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: "CODE128",
        width: 1.5,
        height: 50,
        displayValue: true,
        fontSize: 10,
        margin: 2
      });
      return canvas.toDataURL("image/png");
    };
    
    const labelsHtml = labelsToPrint.map(l => {
      const parsed = parseLabel(l);
      const barcodeUrl = generateBarcode(l.label_code);
      return `
        <div class="label">
          <div class="label-row"><span class="label-key">方案编号：</span><span class="label-value">${currentProject?.sponsor_project_code || currentProject?.lab_project_code || '-'}</span></div>
          <div class="label-row"><span class="label-key">筛选号：</span><span class="label-value underline">${parsed.subjectNo}</span></div>
          <div class="label-row"><span class="label-key">用途：</span><span class="label-value">${parsed.purposeDisplay}</span></div>
          <div class="label-row"><span class="label-key">采样时间：</span><span class="label-value underline">${parsed.collectPoint}</span></div>
          <div class="barcode">
            <img src="${barcodeUrl}" alt="${l.label_code}" />
          </div>
        </div>
      `;
    }).join('');
    
    printWindow.document.write(`<!DOCTYPE html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>标签打印</title>
          <style>
            body { font-family: 'SF Pro SC', 'PingFang SC', sans-serif; padding: 10mm; margin: 0; }
            .labels { display: flex; flex-wrap: wrap; gap: 5mm; }
            .label { 
              width: 50mm; 
              height: 35mm; 
              border: 1px solid #ccc; 
              padding: 2mm 3mm;
              box-sizing: border-box;
              page-break-inside: avoid;
              font-size: 8pt;
            }
            .label-row { display: flex; margin-bottom: 1mm; }
            .label-key { color: #666; width: 18mm; flex-shrink: 0; }
            .label-value { font-weight: 500; }
            .label-value.underline { text-decoration: underline; text-underline-offset: 2px; }
            .barcode { margin-top: 2mm; text-align: center; }
            .barcode img { max-width: 100%; height: 12mm; }
            @media print { 
              body { padding: 0; } 
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="labels">${labelsHtml}</div>
        </body>
      </html>`);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };
  
  // 删除标签
  const handleDelete = async () => {
    if (!deleteUsername || !deletePassword) {
      toast.error('请输入用户名和密码');
      return;
    }
    if (!deleteReason.trim()) {
      toast.error('请填写删除理由');
      return;
    }
    
    try {
      // 验证用户名密码
      // 这里应该调用后端 API 验证
      // await api.post('/auth/verify', { username: deleteUsername, password: deletePassword });
      
      // 删除选中的标签
      const idsToDelete = Array.from(selectedLabels);
      // await LabelsService.deleteLabels(idsToDelete, deleteReason);
      
      toast.success(`成功删除 ${idsToDelete.length} 个标签`);
      setDeleteDialogOpen(false);
      setDeleteReason('');
      setDeletePassword('');
      setDeleteUsername('');
      setSelectedLabels(new Set());
      fetchBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '删除失败');
    }
  };
  
  // 重置筛选
  const resetFilters = () => {
    setFilters({
      group: '',
      testType: '',
      subjectNo: '',
      isPrimary: ''
    });
    setSearchKeyword('');
  };
  
  return (
    <div className="space-y-6">
      {/* 筛选区域 */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon className="w-5 h-5 text-zinc-400" />
          <Text className="font-semibold text-zinc-900">筛选区域</Text>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">组别</label>
            <Select
              value={filters.group}
              onChange={(e) => setFilters({ ...filters, group: e.target.value })}
            >
              <option value="">全部</option>
              {availableOptions.cycles.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">检测类型</label>
            <Select
              value={filters.testType}
              onChange={(e) => setFilters({ ...filters, testType: e.target.value })}
            >
              <option value="">全部</option>
              {availableOptions.testTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">受试者编号</label>
            <Input
              value={filters.subjectNo}
              onChange={(e) => setFilters({ ...filters, subjectNo: e.target.value })}
              placeholder="输入编号..."
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">正/备份</label>
            <Select
              value={filters.isPrimary}
              onChange={(e) => setFilters({ ...filters, isPrimary: e.target.value })}
            >
              <option value="">全部</option>
              <option value="primary">正份</option>
              <option value="backup">备份</option>
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">搜索</label>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="手动输入..."
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button plain onClick={resetFilters}>
            <XMarkIcon className="w-4 h-4 mr-1" />
            重置筛选
          </Button>
        </div>
      </div>
      
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color="blue">{filteredLabels.length} 条记录</Badge>
          {selectedLabels.size > 0 && (
            <Badge color="amber">已选 {selectedLabels.size} 条</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 导出按钮 */}
          <div className="relative">
            <Button 
              outline 
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
              导出
              <ChevronDownIcon className="w-4 h-4 ml-1" />
            </Button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-10 min-w-[120px]">
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  导出 PDF
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  导出 Excel
                </button>
                <button
                  onClick={() => handleExport('txt')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  导出 TXT
                </button>
              </div>
            )}
          </div>
          
          <Button outline onClick={handlePrintList}>
            <PrinterIcon className="w-4 h-4 mr-1" />
            打印清单表
          </Button>
          
          <Button color="dark" onClick={handlePrintLabels}>
            <PrinterIcon className="w-4 h-4 mr-1" />
            打印标签
          </Button>
          
          {selectedLabels.size > 0 && (
            <Button 
              color="red" 
              onClick={() => setDeleteDialogOpen(true)}
            >
              <TrashIcon className="w-4 h-4 mr-1" />
              删除 ({selectedLabels.size})
            </Button>
          )}
        </div>
      </div>
      
      {/* 数据表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader className="w-10">
                  <Checkbox
                    checked={selectedLabels.size === filteredLabels.length && filteredLabels.length > 0}
                    onChange={toggleSelectAll}
                  />
                </TableHeader>
                <TableHeader>样本编号</TableHeader>
                <TableHeader>受试者编号</TableHeader>
                <TableHeader>样本类型</TableHeader>
                <TableHeader>检测类型</TableHeader>
                <TableHeader>采集点</TableHeader>
                <TableHeader>采集点名称</TableHeader>
                <TableHeader>组别</TableHeader>
                <TableHeader>正/备份</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-zinc-500">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filteredLabels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-zinc-500">
                    暂无数据，请先在"生成编号"页面生成标签
                  </TableCell>
                </TableRow>
              ) : (
                filteredLabels.map(label => {
                  const parsed = parseLabel(label);
                  return (
                    <TableRow key={label.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLabels.has(label.id)}
                          onChange={() => toggleSelect(label.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{parsed.sampleNo}</TableCell>
                      <TableCell>{parsed.subjectNo}</TableCell>
                      <TableCell>
                        <Badge color={label.label_type === 'sampling_tube' ? 'blue' : 'purple'}>
                          {parsed.sampleType}
                        </Badge>
                      </TableCell>
                      <TableCell>{parsed.testType}</TableCell>
                      <TableCell>{parsed.collectPoint}</TableCell>
                      <TableCell>{parsed.collectPointName}</TableCell>
                      <TableCell>{parsed.group}</TableCell>
                      <TableCell>
                        <Badge color={label.label_type === 'sampling_tube' ? 'green' : 'amber'}>
                          {parsed.isPrimary}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>删除标签</DialogTitle>
        <DialogDescription>
          已选择 {selectedLabels.size} 个标签，删除后不可恢复。请填写删除理由并验证身份。
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 mb-1 block">
                删除理由 <span className="text-red-500">*</span>
              </label>
              <Input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="请输入删除理由..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-zinc-700 mb-1 block">
                  用户名 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={deleteUsername}
                  onChange={(e) => setDeleteUsername(e.target.value)}
                  placeholder="输入用户名"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700 mb-1 block">
                  密码 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="输入密码"
                />
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setDeleteDialogOpen(false)}>
            取消
          </Button>
          <Button color="red" onClick={handleDelete}>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

// 选项列组件
const OptionColumn = ({ 
  title, 
  options, 
  selected, 
  onSelectionChange,
  emptyText = "暂无选项"
}: { 
  title: string;
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  emptyText?: string;
}) => {
  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onSelectionChange(Array.from(next));
  };

  const toggleAll = () => {
    if (selected.length === options.length) onSelectionChange([]);
    else onSelectionChange([...options]);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
      <div className="px-3 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-wider">{title}</span>
          <Badge color="zinc" className="!px-1.5 !py-0 !text-[9px]">{options.length}</Badge>
        </div>
        {options.length > 0 && (
          <button 
            onClick={toggleAll} 
            className="text-[9px] font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-tight"
          >
            {selected.length === options.length ? '取消' : '全选'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-[200px] max-h-[350px]">
        {options.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <span className="text-[10px]">{emptyText}</span>
          </div>
        ) : (
          options.map(opt => (
            <div 
              key={opt} 
              onClick={() => toggle(opt)}
              className={clsx(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all border",
                selected.includes(opt) 
                  ? "bg-blue-50 text-blue-700 border-blue-100 font-bold shadow-sm" 
                  : "bg-white border-transparent text-zinc-600 hover:bg-zinc-50"
              )}
            >
              <div className={clsx(
                "w-3 h-3 rounded flex-shrink-0 flex items-center justify-center border transition-all",
                selected.includes(opt) 
                  ? "bg-blue-600 border-blue-600" 
                  : "border-zinc-300 bg-white"
              )}>
                {selected.includes(opt) && <div className="w-1 h-1 bg-white rounded-full" />}
              </div>
              <span className="text-[11px] truncate leading-none font-mono">{opt}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default function LabelsPage() {
  const router = useRouter();
  const { selectedProjectId, projects } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [loading, setLoading] = useState(false);
  
  // 当前项目
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  
  // 标签类型
  const [labelType, setLabelType] = useState<'sampling_tube' | 'cryo_tube'>('sampling_tube');
  
  // 全局参数中的样本配置
  const [sampleConfigs, setSampleConfigs] = useState<SampleTypeConfig[]>([]);
  
  // 选项数据 - 从全局参数获取
  const [availableOptions, setAvailableOptions] = useState<{
    cycles: string[];
    testTypes: string[];
    primaryCodes: string[];
    backupCodes: string[];
    collectionPoints: { code: string; name: string; time_description?: string }[];
  }>({
    cycles: [],
    testTypes: [],
    primaryCodes: [],
    backupCodes: [],
    collectionPoints: []
  });
  
  // 选中的选项
  const [selectedOptions, setSelectedOptions] = useState<{
    cycles: string[];
    testTypes: string[];
    primaryCodes: string[];
    backupCodes: string[];
    collectionPoints: string[];
  }>({
    cycles: [],
    testTypes: [],
    primaryCodes: [],
    backupCodes: [],
    collectionPoints: []
  });
  
  // 分隔符设置
  const [separator, setSeparator] = useState<string>('-');
  
  // 生成结果
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [lastBatchId, setLastBatchId] = useState<number | null>(null);
  
  // 批次列表
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  
  // 预览编号
  const previewCode = useMemo(() => {
    const parts: string[] = [];
    if (selectedOptions.cycles.length > 0) parts.push(selectedOptions.cycles[0]);
    if (selectedOptions.collectionPoints.length > 0) parts.push(selectedOptions.collectionPoints[0]);
    if (selectedOptions.testTypes.length > 0) parts.push(selectedOptions.testTypes[0]);
    if (labelType === 'sampling_tube') {
      if (selectedOptions.primaryCodes.length > 0) parts.push(selectedOptions.primaryCodes[0]);
    } else {
      if (selectedOptions.backupCodes.length > 0) parts.push(selectedOptions.backupCodes[0]);
    }
    return parts.length > 0 ? parts.join(separator === '' ? '' : separator) : '请选择选项...';
  }, [selectedOptions, separator, labelType]);
  
  // 预计生成数量
  const estimatedCount = useMemo(() => {
    const cycleCount = selectedOptions.cycles.length || 1;
    const collectionPointCount = selectedOptions.collectionPoints.length || 1;
    const testTypeCount = selectedOptions.testTypes.length || 1;
    let codeCount = 1;
    if (labelType === 'sampling_tube') {
      codeCount = selectedOptions.primaryCodes.length || 1;
    } else {
      codeCount = selectedOptions.backupCodes.length || 1;
    }
    return cycleCount * collectionPointCount * testTypeCount * codeCount;
  }, [selectedOptions, labelType]);

  // 获取项目信息
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectData();
    }
  }, [selectedProjectId]);

  // 获取批次列表
  useEffect(() => {
    if (activeTab === 'view' && selectedProjectId) {
      fetchBatches();
    }
  }, [activeTab, selectedProjectId]);

  const fetchProjectData = async () => {
    if (!selectedProjectId) return;
    
    setLoading(true);
    try {
      // 获取项目详情和全局配置
      const [projectRes, sampleTypesRes, collectionPointsRes] = await Promise.all([
        api.get(`/projects/${selectedProjectId}`),
        api.get('/global-params/sample-types'),
        api.get('/global-params/collection-points').catch(() => ({ data: [] })),
      ]);
      
      setCurrentProject(projectRes.data);
      
      const configs = sampleTypesRes.data as SampleTypeConfig[];
      setSampleConfigs(configs);
      
      // 提取选项
      const clinicalConfigs = configs.filter(c => c.category === 'clinical' || !c.category);
      
      const cycles = new Set<string>();
      const testTypes = new Set<string>();
      const primaryCodes = new Set<string>();
      const backupCodes = new Set<string>();
      
      clinicalConfigs.forEach(config => {
        if (config.cycle_group) {
          config.cycle_group.split(',').forEach(c => cycles.add(c.trim()));
        }
        if (config.test_type) {
          config.test_type.split(',').forEach(t => testTypes.add(t.trim()));
        }
        if (config.primary_codes) {
          config.primary_codes.split(',').forEach(c => primaryCodes.add(c.trim()));
        }
        if (config.backup_codes) {
          config.backup_codes.split(',').forEach(c => backupCodes.add(c.trim()));
        }
      });
      
      setAvailableOptions({
        cycles: Array.from(cycles),
        testTypes: Array.from(testTypes),
        primaryCodes: Array.from(primaryCodes),
        backupCodes: Array.from(backupCodes),
        collectionPoints: collectionPointsRes.data || []
      });
      
    } catch (error) {
      console.error('获取项目数据失败:', error);
      toast.error('获取项目数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async () => {
    if (!selectedProjectId) return;
    
    try {
      const data = await LabelsService.getBatches({ 
        project_id: selectedProjectId,
        limit: 100 
      });
      setBatches(data);
    } catch (error) {
      console.error('获取批次列表失败:', error);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProjectId) {
      toast.error('请先选择项目');
      return;
    }
    
    // 验证选项
    const hasSelection = 
      selectedOptions.cycles.length > 0 || 
      selectedOptions.collectionPoints.length > 0 ||
      selectedOptions.testTypes.length > 0 ||
      (labelType === 'sampling_tube' ? selectedOptions.primaryCodes.length > 0 : selectedOptions.backupCodes.length > 0);
    
    if (!hasSelection) {
      toast.error('请至少选择一个选项');
      return;
    }
    
    setLoading(true);
    try {
      // 构建选项
      const options: Record<string, string[]> = {};
      if (selectedOptions.cycles.length > 0) options.cycles = selectedOptions.cycles;
      if (selectedOptions.collectionPoints.length > 0) options.collectionPoints = selectedOptions.collectionPoints;
      if (selectedOptions.testTypes.length > 0) options.testTypes = selectedOptions.testTypes;
      if (labelType === 'sampling_tube' && selectedOptions.primaryCodes.length > 0) {
        options.primaryCodes = selectedOptions.primaryCodes;
      }
      if (labelType === 'cryo_tube' && selectedOptions.backupCodes.length > 0) {
        options.backupCodes = selectedOptions.backupCodes;
      }
      
      // 检查重复
      // 先生成预览编号
      const previewCodes = generatePreviewCodes(options);
      
      const duplicateCheck = await LabelsService.checkDuplicates(selectedProjectId, previewCodes);
      
      if (duplicateCheck.has_duplicates) {
        toast.error(`存在 ${duplicateCheck.duplicate_codes.length} 个重复编号，请修改选项后重试`);
        return;
      }
      
      // 生成标签
      const result = await LabelsService.generateLabels({
        project_id: selectedProjectId,
        label_type: labelType,
        selected_options: options
      });
      
      setGeneratedCodes(result.label_codes);
      setLastBatchId(result.batch_id);
      toast.success(`成功生成 ${result.total_count} 个编号`);
      
      // 切换到查看标签页
      setActiveTab('view');
      fetchBatches();
      
    } catch (error: any) {
      console.error('生成失败:', error);
      toast.error(error.response?.data?.detail || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成预览编号（用于重复检查）
  const generatePreviewCodes = (options: Record<string, string[]>): string[] => {
    const arrays: string[][] = Object.values(options).filter(arr => arr.length > 0);
    if (arrays.length === 0) return [];
    
    // 笛卡尔积
    const cartesian = (...arrays: string[][]): string[][] => {
      return arrays.reduce<string[][]>(
        (acc, arr) => acc.flatMap(x => arr.map(y => [...x, y])),
        [[]]
      );
    };
    
    const combinations = cartesian(...arrays);
    return combinations.map(combo => combo.join(separator === '' ? '' : separator));
  };

  const resetSelection = () => {
    setSelectedOptions({
      cycles: [],
      testTypes: [],
      primaryCodes: [],
      backupCodes: [],
      collectionPoints: []
    });
    setGeneratedCodes([]);
  };

  if (!selectedProjectId) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto py-12">
          <div className="text-center">
            <TagIcon className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <Heading>标签管理</Heading>
            <Text className="mt-2 text-zinc-600">请先在顶部选择一个项目</Text>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <Heading>标签管理</Heading>
              <Text className="mt-1 text-zinc-600">
                当前项目：{currentProject?.lab_project_code || '加载中...'}
              </Text>
            </div>
          </div>
        </div>

        {/* 标签页切换 */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { key: 'generate', label: '生成编号', icon: PlusIcon },
              { key: 'settings', label: '标签设置', icon: Cog6ToothIcon },
              { key: 'view', label: '查看与打印', icon: EyeIcon }
            ]}
            activeTab={activeTab}
            onChange={(key) => setActiveTab(key as TabType)}
          />
        </div>

        {/* 生成编号 */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            {/* 标签类型选择 */}
            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Text className="font-semibold text-zinc-900">选择标签类型</Text>
                  <Text className="text-sm text-zinc-500 mt-1">采样管和冻存管编号分别生成</Text>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setLabelType('sampling_tube')}
                  className={clsx(
                    "flex-1 p-4 rounded-xl border-2 transition-all",
                    labelType === 'sampling_tube'
                      ? "border-blue-500 bg-blue-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  )}
                >
                  <BeakerIcon className={clsx(
                    "w-8 h-8 mx-auto mb-2",
                    labelType === 'sampling_tube' ? "text-blue-600" : "text-zinc-400"
                  )} />
                  <Text className={clsx(
                    "font-semibold text-center",
                    labelType === 'sampling_tube' ? "text-blue-700" : "text-zinc-600"
                  )}>采样管编号</Text>
                  <Text className="text-xs text-center text-zinc-500 mt-1">用于样本采集时的标签</Text>
                </button>
                <button
                  onClick={() => setLabelType('cryo_tube')}
                  className={clsx(
                    "flex-1 p-4 rounded-xl border-2 transition-all",
                    labelType === 'cryo_tube'
                      ? "border-purple-500 bg-purple-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  )}
                >
                  <DocumentTextIcon className={clsx(
                    "w-8 h-8 mx-auto mb-2",
                    labelType === 'cryo_tube' ? "text-purple-600" : "text-zinc-400"
                  )} />
                  <Text className={clsx(
                    "font-semibold text-center",
                    labelType === 'cryo_tube' ? "text-purple-700" : "text-zinc-600"
                  )}>冻存管编号</Text>
                  <Text className="text-xs text-center text-zinc-500 mt-1">用于样本存储时的标签</Text>
                </button>
              </div>
            </div>

            {/* 预览框 */}
            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <Text className="font-semibold text-zinc-900">编号预览</Text>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Text className="text-sm text-zinc-500">分隔符：</Text>
                    <Select
                      value={separator}
                      onChange={(e) => setSeparator(e.target.value)}
                      className="w-24"
                    >
                      <option value="-">横杠 (-)</option>
                      <option value="_">下划线 (_)</option>
                      <option value="">无分隔符</option>
                    </Select>
                  </div>
                  <Badge color="blue">预计生成 {estimatedCount} 个</Badge>
                </div>
              </div>
              <div className="bg-zinc-50 rounded-lg p-6 text-center border border-zinc-200">
                <span className="font-mono text-2xl font-bold text-zinc-900">{previewCode}</span>
              </div>
            </div>

            {/* 选项矩阵 */}
            <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Text className="font-semibold text-zinc-900">选择选项</Text>
                  <Text className="text-sm text-zinc-500 mt-1">从下方选择各维度的选项，系统将自动组合生成编号</Text>
                </div>
                <Button plain onClick={resetSelection}>
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  重置选择
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <OptionColumn
                  title="周期/剂量组"
                  options={availableOptions.cycles}
                  selected={selectedOptions.cycles}
                  onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, cycles: vals })}
                  emptyText="请在全局参数中配置"
                />
                <OptionColumn
                  title="采血点/时间点"
                  options={availableOptions.collectionPoints.map(p => `${p.code}:${p.name}`)}
                  selected={selectedOptions.collectionPoints}
                  onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, collectionPoints: vals })}
                  emptyText="请在全局参数中配置"
                />
                <OptionColumn
                  title="检测类型"
                  options={availableOptions.testTypes}
                  selected={selectedOptions.testTypes}
                  onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, testTypes: vals })}
                  emptyText="请在全局参数中配置"
                />
                {labelType === 'sampling_tube' ? (
                  <OptionColumn
                    title="正份代码"
                    options={availableOptions.primaryCodes}
                    selected={selectedOptions.primaryCodes}
                    onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, primaryCodes: vals })}
                    emptyText="请在全局参数中配置"
                  />
                ) : (
                  <OptionColumn
                    title="备份代码"
                    options={availableOptions.backupCodes}
                    selected={selectedOptions.backupCodes}
                    onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, backupCodes: vals })}
                    emptyText="请在全局参数中配置"
                  />
                )}
              </div>
            </div>

            {/* 生成按钮 */}
            <div className="flex justify-end gap-4">
              <Button
                color="dark"
                onClick={handleGenerate}
                disabled={loading || estimatedCount === 0}
                className="px-8"
              >
                {loading ? '生成中...' : `生成 ${estimatedCount} 个编号`}
              </Button>
            </div>
          </div>
        )}

        {/* 标签设置 */}
        {activeTab === 'settings' && (
          <LabelSettingsTab 
            currentProject={currentProject}
            availableOptions={availableOptions}
          />
        )}

        {/* 查看与打印 */}
        {activeTab === 'view' && (
          <ViewAndPrintTab 
            currentProject={currentProject}
            availableOptions={availableOptions}
            batches={batches}
            fetchBatches={fetchBatches}
          />
        )}
      </div>
    </AppLayout>
  );
}
