export const PLASMID_FIELDS = {
    ID: 'id',
    NAME: 'name',
    BOX_ID: 'box_id',
    POSITION: 'position',
    VECTOR: 'vector',
    TARGET: 'target',
    TAGGED_PROTEIN: 'tagged_protein',
    ENZYME_SITES: 'enzyme_sites',
    SOURCE: 'source',
    CONCENTRATION: 'concentration',
    STATUS: 'status',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at',
    CREATED_BY: 'created_by'
};

export const PLASMID_FIELD_LABELS = {
    [PLASMID_FIELDS.ID]: '编号',
    [PLASMID_FIELDS.NAME]: '名称',
    [PLASMID_FIELDS.BOX_ID]: '盒子编号',
    [PLASMID_FIELDS.POSITION]: '位置坐标',
    [PLASMID_FIELDS.VECTOR]: '载体类型',
    [PLASMID_FIELDS.TARGET]: '目标基因',
    [PLASMID_FIELDS.TAGGED_PROTEIN]: '标签蛋白',
    [PLASMID_FIELDS.ENZYME_SITES]: '酶切位点',
    [PLASMID_FIELDS.SOURCE]: '来源',
    [PLASMID_FIELDS.CONCENTRATION]: '浓度',
    [PLASMID_FIELDS.STATUS]: '状态',
    [PLASMID_FIELDS.CREATED_AT]: '创建时间',
    [PLASMID_FIELDS.UPDATED_AT]: '更新时间',
    [PLASMID_FIELDS.CREATED_BY]: '创建者'
};

export const REQUIRED_FIELDS = [
    PLASMID_FIELDS.NAME,
    PLASMID_FIELDS.VECTOR,
    PLASMID_FIELDS.STATUS
];
