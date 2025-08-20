import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Heading } from '@/components/heading';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { Text } from '@/components/text';
import { DescriptionList, DescriptionTerm, DescriptionDetails } from '@/components/description-list';
import { api } from '@/lib/api';
import { 
  ChartBarIcon,
  ClockIcon,
  BeakerIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon
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
  const [filters, setFilters] = useState({
    project_id: '',
    sample_code: '',
    operation_type: '',
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
    try {
      const params = Object.entries(filters).reduce((acc, [key, value]) => {
        if (value) acc[key] = value;
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
    try {
      const response = await api.get('/statistics/exposure-records', {
        params: {
          project_id: filters.project_id,
          start_date: filters.start_date,
          end_date: filters.end_date
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
    try {
      const response = await api.get('/statistics/summary', {
        params: { project_id: filters.project_id }
      });
      setStatistics(response.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
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
      link.setAttribute('download', `statistics_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const getOperationBadge = (type: string) => {
    switch (type) {
      case 'receive':
        return <Badge color="blue">接收</Badge>;
      case 'inventory':
        return <Badge color="green">入库</Badge>;
      case 'checkout':
        return <Badge color="purple">领用</Badge>;
      case 'return':
        return <Badge color="cyan">归还</Badge>;
      case 'transfer':
        return <Badge color="amber">转移</Badge>;
      case 'destroy':
        return <Badge color="red">销毁</Badge>;
      default:
        return <Badge color="zinc">{type}</Badge>;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;
    return `${days}天${hrs > 0 ? hrs + '小时' : ''}`;
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>统计查询</Heading>
            <Text className="mt-1 text-zinc-600">查看样本操作记录和统计数据</Text>
          </div>
          <Button onClick={handleExport}>
            <ArrowDownTrayIcon />
            导出数据
          </Button>
        </div>

        {/* 筛选条件 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="h-5 w-5 text-zinc-500" />
            <Text className="font-medium">筛选条件</Text>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                项目
              </label>
              <Select
                value={filters.project_id}
                onChange={(e) => setFilters({...filters, project_id: e.target.value})}
              >
                <option value="">全部项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.lab_project_code}
                  </option>
                ))}
              </Select>
            </div>

            {activeTab === 'records' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    样本编号
                  </label>
                  <Input
                    value={filters.sample_code}
                    onChange={(e) => setFilters({...filters, sample_code: e.target.value})}
                    placeholder="输入样本编号"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    操作类型
                  </label>
                  <Select
                    value={filters.operation_type}
                    onChange={(e) => setFilters({...filters, operation_type: e.target.value})}
                  >
                    <option value="">全部操作</option>
                    <option value="receive">接收</option>
                    <option value="inventory">入库</option>
                    <option value="checkout">领用</option>
                    <option value="return">归还</option>
                    <option value="transfer">转移</option>
                    <option value="destroy">销毁</option>
                  </Select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                开始时间
              </label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                结束时间
              </label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              />
            </div>

            {activeTab === 'records' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  操作人
                </label>
                <Input
                  value={filters.operator}
                  onChange={(e) => setFilters({...filters, operator: e.target.value})}
                  placeholder="输入操作人姓名"
                />
              </div>
            )}
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex space-x-1 border-b border-zinc-200 mb-6">
          <button
            onClick={() => setActiveTab('records')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'records'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <BeakerIcon className="h-5 w-5" />
            存取记录
          </button>
          <button
            onClick={() => setActiveTab('exposure')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'exposure'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ClockIcon className="h-5 w-5" />
            暴露时间
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ChartBarIcon className="h-5 w-5" />
            统计汇总
          </button>
        </div>

        {/* 内容区域 */}
        {activeTab === 'records' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>样本编号</TableHeader>
                  <TableHeader>项目</TableHeader>
                  <TableHeader>操作类型</TableHeader>
                  <TableHeader>操作详情</TableHeader>
                  <TableHeader>操作人</TableHeader>
                  <TableHeader>操作时间</TableHeader>
                  <TableHeader>位置</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>加载中...</Text>
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>暂无数据</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono">{record.sample_code}</TableCell>
                      <TableCell>{record.project}</TableCell>
                      <TableCell>{getOperationBadge(record.operation_type)}</TableCell>
                      <TableCell className="max-w-xs truncate">{record.operation_detail}</TableCell>
                      <TableCell>{record.operator}</TableCell>
                      <TableCell className="text-zinc-600">
                        {new Date(record.operation_time).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-sm">{record.location || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === 'exposure' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>样本编号</TableHeader>
                  <TableHeader>项目</TableHeader>
                  <TableHeader>暴露开始</TableHeader>
                  <TableHeader>暴露结束</TableHeader>
                  <TableHeader>暴露时长</TableHeader>
                  <TableHeader>最高温度</TableHeader>
                  <TableHeader>原因</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>加载中...</Text>
                    </TableCell>
                  </TableRow>
                ) : exposureRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Text>暂无暴露记录</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  exposureRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono">{record.sample_code}</TableCell>
                      <TableCell>{record.project}</TableCell>
                      <TableCell className="text-zinc-600">
                        {new Date(record.start_time).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {record.end_time ? new Date(record.end_time).toLocaleString('zh-CN') : '进行中'}
                      </TableCell>
                      <TableCell>
                        {record.duration ? (
                          <Badge color={record.duration > 120 ? 'red' : 'amber'}>
                            {formatDuration(record.duration)}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {record.max_temperature ? (
                          <Badge color={record.max_temperature > -60 ? 'red' : 'green'}>
                            {record.max_temperature}°C
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{record.reason}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === 'summary' && statistics && (
          <div className="grid grid-cols-2 gap-6">
            {/* 样本状态统计 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium mb-4">样本状态分布</h3>
              <DescriptionList>
                <div>
                  <DescriptionTerm>样本总数</DescriptionTerm>
                  <DescriptionDetails className="text-2xl font-semibold">
                    {statistics.total_samples}
                  </DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>在库数量</DescriptionTerm>
                  <DescriptionDetails className="text-xl text-green-600">
                    {statistics.in_storage}
                  </DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>已领用</DescriptionTerm>
                  <DescriptionDetails className="text-xl text-blue-600">
                    {statistics.checked_out}
                  </DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>已转移</DescriptionTerm>
                  <DescriptionDetails className="text-xl text-amber-600">
                    {statistics.transferred}
                  </DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>已销毁</DescriptionTerm>
                  <DescriptionDetails className="text-xl text-red-600">
                    {statistics.destroyed}
                  </DescriptionDetails>
                </div>
              </DescriptionList>
            </div>

            {/* 存储时间统计 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium mb-4">存储时间统计</h3>
              <DescriptionList>
                <div>
                  <DescriptionTerm>平均存储天数</DescriptionTerm>
                  <DescriptionDetails className="text-2xl font-semibold">
                    {statistics.avg_storage_days.toFixed(1)} 天
                  </DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>总暴露时间</DescriptionTerm>
                  <DescriptionDetails className="text-xl text-amber-600">
                    {formatDuration(statistics.total_exposure_time)}
                  </DescriptionDetails>
                </div>
                <div>
                  <DescriptionTerm>暴露事件次数</DescriptionTerm>
                  <DescriptionDetails className="text-xl">
                    {statistics.exposure_events}
                  </DescriptionDetails>
                </div>
              </DescriptionList>
            </div>

            {/* 图表占位 */}
            <div className="col-span-2 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium mb-4">操作趋势图</h3>
              <div className="h-64 flex items-center justify-center bg-zinc-50 rounded-lg">
                <Text className="text-zinc-500">图表展示区域（需要集成图表库）</Text>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
