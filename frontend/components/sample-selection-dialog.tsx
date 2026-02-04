import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/dialog';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Text } from '@/components/text';
import { Checkbox, CheckboxField } from '@/components/checkbox';
import { MagnifyingGlassIcon, CheckCircleIcon } from '@heroicons/react/20/solid';
import { api } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface PendingSample {
  id: number;
  sample_code: string;
  barcode: string | null;
  subject_code: string | null;
  test_type: string | null;
  collection_time: string | null;
  cycle_group: string | null;
  is_primary: boolean;
}

interface SampleSelectionDialogProps {
  open: boolean;
  onClose: (open: boolean) => void;
  projectId: number | null;
  sampleCodesFromList?: string[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

export function SampleSelectionDialog({
  open,
  onClose,
  projectId,
  sampleCodesFromList = [],
  selectedIds,
  onSelectionChange
}: SampleSelectionDialogProps) {
  const [samples, setSamples] = useState<PendingSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<number>>(new Set(selectedIds));

  const fetchSamples = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const response = await api.get('/samples/receive/pending-samples', {
        params: {
          project_id: projectId,
          search: search || undefined,
          limit: 500
        }
      });

      setSamples(response.data.samples);
      setTotal(response.data.total);
    } catch (error: any) {
      if (error?.response?.status !== 401) {
        toast.error('加载样本列表失败');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, search]);

  useEffect(() => {
    if (open && projectId) {
      fetchSamples();
    }
  }, [open, projectId, fetchSamples]);

  useEffect(() => {
    if (open) {
      setLocalSelectedIds(new Set(selectedIds));
    }
  }, [open, selectedIds]);

  useEffect(() => {
    if (open && sampleCodesFromList.length > 0 && samples.length > 0) {
      const codesSet = new Set(sampleCodesFromList.map(c => c.toLowerCase()));
      const matchedIds = samples
        .filter(s => codesSet.has(s.sample_code.toLowerCase()))
        .map(s => s.id);

      if (matchedIds.length > 0) {
        setLocalSelectedIds(prev => {
          const updated = new Set(prev);
          matchedIds.forEach(id => updated.add(id));
          return updated;
        });
        toast.success(`已自动匹配 ${matchedIds.length} 个样本`);
      }
    }
  }, [open, sampleCodesFromList, samples]);

  const handleToggle = useCallback((id: number) => {
    setLocalSelectedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = samples.map(s => s.id);
    setLocalSelectedIds(new Set(allIds));
  }, [samples]);

  const handleDeselectAll = useCallback(() => {
    setLocalSelectedIds(new Set());
  }, []);

  const handleConfirm = useCallback(() => {
    onSelectionChange(Array.from(localSelectedIds));
    onClose(false);
  }, [localSelectedIds, onSelectionChange, onClose]);

  const handleCancel = useCallback(() => {
    setLocalSelectedIds(new Set(selectedIds));
    onClose(false);
  }, [selectedIds, onClose]);

  const filteredSamples = useMemo(() => {
    if (!search) return samples;
    const term = search.toLowerCase();
    return samples.filter(s =>
      s.sample_code.toLowerCase().includes(term) ||
      s.subject_code?.toLowerCase().includes(term) ||
      s.barcode?.toLowerCase().includes(term)
    );
  }, [samples, search]);

  const allSelected = filteredSamples.length > 0 && filteredSamples.every(s => localSelectedIds.has(s.id));
  const someSelected = filteredSamples.some(s => localSelectedIds.has(s.id));

  return (
    <Dialog open={open} onClose={handleCancel} size="4xl">
      <DialogTitle>选择样本</DialogTitle>

      <DialogBody>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索样本编号、受试者编号或条形码..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button plain onClick={handleSelectAll} disabled={loading}>
                全选
              </Button>
              <Button plain onClick={handleDeselectAll} disabled={loading}>
                取消全选
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Text className="text-zinc-600">
              共 {total} 个待接收样本{search && `，显示 ${filteredSamples.length} 个`}
            </Text>
            <div className="flex items-center gap-1 text-blue-600">
              <CheckCircleIcon className="w-4 h-4" />
              <Text>已选择 {localSelectedIds.size} 个</Text>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <Text className="text-zinc-500">加载中...</Text>
              </div>
            ) : filteredSamples.length === 0 ? (
              <div className="p-8 text-center">
                <Text className="text-zinc-500">
                  {search ? '未找到匹配的样本' : '暂无待接收样本'}
                </Text>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50 sticky top-0">
                  <tr>
                    <th className="w-12 px-4 py-3 text-left">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={!allSelected && someSelected}
                        onChange={() => allSelected ? handleDeselectAll() : handleSelectAll()}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">样本编号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">受试者</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">周期/组别</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">检测类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">采血时间</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">类型</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-zinc-200">
                  {filteredSamples.map((sample) => (
                    <tr
                      key={sample.id}
                      onClick={() => handleToggle(sample.id)}
                      className={`cursor-pointer transition-colors ${
                        localSelectedIds.has(sample.id)
                          ? 'bg-blue-50 hover:bg-blue-100'
                          : 'hover:bg-zinc-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={localSelectedIds.has(sample.id)}
                          onChange={() => handleToggle(sample.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-zinc-900">{sample.sample_code}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{sample.subject_code || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{sample.cycle_group || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{sample.test_type || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{sample.collection_time || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {sample.is_primary ? '正份' : '备份'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogBody>

      <DialogActions>
        <Button plain onClick={handleCancel}>
          取消
        </Button>
        <Button onClick={handleConfirm}>
          确认选择 ({localSelectedIds.size})
        </Button>
      </DialogActions>
    </Dialog>
  );
}
