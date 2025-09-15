import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button as AntButton } from 'antd';
import { PLASMID_STATUS_OPTIONS } from '@/app/dashboard/bio-resources/plasmids/constants/plasmidStatus';
import { PlusOutlined } from '@ant-design/icons';
import { Button } from '@/app/components/catalyst/button';
import { App } from 'antd';
import UserSelect from '@/app/components/common/UserSelect';

// 验证规则
const validateForm = (formData) => {
    const errors = {};

    // 验证名称
    if (!formData.name || formData.name.length > 100) {
        errors.name = '名称不能为空且不能超过100个字符';
    }

    // 验证载体类型
    if (!formData.vector || formData.vector.length > 50) {
        errors.vector = '载体类型不能为空且不能超过50个字符';
    }

    // 验证目标基因
    if (formData.target && formData.target.length > 100) {
        errors.target = '目标基因不能超过100个字符';
    }

    // 验证标签蛋白
    if (formData.tagged_protein && formData.tagged_protein.length > 50) {
        errors.tagged_protein = '标签蛋白不能超过50个字符';
    }

    // 验证酶切位点
    if (formData.enzyme_sites && formData.enzyme_sites.length > 255) {
        errors.enzyme_sites = '酶切位点不能超过255个字符';
    }

    // 验证来源
    if (formData.source && formData.source.length > 50) {
        errors.source = '来源不能超过50个字符';
    }

    // 验证浓度
    if (formData.concentration && formData.concentration.length > 50) {
        errors.concentration = '浓度不能超过50个字符';
    }

    // 验证位置坐标
    if (formData.position) {
        if (formData.position.length > 10 || !/^[A-Z][0-9]+$/.test(formData.position)) {
            errors.position = '位置坐标格式必须为字母+数字，如A1，且不超过10个字符';
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

export const PlasmidFormModal = ({
    isOpen,
    onClose,
    currentPlasmid,
    plasmidsCount,
    onSubmit,
    boxes = [],
    onBoxCreate,
    plasmids = [],
}) => {
    const [form] = Form.useForm();
    const [selectedBox, setSelectedBox] = useState(null);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const { message } = App.useApp();

    React.useEffect(() => {
        if (isOpen && currentPlasmid) {
            console.log('【调试-初始值】当前质粒数据:', {
                currentPlasmid,
                boxId: currentPlasmid.box_id
            });

            form.setFieldsValue({
                ...currentPlasmid,
                boxId: currentPlasmid.box_id,
                position: currentPlasmid.position
            });
        } else if (isOpen) {
            form.resetFields();
        }
    }, [isOpen, currentPlasmid, form]);

    const handleBoxChange = (boxId) => {
        console.log('【调试-选择盒子】选中的盒子ID:', boxId);

        if (!boxId) {
            setSelectedBox(null);
            setSelectedPosition(null);
            form.setFields([
                {
                    name: 'boxId',
                    value: null
                },
                {
                    name: 'position',
                    value: null
                }
            ]);
            return;
        }

        const box = boxes.find(b => b.id === boxId);
        if (box) {
            setSelectedBox(box);
            form.setFields([
                {
                    name: 'boxId',
                    value: boxId
                }
            ]);
        }
    };

    React.useEffect(() => {
        if (isOpen) {
            const boxId = form.getFieldValue('boxId');
            if (boxId) {
                const box = boxes.find(b => b.id === boxId);
                setSelectedBox(box || null);
            } else {
                setSelectedBox(null);
            }
        } else {
            setSelectedBox(null);
            setSelectedPosition(null);
        }
    }, [isOpen, form, boxes]);

    const generatePositions = (box) => {
        if (!box) return [];
        const { rows = 8, columns = 12 } = box;
        const positions = [];
        for (let i = 0; i < rows; i++) {
            const row = String.fromCharCode(65 + i);
            for (let j = 1; j <= columns; j++) {
                positions.push(`${row}${j}`);
            }
        }
        return positions;
    };

    // 获取已占用的位置
    const getUsedPositions = (boxId) => {
        if (!boxId) return [];
        // 过滤出当前盒子中，不是当前编辑的质粒的已占用位置
        return plasmids
            .filter(p => p.box_id === boxId && (!currentPlasmid || p.id !== currentPlasmid.id))
            .map(p => p.position);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            console.log('【调试-表单提交】表单数据:', {
                boxId: values.boxId,
                position: values.position,
            });

            const formattedData = {
                ...values,
                box_id: values.boxId,
                position: values.position
            };
            delete formattedData.boxId;

            console.log('【调试-表单提交】发送到后端的数据:', formattedData);
            await onSubmit(formattedData);
            onClose();
            form.resetFields();
        } catch (error) {
            console.error('提交失败:', error);
        }
    };

    return (
        <Modal
            title={currentPlasmid ? "编辑质粒" : "新建质粒"}
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={480}
            maskClosable={false}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={currentPlasmid || { status: 'normal' }}
                className="space-y-3"
                preserve={false}
            >
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    <Form.Item
                        label="名称"
                        name="name"
                        rules={[
                            { required: true, message: '请输入质粒名称' },
                            { min: 1, max: 100, message: '名称长度必须在1-100个字符之间' }
                        ]}
                        className="mb-2"
                    >
                        <Input placeholder="请输入质粒名称（如：pET28a-GFP）" />
                    </Form.Item>

                    <Form.Item
                        label="载体"
                        name="vector"
                        rules={[
                            { required: true, message: '请输入载体' },
                            { min: 1, max: 50, message: '载体长度必须在1-50个字符之间' }
                        ]}
                        className="mb-2"
                    >
                        <Input placeholder="请输入载体（如：pET28a）" />
                    </Form.Item>

                    <Form.Item
                        label="状态"
                        name="status"
                        rules={[{ required: true, message: '请选择状态' }]}
                        className="mb-2"
                    >
                        <Select options={PLASMID_STATUS_OPTIONS} />
                    </Form.Item>

                    <Form.Item
                        label="目标基因"
                        name="target"
                        rules={[{ required: true, message: '请输入目标基因' }]}
                        className="mb-2"
                    >
                        <Input placeholder="请输入目标基因（如：GFP）" />
                    </Form.Item>

                    <Form.Item
                        label="标签蛋白"
                        name="tagged_protein"
                        className="mb-2"
                    >
                        <Input placeholder="请输入标签蛋白（如：His-tag）" />
                    </Form.Item>

                    <Form.Item
                        label="酶切位点"
                        name="enzyme_sites"
                        className="mb-2"
                    >
                        <Input placeholder="请输入酶切位点（如：BamHI/XhoI）" />
                    </Form.Item>

                    <Form.Item
                        label="来源"
                        name="source"
                        className="mb-2"
                    >
                        <Input placeholder="请输入来源（如：Addgene #12345）" />
                    </Form.Item>

                    <Form.Item
                        label="浓度"
                        name="concentration"
                        className="mb-2"
                    >
                        <Input placeholder="请输入浓度（如：100 ng/μL）" />
                    </Form.Item>

                    <Form.Item
                        label="质粒盒"
                        name="boxId"
                        rules={[{ required: false }]}
                    >
                        <div className="flex gap-2 items-center">
                            <Select
                                placeholder="选择质粒盒（可选）"
                                onChange={handleBoxChange}
                                style={{ flex: 1 }}
                                allowClear
                                optionLabelProp="label"
                            >
                                {Array.isArray(boxes) && boxes.map(box => (
                                    <Select.Option
                                        key={box.id}
                                        value={box.id}
                                        label={`${box.name} (${box.id})`}
                                    >
                                        <div>
                                            <div>{box.name} ({box.id})</div>
                                            <div className="text-xs text-gray-500">
                                                {box.location || '未设置位置'}
                                            </div>
                                        </div>
                                    </Select.Option>
                                ))}
                            </Select>
                            {onBoxCreate && (
                                <AntButton
                                    icon={<PlusOutlined />}
                                    onClick={onBoxCreate}
                                    title="创建新质粒盒"
                                />
                            )}
                        </div>
                    </Form.Item>

                    {selectedBox && (
                        <>
                            <div className="text-sm text-gray-500 mb-2">
                                <p>盒子信息：</p>
                                <p>位置：{selectedBox.location || '未设置'}</p>
                                <p>规格：{selectedBox.rows}行 × {selectedBox.columns}列</p>
                                <p>已使用：{plasmids.filter(p => p.box_id === selectedBox.id).length} / {selectedBox.rows * selectedBox.columns}</p>
                            </div>
                            <Form.Item
                                label="位置"
                                name="position"
                                rules={[{ required: true, message: '请选择位置' }]}
                            >
                                <Select placeholder="选择位置">
                                    {generatePositions(selectedBox).map(pos => {
                                        const usedPositions = getUsedPositions(selectedBox.id);
                                        const isDisabled = usedPositions.includes(pos);
                                        return (
                                            <Select.Option
                                                key={pos}
                                                value={pos}
                                                disabled={isDisabled}
                                            >
                                                {pos} {isDisabled ? '(已占用)' : ''}
                                            </Select.Option>
                                        );
                                    })}
                                </Select>
                            </Form.Item>
                        </>
                    )}

                    <Form.Item
                        label="负责人"
                        name="keeper"
                        className="mb-2"
                    >
                        <UserSelect placeholder="请选择负责人" />
                    </Form.Item>
                </div>

                <Form.Item className="mb-0 flex justify-end mt-4">
                    <Button onClick={onClose} className="mr-2">
                        取消
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleSubmit}
                        className="bg-gray-900 text-white hover:bg-gray-800"
                    >
                        确定
                    </Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
