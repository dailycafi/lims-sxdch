import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Textarea } from '@/components/textarea';
import { Tabs } from '@/components/tabs';
import { api } from '@/lib/api';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon, BeakerIcon } from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { AnimatePresence } from 'framer-motion';

interface Organization {
  id: number;
  name: string;
  org_type: string;
  address?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SampleType {
  id: number;
  category?: string;
  code?: string;
  cycle_group?: string;
  test_type?: string;
  primary_count: number;
  backup_count: number;
  purpose?: string;
  transport_method?: string;
  status?: string;
  special_notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const orgTypes = [
  { value: 'sponsor', label: '申办方' },
  { value: 'clinical', label: '临床机构' },
  { value: 'testing', label: '检测单位' },
  { value: 'transport', label: '运输单位' },
];

type TabType = 'organizations' | 'clinical-samples' | 'qc-stability-samples';

export default function GlobalParamsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [clinicalSamples, setClinicalSamples] = useState<SampleType[]>([]);
  const [qcSamples, setQcSamples] = useState<SampleType[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isClinicalDialogOpen, setIsClinicalDialogOpen] = useState(false);
  const [isQCDialogOpen, setIsQCDialogOpen] = useState(false);
  
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editingSampleType, setEditingSampleType] = useState<SampleType | null>(null);
  const [selectedOrgType, setSelectedOrgType] = useState('all');
  
  // 组织表单数据
  const [orgForm, setOrgForm] = useState({
    name: '',
    org_type: '',
    address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
  });

  // 临床样本表单数据
  const [clinicalForm, setClinicalForm] = useState({
    cycle_group: '',
    test_type: '',
    primary_count: 1,
    backup_count: 1,
    purpose: '',
    transport_method: '',
    status: '',
    special_notes: '',
  });

  // 稳定性及质控样本表单数据
  const [qcForm, setQCForm] = useState({
    test_type: '', // 检测类型 (STB/QC)
    code: '',      // 代码
    special_notes: '',
  });

  // 审计理由
  const [auditReason, setAuditReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgsRes, sampleTypesRes] = await Promise.all([
        api.get('/global-params/organizations'),
        api.get('/global-params/sample-types'),
      ]);
      setOrganizations(orgsRes.data);
      
      const allSamples = sampleTypesRes.data as SampleType[];
      setClinicalSamples(allSamples.filter(s => s.category === 'clinical' || !s.category));
      setQcSamples(allSamples.filter(s => s.category === 'qc_stability'));
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- 组织管理 ---
  const handleCreateOrg = async () => {
    try {
      await api.post('/global-params/organizations', orgForm);
      setIsOrgDialogOpen(false);
      resetOrgForm();
      fetchData();
    } catch (error) {
      console.error('Failed to create organization:', error);
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg) return;
    try {
      await api.put(`/global-params/organizations/${editingOrg.id}`, {
        ...orgForm,
        audit_reason: auditReason,
      });
      setIsOrgDialogOpen(false);
      resetOrgForm();
      fetchData();
    } catch (error) {
      console.error('Failed to update organization:', error);
    }
  };

