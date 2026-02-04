import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { PlusIcon } from '@heroicons/react/20/solid';

export default function SpecialSampleApplyPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={2}>申请入库</Heading>
            <Text className="text-zinc-600 mt-1">
              提交特殊样本入库申请，等待审批后进行接收
            </Text>
          </div>
          <Button>
            <PlusIcon className="w-4 h-4" />
            新建申请
          </Button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <PlusIcon className="h-8 w-8 text-gray-400" />
          </div>
          <Text className="text-gray-500">暂无入库申请</Text>
          <Text className="text-sm text-gray-400 mt-1">点击上方按钮创建新的特殊样本入库申请</Text>
        </div>
      </div>
    </AppLayout>
  );
}
