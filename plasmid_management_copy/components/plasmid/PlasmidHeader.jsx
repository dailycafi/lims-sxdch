import { motion } from 'framer-motion';
import { Button } from '@/app/components/catalyst/button';
import { FiPlus } from 'react-icons/fi';

export const PlasmidHeader = ({
    onAddClick,
    useMockData,
    showAddButton = true
}) => {
    return (
        <div className="flex justify-between items-center">
            <div>
                <motion.h1
                    initial={{ y: -20 }}
                    animate={{ y: 0 }}
                    className="text-2xl font-semibold text-gray-900"
                >
                    质粒管理
                </motion.h1>
                {useMockData && (
                    <span className="text-amber-600 text-sm ml-2">
                        (演示模式: API未连接，显示模拟数据)
                    </span>
                )}
            </div>
            {showAddButton && (
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <Button
                        onClick={onAddClick}
                        className="flex items-center gap-2"
                    >
                        <FiPlus className="text-lg" />
                        添加质粒
                    </Button>
                </motion.div>
            )}
        </div>
    );
};
