import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Fieldset, Field, Label, FieldGroup } from '@/components/fieldset';
import { projectsAPI, api } from '@/lib/api';
import { useProjectStore } from '@/store/project';
import { OrganizationDialog } from '@/components/organization-dialog';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/20/solid';

interface ProjectForm {
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_ids: { value: string }[]; // 使用 field array
  test_types: string[]; // 检测类型
}

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'sponsor' | 'clinical'>('sponsor');
  
  // 检测类型相关状态
  const [globalTestTypes, setGlobalTestTypes] = useState<string[]>([]);
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>([]);
  const [newTestTypeInput, setNewTestTypeInput] = useState('');
  const [showTestTypeDropdown, setShowTestTypeDropdown] = useState(false);
  
  const addProject = useProjectStore((state) => state.addProject);
  const refreshProjects = useProjectStore((state) => state.fetchProjects);

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await api.get('/global-params/organizations');
      return response.data;
    },
  });

  // 获取全局检测类型
  useEffect(() => {
    const fetchGlobalTestTypes = async () => {
      try {
        const response = await api.get('/global-params/sample-types');
        const configs = response.data;
        const testTypes = new Set<string>();
        
        configs.forEach((config: any) => {
          if (config.test_type) {
            config.test_type.split(',').forEach((t: string) => testTypes.add(t.trim()));
          }
        });
        
        setGlobalTestTypes(Array.from(testTypes));
      } catch (error) {
        console.error('Failed to fetch global test types:', error);
      }
    };
    
    fetchGlobalTestTypes();
  }, []);

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
      clinical_org_ids: [{ value: '' }],
      test_types: []
    }
  });

  // 添加检测类型
  const handleAddTestType = (type: string) => {
    const trimmedType = type.trim();
    if (trimmedType && !selectedTestTypes.includes(trimmedType)) {
      setSelectedTestTypes([...selectedTestTypes, trimmedType]);
      setNewTestTypeInput('');
      setShowTestTypeDropdown(false);
    }
  };

  // 移除检测类型
  const handleRemoveTestType = (type: string) => {
    setSelectedTestTypes(selectedTestTypes.filter(t => t !== type));
  };

  // 过滤下拉选项
  const filteredTestTypes = globalTestTypes.filter(
    t => !selectedTestTypes.includes(t) && 
         t.toLowerCase().includes(newTestTypeInput.toLowerCase())
  );

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
      // 检查是否有新的检测类型需要添加到全局
      const newTypes = selectedTestTypes.filter(t => !globalTestTypes.includes(t));
      if (newTypes.length > 0) {
        // 将新的检测类型添加到全局参数
        try {
          await api.post('/global-params/sample-types', {
            category: 'clinical',
            test_type: newTypes.join(','),
            primary_count: 0,
            backup_count: 0,
          });
          toast.success(`已将新检测类型 ${newTypes.join(', ')} 添加到全局参数`);
        } catch (error) {
          console.error('Failed to add new test types to global:', error);
          // 继续创建项目，不阻止
        }
      }

      await createProjectMutation.mutateAsync({
        ...data,
        sponsor_id: Number(data.sponsor_id),
        clinical_org_ids: orgIds,
        clinical_org_id: orgIds[0], // 兼容性：设置第一个为 clinical_org_id
        test_types: selectedTestTypes, // 传递选中的检测类型
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

              {/* 检测类型选择 */}
              <Field>
                <Label>检测类型（可选）</Label>
                <Text className="text-xs text-zinc-500 mb-2">
                  从已有类型中选择，或输入新类型（新类型会自动添加到全局参数）
                </Text>
                
                {/* 已选择的检测类型 */}
                {selectedTestTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {selectedTestTypes.map((type, i) => (
                      <Badge key={i} color={globalTestTypes.includes(type) ? 'green' : 'blue'}>
                        {type}
                        <button
                          type="button"
                          onClick={() => handleRemoveTestType(type)}
                          className="ml-1.5 hover:text-red-500"
                        >
                          <XMarkIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                
                {/* 输入框和下拉选项 */}
                <div className="relative">
                  <Input
                    value={newTestTypeInput}
                    onChange={(e) => {
                      setNewTestTypeInput(e.target.value);
                      setShowTestTypeDropdown(true);
                    }}
                    onFocus={() => setShowTestTypeDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newTestTypeInput.trim()) {
                          handleAddTestType(newTestTypeInput);
                        }
                      }
                    }}
                    placeholder="输入检测类型（如 PK、ADA）后回车添加"
                  />
                  
                  {/* 下拉选项 */}
                  {showTestTypeDropdown && (filteredTestTypes.length > 0 || newTestTypeInput.trim()) && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredTestTypes.map((type, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAddTestType(type)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 flex items-center justify-between"
                        >
                          <span>{type}</span>
                          <Badge color="zinc" className="text-xs">已有</Badge>
                        </button>
                      ))}
                      {newTestTypeInput.trim() && !globalTestTypes.includes(newTestTypeInput.trim()) && !selectedTestTypes.includes(newTestTypeInput.trim()) && (
                        <button
                          type="button"
                          onClick={() => handleAddTestType(newTestTypeInput)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center justify-between border-t border-zinc-100"
                        >
                          <span>添加 "{newTestTypeInput.trim()}"</span>
                          <Badge color="blue" className="text-xs">新建</Badge>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 点击外部关闭下拉 */}
                {showTestTypeDropdown && (
                  <div 
                    className="fixed inset-0 z-0" 
                    onClick={() => setShowTestTypeDropdown(false)}
                  />
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
