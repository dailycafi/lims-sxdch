import clsx from 'clsx';
import { useState, useEffect, useRef } from 'react';
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
import { Divider } from '@/components/divider';
import { Fieldset, Field, Label, FieldGroup } from '@/components/fieldset';
import { projectsAPI, api } from '@/lib/api';
import { useProjectStore } from '@/store/project';
import { OrganizationDialog } from '@/components/organization-dialog';
import { PlusIcon, TrashIcon, XMarkIcon, DocumentArrowUpIcon, CheckCircleIcon } from '@heroicons/react/20/solid';

interface ProjectForm {
  sponsor_project_code: string;
  lab_project_code: string;
  sponsor_id: number;
  clinical_org_ids: { value: string }[]; // 使用 field array
  test_types: string[]; // 检测类型
}

interface DetectionConfig {
  test_type: string;
  sample_type: string;
  primary_sets: number;
  backup_sets: number;
}

interface TestGroupConfig {
  cycle: string;
  dosage: string;
  planned_count: number;
  backup_count: number;
  subject_prefix: string;
  subject_start_number: number;
  detection_configs: DetectionConfig[];
}

export default function NewProjectPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'sponsor' | 'clinical'>('sponsor');

  // 检测类型相关状态
  const [globalTestTypes, setGlobalTestTypes] = useState<string[]>([]);
  const [globalSampleTypes, setGlobalSampleTypes] = useState<string[]>([]);
  const [globalCycles, setGlobalCycles] = useState<string[]>([]);
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>([]);
  const [newTestTypeInput, setNewTestTypeInput] = useState('');
  const [showTestTypeDropdown, setShowTestTypeDropdown] = useState(false);

  // 方案摘要导入相关状态
  const [schemaFile, setSchemaFile] = useState<File | null>(null);
  const [isParsingSchema, setIsParsingSchema] = useState(false);
  const [schemaImported, setSchemaImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 试验组配置状态
  const [testGroups, setTestGroups] = useState<TestGroupConfig[]>([]);
  const [showTestGroupSection, setShowTestGroupSection] = useState(false);

  const addProject = useProjectStore((state) => state.addProject);
  const refreshProjects = useProjectStore((state) => state.fetchProjects);

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await api.get('/global-params/organizations');
      return response.data;
    },
  });

  // 获取全局参数（检测类型、样本类型、周期等）
  useEffect(() => {
    const fetchGlobalParams = async () => {
      try {
        const [sampleTypesRes, clinicalOptionsRes] = await Promise.all([
          api.get('/global-params/sample-types'),
          api.get('/global-params/clinical-sample-options').catch(() => ({ data: {} })),
        ]);
        const configs = sampleTypesRes.data;
        const clinicalOptions = clinicalOptionsRes.data || {};
        const testTypes = new Set<string>();

        configs.forEach((config: any) => {
          if (config.test_type) {
            config.test_type.split(',').forEach((t: string) => testTypes.add(t.trim()));
          }
        });

        setGlobalTestTypes(clinicalOptions.test_types || Array.from(testTypes));
        setGlobalSampleTypes(clinicalOptions.sample_types || []);
        setGlobalCycles(clinicalOptions.cycles || []);
      } catch (error) {
        console.error('Failed to fetch global params:', error);
      }
    };

    fetchGlobalParams();
  }, []);

  // 处理方案摘要文件选择
  const handleSchemaFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSchemaFile(file);
      parseSchemaFile(file);
    }
  };

  // 解析方案摘要文件并自动填充表单
  const parseSchemaFile = async (file: File) => {
    setIsParsingSchema(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 调用后端解析接口
      const response = await api.post('/projects/parse-schema', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const parsedData = response.data;

      // 自动填充表单字段
      if (parsedData.sponsor_project_code) {
        setValue('sponsor_project_code', parsedData.sponsor_project_code);
      }
      if (parsedData.lab_project_code) {
        setValue('lab_project_code', parsedData.lab_project_code);
      }
      if (parsedData.sponsor_id) {
        setValue('sponsor_id', parsedData.sponsor_id);
      }
      if (parsedData.clinical_org_ids?.length > 0) {
        // 重置并设置临床机构
        while (fields.length > 0) {
          remove(0);
        }
        parsedData.clinical_org_ids.forEach((id: number) => {
          append({ value: String(id) });
        });
      }
      if (parsedData.test_types?.length > 0) {
        setSelectedTestTypes(parsedData.test_types);
      }
      if (parsedData.test_groups?.length > 0) {
        setTestGroups(parsedData.test_groups);
        setShowTestGroupSection(true);
      }

      setSchemaImported(true);
      toast.success('方案摘要导入成功，请检查并补充信息');
    } catch (error: any) {
      console.error('Failed to parse schema:', error);
      // 如果后端接口不存在，提示用户手动填写
      if (error.response?.status === 404) {
        toast.error('方案摘要解析功能暂未开放，请手动填写信息');
      } else {
        toast.error('方案摘要解析失败，请手动填写信息');
      }
    } finally {
      setIsParsingSchema(false);
    }
  };

  // 添加试验组
  const addTestGroup = () => {
    setTestGroups([
      ...testGroups,
      {
        cycle: '',
        dosage: '',
        planned_count: 0,
        backup_count: 0,
        subject_prefix: '',
        subject_start_number: 1,
        detection_configs: selectedTestTypes.map((t) => ({
          test_type: t,
          sample_type: '',
          primary_sets: 1,
          backup_sets: 0,
        })),
      },
    ]);
    setShowTestGroupSection(true);
  };

  // 删除试验组
  const removeTestGroup = (index: number) => {
    setTestGroups(testGroups.filter((_, i) => i !== index));
  };

  // 更新试验组
  const updateTestGroup = (index: number, field: keyof TestGroupConfig, value: any) => {
    const updated = [...testGroups];
    updated[index] = { ...updated[index], [field]: value };
    setTestGroups(updated);
  };

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
    onError: (error: any) => {
      const message = error.response?.data?.detail || '创建项目失败';
      toast.error(message);
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
      const projectData = await createProjectMutation.mutateAsync({
        ...data,
        sponsor_id: Number(data.sponsor_id),
        clinical_org_ids: orgIds,
        clinical_org_id: orgIds[0], // 兼容性：设置第一个为 clinical_org_id
        test_types: selectedTestTypes,
      } as any);

      // 如果配置了试验组，创建项目后自动创建试验组
      if (testGroups.length > 0 && projectData?.id) {
        try {
          await Promise.all(
            testGroups.map((group) =>
              api.post('/test-groups', {
                project_id: projectData.id,
                ...group,
              })
            )
          );
          toast.success('试验组配置已创建');
        } catch (error) {
          console.error('Failed to create test groups:', error);
          toast.error('部分试验组创建失败，请在项目详情页补充配置');
        }
      }
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
      <div className="max-w-3xl">
        <Heading level={1}>新建项目</Heading>

        {/* 方案摘要导入区域 */}
        <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <DocumentArrowUpIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-medium text-blue-900">导入方案摘要</h3>
              <p className="text-sm text-blue-700 mt-1">
                上传方案摘要文件，系统将自动解析并填充项目信息
              </p>
              <div className="mt-4 flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleSchemaFileSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  outline
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingSchema}
                >
                  {isParsingSchema ? '解析中...' : '选择文件'}
                </Button>
                {schemaFile && (
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    {schemaImported ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    ) : null}
                    <span>{schemaFile.name}</span>
                    {schemaImported && <span className="text-green-600">（已导入）</span>}
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                支持 Excel (.xlsx, .xls)、CSV、PDF 格式
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
          {/* 基本信息区块 */}
          <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 mb-6">基本信息</h2>
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
                  <Label className="w-32 flex-shrink-0">测试机构项目编号</Label>
                  <div className="flex-1">
                    <Input
                      {...register('lab_project_code', { required: '请输入测试机构项目编号' })}
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
                      className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
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
                        className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                      >
                        <PlusIcon className="size-3" />
                        <span>新建临床机构</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => append({ value: '' })}
                        className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
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
          </div>

          {/* 检测类型配置区块 */}
          <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 mb-2">检测类型配置</h2>
            <p className="text-sm text-zinc-500 mb-4">选择该项目需要进行的检测类型</p>

            <div className="space-y-4">
              {/* 检测类型选择/输入 */}
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={newTestTypeInput}
                      onChange={(e) => {
                        setNewTestTypeInput(e.target.value);
                        setShowTestTypeDropdown(true);
                      }}
                      onFocus={() => setShowTestTypeDropdown(true)}
                      onBlur={() => setTimeout(() => setShowTestTypeDropdown(false), 200)}
                      placeholder="输入或选择检测类型（如：PK、ADA、Nab）"
                    />
                    {showTestTypeDropdown && filteredTestTypes.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-48 overflow-auto">
                        {filteredTestTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100"
                            onClick={() => handleAddTestType(type)}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    outline
                    onClick={() => {
                      if (newTestTypeInput.trim()) {
                        handleAddTestType(newTestTypeInput.trim());
                      }
                    }}
                  >
                    添加
                  </Button>
                </div>
              </div>

              {/* 已选检测类型 */}
              {selectedTestTypes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTestTypes.map((type) => (
                    <Badge key={type} color="blue" className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1">
                      {type}
                      <button
                        type="button"
                        onClick={() => handleRemoveTestType(type)}
                        className="ml-1 text-blue-400 hover:text-blue-600"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 试验组配置区块 */}
          <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-zinc-900">试验组配置</h2>
              <Button type="button" outline onClick={addTestGroup}>
                <PlusIcon className="w-4 h-4" />
                添加试验组
              </Button>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              配置试验组信息（可选，也可在项目创建后配置）
            </p>

            {testGroups.length === 0 ? (
              <div className="bg-zinc-50 rounded-lg p-6 text-center">
                <Text className="text-zinc-500">暂未配置试验组，点击上方按钮添加</Text>
              </div>
            ) : (
              <div className="space-y-4">
                {testGroups.map((group, index) => (
                  <div key={index} className="border border-zinc-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-zinc-700">试验组 {index + 1}</span>
                      <Button type="button" plain onClick={() => removeTestGroup(index)}>
                        <TrashIcon className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">周期</label>
                        {globalCycles.length > 0 ? (
                          <Select
                            value={group.cycle}
                            onChange={(e) => updateTestGroup(index, 'cycle', e.target.value)}
                          >
                            <option value="">请选择</option>
                            {globalCycles.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            value={group.cycle}
                            onChange={(e) => updateTestGroup(index, 'cycle', e.target.value)}
                            placeholder="如：P1、P2"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">剂量组</label>
                        <Input
                          value={group.dosage}
                          onChange={(e) => updateTestGroup(index, 'dosage', e.target.value)}
                          placeholder="如：100mg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">计划例数</label>
                        <Input
                          type="number"
                          min={0}
                          value={group.planned_count}
                          onChange={(e) => updateTestGroup(index, 'planned_count', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">备份例数</label>
                        <Input
                          type="number"
                          min={0}
                          value={group.backup_count}
                          onChange={(e) => updateTestGroup(index, 'backup_count', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">编号前缀</label>
                        <Input
                          value={group.subject_prefix}
                          onChange={(e) => updateTestGroup(index, 'subject_prefix', e.target.value.toUpperCase())}
                          placeholder="如：R"
                          maxLength={10}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">起始编号</label>
                        <Input
                          type="number"
                          min={1}
                          value={group.subject_start_number}
                          onChange={(e) => updateTestGroup(index, 'subject_start_number', parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
