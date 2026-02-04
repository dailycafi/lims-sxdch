import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { ClipboardDocumentListIcon } from '@heroicons/react/20/solid';

export default function SpecialSampleInventoryPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Heading level={2}>清点入库</Heading>
          <Text className="text-zinc-600 mt-1">
            对已接收的特殊样本进行清点确认，分配存储位置并入库
          </Text>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <ClipboardDocumentListIcon className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="text-gray-500">暂无待清点样本</Text>
          <Text className="text-sm text-gray-400 mt-1">已接收的特殊样本将显示在这里进行清点入库</Text>
        </div>
      </div>
    </AppLayout>
  );
}
