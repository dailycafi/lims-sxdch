import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Select } from '@/components/select';

export interface StorageStructure {
  freezers: string[];
  // Map: freezer -> shelf -> rack -> box[]
  hierarchy: Record<string, Record<string, Record<string, string[]>>>;
}

interface StorageFreezerViewProps {
  structure: StorageStructure;
  onBoxSelect: (freezer: string, shelf: string, rack: string, box: string) => void;
  // 是否允许选择架子位置（而不是必须选择已有盒子）
  allowRackSelect?: boolean;
  onRackSelect?: (freezer: string, shelf: string, rack: string) => void;
  className?: string;
}

export function StorageFreezerView({
  structure,
  onBoxSelect,
  allowRackSelect = false,
  onRackSelect,
  className
}: StorageFreezerViewProps) {
  const [selectedFreezer, setSelectedFreezer] = useState<string>(structure.freezers[0] || '');
  const [selectedShelf, setSelectedShelf] = useState<string>('');
  const [selectedRack, setSelectedRack] = useState<string>('');
  const [inputValue, setInputValue] = useState(''); // 用于新建层/架子的输入框

  // 当切换层级时，清空输入框
  useEffect(() => {
    setInputValue('');
  }, [selectedFreezer, selectedShelf, selectedRack]);

  // Reset sub-selections when parent changes
  const handleFreezerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFreezer(e.target.value);
    setSelectedShelf('');
    setSelectedRack('');
  };

  // 根据当前选择状态计算列表，如果是新建的层/架子（不在 hierarchy 中），手动加入
  const rawShelves = selectedFreezer ? Object.keys(structure.hierarchy[selectedFreezer] || {}) : [];
  const shelves = (selectedShelf && !rawShelves.includes(selectedShelf)) ? [...rawShelves, selectedShelf] : rawShelves;

  const rawRacks = (selectedFreezer && selectedShelf) ? Object.keys(structure.hierarchy[selectedFreezer]?.[selectedShelf] || {}) : [];
  const racks = (selectedRack && !rawRacks.includes(selectedRack)) ? [...rawRacks, selectedRack] : rawRacks;
  
  const boxes = (selectedFreezer && selectedShelf && selectedRack) 
    ? (structure.hierarchy[selectedFreezer]?.[selectedShelf]?.[selectedRack] || []) 
    : [];

  return (
    <div className={clsx("flex flex-col gap-4", className)}>
      {/* 顶部工具栏：过滤器 + 管理按钮 */}
      <div className="flex items-end justify-between bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">冰箱</label>
            <Select value={selectedFreezer} onChange={handleFreezerChange} className="w-48">
              <option value="">请选择冰箱</option>
              {structure.freezers.map(f => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">层 (Shelf)</label>
            <Select 
              value={selectedShelf} 
              onChange={(e) => { setSelectedShelf(e.target.value); setSelectedRack(''); }} 
              disabled={!selectedFreezer}
              className="w-32"
            >
              <option value="">请选择层</option>
              {shelves.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">架 (Rack)</label>
            <Select 
              value={selectedRack} 
              onChange={(e) => setSelectedRack(e.target.value)} 
              disabled={!selectedShelf}
              className="w-32"
            >
              <option value="">请选择架</option>
              {racks.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
        </div>

        <div>
          <Link href="/storage" target="_blank">
            <Button outline className="text-sm">
              <Cog6ToothIcon className="w-4 h-4 mr-1" />
              管理存储结构
            </Button>
          </Link>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm min-h-[300px]">
        {!selectedFreezer ? (
          <div className="flex items-center justify-center h-full text-zinc-400">
            请先选择一个冰箱以查看内容
          </div>
        ) : !selectedShelf ? (
          <div className="space-y-4">
            <Text className="font-medium">冰箱 {selectedFreezer} 概览</Text>
            {shelves.length === 0 ? (
              <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
                <Text className="text-amber-800 mb-2">该冰箱暂无层</Text>
                {allowRackSelect && (
                  <div className="mt-4">
                    <Text className="text-sm text-amber-700 mb-2">输入新层名称：</Text>
                    <div className="flex gap-2 justify-center">
                      <input
                        type="text"
                        placeholder="如：Layer 1"
                        className="px-3 py-2 border border-amber-300 rounded-lg text-sm"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const value = inputValue.trim();
                            if (value) {
                              setSelectedShelf(value);
                              setInputValue('');
                            }
                          }
                        }}
                      />
                      <Button 
                        onClick={() => {
                          const value = inputValue.trim();
                          if (value) {
                            setSelectedShelf(value);
                            setInputValue('');
                          }
                        }}
                      >
                        确定
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {shelves.map(shelf => (
                  <div 
                    key={shelf}
                    onClick={() => setSelectedShelf(shelf)}
                    className="p-4 border border-zinc-200 rounded-lg hover:border-blue-500 cursor-pointer bg-zinc-50 hover:bg-blue-50 transition-colors"
                  >
                    <Text className="font-bold text-lg mb-1">{shelf}</Text>
                    <Text className="text-xs text-zinc-500">
                      {Object.keys(structure.hierarchy[selectedFreezer][shelf] || {}).length} 个架子
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !selectedRack ? (
          <div className="space-y-4">
             <div className="flex items-center gap-2">
               <Button plain onClick={() => setSelectedShelf('')}>← 返回冰箱</Button>
               <Text className="font-medium">{selectedFreezer} / {selectedShelf} 概览</Text>
             </div>
            {racks.length === 0 ? (
              <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
                <Text className="text-amber-800 mb-2">该层暂无架子</Text>
                {allowRackSelect && (
                  <div className="mt-4">
                    <Text className="text-sm text-amber-700 mb-2">输入新架子名称：</Text>
                    <div className="flex gap-2 justify-center">
                      <input
                        type="text"
                        placeholder="如：Rack A"
                        className="px-3 py-2 border border-amber-300 rounded-lg text-sm"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const value = inputValue.trim();
                            if (value) {
                              setSelectedRack(value);
                              setInputValue('');
                            }
                          }
                        }}
                      />
                      <Button 
                        onClick={() => {
                          const value = inputValue.trim();
                          if (value) {
                            setSelectedRack(value);
                            setInputValue('');
                          }
                        }}
                      >
                        确定
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {racks.map(rack => (
                  <div 
                    key={rack}
                    onClick={() => setSelectedRack(rack)}
                    className="p-4 border border-zinc-200 rounded-lg hover:border-blue-500 cursor-pointer bg-zinc-50 hover:bg-blue-50 transition-colors"
                  >
                    <Text className="font-bold text-lg mb-1">{rack}</Text>
                    <Text className="text-xs text-zinc-500">
                      {(structure.hierarchy[selectedFreezer][selectedShelf][rack] || []).length} 个盒子
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex items-center gap-2">
               <Button plain onClick={() => setSelectedRack('')}>← 返回层</Button>
               <Text className="font-medium">{selectedFreezer} / {selectedShelf} / {selectedRack} - 盒子列表</Text>
             </div>
            
            {/* 允许选择架子位置放置新盒子 */}
            {allowRackSelect && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <Text className="font-medium text-green-800">选择此架子位置</Text>
                  <Text className="text-sm text-green-600">
                    将样本盒放置到 {selectedFreezer} / {selectedShelf} / {selectedRack}
                  </Text>
                </div>
                <Button 
                  onClick={() => onRackSelect?.(selectedFreezer, selectedShelf, selectedRack)}
                >
                  确认放置
                </Button>
              </div>
            )}

            {boxes.length === 0 ? (
              <div className="text-zinc-400 py-8 text-center">
                {allowRackSelect ? '此位置暂无盒子，可放置新盒子' : '该位置没有盒子'}
              </div>
            ) : (
              <>
                <Text className="text-sm text-zinc-500">已有盒子（可选择）：</Text>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {boxes.map(box => (
                    <div 
                      key={box}
                      onClick={() => onBoxSelect(selectedFreezer, selectedShelf, selectedRack, box)}
                      className="aspect-square flex items-center justify-center p-4 border border-zinc-200 rounded-lg hover:border-blue-500 cursor-pointer bg-white shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="text-center">
                        <div className="mb-1">📦</div>
                        <Text className="font-medium text-sm truncate px-1">{box}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

