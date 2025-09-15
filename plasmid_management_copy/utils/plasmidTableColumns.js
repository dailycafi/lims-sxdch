import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Tag } from 'antd';
import { PLASMID_STATUS_LABELS, PLASMID_STATUS_COLORS } from '../constants/plasmidStatus';

export const createPlasmidTableColumns = (handleEditClick, handleDeleteClick) => [
    {
        title: '编号',
        dataIndex: 'id',
        key: 'id',
        sorter: (a, b) => a.id.localeCompare(b.id),
        fixed: 'left',
        width: 120,
    },
    {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name),
        width: 180,
    },
    {
        title: '盒子编号',
        dataIndex: 'box_id',
        key: 'box_id',
        width: 100,
    },
    {
        title: '位置坐标',
        dataIndex: 'position',
        key: 'position',
        width: 100,
    },
    {
        title: '载体类型',
        dataIndex: 'vector',
        key: 'vector',
        width: 120,
        filters: true,
    },
    {
        title: '目标基因',
        dataIndex: 'target',
        key: 'target',
        width: 120,
    },
    {
        title: '标签蛋白',
        dataIndex: 'tagged_protein',
        key: 'tagged_protein',
        width: 100,
    },
    {
        title: '酶切位点',
        dataIndex: 'enzyme_sites',
        key: 'enzyme_sites',
        width: 120,
    },
    {
        title: '来源',
        dataIndex: 'source',
        key: 'source',
        width: 100,
        filters: true,
    },
    {
        title: '浓度',
        dataIndex: 'concentration',
        key: 'concentration',
        width: 100,
    },
    {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        render: status => (
            <Tag color={PLASMID_STATUS_COLORS[status]}>
                {PLASMID_STATUS_LABELS[status]}
            </Tag>
        ),
        filters: Object.entries(PLASMID_STATUS_LABELS).map(([value, label]) => ({
            text: label,
            value: value
        })),
    },
    {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 120,
        render: (date) => new Date(date).toLocaleDateString('zh-CN'),
        sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 100,
        render: (_, record) => (
            <div className="flex space-x-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(record);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="编辑"
                >
                    <FiEdit2 className="h-4 w-4" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(record);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="删除"
                >
                    <FiTrash2 className="h-4 w-4" />
                </button>
            </div>
        )
    }
];
