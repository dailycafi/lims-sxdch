export const PLASMID_STATUS = {
    NORMAL: 'normal',
    TO_BE_VERIFIED: 'to_be_verified',
    DEPLETED: 'depleted'
};

export const PLASMID_STATUS_LABELS = {
    [PLASMID_STATUS.NORMAL]: '正常',
    [PLASMID_STATUS.TO_BE_VERIFIED]: '待验证',
    [PLASMID_STATUS.DEPLETED]: '已用完'
};

export const PLASMID_STATUS_COLORS = {
    [PLASMID_STATUS.NORMAL]: 'success',
    [PLASMID_STATUS.TO_BE_VERIFIED]: 'warning',
    [PLASMID_STATUS.DEPLETED]: 'error'
};

export const PLASMID_STATUS_OPTIONS = [
    { label: '正常', value: PLASMID_STATUS.NORMAL },
    { label: '待验证', value: PLASMID_STATUS.TO_BE_VERIFIED },
    { label: '已用完', value: PLASMID_STATUS.DEPLETED }
];

export const getPlasmidStatusLabel = (status) => {
    switch (status) {
        case PLASMID_STATUS.NORMAL:
            return 'success';
        case PLASMID_STATUS.TO_BE_VERIFIED:
            return 'warning';
        case PLASMID_STATUS.DEPLETED:
            return 'error';
        default:
            return 'default';
    }
};
