import { Table, Button, Space, Tag, App } from 'antd';
import { EditOutlined, DeleteOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { PLASMID_STATUS_OPTIONS, getPlasmidStatusLabel } from '@/app/dashboard/bio-resources/plasmids/constants/plasmidStatus';

export const PlasmidTable = (props) => {
    const {
        plasmids,
        currentPage,
        itemsPerPage,
        onPageChange,
        onBoxClick,
        onEditClick,
        onDeleteClick,
    } = props;

    const columns = [
        {
            title: '编号',
            dataIndex: 'id',
            key: 'id',
            width: 100,
            render: (id) => (
                <Tag color="blue">{id}</Tag>
            )
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            width: 200,
        },
        {
            title: '盒子信息',
            key: 'boxInfo',
            width: 200,
            render: (_, record) => {
                if (!record.box_id && !record.box) return '-';
                return (
                    <span>{record.box?.name} ({record.box_id})</span>
                );
            },
        },
        {
            title: '位置',
            dataIndex: 'position',
            key: 'position',
            width: 80,
            render: (position) => position || '-'
        },
        {
            title: '载体类型',
            dataIndex: 'vector',
            key: 'vector',
            width: 150,
        },
        {
            title: '目标基因',
            dataIndex: 'target',
            key: 'target',
            width: 150,
        },
        {
            title: '标签蛋白',
            dataIndex: 'tagged_protein',
            key: 'tagged_protein',
            width: 150,
        },
        {
            title: '酶切位点',
            dataIndex: 'enzyme_sites',
            key: 'enzyme_sites',
            width: 150,
        },
        {
            title: '来源',
            dataIndex: 'source',
            key: 'source',
            width: 150,
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
            render: (status) => (
                <Tag color={getPlasmidStatusLabel(status)}>
                    {PLASMID_STATUS_OPTIONS.find(opt => opt.value === status)?.label || status}
                </Tag>
            )
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => onEditClick(record)}
                    />
                    <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => onDeleteClick(record)}
                    />
                </Space>
            )
        }
    ];

    return (
        <App>
            <div className="overflow-hidden rounded-lg border border-gray-200">
                <Table
                    columns={columns}
                    dataSource={plasmids}
                    rowKey="id"
                    pagination={{
                        current: currentPage,
                        pageSize: itemsPerPage,
                        total: plasmids.length,
                        onChange: onPageChange,
                        showSizeChanger: false
                    }}
                    scroll={{ x: 1500 }}
                    size="middle"
                    bordered
                />
            </div>
        </App>
    );
};
