import { motion } from 'framer-motion';
import { AntdTable } from 'antd';
import { createPlasmidTableColumns } from '../utils/plasmidTableColumns';

export const PlasmidBoxList = ({
    plasmids,
    selectedPlasmidId,
    highlightedPosition,
    onPlasmidSelect,
    onPositionHover,
    onEditClick,
    onDeleteClick,
    currentPage,
    pageSize,
    onPageChange
}) => {
    const columns = createPlasmidTableColumns(onEditClick, onDeleteClick);

    return (
        <AntdTable
            columns={columns}
            dataSource={plasmids}
            rowKey="id"
            rowClassName={(record) => {
                const isSelected = record.id === selectedPlasmidId;
                const isHighlighted = highlightedPosition === record.position;
                return `${isSelected ? 'bg-yellow-200' : isHighlighted ? 'bg-yellow-50' : ''}`;
            }}
            onRow={(record) => ({
                onClick: () => onPlasmidSelect(record.id),
                onMouseEnter: () => {
                    if (!selectedPlasmidId) {
                        onPositionHover(record.position);
                    }
                },
                onMouseLeave: () => {
                    if (!selectedPlasmidId) {
                        onPositionHover(null);
                    }
                },
                className: `plasmid-${record.id}`
            })}
            pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: plasmids.length,
                onChange: onPageChange,
                showSizeChanger: false,
                showTotal: (total) => `共 ${total} 条记录`
            }}
            size="middle"
        />
    );
};
