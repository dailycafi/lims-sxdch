import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Tabs } from '@/components/tabs';
import { api } from '@/lib/api';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  BeakerIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon 
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { SamplesService, ProjectsService } from '@/services';


const statusColors: Record<string, any> = {
  pending: 'yellow',
  received: 'blue',
  in_storage: 'green',
  checked_out: 'orange',
  transferred: 'purple',
  destroyed: 'red',
  returned: 'green',
};

const statusLabels: Record<string, string> = {
  pending: '待接收',
  received: '已接收',
  in_storage: '在库',
  checked_out: '已领用',
  transferred: '已转移',
  destroyed: '已销毁',
  returned: '已归还',
};

export default function SamplesPage() {
  const [searchCode, setSearchCode] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [projects, setProjects] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 新增筛选状态
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [filters, setFilters] = useState({
    sampleCode: '',
    project: 'all',
    status: 'all',
    storageLocation: 'all',
    dateFrom: '',
    dateTo: ''
  });
  
  // 新增视图模式
  const [viewMode, setViewMode] = useState<'all' | 'in_storage' | 'checked_out' | 'transferred'>('all');

  useEffect(() => {
    fetchProjects();
    fetchSamples();
  }, [filters.project, filters.status]); // 使用 filters 而不是单独的状态

  const fetchProjects = async () => {
    try {
      const projects = await ProjectsService.getProjects();
      setProjects(projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchSamples = async () => {
    setIsLoading(true);
    try {
      const params = {
        project_id: filters.project !== 'all' ? parseInt(filters.project) : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
      };
      const samples = await SamplesService.getSamples(params);
      setSamples(samples);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    fetchSamples();
  };

  // 应用视图模式过滤
  const filteredByViewMode = (samples: any[]) => {
    if (viewMode === 'all') return samples;
    if (viewMode === 'in_storage') return samples.filter(s => s.status === 'in_storage');
    if (viewMode === 'checked_out') return samples.filter(s => s.status === 'checked_out');
    if (viewMode === 'transferred') return samples.filter(s => s.status === 'transferred');
    return samples;
  };

  // 应用筛选
  const applyFilters = (samples: any[]) => {
    return samples.filter(sample => {
      // 样本编号筛选（前端过滤）
      if (filters.sampleCode && !sample.sample_code.toLowerCase().includes(filters.sampleCode.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };

  const filteredSamples = applyFilters(filteredByViewMode(samples));

  // 计算活跃筛选器数量
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    return value !== '' && value !== 'all';
  }).length;

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      sampleCode: '',
      project: 'all',
      status: 'all',
      storageLocation: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <Heading>样本查询</Heading>
          <Text className="mt-1 text-zinc-600">查询和跟踪样本信息</Text>
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
                      placeholder="搜索样本编号..."
                      value={filters.sampleCode}
                      onChange={(e) => setFilters({ ...filters, sampleCode: e.target.value })}
                      className="w-full max-w-md h-11"
                    />
                  </div>

                  {/* 筛选器行 */}
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">项目</label>
                      <Select
                        value={filters.project}
                        onChange={(e) => setFilters({ ...filters, project: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部项目</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.lab_project_code}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                      <Select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部状态</option>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">存储位置</label>
                      <Select
                        value={filters.storageLocation}
                        onChange={(e) => setFilters({ ...filters, storageLocation: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部位置</option>
                        <option value="freezer_a">冰箱A</option>
                        <option value="freezer_b">冰箱B</option>
                        <option value="room_temp">常温储存</option>
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

                  {/* 日期范围筛选 */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">日期范围</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                          className="flex-1 h-11 custom-date-input"
                        />
                        <span className="text-gray-500">至</span>
                        <Input
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                          className="flex-1 h-11 custom-date-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 表格容器 - 包含tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          {/* Tabs 栏 */}
          <div className="bg-gray-50 px-6 py-3">
            <Tabs
              tabs={[
                { key: 'all', label: '全部' },
                { key: 'in_storage', label: '在库' },
                { key: 'checked_out', label: '已领用' },
                { key: 'transferred', label: '已转移' }
              ]}
              activeTab={viewMode}
              onChange={(key) => setViewMode(key as any)}
            />
          </div>

          {/* 结果统计 */}
          <div className="px-6 py-3 bg-gray-50/50">
            <Text className="text-sm text-zinc-600">
              共 {samples.length} 条记录
              {activeFilterCount > 0 && ` (已应用 ${activeFilterCount} 个筛选条件)`}
            </Text>
          </div>
          
          {/* 表格内容 */}
          <div>
            <Table bleed={true} striped>
              <TableHead>
                <TableRow>
                  <TableHeader className="pl-6">样本编号</TableHeader>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>受试者编号</TableHeader>
                  <TableHeader>检测类型</TableHeader>
                  <TableHeader>采集时间</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>存储位置</TableHeader>
                  <TableHeader className="pr-6">操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence>
                  {isLoading ? (
                    <AnimatedLoadingState 
                      key="loading"
                      colSpan={8} 
                      variant="skeleton"
                    />
                  ) : filteredSamples.length === 0 ? (
                    <AnimatedEmptyState
                      key="empty"
                      colSpan={8}
                      icon={BeakerIcon}
                      text={activeFilterCount > 0 
                        ? '没有符合筛选条件的样本' 
                        : '暂无样本数据'}
                    />
                  ) : (
                    <>
                      {filteredSamples.map((sample, index) => (
                        <AnimatedTableRow key={sample.id} index={index}>
                          <TableCell className="font-medium pl-6">{sample.sample_code}</TableCell>
                          <TableCell>{sample.project?.lab_project_code || '-'}</TableCell>
                          <TableCell>{sample.subject_code || '-'}</TableCell>
                          <TableCell>{sample.test_type || '-'}</TableCell>
                          <TableCell>{sample.collection_time || '-'}</TableCell>
                          <TableCell>
                            <Badge color={statusColors[sample.status] || 'zinc'}>
                              {statusLabels[sample.status] || sample.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{sample.freezer_id ? `${sample.freezer_id}-${sample.shelf_level}-${sample.rack_position}` : '-'}</TableCell>
                          <TableCell className="pr-6">
                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <Button color="zinc">
                                查看详情
                              </Button>
                            </motion.div>
                          </TableCell>
                        </AnimatedTableRow>
                      ))}
                    </>
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
