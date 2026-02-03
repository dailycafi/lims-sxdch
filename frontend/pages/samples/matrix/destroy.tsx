import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { TrashIcon } from '@heroicons/react/20/solid';

export default function MatrixSampleDestroyPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Heading level={2}>样本销毁</Heading>
          <Text className="text-zinc-600 mt-1">
            管理空白基质样本的销毁申请和执行记录
          </Text>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <TrashIcon className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="text-gray-500">暂无销毁记录</Text>
          <Text className="text-sm text-gray-400 mt-1">空白基质样本的销毁记录将显示在这里</Text>
        </div>
      </div>
    </AppLayout>
  );
}
