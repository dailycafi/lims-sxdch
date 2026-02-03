import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { ArchiveBoxIcon } from '@heroicons/react/20/solid';

export default function MatrixSampleAliquotPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Heading level={2}>分装入库</Heading>
          <Text className="text-zinc-600 mt-1">
            对空白基质样本进行分装处理并入库存储
          </Text>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ArchiveBoxIcon className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="text-gray-500">暂无待分装样本</Text>
          <Text className="text-sm text-gray-400 mt-1">已清点的空白基质样本将显示在这里进行分装入库</Text>
        </div>
      </div>
    </AppLayout>
  );
}