  const handleDeleteOrg = async (id: number) => {
    if (!confirm('确定要删除此组织吗？')) return;
    try {
      await api.delete(`/global-params/organizations/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete organization:', error);
    }
  };

  const openOrgDialog = (org?: Organization) => {
    if (org) {
      setEditingOrg(org);
      setOrgForm({
        name: org.name,
        org_type: org.org_type,
        address: org.address || '',
        contact_person: org.contact_person || '',
        contact_phone: org.contact_phone || '',
        contact_email: org.contact_email || '',
      });
    } else {
      setEditingOrg(null);
      resetOrgForm();
    }
    setIsOrgDialogOpen(true);
  };

  const resetOrgForm = () => {
    setOrgForm({
      name: '',
      org_type: '',
      address: '',
      contact_person: '',
      contact_phone: '',
      contact_email: '',
    });
    setAuditReason('');
  };

  // --- 临床样本管理 ---
  const handleCreateClinical = async () => {
    try {
      await api.post('/global-params/sample-types', {
        ...clinicalForm,
        category: 'clinical'
      });
      setIsClinicalDialogOpen(false);
      resetClinicalForm();
      fetchData();
    } catch (error) {
      console.error('Failed to create clinical sample type:', error);
    }
  };

  const handleUpdateClinical = async () => {
    if (!editingSampleType) return;
    try {
      await api.put(`/global-params/sample-types/${editingSampleType.id}`, {
        ...clinicalForm,
        category: 'clinical',
        audit_reason: auditReason,
      });
      setIsClinicalDialogOpen(false);
      resetClinicalForm();
      fetchData();
    } catch (error) {
      console.error('Failed to update clinical sample type:', error);
    }
  };

  const openClinicalDialog = (sampleType?: SampleType) => {
    if (sampleType) {
      setEditingSampleType(sampleType);
      setClinicalForm({
        cycle_group: sampleType.cycle_group || '',
        test_type: sampleType.test_type || '',
        primary_count: sampleType.primary_count,
        backup_count: sampleType.backup_count,
        purpose: sampleType.purpose || '',
        transport_method: sampleType.transport_method || '',
        status: sampleType.status || '',
        special_notes: sampleType.special_notes || '',
      });
    } else {
      setEditingSampleType(null);
      resetClinicalForm();
    }
    setIsClinicalDialogOpen(true);
  };

  const resetClinicalForm = () => {
    setClinicalForm({
      cycle_group: '',
      test_type: '',
      primary_count: 1,
      backup_count: 1,
      purpose: '',
      transport_method: '',
      status: '',
      special_notes: '',
    });
    setAuditReason('');
  };

  // --- 稳定性及质控样本管理 ---
  const handleCreateQC = async () => {
    try {
      await api.post('/global-params/sample-types', {
        ...qcForm,
        category: 'qc_stability',
        primary_count: 0, // 不适用
        backup_count: 0,  // 不适用
      });
      setIsQCDialogOpen(false);
      resetQCForm();
      fetchData();
    } catch (error) {
      console.error('Failed to create QC sample type:', error);
    }
  };

  const handleUpdateQC = async () => {
    if (!editingSampleType) return;
    try {
      await api.put(`/global-params/sample-types/${editingSampleType.id}`, {
        ...qcForm,
        category: 'qc_stability',
        audit_reason: auditReason,
      });
      setIsQCDialogOpen(false);
      resetQCForm();
      fetchData();
    } catch (error) {
      console.error('Failed to update QC sample type:', error);
    }
  };

  const openQCDialog = (sampleType?: SampleType) => {
    if (sampleType) {
      setEditingSampleType(sampleType);
      setQCForm({
        test_type: sampleType.test_type || '',
        code: sampleType.code || '',
        special_notes: sampleType.special_notes || '',
      });
    } else {
      setEditingSampleType(null);
      resetQCForm();
    }
    setIsQCDialogOpen(true);
  };

  const resetQCForm = () => {
    setQCForm({
      test_type: '',
      code: '',
      special_notes: '',
    });
    setAuditReason('');
  };

  const handleDeleteSampleType = async (id: number) => {
    if (!confirm('确定要删除此样本类型配置吗？')) return;
    try {
      await api.delete(`/global-params/sample-types/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete sample type:', error);
    }
  };

  const getOrgTypeLabel = (type: string) => {
    const orgType = orgTypes.find(t => t.value === type);
    return orgType?.label || type;
  };

  const getOrgTypeColor = (type: string) => {
    switch (type) {
      case 'sponsor': return 'blue';
      case 'clinical': return 'green';
      case 'testing': return 'purple';
      case 'transport': return 'amber';
      default: return 'zinc';
    }
  };

  const filteredOrganizations = selectedOrgType === 'all'
    ? organizations
    : organizations.filter(org => org.org_type === selectedOrgType);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Heading>全局参数管理</Heading>
          <Text className="mt-1 text-zinc-600">管理系统中的组织信息和样本类型配置</Text>
        </div>

        {/* 标签页切换 */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { key: 'organizations', label: '组织管理' },
              { key: 'clinical-samples', label: '临床样本配置' },
              { key: 'qc-stability-samples', label: '稳定性及质控样本配置' }
            ]}
            activeTab={activeTab}
            onChange={(key) => setActiveTab(key as TabType)}
          />
        </div>

