import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import BlankMatrixReceive from './receive';
import BlankMatrixInventory from './inventory';

type TabType = 'receive' | 'inventory';

interface TabConfig {
  id: TabType;
  label: string;
}

const TABS: TabConfig[] = [
  { id: 'receive', label: '接收' },
  { id: 'inventory', label: '清点' },
];

export default function BlankMatrixPage() {
  const [activeTab, setActiveTab] = useState<TabType>('receive');

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Heading level={2}>空白基质管理</Heading>
          <Text className="text-zinc-600 mt-1">
            管理空白基质样本的接收、清点和入库
          </Text>
        </div>

        {/* Tab 导航 */}
        <div className="border-b border-zinc-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab 内容 */}
        <div>
          {activeTab === 'receive' && <BlankMatrixReceive />}
          {activeTab === 'inventory' && <BlankMatrixInventory />}
        </div>
      </div>
    </AppLayout>
  );
}
