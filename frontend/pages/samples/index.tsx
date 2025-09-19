import { useState, useEffect, useMemo } from 'react';
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

const purposeLabels: Record<string, string> = {
  first_test: '首次检测',
  retest: '重测',
  isr: 'ISR',
  stability: '稳定性',
  qc: '质控',
};

const aliquotLabels: Record<'primary' | 'backup', string> = {
  primary: '正份',
  backup: '备份',
};

const formatStorageLocation = (sample: any) => {
  if (!sample) {
    return '-';
  }

  if (sample.freezer_id) {
    const parts = [
      sample.freezer_id,
      sample.shelf_level,
      sample.rack_position,
      sample.box_code,
      sample.position_in_box,
    ].filter(Boolean);

    if (parts.length) {
      return parts.join(' / ');
    }
  }

  if (sample.storage_location) {
    return sample.storage_location;
  }

  return '-';
};

export default function SamplesPage() {
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
    cycleGroup: 'all',
    testType: 'all',
    aliquotType: 'all',
    collectionSeq: 'all',
    subjectCode: '',
    purpose: 'all',
    transportCondition: 'all',
    specialNotes: '',
    dateFrom: '',
    dateTo: ''
  });
  
  // 新增视图模式
  const [viewMode, setViewMode] = useState<'all' | 'in_storage' | 'checked_out' | 'transferred'>('all');

  const cycleGroups = useMemo(
    () => Array.from(new Set(samples.map(sample => sample.cycle_group).filter(Boolean))).sort(),
    [samples]
  );

  const testTypes = useMemo(
    () => Array.from(new Set(samples.map(sample => sample.test_type).filter(Boolean))).sort(),
    [samples]
  );

  const collectionSeqs = useMemo(
    () => Array.from(new Set(samples.map(sample => sample.collection_seq).filter(Boolean))).sort(),
    [samples]
  );

  const transportConditions = useMemo(
    () => Array.from(new Set(samples.map(sample => sample.transport_condition).filter(Boolean))).sort(),
    [samples]
  );

  const storageLocations = useMemo(
    () => Array.from(new Set(samples.map(sample => formatStorageLocation(sample)).filter(location => location && location !== '-'))).sort(),
    [samples]
  );

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
        limit: 500,
      };
      const samples = await SamplesService.getSamples(params);
      setSamples(samples);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    } finally {
      setIsLoading(false);
    }
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
      if (filters.sampleCode && !(sample.sample_code || '').toLowerCase().includes(filters.sampleCode.toLowerCase())) {
        return false;
      }

      if (filters.storageLocation !== 'all' && formatStorageLocation(sample) !== filters.storageLocation) {
        return false;
      }

      if (filters.cycleGroup !== 'all' && (sample.cycle_group || '') !== filters.cycleGroup) {
        return false;
      }

      if (filters.testType !== 'all' && (sample.test_type || '') !== filters.testType) {
        return false;
      }

      if (filters.aliquotType !== 'all') {
        const isPrimary = sample.is_primary !== false;
        if (filters.aliquotType === 'primary' && !isPrimary) {
          return false;
        }
        if (filters.aliquotType === 'backup' && isPrimary) {
          return false;
        }
      }

      if (filters.collectionSeq !== 'all' && (sample.collection_seq || '') !== filters.collectionSeq) {
        return false;
      }

      if (filters.subjectCode && !(sample.subject_code || '').toLowerCase().includes(filters.subjectCode.toLowerCase())) {
        return false;
      }

      if (filters.purpose !== 'all' && (sample.purpose || '') !== filters.purpose) {
        return false;
      }

      if (filters.transportCondition !== 'all' && (sample.transport_condition || '') !== filters.transportCondition) {
        return false;
      }

      if (filters.specialNotes && !(sample.special_notes || '').includes(filters.specialNotes)) {
        return false;
      }

      if (filters.dateFrom) {
        const filterDateFrom = new Date(filters.dateFrom);
        if (!Number.isNaN(filterDateFrom.getTime())) {
          filterDateFrom.setHours(0, 0, 0, 0);
        }
        if (!Number.isNaN(filterDateFrom.getTime())) {
          const sampleDate = sample.collection_time ? new Date(sample.collection_time) : null;
          if (!sampleDate || sampleDate < filterDateFrom) {
            return false;
          }
        }
      }

      if (filters.dateTo) {
        const filterDateTo = new Date(filters.dateTo);
        if (!Number.isNaN(filterDateTo.getTime())) {
          filterDateTo.setHours(23, 59, 59, 999);
        }
        if (!Number.isNaN(filterDateTo.getTime())) {
          const sampleDate = sample.collection_time ? new Date(sample.collection_time) : null;
          if (!sampleDate || sampleDate > filterDateTo) {
            return false;
          }
        }
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
      cycleGroup: 'all',
      testType: 'all',
      aliquotType: 'all',
      collectionSeq: 'all',
      subjectCode: '',
      purpose: 'all',
      transportCondition: 'all',
      specialNotes: '',
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
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">周期/组别</label>
                      <Select
                        value={filters.cycleGroup}
                        onChange={(e) => setFilters({ ...filters, cycleGroup: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部</option>
                        {cycleGroups.map((group) => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">检测类型</label>
                      <Select
                        value={filters.testType}
                        onChange={(e) => setFilters({ ...filters, testType: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部</option>
                        {testTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">正份/备份</label>
                      <Select
                        value={filters.aliquotType}
                        onChange={(e) => setFilters({ ...filters, aliquotType: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部</option>
                        <option value="primary">正份</option>
                        <option value="backup">备份</option>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">用途</label>
                      <Select
                        value={filters.purpose}
                        onChange={(e) => setFilters({ ...filters, purpose: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部</option>
                        {Object.entries(purposeLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">采血序号</label>
                      <Select
                        value={filters.collectionSeq}
                        onChange={(e) => setFilters({ ...filters, collectionSeq: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部</option>
                        {collectionSeqs.map((seq) => (
                          <option key={seq} value={seq}>{seq}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">运输条件</label>
                      <Select
                        value={filters.transportCondition}
                        onChange={(e) => setFilters({ ...filters, transportCondition: e.target.value })}
                        className="w-full h-11 custom-select"
                      >
                        <option value="all">全部</option>
                        {transportConditions.map((condition) => (
                          <option key={condition} value={condition}>{condition}</option>
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
                        <option value="all">全部</option>
                        {storageLocations.map((location) => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">受试者编号</label>
                      <Input
                        type="text"
                        value={filters.subjectCode}
                        onChange={(e) => setFilters({ ...filters, subjectCode: e.target.value })}
                        placeholder="如：001"
                        className="w-full h-11"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">特殊事项</label>
                      <Input
                        type="text"
                        value={filters.specialNotes}
                        onChange={(e) => setFilters({ ...filters, specialNotes: e.target.value })}
                        placeholder="如：溶血"
                        className="w-full h-11"
                      />
                    </div>

                    {activeFilterCount > 0 && (
                      <div className="flex justify-end md:col-span-2 lg:col-span-1 xl:col-span-1">
                        <Button
                          color="white"
                          onClick={resetFilters}
                          className="h-11"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          清除筛选
                        </Button>
                      </div>
                    )}
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
              当前显示 {filteredSamples.length} 条记录
              {samples.length !== filteredSamples.length && ` / 总计 ${samples.length} 条`}
              {activeFilterCount > 0 && `（已应用 ${activeFilterCount} 个筛选条件）`}
            </Text>
          </div>
          
          {/* 表格内容 */}
          <div className="overflow-x-auto">
            <Table bleed={true} striped>
              <TableHead>
                <TableRow>
                  <TableHeader className="pl-6">样本编号</TableHeader>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>周期/组别</TableHeader>
                  <TableHeader>检测类型</TableHeader>
                  <TableHeader>正/备份</TableHeader>
                  <TableHeader>用途</TableHeader>
                  <TableHeader>受试者</TableHeader>
                  <TableHeader>采血信息</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>存储位置</TableHeader>
                  <TableHeader>特殊事项</TableHeader>
                  <TableHeader className="pr-6">操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence>
                  {isLoading ? (
                    <AnimatedLoadingState 
                      key="loading"
                      colSpan={12} 
                      variant="skeleton"
                    />
                  ) : filteredSamples.length === 0 ? (
                    <AnimatedEmptyState
                      key="empty"
                      colSpan={12}
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
                          <TableCell>{sample.cycle_group || '-'}</TableCell>
                          <TableCell>{sample.test_type || '-'}</TableCell>
                          <TableCell>{sample.is_primary === false ? aliquotLabels.backup : aliquotLabels.primary}</TableCell>
                          <TableCell>{sample.purpose ? (purposeLabels[sample.purpose] || sample.purpose) : '-'}</TableCell>
                          <TableCell>{sample.subject_code || '-'}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              {sample.collection_seq && (
                                <span className="text-xs text-zinc-500">{sample.collection_seq}</span>
                              )}
                              <span>{sample.collection_time || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge color={statusColors[sample.status] || 'zinc'}>
                              {statusLabels[sample.status] || sample.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatStorageLocation(sample)}</TableCell>
                          <TableCell>{sample.special_notes || '-'}</TableCell>
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
