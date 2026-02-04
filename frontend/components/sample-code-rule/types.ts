export interface SampleCodeElement {
  id: string;
  name: string;
  label: string;
  number: string;
  isSpecial?: boolean;
}

export interface CodeSlot {
  elementId: string;
  separator: string;
}

export interface SeparatorOption {
  id: string;
  label: string;
  display: string;
}

export interface RuleTemplate {
  id: string;
  name: string;
  slots: CodeSlot[];
  createdAt: string;
}

export const DEFAULT_ELEMENTS: SampleCodeElement[] = [
  { id: 'sponsor_code', name: 'sponsor_code', label: '申办方项目编号', number: '①' },
  { id: 'lab_code', name: 'lab_code', label: '实验室项目编号', number: '②' },
  { id: 'clinic_code', name: 'clinic_code', label: '临床机构编号', number: '③' },
  { id: 'subject_id', name: 'subject_id', label: '受试者编号', number: '④' },
  { id: 'test_type', name: 'test_type', label: '检测类型', number: '⑤' },
  { id: 'sample_seq', name: 'sample_seq', label: '采血序号', number: '⑥' },
  { id: 'sample_time', name: 'sample_time', label: '采血时间', number: '⑦' },
  { id: 'cycle_group', name: 'cycle_group', label: '周期/组别', number: '⑧' },
  { id: 'sample_type', name: 'sample_type', label: '正份备份', number: '⑨' },
  { id: 'preprocessed_component', name: 'preprocessed_component', label: '预处理组份', number: '⑩', isSpecial: true },
];

export const SEPARATOR_OPTIONS: SeparatorOption[] = [
  { id: '', label: '无分隔', display: '' },
  { id: '-', label: '短横 -', display: '-' },
  { id: '_', label: '下划线 _', display: '_' },
];

export const TEMPLATE_STORAGE_KEY = 'sample-code-rule-templates';
