import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { StorageFreezerView, StorageStructure } from './StorageFreezerView';
import { StorageBoxGrid, StorageBoxSample } from './StorageBoxGrid';
import { Button } from '@/components/button';
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog';
import { Text } from '@/components/text';

interface StorageLocationPickerProps {
  onSelect: (location: { freezer: string; shelf: string; rack: string; box: string; position?: string }) => void;
  onCancel: () => void;
}

export function StorageLocationPicker({ onSelect, onCancel }: StorageLocationPickerProps) {
  const [structure, setStructure] = useState<StorageStructure>({ freezers: [], hierarchy: {} });
  const [loading, setLoading] = useState(true);
  const [selectedBox, setSelectedBox] = useState<{
    freezer: string;
    shelf: string;
    rack: string;
    box: string;
  } | null>(null);
  const [boxSamples, setBoxSamples] = useState<StorageBoxSample[]>([]);
  const [loadingBox, setLoadingBox] = useState(false);

  useEffect(() => {
    fetchStructure();
  }, []);

  useEffect(() => {
    if (selectedBox) {
      fetchBoxContent(selectedBox);
    }
  }, [selectedBox]);

  const fetchStructure = async () => {
    setLoading(true);
    try {
      const res = await api.get('/samples/storage/structure');
      setStructure(res.data);
    } catch (e) {
      console.error('Failed to fetch storage structure', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxContent = async (box: { freezer: string; shelf: string; rack: string; box: string }) => {
    setLoadingBox(true);
    try {
      const url = `/samples/storage/box/${encodeURIComponent(box.freezer)}/${encodeURIComponent(box.shelf)}/${encodeURIComponent(box.rack)}/${encodeURIComponent(box.box)}`;
      const res = await api.get(url);
      setBoxSamples(res.data || []);
    } catch (e) {
      console.error('Failed to fetch box content', e);
    } finally {
      setLoadingBox(false);
    }
  };

  const handleBoxSelect = (freezer: string, shelf: string, rack: string, box: string) => {
    // Direct select box logic if we just want to pick a box
    // Or open box to pick position if needed. 
    // For now, we assume picking a box means we will put samples into it.
    // We can also show the box content to let user see if it is full.
    setSelectedBox({ freezer, shelf, rack, box });
  };

  // 选择架子位置（放置新盒子）
  const handleRackSelect = (freezer: string, shelf: string, rack: string) => {
    // 直接调用 onSelect，box 参数为 'new'（表示放置新盒子）
    onSelect({ freezer, shelf, rack, box: 'new' });
  };

  const handleConfirmBox = () => {
    if (selectedBox) {
      onSelect(selectedBox);
    }
  };

  return (
    <div className="space-y-4 h-[600px] flex flex-col">
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          加载存储结构...
        </div>
      ) : !selectedBox ? (
        <div className="flex-1 overflow-y-auto">
          <StorageFreezerView 
            structure={structure} 
            onBoxSelect={handleBoxSelect}
            allowRackSelect={true}
            onRackSelect={handleRackSelect}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Text className="font-medium">
                已选择: {selectedBox.freezer} / {selectedBox.shelf} / {selectedBox.rack} / {selectedBox.box}
              </Text>
              <Text className="text-xs text-zinc-500">
                盒内样本数: {boxSamples.length} / 100 (示例容量)
              </Text>
            </div>
            <Button plain onClick={() => setSelectedBox(null)}>
              重新选择
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-zinc-50 flex justify-center">
            {loadingBox ? (
              <div className="flex items-center justify-center text-zinc-500">加载盒子内容...</div>
            ) : (
              <StorageBoxGrid 
                samples={boxSamples}
                readOnly={true} // Just for visualization
              />
            )}
          </div>
          
          <div className="mt-4 flex justify-end gap-3">
            <Button plain onClick={() => setSelectedBox(null)}>
              返回
            </Button>
            <Button onClick={handleConfirmBox}>
              确认使用此盒
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

