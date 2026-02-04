// Sample code rule types

export interface SampleCodeElement {
  id: string;
  name: string;
  label: string;
  number: string;
}

export interface CodeSlot {
  elementId: string;
  separator: string; // Separator after this element
}

export interface SeparatorOption {
  id: string;
  label: string;
  display: string;
}

export const SAMPLE_CODE_ELEMENTS: SampleCodeElement[] = [
  { id: 'sponsor_code', name: 'sponsor_code', label: '申办方项目编号', number: '1' },
  { id: 'lab_code', name: 'lab_code', label: '实验室项目编号', number: '2' },
  { id: 'clinic_code', name: 'clinic_code', label: '临床机构编号', number: '3' },
  { id: 'subject_id', name: 'subject_id', label: '受试者编号', number: '4' },
  { id: 'test_type', name: 'test_type', label: '检测类型', number: '5' },
  { id: 'sample_seq', name: 'sample_seq', label: '采血序号', number: '6' },
  { id: 'sample_time', name: 'sample_time', label: '采血时间', number: '7' },
  { id: 'cycle_group', name: 'cycle_group', label: '周期/组别', number: '8' },
  { id: 'sample_type', name: 'sample_type', label: '正份备份', number: '9' },
];

export const SEPARATOR_OPTIONS: SeparatorOption[] = [
  { id: '', label: '无', display: '' },
  { id: '-', label: '-', display: '-' },
  { id: '_', label: '_', display: '_' },
];

// Colors for draggable blocks
export const ELEMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  sponsor_code: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  lab_code: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  clinic_code: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  subject_id: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
  test_type: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  sample_seq: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  sample_time: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
  cycle_group: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  sample_type: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
};
