// 获取唯一字段值
export const getUniqueFieldValues = (plasmids, field) => {
    if (!Array.isArray(plasmids)) {
        return [];
    }

    // 处理嵌套字段，比如 application_data.vector
    const getValue = (item, field) => {
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            return item[parent]?.[child];
        }
        return item[field];
    };

    return [...new Set(plasmids
        .map(item => getValue(item, field))
        .filter(Boolean)
        .sort()
    )];
};

// 排序函数
export const sortPlasmids = (plasmids, field, order) => {
    return [...plasmids].sort((a, b) => {
        const aValue = a[field];
        const bValue = b[field];

        if (order === 'ascend') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });
};

// 分页函数
export const paginatePlasmids = (plasmids, page, pageSize) => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return plasmids.slice(startIndex, endIndex);
};

// 搜索函数
export const searchPlasmids = (plasmids, searchText) => {
    if (!searchText) return plasmids;

    const lowerSearchText = searchText.toLowerCase();
    return plasmids.filter(plasmid =>
        plasmid.id.toLowerCase().includes(lowerSearchText) ||
        plasmid.name.toLowerCase().includes(lowerSearchText) ||
        plasmid.vector.toLowerCase().includes(lowerSearchText) ||
        (plasmid.target && plasmid.target.toLowerCase().includes(lowerSearchText))
    );
};

// 格式化日期
export const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

// 计算盒子使用率
export const calculateBoxUsage = (box) => {
    const usage = (box.used / box.slots) * 100;
    return {
        percentage: usage,
        status: usage === 100 ? 'full' : usage > 80 ? 'warning' : 'normal'
    };
};
