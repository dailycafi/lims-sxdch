import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Badge } from '@/components/badge';
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@/components/table';
import { Dialog, DialogTitle, DialogBody, DialogActions, DialogDescription } from '@/components/dialog';
import { api } from '@/lib/api';
import { 
  ArrowPathIcon, 
  PlusIcon,
  MagnifyingGlassIcon,
  ArchiveBoxIcon,
  CubeIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChevronLeftIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/20/solid';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// 导入拆分后的组件
import { 
  Freezer, 
  SampleBox, 
  BoxSample, 
  STATUS_COLORS,
  FreezerCard,
  BoxCard,
  BoxGridView,
  BoxListView
} from '@/components/storage';

// 主页面组件
export default function StorageManagementPage() {
  // 状态
  const [loading, setLoading] = useState(true);
  const [freezers, setFreezers] = useState<Freezer[]>([]);
  const [boxes, setBoxes] = useState<SampleBox[]>([]);
  const [selectedFreezer, setSelectedFreezer] = useState<Freezer | null>(null);
  const [selectedBox, setSelectedBox] = useState<SampleBox | null>(null);
  const [boxSamples, setBoxSamples] = useState<BoxSample[]>([]);
  const [loadingBoxSamples, setLoadingBoxSamples] = useState(false);
  
  // 视图模式
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [boxDetailViewMode, setBoxDetailViewMode] = useState<'grid' | 'list'>('grid');
  
  // 筛选
  const [searchQuery, setSearchQuery] = useState('');
  
  // 对话框
  const [isBoxDetailOpen, setIsBoxDetailOpen] = useState(false);
  const [isAddBoxOpen, setIsAddBoxOpen] = useState(false);
  const [isEditBoxOpen, setIsEditBoxOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSampleDetailOpen, setIsSampleDetailOpen] = useState(false);
  
  // 选中状态
  const [selectedSampleId, setSelectedSampleId] = useState<number | null>(null);
  const [highlightedPosition, setHighlightedPosition] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState<BoxSample | null>(null);
  const [boxToDelete, setBoxToDelete] = useState<SampleBox | null>(null);
  const [boxToEdit, setBoxToEdit] = useState<SampleBox | null>(null);

  // 新建/编辑样本盒表单
  const [boxForm, setBoxForm] = useState({
    code: '',
    freezer_id: '',
    shelf_level: '',
    rack_position: '',
    rows: 10,
    cols: 10
  });

  useEffect(() => {
    fetchFreezers();
    fetchBoxes();
  }, []);

  const fetchFreezers = async () => {
    try {
      const res = await api.get('/samples/storage/freezers');
      setFreezers(res.data || []);
    } catch (e) {
      console.error('Failed to fetch freezers', e);
      // 模拟数据
      setFreezers([
        { id: 'F001', name: '超低温冰箱-1', location: '样本库A区', temperature: -80, shelves: 5, total_boxes: 50, used_boxes: 35 },
        { id: 'F002', name: '超低温冰箱-2', location: '样本库A区', temperature: -80, shelves: 5, total_boxes: 50, used_boxes: 42 },
        { id: 'F003', name: '低温冰箱-1', location: '样本库B区', temperature: -20, shelves: 4, total_boxes: 40, used_boxes: 28 },
        { id: 'F004', name: '冷藏冰箱-1', location: '样本库C区', temperature: 4, shelves: 3, total_boxes: 30, used_boxes: 15 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxes = async (freezerId?: string) => {
    try {
      const params = freezerId ? { freezer_id: freezerId } : {};
      const res = await api.get('/samples/storage/boxes', { params });
      setBoxes(res.data || []);
    } catch (e) {
      console.error('Failed to fetch boxes', e);
    }
  };

  const fetchBoxSamples = async (box: SampleBox) => {
    setLoadingBoxSamples(true);
    try {
      const url = `/samples/storage/box/${encodeURIComponent(box.freezer_id)}/${encodeURIComponent(box.shelf_level)}/${encodeURIComponent(box.rack_position)}/${encodeURIComponent(box.code)}`;
      const res = await api.get(url);
      setBoxSamples(res.data || []);
    } catch (e) {
      console.error('Failed to fetch box samples', e);
    } finally {
      setLoadingBoxSamples(false);
    }
  };

  const handleFreezerSelect = (freezer: Freezer) => {
    setSelectedFreezer(freezer);
    fetchBoxes(freezer.id);
  };

  const handleBoxSelect = (box: SampleBox) => {
    setSelectedBox(box);
    fetchBoxSamples(box);
    setIsBoxDetailOpen(true);
    setBoxDetailViewMode('grid');
  };

  const handleBackToFreezers = () => {
    setSelectedFreezer(null);
    fetchBoxes();
  };

  const handleSampleClick = (sample: BoxSample) => {
    setSelectedSample(sample);
    setSelectedSampleId(sample.id);
    setIsSampleDetailOpen(true);
  };

  // 添加样本盒
  const handleAddBox = async () => {
    if (!selectedFreezer) return;
    
    try {
      await api.post('/samples/storage/boxes', {
        ...boxForm,
        freezer_id: selectedFreezer.id,
        total_slots: boxForm.rows * boxForm.cols,
        used_slots: 0
      });
      toast.success('样本盒创建成功');
      setIsAddBoxOpen(false);
      setBoxForm({ code: '', freezer_id: '', shelf_level: '', rack_position: '', rows: 10, cols: 10 });
      fetchBoxes(selectedFreezer.id);
    } catch (e) {
      toast.error('创建失败');
    }
  };

  // 编辑样本盒
  const handleEditBox = async () => {
    if (!boxToEdit) return;
    
    try {
      await api.put(`/samples/storage/boxes/${boxToEdit.id}`, {
        code: boxForm.code,
        shelf_level: boxForm.shelf_level,
        rack_position: boxForm.rack_position,
      });
      toast.success('样本盒更新成功');
      setIsEditBoxOpen(false);
      setBoxToEdit(null);
      setBoxForm({ code: '', freezer_id: '', shelf_level: '', rack_position: '', rows: 10, cols: 10 });
      fetchBoxes(selectedFreezer?.id);
    } catch (e) {
      toast.error('更新失败');
    }
  };

  // 删除样本盒
  const handleDeleteBox = async () => {
    if (!boxToDelete) return;
    
    try {
      await api.delete(`/samples/storage/boxes/${boxToDelete.id}`);
      toast.success('样本盒删除成功');
      setIsDeleteConfirmOpen(false);
      setBoxToDelete(null);
      fetchBoxes(selectedFreezer?.id);
    } catch (e) {
      toast.error('删除失败，样本盒可能包含样本');
    }
  };

  const openEditDialog = (box: SampleBox) => {
    setBoxToEdit(box);
    setBoxForm({
      code: box.code,
      freezer_id: box.freezer_id,
      shelf_level: box.shelf_level,
      rack_position: box.rack_position,
      rows: box.rows,
      cols: box.cols
    });
    setIsEditBoxOpen(true);
  };

  const openDeleteDialog = (box: SampleBox) => {
    setBoxToDelete(box);
    setIsDeleteConfirmOpen(true);
  };

  // 筛选逻辑
  const filteredFreezers = freezers.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBoxes = boxes.filter(b =>
    b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (selectedFreezer ? b.freezer_id === selectedFreezer.id : true)
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {selectedFreezer && (
              <Button plain onClick={handleBackToFreezers}>
                <ChevronLeftIcon className="w-5 h-5" />
              </Button>
            )}
            <div>
              <Heading>
                {selectedFreezer ? `${selectedFreezer.name} - 样本盒管理` : '样本存储管理'}
              </Heading>
              <Text className="mt-1 text-zinc-600">
                {selectedFreezer 
                  ? `${selectedFreezer.location} | ${selectedFreezer.temperature}°C | ${selectedFreezer.used_boxes}/${selectedFreezer.total_boxes} 盒`
                  : '可视化管理冰箱和样本盒存储'
                }
              </Text>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedFreezer && (
              <Button onClick={() => {
                setBoxForm({ code: '', freezer_id: selectedFreezer.id, shelf_level: '', rack_position: '', rows: 10, cols: 10 });
                setIsAddBoxOpen(true);
              }}>
                <PlusIcon className="w-4 h-4" />
                添加样本盒
              </Button>
            )}
            <Button plain onClick={() => { fetchFreezers(); fetchBoxes(selectedFreezer?.id); }}>
              <ArrowPathIcon className="w-4 h-4" />
              刷新
            </Button>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 mb-6 p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                type="text"
                placeholder={selectedFreezer ? "搜索样本盒..." : "搜索冰箱..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* 视图切换 */}
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1',
                  viewMode === 'grid' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
                )}
                onClick={() => setViewMode('grid')}
              >
                <Squares2X2Icon className="w-4 h-4" />
                网格
              </button>
              <button
                className={clsx(
                  'px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1',
                  viewMode === 'list' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
                )}
                onClick={() => setViewMode('list')}
              >
                <ListBulletIcon className="w-4 h-4" />
                列表
              </button>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <Text className="text-zinc-500">加载存储数据中...</Text>
            </div>
          ) : selectedFreezer ? (
            // 样本盒视图
            <div className="p-6">
              {filteredBoxes.length === 0 ? (
                <div className="text-center py-12">
                  <ArchiveBoxIcon className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <Text className="text-zinc-500 mb-4">该冰箱暂无样本盒</Text>
                  <Button onClick={() => {
                    setBoxForm({ code: '', freezer_id: selectedFreezer.id, shelf_level: '', rack_position: '', rows: 10, cols: 10 });
                    setIsAddBoxOpen(true);
                  }}>
                    <PlusIcon className="w-4 h-4" />
                    添加第一个样本盒
                  </Button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <AnimatePresence>
                    {filteredBoxes.map((box) => (
                      <BoxCard 
                        key={box.id} 
                        box={box} 
                        onClick={() => handleBoxSelect(box)}
                        onEdit={() => openEditDialog(box)}
                        onDelete={() => openDeleteDialog(box)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <Table striped>
                  <TableHead>
                    <TableRow>
                      <TableHeader>样本盒编号</TableHeader>
                      <TableHeader>位置</TableHeader>
                      <TableHeader>规格</TableHeader>
                      <TableHeader>使用情况</TableHeader>
                      <TableHeader>创建时间</TableHeader>
                      <TableHeader>操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredBoxes.map((box) => (
                      <TableRow key={box.id}>
                        <TableCell className="font-medium">{box.code}</TableCell>
                        <TableCell className="font-mono text-sm">{box.shelf_level}-{box.rack_position}</TableCell>
                        <TableCell>{box.rows} × {box.cols}</TableCell>
                        <TableCell>
                          <Badge color={box.used_slots === box.total_slots ? 'red' : box.used_slots > box.total_slots * 0.8 ? 'yellow' : 'green'}>
                            {box.used_slots} / {box.total_slots}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(box.created_at).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button plain onClick={() => handleBoxSelect(box)}>
                              <EyeIcon className="w-4 h-4" />
                            </Button>
                            <Button plain onClick={() => openEditDialog(box)}>
                              <PencilIcon className="w-4 h-4" />
                            </Button>
                            <Button plain onClick={() => openDeleteDialog(box)} className="text-red-600 hover:text-red-700">
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            // 冰箱视图
            <div className="p-6">
              {filteredFreezers.length === 0 ? (
                <div className="text-center py-12">
                  <CubeIcon className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <Text className="text-zinc-500">暂无冰箱数据</Text>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence>
                    {filteredFreezers.map((freezer) => (
                      <FreezerCard
                        key={freezer.id}
                        freezer={freezer}
                        onClick={() => handleFreezerSelect(freezer)}
                        isSelected={(selectedFreezer as any)?.id === freezer.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <Table striped>
                  <TableHead>
                    <TableRow>
                      <TableHeader>冰箱名称</TableHeader>
                      <TableHeader>位置</TableHeader>
                      <TableHeader>温度</TableHeader>
                      <TableHeader>层数</TableHeader>
                      <TableHeader>样本盒</TableHeader>
                      <TableHeader>使用率</TableHeader>
                      <TableHeader>操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFreezers.map((freezer) => (
                      <TableRow key={freezer.id}>
                        <TableCell className="font-medium">{freezer.name}</TableCell>
                        <TableCell>{freezer.location}</TableCell>
                        <TableCell>
                          <Badge color={freezer.temperature <= -70 ? 'blue' : freezer.temperature <= -20 ? 'cyan' : 'yellow'}>
                            {freezer.temperature}°C
                          </Badge>
                        </TableCell>
                        <TableCell>{freezer.shelves} 层</TableCell>
                        <TableCell>{freezer.used_boxes} / {freezer.total_boxes}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-zinc-100 rounded-full overflow-hidden">
                              <div 
                                className={clsx(
                                  'h-full rounded-full',
                                  freezer.used_boxes / freezer.total_boxes >= 0.9 ? 'bg-red-500' :
                                  freezer.used_boxes / freezer.total_boxes >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                                )}
                                style={{ width: `${(freezer.used_boxes / freezer.total_boxes) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm">{Math.round((freezer.used_boxes / freezer.total_boxes) * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button plain onClick={() => handleFreezerSelect(freezer)}>查看</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 样本盒详情对话框 */}
      <Dialog open={isBoxDetailOpen} onClose={() => setIsBoxDetailOpen(false)} size="4xl">
        <DialogTitle className="flex items-center justify-between">
          <span>{selectedBox ? `样本盒详情 - ${selectedBox.code}` : '样本盒详情'}</span>
          {/* 视图切换 */}
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
            <button
              className={clsx(
                'px-2 py-1 text-xs rounded transition-all flex items-center gap-1',
                boxDetailViewMode === 'grid' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
              )}
              onClick={() => setBoxDetailViewMode('grid')}
            >
              <Squares2X2Icon className="w-3 h-3" />
              网格
            </button>
            <button
              className={clsx(
                'px-2 py-1 text-xs rounded transition-all flex items-center gap-1',
                boxDetailViewMode === 'list' ? 'bg-white shadow text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'
              )}
              onClick={() => setBoxDetailViewMode('list')}
            >
              <ListBulletIcon className="w-3 h-3" />
              列表
            </button>
          </div>
        </DialogTitle>
        <DialogDescription>
          {selectedBox && (
            <div className="grid grid-cols-4 gap-4 mt-2">
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">冰箱</div>
                <div className="font-medium">{selectedBox.freezer_id}</div>
              </div>
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">位置</div>
                <div className="font-medium">{selectedBox.shelf_level}-{selectedBox.rack_position}</div>
              </div>
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">规格</div>
                <div className="font-medium">{selectedBox.rows} × {selectedBox.cols}</div>
              </div>
              <div className="text-center p-2 bg-zinc-50 rounded">
                <div className="text-xs text-zinc-500">使用</div>
                <div className="font-medium">{boxSamples.length} / {selectedBox.total_slots}</div>
              </div>
            </div>
          )}
        </DialogDescription>
        <DialogBody>
          {loadingBoxSamples ? (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <Text className="text-zinc-500">加载样本数据...</Text>
            </div>
          ) : selectedBox ? (
            boxDetailViewMode === 'grid' ? (
              <BoxGridView
                box={selectedBox}
                samples={boxSamples}
                onSampleClick={handleSampleClick}
                selectedSampleId={selectedSampleId}
                highlightedPosition={highlightedPosition}
                onPositionHover={setHighlightedPosition}
              />
            ) : (
              <BoxListView
                samples={boxSamples}
                onSampleClick={handleSampleClick}
                selectedSampleId={selectedSampleId}
              />
            )
          ) : null}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsBoxDetailOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 添加样本盒对话框 */}
      <Dialog open={isAddBoxOpen} onClose={() => setIsAddBoxOpen(false)}>
        <DialogTitle>添加样本盒</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">样本盒编号 *</label>
              <Input
                value={boxForm.code}
                onChange={(e) => setBoxForm({ ...boxForm, code: e.target.value })}
                placeholder="如：BOX-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">层号 *</label>
                <Input
                  value={boxForm.shelf_level}
                  onChange={(e) => setBoxForm({ ...boxForm, shelf_level: e.target.value })}
                  placeholder="如：L1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">架位 *</label>
                <Input
                  value={boxForm.rack_position}
                  onChange={(e) => setBoxForm({ ...boxForm, rack_position: e.target.value })}
                  placeholder="如：R1-P1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">行数</label>
                <Input
                  type="number"
                  value={boxForm.rows}
                  onChange={(e) => setBoxForm({ ...boxForm, rows: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={26}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">列数</label>
                <Input
                  type="number"
                  value={boxForm.cols}
                  onChange={(e) => setBoxForm({ ...boxForm, cols: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={99}
                />
              </div>
            </div>
            <div className="p-3 bg-zinc-50 rounded-lg">
              <Text className="text-sm text-zinc-600">
                总容量: <span className="font-medium">{boxForm.rows * boxForm.cols}</span> 个位置
              </Text>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsAddBoxOpen(false)}>取消</Button>
          <Button 
            onClick={handleAddBox}
            disabled={!boxForm.code || !boxForm.shelf_level || !boxForm.rack_position}
          >
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* 编辑样本盒对话框 */}
      <Dialog open={isEditBoxOpen} onClose={() => setIsEditBoxOpen(false)}>
        <DialogTitle>编辑样本盒</DialogTitle>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">样本盒编号 *</label>
              <Input
                value={boxForm.code}
                onChange={(e) => setBoxForm({ ...boxForm, code: e.target.value })}
                placeholder="如：BOX-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">层号 *</label>
                <Input
                  value={boxForm.shelf_level}
                  onChange={(e) => setBoxForm({ ...boxForm, shelf_level: e.target.value })}
                  placeholder="如：L1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">架位 *</label>
                <Input
                  value={boxForm.rack_position}
                  onChange={(e) => setBoxForm({ ...boxForm, rack_position: e.target.value })}
                  placeholder="如：R1-P1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">行数</label>
                <Input
                  type="number"
                  value={boxForm.rows}
                  disabled
                  className="bg-zinc-100"
                />
                <p className="text-xs text-zinc-500 mt-1">规格不可修改</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">列数</label>
                <Input
                  type="number"
                  value={boxForm.cols}
                  disabled
                  className="bg-zinc-100"
                />
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsEditBoxOpen(false)}>取消</Button>
          <Button 
            onClick={handleEditBox}
            disabled={!boxForm.code || !boxForm.shelf_level || !boxForm.rack_position}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogBody>
          <Text>
            确定要删除样本盒 <span className="font-semibold">{boxToDelete?.code}</span> 吗？
          </Text>
          {boxToDelete && boxToDelete.used_slots > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Text className="text-amber-800 text-sm">
                ⚠️ 该样本盒中有 {boxToDelete.used_slots} 个样本，删除后样本将失去位置信息。
              </Text>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsDeleteConfirmOpen(false)}>取消</Button>
          <Button color="red" onClick={handleDeleteBox}>
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 样本详情对话框 */}
      <Dialog open={isSampleDetailOpen} onClose={() => setIsSampleDetailOpen(false)}>
        <DialogTitle>样本详情</DialogTitle>
        <DialogBody>
          {selectedSample && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 mb-1">样本编号</div>
                  <div className="font-mono font-medium">{selectedSample.sample_code}</div>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 mb-1">盒内位置</div>
                  <div className="font-medium">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                      {selectedSample.position_in_box}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 mb-1">项目编号</div>
                  <div className="font-medium">{selectedSample.project_code || '-'}</div>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 mb-1">检测类型</div>
                  <div className="font-medium">{selectedSample.test_type || '-'}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 mb-1">受试者编号</div>
                  <div className="font-medium">{selectedSample.subject_code || '-'}</div>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <div className="text-xs text-zinc-500 mb-1">状态</div>
                  <div>
                    <Badge color={
                      selectedSample.status === 'in_storage' ? 'green' :
                      selectedSample.status === 'checked_out' ? 'yellow' :
                      selectedSample.status === 'transferred' ? 'purple' :
                      selectedSample.status === 'destroyed' ? 'red' : 'zinc'
                    }>
                      {STATUS_COLORS[selectedSample.status]?.label || selectedSample.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsSampleDetailOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
