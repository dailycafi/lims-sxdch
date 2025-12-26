import { useState } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { api } from '@/lib/api';
import { DocumentTextIcon, MagnifyingGlassIcon } from '@heroicons/react/20/solid';

interface TrackingRecord {
  id: number;
  request_code: string;
  project_code: string;
  requester: string;
  type: 'borrow' | 'return';
  sample_count: number;
  created_at: string;
}

export default function TrackingFormPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<TrackingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('请输入查询内容');
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(`/samples/tracking/search?query=${searchQuery}`);
      setRecords(response.data);
      if (response.data.length === 0) {
        toast.error('未找到匹配记录');
      }
    } catch (e) {
      console.error(e);
      toast.error('查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (record: TrackingRecord) => {
    // 获取记录详情
    setLoading(true);
    try {
      const response = await api.get(`/samples/borrow-request/${record.id}`);
      const detail = response.data;
      const samplesList = detail.samples || [];

      const printWindow = window.open('', '', 'width=800,height=600');
      if (!printWindow) return;

      printWindow.document.write(`
        <html>
          <head>
            <title>样本跟踪表 - ${record.request_code}</title>
            <style>
              body { font-family: sans-serif; padding: 40px; }
              h1 { text-align: center; margin-bottom: 30px; }
              .header { margin-bottom: 20px; line-height: 1.6; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th, td { border: 1px solid #000; padding: 8px; text-align: center; }
              .footer { margin-top: 40px; display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            <h1>样本跟踪表</h1>
            <div class="header">
              <div>项目编号: ${record.project_code}</div>
              <div>申请单号: ${record.request_code}</div>
              <div>类型: ${record.type === 'borrow' ? '领用' : '归还'}</div>
              <div>申请人: ${record.requester}</div>
              <div>日期: ${new Date(record.created_at).toLocaleDateString()}</div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>序号</th>
                  <th>样本编号</th>
                  <th>受试者</th>
                  <th>时间点</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                ${samplesList.map((s: any, i: number) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td style="font-family: monospace;">${s.sample_code}</td>
                    <td>${s.subject_code || '-'}</td>
                    <td>${s.collection_time || '-'}</td>
                    <td></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              <div>申请人签名: ______________</div>
              <div>管理员签名: ______________</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error(error);
      toast.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Heading>样本跟踪表打印</Heading>
          <Text className="mt-1 text-zinc-600">查询并打印领用/归还记录的跟踪表</Text>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex gap-4 max-w-md">
            <Input 
              placeholder="输入申请单号或项目编号" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <Button onClick={handleSearch}>
              <MagnifyingGlassIcon className="h-4 w-4" />
              查询
            </Button>
          </div>
        </div>

        {records.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <Table bleed striped>
              <TableHead>
                <TableRow>
                  <TableHeader>申请单号</TableHeader>
                  <TableHeader>项目编号</TableHeader>
                  <TableHeader>类型</TableHeader>
                  <TableHeader>申请人</TableHeader>
                  <TableHeader>样本数</TableHeader>
                  <TableHeader>时间</TableHeader>
                  <TableHeader>操作</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.request_code}</TableCell>
                    <TableCell>{record.project_code}</TableCell>
                    <TableCell>{record.type === 'borrow' ? '领用' : '归还'}</TableCell>
                    <TableCell>{record.requester}</TableCell>
                    <TableCell>{record.sample_count}</TableCell>
                    <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button plain onClick={() => handlePrint(record)}>
                        <DocumentTextIcon className="h-4 w-4" />
                        打印跟踪表
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

