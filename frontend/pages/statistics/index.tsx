import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { Heading } from '@/components/heading';
import { Tabs } from '@/components/tabs';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { SampleTimeline, ExportButtons, TimelineEvent } from '@/components/statistics';
import { api } from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/date-utils';
import { toast } from 'react-hot-toast';
import {
  ChartBarIcon,
  BuildingOfficeIcon,
  ArchiveBoxIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FolderIcon,
  CubeIcon,
  UserGroupIcon,
  FunnelIcon,
  ChevronUpIcon,
} from '@heroicons/react/20/solid';

// ========== Type Definitions ==========

interface CenterStatistics {
  center_id: number;
  center_name: string;
  sample_count: number;
  first_receive_date: string;
  last_receive_date: string;
}

interface ReceiveStatistics {
  id: number;
  receive_code: string;
  project_name: string;
  center_name: string;
  sample_count: number;
  received_at: string;
  received_by: string;
  storage_location: string;
  status: string;
}

interface TransferSummary {
  id: number;
  sample_code: string;
  transfer_date: string;
  from_location: string;
  to_location: string;
  transfer_type: string;
  operator: string;
}

interface SampleLifecycle {
  sample_code: string;
  project_name: string;
  current_status: string;
  events: TimelineEvent[];
}

interface ProjectSummary {
  project_id: number;
  project_code: string;
  sponsor_name: string;
  in_storage_count: number;
  sample_codes: string[];
  earliest_storage_date: string;
  storage_duration_days: number;
  storage_locations: string[];
}

interface FreezerSummary {
  freezer_id: number;
  freezer_name: string;
  location: string;
  temperature: number;
  projects: Array<{
    project_code: string;
    sample_count: number;
  }>;
  total_samples: number;
}

interface SponsorStatistics {
  sponsor_id: number;
  sponsor_name: string;
  project_count: number;
  total_samples: number;
  in_storage_samples: number;
  projects: Array<{
    project_code: string;
    sample_count: number;
  }>;
}

interface SearchResult {
  id: number;
  sample_code: string;
  project_name: string;
  status: string;
  storage_location: string;
  created_at: string;
  last_operation: string;
  last_operation_time: string;
}

type TabKey = 'center' | 'receive' | 'transfer' | 'lifecycle' | 'search' | 'project' | 'freezer' | 'sponsor';

