import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Button } from '@/components/button';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Badge } from '@/components/badge';
import { projectsAPI } from '@/lib/api';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsAPI.getProjects,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Heading level={1}>项目管理</Heading>
          <Link href="/projects/new">
            <Button>
              <PlusIcon className="h-4 w-4 mr-2" />
              新建项目
            </Button>
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">加载中...</div>
          ) : projects?.length === 0 ? (
            <div className="p-6 text-center text-gray-500">暂无项目</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>实验室项目编号</TableHeader>
                  <TableHeader>申办者项目编号</TableHeader>
                  <TableHeader>申办者</TableHeader>
                  <TableHeader>临床机构</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>创建时间</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects?.map((project: any) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.lab_project_code}</TableCell>
                    <TableCell>{project.sponsor_project_code}</TableCell>
                    <TableCell>{project.sponsor?.name || '-'}</TableCell>
                    <TableCell>{project.clinical_org?.name || '-'}</TableCell>
                    <TableCell>
                      {project.is_archived ? (
                        <Badge color="gray">已归档</Badge>
                      ) : project.is_active ? (
                        <Badge color="green">活跃</Badge>
                      ) : (
                        <Badge color="red">停用</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(project.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="secondary" size="sm">
                          查看
                        </Button>
                      </Link>
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
