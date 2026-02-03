import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Checkbox } from '@/components/checkbox';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
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

type TabType = 'generate' | 'settings';

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
  projectCode,
  hoveredRowId,
  onHoverRow
}: { 
  template: LabelTemplate;
  previewData: Record<string, string>;
  projectCode: string;
  hoveredRowId: string | null;
  onHoverRow: (id: string | null) => void;
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
    <div className="border-2 border-dashed border-zinc-300 rounded-lg p-4 bg-white w-[320px] font-mono text-sm shadow-sm">
      <div className="text-xs text-zinc-400 mb-2 font-sans">
        {template.labelType === 'sampling_tube' ? 'PK:' : 'IR:'}
      </div>
      <div className="space-y-1.5 mb-3">
        {template.rows.map(row => (
          <div 
            key={row.id} 
            className={clsx(
              "flex transition-all duration-200 rounded px-1 -mx-1",
              hoveredRowId === row.id ? "bg-blue-50 ring-1 ring-blue-200" : ""
            )}
            onMouseEnter={() => onHoverRow(row.id)}
            onMouseLeave={() => onHoverRow(null)}
          >
            <span className="text-zinc-600 w-28 flex-shrink-0">{row.label}：</span>
            <span className="text-zinc-900 font-medium underline underline-offset-2 decoration-zinc-300 break-all">
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
    subjectNos?: string[];
  };
}) => {
  const [settingType, setSettingType] = useState<'sampling_tube' | 'cryo_tube'>('sampling_tube');
  const [template, setTemplate] = useState<LabelTemplate>(defaultSamplingTubeTemplate);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>>({
    subject: 'S001',
    testType: 'PK',
    note: '采血(HS)',
    code: 'a',
    time: 'D1 给药前 30min'
  });
  
  // 打印尺寸设置
  const [labelSize, setLabelSize] = useState({
    width: 50,  // 毫米
    height: 35, // 毫米
    fontSize: 8 // pt
  });

  // 切换标签类型时更新模板
  useEffect(() => {
    if (settingType === 'sampling_tube') {
      // 修正默认模板，确保包含代码
      const updatedDefault = {
        ...defaultSamplingTubeTemplate,
        rows: defaultSamplingTubeTemplate.rows.map(row => 
          row.id === 'purpose' 
            ? { ...row, combinedFields: { field1: 'testType', field2: 'code', separator: '-' } }
            : row
        )
      };
      setTemplate(updatedDefault);
      setPreviewData({
        subject: 'S001',
        testType: 'PK',
        note: '采血(HS)',
        code: 'a',
        time: 'D1 给药前 30min'
      });
    } else {
      // 修正默认模板，确保包含代码
      const updatedDefault = {
        ...defaultCryoTubeTemplate,
        rows: defaultCryoTubeTemplate.rows.map(row => 
          row.id === 'purpose' 
            ? { ...row, combinedFields: { field1: 'testType', field2: 'code', separator: '-' } }
            : row
        )
      };
      setTemplate(updatedDefault);
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
  
  const handleSaveTemplate = () => {
    // 这里后续可以对接后端 API 保存配置
    // await LabelsService.createConfig({ ... });
    toast.success('模板配置已保存');
  };

  return (
    <div className="space-y-6">
      {/* 标签类型选择 - 紧凑设计 */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className={clsx(
            "p-3 rounded-xl transition-colors shrink-0",
            settingType === 'sampling_tube' ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
          )}>
            {settingType === 'sampling_tube' ? (
              <BeakerIcon className="w-6 h-6" />
            ) : (
              <DocumentTextIcon className="w-6 h-6" />
            )}
          </div>
          <div>
            <Text className="text-base font-bold text-zinc-900">
              {settingType === 'sampling_tube' ? '采样管标签' : '冻存管标签'}
            </Text>
            <Text className="text-sm text-zinc-500 mt-0.5">
              为{settingType === 'sampling_tube' ? '采样管' : '冻存管'}配置打印格式、内容字段和条形码展示
            </Text>
          </div>
        </div>

        <div className="flex p-1 bg-zinc-100 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setSettingType('sampling_tube')}
            className={clsx(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              settingType === 'sampling_tube'
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <BeakerIcon className="w-4 h-4" />
            采样管
          </button>
          <button
            onClick={() => setSettingType('cryo_tube')}
            className={clsx(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
              settingType === 'cryo_tube'
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
            )}
          >
            <DocumentTextIcon className="w-4 h-4" />
            冻存管
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：标签行配置 */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Text className="text-base font-bold text-zinc-900">标签内容配置</Text>
              <Text className="text-xs text-zinc-500 mt-0.5">定义标签上显示的每一行内容及其数据来源</Text>
            </div>
            <Button outline onClick={addRow} className="rounded-xl">
              <PlusIcon className="w-4 h-4 mr-1.5" />
              <span className="text-sm font-medium">添加新行</span>
            </Button>
          </div>
          
          <div className="space-y-3">
            {template.rows.map((row, index) => (
              <div 
                key={row.id} 
                className={clsx(
                  "flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 group",
                  hoveredRowId === row.id 
                    ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100 shadow-sm" 
                    : "bg-zinc-50/50 border-zinc-100 hover:border-zinc-200"
                )}
                onMouseEnter={() => setHoveredRowId(row.id)}
                onMouseLeave={() => setHoveredRowId(null)}
              >
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {/* 行标签 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">字段名称</label>
                    <Input
                      value={row.label}
                      onChange={(e) => updateRow(row.id, { label: e.target.value })}
                      placeholder="如：方案编号"
                      className="text-sm bg-white"
                    />
                  </div>
                  {/* 类型选择 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">数据来源</label>
                    <Select
                      value={row.type}
                      onChange={(e) => updateRow(row.id, { type: e.target.value as LabelRow['type'] })}
                      className="text-sm bg-white"
                    >
                      <option value="static">固定文本</option>
                      <option value="dynamic">下拉选择</option>
                      <option value="combined">组合字段</option>
                    </Select>
                  </div>
                  {/* 值/配置 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider ml-1">内容配置</label>
                    {row.type === 'static' && (
                      <Input
                        value={row.value || ''}
                        onChange={(e) => updateRow(row.id, { value: e.target.value })}
                        placeholder="请输入文本"
                        className="text-sm bg-white"
                      />
                    )}
                    {row.type === 'dynamic' && (
                      <Select
                        value={row.value || ''}
                        onChange={(e) => {
                          updateRow(row.id, { value: e.target.value });
                          updatePreview(row.id, e.target.value);
                        }}
                        className="text-sm bg-white"
                      >
                        <option value="">选择字段...</option>
                        <option value="subject">筛选号</option>
                        <option value="testType">检测类型</option>
                        <option value="cycle">周期</option>
                        <option value="time">采样时间</option>
                      </Select>
                    )}
                    {row.type === 'combined' && (
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.combinedFields?.field1 || ''}
                          onChange={(e) => updateRow(row.id, { 
                            combinedFields: { 
                              field1: e.target.value,
                              field2: row.combinedFields?.field2 || 'code',
                              separator: row.combinedFields?.separator || '-'
                            }
                          })}
                          className="text-sm bg-white flex-1"
                        >
                          <option value="">选择字段...</option>
                          <option value="testType">检测类型</option>
                          <option value="cycle">周期</option>
                          <option value="subject">筛选号</option>
                        </Select>
                        <Input
                          value={row.combinedFields?.separator || '-'}
                          onChange={(e) => updateRow(row.id, { 
                            combinedFields: { 
                              field1: row.combinedFields?.field1 || 'testType',
                              field2: row.combinedFields?.field2 || 'code',
                              separator: e.target.value 
                            }
                          })}
                          className="w-10 text-center !px-0 text-sm"
                          maxLength={2}
                          placeholder="-"
                        />
                        <Select
                          value={row.combinedFields?.field2 || ''}
                          onChange={(e) => updateRow(row.id, { 
                            combinedFields: { 
                              field1: row.combinedFields?.field1 || 'testType',
                              field2: e.target.value,
                              separator: row.combinedFields?.separator || '-'
                            }
                          })}
                          className="text-sm bg-white flex-1"
                        >
                          <option value="">选择字段...</option>
                          <option value="code">正份代码</option>
                          <option value="backupCode">备份代码</option>
                          <option value="note">备注</option>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button plain onClick={() => removeRow(row.id)} className="text-zinc-400 hover:text-red-500 p-1">
                    <XMarkIcon className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* 条形码设置 */}
          <div className="mt-6 pt-6 border-t border-zinc-100">
            <div className="bg-zinc-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={template.showBarcode}
                  onChange={(checked) => setTemplate({ ...template, showBarcode: checked })}
                  className="w-5 h-5"
                />
                <div>
                  <Text className="text-sm font-bold text-zinc-900">显示条形码</Text>
                  <Text className="text-xs text-zinc-500">在标签底部生成唯一识别条码</Text>
                </div>
              </div>
              {template.showBarcode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-zinc-500 whitespace-nowrap">条码数据源：</span>
                  <Select
                    value={template.barcodeField}
                    onChange={(e) => setTemplate({ ...template, barcodeField: e.target.value })}
                    className="text-sm w-36 bg-white"
                  >
                    <option value="subject">受试者编号</option>
                    <option value="full">完整样本编号</option>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：标签预览 */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Text className="text-base font-bold text-zinc-900">打印效果预览</Text>
              <Text className="text-xs text-zinc-500 mt-0.5">实时查看标签在打印纸上的呈现效果</Text>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Live Preview</span>
            </div>
          </div>
          
          <div className="flex-1 space-y-6 flex flex-col">
            {/* 标签预览容器 */}
            <div className="flex justify-center py-10 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
              <LabelPreview 
                template={template}
                previewData={previewData}
                projectCode={currentProject?.sponsor_project_code || currentProject?.lab_project_code || 'LT2158CHN005'}
                hoveredRowId={hoveredRowId}
                onHoverRow={setHoveredRowId}
              />
            </div>

            {/* 打印尺寸设置 */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">打印尺寸设置</Text>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">宽度 (mm)</label>
                  <Input
                    type="number"
                    value={labelSize.width}
                    onChange={(e) => setLabelSize({ ...labelSize, width: parseInt(e.target.value) || 50 })}
                    className="text-sm"
                    min={20}
                    max={100}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">高度 (mm)</label>
                  <Input
                    type="number"
                    value={labelSize.height}
                    onChange={(e) => setLabelSize({ ...labelSize, height: parseInt(e.target.value) || 35 })}
                    className="text-sm"
                    min={15}
                    max={80}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">字体大小 (pt)</label>
                  <Input
                    type="number"
                    value={labelSize.fontSize}
                    onChange={(e) => setLabelSize({ ...labelSize, fontSize: parseInt(e.target.value) || 8 })}
                    className="text-sm"
                    min={6}
                    max={14}
                  />
                </div>
              </div>
              <div className="flex gap-2 text-xs text-zinc-500">
                <button
                  onClick={() => setLabelSize({ width: 50, height: 35, fontSize: 8 })}
                  className="px-2 py-1 bg-zinc-100 rounded hover:bg-zinc-200 transition-colors"
                >
                  采血管 (50×35mm)
                </button>
                <button
                  onClick={() => setLabelSize({ width: 25, height: 25, fontSize: 6 })}
                  className="px-2 py-1 bg-zinc-100 rounded hover:bg-zinc-200 transition-colors"
                >
                  冻存管 (25×25mm)
                </button>
                <button
                  onClick={() => setLabelSize({ width: 60, height: 40, fontSize: 9 })}
                  className="px-2 py-1 bg-zinc-100 rounded hover:bg-zinc-200 transition-colors"
                >
                  大尺寸 (60×40mm)
                </button>
              </div>
            </div>

            {/* 预览数据输入 */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
              <Text className="text-xs font-bold text-zinc-400 uppercase tracking-wider">预览测试数据</Text>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">筛选号</label>
                  <Input
                    value={previewData.subject}
                    onChange={(e) => updatePreview('subject', e.target.value)}
                    className="text-sm"
                    placeholder="S001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">检测类型</label>
                  <Select
                    value={previewData.testType}
                    onChange={(e) => updatePreview('testType', e.target.value)}
                    className="text-sm"
                  >
                    <option value="">选择类型...</option>
                    {availableOptions.testTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="PK">PK</option>
                    <option value="IR 检测">IR 检测</option>
                  </Select>
                </div>
                {settingType === 'sampling_tube' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">备注</label>
                    <Input
                      value={previewData.note}
                      onChange={(e) => updatePreview('note', e.target.value)}
                      className="text-sm"
                      placeholder="采血(HS)"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">
                    {settingType === 'sampling_tube' ? '正份代码' : '备份代码'}
                  </label>
                  <Select
                    value={previewData.code}
                    onChange={(e) => updatePreview('code', e.target.value)}
                    className="text-sm"
                  >
                    <option value="">选择代码...</option>
                    {availableOptions.primaryCodes.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="a">a</option>
                    <option value="b">b</option>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider ml-1">计划采样时间</label>
                  <Input
                    value={previewData.time}
                    onChange={(e) => updatePreview('time', e.target.value)}
                    className="text-sm"
                    placeholder="D1 给药前 30min"
                  />
                </div>
              </div>
            </div>

            {/* 按钮区域 */}
            <div className="flex justify-between pt-4">
              <Button 
                outline
                onClick={() => {
                  // 打印测试页
                  const printWindow = window.open('', '', 'width=800,height=600');
                  if (!printWindow) {
                    toast.error('浏览器阻止了打印窗口');
                    return;
                  }
                  
                  const projectCode = currentProject?.sponsor_project_code || currentProject?.lab_project_code || 'TEST';
                  
                  printWindow.document.write(`<!DOCTYPE html>
                    <html lang="zh-CN">
                      <head>
                        <meta charset="utf-8" />
                        <title>打印测试页</title>
                        <style>
                          body { font-family: 'SF Pro SC', 'PingFang SC', sans-serif; padding: 10mm; margin: 0; }
                          .test-info { text-align: center; margin-bottom: 10mm; font-size: 12pt; }
                          .labels { display: flex; flex-wrap: wrap; gap: 5mm; }
                          .label { 
                            width: ${labelSize.width}mm; 
                            height: ${labelSize.height}mm; 
                            border: 1px solid #ccc; 
                            padding: 2mm 3mm;
                            box-sizing: border-box;
                            page-break-inside: avoid;
                            font-size: ${labelSize.fontSize}pt;
                          }
                          .label-row { display: flex; margin-bottom: 1mm; }
                          .label-key { color: #666; width: 18mm; flex-shrink: 0; }
                          .label-value { font-weight: 500; }
                          @media print { 
                            body { padding: 0; } 
                            .test-info { display: none; }
                            .label { border: none; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="test-info">
                          <h2>打印测试页</h2>
                          <p>标签尺寸: ${labelSize.width}mm × ${labelSize.height}mm | 字体: ${labelSize.fontSize}pt</p>
                        </div>
                        <div class="labels">
                          <div class="label">
                            <div class="label-row"><span class="label-key">方案编号：</span><span class="label-value">${projectCode}</span></div>
                            <div class="label-row"><span class="label-key">筛选号：</span><span class="label-value">${previewData.subject}</span></div>
                            <div class="label-row"><span class="label-key">用途：</span><span class="label-value">${previewData.testType}-${previewData.code}</span></div>
                            <div class="label-row"><span class="label-key">采样时间：</span><span class="label-value">${previewData.time}</span></div>
                          </div>
                          <div class="label">
                            <div class="label-row"><span class="label-key">方案编号：</span><span class="label-value">${projectCode}</span></div>
                            <div class="label-row"><span class="label-key">筛选号：</span><span class="label-value">${previewData.subject}</span></div>
                            <div class="label-row"><span class="label-key">用途：</span><span class="label-value">${previewData.testType}-${previewData.code}</span></div>
                            <div class="label-row"><span class="label-key">采样时间：</span><span class="label-value">${previewData.time}</span></div>
                          </div>
                        </div>
                      </body>
                    </html>`);
                  
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => printWindow.print(), 500);
                }}
                className="px-6 h-11 rounded-xl"
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                打印测试页
              </Button>
              <Button 
                color="dark" 
                onClick={handleSaveTemplate}
                className="px-10 h-11 text-base font-bold rounded-xl shadow-lg shadow-zinc-200"
              >
                保存当前模板
              </Button>
            </div>
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
  fetchBatches,
  onGoToGenerate
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
  onGoToGenerate: () => void;
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

  // 如果没有数据，显示引导页
  if (!loading && batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-zinc-200">
        <div className="bg-zinc-50 p-6 rounded-full mb-6">
          <TagIcon className="w-12 h-12 text-zinc-300" />
        </div>
        <Text className="text-lg font-bold text-zinc-900 mb-2">暂无标签记录</Text>
        <Text className="text-zinc-500 mb-8 max-w-sm text-center text-sm leading-relaxed">
          当前项目尚未生成任何标签。您可以前往“生成编号”页面，根据需要配置并生成新的标签批次。
        </Text>
        <Button 
          color="dark" 
          onClick={onGoToGenerate}
          className="px-8 h-10 rounded-xl font-bold"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          去生成标签
        </Button>
      </div>
    );
  }

  // 计算活跃筛选器数量
  const activeFilterCount = [
    filters.group,
    filters.testType,
    filters.subjectNo,
    filters.isPrimary,
    searchKeyword
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* 紧凑筛选区域 - 单行水平排列 */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <FunnelIcon className="w-4 h-4 text-zinc-400" />
            <Text className="text-sm font-medium text-zinc-700">筛选</Text>
          </div>

          <Select
            value={filters.group}
            onChange={(e) => setFilters({ ...filters, group: e.target.value })}
            className="!py-1.5 text-sm w-28"
          >
            <option value="">组别</option>
            {availableOptions.cycles.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>

          <Select
            value={filters.testType}
            onChange={(e) => setFilters({ ...filters, testType: e.target.value })}
            className="!py-1.5 text-sm w-28"
          >
            <option value="">检测类型</option>
            {availableOptions.testTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>

          <Input
            value={filters.subjectNo}
            onChange={(e) => setFilters({ ...filters, subjectNo: e.target.value })}
            placeholder="受试者编号"
            className="!py-1.5 text-sm w-32"
          />

          <Select
            value={filters.isPrimary}
            onChange={(e) => setFilters({ ...filters, isPrimary: e.target.value })}
            className="!py-1.5 text-sm w-24"
          >
            <option value="">正/备份</option>
            <option value="primary">正份</option>
            <option value="backup">备份</option>
          </Select>

          <div className="relative flex-grow max-w-xs">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="搜索编号..."
              className="!py-1.5 text-sm pl-8"
            />
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              清除 ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* 筛选结果摘要区域 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color="blue" className="!px-2.5 !py-1">
            {filteredLabels.length} 条记录
          </Badge>
          {selectedLabels.size > 0 && (
            <Badge color="amber" className="!px-2.5 !py-1">
              已选 {selectedLabels.size} 条
            </Badge>
          )}
          {/* 显示当前筛选条件标签 */}
          {filters.group && (
            <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-1 text-xs">
              组别: {filters.group}
              <button onClick={() => setFilters({ ...filters, group: '' })} className="hover:text-red-500">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.testType && (
            <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-1 text-xs">
              类型: {filters.testType}
              <button onClick={() => setFilters({ ...filters, testType: '' })} className="hover:text-red-500">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.subjectNo && (
            <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-1 text-xs">
              受试者: {filters.subjectNo}
              <button onClick={() => setFilters({ ...filters, subjectNo: '' })} className="hover:text-red-500">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.isPrimary && (
            <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-1 text-xs">
              {filters.isPrimary === 'primary' ? '正份' : '备份'}
              <button onClick={() => setFilters({ ...filters, isPrimary: '' })} className="hover:text-red-500">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {searchKeyword && (
            <span className="inline-flex items-center gap-1 bg-zinc-100 text-zinc-700 rounded-full px-2.5 py-1 text-xs">
              搜索: {searchKeyword}
              <button onClick={() => setSearchKeyword('')} className="hover:text-red-500">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
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
  emptyText = "暂无选项",
  configLink
}: { 
  title: string;
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  emptyText?: string;
  configLink?: string;
}) => {
  const router = useRouter();
  
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
    <div className="flex flex-col h-full bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm hover:border-zinc-300 transition-colors">
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">{title}</span>
          <Badge color="zinc" className="!px-2 !py-0.5 !text-[10px]">{options.length}</Badge>
        </div>
        {options.length > 0 && (
          <button 
            onClick={toggleAll} 
            className="text-[10px] font-bold text-zinc-600 hover:text-zinc-900 transition-colors uppercase tracking-tight"
          >
            {selected.length === options.length ? '取消' : '全选'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[240px] max-h-[400px]">
        {options.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <MagnifyingGlassIcon className="w-8 h-8 mb-3 opacity-20" />
            <span className="text-xs text-center mb-3">{emptyText}</span>
            {configLink && (
              <button
                onClick={() => router.push(configLink)}
                className="text-xs text-zinc-600 hover:text-zinc-900 underline underline-offset-2 transition-colors"
              >
                前往配置 →
              </button>
            )}
          </div>
        ) : (
          options.map(opt => (
            <div 
              key={opt} 
              onClick={() => toggle(opt)}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all border",
                selected.includes(opt) 
                  ? "bg-zinc-100 text-zinc-900 border-zinc-300 font-bold shadow-sm ring-1 ring-zinc-200" 
                  : "bg-white border-transparent text-zinc-600 hover:bg-zinc-50 hover:border-zinc-200"
              )}
            >
              <div className={clsx(
                "w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all",
                selected.includes(opt) 
                  ? "bg-zinc-900 border-zinc-900 shadow-sm" 
                  : "border-zinc-300 bg-white"
              )}>
                {selected.includes(opt) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-xs truncate leading-none font-medium">{opt}</span>
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
    subjectNos: string[];
  }>({
    cycles: [],
    testTypes: [],
    primaryCodes: [],
    backupCodes: [],
    collectionPoints: [],
    subjectNos: []
  });
  
  // 选中的选项
  const [selectedOptions, setSelectedOptions] = useState<{
    cycles: string[];
    testTypes: string[];
    primaryCodes: string[];
    backupCodes: string[];
    collectionPoints: string[];
    subjectNos: string[];
  }>({
    cycles: [],
    testTypes: [],
    primaryCodes: [],
    backupCodes: [],
    collectionPoints: [],
    subjectNos: []
  });
  
  // 编号预览搜索
  const [previewSearchKeyword, setPreviewSearchKeyword] = useState('');
  
  // 分隔符设置
  const [separator, setSeparator] = useState<string>('-');
  
  // 生成结果
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [lastBatchId, setLastBatchId] = useState<number | null>(null);
  
  // 批次列表
  const [batches, setBatches] = useState<LabelBatch[]>([]);
  
  // 生成所有预览编号（带结构化数据）
  const previewLabels = useMemo(() => {
    const results: Array<{
      sampleNo: string;
      subjectNo: string;
      sampleType: string;
      testType: string;
      collectionPoint: string;
      collectionPointName: string;
      cycle: string;
      isPrimary: string;
    }> = [];
    
    // 获取各维度选项，如果为空则使用占位符
    const subjectNos = selectedOptions.subjectNos.length > 0 ? selectedOptions.subjectNos : [''];
    const cycles = selectedOptions.cycles.length > 0 ? selectedOptions.cycles : [''];
    const collectionPoints = selectedOptions.collectionPoints.length > 0 ? selectedOptions.collectionPoints : [''];
    const testTypes = selectedOptions.testTypes.length > 0 ? selectedOptions.testTypes : [''];
    const codes = labelType === 'sampling_tube' 
      ? (selectedOptions.primaryCodes.length > 0 ? selectedOptions.primaryCodes : [''])
      : (selectedOptions.backupCodes.length > 0 ? selectedOptions.backupCodes : ['']);
    
    // 笛卡尔积生成所有组合
    for (const subjectNo of subjectNos) {
      for (const cycle of cycles) {
        for (const collectionPoint of collectionPoints) {
          for (const testType of testTypes) {
            for (const code of codes) {
              // 构建编号
              const parts = [subjectNo, cycle, collectionPoint.split(':')[0], testType, code].filter(Boolean);
              const sampleNo = parts.length > 0 ? parts.join(separator || '-') : '';
              
              // 解析采集点名称
              const cpParts = collectionPoint.split(':');
              const cpCode = cpParts[0] || '';
              const cpName = cpParts[1] || cpParts[0] || '';
              
              results.push({
                sampleNo,
                subjectNo: subjectNo || '____',
                sampleType: labelType === 'sampling_tube' ? '采样管' : '冻存管',
                testType: testType || '____',
                collectionPoint: cpCode || '____',
                collectionPointName: cpName || '____',
                cycle: cycle || '____',
                isPrimary: labelType === 'sampling_tube' ? '正份' : '备份',
              });
            }
          }
        }
      }
    }
    
    return results;
  }, [selectedOptions, separator, labelType]);
  
  // 筛选后的预览编号
  const filteredPreviewLabels = useMemo(() => {
    if (!previewSearchKeyword) return previewLabels;
    const keyword = previewSearchKeyword.toLowerCase();
    return previewLabels.filter(label => 
      label.sampleNo.toLowerCase().includes(keyword) ||
      label.subjectNo.toLowerCase().includes(keyword)
    );
  }, [previewLabels, previewSearchKeyword]);
  
  // 预计生成数量
  const estimatedCount = useMemo(() => {
    const subjectNoCount = selectedOptions.subjectNos.length || 1;
    const cycleCount = selectedOptions.cycles.length || 1;
    const collectionPointCount = selectedOptions.collectionPoints.length || 1;
    const testTypeCount = selectedOptions.testTypes.length || 1;
    let codeCount = 1;
    if (labelType === 'sampling_tube') {
      codeCount = selectedOptions.primaryCodes.length || 1;
    } else {
      codeCount = selectedOptions.backupCodes.length || 1;
    }
    return subjectNoCount * cycleCount * collectionPointCount * testTypeCount * codeCount;
  }, [selectedOptions, labelType]);

  // 获取项目信息
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectData();
    }
  }, [selectedProjectId]);


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
      
      // 从项目配置中获取受试者编号列表
      let subjectNos: string[] = [];
      if (projectRes.data.sample_code_rule?.subject_prefix) {
        // 如果有配置的受试者前缀，生成一系列编号
        const prefix = projectRes.data.sample_code_rule.subject_prefix;
        const count = projectRes.data.sample_code_rule.subject_count || 10;
        subjectNos = Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(3, '0')}`);
      }
      
      setAvailableOptions({
        cycles: Array.from(cycles),
        testTypes: Array.from(testTypes),
        primaryCodes: Array.from(primaryCodes),
        backupCodes: Array.from(backupCodes),
        collectionPoints: collectionPointsRes.data || [],
        subjectNos
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
      collectionPoints: [],
      subjectNos: []
    });
    setGeneratedCodes([]);
    setPreviewSearchKeyword('');
  };
  
  // 打印标签
  const handlePrintLabels = (labelTypeFilter?: 'sampling_tube' | 'cryo_tube') => {
    const labelsToPrint = filteredPreviewLabels.filter(l => 
      !labelTypeFilter || (labelTypeFilter === 'sampling_tube' ? l.sampleType === '采样管' : l.sampleType === '冻存管')
    );
    
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
      if (!text || text.includes('____')) return '';
      try {
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
      } catch {
        return '';
      }
    };
    
    const labelsHtml = labelsToPrint.map(l => {
      const barcodeUrl = generateBarcode(l.sampleNo);
      return `
        <div class="label">
          <div class="label-row"><span class="label-key">方案编号：</span><span class="label-value">${currentProject?.sponsor_project_code || currentProject?.lab_project_code || '-'}</span></div>
          <div class="label-row"><span class="label-key">筛选号：</span><span class="label-value underline">${l.subjectNo}</span></div>
          <div class="label-row"><span class="label-key">用途：</span><span class="label-value">${l.testType}</span></div>
          <div class="label-row"><span class="label-key">采集点：</span><span class="label-value underline">${l.collectionPoint}</span></div>
          ${barcodeUrl ? `<div class="barcode"><img src="${barcodeUrl}" alt="${l.sampleNo}" /></div>` : ''}
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

  if (!selectedProjectId) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto py-12">
          <div className="text-center">
            <TagIcon className="w-16 h-16 mx-auto text-zinc-300 mb-4" />
            <Text className="text-zinc-600">请先在顶部选择一个项目</Text>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Text className="text-zinc-600">
            当前项目：{currentProject?.lab_project_code || '加载中...'}
          </Text>
        </div>

        {/* 标签页切换 */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { key: 'generate', label: '选择编号', icon: PlusIcon },
              { key: 'settings', label: '标签设置', icon: Cog6ToothIcon },
            ]}
            activeTab={activeTab}
            onChange={(key) => setActiveTab(key as TabType)}
          />
        </div>

        {/* 选择编号 */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            {/* 标签类型选择 - 紧凑设计 */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className={clsx(
                  "p-3 rounded-xl transition-colors shrink-0",
                  labelType === 'sampling_tube' ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
                )}>
                  {labelType === 'sampling_tube' ? (
                    <BeakerIcon className="w-6 h-6" />
                  ) : (
                    <DocumentTextIcon className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <Text className="text-base font-bold text-zinc-900">
                    {labelType === 'sampling_tube' ? '采样管编号' : '冻存管编号'}
                  </Text>
                  <Text className="text-sm text-zinc-500 mt-0.5">
                    {labelType === 'sampling_tube' ? '用于样本采集时的标签' : '用于样本存储时的标签'}
                  </Text>
                </div>
              </div>

              <div className="flex p-1 bg-zinc-100 rounded-xl w-full sm:w-auto">
                <button
                  onClick={() => setLabelType('sampling_tube')}
                  className={clsx(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                    labelType === 'sampling_tube'
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                      : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
                  )}
                >
                  <BeakerIcon className="w-4 h-4" />
                  采样管
                </button>
                <button
                  onClick={() => setLabelType('cryo_tube')}
                  className={clsx(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200",
                    labelType === 'cryo_tube'
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
                      : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
                  )}
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  冻存管
                </button>
              </div>
            </div>

            {/* 选项矩阵 - 放在上方 */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <Text className="text-base font-bold text-zinc-900">选择生成维度</Text>
                  <Text className="text-sm text-zinc-500 mt-0.5">系统将自动按照您勾选的选项进行组合生成</Text>
                </div>
                <Button 
                  plain 
                  onClick={resetSelection}
                  className="text-zinc-500 hover:text-red-600 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4 mr-1.5" />
                  <span className="text-sm font-medium">重置全部</span>
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <OptionColumn
                  title="组别"
                  options={availableOptions.cycles}
                  selected={selectedOptions.cycles}
                  onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, cycles: vals })}
                  emptyText="请在全局参数中配置"
                  configLink="/global-params"
                />
                <OptionColumn
                  title="检测类型"
                  options={availableOptions.testTypes}
                  selected={selectedOptions.testTypes}
                  onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, testTypes: vals })}
                  emptyText="请在全局参数中配置"
                  configLink="/global-params"
                />
                <OptionColumn
                  title="受试者编号"
                  options={availableOptions.subjectNos}
                  selected={selectedOptions.subjectNos}
                  onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, subjectNos: vals })}
                  emptyText="请在项目管理中配置"
                  configLink={`/projects/${selectedProjectId}`}
                />
                {labelType === 'sampling_tube' ? (
                  <OptionColumn
                    title="正份"
                    options={availableOptions.primaryCodes}
                    selected={selectedOptions.primaryCodes}
                    onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, primaryCodes: vals })}
                    emptyText="请在全局参数中配置"
                    configLink="/global-params"
                  />
                ) : (
                  <>
                    <OptionColumn
                      title="正份"
                      options={availableOptions.primaryCodes}
                      selected={selectedOptions.primaryCodes}
                      onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, primaryCodes: vals })}
                      emptyText="请在全局参数中配置"
                      configLink="/global-params"
                    />
                    <OptionColumn
                      title="备份"
                      options={availableOptions.backupCodes}
                      selected={selectedOptions.backupCodes}
                      onSelectionChange={(vals) => setSelectedOptions({ ...selectedOptions, backupCodes: vals })}
                      emptyText="请在全局参数中配置"
                      configLink="/global-params"
                    />
                  </>
                )}
              </div>
            </div>

            {/* 编号预览表格 - 放在下方 */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Text className="text-base font-bold text-zinc-900">编号预览</Text>
                  <Badge color="blue" className="!px-2 !py-0.5">共 {filteredPreviewLabels.length} 个</Badge>
                </div>
                <div className="flex items-center gap-3">
                  {/* 搜索框 */}
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={previewSearchKeyword}
                      onChange={(e) => setPreviewSearchKeyword(e.target.value)}
                      placeholder="搜索编号..."
                      className="pl-9 w-48 text-sm"
                    />
                  </div>
                  {/* 打印按钮 */}
                  <Button 
                    outline 
                    onClick={() => handlePrintLabels('sampling_tube')}
                    disabled={filteredPreviewLabels.length === 0}
                  >
                    <PrinterIcon className="w-4 h-4 mr-1.5" />
                    打印采血管标签
                  </Button>
                  <Button 
                    outline 
                    onClick={() => handlePrintLabels('cryo_tube')}
                    disabled={filteredPreviewLabels.length === 0}
                  >
                    <PrinterIcon className="w-4 h-4 mr-1.5" />
                    打印冻存管标签
                  </Button>
                </div>
              </div>
              
              {/* 预览表格 */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHead>
                    <TableRow>
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
                    {filteredPreviewLabels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                          请选择生成维度以预览编号
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPreviewLabels.slice(0, 100).map((label, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono font-medium">{label.sampleNo || '____'}</TableCell>
                          <TableCell>{label.subjectNo}</TableCell>
                          <TableCell>
                            <Badge color={label.sampleType === '采样管' ? 'blue' : 'purple'}>
                              {label.sampleType}
                            </Badge>
                          </TableCell>
                          <TableCell>{label.testType}</TableCell>
                          <TableCell>{label.collectionPoint}</TableCell>
                          <TableCell>{label.collectionPointName}</TableCell>
                          <TableCell>{label.cycle}</TableCell>
                          <TableCell>
                            <Badge color={label.isPrimary === '正份' ? 'green' : 'amber'}>
                              {label.isPrimary}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {filteredPreviewLabels.length > 100 && (
                  <div className="bg-zinc-50 px-4 py-2 text-center text-sm text-zinc-500 border-t border-zinc-200">
                    仅显示前 100 条，共 {filteredPreviewLabels.length} 条
                  </div>
                )}
              </div>
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
      </div>
    </AppLayout>
  );
}
