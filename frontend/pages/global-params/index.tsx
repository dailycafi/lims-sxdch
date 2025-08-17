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
import { api } from '@/lib/api';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/20/solid';

interface GlobalParam {
  id: number;
  category: string;
  name: string;
  value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

const paramCategories = [
  { value: 'unit_info', label: '单位/部门信息' },
  { value: 'clinical_sample', label: '临床样本信息' },
  { value: 'stability_sample', label: '稳定性及质控样本信息' },
];

export default function GlobalParamsPage() {
  const [params, setParams] = useState<GlobalParam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedParam, setSelectedParam] = useState<GlobalParam | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    name: '',
    value: '',
    description: '',
  });
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchParams();
  }, []);

  const fetchParams = async () => {
    try {
      const response = await api.get('/global_params');
      setParams(response.data);
    } catch (error) {
      console.error('Failed to fetch global params:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/global_params', formData);
      setIsCreateDialogOpen(false);
      setFormData({ category: '', name: '', value: '', description: '' });
      fetchParams();
    } catch (error) {
      console.error('Failed to create global param:', error);
    }
  };

  const handleEdit = async () => {
    if (!selectedParam) return;
    try {
      await api.put(`/global_params/${selectedParam.id}`, formData);
      setIsEditDialogOpen(false);
      setSelectedParam(null);
      setFormData({ category: '', name: '', value: '', description: '' });
      fetchParams();
    } catch (error) {
      console.error('Failed to update global param:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此参数吗？')) return;
    try {
      await api.delete(`/global_params/${id}`);
      fetchParams();
    } catch (error) {
      console.error('Failed to delete global param:', error);
    }
  };

  const openEditDialog = (param: GlobalParam) => {
    setSelectedParam(param);
    setFormData({
      category: param.category,
      name: param.name,
      value: param.value,
      description: param.description || '',
    });
    setIsEditDialogOpen(true);
  };

  const filteredParams = selectedCategory === 'all' 
    ? params 
    : params.filter(p => p.category === selectedCategory);

  const getCategoryLabel = (category: string) => {
    const cat = paramCategories.find(c => c.value === category);
    return cat?.label || category;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'unit_info':
        return 'blue';
      case 'clinical_sample':
        return 'green';
      case 'stability_sample':
        return 'purple';
      default:
        return 'zinc';
    }
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>全局参数管理</Heading>
            <Text className="mt-1 text-zinc-600">管理系统中使用的全局参数配置</Text>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon />
            新增参数
          </Button>
        </div>

        <div className="mb-6">
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-64"
          >
            <option value="all">所有类别</option>
            {paramCategories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </Select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>类别</TableHeader>
                <TableHeader>参数名称</TableHeader>
                <TableHeader>参数值</TableHeader>
                <TableHeader>描述</TableHeader>
                <TableHeader>更新时间</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Text>加载中...</Text>
                  </TableCell>
                </TableRow>
              ) : filteredParams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Text>暂无数据</Text>
                  </TableCell>
                </TableRow>
              ) : (
                filteredParams.map((param) => (
                  <TableRow key={param.id}>
                    <TableCell>
                      <Badge color={getCategoryColor(param.category)}>
                        {getCategoryLabel(param.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{param.name}</TableCell>
                    <TableCell>{param.value}</TableCell>
                    <TableCell className="text-zinc-600">
                      {param.description || '-'}
                    </TableCell>
                    <TableCell className="text-zinc-600">
                      {new Date(param.updated_at).toLocaleDateString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button plain onClick={() => openEditDialog(param)}>
                          <PencilIcon />
                        </Button>
                        <Button plain onClick={() => handleDelete(param.id)}>
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
      </div>

      {/* 创建对话框 */}
      <Dialog open={isCreateDialogOpen} onClose={setIsCreateDialogOpen}>
        <DialogTitle>新增全局参数</DialogTitle>
        <DialogDescription>
          添加新的全局参数配置
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                参数类别
              </label>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">请选择类别</option>
                {paramCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                参数名称
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：申办者名称"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                参数值
              </label>
              <Input
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="输入参数值"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                描述（可选）
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="参数说明"
              />
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsCreateDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleCreate}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onClose={setIsEditDialogOpen}>
        <DialogTitle>编辑全局参数</DialogTitle>
        <DialogDescription>
          修改全局参数配置
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                参数类别
              </label>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">请选择类别</option>
                {paramCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                参数名称
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：申办者名称"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                参数值
              </label>
              <Input
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="输入参数值"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                描述（可选）
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="参数说明"
              />
            </div>
            <div className="mt-4 p-3 bg-amber-50 rounded-lg">
              <Text className="text-sm text-amber-800">
                注意：修改参数需要输入修改理由，所有修改将被记录在审计日志中。
              </Text>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsEditDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleEdit}>
            保存修改
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
