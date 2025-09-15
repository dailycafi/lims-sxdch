export const getPlasmidStatusLabel = (status) => {
    switch (status) {
        case '正常':
            return 'success';
        case '待验证':
            return 'warning';
        case '已用完':
            return 'error';
        default:
            return 'default';
    }
};

export const getPlasmidStatusColor = (status) => {
    switch (status) {
        case '正常':
            return '#52c41a'; // 绿色
        case '待验证':
            return '#faad14'; // 黄色
        case '已用完':
            return '#ff4d4f'; // 红色
        default:
            return '#d9d9d9'; // 灰色
    }
};

export const PLASMID_STATUS = {
    NORMAL: '正常',
    PENDING: '待验证',
    DEPLETED: '已用完'
};

export const PLASMID_STATUS_OPTIONS = [
    { label: '正常', value: PLASMID_STATUS.NORMAL },
    { label: '待验证', value: PLASMID_STATUS.PENDING },
    { label: '已用完', value: PLASMID_STATUS.DEPLETED }
];

export const PLASMID_STATUS_COLORS = {
    [PLASMID_STATUS.NORMAL]: 'success',
    [PLASMID_STATUS.PENDING]: 'warning',
    [PLASMID_STATUS.DEPLETED]: 'error'
};

export const PLASMID_STATUS_DESCRIPTIONS = {
    [PLASMID_STATUS.NORMAL]: '质粒状态正常，可以正常使用',
    [PLASMID_STATUS.PENDING]: '质粒需要验证后才能使用',
    [PLASMID_STATUS.DEPLETED]: '质粒已经用完，需要补充'
};

export const getPlasmidStatusInfo = (status) => {
    return {
        label: status,
        color: getPlasmidStatusColor(status),
        tagType: getPlasmidStatusLabel(status),
        description: PLASMID_STATUS_DESCRIPTIONS[status] || '未知状态'
    };
};

export const isValidPlasmidStatus = (status) => {
    return Object.values(PLASMID_STATUS).includes(status);
};

export const getDefaultPlasmidStatus = () => PLASMID_STATUS.NORMAL;

export const getPlasmidStatusStats = (plasmids) => {
    return plasmids.reduce((stats, plasmid) => {
        stats[plasmid.status] = (stats[plasmid.status] || 0) + 1;
        return stats;
    }, {});
};
