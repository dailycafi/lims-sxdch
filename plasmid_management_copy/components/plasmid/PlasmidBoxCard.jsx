import { motion } from 'framer-motion';
import { Tag } from 'antd';
import { Button } from '@/app/components/catalyst/button';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';

export const PlasmidBoxCard = ({
    box,
    onBoxClick,
    onEditClick,
    onDeleteClick,
    index,
    plasmids = []
}) => {
    console.log('PlasmidBoxCard render - box:', box); // 添加调试日志

    const totalSlots = (box.rows || 0) * (box.columns || 0);
    const usedSlots = plasmids.filter(p => p.box_id === box.id).length;

    return (
        <motion.div
            whileHover={{ y: -5, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300"
        >
            <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium">{box.name}</h3>
                    <Tag color={
                        usedSlots === 0 ? 'success' :
                            usedSlots === totalSlots ? 'error' :
                                usedSlots > totalSlots * 0.8 ? 'warning' : 'success'
                    }>
                        {usedSlots} / {totalSlots}
                    </Tag>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">ID:</span>
                        <span>{box.id}</span>
                    </div>
                    {box.location && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">位置:</span>
                            <span>{box.location}</span>
                        </div>
                    )}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${usedSlots === 0 ? 'bg-green-500' :
                                usedSlots === totalSlots ? 'bg-red-500' :
                                    usedSlots > totalSlots * 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                            style={{ width: `${(usedSlots / totalSlots) * 100}%` }}
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onBoxClick(box.id)}
                        className="text-xs"
                    >
                        查看详情
                    </Button>
                    <div className="flex space-x-1">
                        <button
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                            title="编辑盒子"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEditClick(box);
                            }}
                        >
                            <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                            title="删除盒子"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(box);
                            }}
                        >
                            <FiTrash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
