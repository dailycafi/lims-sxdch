import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Select } from '@/components/select';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { samplesAPI, projectsAPI } from '@/lib/api';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

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
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsAPI.getProjects,
  });

  const { data: samples, isLoading, refetch } = useQuery({
    queryKey: ['samples', selectedProject, selectedStatus],
    queryFn: () =>
      samplesAPI.getSamples({
        project_id: selectedProject || undefined,
        status: selectedStatus || undefined,
      }),
  });

  const handleSearch = () => {
    refetch();
  };

  const filteredSamples = samples?.filter((sample: any) =>
    searchCode ? sample.sample_code.includes(searchCode) : true
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Heading level={1}>样本查询</Heading>
        </div>

        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="样本编号"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="flex-1"
            />
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">所有项目</option>
              {projects?.map((project: any) => (
                <option key={project.id} value={project.id}>
                  {project.lab_project_code}
                </option>
              ))}
            </Select>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">所有状态</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Button onClick={handleSearch}>
              <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
              搜索
            </Button>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">加载中...</div>
          ) : filteredSamples?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">暂无样本</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>样本编号</TableHeader>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>受试者编号</TableHeader>
                  <TableHeader>检测类型</TableHeader>
                  <TableHeader>采集时间</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>存储位置</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSamples?.map((sample: any) => (
                  <TableRow key={sample.id}>
                    <TableCell className="font-medium">{sample.sample_code}</TableCell>
                    <TableCell>{sample.project?.lab_project_code || '-'}</TableCell>
                    <TableCell>{sample.subject_code || '-'}</TableCell>
                    <TableCell>{sample.test_type || '-'}</TableCell>
                    <TableCell>{sample.collection_time || '-'}</TableCell>
                    <TableCell>
                      <Badge color={statusColors[sample.status]}>
                        {statusLabels[sample.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sample.freezer_id
                        ? `${sample.freezer_id}-${sample.shelf_level}-${sample.rack_position}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="secondary" size="sm">
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
