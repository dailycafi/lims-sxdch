import React, { useState } from 'react';
import clsx from 'clsx';
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
  className?: string;
}

export function StorageFreezerView({
  structure,
  onBoxSelect,
  className
}: StorageFreezerViewProps) {
  const [selectedFreezer, setSelectedFreezer] = useState<string>(structure.freezers[0] || '');
  const [selectedShelf, setSelectedShelf] = useState<string>('');
  const [selectedRack, setSelectedRack] = useState<string>('');

  // Reset sub-selections when parent changes
  const handleFreezerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFreezer(e.target.value);
    setSelectedShelf('');
    setSelectedRack('');
  };

  const shelves = selectedFreezer ? Object.keys(structure.hierarchy[selectedFreezer] || {}) : [];
  const racks = (selectedFreezer && selectedShelf) ? Object.keys(structure.hierarchy[selectedFreezer]?.[selectedShelf] || {}) : [];
  const boxes = (selectedFreezer && selectedShelf && selectedRack) 
    ? (structure.hierarchy[selectedFreezer]?.[selectedShelf]?.[selectedRack] || []) 
    : [];

  return (
    <div className={clsx("flex flex-col gap-4", className)}>
      {/* Filters */}
      <div className="flex gap-4 items-end bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
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

      {/* Visualization Area */}
      <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm min-h-[300px]">
        {!selectedFreezer ? (
          <div className="flex items-center justify-center h-full text-zinc-400">
            请先选择一个冰箱以查看内容
          </div>
        ) : !selectedShelf ? (
          <div className="space-y-4">
            <Text className="font-medium">冰箱 {selectedFreezer} 概览</Text>
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
          </div>
        ) : !selectedRack ? (
          <div className="space-y-4">
             <div className="flex items-center gap-2">
               <Button plain onClick={() => setSelectedShelf('')}>← 返回冰箱</Button>
               <Text className="font-medium">{selectedFreezer} / {selectedShelf} 概览</Text>
             </div>
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
          </div>
        ) : (
          <div className="space-y-4">
             <div className="flex items-center gap-2">
               <Button plain onClick={() => setSelectedRack('')}>← 返回层</Button>
               <Text className="font-medium">{selectedFreezer} / {selectedShelf} / {selectedRack} - 盒子列表</Text>
             </div>
            {boxes.length === 0 ? (
              <div className="text-zinc-400 py-8 text-center">该位置没有盒子</div>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

