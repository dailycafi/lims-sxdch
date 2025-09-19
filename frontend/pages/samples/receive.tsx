import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { 
  PlusIcon, 
  CheckIcon, 
  BeakerIcon,
  TruckIcon,
  CloudArrowUpIcon,
  QrCodeIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/20/solid';
import { Tabs } from '@/components/tabs';
import { SearchInput } from '@/components/search-input';
import { AnimatedLoadingState } from '@/components/animated-table';
import clsx from 'clsx'
import React from 'react'
import { ProjectsService, GlobalParamsService, SamplesService } from '@/services';

interface ReceiveTask {
  id: number;
  project_id: number;
  project_name: string;
  clinical_site: string;
  transport_company: string;
  transport_method: string;
  temperature_monitor_id: string;
  sample_count: number;
  sample_status: string;
  received_by: string;
  received_at: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export default function SampleReceivePage() {
  const [tasks, setTasks] = useState<ReceiveTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [temperatureFile, setTemperatureFile] = useState<File | null>(null);
  const [expressPhotos, setExpressPhotos] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    clinical_site: '',
    transport_company: '',
    transport_method: '',
    temperature_monitor_id: '',
    sample_count: '',
    sample_status: '',
    storage_location: '',
    temperature_file: null as File | null,
  });

  // 添加排序和筛选状态
  const [sortField, setSortField] = useState<string>('received_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');

  // 增强筛选状态
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    receiveNumber: '',
    project: 'all',
    clinicalSite: 'all',
    transportMethod: 'all',
    receiver: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
    sampleCountMin: '',
    sampleCountMax: ''
  });

  // 修复 viewMode 类型定义
  const [viewMode, setViewMode] = useState<'pending' | 'in_progress' | 'completed' | 'all'>('pending');

  // 添加筛选区域展开/折叠状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  useEffect(() => {
    fetchReceiveTasks();
    fetchProjects();
    fetchOrganizations();
  }, []);

  const fetchReceiveTasks = async () => {
    try {
      const response = await api.get('/samples/receive-tasks');
      setTasks(response.data);
    } catch (error: any) {
      // 401错误已经被api拦截器静默处理，这里只处理其他错误
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        console.error('Failed to fetch receive tasks:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const projects = await ProjectsService.getProjects();
      setProjects(projects);
    } catch (error: any) {
      // 401错误已经被api拦截器静默处理，这里只处理其他错误
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        console.error('Failed to fetch projects:', error);
      }
    }
  };

  const fetchOrganizations = async () => {
    try {
      const organizations = await GlobalParamsService.getOrganizations();
      setOrganizations(organizations);
    } catch (error: any) {
      // 401错误已经被api拦截器静默处理，这里只处理其他错误
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        console.error('Failed to fetch organizations:', error);
      }
    }
  };

  const handleReceive = async () => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('project_id', selectedProject);
      formDataToSend.append('clinical_org_id', formData.clinical_site);
      formDataToSend.append('transport_org_id', formData.transport_company);
      formDataToSend.append('transport_method', formData.transport_method);
      formDataToSend.append('temperature_monitor_id', formData.temperature_monitor_id);
      formDataToSend.append('sample_count', formData.sample_count);
      formDataToSend.append('sample_status', formData.sample_status);
      formDataToSend.append('storage_location', formData.storage_location);
      
      if (temperatureFile) {
        formDataToSend.append('temperature_file', temperatureFile);
      }
      
      expressPhotos.forEach((photo, index) => {
        formDataToSend.append(`express_photos[${index}]`, photo);
      });

      const response = await api.post('/samples/receive-task', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setIsReceiveDialogOpen(false);
      resetForm();
      fetchReceiveTasks();
    } catch (error: any) {
      // 401错误已经被api拦截器静默处理，这里只处理其他错误
      if (error?.response?.status !== 401 && !error?.isAuthError) {
        console.error('Failed to receive samples:', error);
      }
    }
  };

  const handleStartInventory = async (taskId: number) => {
    // 跳转到清点页面
    window.location.href = `/samples/inventory/${taskId}`;
  };

  const resetForm = () => {
    setSelectedProject('');
    setFormData({
      clinical_site: '',
      transport_company: '',
      transport_method: '',
      temperature_monitor_id: '',
      sample_count: '',
      sample_status: '',
      storage_location: '',
      temperature_file: null,  // 添加缺失的 temperature_file 属性
    });
    setTemperatureFile(null);
    setExpressPhotos([]);
  };

  const handleTemperatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTemperatureFile(e.target.files[0]);
    }
  };

  const handleExpressPhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setExpressPhotos(Array.from(e.target.files));
    }
  };

  const clinicalOrgs = organizations.filter(org => org.org_type === 'clinical');
  const transportOrgs = organizations.filter(org => org.org_type === 'transport');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge color="amber" className="gap-1.5">
            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            待清点
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge color="blue" className="gap-1.5">
            <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500" />
            清点中
          </Badge>
        );
      case 'completed':
        return (
          <Badge color="green" className="gap-1.5">
            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />
            已完成
          </Badge>
        );
      default:
        return <Badge color="zinc">{status}</Badge>;
    }
  };

  // 修改运输方式的显示函数，去掉图标
  const getTransportMethodDisplay = (method: string) => {
    const methodMap: Record<string, string> = {
      'cold_chain': '冷链运输（2-8℃）',
      'frozen': '冷冻运输（-20℃）',
      'ultra_frozen': '超低温运输（-80℃）',
      'room_temp': '常温运输'
    };
    
    return methodMap[method] || method;
  };

  // 添加排序函数
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 获取唯一值用于筛选下拉框
  const uniqueClinicalSites = tasks.map(t => t.clinical_site).filter((v, i, a) => a.indexOf(v) === i);
  const uniqueReceivers = tasks.map(t => t.received_by).filter((v, i, a) => a.indexOf(v) === i);
  const uniqueTransportMethods = tasks.map(t => t.transport_method).filter((v, i, a) => a.indexOf(v) === i);

  // 应用筛选
  const applyFilters = () => {
    return tasks.filter(task => {
      // 接收编号筛选
      if (filters.receiveNumber && !`RCV-${task.id.toString().padStart(4, '0')}`.includes(filters.receiveNumber)) {
        return false;
      }
      
      // 项目筛选
      if (filters.project !== 'all' && task.project_id.toString() !== filters.project) {
        return false;
      }
      
      // 临床机构筛选
      if (filters.clinicalSite !== 'all' && task.clinical_site !== filters.clinicalSite) {
        return false;
      }
      
      // 运输方式筛选
      if (filters.transportMethod !== 'all' && task.transport_method !== filters.transportMethod) {
        return false;
      }
      
      // 接收人筛选
      if (filters.receiver !== 'all' && task.received_by !== filters.receiver) {
        return false;
      }
      
      // 状态筛选
      if (filters.status !== 'all' && task.status !== filters.status) {
        return false;
      }
      
      // 日期范围筛选
      const taskDate = new Date(task.received_at);
      if (filters.dateFrom && new Date(filters.dateFrom) > taskDate) {
        return false;
      }
      if (filters.dateTo && new Date(filters.dateTo) < taskDate) {
        return false;
      }
      
      // 样本数量范围筛选
      if (filters.sampleCountMin && task.sample_count < parseInt(filters.sampleCountMin)) {
        return false;
      }
      if (filters.sampleCountMax && task.sample_count > parseInt(filters.sampleCountMax)) {
        return false;
      }
      
      return true;
    });
  };

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      receiveNumber: '',
      project: 'all',
      clinicalSite: 'all',
      transportMethod: 'all',
      receiver: 'all',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      sampleCountMin: '',
      sampleCountMax: ''
    });
  };

  // 添加应用视图模式的过滤
  const filteredByViewMode = (tasks: ReceiveTask[]) => {
    if (viewMode === 'all') return tasks;
    if (viewMode === 'pending') return tasks.filter(t => t.status === 'pending');
    if (viewMode === 'in_progress') return tasks.filter(t => t.status === 'in_progress');
    if (viewMode === 'completed') return tasks.filter(t => t.status === 'completed');
    return tasks;
  };

  // 获取过滤和排序后的任务
  const filteredAndSortedTasks = filteredByViewMode(applyFilters())
    .sort((a, b) => {
      let aValue = a[sortField as keyof ReceiveTask];
      let bValue = b[sortField as keyof ReceiveTask];
      
      if (sortField === 'received_at') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  // 计算活跃筛选器数量
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    return value !== '' && value !== 'all';
  }).length;

  // 创建可排序的表头组件
  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHeader 
      className={`${field !== 'operation' ? 'cursor-pointer hover:bg-zinc-50 select-none' : ''} ${field === 'id' ? 'pl-6' : ''} ${field === 'operation' ? 'pr-6' : ''}`}
      onClick={() => field !== 'operation' && handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {field !== 'operation' && (
          <div className="flex flex-col">
            <ChevronUpIcon 
              className={`h-3 w-3 -mb-1 ${sortField === field && sortOrder === 'asc' ? 'text-zinc-900' : 'text-zinc-300'}`} 
            />
            <ChevronDownIcon 
              className={`h-3 w-3 -mt-1 ${sortField === field && sortOrder === 'desc' ? 'text-zinc-900' : 'text-zinc-300'}`} 
            />
          </div>
        )}
      </div>
    </TableHeader>
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题和操作按钮 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>样本接收</Heading>
            <Text className="mt-1 text-zinc-600">接收和记录新的样本信息</Text>
          </div>
          <Button color="blue" onClick={() => setIsReceiveDialogOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            新建接收任务
          </Button>
        </div>

        {/* 筛选区域 - 可折叠 */}
        <div className="bg-white rounded-lg shadow-md border border-gray-100 mb-6 overflow-hidden">
          {/* 筛选标题栏 */}
          <div 
            className="px-5 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          >
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">筛选条件</span>
              {activeFilterCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <motion.div
              animate={{ rotate: isFilterExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            </motion.div>
          </div>

          {/* 可折叠的筛选内容 */}
          <AnimatePresence initial={false}>
            {isFilterExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="p-5">
                  {/* 搜索框行 */}
                  <div className="mb-4">
                    <Input
                      type="text"
                      placeholder="搜索接收编号..."
                      value={filters.receiveNumber}
                      onChange={(e) => setFilters({ ...filters, receiveNumber: e.target.value })}
                      className="w-full max-w-md h-11"
                    />
                  </div>

                  {/* 筛选器行 */}
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">临床机构</label>
                      <Select
                        value={filters.clinicalSite}
                        onChange={(e) => setFilters({ ...filters, clinicalSite: e.target.value })}
                        className="w-full h-11"
                      >
                        <option value="all">全部</option>
                        {uniqueClinicalSites.map(site => (
                          <option key={site} value={site}>{site}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">运输方式</label>
                      <Select
                        value={filters.transportMethod}
                        onChange={(e) => setFilters({ ...filters, transportMethod: e.target.value })}
                        className="w-full h-11"
                      >
                        <option value="all">全部</option>
                        <option value="cold_chain">冷链运输</option>
                        <option value="frozen">冷冻运输</option>
                        <option value="ultra_frozen">超低温运输</option>
                        <option value="room_temp">常温运输</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">接收人</label>
                      <Select
                        value={filters.receiver}
                        onChange={(e) => setFilters({ ...filters, receiver: e.target.value })}
                        className="w-full h-11"
                      >
                        <option value="all">全部</option>
                        {uniqueReceivers.map(receiver => (
                          <option key={receiver} value={receiver}>{receiver}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      {activeFilterCount > 0 && (
                        <Button
                          color="white"
                          onClick={resetFilters}
                          className="h-11"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          清除筛选
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 日期范围和样本数量筛选 - 第二行 */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">接收日期范围</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                          className="flex-1 h-11"
                        />
                        <span className="text-gray-500">至</span>
                        <Input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                          className="flex-1 h-11"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">样本数量范围</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="最小"
                          value={filters.sampleCountMin}
                          onChange={(e) => setFilters({ ...filters, sampleCountMin: e.target.value })}
                          className="flex-1 h-11"
                        />
                        <span className="text-gray-500">-</span>
                        <Input
                          type="number"
                          placeholder="最大"
                          value={filters.sampleCountMax}
                          onChange={(e) => setFilters({ ...filters, sampleCountMax: e.target.value })}
                          className="flex-1 h-11"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 表格容器 - 增强立体感，tabs无缝集成 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          {/* Tabs 栏 - 无缝集成到表格 */}
          <div className="bg-gray-50 px-6 py-3">
            <Tabs
              tabs={[
                { key: 'pending', label: '待处理' },
                { key: 'in_progress', label: '处理中' },
                { key: 'completed', label: '已完成' },
                { key: 'all', label: '全部' }
              ]}
              activeTab={viewMode}
              onChange={(key) => setViewMode(key as 'pending' | 'in_progress' | 'completed' | 'all')}
            />
          </div>

          {/* 结果统计 - 移除多余的边框 */}
          <div className="px-6 py-3 bg-gray-50/50">
            <Text className="text-sm text-zinc-600">
              共 {filteredAndSortedTasks.length} 条记录
              {activeFilterCount > 0 && ` (已应用 ${activeFilterCount} 个筛选条件)`}
            </Text>
          </div>
          
          {/* 表格内容 - 无内边距，让表格充满容器 */}
          <div>
            <Table bleed={true} striped>
              <TableHead>
                <TableRow>
                  <SortableHeader field="id">接收编号</SortableHeader>
                  <SortableHeader field="project_name">项目</SortableHeader>
                  <SortableHeader field="clinical_site">临床机构</SortableHeader>
                  <SortableHeader field="sample_count">样本数量</SortableHeader>
                  <SortableHeader field="transport_method">运输方式</SortableHeader>
                  <SortableHeader field="received_by">接收人</SortableHeader>
                  <SortableHeader field="received_at">接收时间</SortableHeader>
                  <SortableHeader field="status">状态</SortableHeader>
                  <SortableHeader field="operation">操作</SortableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence mode="wait">
                  {loading ? (
                    <AnimatedLoadingState colSpan={9} variant="skeleton" />
                  ) : filteredAndSortedTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="flex flex-col items-center gap-3"
                        >
                          <BeakerIcon className="h-12 w-12 text-zinc-300" />
                          <Text className="text-zinc-500">
                            {activeFilterCount > 0 
                              ? '没有符合筛选条件的接收任务' 
                              : '暂无接收任务'}
                          </Text>
                        </motion.div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedTasks.map((task, index) => (
                      <motion.tr
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="hover:bg-zinc-50/50 transition-colors"
                      >
                        <TableCell className="font-medium pl-6">
                          <span className="text-zinc-900">RCV-{task.id.toString().padStart(4, '0')}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-zinc-900">{task.project_name}</span>
                        </TableCell>
                        <TableCell className="text-zinc-600">{task.clinical_site}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <BeakerIcon className="h-4 w-4 text-zinc-400" />
                            <span className="font-medium">{task.sample_count}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-zinc-600 text-sm">
                          {getTransportMethodDisplay(task.transport_method)}
                        </TableCell>
                        <TableCell className="text-zinc-600">{task.received_by}</TableCell>
                        <TableCell className="text-zinc-500 text-sm">
                          {new Date(task.received_at).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell>{getStatusBadge(task.status)}</TableCell>
                        <TableCell className="pr-6">
                          {task.status === 'pending' && (
                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Button 
                                color="blue" 
                                onClick={() => handleStartInventory(task.id)}
                                className="gap-1.5"
                              >
                                <CheckIcon className="h-4 w-4" />
                                开始清点
                              </Button>
                            </motion.div>
                          )}
                          {task.status === 'in_progress' && (
                            <motion.div
                              className="flex items-center gap-2"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Button 
                                color="blue" 
                                onClick={() => handleStartInventory(task.id)}
                                className="gap-1.5"
                              >
                                <CheckIcon className="h-4 w-4" />
                                继续清点
                              </Button>
                            </motion.div>
                          )}
                          {task.status === 'completed' && (
                            <div className="flex items-center gap-2">
                              <Button 
                                outline
                                onClick={() => window.location.href = `/samples/inventory/${task.id}`}
                                className="gap-1.5"
                              >
                                查看详情
                              </Button>
                              <Button 
                                plain
                                onClick={() => window.open(`${api.defaults.baseURL}/samples/receive-records/${task.id}/export`, '_blank')}
                                className="gap-1.5"
                              >
                                导出清单
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>

      {/* 接收样本对话框 */}
      <Dialog open={isReceiveDialogOpen} onClose={setIsReceiveDialogOpen} size="4xl">
        <DialogTitle>接收样本</DialogTitle>
        <DialogDescription>
          录入样本接收信息，生成清点任务
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  项目 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  required
                >
                  <option value="">请选择项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.lab_project_code} - {project.sponsor_project_code}
                    </option>
                  ))}
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  临床机构/分中心 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.clinical_site}
                  onChange={(e) => setFormData({ ...formData, clinical_site: e.target.value })}
                  required
                >
                  <option value="">请选择临床机构</option>
                  {clinicalOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  运输单位/部门 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.transport_company}
                  onChange={(e) => setFormData({ ...formData, transport_company: e.target.value })}
                  required
                >
                  <option value="">请选择运输单位</option>
                  {transportOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  运输方式 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.transport_method}
                  onChange={(e) => setFormData({ ...formData, transport_method: e.target.value })}
                  required
                >
                  <option value="">请选择运输方式</option>
                  <option value="cold_chain">冷链运输（2-8℃）</option>
                  <option value="frozen">冷冻运输（-20℃）</option>
                  <option value="ultra_frozen">超低温运输（-80℃）</option>
                  <option value="room_temp">常温运输</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  温度记录仪编号/序列号 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.temperature_monitor_id}
                  onChange={(e) => setFormData({ ...formData, temperature_monitor_id: e.target.value })}
                  placeholder="输入温度记录仪编号"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  温度数据文件
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormData({ ...formData, temperature_file: file });
                      }
                    }}
                  />
                  {formData.temperature_file && (
                    <Text className="text-sm text-zinc-600">
                      已选择: {formData.temperature_file.name}
                    </Text>
                  )}
                </div>
                <Text className="text-xs text-zinc-500 mt-1">
                  支持格式：CSV, Excel, TXT, PDF
                </Text>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  样本数量 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.sample_count}
                  onChange={(e) => setFormData({ ...formData, sample_count: e.target.value })}
                  placeholder="输入样本数量"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  样本状态 <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.sample_status}
                  onChange={(e) => setFormData({ ...formData, sample_status: e.target.value })}
                  required
                >
                  <option value="">请选择样本状态</option>
                  <option value="good">完好</option>
                  <option value="damaged">包装破损</option>
                  <option value="thawed">疑似解冻</option>
                  <option value="other">其他异常</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  暂存位置
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.storage_location}
                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    placeholder="扫描冰箱条码或手动输入"
                  />
                  <Button plain>
                    <QrCodeIcon />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  温度数据文件
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleTemperatureFileChange}
                      className="hidden"
                    />
                    <div className="inline-flex items-baseline justify-center gap-x-2 rounded-lg border px-3 py-2 text-sm font-semibold border-zinc-950/10 text-zinc-950 hover:bg-zinc-950/2.5 cursor-pointer">
                      <CloudArrowUpIcon className="w-4 h-4" />
                      上传温度数据
                    </div>
                  </label>
                  {temperatureFile ? (
                    <Text className="text-sm text-green-600">已选择: {temperatureFile.name}</Text>
                  ) : (
                    <Text className="text-sm text-zinc-500">支持 CSV, Excel 格式</Text>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  快递单及其他照片
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      multiple
                      onChange={handleExpressPhotosChange}
                      className="hidden"
                    />
                    <div className="inline-flex items-baseline justify-center gap-x-2 rounded-lg border px-3 py-2 text-sm font-semibold border-zinc-950/10 text-zinc-950 hover:bg-zinc-950/2.5 cursor-pointer">
                      <CloudArrowUpIcon className="w-4 h-4" />
                      上传照片
                    </div>
                  </label>
                  {expressPhotos.length > 0 ? (
                    <Text className="text-sm text-green-600">已选择 {expressPhotos.length} 个文件</Text>
                  ) : (
                    <Text className="text-sm text-zinc-500">支持 JPG, PNG 格式</Text>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => {
            setIsReceiveDialogOpen(false);
            resetForm();
          }}>
            取消
          </Button>
          <Button 
            onClick={handleReceive}
            disabled={!selectedProject || !formData.clinical_site || !formData.sample_count}
          >
            接收完成
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