// ========== Main Component ==========

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('center');
  const [loading, setLoading] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  // Filter states
  const [filters, setFilters] = useState({
    project_id: 'all',
    start_date: '',
    end_date: '',
    keyword: '',
    sponsor_id: 'all',
  });

  // Data states
  const [projects, setProjects] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [centerStats, setCenterStats] = useState<CenterStatistics[]>([]);
  const [receiveStats, setReceiveStats] = useState<ReceiveStatistics[]>([]);
  const [transferSummary, setTransferSummary] = useState<TransferSummary[]>([]);
  const [sampleLifecycle, setSampleLifecycle] = useState<SampleLifecycle | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [projectSummary, setProjectSummary] = useState<ProjectSummary[]>([]);
  const [freezerSummary, setFreezerSummary] = useState<FreezerSummary[]>([]);
  const [sponsorStats, setSponsorStats] = useState<SponsorStatistics[]>([]);

  // Lifecycle query state
  const [lifecycleQuery, setLifecycleQuery] = useState('');

  // Load projects and sponsors on mount
  useEffect(() => {
    fetchProjects();
    fetchSponsors();
  }, []);

  // Fetch data when tab or filters change
  useEffect(() => {
    fetchTabData();
  }, [activeTab, filters]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (error) {
      toast.error('加载项目列表失败');
    }
  };

  const fetchSponsors = async () => {
    try {
      const response = await api.get('/global-params/organizations', {
        params: { org_type: 'sponsor' }
      });
      setSponsors(response.data);
    } catch (error) {
      // Sponsors may not be available, ignore error
    }
  };

  const fetchTabData = useCallback(async () => {
    if (activeTab === 'lifecycle') return; // Lifecycle uses manual query

    setLoading(true);
    try {
      const params = buildFilterParams();

      switch (activeTab) {
        case 'center':
          await fetchCenterStats(params);
          break;
        case 'receive':
          await fetchReceiveStats(params);
          break;
        case 'transfer':
          await fetchTransferSummary(params);
          break;
        case 'search':
          if (filters.keyword) {
            await fetchSearchResults(params);
          }
          break;
        case 'project':
          await fetchProjectSummary(params);
          break;
        case 'freezer':
          await fetchFreezerSummary(params);
          break;
        case 'sponsor':
          await fetchSponsorStats(params);
          break;
      }
    } catch (error) {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  const buildFilterParams = () => {
    const params: Record<string, any> = {};
    if (filters.project_id !== 'all') params.project_id = filters.project_id;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.sponsor_id !== 'all') params.sponsor_id = filters.sponsor_id;
    return params;
  };

  // API fetch functions
  const fetchCenterStats = async (params: Record<string, any>) => {
    const response = await api.get('/statistics/center-samples', { params });
    setCenterStats(response.data);
  };

  const fetchReceiveStats = async (params: Record<string, any>) => {
    const response = await api.get('/statistics/receive-records', { params });
    setReceiveStats(response.data);
  };

  const fetchTransferSummary = async (params: Record<string, any>) => {
    const response = await api.get('/statistics/transfer-summary', { params });
    setTransferSummary(response.data);
  };

  const fetchSearchResults = async (params: Record<string, any>) => {
    const response = await api.get('/statistics/search', { params });
    setSearchResults(response.data);
  };

  const fetchProjectSummary = async (params: Record<string, any>) => {
    const response = await api.get('/statistics/project-summary', { params });
    setProjectSummary(response.data);
  };

  const fetchFreezerSummary = async (params: Record<string, any>) => {
    const response = await api.get('/statistics/freezer-summary', { params });
    setFreezerSummary(response.data);
  };

  const fetchSponsorStats = async (params: Record<string, any>) => {
    const response = await api.get('/statistics/sponsor-stats', { params });
    setSponsorStats(response.data);
  };

  const fetchSampleLifecycle = async () => {
    if (!lifecycleQuery.trim()) {
      toast.error('请输入样本编号');
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/statistics/sample/${encodeURIComponent(lifecycleQuery.trim())}/lifecycle`);
      setSampleLifecycle(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('样本不存在');
      } else {
        toast.error('查询失败');
      }
      setSampleLifecycle(null);
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  const tabs = [
    { key: 'center', label: '中心统计', icon: BuildingOfficeIcon },
    { key: 'receive', label: '接收统计', icon: ArchiveBoxIcon },
    { key: 'transfer', label: '转移汇总', icon: ArrowsRightLeftIcon },
    { key: 'lifecycle', label: '样本查询', icon: ClockIcon },
    { key: 'search', label: '综合搜索', icon: MagnifyingGlassIcon },
    { key: 'project', label: '项目汇总', icon: FolderIcon },
    { key: 'freezer', label: '冰箱汇总', icon: CubeIcon },
    { key: 'sponsor', label: '申办方查询', icon: UserGroupIcon },
  ];

  // ========== Render Functions ==========

  const renderCenterTab = () => (
    <div id="print-content">
      <Table bleed striped>
        <TableHead>
          <TableRow>
            <TableHeader className="pl-6">中心名称</TableHeader>
            <TableHeader>样本数量</TableHeader>
            <TableHeader>首次接收日期</TableHeader>
            <TableHeader className="pr-6">最近接收日期</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <AnimatedLoadingState colSpan={4} variant="skeleton" />
          ) : centerStats.length === 0 ? (
            <AnimatedEmptyState colSpan={4} text="暂无数据" />
          ) : (
            <AnimatePresence>
              {centerStats.map((stat, index) => (
                <AnimatedTableRow key={stat.center_id} index={index}>
                  <TableCell className="font-medium pl-6">{stat.center_name}</TableCell>
                  <TableCell>
                    <Badge color="blue">{stat.sample_count}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(stat.first_receive_date)}</TableCell>
                  <TableCell className="pr-6">{formatDate(stat.last_receive_date)}</TableCell>
                </AnimatedTableRow>
              ))}
            </AnimatePresence>
          )}
        </TableBody>
      </Table>
      {!loading && centerStats.length > 0 && (
        <div className="p-4 border-t bg-zinc-50">
          <Text className="text-sm text-zinc-600">
            共 {centerStats.length} 个中心，总计 {centerStats.reduce((sum, s) => sum + s.sample_count, 0)} 个样本
          </Text>
        </div>
      )}
    </div>
  );

  const renderReceiveTab = () => (
    <div id="print-content">
      <Table bleed striped>
        <TableHead>
          <TableRow>
            <TableHeader className="pl-6">接收编号</TableHeader>
            <TableHeader>项目</TableHeader>
            <TableHeader>中心</TableHeader>
            <TableHeader>样本数量</TableHeader>
            <TableHeader>接收时间</TableHeader>
            <TableHeader>接收人</TableHeader>
            <TableHeader className="pr-6">入库位置</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <AnimatedLoadingState colSpan={7} variant="skeleton" />
          ) : receiveStats.length === 0 ? (
            <AnimatedEmptyState colSpan={7} text="暂无数据" />
          ) : (
            <AnimatePresence>
              {receiveStats.map((stat, index) => (
                <AnimatedTableRow key={stat.id} index={index}>
                  <TableCell className="font-mono pl-6">{stat.receive_code}</TableCell>
                  <TableCell>{stat.project_name}</TableCell>
                  <TableCell>{stat.center_name}</TableCell>
                  <TableCell>
                    <Badge color="green">{stat.sample_count}</Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(stat.received_at)}</TableCell>
                  <TableCell>{stat.received_by}</TableCell>
                  <TableCell className="pr-6">{stat.storage_location || '-'}</TableCell>
                </AnimatedTableRow>
              ))}
            </AnimatePresence>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderTransferTab = () => (
    <div id="print-content">
      <Table bleed striped>
        <TableHead>
          <TableRow>
            <TableHeader className="pl-6">样本编号</TableHeader>
            <TableHeader>转移日期</TableHeader>
            <TableHeader>原位置</TableHeader>
            <TableHeader>目标位置</TableHeader>
            <TableHeader>转移类型</TableHeader>
            <TableHeader className="pr-6">操作人</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <AnimatedLoadingState colSpan={6} variant="skeleton" />
          ) : transferSummary.length === 0 ? (
            <AnimatedEmptyState colSpan={6} text="暂无数据" />
          ) : (
            <AnimatePresence>
              {transferSummary.map((item, index) => (
                <AnimatedTableRow key={item.id} index={index}>
                  <TableCell className="font-mono pl-6">{item.sample_code}</TableCell>
                  <TableCell>{formatDateTime(item.transfer_date)}</TableCell>
                  <TableCell>{item.from_location}</TableCell>
                  <TableCell>{item.to_location}</TableCell>
                  <TableCell>
                    <Badge color={item.transfer_type === 'internal' ? 'blue' : 'purple'}>
                      {item.transfer_type === 'internal' ? '内部' : '外部'}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6">{item.operator}</TableCell>
                </AnimatedTableRow>
              ))}
            </AnimatePresence>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderLifecycleTab = () => (
    <div className="p-6">
      <div className="mb-6">
        <Heading level={3} className="mb-4">单个样本生命周期查询</Heading>
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">样本编号</label>
            <Input
              type="text"
              placeholder="输入样本编号..."
              value={lifecycleQuery}
              onChange={(e) => setLifecycleQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchSampleLifecycle()}
              className="w-full h-11"
            />
          </div>
          <Button onClick={fetchSampleLifecycle} disabled={loading || !lifecycleQuery.trim()}>
            {loading ? '查询中...' : '查询'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <AnimatedLoadingState colSpan={1} variant="skeleton" />
        </div>
      ) : sampleLifecycle ? (
        <div id="print-content">
          <SampleTimeline
            events={sampleLifecycle.events}
            sampleCode={sampleLifecycle.sample_code}
            currentStatus={sampleLifecycle.current_status}
          />
        </div>
      ) : (
        <div className="text-center py-12 text-zinc-500">
          请输入样本编号查询生命周期
        </div>
      )}
    </div>
  );

  const renderSearchTab = () => (
    <div id="print-content">
      <div className="p-4 border-b bg-zinc-50">
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">关键词搜索</label>
            <Input
              type="text"
              placeholder="输入日期/关键词/任务编号..."
              value={filters.keyword}
              onChange={(e) => updateFilters('keyword', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTabData()}
              className="w-full h-11"
            />
          </div>
          <Button onClick={fetchTabData} disabled={loading}>
            搜索
          </Button>
        </div>
      </div>
      <Table bleed striped>
        <TableHead>
          <TableRow>
            <TableHeader className="pl-6">样本编号</TableHeader>
            <TableHeader>项目</TableHeader>
            <TableHeader>状态</TableHeader>
            <TableHeader>存储位置</TableHeader>
            <TableHeader>创建时间</TableHeader>
            <TableHeader>最近操作</TableHeader>
            <TableHeader className="pr-6">操作时间</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <AnimatedLoadingState colSpan={7} variant="skeleton" />
          ) : searchResults.length === 0 ? (
            <AnimatedEmptyState colSpan={7} text={filters.keyword ? '未找到匹配结果' : '请输入搜索条件'} />
          ) : (
            <AnimatePresence>
              {searchResults.map((result, index) => (
                <AnimatedTableRow key={result.id} index={index}>
                  <TableCell className="font-mono pl-6">{result.sample_code}</TableCell>
                  <TableCell>{result.project_name}</TableCell>
                  <TableCell>
                    <Badge color={getStatusColor(result.status)}>
                      {getStatusLabel(result.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{result.storage_location || '-'}</TableCell>
                  <TableCell>{formatDateTime(result.created_at)}</TableCell>
                  <TableCell>{result.last_operation}</TableCell>
                  <TableCell className="pr-6">{formatDateTime(result.last_operation_time)}</TableCell>
                </AnimatedTableRow>
              ))}
            </AnimatePresence>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderProjectTab = () => (
    <div id="print-content">
      <div className="divide-y">
        {loading ? (
          <div className="p-6">
            <AnimatedLoadingState colSpan={1} variant="skeleton" />
          </div>
        ) : projectSummary.length === 0 ? (
          <div className="p-6 text-center text-zinc-500">暂无数据</div>
        ) : (
          projectSummary.map((project) => (
            <div key={project.project_id} className="p-6 hover:bg-zinc-50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Heading level={4} className="text-lg">{project.project_code}</Heading>
                  <Text className="text-zinc-500">{project.sponsor_name}</Text>
                </div>
                <div className="text-right">
                  <Badge color="green" className="text-lg px-3 py-1">
                    {project.in_storage_count} 个在库
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">最早入库时间:</span>
                  <span className="ml-2 font-medium">{formatDate(project.earliest_storage_date)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">已保存时长:</span>
                  <span className="ml-2 font-medium">{project.storage_duration_days} 天</span>
                </div>
                <div>
                  <span className="text-zinc-500">存储位置:</span>
                  <span className="ml-2 font-medium">{project.storage_locations.join(', ') || '-'}</span>
                </div>
              </div>
              {project.sample_codes.length > 0 && (
                <div className="mt-4">
                  <Text className="text-sm text-zinc-500 mb-2">样本编号 (前10个):</Text>
                  <div className="flex flex-wrap gap-2">
                    {project.sample_codes.slice(0, 10).map((code) => (
                      <Badge key={code} color="zinc" className="font-mono text-xs">
                        {code}
                      </Badge>
                    ))}
                    {project.sample_codes.length > 10 && (
                      <Badge color="zinc" className="text-xs">
                        +{project.sample_codes.length - 10} 个
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderFreezerTab = () => (
    <div id="print-content">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {loading ? (
          <div className="col-span-full">
            <AnimatedLoadingState colSpan={1} variant="skeleton" />
          </div>
        ) : freezerSummary.length === 0 ? (
          <div className="col-span-full text-center py-12 text-zinc-500">暂无数据</div>
        ) : (
          freezerSummary.map((freezer) => (
            <div
              key={freezer.freezer_id}
              className="bg-white rounded-lg border border-zinc-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Heading level={4}>{freezer.freezer_name}</Heading>
                  <Text className="text-sm text-zinc-500">{freezer.location}</Text>
                </div>
                <Badge color="blue" className="text-lg">
                  {freezer.temperature}°C
                </Badge>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <Text className="text-sm text-zinc-500">总样本数</Text>
                  <Badge color="green">{freezer.total_samples}</Badge>
                </div>
                {freezer.projects.length > 0 && (
                  <div className="space-y-2">
                    <Text className="text-sm text-zinc-500">项目分布:</Text>
                    {freezer.projects.map((p) => (
                      <div key={p.project_code} className="flex justify-between text-sm">
                        <span className="font-medium">{p.project_code}</span>
                        <span className="text-zinc-600">{p.sample_count} 个</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSponsorTab = () => (
    <div id="print-content">
      <div className="divide-y">
        {loading ? (
          <div className="p-6">
            <AnimatedLoadingState colSpan={1} variant="skeleton" />
          </div>
        ) : sponsorStats.length === 0 ? (
          <div className="p-6 text-center text-zinc-500">暂无数据</div>
        ) : (
          sponsorStats.map((sponsor) => (
            <div key={sponsor.sponsor_id} className="p-6 hover:bg-zinc-50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Heading level={4} className="text-lg">{sponsor.sponsor_name}</Heading>
                  <Text className="text-zinc-500">{sponsor.project_count} 个项目</Text>
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <Badge color="blue">{sponsor.total_samples} 个总样本</Badge>
                  </div>
                  <div>
                    <Badge color="green">{sponsor.in_storage_samples} 个在库</Badge>
                  </div>
                </div>
              </div>
              {sponsor.projects.length > 0 && (
                <div className="mt-4">
                  <Text className="text-sm text-zinc-500 mb-2">项目列表:</Text>
                  <Table bleed dense>
                    <TableHead>
                      <TableRow>
                        <TableHeader>项目编号</TableHeader>
                        <TableHeader>样本数量</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sponsor.projects.map((p) => (
                        <TableRow key={p.project_code}>
                          <TableCell className="font-medium">{p.project_code}</TableCell>
                          <TableCell>
                            <Badge color="zinc">{p.sample_count}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'center':
        return renderCenterTab();
      case 'receive':
        return renderReceiveTab();
      case 'transfer':
        return renderTransferTab();
      case 'lifecycle':
        return renderLifecycleTab();
      case 'search':
        return renderSearchTab();
      case 'project':
        return renderProjectTab();
      case 'freezer':
        return renderFreezerTab();
      case 'sponsor':
        return renderSponsorTab();
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading level={2}>统计查询</Heading>
            <Text className="text-zinc-600 mt-1">样本操作记录和统计分析</Text>
          </div>
          <ExportButtons
            exportType={activeTab}
            filters={filters}
            title={tabs.find(t => t.key === activeTab)?.label}
            printElementId="print-content"
          />
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
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

          <AnimatePresence initial={false}>
            {isFilterExpanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="p-5 border-t">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">项目</label>
                      <Select
                        value={filters.project_id}
                        onChange={(e) => updateFilters('project_id', e.target.value)}
                        className="w-full h-11"
                      >
                        <option value="all">全部项目</option>
                        {projects.map(project => (
                          <option key={project.id} value={project.id}>
                            {project.lab_project_code}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">申办方</label>
                      <Select
                        value={filters.sponsor_id}
                        onChange={(e) => updateFilters('sponsor_id', e.target.value)}
                        className="w-full h-11"
                      >
                        <option value="all">全部申办方</option>
                        {sponsors.map(sponsor => (
                          <option key={sponsor.id} value={sponsor.id}>
                            {sponsor.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
                      <Input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => updateFilters('start_date', e.target.value)}
                        className="w-full h-11"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
                      <Input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => updateFilters('end_date', e.target.value)}
                        className="w-full h-11"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tabs and Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-4 py-3 overflow-x-auto">
            <Tabs
              tabs={tabs.map(t => ({ key: t.key, label: t.label, icon: t.icon }))}
              activeTab={activeTab}
              onChange={(key) => setActiveTab(key as TabKey)}
            />
          </div>

          {renderTabContent()}
        </div>
      </div>
    </AppLayout>
  );
}

// ========== Helper Functions ==========

function getStatusColor(status: string): "blue" | "green" | "yellow" | "red" | "purple" | "zinc" {
  const colors: Record<string, "blue" | "green" | "yellow" | "red" | "purple" | "zinc"> = {
    pending: 'yellow',
    received: 'blue',
    in_storage: 'green',
    checked_out: 'yellow',
    transferred: 'purple',
    destroyed: 'red',
    archived: 'zinc',
  };
  return colors[status] || 'zinc';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待接收',
    received: '已接收',
    in_storage: '在库',
    checked_out: '已领用',
    transferred: '已转移',
    destroyed: '已销毁',
    archived: '已归档',
  };
  return labels[status] || status;
}
