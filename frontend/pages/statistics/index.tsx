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
import { SearchInput } from '@/components/search-input';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { AnimatedLoadingState, AnimatedEmptyState, AnimatedTableRow } from '@/components/animated-table';
import { api } from '@/lib/api';
import { 
  ChartBarIcon,
  ClockIcon,
  BeakerIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/20/solid';

interface SampleRecord {
  id: number;
  sample_code: string;
  project: string;
  operation_type: string;
  operation_detail: string;
  operator: string;
  operation_time: string;
  location?: string;
  temperature?: number;
  exposure_duration?: number;
}

interface Statistics {
  total_samples: number;
  in_storage: number;
  checked_out: number;
  transferred: number;
  destroyed: number;
  avg_storage_days: number;
  total_exposure_time: number;
  exposure_events: number;
}

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<'records' | 'exposure' | 'summary'>('records');
  const [records, setRecords] = useState<SampleRecord[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [filters, setFilters] = useState({
    project_id: 'all',
    operation_type: 'all',
    start_date: '',
    end_date: '',
    operator: ''
  });
  const [projects, setProjects] = useState<any[]>([]);
  const [exposureRecords, setExposureRecords] = useState<any[]>([]);

  useEffect(() => {
    fetchProjects();
    if (activeTab === 'records') {
      fetchRecords();
    } else if (activeTab === 'exposure') {
      fetchExposureRecords();
    } else {
      fetchStatistics();
    }
  }, [activeTab, filters]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = Object.entries(filters).reduce((acc, [key, value]) => {
        if (value && value !== 'all') acc[key] = value;
        return acc;
      }, {} as any);

      const response = await api.get('/statistics/sample-records', { params });
      setRecords(response.data);
    } catch (error) {
      console.error('Failed to fetch records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExposureRecords = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statistics/exposure-records', {
        params: {
          project_id: filters.project_id !== 'all' ? filters.project_id : undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined
        }
      });
      setExposureRecords(response.data);
    } catch (error) {
      console.error('Failed to fetch exposure records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const response = await api.get('/statistics/summary', {
        params: {
          project_id: filters.project_id !== 'all' ? filters.project_id : undefined
        }
      });
      setStatistics(response.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await api.get('/statistics/export', {
        params: {
          type: activeTab,
          ...filters
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `statistics_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const getOperationTypeBadge = (type: string) => {
    const typeMap: Record<string, { color: "blue" | "green" | "purple" | "red" | "yellow" | "zinc", text: string }> = {
      'receive': { color: 'blue', text: '接收' },
      'checkout': { color: 'green', text: '领用' },
      'transfer': { color: 'purple', text: '转移' },
      'destroy': { color: 'red', text: '销毁' },
      'return': { color: 'yellow', text: '归还' }
    };
    
    const config = typeMap[type] || { color: 'zinc', text: type };
    return <Badge color={config.color}>{config.text}</Badge>;
  };

  // 筛选记录
  const filteredRecords = records.filter(record => {
    if (searchQuery && !record.sample_code.includes(searchQuery)) {
      return false;
    }
    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v && v !== 'all').length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Heading>统计查询</Heading>
            <Text className="mt-1 text-zinc-600">查看样本操作记录和统计数据</Text>
          </div>
          <Button color="blue" onClick={handleExportData}>
            <ArrowDownTrayIcon className="h-4 w-4" />
            导出数据
          </Button>
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
                      placeholder="搜索样本编号..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full max-w-md h-11"
                    />
                  </div>

                  {/* 筛选器行 */}
                  <div className="grid grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">项目</label>
                      <Select
                        value={filters.project_id}
                        onChange={(e) => setFilters({...filters, project_id: e.target.value})}
                        className="w-full h-11 custom-select"
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">操作类型</label>
                      <Select
                        value={filters.operation_type}
                        onChange={(e) => setFilters({...filters, operation_type: e.target.value})}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部类型</option>
                        <option value="receive">接收</option>
                        <option value="checkout">领用</option>
                        <option value="transfer">转移</option>
                        <option value="destroy">销毁</option>
                        <option value="return">归还</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">操作人</label>
                      <Input
                        type="text"
                        value={filters.operator}
                        onChange={(e) => setFilters({...filters, operator: e.target.value})}
                        placeholder="输入操作人姓名"
                        className="w-full h-11"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">开始日期</label>
                      <Input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                        className="w-full h-11"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">结束日期</label>
                      <Input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => setFilters({...filters, end_date: e.target.value})}
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
                { key: 'records', label: '操作记录' },
                { key: 'exposure', label: '暴露记录' },
                { key: 'summary', label: '统计汇总' }
              ]}
              activeTab={activeTab}
              onChange={(key) => setActiveTab(key as any)}
            />
          </div>

          {/* 内容区域 */}
          {activeTab === 'records' && (
            <div>
              <Table bleed={true} striped>
                <TableHead>
                  <TableRow>
                    <TableHeader className="pl-6">样本编号</TableHeader>
                    <TableHeader>项目</TableHeader>
                    <TableHeader>操作类型</TableHeader>
                    <TableHeader>操作详情</TableHeader>
                    <TableHeader>操作人</TableHeader>
                    <TableHeader className="pr-6">操作时间</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={6} variant="skeleton" />
                  ) : filteredRecords.length === 0 ? (
                    <AnimatedEmptyState colSpan={6} text="暂无数据" />
                  ) : (
                    <AnimatePresence>
                      {filteredRecords.map((record, index) => (
                        <AnimatedTableRow key={record.id} index={index}>
                          <TableCell className="font-medium pl-6">{record.sample_code}</TableCell>
                          <TableCell>{record.project}</TableCell>
                          <TableCell>{getOperationTypeBadge(record.operation_type)}</TableCell>
                          <TableCell>{record.operation_detail}</TableCell>
                          <TableCell>{record.operator}</TableCell>
                          <TableCell className="pr-6">{new Date(record.operation_time).toLocaleString('zh-CN')}</TableCell>
                        </AnimatedTableRow>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {activeTab === 'exposure' && (
            <div>
              <Table bleed={true} striped>
                <TableHead>
                  <TableRow>
                    <TableHeader className="pl-6">样本编号</TableHeader>
                    <TableHeader>项目</TableHeader>
                    <TableHeader>当前位置</TableHeader>
                    <TableHeader>温度(°C)</TableHeader>
                    <TableHeader>暴露时长(分钟)</TableHeader>
                    <TableHeader className="pr-6">暴露时间</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <AnimatedLoadingState colSpan={6} variant="skeleton" />
                  ) : exposureRecords.length === 0 ? (
                    <AnimatedEmptyState colSpan={6} text="暂无数据" />
                  ) : (
                    <AnimatePresence>
                      {exposureRecords.map((record, index) => (
                        <AnimatedTableRow key={record.id} index={index}>
                          <TableCell className="font-medium pl-6">{record.sample_code}</TableCell>
                          <TableCell>{record.project}</TableCell>
                          <TableCell>{record.location}</TableCell>
                          <TableCell>
                            <Badge color={record.temperature > 8 ? 'red' : 'green'}>
                              {record.temperature}°C
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge color={record.exposure_duration > 30 ? 'red' : 'yellow'}>
                              {record.exposure_duration} 分钟
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-6">{new Date(record.exposure_time).toLocaleString('zh-CN')}</TableCell>
                        </AnimatedTableRow>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <AnimatedLoadingState colSpan={1} variant="skeleton" />
                </div>
              ) : statistics ? (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Heading level={3} className="mb-4">样本统计</Heading>
                    <DescriptionList>
                      <DescriptionTerm>总样本数</DescriptionTerm>
                      <DescriptionDetails>{statistics.total_samples}</DescriptionDetails>
                      
                      <DescriptionTerm>在库样本</DescriptionTerm>
                      <DescriptionDetails>
                        <Badge color="green">{statistics.in_storage}</Badge>
                      </DescriptionDetails>
                      
                      <DescriptionTerm>已领用</DescriptionTerm>
                      <DescriptionDetails>
                        <Badge color="blue">{statistics.checked_out}</Badge>
                      </DescriptionDetails>
                      
                      <DescriptionTerm>已转移</DescriptionTerm>
                      <DescriptionDetails>
                        <Badge color="purple">{statistics.transferred}</Badge>
                      </DescriptionDetails>
                      
                      <DescriptionTerm>已销毁</DescriptionTerm>
                      <DescriptionDetails>
                        <Badge color="red">{statistics.destroyed}</Badge>
                      </DescriptionDetails>
                    </DescriptionList>
                  </div>
                  
                  <div>
                    <Heading level={3} className="mb-4">存储统计</Heading>
                    <DescriptionList>
                      <DescriptionTerm>平均存储天数</DescriptionTerm>
                      <DescriptionDetails>{statistics.avg_storage_days.toFixed(1)} 天</DescriptionDetails>
                      
                      <DescriptionTerm>总暴露时长</DescriptionTerm>
                      <DescriptionDetails>{statistics.total_exposure_time} 分钟</DescriptionDetails>
                      
                      <DescriptionTerm>暴露事件数</DescriptionTerm>
                      <DescriptionDetails>
                        <Badge color={statistics.exposure_events > 0 ? 'yellow' : 'green'}>
                          {statistics.exposure_events}
                        </Badge>
                      </DescriptionDetails>
                    </DescriptionList>
                  </div>
                </div>
              ) : (
                <AnimatedEmptyState colSpan={4} text="暂无数据" />
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
