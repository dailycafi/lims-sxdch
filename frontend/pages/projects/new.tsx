import { useState } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Fieldset, Field, Label } from '@/components/fieldset';
import { projectsAPI, api } from '@/lib/api';

interface ProjectForm {
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_id: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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
    formState: { errors },
  } = useForm<ProjectForm>();

  const createProjectMutation = useMutation({
    mutationFn: projectsAPI.createProject,
    onSuccess: () => {
      toast.success('项目创建成功');
      router.push('/projects');
    },
  });

  const onSubmit = async (data: ProjectForm) => {
    setIsLoading(true);
    try {
      await createProjectMutation.mutateAsync({
        ...data,
        sponsor_id: Number(data.sponsor_id),
        clinical_org_id: Number(data.clinical_org_id),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Heading level={1}>新建项目</Heading>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          <Fieldset>
            <Field>
              <Label>申办者项目编号</Label>
              <Input
                {...register('sponsor_project_code', { required: '请输入申办者项目编号' })}
                error={errors.sponsor_project_code?.message}
              />
            </Field>

            <Field>
              <Label>实验室项目编号</Label>
              <Input
                {...register('lab_project_code', { required: '请输入实验室项目编号' })}
                error={errors.lab_project_code?.message}
              />
            </Field>

            <Field>
              <Label>申办者</Label>
              <Select
                {...register('sponsor_id', { required: '请选择申办者' })}
                error={errors.sponsor_id?.message}
              >
                <option value="">请选择</option>
                {sponsors.map((org: any) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label>临床机构</Label>
              <Select
                {...register('clinical_org_id', { required: '请选择临床机构' })}
                error={errors.clinical_org_id?.message}
              >
                <option value="">请选择</option>
                {clinicalOrgs.map((org: any) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </Select>
            </Field>
          </Fieldset>

          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '创建中...' : '创建项目'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              取消
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
