import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { AnimatedLoadingState, AnimatedSkeletonRows } from '@/components/animated-table';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Select } from '@/components/select';

export default function TestSkeletonPage() {
  const [showLoading, setShowLoading] = useState(false);
  const [rowCount, setRowCount] = useState(5);
  const [colCount, setColCount] = useState(4);

  // 在组件内部
  const [mockData, setMockData] = useState<any[]>([]);

  // 在客户端生成数据
  useEffect(() => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `项目 ${i + 1}`,
      status: ['进行中', '已完成', '待审核'][i % 3],
      date: new Date().toLocaleDateString('zh-CN'),
      amount: 1000 + (i * 1234) // 使用固定的计算值代替随机数
    }));
    setMockData(data);
  }, []);

  // 触发加载状态
  const triggerLoading = (duration: number = 3000) => {
    setShowLoading(true);
    setTimeout(() => {
      setShowLoading(false);
    }, duration);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <Heading>骨架屏（Skeleton）测试页面</Heading>
          <Text className="mt-2 text-zinc-600">
            测试表格骨架屏加载效果 - 在数据加载时显示灰色条纹占位符
          </Text>
        </div>

        {/* 控制面板 */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-medium mb-3">控制面板</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">骨架屏行数</label>
              <Select value={rowCount.toString()} onChange={(e) => setRowCount(Number(e.target.value))}>
                <option value="3">3 行</option>
                <option value="5">5 行</option>
                <option value="8">8 行</option>
                <option value="10">10 行</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">列数</label>
              <Select value={colCount.toString()} onChange={(e) => setColCount(Number(e.target.value))}>
                <option value="3">3 列</option>
                <option value="4">4 列</option>
                <option value="5">5 列</option>
                <option value="6">6 列</option>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button color="blue" onClick={() => triggerLoading(3000)}>
                显示 3 秒
              </Button>
              <Button color="green" onClick={() => triggerLoading(5000)}>
                显示 5 秒
              </Button>
            </div>
          </div>
        </div>

        {/* 直接展示骨架屏组件 */}
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">直接展示骨架屏效果:</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  {Array.from({ length: colCount }, (_, i) => (
                    <TableHeader key={i}>列 {i + 1}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatedSkeletonRows colSpan={colCount} rowCount={rowCount} />
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 表格加载动画测试 */}
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">实际表格加载效果:</h2>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>ID</TableHeader>
                  <TableHeader>项目名称</TableHeader>
                  <TableHeader>状态</TableHeader>
                  <TableHeader>日期</TableHeader>
                  <TableHeader>金额</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {showLoading ? (
                  <AnimatedLoadingState colSpan={5} variant="skeleton" />
                ) : (
                  mockData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>¥{item.amount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 不同变体的加载动画对比 */}
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">不同加载动画对比:</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow">
              <h3 className="font-medium p-4 border-b">骨架屏效果（推荐）</h3>
              <Table>
                <TableBody>
                  <AnimatedLoadingState colSpan={3} variant="skeleton" />
                </TableBody>
              </Table>
            </div>
            <div className="bg-white rounded-lg shadow">
              <h3 className="font-medium p-4 border-b">Spinner 动画</h3>
              <Table>
                <TableBody>
                  <AnimatedLoadingState colSpan={3} variant="spinner" />
                </TableBody>
              </Table>
            </div>
            <div className="bg-white rounded-lg shadow">
              <h3 className="font-medium p-4 border-b">Dots 动画</h3>
              <Table>
                <TableBody>
                  <AnimatedLoadingState colSpan={3} variant="dots" />
                </TableBody>
              </Table>
            </div>
            <div className="bg-white rounded-lg shadow">
              <h3 className="font-medium p-4 border-b">Pulse 动画</h3>
              <Table>
                <TableBody>
                  <AnimatedLoadingState colSpan={3} variant="pulse" />
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* 骨架屏特性说明 */}
        <div className="mb-8 bg-blue-50 p-6 rounded-lg">
          <h2 className="text-lg font-medium mb-3">骨架屏特性说明</h2>
          <ul className="space-y-2 text-sm text-blue-900">
            <li>• 每行显示灰色占位条，模拟真实内容布局</li>
            <li>• 渐变动画效果，从半透明到不透明循环</li>
            <li>• 支持自定义行数和列数</li>
            <li>• 延迟渐进式显示，每行有轻微时间差</li>
            <li>• 更好的用户体验，减少页面跳动感</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}