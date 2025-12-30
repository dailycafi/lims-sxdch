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
import { SearchInput } from '@/components/search-input';
import { api } from '@/lib/api';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon, BeakerIcon, TagIcon } from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface OrganizationType {
  id: number;
  value: string;
  label: string;
  is_system: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at?: string;
}

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

type TabType = 'organizations' | 'clinical-samples' | 'qc-stability-samples';

export default function GlobalParamsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [showOrgTypes, setShowOrgTypes] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgTypes, setOrgTypes] = useState<OrganizationType[]>([]);
  const [clinicalSamples, setClinicalSamples] = useState<SampleType[]>([]);
  const [qcSamples, setQcSamples] = useState<SampleType[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isOrgTypeDialogOpen, setIsOrgTypeDialogOpen] = useState(false);
  const [isClinicalDialogOpen, setIsClinicalDialogOpen] = useState(false);
  const [isQCDialogOpen, setIsQCDialogOpen] = useState(false);
  
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editingOrgType, setEditingOrgType] = useState<OrganizationType | null>(null);
  const [editingSampleType, setEditingSampleType] = useState<SampleType | null>(null);
  const [selectedOrgType, setSelectedOrgType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 统一的输入框包装样式，强制高度 40px 并对齐
  const inputWrapperClass = "[&_span]:after:hidden [&_span]:before:hidden [&_span]:block [&_span]:h-10 [&_span]:!min-h-0 [&_input]:!h-10 [&_input]:!min-h-0";
  const inputClass = "w-28 h-10 !py-0 !min-h-0";
  const buttonClass = "h-10 flex items-center justify-center !py-0 !min-h-0";
  // 组织表单数据
  const [orgForm, setOrgForm] = useState({
    name: '',
    org_type: '',
    address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
  });

  // 组织类型表单数据
  const [orgTypeForm, setOrgTypeForm] = useState({
    value: '',
    label: '',
    display_order: 0,
  });

  // 临床样本表单数据 - 修改为数组形式
  const [clinicalForm, setClinicalForm] = useState({
    cycle_groups: [''], // 周期/剂量组数组
    test_types: [''], // 检测类型数组
    primary_codes: [''], // 正份代码数组
    backup_codes: [''], // 备份代码数组
  });

  // 稳定性及质控样本表单数据 - 修改为数组形式
  const [qcForm, setQCForm] = useState({
    sample_categories: [''], // 样本类别数组 (STB/QC)
    codes: [''],      // 代码数组
  });

  // 审计理由
  const [auditReason, setAuditReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgsRes, orgTypesRes, sampleTypesRes] = await Promise.all([
        api.get('/global-params/organizations'),
        api.get('/global-params/organization-types'),
        api.get('/global-params/sample-types'),
      ]);
      setOrganizations(orgsRes.data);
      setOrgTypes(orgTypesRes.data);
      
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
    // 数据清理：将空字符串转换为 null，避免后端验证失败
    const payload = Object.fromEntries(
      Object.entries(orgForm).map(([key, value]) => [key, value === '' ? null : value])
    );

    try {
      await api.post('/global-params/organizations', payload);
      setIsOrgDialogOpen(false);
      resetOrgForm();
      fetchData();
      toast.success('组织创建成功');
    } catch (error) {
      console.error('Failed to create organization:', error);
      // 错误处理已由 api.ts 中的拦截器统一处理并显示 toast
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg) return;
    if (!auditReason.trim()) {
      toast.error('请输入修改理由');
      return;
    }

    // 数据清理：将空字符串转换为 null
    const payload = Object.fromEntries(
      Object.entries(orgForm).map(([key, value]) => [key, value === '' ? null : value])
    );

    try {
      await api.put(`/global-params/organizations/${editingOrg.id}`, {
        ...payload,
        audit_reason: auditReason.trim(),
      });
      setIsOrgDialogOpen(false);
      resetOrgForm();
      fetchData();
      toast.success('组织更新成功');
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

  const closeOrgDialog = () => {
    setIsOrgDialogOpen(false);
    resetOrgForm();
    setEditingOrg(null);
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

  // --- 组织类型管理 ---
  const handleCreateOrgType = async () => {
    if (!orgTypeForm.value.trim() || !orgTypeForm.label.trim()) {
      toast.error('请填写类型值和显示名称');
      return;
    }
    try {
      await api.post('/global-params/organization-types', orgTypeForm);
      setIsOrgTypeDialogOpen(false);
      resetOrgTypeForm();
      fetchData();
      toast.success('组织类型创建成功');
    } catch (error) {
      console.error('Failed to create organization type:', error);
    }
  };

  const handleUpdateOrgType = async () => {
    if (!editingOrgType) return;
    if (!orgTypeForm.label.trim()) {
      toast.error('请填写显示名称');
      return;
    }
    try {
      await api.put(`/global-params/organization-types/${editingOrgType.id}`, {
        label: orgTypeForm.label,
        display_order: orgTypeForm.display_order,
      });
      setIsOrgTypeDialogOpen(false);
      resetOrgTypeForm();
      fetchData();
      toast.success('组织类型更新成功');
    } catch (error) {
      console.error('Failed to update organization type:', error);
    }
  };

  const handleDeleteOrgType = async (id: number) => {
    if (!confirm('确定要删除此组织类型吗？')) return;
    try {
      await api.delete(`/global-params/organization-types/${id}`);
      fetchData();
      toast.success('组织类型删除成功');
    } catch (error) {
      console.error('Failed to delete organization type:', error);
    }
  };

  const openOrgTypeDialog = (orgType?: OrganizationType) => {
    if (orgType) {
      setEditingOrgType(orgType);
      setOrgTypeForm({
        value: orgType.value,
        label: orgType.label,
        display_order: orgType.display_order,
      });
    } else {
      setEditingOrgType(null);
      resetOrgTypeForm();
    }
    setIsOrgTypeDialogOpen(true);
  };

  const closeOrgTypeDialog = () => {
    setIsOrgTypeDialogOpen(false);
    resetOrgTypeForm();
    setEditingOrgType(null);
  };

  const resetOrgTypeForm = () => {
    setOrgTypeForm({
      value: '',
      label: '',
      display_order: 0,
    });
  };

  // --- 临床样本管理 ---
  const handleCreateClinical = async () => {
    // 验证必填项
    const validCycleGroups = clinicalForm.cycle_groups.filter(g => g.trim());
    const validTestTypes = clinicalForm.test_types.filter(t => t.trim());
    const validPrimaryCodes = clinicalForm.primary_codes.filter(c => c.trim());
    const validBackupCodes = clinicalForm.backup_codes.filter(c => c.trim());
    
    if (validCycleGroups.length === 0) {
      toast.error('请至少添加一个周期/剂量组');
      return;
    }
    if (validTestTypes.length === 0) {
      toast.error('请至少添加一个检测类型');
      return;
    }
    if (validPrimaryCodes.length === 0) {
      toast.error('请至少添加一个正份代码');
      return;
    }

    try {
      // 提交时将数组转换为逗号分隔的字符串
      await api.post('/global-params/sample-types', {
        category: 'clinical',
        cycle_group: validCycleGroups.join(','),
        test_type: validTestTypes.join(','),
        primary_count: validPrimaryCodes.length, // 正份数量为代码个数
        primary_codes: validPrimaryCodes.join(','), // 新增字段保存正份代码
        backup_count: validBackupCodes.length, // 备份数量为代码个数
        backup_codes: validBackupCodes.join(','), // 备份代码
      });
      resetClinicalForm();
      fetchData();
      toast.success('临床样本类型创建成功');
    } catch (error) {
      console.error('Failed to create clinical sample type:', error);
    }
  };

  const handleUpdateClinical = async () => {
    if (!editingSampleType) return;
    if (!auditReason.trim()) {
      toast.error('请输入修改理由');
      return;
    }

    // 验证必填项
    const validCycleGroups = clinicalForm.cycle_groups.filter(g => g.trim());
    const validTestTypes = clinicalForm.test_types.filter(t => t.trim());
    const validPrimaryCodes = clinicalForm.primary_codes.filter(c => c.trim());
    const validBackupCodes = clinicalForm.backup_codes.filter(c => c.trim());
    
    if (validCycleGroups.length === 0) {
      toast.error('请至少添加一个周期/剂量组');
      return;
    }
    if (validTestTypes.length === 0) {
      toast.error('请至少添加一个检测类型');
      return;
    }
    if (validPrimaryCodes.length === 0) {
      toast.error('请至少添加一个正份代码');
      return;
    }

    try {
      await api.put(`/global-params/sample-types/${editingSampleType.id}`, {
        category: 'clinical',
        cycle_group: validCycleGroups.join(','),
        test_type: validTestTypes.join(','),
        primary_count: validPrimaryCodes.length,
        primary_codes: validPrimaryCodes.join(','),
        backup_count: validBackupCodes.length,
        backup_codes: validBackupCodes.join(','),
        audit_reason: auditReason.trim(),
      });
      closeClinicalDialog();
      fetchData();
      toast.success('临床样本类型更新成功');
    } catch (error) {
      console.error('Failed to update clinical sample type:', error);
    }
  };

  const openClinicalDialog = (sampleType?: SampleType) => {
    if (sampleType) {
      setEditingSampleType(sampleType);
      // 从逗号分隔的字符串转换为数组
      const cycleGroups = sampleType.cycle_group ? sampleType.cycle_group.split(',').map(s => s.trim()) : [''];
      const testTypes = sampleType.test_type ? sampleType.test_type.split(',').map(s => s.trim()) : [''];
      const primaryCodes = (sampleType as any).primary_codes 
        ? (sampleType as any).primary_codes.split(',').map((s: string) => s.trim()) 
        : [''];
      const backupCodes = (sampleType as any).backup_codes 
        ? (sampleType as any).backup_codes.split(',').map((s: string) => s.trim()) 
        : [''];
      
      setClinicalForm({
        cycle_groups: cycleGroups,
        test_types: testTypes,
        primary_codes: primaryCodes,
        backup_codes: backupCodes,
      });
    } else {
      setEditingSampleType(null);
      resetClinicalForm();
    }
    setIsClinicalDialogOpen(true);
  };

  const closeClinicalDialog = () => {
    setIsClinicalDialogOpen(false);
    resetClinicalForm();
    setEditingSampleType(null);
  };

  const resetClinicalForm = () => {
    setClinicalForm({
      cycle_groups: [''],
      test_types: [''],
      primary_codes: [''],
      backup_codes: [''],
    });
    setAuditReason('');
  };

  // --- 稳定性及质控样本管理 ---
  const handleCreateQC = async () => {
    // 验证必填项
    const validCategories = qcForm.sample_categories.filter(c => c.trim());
    const validCodes = qcForm.codes.filter(c => c.trim());
    
    if (validCategories.length === 0) {
      toast.error('请至少添加一个样本类别');
      return;
    }
    if (validCodes.length === 0) {
      toast.error('请至少添加一个代码');
      return;
    }

    try {
      // 提交时将数组转换为逗号分隔的字符串
      await api.post('/global-params/sample-types', {
        category: 'qc_stability',
        test_type: validCategories.join(','), // 使用 test_type 字段存储样本类别
        code: validCodes.join(','),
        primary_count: 0, // 不适用
        backup_count: 0,  // 不适用
      });
      closeQCDialog();
      fetchData();
      toast.success('样本类型创建成功');
    } catch (error) {
      console.error('Failed to create QC sample type:', error);
    }
  };

  const handleUpdateQC = async () => {
    if (!editingSampleType) return;
    if (!auditReason.trim()) {
      toast.error('请输入修改理由');
      return;
    }

    // 验证必填项
    const validCategories = qcForm.sample_categories.filter(c => c.trim());
    const validCodes = qcForm.codes.filter(c => c.trim());
    
    if (validCategories.length === 0) {
      toast.error('请至少添加一个样本类别');
      return;
    }
    if (validCodes.length === 0) {
      toast.error('请至少添加一个代码');
      return;
    }

    try {
      await api.put(`/global-params/sample-types/${editingSampleType.id}`, {
        category: 'qc_stability',
        test_type: validCategories.join(','),
        code: validCodes.join(','),
        audit_reason: auditReason.trim(),
      });
      closeQCDialog();
      fetchData();
      toast.success('样本类型更新成功');
    } catch (error) {
      console.error('Failed to update QC sample type:', error);
    }
  };

  const openQCDialog = (sampleType?: SampleType) => {
    if (sampleType) {
      setEditingSampleType(sampleType);
      // 从逗号分隔的字符串转换为数组
      const categories = sampleType.test_type ? sampleType.test_type.split(',').map(s => s.trim()) : [''];
      const codes = sampleType.code ? sampleType.code.split(',').map(s => s.trim()) : [''];
      
      setQCForm({
        sample_categories: categories,
        codes: codes,
      });
    } else {
      setEditingSampleType(null);
      resetQCForm();
    }
    setIsQCDialogOpen(true);
  };

  const closeQCDialog = () => {
    setIsQCDialogOpen(false);
    resetQCForm();
    setEditingSampleType(null);
  };

  const resetQCForm = () => {
    setQCForm({
      sample_categories: [''],
      codes: [''],
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

  const filteredOrganizations = organizations.filter(org => {
    const matchType = selectedOrgType === 'all' || org.org_type === selectedOrgType;
    const matchSearch = searchQuery === '' || 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (org.contact_person && org.contact_person.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchSearch;
  });

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            {!showOrgTypes ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-96">
                      <SearchInput
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索组织名称或联系人..."
                      />
                    </div>
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
                  <div className="flex gap-2">
                    <Button plain onClick={() => setShowOrgTypes(true)} className="whitespace-nowrap">
                      <TagIcon />
                      管理组织类型
                    </Button>
                    <Button onClick={() => openOrgDialog()} className="whitespace-nowrap">
                      <PlusIcon />
                      新增组织
                    </Button>
                  </div>
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
            ) : (
              <>
                {/* 组织类型管理内容 */}
                <div className="mb-4">
                  <Button plain onClick={() => setShowOrgTypes(false)}>
                    ← 返回组织列表
                  </Button>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <Text className="text-zinc-600">管理系统中可用的组织类型</Text>
                  <Button onClick={() => openOrgTypeDialog()} className="whitespace-nowrap">
                    <PlusIcon />
                    新增组织类型
                  </Button>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>类型值</TableHeader>
                        <TableHeader>显示名称</TableHeader>
                        <TableHeader>排序</TableHeader>
                        <TableHeader>系统预置</TableHeader>
                        <TableHeader>创建时间</TableHeader>
                        <TableHeader>操作</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <AnimatedLoadingState colSpan={6} variant="skeleton" />
                      ) : orgTypes.length === 0 ? (
                        <AnimatedEmptyState colSpan={6} text="暂无数据" />
                      ) : (
                        orgTypes.map((orgType) => (
                          <TableRow key={orgType.id}>
                            <TableCell className="font-mono font-medium">{orgType.value}</TableCell>
                            <TableCell>{orgType.label}</TableCell>
                            <TableCell>{orgType.display_order}</TableCell>
                            <TableCell>
                              {orgType.is_system ? (
                                <Badge color="blue">系统</Badge>
                              ) : (
                                <Badge color="zinc">自定义</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-zinc-500">
                              {new Date(orgType.created_at).toLocaleDateString('zh-CN')}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button plain onClick={() => openOrgTypeDialog(orgType)}>
                                  <PencilIcon />
                                </Button>
                                {!orgType.is_system && (
                                  <Button plain onClick={() => handleDeleteOrgType(orgType.id)}>
                                    <TrashIcon />
                                  </Button>
                                )}
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
          </>
        )}

        {/* 临床样本配置内容 */}
        {activeTab === 'clinical-samples' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
              <div className="p-6 space-y-6">
                {/* 第一行：周期/剂量组 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      周期 / 剂量组
                    </label>
                    <Badge color="blue" className="text-xs">必填</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.cycle_groups.map((group, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={group}
                            autoFocus={index > 0 && index === clinicalForm.cycle_groups.length - 1}
                            onChange={(e) => {
                              const newGroups = [...clinicalForm.cycle_groups];
                              newGroups[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, cycle_groups: newGroups });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && group.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  cycle_groups: [...clinicalForm.cycle_groups, ''] 
                                });
                              }
                            }}
                            placeholder="如：A、B、1、2"
                            className={inputClass}
                          />
                        </div>
                        {clinicalForm.cycle_groups.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newGroups = clinicalForm.cycle_groups.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, cycle_groups: newGroups });
                            }}
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      outline
                      onClick={() => {
                        setClinicalForm({ 
                          ...clinicalForm, 
                          cycle_groups: [...clinicalForm.cycle_groups, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
            </div>

                {/* 第二行：检测类型 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      检测类型
                    </label>
                    <Badge color="green" className="text-xs">必填</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.test_types.map((type, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={type}
                            autoFocus={index > 0 && index === clinicalForm.test_types.length - 1}
                            onChange={(e) => {
                              const newTypes = [...clinicalForm.test_types];
                              newTypes[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, test_types: newTypes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && type.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  test_types: [...clinicalForm.test_types, ''] 
                                });
                              }
                            }}
                            placeholder="如：PK、ADA、Nab"
                            className={`${inputClass} w-32`}
                          />
                        </div>
                        {clinicalForm.test_types.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newTypes = clinicalForm.test_types.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, test_types: newTypes });
                            }}
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      outline
                      onClick={() => {
                        setClinicalForm({ 
                          ...clinicalForm, 
                          test_types: [...clinicalForm.test_types, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>

                {/* 第三行：正份 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      正份代码
                    </label>
                    <Badge color="purple" className="text-xs">必填</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.primary_codes.map((code, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={code}
                            autoFocus={index > 0 && index === clinicalForm.primary_codes.length - 1}
                            onChange={(e) => {
                              const newCodes = [...clinicalForm.primary_codes];
                              newCodes[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, primary_codes: newCodes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && code.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  primary_codes: [...clinicalForm.primary_codes, ''] 
                                });
                              }
                            }}
                            placeholder="如：a1、a2、a3"
                            className={inputClass}
                          />
                        </div>
                        {clinicalForm.primary_codes.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newCodes = clinicalForm.primary_codes.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, primary_codes: newCodes });
                            }}
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      outline
                      onClick={() => {
                        setClinicalForm({ 
                          ...clinicalForm, 
                          primary_codes: [...clinicalForm.primary_codes, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>

                {/* 第四行：备份 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      备份代码
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.backup_codes.map((code, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={code}
                            autoFocus={index > 0 && index === clinicalForm.backup_codes.length - 1}
                            onChange={(e) => {
                              const newCodes = [...clinicalForm.backup_codes];
                              newCodes[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, backup_codes: newCodes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && code.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  backup_codes: [...clinicalForm.backup_codes, ''] 
                                });
                              }
                            }}
                            placeholder="如：b1、b2、b3"
                            className={inputClass}
                          />
                        </div>
                        {clinicalForm.backup_codes.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newCodes = clinicalForm.backup_codes.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, backup_codes: newCodes });
                            }}
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      outline
                      onClick={() => {
                        setClinicalForm({ 
                          ...clinicalForm, 
                          backup_codes: [...clinicalForm.backup_codes, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <Button plain onClick={resetClinicalForm}>
                  重置
                </Button>
                <Button onClick={handleCreateClinical}>
                  <PlusIcon className="w-4 h-4" />
                  保存配置
                </Button>
              </div>
            </div>

            {/* 已保存的配置列表 */}
            {clinicalSamples.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Heading level={2}>已保存的配置</Heading>
                  <Badge color="zinc">{clinicalSamples.length} 条</Badge>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
              <Table>
                <TableHead>
                  <TableRow>
                        <TableHeader>周期/剂量组</TableHeader>
                    <TableHeader>检测类型</TableHeader>
                        <TableHeader>正份代码</TableHeader>
                        <TableHeader>备份代码</TableHeader>
                    <TableHeader>操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                      {clinicalSamples.map((sample) => (
                        <TableRow key={sample.id}>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(sample.cycle_group || '').split(',').map((g, i) => g.trim() && (
                                <Badge key={i} color="blue">{g.trim()}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(sample.test_type || '').split(',').map((t, i) => t.trim() && (
                                <Badge key={i} color="green">{t.trim()}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {((sample as any).primary_codes || '').split(',').map((c: string, i: number) => c.trim() && (
                                <Badge key={i} color="purple">{c.trim()}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {((sample as any).backup_codes || '').split(',').map((c: string, i: number) => c.trim() && (
                                <Badge key={i} color="amber">{c.trim()}</Badge>
                              ))}
                            </div>
                          </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                              <Button plain onClick={() => openClinicalDialog(sample)}>
                                <PencilIcon className="w-4 h-4" />
                            </Button>
                              <Button plain onClick={() => handleDeleteSampleType(sample.id)}>
                                <TrashIcon className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
              </div>
            )}
          </>
        )}

        {/* 稳定性及质控样本配置内容 */}
        {activeTab === 'qc-stability-samples' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
              <div className="p-6 space-y-6">
                {/* 第一行：样本类别 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      样本类别
                    </label>
                    <Badge color="blue" className="text-xs">必填</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {qcForm.sample_categories.map((category, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={category}
                            autoFocus={index > 0 && index === qcForm.sample_categories.length - 1}
                            onChange={(e) => {
                              const newCategories = [...qcForm.sample_categories];
                              newCategories[index] = e.target.value;
                              setQCForm({ ...qcForm, sample_categories: newCategories });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && category.trim()) {
                                e.preventDefault();
                                setQCForm({ 
                                  ...qcForm, 
                                  sample_categories: [...qcForm.sample_categories, ''] 
                                });
                              }
                            }}
                            placeholder="如：STB、QC"
                            className={`${inputClass} w-32`}
                          />
                        </div>
                        {qcForm.sample_categories.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newCategories = qcForm.sample_categories.filter((_, i) => i !== index);
                              setQCForm({ ...qcForm, sample_categories: newCategories });
                            }}
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      outline
                      onClick={() => {
                        setQCForm({ 
                          ...qcForm, 
                          sample_categories: [...qcForm.sample_categories, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
            </div>

                {/* 第二行：代码 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      代码
                    </label>
                    <Badge color="purple" className="text-xs">必填</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {qcForm.codes.map((code, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={code}
                            autoFocus={index > 0 && index === qcForm.codes.length - 1}
                            onChange={(e) => {
                              const newCodes = [...qcForm.codes];
                              newCodes[index] = e.target.value;
                              setQCForm({ ...qcForm, codes: newCodes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && code.trim()) {
                                e.preventDefault();
                                setQCForm({ 
                                  ...qcForm, 
                                  codes: [...qcForm.codes, ''] 
                                });
                              }
                            }}
                            placeholder="如：L、M、H"
                            className={inputClass}
                          />
                        </div>
                        {qcForm.codes.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newCodes = qcForm.codes.filter((_, i) => i !== index);
                              setQCForm({ ...qcForm, codes: newCodes });
                            }}
                          >
                            <TrashIcon className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      outline
                      onClick={() => {
                        setQCForm({ 
                          ...qcForm, 
                          codes: [...qcForm.codes, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
                <Button plain onClick={resetQCForm}>
                  重置
                </Button>
                <Button onClick={handleCreateQC}>
                  <PlusIcon className="w-4 h-4" />
                  保存配置
                </Button>
              </div>
            </div>

            {/* 已保存的配置列表 */}
            {qcSamples.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Heading level={2}>已保存的配置</Heading>
                  <Badge color="zinc">{qcSamples.length} 条</Badge>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
              <Table>
                <TableHead>
                  <TableRow>
                        <TableHeader>样本类别</TableHeader>
                    <TableHeader>代码</TableHeader>
                    <TableHeader>创建时间</TableHeader>
                    <TableHeader>操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                      {qcSamples.map((sample) => (
                        <TableRow key={sample.id}>
                        <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(sample.test_type || '').split(',').map((c, i) => c.trim() && (
                                <Badge key={i} color="blue">{c.trim()}</Badge>
                              ))}
                            </div>
                        </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(sample.code || '').split(',').map((c, i) => c.trim() && (
                                <Badge key={i} color="purple">{c.trim()}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-500 text-sm">
                            {new Date(sample.created_at).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                              <Button plain onClick={() => openQCDialog(sample)}>
                                <PencilIcon className="w-4 h-4" />
                            </Button>
                              <Button plain onClick={() => handleDeleteSampleType(sample.id)}>
                                <TrashIcon className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 组织对话框 */}
      <Dialog open={isOrgDialogOpen} onClose={closeOrgDialog}>
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
          <Button plain onClick={closeOrgDialog}>
            取消
          </Button>
          <Button onClick={editingOrg ? handleUpdateOrg : handleCreateOrg}>
            {editingOrg ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 组织类型对话框 */}
      <Dialog open={isOrgTypeDialogOpen} onClose={closeOrgTypeDialog}>
        <DialogTitle>{editingOrgType ? '编辑组织类型' : '新增组织类型'}</DialogTitle>
        <DialogDescription>
          {editingOrgType ? '修改组织类型信息' : '添加新的组织类型'}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                类型值 <span className="text-red-500">*</span>
              </label>
              <Input
                value={orgTypeForm.value}
                onChange={(e) => setOrgTypeForm({ ...orgTypeForm, value: e.target.value })}
                placeholder="输入类型值（英文，如：manufacturer）"
                required
                disabled={!!editingOrgType}
              />
              {!editingOrgType && (
                <Text className="text-sm text-zinc-500 mt-1">
                  类型值用于系统内部标识，创建后不可修改
                </Text>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                显示名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={orgTypeForm.label}
                onChange={(e) => setOrgTypeForm({ ...orgTypeForm, label: e.target.value })}
                placeholder="输入显示名称（如：生产厂家）"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                显示排序
              </label>
              <Input
                type="number"
                value={orgTypeForm.display_order}
                onChange={(e) => setOrgTypeForm({ ...orgTypeForm, display_order: parseInt(e.target.value) || 0 })}
                placeholder="数字越小越靠前"
                min="0"
              />
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={closeOrgTypeDialog}>
            取消
          </Button>
          <Button onClick={editingOrgType ? handleUpdateOrgType : handleCreateOrgType}>
            {editingOrgType ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 临床样本对话框 */}
      <Dialog open={isClinicalDialogOpen} onClose={closeClinicalDialog}>
        <DialogTitle>{editingSampleType ? '编辑临床样本类型' : '新增临床样本类型'}</DialogTitle>
        <DialogDescription>
          {editingSampleType ? '修改临床样本类型配置' : '添加新的临床样本类型配置'}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-5">
            {/* 周期/剂量组 */}
              <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                周期 / 剂量组 <span className="text-red-500">*</span>
                </label>
              <div className="space-y-2">
                {clinicalForm.cycle_groups.map((group, index) => (
                  <div key={index} className="flex items-center gap-2">
                <Input
                      value={group}
                      onChange={(e) => {
                        const newGroups = [...clinicalForm.cycle_groups];
                        newGroups[index] = e.target.value;
                        setClinicalForm({ ...clinicalForm, cycle_groups: newGroups });
                      }}
                      placeholder="如：A、B、1、2"
                      className="flex-1"
                    />
                    {clinicalForm.cycle_groups.length > 1 && (
                      <Button
                        plain
                        onClick={() => {
                          const newGroups = clinicalForm.cycle_groups.filter((_, i) => i !== index);
                          setClinicalForm({ ...clinicalForm, cycle_groups: newGroups });
                        }}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    )}
                    {index === clinicalForm.cycle_groups.length - 1 && (
                      <Button
                        onClick={() => {
                          setClinicalForm({ 
                            ...clinicalForm, 
                            cycle_groups: [...clinicalForm.cycle_groups, ''] 
                          });
                        }}
                      >
                        <PlusIcon className="w-4 h-4" />
                      </Button>
                    )}
              </div>
                ))}
              </div>
            </div>
            
            {/* 检测类型 */}
              <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                检测类型 <span className="text-red-500">*</span>
                </label>
              <div className="space-y-2">
                {clinicalForm.test_types.map((type, index) => (
                  <div key={index} className="flex items-center gap-2">
                <Input
                      value={type}
                      onChange={(e) => {
                        const newTypes = [...clinicalForm.test_types];
                        newTypes[index] = e.target.value;
                        setClinicalForm({ ...clinicalForm, test_types: newTypes });
                      }}
                      placeholder="如：PK、ADA、Nab"
                      className="flex-1"
                    />
                    {clinicalForm.test_types.length > 1 && (
                      <Button
                        plain
                        onClick={() => {
                          const newTypes = clinicalForm.test_types.filter((_, i) => i !== index);
                          setClinicalForm({ ...clinicalForm, test_types: newTypes });
                        }}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    )}
                    {index === clinicalForm.test_types.length - 1 && (
                      <Button
                        onClick={() => {
                          setClinicalForm({ 
                            ...clinicalForm, 
                            test_types: [...clinicalForm.test_types, ''] 
                          });
                        }}
                      >
                        <PlusIcon className="w-4 h-4" />
                      </Button>
                    )}
              </div>
                ))}
              </div>
            </div>

            {/* 正份 */}
              <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                正份 <span className="text-red-500">*</span>
                </label>
              <div className="space-y-2">
                {clinicalForm.primary_codes.map((code, index) => (
                  <div key={index} className="flex items-center gap-2">
                <Input
                      value={code}
                      onChange={(e) => {
                        const newCodes = [...clinicalForm.primary_codes];
                        newCodes[index] = e.target.value;
                        setClinicalForm({ ...clinicalForm, primary_codes: newCodes });
                      }}
                      placeholder="如：a1、a2、a3、a4"
                      className="flex-1"
                    />
                    {clinicalForm.primary_codes.length > 1 && (
                      <Button
                        plain
                        onClick={() => {
                          const newCodes = clinicalForm.primary_codes.filter((_, i) => i !== index);
                          setClinicalForm({ ...clinicalForm, primary_codes: newCodes });
                        }}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    )}
                    {index === clinicalForm.primary_codes.length - 1 && (
                      <Button
                        onClick={() => {
                          setClinicalForm({ 
                            ...clinicalForm, 
                            primary_codes: [...clinicalForm.primary_codes, ''] 
                          });
                        }}
                      >
                        <PlusIcon className="w-4 h-4" />
                      </Button>
                    )}
              </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                备份（套）
              </label>
              <Input
                type="number"
                value={clinicalForm.backup_count}
                onChange={(e) => setClinicalForm({ ...clinicalForm, backup_count: parseInt(e.target.value) || 0 })}
                min="0"
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
          <Button plain onClick={closeClinicalDialog}>
            取消
          </Button>
          <Button onClick={editingSampleType ? handleUpdateClinical : handleCreateClinical}>
            {editingSampleType ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 稳定性及质控样本对话框 */}
      <Dialog open={isQCDialogOpen} onClose={closeQCDialog}>
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
          <Button plain onClick={closeQCDialog}>
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
