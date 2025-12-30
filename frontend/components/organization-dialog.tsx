import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from '@/components/dialog';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Field, Label } from '@/components/fieldset';
import { Select } from '@/components/select';
import { Text } from '@/components/text';
import { GlobalParamsService } from '@/services/global-params.service';
import { Organization, OrganizationType } from '@/types/api';
import { toast } from 'react-hot-toast';

interface OrganizationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (org: Organization) => void;
  type?: string; // 默认类型，如 'sponsor' 或 'clinical'
}

export function OrganizationDialog({ open, onClose, onSuccess, type }: OrganizationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [orgTypes, setOrgTypes] = useState<OrganizationType[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    org_type: type || '',
    address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
  });

  useEffect(() => {
    if (open) {
      loadOrgTypes();
      setFormData({
        name: '',
        org_type: type || '',
        address: '',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
      });
    }
  }, [open, type]);

  const loadOrgTypes = async () => {
    try {
      const types = await GlobalParamsService.getOrganizationTypes();
      setOrgTypes(types);
      if (!formData.org_type && types.length > 0) {
        setFormData(prev => ({ ...prev, org_type: types[0].value }));
      }
    } catch (err) {
      console.error('加载组织类型失败:', err);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入组织名称');
      return;
    }
    if (!formData.org_type) {
      toast.error('请选择组织类型');
      return;
    }

    setLoading(true);
    try {
      const newOrg = await GlobalParamsService.createOrganization(formData);
      toast.success('组织创建成功');
      onSuccess?.(newOrg);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '创建组织失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <DialogTitle>{type === 'sponsor' ? '新建申办方' : type === 'clinical' ? '新建临床机构' : '新建组织/机构'}</DialogTitle>
      <DialogDescription>
        快速添加一个新的组织，添加后可在项目中选择。
      </DialogDescription>

      <DialogBody className="space-y-4">
        <Field>
          <Label>组织名称 *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="请输入组织名称"
          />
        </Field>

        <Field>
          <Label>组织类型 *</Label>
          <Select
            value={formData.org_type}
            onChange={(e) => setFormData(prev => ({ ...prev, org_type: e.target.value }))}
          >
            <option value="">请选择类型</option>
            {orgTypes.map(t => (
              <option key={t.id} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label>地址</Label>
          <Input
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="请输入地址"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label>联系人</Label>
            <Input
              value={formData.contact_person}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
              placeholder="姓名"
            />
          </Field>
          <Field>
            <Label>联系电话</Label>
            <Input
              value={formData.contact_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
              placeholder="电话"
            />
          </Field>
        </div>

        <Field>
          <Label>联系邮箱</Label>
          <Input
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
            placeholder="邮箱"
          />
        </Field>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? '创建中...' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

