import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Text } from '@/components/text';
import { Badge } from '@/components/badge';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/20/solid';
import { toast } from 'react-hot-toast';
import { useProjectStore } from '@/store/project';
import {
  BlankMatrixService,
  BlankMatrixReceiveRecord,
  MatrixTypesResponse,
} from '@/services/blank-matrix.service';

interface SampleEntry {
  id: string;
  sample_code: string;
  anticoagulant: string;
  edta_volume: string;
  heparin_volume: string;
  citrate_volume: string;
  special_notes: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge color="yellow">待清点</Badge>;
    case 'in_progress':
      return <Badge color="blue">清点中</Badge>;
    case 'completed':
      return <Badge color="green">已完成</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

export default function BlankMatrixInventory() {
  const { projects, selectedProjectId, fetchProjects } = useProjectStore();
  const currentProject = projects.find(p => p.id === selectedProjectId);

  const [receiveTasks, setReceiveTasks] = useState<BlankMatrixReceiveRecord[]>([]);
  const [selectedTask, setSelectedTask] = useState<BlankMatrixReceiveRecord | null>(null);
  const [sampleEntries, setSampleEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [matrixTypes, setMatrixTypes] = useState<MatrixTypesResponse>({
    anticoagulants: [],
    matrix_types: [],
  });

  const loadReceiveTasks = useCallback(async () => {
    setLoading(true);
    try {
      const tasks = await BlankMatrixService.getReceiveTasks({
        project_id: selectedProjectId || undefined,
      });
      setReceiveTasks(tasks);
    } catch (error: unknown) {
      const err = error as { response?: { status: number }; isAuthError?: boolean };
      if (err?.response?.status !== 401 && !err?.isAuthError) {
        toast.error('加载接收任务失败');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

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

  useEffect(() => {
    loadReceiveTasks();
  }, [loadReceiveTasks]);

  const handleTaskSelect = async (task: BlankMatrixReceiveRecord) => {
    try {
      const detail = await BlankMatrixService.getReceiveRecord(task.id);
      setSelectedTask(detail);

      // 如果已有样本数据，加载它们
      if (detail.samples && detail.samples.length > 0) {
        setSampleEntries(detail.samples.map(s => ({
          id: generateId(),
          sample_code: s.sample_code,
          anticoagulant: s.anticoagulant || '',
          edta_volume: s.edta_volume?.toString() || '',
          heparin_volume: s.heparin_volume?.toString() || '',
          citrate_volume: s.citrate_volume?.toString() || '',
          special_notes: s.special_notes || '',
        })));
      } else {
        // 创建一条初始记录
        addSampleEntry(detail.anticoagulants[0] || '');
      }
    } catch (error: unknown) {
      const err = error as { response?: { status: number }; isAuthError?: boolean };
      if (err?.response?.status !== 401 && !err?.isAuthError) {
        toast.error('加载任务详情失败');
      }
    }
  };

  const addSampleEntry = (defaultAnticoagulant?: string) => {
    const anticoagulant = defaultAnticoagulant || selectedTask?.anticoagulants?.[0] || '';
    const newEntry: SampleEntry = {
      id: generateId(),
      sample_code: '',
      anticoagulant,
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
    if (sampleEntries.length > 1) {
      setSampleEntries(sampleEntries.filter(entry => entry.id !== id));
    }
  };

  const handleSubmit = async (isFinal: boolean) => {
    if (!selectedTask) {
      toast.error('请先选择接收任务');
      return;
    }

    if (sampleEntries.length === 0) {
      toast.error('请添加至少一条样本信息');
      return;
    }

    setSubmitting(true);
    try {
      // 生成编号
      const projectCode = currentProject?.lab_project_code || selectedTask.project_name || 'UNK';
      const anticoagulant = selectedTask.anticoagulants[0] || 'EDTA';

      const generateResult = await BlankMatrixService.generateCodes({
        project_code: projectCode,
        anticoagulant,
        count: sampleEntries.length,
      });

      const inventoryData = {
        receive_record_id: selectedTask.id,
        samples: sampleEntries.map((entry, index) => ({
          sample_code: entry.sample_code || generateResult.codes[index] || `${projectCode}-BP-TEMP-${index + 1}`,
          anticoagulant: entry.anticoagulant,
          edta_volume: entry.edta_volume ? parseFloat(entry.edta_volume) : undefined,
          heparin_volume: entry.heparin_volume ? parseFloat(entry.heparin_volume) : undefined,
          citrate_volume: entry.citrate_volume ? parseFloat(entry.citrate_volume) : undefined,
          special_notes: entry.special_notes,
        })),
        is_final: isFinal,
      };

      await BlankMatrixService.inventory(inventoryData);

      toast.success(isFinal ? '空白基质入库成功' : '空白基质暂存成功');

      // 重新加载任务列表
      loadReceiveTasks();
      setSelectedTask(null);
      setSampleEntries([]);
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

  const getMatrixTypeLabel = (value: string): string => {
    const found = matrixTypes.matrix_types.find(m => m.value === value);
    return found?.label || value;
  };

  const pendingTasks = receiveTasks.filter(t => t.status !== 'completed');
  const completedTasks = receiveTasks.filter(t => t.status === 'completed');

  if (selectedTask) {
    return (
      <div className="space-y-6">
        {/* 任务信息 */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-zinc-900">任务信息</h3>
            <Button plain onClick={() => { setSelectedTask(null); setSampleEntries([]); }}>
              返回列表
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Text className="text-zinc-500">项目</Text>
              <Text className="font-medium">{selectedTask.project_name}</Text>
            </div>
            <div>
              <Text className="text-zinc-500">来源</Text>
              <Text className="font-medium">{selectedTask.source_name}</Text>
            </div>
            <div>
              <Text className="text-zinc-500">基质类型</Text>
              <Text className="font-medium">{getMatrixTypeLabel(selectedTask.matrix_type)}</Text>
            </div>
            <div>
              <Text className="text-zinc-500">抗凝剂</Text>
              <Text className="font-medium">
                {selectedTask.anticoagulants.map(a => getAnticoagulantLabel(a)).join(', ')}
              </Text>
            </div>
          </div>
        </div>

        {/* 样本表格 */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-zinc-900">样本清点</h3>
              <Button plain onClick={() => addSampleEntry()}>
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
                    {selectedTask.anticoagulants.includes('EDTA') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">EDTA(mL)</th>
                    )}
                    {selectedTask.anticoagulants.includes('heparin_sodium') && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">肝素钠(mL)</th>
                    )}
                    {selectedTask.anticoagulants.includes('sodium_citrate') && (
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
                      <td className="px-4 py-3 text-sm">
                        {entry.sample_code ? (
                          <Text className="font-mono">{entry.sample_code}</Text>
                        ) : (
                          <Text className="text-xs text-zinc-400">待生成</Text>
                        )}
                      </td>
                      {selectedTask.anticoagulants.includes('EDTA') && (
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
                      {selectedTask.anticoagulants.includes('heparin_sodium') && (
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
                      {selectedTask.anticoagulants.includes('sodium_citrate') && (
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
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
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
          <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
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
    );
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardDocumentListIcon className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="text-gray-500">暂无待清点的空白基质</Text>
          <Text className="text-sm text-gray-400 mt-1">请先在接收页面提交空白基质接收记录</Text>
        </div>
      ) : (
        <>
          {/* 待处理任务 */}
          {pendingTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-500 mb-3">待清点 ({pendingTasks.length})</h3>
              <div className="space-y-3">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-zinc-200 overflow-hidden hover:border-blue-300 transition-colors"
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <Text className="font-medium">{task.source_name}</Text>
                            <Text className="text-sm text-zinc-500">{task.project_name}</Text>
                          </div>
                          {getStatusBadge(task.status)}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right text-sm">
                            <Text className="text-zinc-500">
                              {new Date(task.received_at).toLocaleDateString()}
                            </Text>
                            <Text className="text-zinc-400">{task.received_by_name}</Text>
                          </div>
                          {expandedTaskId === task.id ? (
                            <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedTaskId === task.id && (
                      <div className="px-4 pb-4 border-t border-zinc-100 pt-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                          <div>
                            <Text className="text-zinc-500">基质类型</Text>
                            <Text>{getMatrixTypeLabel(task.matrix_type)}</Text>
                          </div>
                          <div>
                            <Text className="text-zinc-500">抗凝剂</Text>
                            <Text>{task.anticoagulants.map(a => getAnticoagulantLabel(a)).join(', ')}</Text>
                          </div>
                          <div>
                            <Text className="text-zinc-500">联系人</Text>
                            <Text>{task.source_contact || '-'}</Text>
                          </div>
                          <div>
                            <Text className="text-zinc-500">联系电话</Text>
                            <Text>{task.source_phone || '-'}</Text>
                          </div>
                        </div>
                        <Button onClick={() => handleTaskSelect(task)}>
                          开始清点
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 已完成任务 */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-500 mb-3">已完成 ({completedTasks.length})</h3>
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-xl border border-zinc-200 p-4 opacity-75"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <Text className="font-medium">{task.source_name}</Text>
                          <Text className="text-sm text-zinc-500">{task.project_name}</Text>
                        </div>
                        {getStatusBadge(task.status)}
                      </div>
                      <div className="text-right text-sm">
                        <Text className="text-zinc-500">
                          {new Date(task.received_at).toLocaleDateString()}
                        </Text>
                        <Text className="text-zinc-400">已入库 {task.sample_count} 份</Text>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
