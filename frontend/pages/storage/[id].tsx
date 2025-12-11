import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { api } from '@/lib/api';
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog';
import { Input } from '@/components/input';
import { Field, Label } from '@/components/fieldset';
import { PrinterIcon } from '@heroicons/react/20/solid';
import JsBarcode from 'jsbarcode';

export default function FreezerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [freezer, setFreezer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeShelf, setActiveShelf] = useState<any>(null);
  
  // Dialog states
  const [isRackDialogOpen, setIsRackDialogOpen] = useState(false);
  const [rackName, setRackName] = useState('');

  useEffect(() => {
    if (id) {
      fetchFreezer();
    }
  }, [id]);

  const fetchFreezer = async () => {
    try {
      const res = await api.get(`/storage/freezers/${id}`);
      setFreezer(res.data);
      if (res.data.shelves && res.data.shelves.length > 0) {
        // Keep active shelf if exists
        setActiveShelf((prev: any) => {
            if (prev) {
                const found = res.data.shelves.find((s: any) => s.id === prev.id);
                return found || res.data.shelves[0];
            }
            return res.data.shelves[0];
        });
      }
    } catch (e) {
      console.error('Failed to fetch freezer', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRack = async () => {
    if (!activeShelf || !rackName) return;
    try {
      await api.post('/storage/racks', {
        shelf_id: activeShelf.id,
        name: rackName,
        row_capacity: 5,
        col_capacity: 5
      });
      setIsRackDialogOpen(false);
      setRackName('');
      fetchFreezer(); // Refresh
    } catch (e) {
      alert('Failed to add rack');
    }
  };

  const handlePrintBarcode = (text: string, label: string) => {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, text, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true
    });
    const imgUrl = canvas.toDataURL("image/png");
    
    const win = window.open('', '', 'width=400,height=300');
    if(win) {
        win.document.write(`
            <html>
                <body style="text-align:center; padding: 20px;">
                    <h3>${label}</h3>
                    <img src="${imgUrl}" />
                </body>
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </html>
        `);
        win.document.close();
    }
  };

  if (loading) return <AppLayout>Loading...</AppLayout>;
  if (!freezer) return <AppLayout>Not Found</AppLayout>;

  // Sort shelves
  const shelves = [...freezer.shelves].sort((a: any, b: any) => a.level_order - b.level_order);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-4 text-sm text-zinc-500 mb-2">
                <span onClick={() => router.push('/storage')} className="cursor-pointer hover:text-blue-600">存储设备</span>
                <span>/</span>
                <span>{freezer.name}</span>
            </div>
            <Heading>{freezer.name}</Heading>
            <Text className="text-zinc-600">位置: {freezer.location} | 温度: {freezer.temperature}°C</Text>
          </div>
          <Button plain onClick={() => handlePrintBarcode(freezer.barcode || freezer.name, freezer.name)}>
            <PrinterIcon className="w-4 h-4 mr-1"/>
            打印设备条码
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Shelves Sidebar */}
          <div className="col-span-3 bg-white rounded-xl shadow border border-zinc-200 overflow-hidden h-[calc(100vh-200px)] flex flex-col">
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 font-medium">
              层级列表 ({shelves.length})
            </div>
            <div className="divide-y divide-zinc-100 overflow-y-auto flex-1">
              {shelves.map((shelf: any) => (
                <div 
                  key={shelf.id}
                  onClick={() => setActiveShelf(shelf)}
                  className={`p-4 cursor-pointer hover:bg-zinc-50 transition-colors group flex justify-between items-center ${activeShelf?.id === shelf.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                >
                  <div>
                    <div className="font-medium">{shelf.name}</div>
                    <div className="text-xs text-zinc-500">{shelf.racks?.length || 0} 个架子</div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePrintBarcode(shelf.barcode || `${freezer.name}-${shelf.name}`, shelf.name); }}
                    className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 rounded ml-2"
                    title="打印层条码"
                  >
                    <PrinterIcon className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Racks View */}
          <div className="col-span-9">
            {activeShelf ? (
              <div className="bg-white rounded-xl shadow border border-zinc-200 p-6 h-[calc(100vh-200px)] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Heading level={2}>{activeShelf.name}</Heading>
                    <Badge color="zinc" className="font-mono text-xs">{activeShelf.barcode || '无条码'}</Badge>
                  </div>
                  <Button onClick={() => setIsRackDialogOpen(true)}>
                    + 添加架子
                  </Button>
                </div>

                {activeShelf.racks && activeShelf.racks.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-4">
                    {activeShelf.racks.map((rack: any) => (
                      <div key={rack.id} className="border border-zinc-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer relative group bg-white">
                        <div className="text-3xl mb-2 text-center">🧊</div>
                        <div className="font-bold text-center mb-1">{rack.name}</div>
                        <div className="text-xs text-zinc-500 text-center font-mono bg-zinc-50 rounded py-1 mb-2">
                            {rack.barcode || '-'}
                        </div>
                        <div className="text-xs text-zinc-500 text-center">
                          {rack.boxes?.length || 0} 盒子
                        </div>
                        
                        {/* Print Rack Barcode */}
                        <div className="absolute top-2 right-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePrintBarcode(rack.barcode || rack.name, rack.name); }}
                                className="p-1 text-zinc-400 hover:text-blue-600 hover:bg-zinc-100 rounded"
                                title="打印架子条码"
                            >
                                <PrinterIcon className="w-4 h-4"/>
                            </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-zinc-400 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 mx-4 mb-4">
                    此层暂无架子，请点击右上角添加
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-400 bg-white rounded-xl border border-zinc-200">
                请选择左侧层级查看内容
              </div>
            )}
          </div>
        </div>

        {/* Add Rack Dialog */}
        <Dialog open={isRackDialogOpen} onClose={setIsRackDialogOpen}>
          <DialogTitle>添加架子</DialogTitle>
          <DialogBody>
            <Field>
              <Label>架子名称</Label>
              <Input 
                value={rackName}
                onChange={e => setRackName(e.target.value)}
                placeholder="例如: Rack A"
                autoFocus
              />
            </Field>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setIsRackDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddRack} disabled={!rackName}>确定</Button>
          </DialogActions>
        </Dialog>
      </div>
    </AppLayout>
  );
}
