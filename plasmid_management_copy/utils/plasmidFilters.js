import { PLASMID_FIELDS } from '../constants/plasmidFields';

export const filterPlasmidsByText = (plasmids, searchText) => {
    if (!searchText) return plasmids;
    const lowerSearchText = searchText.toLowerCase();

    return plasmids.filter(plasmid =>
        plasmid[PLASMID_FIELDS.ID].toLowerCase().includes(lowerSearchText) ||
        plasmid[PLASMID_FIELDS.NAME].toLowerCase().includes(lowerSearchText) ||
        plasmid[PLASMID_FIELDS.VECTOR].toLowerCase().includes(lowerSearchText) ||
        (plasmid[PLASMID_FIELDS.TARGET] &&
            plasmid[PLASMID_FIELDS.TARGET].toLowerCase().includes(lowerSearchText))
    );
};

export const getUniqueFieldValues = (plasmids, field) => {
    return [...new Set(plasmids.map(item => item[field]).filter(Boolean))];
};

export const applyFilters = (plasmids, filters, searchText) => {
    let filtered = plasmids;

    // 应用文本搜索
    if (searchText) {
        filtered = filterPlasmidsByText(filtered, searchText);
    }

    // 应用筛选条件
    Object.entries(filters).forEach(([field, values]) => {
        if (values && values.length > 0) {
            filtered = filtered.filter(plasmid =>
                values.includes(plasmid[field])
            );
        }
    });

    return filtered;
};
