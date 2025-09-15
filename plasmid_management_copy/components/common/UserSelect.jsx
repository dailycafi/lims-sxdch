import React, { useState, useEffect } from 'react';
import { Select, Spin } from 'antd';
import { fetchUserSelectOptions } from '@/app/api/userApi';

const UserSelect = ({ value, onChange, placeholder = "请选择负责人", style = {}, ...props }) => {
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const userData = await fetchUserSelectOptions();
                const userOptions = userData.map(user => ({
                    label: `${user.name} (${user.username})`,
                    value: String(user.id) // 确保 value 是字符串类型
                }));
                setOptions(userOptions);
            } catch (error) {
                console.error('获取用户列表失败', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []); // 只在组件挂载时加载用户列表

    // 规范化 value，确保类型一致
    const normalizedValue = value ? String(value) : undefined;

    return (
        <Select
            showSearch
            placeholder={placeholder}
            optionFilterProp="label"
            value={normalizedValue}
            onChange={onChange}
            style={{ width: '100%', ...style }}
            filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            notFoundContent={loading ? <Spin size="small" /> : null}
            options={options}
            allowClear
            {...props}
        />
    );
};

export default UserSelect;