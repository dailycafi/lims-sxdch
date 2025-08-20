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
import { api } from '@/lib/api';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon, BeakerIcon } from '@heroicons/react/20/solid';

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
  { value: 'sponsor', label: '申办者' },
  { value: 'clinical', label: '临床机构' },
  { value: 'testing', label: '检测单位' },
  { value: 'transport', label: '运输单位' },
];

type TabType = 'organizations' | 'sample-types';

export default function GlobalParamsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isSampleTypeDialogOpen, setIsSampleTypeDialogOpen] = useState(false);
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

  // 样本类型表单数据
  const [sampleTypeForm, setSampleTypeForm] = useState({
    cycle_group: '',
    test_type: '',
    primary_count: 1,
    backup_count: 1,
    purpose: '',
    transport_method: '',
    status: '',
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
        api.get('/global_params/organizations'),
        api.get('/global_params/sample-types'),
      ]);
      setOrganizations(orgsRes.data);
      setSampleTypes(sampleTypesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 组织管理
  const handleCreateOrg = async () => {
    try {
      await api.post('/global_params/organizations', orgForm);
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
      await api.put(`/global_params/organizations/${editingOrg.id}`, {
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
      await api.delete(`/global_params/organizations/${id}`);
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

  // 样本类型管理
  const handleCreateSampleType = async () => {
    try {
      await api.post('/global_params/sample-types', sampleTypeForm);
      setIsSampleTypeDialogOpen(false);
      resetSampleTypeForm();
      fetchData();
    } catch (error) {
      console.error('Failed to create sample type:', error);
    }
  };

  const handleUpdateSampleType = async () => {
    if (!editingSampleType) return;
    try {
      await api.put(`/global_params/sample-types/${editingSampleType.id}`, {
        ...sampleTypeForm,
        audit_reason: auditReason,
      });
      setIsSampleTypeDialogOpen(false);
      resetSampleTypeForm();
      fetchData();
    } catch (error) {
      console.error('Failed to update sample type:', error);
    }
  };

  const handleDeleteSampleType = async (id: number) => {
    if (!confirm('确定要删除此样本类型配置吗？')) return;
    try {
      await api.delete(`/global_params/sample-types/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete sample type:', error);
    }
  };

  const openSampleTypeDialog = (sampleType?: SampleType) => {
    if (sampleType) {
      setEditingSampleType(sampleType);
      setSampleTypeForm({
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
      resetSampleTypeForm();
    }
    setIsSampleTypeDialogOpen(true);
  };

  const resetSampleTypeForm = () => {
    setSampleTypeForm({
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

  const getOrgTypeLabel = (type: string) => {
    const orgType = orgTypes.find(t => t.value === type);
    return orgType?.label || type;
  };

  const getOrgTypeColor = (type: string) => {
    switch (type) {
      case 'sponsor':
        return 'blue';
      case 'clinical':
        return 'green';
      case 'testing':
        return 'purple';
      case 'transport':
        return 'amber';
      default:
        return 'zinc';
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
        <div className="flex space-x-1 border-b border-zinc-200 mb-6">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'organizations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <BuildingOfficeIcon className="h-5 w-5" />
            组织管理
          </button>
          <button
            onClick={() => setActiveTab('sample-types')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'sample-types'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <BeakerIcon className="h-5 w-5" />
            样本类型配置
          </button>
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
              <Button onClick={() => openOrgDialog()}>
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
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Text>加载中...</Text>
                      </TableCell>
                    </TableRow>
                  ) : filteredOrganizations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Text>暂无数据</Text>
                      </TableCell>
                    </TableRow>
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

        {/* 样本类型配置内容 */}
        {activeTab === 'sample-types' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Text className="text-zinc-600">配置临床样本和稳定性质控样本的类型信息</Text>
              <Button onClick={() => openSampleTypeDialog()}>
                <PlusIcon />
                新增样本类型
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
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Text>加载中...</Text>
                      </TableCell>
                    </TableRow>
                  ) : sampleTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <Text>暂无数据</Text>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sampleTypes.map((sampleType) => (
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
                            <Button plain onClick={() => openSampleTypeDialog(sampleType)}>
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

      {/* 样本类型对话框 */}
      <Dialog open={isSampleTypeDialogOpen} onClose={setIsSampleTypeDialogOpen}>
        <DialogTitle>{editingSampleType ? '编辑样本类型' : '新增样本类型'}</DialogTitle>
        <DialogDescription>
          {editingSampleType ? '修改样本类型配置' : '添加新的样本类型配置'}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                周期/组别
              </label>
              <Input
                value={sampleTypeForm.cycle_group}
                onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, cycle_group: e.target.value })}
                placeholder="如：A组、第1期等"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                检测类型
              </label>
              <Input
                value={sampleTypeForm.test_type}
                onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, test_type: e.target.value })}
                placeholder="如：血清、血浆、尿液等"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  正份（套）
                </label>
                <Input
                  type="number"
                  value={sampleTypeForm.primary_count}
                  onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, primary_count: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  备份（套）
                </label>
                <Input
                  type="number"
                  value={sampleTypeForm.backup_count}
                  onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, backup_count: parseInt(e.target.value) || 1 })}
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                用途
              </label>
              <Input
                value={sampleTypeForm.purpose}
                onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, purpose: e.target.value })}
                placeholder="如：首次检测、重测、ISR等"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                运输方式
              </label>
              <Input
                value={sampleTypeForm.transport_method}
                onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, transport_method: e.target.value })}
                placeholder="如：冷链运输、常温运输等"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                状态
              </label>
              <Input
                value={sampleTypeForm.status}
                onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, status: e.target.value })}
                placeholder="如：正常、待检、已检等"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                特殊事项
              </label>
              <Textarea
                value={sampleTypeForm.special_notes}
                onChange={(e) => setSampleTypeForm({ ...sampleTypeForm, special_notes: e.target.value })}
                placeholder="特殊要求或注意事项"
                rows={2}
              />
            </div>
            {editingSampleType && (
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
          <Button plain onClick={() => setIsSampleTypeDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={editingSampleType ? handleUpdateSampleType : handleCreateSampleType}>
            {editingSampleType ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}