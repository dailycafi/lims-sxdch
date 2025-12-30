import { useState } from 'react';
import { useRouter } from 'next/router';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Fieldset, Field, Label, FieldGroup } from '@/components/fieldset';
import { projectsAPI, api } from '@/lib/api';
import { useProjectStore } from '@/store/project';
import { OrganizationDialog } from '@/components/organization-dialog';
import { PlusIcon, TrashIcon } from '@heroicons/react/20/solid';

interface ProjectForm {
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_ids: { value: string }[]; // 使用 field array
}

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'sponsor' | 'clinical'>('sponsor');
  
  const addProject = useProjectStore((state) => state.addProject);
  const refreshProjects = useProjectStore((state) => state.fetchProjects);

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await api.get('/global-params/organizations');
      return response.data;
    },
  });

  const sponsors = organizations?.filter((org: any) => org.org_type === 'sponsor') || [];
  const clinicalOrgs = organizations?.filter((org: any) => org.org_type === 'clinical') || [];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectForm>({
    defaultValues: {
      clinical_org_ids: [{ value: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'clinical_org_ids'
  });

  const createProjectMutation = useMutation({
    mutationFn: projectsAPI.createProject,
    onSuccess: async (data) => {
      toast.success('项目创建成功');
      addProject(data);
      await refreshProjects({ force: true });
      router.push('/projects');
    },
  });

  const onSubmit = async (data: ProjectForm) => {
    const orgIds = data.clinical_org_ids
      .map(item => item.value)
      .filter(id => id !== '')
      .map(id => Number(id));

    if (orgIds.length === 0) {
      toast.error('请至少选择一个临床机构');
      return;
    }

    setIsLoading(true);
    try {
      await createProjectMutation.mutateAsync({
        ...data,
        sponsor_id: Number(data.sponsor_id),
        clinical_org_ids: orgIds,
        clinical_org_id: orgIds[0], // 兼容性：设置第一个为 clinical_org_id
      } as any);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrgCreated = (newOrg: any) => {
    // 重新获取组织列表
    queryClient.invalidateQueries({ queryKey: ['organizations'] });
    
    // 如果是申办方，自动选中
    if (newOrg.org_type === 'sponsor') {
      setValue('sponsor_id', newOrg.id);
    } else if (newOrg.org_type === 'clinical') {
      // 如果是临床机构，添加到列表并选中
      const emptyIndex = data.clinical_org_ids.findIndex(item => item.value === '');
      if (emptyIndex !== -1) {
        setValue(`clinical_org_ids.${emptyIndex}.value`, String(newOrg.id));
      } else {
        append({ value: String(newOrg.id) });
      }
    }
  };

  const data = watch();

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Heading level={1}>新建项目</Heading>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          <Fieldset>
            <FieldGroup>
              <Field className="flex items-center gap-4">
                <Label className="w-32 flex-shrink-0">申办方项目编号</Label>
                <div className="flex-1">
                  <Input
                    {...register('sponsor_project_code', { required: '请输入申办方项目编号' })}
                  />
                  {errors.sponsor_project_code && (
                    <p className="text-sm text-red-600 mt-1">{errors.sponsor_project_code.message}</p>
                  )}
                </div>
              </Field>

              <Field className="flex items-center gap-4">
                <Label className="w-32 flex-shrink-0">实验室项目编号</Label>
                <div className="flex-1">
                  <Input
                    {...register('lab_project_code', { required: '请输入实验室项目编号' })}
                  />
                  {errors.lab_project_code && (
                    <p className="text-sm text-red-600 mt-1">{errors.lab_project_code.message}</p>
                  )}
                </div>
              </Field>

              <Field>
                <div className="flex justify-between items-center mb-1">
                  <Label>申办方</Label>
                  <button
                    type="button"
                    onClick={() => { setDialogType('sponsor'); setDialogOpen(true); }}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    <PlusIcon className="size-3" />
                    <span>新建申办方</span>
                  </button>
                </div>
                <Select
                  {...register('sponsor_id', { required: '请选择申办方' })}
                >
                  <option value="">请选择</option>
                  {sponsors.map((org: any) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
                {errors.sponsor_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.sponsor_id.message}</p>
                )}
              </Field>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>临床机构</Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => { setDialogType('clinical'); setDialogOpen(true); }}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      <PlusIcon className="size-3" />
                      <span>新建临床机构</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => append({ value: '' })}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      <PlusIcon className="size-3" />
                      <span>添加临床机构</span>
                    </button>
                  </div>
                </div>
                
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Select
                        {...register(`clinical_org_ids.${index}.value` as const, { required: '请选择临床机构' })}
                      >
                        <option value="">请选择</option>
                        {clinicalOrgs.map((org: any) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        plain
                        onClick={() => remove(index)}
                        className="mt-1"
                      >
                        <TrashIcon className="size-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </FieldGroup>
          </Fieldset>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '创建中...' : '创建项目'}
            </Button>
            <Button type="button" plain onClick={() => router.back()}>
              取消
            </Button>
          </div>
        </form>

        <OrganizationDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          type={dialogType}
          onSuccess={handleOrgCreated}
        />
      </div>
    </AppLayout>
  );
}
