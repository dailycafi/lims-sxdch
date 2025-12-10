import React from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { api } from '@/lib/api';
import { Badge } from '@/components/badge';
import JsBarcode from 'jsbarcode';
import { PrinterIcon } from '@heroicons/react/20/solid';

interface Freezer {
  id: number;
  name: string;
  barcode: string;
  location: string;
  temperature: number;
  description: string;
  total_shelves: number;
  is_active: boolean;
}

export default function StorageListPage() {
  const [freezers, setFreezers] = React.useState<Freezer[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchFreezers();
  }, []);

  const fetchFreezers = async () => {
    try {
      const res = await api.get('/storage/freezers');
      setFreezers(res.data);
    } catch (e) {
      console.error('Failed to fetch freezers', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBarcode = (text: string, label: string) => {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true
    });
    const imgUrl = canvas.toDataURL("image/png");
    
    const win = window.open('', '', 'width=400,height=300');
    if(win) {
        win.document.write(`
            <html>
                <body style="text-align:center; padding: 20px;">
                    <h3>${label}</h3>
                    <img src="${imgUrl}" />
                </body>
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </html>
        `);
        win.document.close();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading>存储设备管理</Heading>
            <Text className="mt-1 text-zinc-600">管理冰箱、液氮罐等存储设备及其层级结构</Text>
          </div>
          <div className="flex gap-2">
            <Button href="/storage/scan" outline>
                扫描作业
            </Button>
            <Button href="/storage/new">
                + 添加设备
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>设备名称</TableHeader>
                <TableHeader>条码</TableHeader>
                <TableHeader>位置</TableHeader>
                <TableHeader>温度设定</TableHeader>
                <TableHeader>层数</TableHeader>
                <TableHeader>状态</TableHeader>
                <TableHeader>操作</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-500">加载中...</TableCell>
                </TableRow>
              ) : freezers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-zinc-500">暂无存储设备</TableCell>
                </TableRow>
              ) : (
                freezers.map(freezer => (
                  <TableRow key={freezer.id}>
                    <TableCell className="font-medium">{freezer.name}</TableCell>
                    <TableCell className="font-mono text-xs">{freezer.barcode || freezer.name}</TableCell>
                    <TableCell>{freezer.location || '-'}</TableCell>
                    <TableCell>{freezer.temperature}°C</TableCell>
                    <TableCell>{freezer.total_shelves} 层</TableCell>
                    <TableCell>
                      <Badge color={freezer.is_active ? 'green' : 'red'}>
                        {freezer.is_active ? '正常' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button plain href={`/storage/${freezer.id}`}>查看详情</Button>
                        <Button plain onClick={() => handlePrintBarcode(freezer.barcode || freezer.name, freezer.name)}>
                            <PrinterIcon className="w-4 h-4"/>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
