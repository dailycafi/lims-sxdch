import { useState, useEffect } from 'react';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Text } from '@/components/text';
import { Checkbox, CheckboxField, CheckboxGroup } from '@/components/checkbox';
import { Label } from '@/components/fieldset';
import { CloudArrowUpIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { toast } from 'react-hot-toast';
import { useProjectStore } from '@/store/project';
import { BlankMatrixService, MatrixTypesResponse } from '@/services/blank-matrix.service';

interface SampleEntry {
  id: string;
  anticoagulant: string;
  edta_volume: string;
  heparin_volume: string;
  citrate_volume: string;
  special_notes: string;
}

interface FileUpload {
  id: string;
  file: File;
  type: 'consent' | 'ethics' | 'medical';
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function BlankMatrixReceive() {
  const { projects, selectedProjectId, fetchProjects } = useProjectStore();
  const currentProject = projects.find(p => p.id === selectedProjectId);

  const [matrixTypes, setMatrixTypes] = useState<MatrixTypesResponse>({
    anticoagulants: [],
    matrix_types: [],
  });

  const [formData, setFormData] = useState({
    source_name: '',
    source_contact: '',
    source_phone: '',
    matrix_type: '',
    matrix_type_other: '',
    notes: '',
  });

  const [selectedAnticoagulants, setSelectedAnticoagulants] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const [sampleEntries, setSampleEntries] = useState<SampleEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSampleTable, setShowSampleTable] = useState(false);

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects().catch((error: unknown) => {
        const err = error as { response?: { status: number }; isAuthError?: boolean };
        if (err?.response?.status !== 401 && !err?.isAuthError) {
          toast.error('加载项目列表失败');
        }
      });
    }
  }, [projects.length, fetchProjects]);

  useEffect(() => {
    const loadMatrixTypes = async () => {
      try {
        const types = await BlankMatrixService.getMatrixTypes();
        setMatrixTypes(types);
      } catch (error: unknown) {
        const err = error as { response?: { status: number }; isAuthError?: boolean };
        if (err?.response?.status !== 401 && !err?.isAuthError) {
          toast.error('加载基质类型失败');
        }
      }
    };
    loadMatrixTypes();
  }, []);

  const handleAnticoagulantChange = (value: string, checked: boolean) => {
    if (checked) {
      setSelectedAnticoagulants([...selectedAnticoagulants, value]);
    } else {
      setSelectedAnticoagulants(selectedAnticoagulants.filter(v => v !== value));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'consent' | 'ethics' | 'medical') => {
    if (e.target.files) {
      const newFiles: FileUpload[] = Array.from(e.target.files).map(file => ({
        id: generateId(),
        file,
        type,
      }));
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles(uploadedFiles.filter(f => f.id !== id));
  };

  const getFilesByType = (type: 'consent' | 'ethics' | 'medical') => {
    return uploadedFiles.filter(f => f.type === type);
  };

  const addSampleEntry = () => {
    const newEntry: SampleEntry = {
      id: generateId(),
      anticoagulant: selectedAnticoagulants[0] || '',
      edta_volume: '',
      heparin_volume: '',
      citrate_volume: '',
      special_notes: '',
    };
    setSampleEntries([...sampleEntries, newEntry]);
  };

  const updateSampleEntry = (id: string, field: keyof SampleEntry, value: string) => {
    setSampleEntries(sampleEntries.map(entry =>
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const removeSampleEntry = (id: string) => {
    setSampleEntries(sampleEntries.filter(entry => entry.id !== id));
  };

  const validateForm = (): boolean => {
    if (!selectedProjectId) {
      toast.error('请先在右上角选择项目');
      return false;
    }
    if (!formData.source_name.trim()) {
      toast.error('请输入来源名称');
      return false;
    }
    if (selectedAnticoagulants.length === 0) {
      toast.error('请选择至少一种抗凝剂类型');
      return false;
    }
    if (!formData.matrix_type) {
      toast.error('请选择基质类型');
      return false;
    }
    if (formData.matrix_type === 'other' && !formData.matrix_type_other.trim()) {
      toast.error('请输入其它基质类型说明');
      return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (!validateForm()) {
      return;
    }

    // 生成样本条目
    if (sampleEntries.length === 0) {
      addSampleEntry();
    }
    setShowSampleTable(true);
  };

  const handleSubmit = async (isFinal: boolean) => {
    if (sampleEntries.length === 0) {
      toast.error('请添加至少一条样本信息');
      return;
    }

    setSubmitting(true);
    try {
      const submitFormData = new FormData();
      submitFormData.append('project_id', String(selectedProjectId));
      submitFormData.append('source_name', formData.source_name);
      submitFormData.append('source_contact', formData.source_contact);
      submitFormData.append('source_phone', formData.source_phone);
      submitFormData.append('anticoagulants', JSON.stringify(selectedAnticoagulants));
      submitFormData.append('matrix_type', formData.matrix_type);
      submitFormData.append('matrix_type_other', formData.matrix_type_other);
      submitFormData.append('notes', formData.notes);

      // 添加文件
      getFilesByType('consent').forEach(f => {
        submitFormData.append('consent_files', f.file);
      });
      getFilesByType('ethics').forEach(f => {
        submitFormData.append('ethics_files', f.file);
      });
      getFilesByType('medical').forEach(f => {
        submitFormData.append('medical_report_files', f.file);
      });

      const result = await BlankMatrixService.receive(submitFormData);

      if (result.success) {
        // 如果需要入库，调用清点接口
        if (isFinal && sampleEntries.length > 0) {
          const projectCode = currentProject?.code || 'UNK';
          const generateResult = await BlankMatrixService.generateCodes({
            project_code: projectCode,
            anticoagulant: selectedAnticoagulants[0],
            count: sampleEntries.length,
          });

          const inventoryData = {
            receive_record_id: result.receive_record_id,
            samples: sampleEntries.map((entry, index) => ({
              sample_code: generateResult.codes[index] || `${projectCode}-BP-TEMP-${index + 1}`,
              anticoagulant: entry.anticoagulant,
              edta_volume: entry.edta_volume ? parseFloat(entry.edta_volume) : undefined,
              heparin_volume: entry.heparin_volume ? parseFloat(entry.heparin_volume) : undefined,
              citrate_volume: entry.citrate_volume ? parseFloat(entry.citrate_volume) : undefined,
              special_notes: entry.special_notes,
            })),
            is_final: isFinal,
          };

          await BlankMatrixService.inventory(inventoryData);
        }

        toast.success(isFinal ? '空白基质入库成功' : '空白基质暂存成功');

        // 重置表单
        setFormData({
          source_name: '',
          source_contact: '',
          source_phone: '',
          matrix_type: '',
          matrix_type_other: '',
          notes: '',
        });
        setSelectedAnticoagulants([]);
        setUploadedFiles([]);
        setSampleEntries([]);
        setShowSampleTable(false);
      }
    } catch (error: unknown) {
      const err = error as { response?: { status: number }; isAuthError?: boolean };
      if (err?.response?.status !== 401 && !err?.isAuthError) {
        toast.error('操作失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getAnticoagulantLabel = (value: string): string => {
    const found = matrixTypes.anticoagulants.find(a => a.value === value);
    return found?.label || value;
  };

  return (
    <div className="space-y-6">
      {/* 表单 */}
      {!showSampleTable && (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">
            {/* 来源信息 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                来源信息
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    来源名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.source_name}
                    onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
                    placeholder="输入来源名称"
                    disabled={!selectedProjectId}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    联系人
                  </label>
                  <Input
                    value={formData.source_contact}
                    onChange={(e) => setFormData({ ...formData, source_contact: e.target.value })}
                    placeholder="输入联系人"
                    disabled={!selectedProjectId}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    联系电话
                  </label>
                  <Input
                    value={formData.source_phone}
                    onChange={(e) => setFormData({ ...formData, source_phone: e.target.value })}
                    placeholder="输入联系电话"
                    disabled={!selectedProjectId}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 文件上传 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                暂存文件上传
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 知情同意书 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    知情同意书
                  </label>
                  <label className={!selectedProjectId ? "cursor-not-allowed" : "cursor-pointer"}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'consent')}
                      className="hidden"
                      disabled={!selectedProjectId}
                    />
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm hover:bg-zinc-50 transition-colors">
                      <CloudArrowUpIcon className="w-4 h-4 text-zinc-500" />
                      上传文件
                    </div>
                  </label>
                  {getFilesByType('consent').length > 0 && (
                    <div className="mt-2 space-y-1">
                      {getFilesByType('consent').map(f => (
                        <div key={f.id} className="flex items-center gap-2 text-sm">
                          <span className="truncate max-w-[150px]">{f.file.name}</span>
                          <button onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 伦理批件 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    伦理批件
                  </label>
                  <label className={!selectedProjectId ? "cursor-not-allowed" : "cursor-pointer"}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'ethics')}
                      className="hidden"
                      disabled={!selectedProjectId}
                    />
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm hover:bg-zinc-50 transition-colors">
                      <CloudArrowUpIcon className="w-4 h-4 text-zinc-500" />
                      上传文件
                    </div>
                  </label>
                  {getFilesByType('ethics').length > 0 && (
                    <div className="mt-2 space-y-1">
                      {getFilesByType('ethics').map(f => (
                        <div key={f.id} className="flex items-center gap-2 text-sm">
                          <span className="truncate max-w-[150px]">{f.file.name}</span>
                          <button onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 体检报告 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    体检报告扫描件
                  </label>
                  <label className={!selectedProjectId ? "cursor-not-allowed" : "cursor-pointer"}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => handleFileUpload(e, 'medical')}
                      className="hidden"
                      disabled={!selectedProjectId}
                    />
                    <div className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm hover:bg-zinc-50 transition-colors">
                      <CloudArrowUpIcon className="w-4 h-4 text-zinc-500" />
                      上传文件
                    </div>
                  </label>
                  {getFilesByType('medical').length > 0 && (
                    <div className="mt-2 space-y-1">
                      {getFilesByType('medical').map(f => (
                        <div key={f.id} className="flex items-center gap-2 text-sm">
                          <span className="truncate max-w-[150px]">{f.file.name}</span>
                          <button onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 基质类型选择 */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                基质类型
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 抗凝剂类型（复选框） */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">
                    抗凝剂类型 <span className="text-red-500">*</span>
                  </label>
                  <CheckboxGroup>
                    <div className="flex flex-wrap gap-4">
                      {matrixTypes.anticoagulants.map((option) => (
                        <CheckboxField key={option.value}>
                          <Checkbox
                            checked={selectedAnticoagulants.includes(option.value)}
                            onChange={(checked) => handleAnticoagulantChange(option.value, checked)}
                            disabled={!selectedProjectId}
                          />
                          <Label>{option.label}</Label>
                        </CheckboxField>
                      ))}
                    </div>
                  </CheckboxGroup>
                </div>

                {/* 基质类型（下拉菜单） */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    基质类型 <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={formData.matrix_type}
                    onChange={(e) => setFormData({ ...formData, matrix_type: e.target.value })}
                    disabled={!selectedProjectId}
                  >
                    <option value="">请选择基质类型</option>
                    {matrixTypes.matrix_types.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  {formData.matrix_type === 'other' && (
                    <div className="mt-2">
                      <Input
                        value={formData.matrix_type_other}
                        onChange={(e) => setFormData({ ...formData, matrix_type_other: e.target.value })}
                        placeholder="请输入其它基质类型"
                        disabled={!selectedProjectId}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100"></div>

            {/* 备注 */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                备注
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="输入备注信息"
                rows={3}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={!selectedProjectId}
              />
            </div>
          </div>

          {/* 底部操作 */}
          <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end">
            <Button
              onClick={handleConfirm}
              disabled={!selectedProjectId}
            >
              确认并添加样本
            </Button>
          </div>
        </div>
      )}

      {/* 样本表格 */}
      {showSampleTable && (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-zinc-900">样本信息</h3>
              <Button plain onClick={addSampleEntry}>
                <PlusIcon className="w-4 h-4 mr-1" />
                添加条目
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">序号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">编号</th>
                    {selectedAnticoagulants.includes('EDTA') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">EDTA(mL)</th>
                    )}
                    {selectedAnticoagulants.includes('heparin_sodium') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">肝素钠(mL)</th>
                    )}
                    {selectedAnticoagulants.includes('sodium_citrate') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">枸橼酸钠(mL)</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">特殊事项</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-200">
                  {sampleEntries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-sm text-zinc-900">{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        <Text className="text-xs text-zinc-400">待生成</Text>
                      </td>
                      {selectedAnticoagulants.includes('EDTA') && (
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={entry.edta_volume}
                            onChange={(e) => updateSampleEntry(entry.id, 'edta_volume', e.target.value)}
                            className="w-20"
                            placeholder="0.0"
                          />
                        </td>
                      )}
                      {selectedAnticoagulants.includes('heparin_sodium') && (
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={entry.heparin_volume}
                            onChange={(e) => updateSampleEntry(entry.id, 'heparin_volume', e.target.value)}
                            className="w-20"
                            placeholder="0.0"
                          />
                        </td>
                      )}
                      {selectedAnticoagulants.includes('sodium_citrate') && (
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={entry.citrate_volume}
                            onChange={(e) => updateSampleEntry(entry.id, 'citrate_volume', e.target.value)}
                            className="w-20"
                            placeholder="0.0"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Input
                          value={entry.special_notes}
                          onChange={(e) => updateSampleEntry(entry.id, 'special_notes', e.target.value)}
                          className="w-32"
                          placeholder="输入特殊事项"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeSampleEntry(entry.id)}
                          className="text-red-500 hover:text-red-700"
                          disabled={sampleEntries.length === 1}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex items-center justify-between">
            <Button plain onClick={() => setShowSampleTable(false)}>
              返回修改
            </Button>
            <div className="flex gap-3">
              <Button
                plain
                onClick={() => handleSubmit(false)}
                disabled={submitting}
              >
                {submitting ? '处理中...' : '暂存'}
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
              >
                {submitting ? '处理中...' : '入库'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
