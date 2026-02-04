import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/date-utils';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Heading } from '@/components/heading';
import { Select } from '@/components/select';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Textarea } from '@/components/textarea';
import { Tabs } from '@/components/tabs';
import { SearchInput } from '@/components/search-input';
import { api } from '@/lib/api';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon, BeakerIcon, TagIcon, ArchiveBoxIcon, PrinterIcon, QrCodeIcon } from '@heroicons/react/20/solid';
import JsBarcode from 'jsbarcode';
import { ESignatureDialog } from '@/components/e-signature-dialog';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Tooltip } from '@/components/tooltip';

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

type TabType = 'organizations' | 'clinical-samples' | 'qc-stability-samples' | 'storage-devices';

interface Freezer {
  id: number;
  name: string;
  barcode: string;
  location: string;
  temperature: number;
  description: string;
  total_shelves: number;
  is_active: boolean;
}

export default function GlobalParamsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [showOrgTypes, setShowOrgTypes] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgTypes, setOrgTypes] = useState<OrganizationType[]>([]);
  const [clinicalSamples, setClinicalSamples] = useState<SampleType[]>([]);
  const [qcSamples, setQcSamples] = useState<SampleType[]>([]);
  const [freezers, setFreezers] = useState<Freezer[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [isOrgTypeDialogOpen, setIsOrgTypeDialogOpen] = useState(false);
  
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editingOrgType, setEditingOrgType] = useState<OrganizationType | null>(null);
  const [selectedOrgType, setSelectedOrgType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 电子签名相关状态
  const [isESignatureOpen, setIsESignatureOpen] = useState(false);
  const [eSignatureAction, setESignatureAction] = useState<{
    type: 'edit_org' | 'delete_org' | 'edit_org_type' | 'delete_org_type';
    data?: any;
  } | null>(null);
  
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
    cycles: [''], // 周期数组
    test_types: [''], // 检测类型数组
    primary_codes: [''], // 正份代码数组
    backup_codes: [''], // 备份代码数组
    sample_types: [''], // 样本类型数组
    purposes: [''], // 用途数组
    transport_methods: [''], // 运输方式数组
    sample_statuses: [''], // 样本状态数组
    special_notes: [''], // 特殊事项数组
  });

  // 稳定性及质控样本表单数据 - 修改为数组形式
  const [qcForm, setQCForm] = useState({
    sample_categories: [''], // 样本类别数组 (STB/QC)
    codes: [''],      // 代码数组
    storage_conditions: [''], // 保存条件（温度）数组
  });

  // 审计理由
  const [auditReason, setAuditReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgsRes, orgTypesRes, sampleTypesRes, clinicalOptionsRes, qcOptionsRes, freezersRes] = await Promise.all([
        api.get('/global-params/organizations'),
        api.get('/global-params/organization-types'),
        api.get('/global-params/sample-types'),
        api.get('/global-params/clinical-sample-options').catch(() => ({ data: {} })),
        api.get('/global-params/qc-sample-options').catch(() => ({ data: {} })),
        api.get('/storage/freezers').catch(() => ({ data: [] })),
      ]);
      setOrganizations(orgsRes.data);
      setOrgTypes(orgTypesRes.data);
      setFreezers(freezersRes.data);
      
      const allSamples = sampleTypesRes.data as SampleType[];
      setClinicalSamples(allSamples.filter(s => s.category === 'clinical' || !s.category));
      setQcSamples(allSamples.filter(s => s.category === 'qc_stability'));
      
      // 加载临床样本配置选项
      const clinicalOptions = clinicalOptionsRes.data || {};
      setClinicalForm({
        cycles: clinicalOptions.cycles?.length > 0 ? clinicalOptions.cycles : [''],
        test_types: clinicalOptions.test_types?.length > 0 ? clinicalOptions.test_types : [''],
        primary_codes: clinicalOptions.primary_codes?.length > 0 ? clinicalOptions.primary_codes : [''],
        backup_codes: clinicalOptions.backup_codes?.length > 0 ? clinicalOptions.backup_codes : [''],
        sample_types: clinicalOptions.sample_types?.length > 0 ? clinicalOptions.sample_types : [''],
        purposes: clinicalOptions.purposes?.length > 0 ? clinicalOptions.purposes : [''],
        transport_methods: clinicalOptions.transport_methods?.length > 0 ? clinicalOptions.transport_methods : [''],
        sample_statuses: clinicalOptions.sample_statuses?.length > 0 ? clinicalOptions.sample_statuses : [''],
        special_notes: clinicalOptions.special_notes?.length > 0 ? clinicalOptions.special_notes : [''],
      });
      
      // 加载稳定性及质控样本配置选项
      const qcOptions = qcOptionsRes.data || {};
      setQCForm({
        sample_categories: qcOptions.sample_categories?.length > 0 ? qcOptions.sample_categories : [''],
        codes: qcOptions.codes?.length > 0 ? qcOptions.codes : [''],
        storage_conditions: qcOptions.storage_conditions?.length > 0 ? qcOptions.storage_conditions : [''],
      });
      
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

  const handleUpdateOrg = async (password?: string, reason?: string) => {
    if (!editingOrg) return;
    
    const finalReason = reason || auditReason;
    if (!finalReason.trim()) {
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
        audit_reason: finalReason.trim(),
        password: password,
      });
      setIsOrgDialogOpen(false);
      resetOrgForm();
      fetchData();
      toast.success('组织更新成功');
    } catch (error: any) {
      console.error('Failed to update organization:', error);
      throw new Error(error.response?.data?.detail || '更新失败');
    }
  };

  const handleDeleteOrg = async (id: number, password?: string, reason?: string) => {
    try {
      await api.delete(`/global-params/organizations/${id}`, {
        data: {
          password: password,
          audit_reason: reason,
        }
      });
      fetchData();
      toast.success('组织删除成功');
    } catch (error: any) {
      console.error('Failed to delete organization:', error);
      throw new Error(error.response?.data?.detail || '删除失败');
    }
  };
  
  // 打开删除组织的电子签名对话框
  const openDeleteOrgESignature = (org: Organization) => {
    setESignatureAction({ type: 'delete_org', data: org });
    setIsESignatureOpen(true);
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
    if (!orgTypeForm.label.trim()) {
      toast.error('请填写显示名称');
      return;
    }
    try {
      // 类型值由后端自动生成
      await api.post('/global-params/organization-types', {
        label: orgTypeForm.label,
      });
      setIsOrgTypeDialogOpen(false);
      resetOrgTypeForm();
      fetchData();
      toast.success('组织类型创建成功');
    } catch (error) {
      console.error('Failed to create organization type:', error);
    }
  };

  const handleUpdateOrgType = async (password?: string, reason?: string) => {
    if (!editingOrgType) return;
    if (!orgTypeForm.label.trim()) {
      toast.error('请填写显示名称');
      return;
    }
    try {
      await api.put(`/global-params/organization-types/${editingOrgType.id}`, {
        label: orgTypeForm.label,
        display_order: orgTypeForm.display_order,
        password: password,
        audit_reason: reason,
      });
      setIsOrgTypeDialogOpen(false);
      resetOrgTypeForm();
      fetchData();
      toast.success('组织类型更新成功');
    } catch (error: any) {
      console.error('Failed to update organization type:', error);
      throw new Error(error.response?.data?.detail || '更新失败');
    }
  };

  const handleDeleteOrgType = async (id: number, password?: string, reason?: string) => {
    try {
      await api.delete(`/global-params/organization-types/${id}`, {
        data: {
          password: password,
          audit_reason: reason,
        }
      });
      fetchData();
      toast.success('组织类型删除成功');
    } catch (error: any) {
      console.error('Failed to delete organization type:', error);
      throw new Error(error.response?.data?.detail || '删除失败');
    }
  };
  
  // 打开删除组织类型的电子签名对话框
  const openDeleteOrgTypeESignature = (orgType: OrganizationType) => {
    setESignatureAction({ type: 'delete_org_type', data: orgType });
    setIsESignatureOpen(true);
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
    setAuditReason('');
  };
  
  // 电子签名确认处理
  const handleESignatureConfirm = async (password: string, reason: string) => {
    if (!eSignatureAction) return;
    
    try {
      switch (eSignatureAction.type) {
        case 'edit_org':
          await handleUpdateOrg(password, reason);
          break;
        case 'delete_org':
          await handleDeleteOrg(eSignatureAction.data.id, password, reason);
          break;
        case 'edit_org_type':
          await handleUpdateOrgType(password, reason);
          break;
        case 'delete_org_type':
          await handleDeleteOrgType(eSignatureAction.data.id, password, reason);
          break;
      }
      setESignatureAction(null);
    } catch (error: any) {
      throw error;
    }
  };
  
  // 打开编辑组织的电子签名对话框
  const openEditOrgESignature = () => {
    setESignatureAction({ type: 'edit_org' });
    setIsESignatureOpen(true);
  };
  
  // 打开编辑组织类型的电子签名对话框
  const openEditOrgTypeESignature = () => {
    setESignatureAction({ type: 'edit_org_type' });
    setIsESignatureOpen(true);
  };

  // --- 临床样本配置选项管理 ---
  const handleSaveClinicalOptions = async () => {
    try {
      // 使用新的 API 保存配置选项
      await api.put('/global-params/clinical-sample-options', {
        cycles: clinicalForm.cycles.filter(v => v.trim()),
        test_types: clinicalForm.test_types.filter(v => v.trim()),
        primary_codes: clinicalForm.primary_codes.filter(v => v.trim()),
        backup_codes: clinicalForm.backup_codes.filter(v => v.trim()),
        sample_types: clinicalForm.sample_types.filter(v => v.trim()),
        purposes: clinicalForm.purposes.filter(v => v.trim()),
        transport_methods: clinicalForm.transport_methods.filter(v => v.trim()),
        sample_statuses: clinicalForm.sample_statuses.filter(v => v.trim()),
        special_notes: clinicalForm.special_notes.filter(v => v.trim()),
      });
      toast.success('临床样本配置保存成功');
      // 重新加载数据以确保显示最新状态
      fetchData();
    } catch (error) {
      console.error('Failed to save clinical sample options:', error);
      toast.error('保存失败，请重试');
    }
  };

  const resetClinicalForm = () => {
    setClinicalForm({
      cycles: [''],
      test_types: [''],
      primary_codes: [''],
      backup_codes: [''],
      sample_types: [''],
      purposes: [''],
      transport_methods: [''],
      sample_statuses: [''],
      special_notes: [''],
    });
    setAuditReason('');
  };

  // --- 稳定性及质控样本配置选项管理 ---
  const handleSaveQCOptions = async () => {
    try {
      await api.put('/global-params/qc-sample-options', {
        sample_categories: qcForm.sample_categories.filter(v => v.trim()),
        codes: qcForm.codes.filter(v => v.trim()),
        storage_conditions: qcForm.storage_conditions.filter(v => v.trim()),
      });
      toast.success('稳定性及质控样本配置保存成功');
      fetchData();
    } catch (error) {
      console.error('Failed to save QC sample options:', error);
      toast.error('保存失败，请重试');
    }
  };

  const resetQCForm = () => {
    setQCForm({
      sample_categories: [''],
      codes: [''],
      storage_conditions: [''],
    });
    setAuditReason('');
  };

  const getOrgTypeLabel = (type: string) => {
    const orgType = orgTypes.find(t => t.value === type);
    return orgType?.label || type;
  };

  const handlePrintBarcode = (text: string, label: string) => {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
      format: "CODE128",
      width: 2,
      height: 50,
      displayValue: true
    });
    const imgUrl = canvas.toDataURL("image/png");

    const win = window.open('', '', 'width=400,height=300');
    if (win) {
      win.document.write(`
        <html>
          <body style="text-align:center; padding: 20px;">
            <h3>${label}</h3>
            <img src="${imgUrl}" />
          </body>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </html>
      `);
      win.document.close();
    }
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
        {/* 标签页切换 */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { key: 'organizations', label: '组织管理' },
              { key: 'clinical-samples', label: '临床样本配置' },
              { key: 'qc-stability-samples', label: '稳定性及质控样本配置' },
              { key: 'storage-devices', label: '存储设备' }
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
                        <TableHeader>操作</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <AnimatedLoadingState colSpan={4} variant="skeleton" />
                      ) : filteredOrganizations.length === 0 ? (
                        <AnimatedEmptyState colSpan={4} text="暂无数据" />
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
                            <TableCell>
                              <div className="flex gap-2">
                                <Tooltip content="编辑">
                                  <Button plain onClick={() => openOrgDialog(org)}>
                                    <PencilIcon />
                                  </Button>
                                </Tooltip>
                                <Tooltip content="删除">
                                  <Button plain onClick={() => openDeleteOrgESignature(org)}>
                                    <TrashIcon />
                                  </Button>
                                </Tooltip>
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
                        <TableHeader>显示名称</TableHeader>
                        <TableHeader>系统预置</TableHeader>
                        <TableHeader>操作</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loading ? (
                        <AnimatedLoadingState colSpan={3} variant="skeleton" />
                      ) : orgTypes.length === 0 ? (
                        <AnimatedEmptyState colSpan={3} text="暂无数据" />
                      ) : (
                        orgTypes.map((orgType) => (
                          <TableRow key={orgType.id}>
                            <TableCell className="font-medium">{orgType.label}</TableCell>
                            <TableCell>
                              {orgType.is_system ? (
                                <Badge color="blue">系统</Badge>
                              ) : (
                                <Badge color="zinc">自定义</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Tooltip content="编辑">
                                  <Button plain onClick={() => openOrgTypeDialog(orgType)}>
                                    <PencilIcon />
                                  </Button>
                                </Tooltip>
                                {!orgType.is_system && (
                                  <Tooltip content="删除">
                                    <Button plain onClick={() => openDeleteOrgTypeESignature(orgType)}>
                                      <TrashIcon />
                                    </Button>
                                  </Tooltip>
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
            <Text className="text-zinc-600 mb-4">配置临床样本相关的下拉选项，这些选项将在新建项目时使用</Text>
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
              <div className="p-6 space-y-6">
                {/* 周期 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      周期
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.cycles.map((cycle, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={cycle}
                            autoFocus={index > 0 && index === clinicalForm.cycles.length - 1}
                            onChange={(e) => {
                              const newCycles = [...clinicalForm.cycles];
                              newCycles[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, cycles: newCycles });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && cycle.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  cycles: [...clinicalForm.cycles, ''] 
                                });
                              }
                            }}
                            placeholder="如：A、B、C"
                            className={inputClass}
                          />
                        </div>
                        {clinicalForm.cycles.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newCycles = clinicalForm.cycles.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, cycles: newCycles });
                            }}
                            title="删除"
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
                          cycles: [...clinicalForm.cycles, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>

                {/* 检测类型 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      检测类型
                    </label>
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
                            title="删除"
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

                {/* 正份代码 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      正份代码
                    </label>
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
                            title="删除"
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

                {/* 备份代码 */}
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
                            title="删除"
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

                {/* 样本类型 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      样本类型
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.sample_types.map((type, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={type}
                            autoFocus={index > 0 && index === clinicalForm.sample_types.length - 1}
                            onChange={(e) => {
                              const newTypes = [...clinicalForm.sample_types];
                              newTypes[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, sample_types: newTypes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && type.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  sample_types: [...clinicalForm.sample_types, ''] 
                                });
                              }
                            }}
                            placeholder="如：血浆、血清、全血"
                            className={`${inputClass} w-32`}
                          />
                        </div>
                        {clinicalForm.sample_types.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newTypes = clinicalForm.sample_types.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, sample_types: newTypes });
                            }}
                            title="删除"
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
                          sample_types: [...clinicalForm.sample_types, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>

                {/* 用途 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      用途
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.purposes.map((purpose, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={purpose}
                            autoFocus={index > 0 && index === clinicalForm.purposes.length - 1}
                            onChange={(e) => {
                              const newPurposes = [...clinicalForm.purposes];
                              newPurposes[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, purposes: newPurposes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && purpose.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  purposes: [...clinicalForm.purposes, ''] 
                                });
                              }
                            }}
                            placeholder="如：检测、留样、备份"
                            className={`${inputClass} w-32`}
                          />
                        </div>
                        {clinicalForm.purposes.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newPurposes = clinicalForm.purposes.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, purposes: newPurposes });
                            }}
                            title="删除"
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
                          purposes: [...clinicalForm.purposes, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>

                {/* 运输方式 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      运输方式
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.transport_methods.map((method, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={method}
                            autoFocus={index > 0 && index === clinicalForm.transport_methods.length - 1}
                            onChange={(e) => {
                              const newMethods = [...clinicalForm.transport_methods];
                              newMethods[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, transport_methods: newMethods });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && method.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  transport_methods: [...clinicalForm.transport_methods, ''] 
                                });
                              }
                            }}
                            placeholder="如：冷藏、冷冻、常温"
                            className={`${inputClass} w-32`}
                          />
                        </div>
                        {clinicalForm.transport_methods.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newMethods = clinicalForm.transport_methods.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, transport_methods: newMethods });
                            }}
                            title="删除"
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
                          transport_methods: [...clinicalForm.transport_methods, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>

                {/* 样本状态 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      样本状态
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.sample_statuses.map((status, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={status}
                            autoFocus={index > 0 && index === clinicalForm.sample_statuses.length - 1}
                            onChange={(e) => {
                              const newStatuses = [...clinicalForm.sample_statuses];
                              newStatuses[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, sample_statuses: newStatuses });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && status.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  sample_statuses: [...clinicalForm.sample_statuses, ''] 
                                });
                              }
                            }}
                            placeholder="如：正常、异常、溶血"
                            className={`${inputClass} w-32`}
                          />
                        </div>
                        {clinicalForm.sample_statuses.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newStatuses = clinicalForm.sample_statuses.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, sample_statuses: newStatuses });
                            }}
                            title="删除"
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
                          sample_statuses: [...clinicalForm.sample_statuses, ''] 
                        });
                      }}
                      className={buttonClass}
                    >
                      <PlusIcon className="w-4 h-4" />
                      添加
                    </Button>
                  </div>
                </div>

                {/* 特殊事项 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      特殊事项
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clinicalForm.special_notes.map((note, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={note}
                            autoFocus={index > 0 && index === clinicalForm.special_notes.length - 1}
                            onChange={(e) => {
                              const newNotes = [...clinicalForm.special_notes];
                              newNotes[index] = e.target.value;
                              setClinicalForm({ ...clinicalForm, special_notes: newNotes });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && note.trim()) {
                                e.preventDefault();
                                setClinicalForm({ 
                                  ...clinicalForm, 
                                  special_notes: [...clinicalForm.special_notes, ''] 
                                });
                              }
                            }}
                            placeholder="如：避光、低温保存"
                            className={`${inputClass} w-36`}
                          />
                        </div>
                        {clinicalForm.special_notes.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newNotes = clinicalForm.special_notes.filter((_, i) => i !== index);
                              setClinicalForm({ ...clinicalForm, special_notes: newNotes });
                            }}
                            title="删除"
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
                          special_notes: [...clinicalForm.special_notes, ''] 
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
                <Button onClick={handleSaveClinicalOptions}>
                  保存配置
                </Button>
              </div>
            </div>
          </>
        )}

        {/* 稳定性及质控样本配置内容 */}
        {activeTab === 'qc-stability-samples' && (
          <>
            <div className="mb-4">
              <Text className="text-zinc-600">配置稳定性及质控样本的选项列表，这些选项将在新建项目时作为下拉菜单供选择</Text>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
              <div className="p-6 space-y-6">
                {/* 样本类别 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      样本类别
                    </label>
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
                            title="删除"
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

                {/* 代码 */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      代码
                    </label>
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
                            title="删除"
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

                {/* 保存条件（温度） */}
                <div className="bg-zinc-50 rounded-lg p-5 border border-zinc-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                    <label className="text-sm font-semibold text-zinc-900">
                      保存条件
                    </label>
                    <span className="text-xs text-zinc-500">（温度选项）</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {qcForm.storage_conditions.map((condition, index) => (
                      <div key={index} className="flex items-center gap-1 h-10">
                        <div className={inputWrapperClass}>
                          <Input
                            value={condition}
                            autoFocus={index > 0 && index === qcForm.storage_conditions.length - 1}
                            onChange={(e) => {
                              const newConditions = [...qcForm.storage_conditions];
                              newConditions[index] = e.target.value;
                              setQCForm({ ...qcForm, storage_conditions: newConditions });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && condition.trim()) {
                                e.preventDefault();
                                setQCForm({
                                  ...qcForm,
                                  storage_conditions: [...qcForm.storage_conditions, '']
                                });
                              }
                            }}
                            placeholder="如：-80°C、-20°C、4°C"
                            className={`${inputClass} w-36`}
                          />
                        </div>
                        {qcForm.storage_conditions.length > 1 && (
                          <Button
                            plain
                            className={`${buttonClass} w-10 hover:bg-red-50 !p-0`}
                            onClick={() => {
                              const newConditions = qcForm.storage_conditions.filter((_, i) => i !== index);
                              setQCForm({ ...qcForm, storage_conditions: newConditions });
                            }}
                            title="删除"
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
                          storage_conditions: [...qcForm.storage_conditions, '']
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
                <Button onClick={handleSaveQCOptions}>
                  保存配置
                </Button>
              </div>
            </div>
          </>
        )}

        {/* 存储设备内容 */}
        {activeTab === 'storage-devices' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <Text className="text-zinc-600">管理冰箱、液氮罐等存储设备及其层级结构</Text>
              <div className="flex gap-2">
                <Button href="/storage/scan" outline className="whitespace-nowrap !px-5 !py-2.5 gap-x-2">
                  <QrCodeIcon className="!w-5 !h-5" />
                  扫描作业
                </Button>
                <Button href="/storage/new" className="whitespace-nowrap !px-5 !py-2.5 gap-x-2">
                  <PlusIcon className="!w-5 !h-5" />
                  添加设备
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>设备名称</TableHeader>
                    <TableHeader>条码</TableHeader>
                    <TableHeader>位置</TableHeader>
                    <TableHeader>温度设定</TableHeader>
                    <TableHeader>层数</TableHeader>
                    <TableHeader>状态</TableHeader>
                    <TableHeader>操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={7} variant="skeleton" />
                  ) : freezers.length === 0 ? (
                    <AnimatedEmptyState colSpan={7} text="暂无存储设备" />
                  ) : (
                    freezers.map(freezer => (
                      <TableRow key={freezer.id}>
                        <TableCell className="font-medium">{freezer.name}</TableCell>
                        <TableCell className="font-mono text-xs">{freezer.barcode || freezer.name}</TableCell>
                        <TableCell>{freezer.location || '-'}</TableCell>
                        <TableCell>{freezer.temperature}°C</TableCell>
                        <TableCell>{freezer.total_shelves} 层</TableCell>
                        <TableCell>
                          <Badge color={freezer.is_active ? 'green' : 'red'}>
                            {freezer.is_active ? '正常' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button plain href={`/storage/${freezer.id}`}>查看详情</Button>
                            <Tooltip content="打印条码">
                              <Button plain onClick={() => handlePrintBarcode(freezer.barcode || freezer.name, freezer.name)}>
                                <PrinterIcon className="w-4 h-4" />
                              </Button>
                            </Tooltip>
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
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={closeOrgDialog}>
            取消
          </Button>
          <Button onClick={editingOrg ? openEditOrgESignature : handleCreateOrg}>
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
                显示名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={orgTypeForm.label}
                onChange={(e) => setOrgTypeForm({ ...orgTypeForm, label: e.target.value })}
                placeholder="输入显示名称（如：生产厂家）"
                required
              />
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={closeOrgTypeDialog}>
            取消
          </Button>
          <Button onClick={editingOrgType ? openEditOrgTypeESignature : handleCreateOrgType}>
            {editingOrgType ? '保存修改' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      
      {/* 电子签名对话框 */}
      <ESignatureDialog
        open={isESignatureOpen}
        onClose={() => {
          setIsESignatureOpen(false);
          setESignatureAction(null);
        }}
        onConfirm={handleESignatureConfirm}
        title={
          eSignatureAction?.type === 'delete_org' ? '删除组织确认' :
          eSignatureAction?.type === 'edit_org' ? '编辑组织确认' :
          eSignatureAction?.type === 'delete_org_type' ? '删除组织类型确认' :
          eSignatureAction?.type === 'edit_org_type' ? '编辑组织类型确认' :
          '操作确认'
        }
        description={
          eSignatureAction?.type === 'delete_org' ? `确定要删除组织 "${eSignatureAction.data?.name}" 吗？此操作需要您的电子签名确认。` :
          eSignatureAction?.type === 'edit_org' ? '此修改操作需要您的电子签名确认。' :
          eSignatureAction?.type === 'delete_org_type' ? `确定要删除组织类型 "${eSignatureAction.data?.label}" 吗？此操作需要您的电子签名确认。` :
          eSignatureAction?.type === 'edit_org_type' ? '此修改操作需要您的电子签名确认。' :
          '此操作需要您的电子签名确认。'
        }
        actionType={eSignatureAction?.type?.includes('delete') ? 'delete' : 'default'}
        requireReason={true}
        reasonLabel="操作理由"
        reasonPlaceholder="请说明执行此操作的原因"
      />
    </AppLayout>
  );
}
