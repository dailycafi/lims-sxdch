import { motion } from 'framer-motion';
import { Tag, Tooltip, Typography, Popover } from 'antd';
import {
    getPlasmidStatusLabel,
    PLASMID_STATUS_LABELS
} from '@/app/dashboard/bio-resources/plasmids/constants/plasmidStatus';
import { useEffect, useState } from 'react';
import { useWindowSize } from '@/app/dashboard/bio-resources/plasmids/hooks/useWindowSize';

const { Text } = Typography;

// 定义不同显示模式的断点
const DISPLAY_MODES = {
    FULL: 'full',        // 完整显示（名称、位置、标签等所有信息）
    MEDIUM: 'medium',    // 中等详细度（名称和位置）
    MINIMAL: 'minimal'   // 最小显示（只有位置）
};

export const PlasmidBoxGrid = ({
    currentBox,
    plasmids,
    selectedPlasmidId,
    highlightedPosition,
    onPlasmidSelect,
    onPositionHover,
}) => {
    if (!currentBox) return null;

    const { width } = useWindowSize();
    const [displayMode, setDisplayMode] = useState(DISPLAY_MODES.FULL);

    // 根据窗口宽度和盒子尺寸动态计算显示模式
    useEffect(() => {
        if (!width || !currentBox) return;

        const { columns = 12 } = currentBox;
        // 计算每个单元格的大致宽度
        const cellWidth = width / columns;

        if (cellWidth >= 100) {
            setDisplayMode(DISPLAY_MODES.FULL);
        } else if (cellWidth >= 60) {
            setDisplayMode(DISPLAY_MODES.MEDIUM);
        } else {
            setDisplayMode(DISPLAY_MODES.MINIMAL);
        }
    }, [width, currentBox]);

    const { rows = 8, columns = 12 } = currentBox;
    const boxPlasmids = plasmids.filter(p => p.box_id === currentBox.id);

    const getStatusBackgroundColor = (status) => {
        switch (status) {
            case 'normal':
                return 'bg-green-50'; // 绿色背景，正常
            case 'to_be_verified':
                return 'bg-yellow-50'; // 黄色背景，待验证
            case 'depleted':
                return 'bg-red-50'; // 红色背景，已用完
            default:
                return 'bg-white';
        }
    };

    useEffect(() => {
        if (boxPlasmids.length > 0) {
            console.log('质粒状态样本:', boxPlasmids.map(p => p.status));
        }
    }, [boxPlasmids]);

    // 渲染详细信息的内容
    const renderPlasmidDetailContent = (plasmid) => (
        <div className="w-64 space-y-2">
            <div>
                <Text strong>质粒名称:</Text> {plasmid.name}
            </div>
            <div>
                <Text strong>ID:</Text> {plasmid.id}
            </div>
            <div>
                <Text strong>载体类型:</Text> {plasmid.vector}
            </div>
            <div>
                <Text strong>目标基因:</Text> {plasmid.target || '-'}
            </div>
            {plasmid.tagged_protein && (
                <div>
                    <Text strong>标签蛋白:</Text> {plasmid.tagged_protein}
                </div>
            )}
            {plasmid.enzyme_sites && (
                <div>
                    <Text strong>酶切位点:</Text> {plasmid.enzyme_sites}
                </div>
            )}
            {plasmid.source && (
                <div>
                    <Text strong>来源:</Text> {plasmid.source}
                </div>
            )}
            {plasmid.concentration && (
                <div>
                    <Text strong>浓度:</Text> {plasmid.concentration}
                </div>
            )}
            <div>
                <Text strong>位置:</Text> {plasmid.position}
            </div>
            <div>
                <Text strong>状态:</Text> <Tag color={getPlasmidStatusLabel(plasmid.status)}>
                    {PLASMID_STATUS_LABELS?.[plasmid.status] || plasmid.status}
                </Tag>
            </div>
            {plasmid.created_at && (
                <div>
                    <Text strong>创建时间:</Text> {new Date(plasmid.created_at).toLocaleDateString('zh-CN')}
                </div>
            )}
        </div>
    );

    // 根据显示模式渲染不同内容
    const renderPlasmidContent = (plasmid, position) => {
        if (!plasmid) {
            return (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                    {position}
                </div>
            );
        }

        // 所有模式都会显示的状态指示器（小圆点）
        const statusIndicator = (
            <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${plasmid.status === 'normal' ? 'bg-green-500' :
                plasmid.status === 'to_be_verified' ? 'bg-yellow-500' :
                    'bg-red-500'
                }`}></div>
        );

        // 最小模式，只显示位置
        if (displayMode === DISPLAY_MODES.MINIMAL) {
            return (
                <div className="h-full flex flex-col justify-between text-xs">
                    {statusIndicator}
                    <div className="flex items-center justify-center h-full">
                        <Tag className="m-0 px-1" color="blue">{position}</Tag>
                    </div>
                </div>
            );
        }

        // 中等模式，显示名称和位置
        if (displayMode === DISPLAY_MODES.MEDIUM) {
            return (
                <div className="h-full flex flex-col justify-between text-xs">
                    {statusIndicator}
                    <div className="font-medium truncate text-xs" title={plasmid.name}>
                        {plasmid.name}
                    </div>
                    <div className="flex items-center justify-center mt-1">
                        <Tag className="m-0 px-1" color="blue">{position}</Tag>
                    </div>
                </div>
            );
        }

        // 完整模式，显示所有信息
        return (
            <div className="h-full flex flex-col justify-between text-xs">
                {statusIndicator}
                <div className="font-medium truncate text-sm" title={plasmid.name}>
                    {plasmid.name}
                </div>
                <div className="text-gray-500 mt-1">
                    <div className="truncate font-medium" title={plasmid.target}>
                        {plasmid.target || '-'}
                    </div>
                    <div className="truncate text-xs text-gray-400" title={plasmid.vector}>
                        {plasmid.vector}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <Tag className="mr-0 px-1" color="blue">{position}</Tag>
                        <Tag color={getPlasmidStatusLabel(plasmid.status)} className="mr-0 px-1 text-[10px]">
                            {PLASMID_STATUS_LABELS?.[plasmid.status] || plasmid.status}
                        </Tag>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="mt-4">
            <div
                className="grid gap-1 p-4 bg-gray-50 border rounded-lg"
                style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                }}
            >
                {Array.from({ length: rows * columns }).map((_, index) => {
                    const row = String.fromCharCode(65 + Math.floor(index / columns));
                    const col = (index % columns) + 1;
                    const position = `${row}${col}`;
                    const plasmid = boxPlasmids.find(p => p.position === position);

                    if (plasmid) {
                        console.log('质粒状态:', plasmid.status, '背景色:', getStatusBackgroundColor(plasmid.status));
                    }

                    return (
                        <Popover
                            key={position}
                            content={plasmid ? renderPlasmidDetailContent(plasmid) : null}
                            title={plasmid ? `详细信息 - ${plasmid.name}` : null}
                            trigger="hover"
                            placement="right"
                            disabled={!plasmid}
                        >
                            <div
                                className={`
                                    aspect-square border rounded-md p-2 
                                    ${plasmid ? getStatusBackgroundColor(plasmid.status) : 'bg-gray-100'} 
                                    ${highlightedPosition === position ? 'ring-2 ring-blue-500' : ''}
                                    ${selectedPlasmidId === plasmid?.id ? 'bg-blue-50 border-blue-500' : ''}
                                    hover:shadow-md transition-shadow cursor-pointer
                                    relative
                                `}
                                onClick={() => plasmid && onPlasmidSelect(plasmid.id)}
                                onMouseEnter={() => onPositionHover(position)}
                                onMouseLeave={() => onPositionHover(null)}
                            >
                                {plasmid ? (
                                    <div className="h-full flex flex-col justify-between text-xs">
                                        {/* 状态指示器 - 右上角小圆点 */}
                                        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${plasmid.status === 'normal' ? 'bg-green-500' :
                                            plasmid.status === 'to_be_verified' ? 'bg-yellow-500' :
                                                'bg-red-500'
                                            }`}></div>

                                        {/* 简化后的内容：只显示名称和位置标签 */}
                                        <div className="font-medium truncate text-xs" title={plasmid.name}>
                                            {plasmid.name}
                                        </div>

                                        <div className="mt-auto">
                                            <Tag className="mr-0 px-1" color="blue">{position}</Tag>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                                        {position}
                                    </div>
                                )}
                            </div>
                        </Popover>
                    );
                })}
            </div>
        </div>
    );
};
