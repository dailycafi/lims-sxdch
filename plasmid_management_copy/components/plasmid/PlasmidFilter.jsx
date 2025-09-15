import React from 'react';
import { Input, Select, Button, App } from 'antd';

export const PlasmidFilter = ({
    searchText,
    onSearchChange,
    isFilterExpanded,
    onFilterExpandChange,
    activeFilters,
    onFilterChange,
    onClearFilters,
    getUniqueFieldValues,
    filteredCount,
    totalCount,
    plasmids = []
}) => {
    // 获取字段的唯一值并转换为选项格式
    const getFieldOptions = (field) => {
        const values = getUniqueFieldValues(plasmids, field);
        return values.map(value => ({
            label: value,
            value: value
        }));
    };

    return (
        <div className="bg-white rounded-lg shadow p-4 relative z-10">
            <div className="flex items-center justify-between mb-4">
                <div className="flex-1 max-w-md">
                    <Input.Search
                        placeholder="搜索质粒..."
                        value={searchText}
                        onChange={(e) => onSearchChange(e.target.value)}
                        allowClear
                        className="w-full"
                    />
                </div>
                <button
                    onClick={() => onFilterExpandChange(!isFilterExpanded)}
                    className={`inline-flex items-center px-3 py-2 border ${isFilterExpanded
                        ? 'border-blue-300 bg-blue-50 text-blue-600'
                        : 'border-gray-300 bg-white text-gray-700'
                        } rounded-md text-sm font-medium hover:bg-gray-50 transition-colors duration-200 ml-4`}
                >
                    <svg
                        className="-ml-0.5 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                            clipRule="evenodd"
                        />
                    </svg>
                    {isFilterExpanded ? '隐藏筛选' : '展开筛选'}
                </button>
            </div>

            {isFilterExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            载体类型
                        </label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="选择载体类型"
                            value={activeFilters.vector}
                            onChange={(values) => onFilterChange('vector', values)}
                            options={getFieldOptions('vector')}
                            optionFilterProp="label"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            目标基因
                        </label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="选择目标基因"
                            value={activeFilters.target}
                            onChange={(values) => onFilterChange('target', values)}
                            options={getFieldOptions('target')}
                            optionFilterProp="label"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            标签蛋白
                        </label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="选择标签蛋白"
                            value={activeFilters.tagged_protein}
                            onChange={(values) => onFilterChange('tagged_protein', values)}
                            options={getFieldOptions('tagged_protein')}
                            optionFilterProp="label"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            酶切位点
                        </label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="选择酶切位点"
                            value={activeFilters.enzyme_sites}
                            onChange={(values) => onFilterChange('enzyme_sites', values)}
                            options={getFieldOptions('enzyme_sites')}
                            optionFilterProp="label"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            来源
                        </label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="选择来源"
                            value={activeFilters.source}
                            onChange={(values) => onFilterChange('source', values)}
                            options={getFieldOptions('source')}
                            optionFilterProp="label"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            状态
                        </label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="选择状态"
                            value={activeFilters.status}
                            onChange={(values) => onFilterChange('status', values)}
                            options={getFieldOptions('status')}
                            optionFilterProp="label"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <div>
                    显示 {filteredCount} / {totalCount} 条记录
                </div>
                {Object.keys(activeFilters).length > 0 && (
                    <Button
                        type="link"
                        onClick={onClearFilters}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        清除所有筛选
                    </Button>
                )}
            </div>
        </div>
    );
};

const FilterSelect = ({ label, field, value, onChange, options }) => {
    return (
        <div>
            <label className="block text-xs font-medium mb-1">{label}</label>
            <Select
                mode="multiple"
                allowClear
                size="small"
                style={{ width: '100%' }}
                placeholder={`选择${label}`}
                value={value}
                onChange={onChange}
                options={options}
                maxTagCount={1}
            />
        </div>
    );
};
