'use client'

import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button } from 'antd';
import { App } from 'antd';

// 验证规则
const validateBoxForm = (formData) => {
    const errors = {};

    // 验证名称
    if (!formData.name || formData.name.length > 100) {
        errors.name = '名称不能为空且不能超过100个字符';
    }

    // 验证行数
    if (!formData.rows || formData.rows < 1 || formData.rows > 26) {
        errors.rows = '行数必须在1-26之间';
    }

    // 验证列数
    if (!formData.columns || formData.columns < 1 || formData.columns > 99) {
        errors.columns = '列数必须在1-99之间';
    }

    // 验证位置
    if (formData.location && formData.location.length > 255) {
        errors.location = '存放位置不能超过255个字符';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

export const PlasmidBoxFormModal = ({
    isOpen,
    onClose,
    currentBox,
    boxesCount,
    onSubmit
}) => {
    const [form] = Form.useForm();  // 使用自己的form实例
    const isEditing = !!currentBox;
    const { message } = App.useApp();  // 这里已经获取了message实例

    const handleFinish = (values) => {
        console.log('Form values before submit:', values);
        onSubmit(values);
    };

    useEffect(() => {
        if (isOpen) {
            if (currentBox) {
                form.setFieldsValue({
                    name: currentBox.name,
                    location: currentBox.location,
                    rows: currentBox.rows,
                    columns: currentBox.columns
                });
                console.log('Setting form values:', currentBox);
            } else {
                form.resetFields();
            }
        }
    }, [isOpen, currentBox, form]);

    return (
        <Modal
            title={isEditing ? "编辑质粒盒" : "新建质粒盒"}
            open={isOpen}
            onCancel={onClose}
            footer={null}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={currentBox ? {
                    name: currentBox.name,
                    location: currentBox.location,
                    rows: currentBox.rows,
                    columns: currentBox.columns
                } : undefined}
                preserve={false}
            >
                <Form.Item
                    name="name"
                    label="质粒盒名称"
                    rules={[{ required: true, message: '请输入质粒盒名称' }]}
                >
                    <Input placeholder="请输入质粒盒名称" />
                </Form.Item>

                <Form.Item
                    name="location"
                    label="存放位置"
                >
                    <Input placeholder="请输入存放位置（如：-20℃冰箱A-1层）" />
                </Form.Item>

                <Form.Item
                    name="rows"
                    label="行数"
                    rules={[{ required: true, message: '请输入行数' }]}
                >
                    <InputNumber
                        min={1}
                        max={26}
                        placeholder="请输入行数"
                        style={{ width: '100%' }}
                        disabled={isEditing}
                        className={isEditing ? 'bg-gray-100' : ''}
                    />
                </Form.Item>

                <Form.Item
                    name="columns"
                    label="列数"
                    rules={[{ required: true, message: '请输入列数' }]}
                >
                    <InputNumber
                        min={1}
                        max={99}
                        placeholder="请输入列数"
                        style={{ width: '100%' }}
                        disabled={isEditing}
                        className={isEditing ? 'bg-gray-100' : ''}
                    />
                </Form.Item>

                <Form.Item className="mb-0 flex justify-end">
                    <Button onClick={onClose} className="mr-2">
                        取消
                    </Button>
                    <Button type="primary" onClick={() => form.submit()}>
                        {isEditing ? '保存' : '创建'}
                    </Button>
                </Form.Item>
            </Form>
        </Modal>
    );
};
