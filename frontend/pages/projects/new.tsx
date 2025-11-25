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
import { Fieldset, Field, Label, FieldGroup } from '@/components/fieldset';
import { projectsAPI, api } from '@/lib/api';
import { useProjectStore } from '@/store/project';

interface ProjectForm {
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_id: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
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
    formState: { errors },
  } = useForm<ProjectForm>();

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
            <FieldGroup>
              <Field>
                <Label>申办方项目编号</Label>
                <Input
                  {...register('sponsor_project_code', { required: '请输入申办方项目编号' })}
                />
                {errors.sponsor_project_code && (
                  <p className="text-sm text-red-600 mt-1">{errors.sponsor_project_code.message}</p>
                )}
              </Field>

              <Field>
                <Label>实验室项目编号</Label>
                <Input
                  {...register('lab_project_code', { required: '请输入实验室项目编号' })}
                />
                {errors.lab_project_code && (
                  <p className="text-sm text-red-600 mt-1">{errors.lab_project_code.message}</p>
                )}
              </Field>

              <Field>
                <Label>申办方</Label>
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

              <Field>
                <Label>临床机构</Label>
                <Select
                  {...register('clinical_org_id', { required: '请选择临床机构' })}
                >
                  <option value="">请选择</option>
                  {clinicalOrgs.map((org: any) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
                {errors.clinical_org_id && (
                  <p className="text-sm text-red-600 mt-1">{errors.clinical_org_id.message}</p>
                )}
              </Field>
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
      </div>
    </AppLayout>
  );
}
