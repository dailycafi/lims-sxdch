import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Textarea } from '@/components/textarea';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilSquareIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon
} from '@heroicons/react/20/solid';
import { testGroupsAPI, TestGroup, TestGroupCreate, CollectionPointItem, DetectionConfigItem } from '@/services/test-groups.service';
import { api } from '@/lib/api';

interface TestGroupManagerProps {
  projectId: number;
  isArchived?: boolean;
}

interface GlobalParams {
  cycles: string[];
  test_types: string[];
  sample_types: string[];
}

export function TestGroupManager({ projectId, isArchived = false }: TestGroupManagerProps) {
  const [testGroups, setTestGroups] = useState<TestGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCollectionPointDialogOpen, setIsCollectionPointDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSubjectsDialogOpen, setIsSubjectsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TestGroup | null>(null);
  const [confirmingGroupId, setConfirmingGroupId] = useState<number | null>(null);
  const [viewingSubjects, setViewingSubjects] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<number[]>([]);
  
  // 全局参数（从项目配置中获取）
  const [globalParams, setGlobalParams] = useState<GlobalParams>({
    cycles: [],
    test_types: [],
    sample_types: [],
  });

  // 表单数据
  const [form, setForm] = useState<TestGroupCreate>({
    project_id: projectId,
    name: '',
    cycle: '',
    dosage: '',
    planned_count: 0,
    backup_count: 0,
    subject_prefix: '',
    subject_start_number: 1,
    detection_configs: [],
    collection_points: [],
  });

  // 检测配置表单
  const [detectionConfigs, setDetectionConfigs] = useState<DetectionConfigItem[]>([]);
  const [newDetection, setNewDetection] = useState<DetectionConfigItem>({
    test_type: '',
    sample_type: '',
    primary_sets: 1,
    backup_sets: 0,
  });
  const [isDetectionDialogOpen, setIsDetectionDialogOpen] = useState(false);

  // 采集点表单
  const [collectionPoints, setCollectionPoints] = useState<CollectionPointItem[]>([]);
  const [newPoint, setNewPoint] = useState({ code: '', name: '' });

  // 审计理由
  const [auditReason, setAuditReason] = useState('');

  useEffect(() => {
    fetchTestGroups();
    fetchGlobalParams();
  }, [projectId]);

  const fetchTestGroups = async () => {
    setLoading(true);
    try {
      const data = await testGroupsAPI.getTestGroups(projectId);
      setTestGroups(data);
    } catch (error) {
      console.error('Failed to fetch test groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalParams = async () => {
    try {
      // 从项目配置中获取选项
      const response = await api.get(`/projects/${projectId}`);
      const project = response.data;
      if (project.sample_code_rule?.dictionaries) {
        const dict = project.sample_code_rule.dictionaries;
        setGlobalParams({
          cycles: dict.cycles || [],
          test_types: dict.test_types || [],
          sample_types: [], // 可以从全局参数获取
        });
      }
      
      // 获取全局样本类型
      const sampleTypesRes = await api.get('/global-params/sample-types?category=clinical');
      if (sampleTypesRes.data) {
        const types = sampleTypesRes.data.map((st: any) => st.test_type).filter(Boolean);
        setGlobalParams(prev => ({
          ...prev,
          sample_types: Array.from(new Set(types)) as string[],
        }));
      }
    } catch (error) {
      console.error('Failed to fetch global params:', error);
    }
  };

  const resetForm = () => {
    setForm({
      project_id: projectId,
      name: '',
      cycle: '',
      dosage: '',
      planned_count: 0,
      backup_count: 0,
      subject_prefix: '',
      subject_start_number: 1,
      detection_configs: [],
      collection_points: [],
    });
    setDetectionConfigs([]);
    setCollectionPoints([]);
    setAuditReason('');
    setEditingGroup(null);
  };

  const openDialog = (group?: TestGroup) => {
    if (group) {
      setEditingGroup(group);
      setForm({
        project_id: projectId,
        name: group.name || '',
        cycle: group.cycle || '',
        dosage: group.dosage || '',
        planned_count: group.planned_count,
        backup_count: group.backup_count,
        subject_prefix: group.subject_prefix || '',
        subject_start_number: group.subject_start_number || 1,
        detection_configs: group.detection_configs || [],
        collection_points: group.collection_points || [],
      });
      setDetectionConfigs(group.detection_configs || []);
      setCollectionPoints(group.collection_points || []);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    // 验证必填字段
    if (!form.cycle) {
      toast.error('请选择周期');
      return;
    }

    try {
      const submitData = {
        ...form,
        detection_configs: detectionConfigs,
        collection_points: collectionPoints,
      };

      if (editingGroup) {
        if (!auditReason.trim()) {
          toast.error('请输入修改理由');
          return;
        }
        await testGroupsAPI.updateTestGroup(editingGroup.id, {
          ...submitData,
          audit_reason: auditReason.trim(),
        });
        toast.success('试验组更新成功');
      } else {
        await testGroupsAPI.createTestGroup(submitData);
        toast.success('试验组创建成功');
      }
      closeDialog();
      fetchTestGroups();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '操作失败');
    }
  };

  const handleDelete = async (groupId: number) => {
    if (!confirm('确定要删除此试验组吗？')) return;
    try {
      await testGroupsAPI.deleteTestGroup(groupId);
      toast.success('试验组已删除');
      fetchTestGroups();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '删除失败');
    }
  };

  const handleCopy = async (group: TestGroup) => {
    try {
      await testGroupsAPI.copyTestGroup(group.id, `${group.name || '试验组'} (副本)`);
      toast.success('试验组复制成功');
      fetchTestGroups();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '复制失败');
    }
  };

  const handleConfirm = async (password: string, reason: string) => {
    if (!confirmingGroupId) return;
    try {
      await testGroupsAPI.confirmTestGroup(confirmingGroupId, password, reason);
      toast.success('试验组已确认并锁定');
      setIsConfirmDialogOpen(false);
      setConfirmingGroupId(null);
      fetchTestGroups();
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('密码验证失败');
      }
      throw new Error(error.response?.data?.detail || '确认失败');
    }
  };

  const openConfirmDialog = (groupId: number) => {
    setConfirmingGroupId(groupId);
    setIsConfirmDialogOpen(true);
  };

  const viewSubjects = (group: TestGroup) => {
    setViewingSubjects(group.generated_subjects || []);
    setIsSubjectsDialogOpen(true);
  };

  const toggleExpand = (groupId: number) => {
    setExpandedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const addCollectionPoint = () => {
    if (!newPoint.code.trim() || !newPoint.name.trim()) {
      toast.error('请输入采集点代码和名称');
      return;
    }
    setCollectionPoints([...collectionPoints, { ...newPoint }]);
    setNewPoint({ code: '', name: '' });
  };

  const removeCollectionPoint = (index: number) => {
    setCollectionPoints(collectionPoints.filter((_, i) => i !== index));
  };

  // 检测配置管理
  const addDetectionConfig = () => {
    if (!newDetection.test_type.trim()) {
      toast.error('请选择检测类型');
      return;
    }
    setDetectionConfigs([...detectionConfigs, { ...newDetection }]);
    setNewDetection({
      test_type: '',
      sample_type: '',
      primary_sets: 1,
      backup_sets: 0,
    });
  };

  const removeDetectionConfig = (index: number) => {
    setDetectionConfigs(detectionConfigs.filter((_, i) => i !== index));
  };

  const updateDetectionConfig = (index: number, field: keyof DetectionConfigItem, value: any) => {
    const updated = [...detectionConfigs];
    updated[index] = { ...updated[index], [field]: value };
    setDetectionConfigs(updated);
  };

  // 生成受试者编号预览
  const generateSubjectPreview = () => {
    const plannedCount = form.planned_count || 0;
    const backupCount = form.backup_count || 0;
    if (!form.subject_prefix || plannedCount <= 0) return [];
    const subjects = [];
    const total = Math.min(plannedCount + backupCount, 10);
    for (let i = 0; i < total; i++) {
      const num = (form.subject_start_number || 1) + i;
      subjects.push(`${form.subject_prefix}${num.toString().padStart(3, '0')}`);
    }
    return subjects;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Text>加载中...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <Text className="text-lg font-semibold text-zinc-900">临床试验信息</Text>
          <Text className="text-sm text-zinc-500 mt-1">
            管理项目的试验组配置，包括周期、剂量、受试者编号规则和采集点
          </Text>
        </div>
        {!isArchived && (
          <Button onClick={() => openDialog()}>
            <PlusIcon className="w-4 h-4" />
            添加试验组
          </Button>
        )}
      </div>

      {/* 试验组列表 */}
      {testGroups.length === 0 ? (
        <div className="bg-zinc-50 rounded-lg p-8 text-center">
          <Text className="text-zinc-500">暂无试验组配置</Text>
          {!isArchived && (
            <Button outline className="mt-4" onClick={() => openDialog()}>
              <PlusIcon className="w-4 h-4" />
              添加第一个试验组
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {testGroups.map((group) => (
            <div
              key={group.id}
              className={`bg-white rounded-lg border ${group.is_confirmed ? 'border-green-200' : 'border-zinc-200'} overflow-hidden`}
            >
              {/* 试验组头部 */}
              <div
                className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-50 ${group.is_confirmed ? 'bg-green-50/50' : ''}`}
                onClick={() => toggleExpand(group.id)}
              >
                <div className="flex items-center gap-4">
                  <button className="text-zinc-400">
                    {expandedGroups.includes(group.id) ? (
                      <ChevronUpIcon className="w-5 h-5" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5" />
                    )}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <Text className="font-semibold text-zinc-900">
                        {group.name || `试验组 ${group.id}`}
                      </Text>
                      {group.is_confirmed && (
                        <Badge color="green" className="flex items-center gap-1">
                          <LockClosedIcon className="w-3 h-3" />
                          已确认
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500">
                      <span>周期: {group.cycle || '-'}</span>
                      <span>剂量: {group.dosage || '-'}</span>
                      <span>计划例数: {group.planned_count}</span>
                      <span>备份例数: {group.backup_count}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {group.generated_subjects && group.generated_subjects.length > 0 && (
                    <Button plain onClick={() => viewSubjects(group)} title="查看受试者编号">
                      <EyeIcon className="w-4 h-4" />
                    </Button>
                  )}
                  {!isArchived && !group.is_confirmed && (
                    <>
                      <Button plain onClick={() => openDialog(group)} title="编辑">
                        <PencilSquareIcon className="w-4 h-4" />
                      </Button>
                      <Button plain onClick={() => handleCopy(group)} title="复制">
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      </Button>
                      <Button plain onClick={() => openConfirmDialog(group.id)} title="确认锁定">
                        <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button plain onClick={() => handleDelete(group.id)} title="删除">
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* 展开的详细信息 */}
              {expandedGroups.includes(group.id) && (
                <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <Text className="text-xs font-medium text-zinc-500 uppercase">受试者编号规则</Text>
                      <Text className="mt-1 text-sm text-zinc-900">
                        前缀: {group.subject_prefix || '-'}, 起始: {group.subject_start_number || 1}
                      </Text>
                    </div>
                  </div>

                  {/* 检测配置列表 */}
                  {group.detection_configs && group.detection_configs.length > 0 && (
                    <div className="mt-4">
                      <Text className="text-xs font-medium text-zinc-500 uppercase mb-2">检测配置</Text>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-50">
                              <th className="px-3 py-2 text-left font-medium text-zinc-600">检测类型</th>
                              <th className="px-3 py-2 text-left font-medium text-zinc-600">样本类型</th>
                              <th className="px-3 py-2 text-left font-medium text-zinc-600">正份套数</th>
                              <th className="px-3 py-2 text-left font-medium text-zinc-600">备份套数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.detection_configs.map((config, idx) => (
                              <tr key={idx} className="border-t border-zinc-100">
                                <td className="px-3 py-2">{config.test_type}</td>
                                <td className="px-3 py-2">{config.sample_type || '-'}</td>
                                <td className="px-3 py-2">{config.primary_sets}</td>
                                <td className="px-3 py-2">{config.backup_sets}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 采集点 */}
                  {group.collection_points && group.collection_points.length > 0 && (
                    <div className="mt-4">
                      <Text className="text-xs font-medium text-zinc-500 uppercase mb-2">采集点</Text>
                      <div className="flex flex-wrap gap-2">
                        {group.collection_points.map((point, index) => (
                          <Badge key={index} color="blue">
                            {point.code}: {point.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑试验组对话框 */}
      <Dialog open={isDialogOpen} onClose={closeDialog} size="2xl">
        <DialogTitle>{editingGroup ? '编辑试验组' : '添加试验组'}</DialogTitle>
        <DialogDescription>
          {editingGroup ? '修改试验组配置信息' : '配置新的试验组参数'}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  试验组名称
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：A组、低剂量组"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  周期 <span className="text-red-500">*</span>
                </label>
                {globalParams.cycles.length > 0 ? (
                  <Select
                    value={form.cycle}
                    onChange={(e) => setForm({ ...form, cycle: e.target.value })}
                  >
                    <option value="">请选择</option>
                    {globalParams.cycles.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={form.cycle}
                    onChange={(e) => setForm({ ...form, cycle: e.target.value })}
                    placeholder="输入周期"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  剂量
                </label>
                <Input
                  value={form.dosage}
                  onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                  placeholder="如：100mg、200mg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    计划例数
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.planned_count}
                    onChange={(e) => setForm({ ...form, planned_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    备份例数
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.backup_count}
                    onChange={(e) => setForm({ ...form, backup_count: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* 受试者编号规则 */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
              <Text className="font-medium text-zinc-900 mb-3">受试者编号规则</Text>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    编号前缀（第一部分）
                  </label>
                  <Input
                    value={form.subject_prefix}
                    onChange={(e) => setForm({ ...form, subject_prefix: e.target.value.toUpperCase() })}
                    placeholder="如：R"
                    maxLength={10}
                  />
                  <Text className="text-xs text-zinc-500 mt-1">所有受试者都使用这个前缀</Text>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    起始编号（第二部分）
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={form.subject_start_number}
                    onChange={(e) => setForm({ ...form, subject_start_number: parseInt(e.target.value) || 1 })}
                    placeholder="如：1"
                  />
                  <Text className="text-xs text-zinc-500 mt-1">后续编号依次递增</Text>
                </div>
              </div>
              {/* 编号预览 */}
              {form.subject_prefix && (form.planned_count || 0) > 0 && (
                <div className="mt-3 p-3 bg-white rounded border border-zinc-200">
                  <Text className="text-xs font-medium text-zinc-500 mb-2">编号预览：</Text>
                  <div className="flex flex-wrap gap-2">
                    {generateSubjectPreview().map((s, i) => (
                      <Badge key={i} color={i < (form.planned_count || 0) ? 'blue' : 'amber'}>
                        {s}
                      </Badge>
                    ))}
                    {(form.planned_count || 0) + (form.backup_count || 0) > 10 && (
                      <Badge color="zinc">...</Badge>
                    )}
                  </div>
                  <Text className="text-xs text-zinc-500 mt-2">
                    蓝色为计划例数，橙色为备份例数
                  </Text>
                </div>
              )}
            </div>

            {/* 检测配置（多检测类型） */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
              <div className="flex items-center justify-between mb-3">
                <Text className="font-medium text-zinc-900">检测配置（支持多个检测类型）</Text>
                <Button outline onClick={() => setIsDetectionDialogOpen(true)}>
                  <PlusIcon className="w-4 h-4" />
                  添加检测类型
                </Button>
              </div>
              {detectionConfigs.length === 0 ? (
                <Text className="text-sm text-zinc-500">暂无检测配置，点击上方按钮添加</Text>
              ) : (
                <Table bleed>
                  <TableHead>
                    <TableRow>
                      <TableHeader>检测类型</TableHeader>
                      <TableHeader>样本类型</TableHeader>
                      <TableHeader>正份套数</TableHeader>
                      <TableHeader>备份套数</TableHeader>
                      <TableHeader className="w-20">操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detectionConfigs.map((config, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{config.test_type}</TableCell>
                        <TableCell>{config.sample_type || '-'}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={config.primary_sets}
                            onChange={(e) => updateDetectionConfig(index, 'primary_sets', parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={config.backup_sets}
                            onChange={(e) => updateDetectionConfig(index, 'backup_sets', parseInt(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button plain onClick={() => removeDetectionConfig(index)}>
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* 采集点配置 */}
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
              <div className="flex items-center justify-between mb-3">
                <Text className="font-medium text-zinc-900">采集点配置</Text>
                <Button outline onClick={() => setIsCollectionPointDialogOpen(true)}>
                  <PlusIcon className="w-4 h-4" />
                  添加采集点
                </Button>
              </div>
              {collectionPoints.length === 0 ? (
                <Text className="text-sm text-zinc-500">暂无采集点，点击上方按钮添加</Text>
              ) : (
                <Table bleed>
                  <TableHead>
                    <TableRow>
                      <TableHeader>采集点</TableHeader>
                      <TableHeader>采集点名称</TableHeader>
                      <TableHeader className="w-20">操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {collectionPoints.map((point, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{point.code}</TableCell>
                        <TableCell>{point.name}</TableCell>
                        <TableCell>
                          <Button plain onClick={() => removeCollectionPoint(index)}>
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* 编辑时需要填写理由 */}
            {editingGroup && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  修改理由 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="请输入修改理由"
                  rows={2}
                />
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={closeDialog}>取消</Button>
          <Button onClick={handleSubmit}>
            {editingGroup ? '保存修改' : '创建试验组'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 添加检测配置对话框 */}
      <Dialog open={isDetectionDialogOpen} onClose={() => setIsDetectionDialogOpen(false)}>
        <DialogTitle>添加检测类型</DialogTitle>
        <DialogDescription>配置检测类型、样本类型和套数</DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                检测类型 <span className="text-red-500">*</span>
              </label>
              {globalParams.test_types.length > 0 ? (
                <Select
                  value={newDetection.test_type}
                  onChange={(e) => setNewDetection({ ...newDetection, test_type: e.target.value })}
                >
                  <option value="">请选择</option>
                  {globalParams.test_types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={newDetection.test_type}
                  onChange={(e) => setNewDetection({ ...newDetection, test_type: e.target.value })}
                  placeholder="如：PK、ADA、Nab"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                样本类型
              </label>
              <Input
                value={newDetection.sample_type || ''}
                onChange={(e) => setNewDetection({ ...newDetection, sample_type: e.target.value })}
                placeholder="如：血浆、血清"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  正份套数
                </label>
                <Input
                  type="number"
                  min={0}
                  value={newDetection.primary_sets}
                  onChange={(e) => setNewDetection({ ...newDetection, primary_sets: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  备份套数
                </label>
                <Input
                  type="number"
                  min={0}
                  value={newDetection.backup_sets}
                  onChange={(e) => setNewDetection({ ...newDetection, backup_sets: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsDetectionDialogOpen(false)}>取消</Button>
          <Button onClick={() => { addDetectionConfig(); setIsDetectionDialogOpen(false); }}>
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 添加采集点对话框 */}
      <Dialog open={isCollectionPointDialogOpen} onClose={() => setIsCollectionPointDialogOpen(false)}>
        <DialogTitle>添加采集点</DialogTitle>
        <DialogDescription>输入采集点代码和名称</DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                采集点代码 <span className="text-red-500">*</span>
              </label>
              <Input
                value={newPoint.code}
                onChange={(e) => setNewPoint({ ...newPoint, code: e.target.value.toUpperCase() })}
                placeholder="如：C1、C2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                采集点名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={newPoint.name}
                onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                placeholder="如：D1-0h、D1-1h"
              />
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsCollectionPointDialogOpen(false)}>取消</Button>
          <Button onClick={() => { addCollectionPoint(); setIsCollectionPointDialogOpen(false); }}>
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 确认试验组对话框 */}
      <ESignatureDialog
        open={isConfirmDialogOpen}
        onClose={() => { setIsConfirmDialogOpen(false); setConfirmingGroupId(null); }}
        onConfirm={handleConfirm}
        title="确认试验组"
        description="确认后试验组将被锁定，无法再修改。此操作将被记录在审计日志中。"
        requireReason={false}
        actionType="approve"
      />

      {/* 查看受试者编号对话框 */}
      <Dialog open={isSubjectsDialogOpen} onClose={() => setIsSubjectsDialogOpen(false)}>
        <DialogTitle>受试者编号列表</DialogTitle>
        <DialogDescription>共 {viewingSubjects.length} 个受试者编号</DialogDescription>
        <DialogBody>
          <div className="max-h-96 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {viewingSubjects.map((subject, index) => (
                <Badge key={index} color="blue">{subject}</Badge>
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button onClick={() => setIsSubjectsDialogOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