        {/* 组织管理内容 */}
        {activeTab === 'organizations' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedOrgType}
                  onChange={(e) => setSelectedOrgType(e.target.value)}
                  className="w-48"
                >
                  <option value="all">所有类型</option>
                  {orgTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
              </div>
              <Button onClick={() => openOrgDialog()} className="whitespace-nowrap">
                <PlusIcon />
                新增组织
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>组织名称</TableHeader>
                    <TableHeader>类型</TableHeader>
                    <TableHeader>地址</TableHeader>
                    <TableHeader>联系人</TableHeader>
                    <TableHeader>联系电话</TableHeader>
                    <TableHeader>邮箱</TableHeader>
                    <TableHeader>操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={7} variant="skeleton" />
                  ) : filteredOrganizations.length === 0 ? (
                    <AnimatedEmptyState colSpan={7} text="暂无数据" />
                  ) : (
                    filteredOrganizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>
                          <Badge color={getOrgTypeColor(org.org_type)}>
                            {getOrgTypeLabel(org.org_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-600">{org.address || '-'}</TableCell>
                        <TableCell className="text-zinc-600">{org.contact_person || '-'}</TableCell>
                        <TableCell className="text-zinc-600">{org.contact_phone || '-'}</TableCell>
                        <TableCell className="text-zinc-600">{org.contact_email || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button plain onClick={() => openOrgDialog(org)}>
                              <PencilIcon />
                            </Button>
                            <Button plain onClick={() => handleDeleteOrg(org.id)}>
                              <TrashIcon />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* 临床样本配置内容 */}
        {activeTab === 'clinical-samples' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Text className="text-zinc-600">配置临床试验中的样本类型信息（正份/备份）</Text>
              <Button onClick={() => openClinicalDialog()} className="whitespace-nowrap">
                <PlusIcon />
                新增临床样本类型
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>周期/组别</TableHeader>
                    <TableHeader>检测类型</TableHeader>
                    <TableHeader>正份（套）</TableHeader>
                    <TableHeader>备份（套）</TableHeader>
                    <TableHeader>用途</TableHeader>
                    <TableHeader>运输方式</TableHeader>
                    <TableHeader>状态</TableHeader>
                    <TableHeader>特殊事项</TableHeader>
                    <TableHeader>操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={9} variant="skeleton" />
                  ) : clinicalSamples.length === 0 ? (
                    <AnimatedEmptyState colSpan={9} text="暂无数据" />
                  ) : (
                    clinicalSamples.map((sampleType) => (
                      <TableRow key={sampleType.id}>
                        <TableCell>{sampleType.cycle_group || '-'}</TableCell>
                        <TableCell>{sampleType.test_type || '-'}</TableCell>
                        <TableCell>{sampleType.primary_count}</TableCell>
                        <TableCell>{sampleType.backup_count}</TableCell>
                        <TableCell className="text-zinc-600">{sampleType.purpose || '-'}</TableCell>
                        <TableCell className="text-zinc-600">{sampleType.transport_method || '-'}</TableCell>
                        <TableCell className="text-zinc-600">{sampleType.status || '-'}</TableCell>
                        <TableCell className="text-zinc-600">{sampleType.special_notes || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button plain onClick={() => openClinicalDialog(sampleType)}>
                              <PencilIcon />
                            </Button>
                            <Button plain onClick={() => handleDeleteSampleType(sampleType.id)}>
                              <TrashIcon />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* 稳定性及质控样本配置内容 */}
        {activeTab === 'qc-stability-samples' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Text className="text-zinc-600">配置稳定性研究和质量控制的样本类型</Text>
              <Button onClick={() => openQCDialog()} className="whitespace-nowrap">
                <PlusIcon />
                新增稳定性/质控样本
              </Button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>检测类型</TableHeader>
                    <TableHeader>代码</TableHeader>
                    <TableHeader>特殊事项</TableHeader>
                    <TableHeader>创建时间</TableHeader>
                    <TableHeader>操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={5} variant="skeleton" />
                  ) : qcSamples.length === 0 ? (
                    <AnimatedEmptyState colSpan={5} text="暂无数据" />
                  ) : (
                    qcSamples.map((sampleType) => (
                      <TableRow key={sampleType.id}>
                        <TableCell className="font-medium">{sampleType.test_type || '-'}</TableCell>
                        <TableCell>
                          {sampleType.code ? (
                            <Badge color="zinc">{sampleType.code}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-zinc-600">{sampleType.special_notes || '-'}</TableCell>
                        <TableCell className="text-zinc-500">
                          {new Date(sampleType.created_at).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button plain onClick={() => openQCDialog(sampleType)}>
                              <PencilIcon />
                            </Button>
                            <Button plain onClick={() => handleDeleteSampleType(sampleType.id)}>
                              <TrashIcon />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* 组织对话框 */}
      <Dialog open={isOrgDialogOpen} onClose={setIsOrgDialogOpen}>
        <DialogTitle>{editingOrg ? '编辑组织' : '新增组织'}</DialogTitle>
        <DialogDescription>
          {editingOrg ? '修改组织信息' : '添加新的组织/机构信息'}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                组织类型 <span className="text-red-500">*</span>
              </label>
              <Select
                value={orgForm.org_type}
                onChange={(e) => setOrgForm({ ...orgForm, org_type: e.target.value })}
                required
              >
                <option value="">请选择类型</option>
                {orgTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                组织名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                placeholder="输入组织名称"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                地址
              </label>
              <Textarea
                value={orgForm.address}
                onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                placeholder="输入组织地址"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                联系人
              </label>
              <Input
                value={orgForm.contact_person}
                onChange={(e) => setOrgForm({ ...orgForm, contact_person: e.target.value })}
                placeholder="输入联系人姓名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                联系电话
              </label>
              <Input
                value={orgForm.contact_phone}
                onChange={(e) => setOrgForm({ ...orgForm, contact_phone: e.target.value })}
                placeholder="输入联系电话"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                邮箱
              </label>
              <Input
                type="email"
                value={orgForm.contact_email}
                onChange={(e) => setOrgForm({ ...orgForm, contact_email: e.target.value })}
                placeholder="输入邮箱地址"
              />
            </div>
            {editingOrg && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  修改理由 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="请输入修改理由"
                  rows={2}
                  required
                />
                <Text className="text-sm text-amber-600 mt-1">
                  注意：修改信息将被记录在审计日志中
                </Text>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsOrgDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={editingOrg ? handleUpdateOrg : handleCreateOrg}>
            {editingOrg ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 临床样本对话框 */}
      <Dialog open={isClinicalDialogOpen} onClose={setIsClinicalDialogOpen}>
        <DialogTitle>{editingSampleType ? '编辑临床样本类型' : '新增临床样本类型'}</DialogTitle>
        <DialogDescription>
          {editingSampleType ? '修改临床样本类型配置' : '添加新的临床样本类型配置'}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  周期/组别
                </label>
                <Input
                  value={clinicalForm.cycle_group}
                  onChange={(e) => setClinicalForm({ ...clinicalForm, cycle_group: e.target.value })}
                  placeholder="如：A组、第1期等"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  检测类型
                </label>
                <Input
                  value={clinicalForm.test_type}
                  onChange={(e) => setClinicalForm({ ...clinicalForm, test_type: e.target.value })}
                  placeholder="如：血清、血浆、尿液等"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  正份（套）
                </label>
                <Input
                  type="number"
                  value={clinicalForm.primary_count}
                  onChange={(e) => setClinicalForm({ ...clinicalForm, primary_count: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  备份（套）
                </label>
                <Input
                  type="number"
                  value={clinicalForm.backup_count}
                  onChange={(e) => setClinicalForm({ ...clinicalForm, backup_count: parseInt(e.target.value) || 1 })}
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  用途
                </label>
                <Input
                  value={clinicalForm.purpose}
                  onChange={(e) => setClinicalForm({ ...clinicalForm, purpose: e.target.value })}
                  placeholder="如：首次检测、重测、ISR等"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  运输方式
                </label>
                <Input
                  value={clinicalForm.transport_method}
                  onChange={(e) => setClinicalForm({ ...clinicalForm, transport_method: e.target.value })}
                  placeholder="如：冷链运输、常温运输等"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                状态
              </label>
              <Input
                value={clinicalForm.status}
                onChange={(e) => setClinicalForm({ ...clinicalForm, status: e.target.value })}
                placeholder="如：正常、待检、已检等"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                特殊事项
              </label>
              <Textarea
                value={clinicalForm.special_notes}
                onChange={(e) => setClinicalForm({ ...clinicalForm, special_notes: e.target.value })}
                placeholder="特殊要求或注意事项"
                rows={2}
              />
            </div>
            {editingSampleType && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  修改理由 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="请输入修改理由"
                  rows={2}
                  required
                />
                <Text className="text-sm text-amber-600 mt-1">
                  注意：修改信息将被记录在审计日志中
                </Text>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsClinicalDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={editingSampleType ? handleUpdateClinical : handleCreateClinical}>
            {editingSampleType ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 稳定性及质控样本对话框 */}
      <Dialog open={isQCDialogOpen} onClose={setIsQCDialogOpen}>
        <DialogTitle>{editingSampleType ? '编辑稳定性/质控样本' : '新增稳定性/质控样本'}</DialogTitle>
        <DialogDescription>
          {editingSampleType ? '修改样本类型配置' : '添加新的样本类型配置'}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  检测类型 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={qcForm.test_type}
                  onChange={(e) => setQCForm({ ...qcForm, test_type: e.target.value })}
                  placeholder="如：STB, QC"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  代码
                </label>
                <Input
                  value={qcForm.code}
                  onChange={(e) => setQCForm({ ...qcForm, code: e.target.value })}
                  placeholder="如：L, M, H"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                特殊事项
              </label>
              <Textarea
                value={qcForm.special_notes}
                onChange={(e) => setQCForm({ ...qcForm, special_notes: e.target.value })}
                placeholder="特殊要求或注意事项"
                rows={3}
              />
            </div>
            
            {editingSampleType && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  修改理由 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="请输入修改理由"
                  rows={2}
                  required
                />
                <Text className="text-sm text-amber-600 mt-1">
                  注意：修改信息将被记录在审计日志中
                </Text>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsQCDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={editingSampleType ? handleUpdateQC : handleCreateQC}>
            {editingSampleType ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
