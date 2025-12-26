import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Fieldset, Field, Label } from '@/components/fieldset';
import { Textarea } from '@/components/textarea';
import { api, extractDetailMessage } from '@/lib/api';

export default function NewFreezerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    temperature: -80,
    description: '',
    total_shelves: 4
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/storage/freezers', formData);
      toast.success('存储设备已添加');
      router.push('/storage');
    } catch (e: any) {
      toast.error(extractDetailMessage(e.response?.data) || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <Heading className="mb-6">添加存储设备</Heading>
        
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow border border-zinc-200">
          <Fieldset>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field>
                <Label>设备名称/编号</Label>
                <Input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="例如: F-80-01"
                />
              </Field>

              <Field>
                <Label>物理位置</Label>
                <Input 
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  placeholder="例如: Room 101"
                />
              </Field>

              <Field>
                <Label>设定温度 (°C)</Label>
                <Input 
                  type="number"
                  required
                  value={formData.temperature}
                  onChange={e => setFormData({...formData, temperature: Number(e.target.value)})}
                />
              </Field>

              <Field>
                <Label>层数 (自动创建层)</Label>
                <Input 
                  type="number"
                  min={0}
                  required
                  value={formData.total_shelves}
                  onChange={e => setFormData({...formData, total_shelves: Number(e.target.value)})}
                />
              </Field>

              <Field className="col-span-2">
                <Label>描述/备注</Label>
                <Textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </Field>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <Button plain type="button" onClick={() => router.back()}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </Fieldset>
        </form>
      </div>
    </AppLayout>
  );
}

