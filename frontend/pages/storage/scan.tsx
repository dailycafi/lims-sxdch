import React, { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { api } from '@/lib/api';
import { Text } from '@/components/text';
import { Badge } from '@/components/badge';
import { QrCodeIcon, ArrowPathIcon } from '@heroicons/react/20/solid';
import { clsx } from 'clsx';

type ScanContext = {
  freezer: { id: number; name: string; barcode: string } | null;
  shelf: { id: number; name: string; barcode: string } | null;
  rack: { id: number; name: string; barcode: string } | null;
};

export default function StorageScanPage() {
  const [barcode, setBarcode] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Hierarchy Context
  const [context, setContext] = useState<ScanContext>({
    freezer: null,
    shelf: null,
    rack: null
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [context, scanResult]); // Re-focus on state change

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    setScanResult(null);
    const code = barcode.trim();
    setBarcode(''); // Clear immediately

    try {
      // 1. Try to find storage entity (Freezer, Shelf, Rack, Box)
      try {
        const res = await api.get(`/storage/find-by-barcode/${encodeURIComponent(code)}`);
        const entity = res.data;
        
        if (entity.type === 'freezer') {
          setContext({
            freezer: { id: entity.data.id, name: entity.data.name, barcode: entity.data.barcode || entity.data.name },
            shelf: null,
            rack: null
          });
          setScanResult({ type: 'success', message: `已切换到冰箱: ${entity.data.name}`, detail: '请继续扫描层 (Shelf)' });
          return;
        }
        
        if (entity.type === 'shelf') {
          // Verify if belongs to current freezer (if set)
          if (context.freezer && entity.data.freezer_id !== context.freezer.id) {
             // Maybe auto-switch freezer? Or warn?
             // Let's warn for safety, or prompt confirm. For now, just switch context.
             // Ideally we should fetch the parent freezer info if not current.
          }
          
          setContext(prev => ({
            ...prev,
            shelf: { id: entity.data.id, name: entity.data.name, barcode: entity.data.barcode },
            rack: null
          }));
          setScanResult({ type: 'success', message: `已切换到层: ${entity.data.name}`, detail: '请继续扫描架子 (Rack)' });
          return;
        }

        if (entity.type === 'rack') {
           setContext(prev => ({
            ...prev,
            rack: { id: entity.data.id, name: entity.data.name, barcode: entity.data.barcode }
          }));
          setScanResult({ type: 'success', message: `已切换到架子: ${entity.data.name}`, detail: '可以开始扫描盒子放入此架子' });
          return;
        }

        if (entity.type === 'box') {
           // Operation Logic: 
           if (context.rack) {
               // Assign Box to Rack logic
               try {
                   // Call API to move box
                   await api.post(`/storage/boxes/${entity.id}/move`, {
                       rack_id: context.rack.id
                   });
                   
                   setScanResult({ 
                       type: 'success', 
                       message: `盒子 ${entity.data.name} 已入库`, 
                       detail: `位置: ${context.freezer?.name} > ${context.shelf?.name} > ${context.rack?.name}`,
                       contextMatch: true 
                   });
               } catch (err) {
                   setScanResult({ type: 'error', message: '入库失败', detail: '无法移动盒子到当前架子' });
               }
           } else {
               // Check if box has location
               const locationStr = entity.data.rack_id ? "已入库 (查看详情)" : "未入库";
               setScanResult({ 
                   type: 'box', 
                   data: entity.data, 
                   message: `扫描到盒子: ${entity.data.name}`, 
                   detail: locationStr,
                   contextMatch: false 
               });
           }
           return;
        }

      } catch (err) {
        // Not a storage entity, try Sample
      }

      // 2. Try to find sample
      try {
        const sampleRes = await api.get(`/samples/by-code/${encodeURIComponent(code)}`);
        if (sampleRes.data) {
          setScanResult({ type: 'sample', data: sampleRes.data });
          return;
        }
      } catch (err) {
        // Ignore
      }

      setScanResult({ type: 'error', message: '未找到匹配的条码' });
    } catch (e) {
      setScanResult({ type: 'error', message: '查询出错' });
    } finally {
      setLoading(false);
    }
  };

  const resetContext = () => {
      setContext({ freezer: null, shelf: null, rack: null });
      setScanResult(null);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <Heading className="flex items-center gap-2">
            <QrCodeIcon className="h-8 w-8 text-blue-500" />
            存储作业扫描
            </Heading>
            <Button plain onClick={resetContext}>
                <ArrowPathIcon className="h-4 w-4 mr-1"/>
                重置上下文
            </Button>
        </div>

        {/* Context Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 mb-6">
            <Text className="text-sm text-zinc-500 mb-2">当前作业位置 (上下文)</Text>
            <div className="flex items-center gap-2">
                <div className={clsx("flex-1 p-3 rounded-lg border text-center", context.freezer ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-zinc-50 border-zinc-200 text-zinc-400")}>
                    <div className="text-xs">冰箱 (Freezer)</div>
                    <div className="font-bold text-lg">{context.freezer?.name || '-'}</div>
                </div>
                <div className="text-zinc-300">→</div>
                <div className={clsx("flex-1 p-3 rounded-lg border text-center", context.shelf ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-zinc-50 border-zinc-200 text-zinc-400")}>
                    <div className="text-xs">层 (Shelf)</div>
                    <div className="font-bold text-lg">{context.shelf?.name || '-'}</div>
                </div>
                <div className="text-zinc-300">→</div>
                <div className={clsx("flex-1 p-3 rounded-lg border text-center", context.rack ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-zinc-50 border-zinc-200 text-zinc-400")}>
                    <div className="text-xs">架子 (Rack)</div>
                    <div className="font-bold text-lg">{context.rack?.name || '-'}</div>
                </div>
            </div>
            {/* Prompt */}
            <div className="mt-3 text-center">
                {!context.freezer && <Text className="text-amber-600">请扫描冰箱条码开始作业</Text>}
                {context.freezer && !context.shelf && <Text className="text-blue-600">请扫描层 (Shelf) 条码</Text>}
                {context.shelf && !context.rack && <Text className="text-blue-600">请扫描架子 (Rack) 条码</Text>}
                {context.rack && <Text className="text-green-600 font-bold">就绪：请扫描盒子或样本进行入库/出库操作</Text>}
            </div>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-zinc-200">
          <form onSubmit={handleScan}>
            <div className="mb-4">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="扫描或手动输入条码..."
                  className="text-lg h-12 font-mono flex-1"
                  autoComplete="off"
                />
                <Button type="submit" className="h-12 !px-6 whitespace-nowrap shrink-0 min-w-fit" disabled={loading}>
                  {loading ? '查询中...' : '确认'}
                </Button>
              </div>
            </div>
          </form>

          {/* Result Display */}
          {scanResult && (
            <div className={clsx("mt-4 p-4 rounded-lg border", 
                scanResult.type === 'error' ? "bg-red-50 border-red-200" : 
                scanResult.type === 'success' ? "bg-green-50 border-green-200" : "bg-zinc-50 border-zinc-200"
            )}>
              {scanResult.type === 'success' && (
                  <div className="text-center">
                      <div className="text-lg font-bold text-green-800 mb-1">{scanResult.message}</div>
                      <div className="text-green-600">{scanResult.detail}</div>
                  </div>
              )}
              
              {scanResult.type === 'error' && (
                  <div className="text-center text-red-600 font-medium">
                      {scanResult.message}
                  </div>
              )}

              {scanResult.type === 'sample' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge color="blue">样本</Badge>
                    <Text className="text-xl font-bold font-mono">{scanResult.data.sample_code}</Text>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Text className="text-zinc-500 text-sm">状态</Text><Text>{scanResult.data.status}</Text></div>
                    <div>
                        <Text className="text-zinc-500 text-sm">位置</Text>
                        <Text className="font-medium text-blue-600">
                            {scanResult.data.freezer_id ? `${scanResult.data.freezer_id} > ...` : '未入库'}
                        </Text>
                    </div>
                  </div>
                </div>
              )}

              {scanResult.type === 'box' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge color="purple">盒子</Badge>
                    <Text className="text-xl font-bold font-mono">{scanResult.data?.code || scanResult.data?.name || '未知'}</Text>
                  </div>
                  <Text>{scanResult.message}</Text>
                  <Text className="text-sm text-zinc-500">{scanResult.detail}</Text>
                  
                  {!scanResult.contextMatch && !scanResult.data?.rack_id && (
                      <div className="bg-amber-100 text-amber-800 p-3 rounded text-sm text-center font-bold mt-2">
                          ⚠️ 该盒子尚未入库，请先扫描架子条码以进行入库操作
                      </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
