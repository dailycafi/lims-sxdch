import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/date-utils';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Tabs } from '@/components/tabs';
import { 
  FunnelIcon,
  ChevronUpIcon,
  PlusIcon
} from '@heroicons/react/20/solid';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { ProjectsService } from '@/services';

interface ProjectItem {
  id: number;
  lab_project_code: string;
  sponsor_project_code: string;
  sponsor: string;
  status: string;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  sample_count?: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  
  const [filters, setFilters] = useState({
    status: 'all',
    sponsor: 'all',
    dateFrom: '',
    dateTo: ''
  });
  
  const [viewMode, setViewMode] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const projects = await ProjectsService.getProjects({ active_only: false });
      const transformedProjects = projects.map<ProjectItem>((project) => ({
        id: project.id,
        lab_project_code: project.lab_project_code,
        sponsor_project_code: project.sponsor_project_code,
        sponsor: project.sponsor?.name || '',
        status: project.status || (project.is_archived ? 'archived' : project.is_active ? 'active' : 'inactive'),
        is_active: project.is_active,
        is_archived: project.is_archived,
        created_at: project.created_at,
        sample_count: 0,
      }));
      setProjects(transformedProjects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { color: 'green' as const, text: '进行中' },
      completed: { color: 'blue' as const, text: '已完成' },
      archived: { color: 'zinc' as const, text: '已归档' },
      pending: { color: 'yellow' as const, text: '待启动' },
      inactive: { color: 'zinc' as const, text: '未启用' }
    };
    const { color, text } = config[status as keyof typeof config] || { color: 'zinc' as const, text: status };
    return <Badge color={color}>{text}</Badge>;
  };

  // 筛选项目
  const filteredProjects = projects.filter(project => {
    // 搜索筛选
    if (searchQuery && !project.lab_project_code.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !project.sponsor_project_code?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // 视图模式筛选
    if (viewMode !== 'all' && project.status !== viewMode) {
      return false;
    }
    
    // 状态筛选
    if (filters.status !== 'all' && project.status !== filters.status) {
      return false;
    }
    
    // 申办方筛选
    if (filters.sponsor !== 'all' && project.sponsor !== filters.sponsor) {
      return false;
    }
    
    // 日期筛选
    if (filters.dateFrom && new Date(project.created_at) < new Date(filters.dateFrom)) {
      return false;
    }
    if (filters.dateTo && new Date(project.created_at) > new Date(filters.dateTo)) {
      return false;
    }
    
    return true;
  });

  // 计算活跃筛选器数量
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    return value !== '' && value !== 'all';
  }).length;

  // 获取唯一的申办方列表
  const sponsors = Array.from(new Set(projects.map(p => p.sponsor))).filter(Boolean);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-end">
          <Link href="/projects/new">
            <Button>
              <PlusIcon className="h-4 w-4 mr-1" />
              新建项目
            </Button>
          </Link>
        </div>

        {/* 筛选区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          {/* 筛选标题栏 */}
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
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
                      placeholder="搜索项目编号..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full max-w-md h-11"
                    />
                  </div>

                  {/* 筛选器行 */}
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">项目状态</label>
                      <Select
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部状态</option>
                        <option value="active">进行中</option>
                        <option value="completed">已完成</option>
                        <option value="archived">已归档</option>
                        <option value="pending">待启动</option>
                        <option value="inactive">未启用</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">申办方</label>
                      <Select
                        value={filters.sponsor}
                        onChange={(e) => setFilters({...filters, sponsor: e.target.value})}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部申办方</option>
                        {sponsors.map(sponsor => (
                          <option key={sponsor} value={sponsor}>{sponsor}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                        className="w-full h-11"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                        className="w-full h-11"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tabs 和内容区域 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tabs 栏 */}
          <div className="border-b border-gray-200 px-4 py-3">
            <Tabs
              tabs={[
                { key: 'all', label: '全部' },
                { key: 'active', label: '进行中' },
                { key: 'completed', label: '已完成' },
                { key: 'archived', label: '已归档' }
              ]}
              activeTab={viewMode}
              onChange={(key) => setViewMode(key as any)}
            />
          </div>

          {/* 表格内容 */}
          <div>
            <Table bleed={true} striped>
              <TableHead>
                <TableRow>
                  <TableHeader className="pl-6">实验室项目编号</TableHeader>
                  <TableHeader>申办方项目编号</TableHeader>
                  <TableHeader>申办方</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>创建时间</TableHeader>
                  <TableHeader>样本数量</TableHeader>
                  <TableHeader className="text-right pr-6">操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <AnimatedLoadingState colSpan={7} variant="skeleton" />
                ) : filteredProjects.length === 0 ? (
                  <AnimatedEmptyState colSpan={7} text="暂无项目数据" />
                ) : (
                  <AnimatePresence>
                    {filteredProjects.map((project, index) => (
                      <AnimatedTableRow key={project.id} index={index}>
                        <TableCell className="font-medium pl-6">
                          <Link href={`/projects/${project.id}`} className="text-zinc-900 hover:text-black font-medium">
                            {project.lab_project_code}
                          </Link>
                        </TableCell>
                        <TableCell>{project.sponsor_project_code || '-'}</TableCell>
                        <TableCell>{project.sponsor || '-'}</TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>{formatDate(project.created_at)}</TableCell>
                        <TableCell>{project.sample_count || 0}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Link href={`/projects/${project.id}`}>
                            <Button plain>
                              查看详情
                            </Button>
                          </Link>
                        </TableCell>
                      </AnimatedTableRow>
                    ))}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
