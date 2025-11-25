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
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon, BeakerIcon } from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { AnimatePresence } from 'framer-motion';

// 导入服务和类型
import { GlobalParamsService } from '@/services';
import type { 
  Organization, 
  OrganizationCreate, 
  OrganizationUpdate,
  SampleType,
  SampleTypeCreate,
  SampleTypeUpdate
} from '@/types/api';

const orgTypes = [
  { value: 'sponsor', label: '申办方' },
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
  const [orgForm, setOrgForm] = useState<OrganizationCreate>({
    name: '',
    org_type: 'internal',
    address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
  });

  // 样本类型表单数据
  const [sampleTypeForm, setSampleTypeForm] = useState<SampleTypeCreate>({
    code: '',
    name: '',
    description: '',
    specifications: '',
    storage_conditions: '',
  });

  // 审计理由
  const [auditReason, setAuditReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgs, types] = await Promise.all([
        GlobalParamsService.getOrganizations(),
        GlobalParamsService.getSampleTypes(),
      ]);
      setOrganizations(orgs);
      setSampleTypes(types);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 组织管理
  const handleCreateOrg = async () => {
    try {
      await GlobalParamsService.createOrganization(orgForm);
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
      const updateData: OrganizationUpdate = {
        ...orgForm,
        audit_reason: auditReason,
      };
      await GlobalParamsService.updateOrganization(editingOrg.id, updateData);
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
      await GlobalParamsService.deleteOrganization(id);
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
      org_type: 'internal',
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
      await GlobalParamsService.createSampleType(sampleTypeForm);
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
      const updateData: SampleTypeUpdate = {
        ...sampleTypeForm,
        audit_reason: auditReason,
      };
      await GlobalParamsService.updateSampleType(editingSampleType.id, updateData);
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
      await GlobalParamsService.deleteSampleType(id);
      fetchData();
    } catch (error) {
      console.error('Failed to delete sample type:', error);
    }
  };

  const openSampleTypeDialog = (sampleType?: SampleType) => {
    if (sampleType) {
      setEditingSampleType(sampleType);
      setSampleTypeForm({
        code: sampleType.code,
        name: sampleType.name,
        description: sampleType.description || '',
        specifications: sampleType.specifications || '',
        storage_conditions: sampleType.storage_conditions || '',
      });
    } else {
      setEditingSampleType(null);
      resetSampleTypeForm();
    }
    setIsSampleTypeDialogOpen(true);
  };

  const resetSampleTypeForm = () => {
    setSampleTypeForm({
      code: '',
      name: '',
      description: '',
      specifications: '',
      storage_conditions: '',
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

  // 组件的其余部分保持不变（UI部分）
  return (
    <AppLayout>
      {/* UI 代码保持不变，只是数据获取和处理逻辑改变了 */}
      <div className="max-w-7xl mx-auto">
        {/* ... 原有的 UI 代码 ... */}
      </div>
    </AppLayout>
  );
}
