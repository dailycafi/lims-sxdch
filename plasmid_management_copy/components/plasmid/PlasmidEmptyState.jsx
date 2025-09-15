import { motion } from 'framer-motion';
import { Button } from '@/app/components/catalyst/button';
import { FiPlus } from 'react-icons/fi';
import { InboxOutlined } from '@ant-design/icons';

export const PlasmidEmptyState = ({ type, message, icon: Icon = InboxOutlined, onAdd }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-10 bg-white rounded-lg shadow"
        >
            <div className="w-16 h-16 mb-4 text-gray-300 flex items-center justify-center bg-gray-50 rounded-full">
                <Icon className="text-3xl" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">暂无{type || '数据'}</h3>
            <p className="text-gray-500 text-center max-w-md mb-6">{message}</p>
            {onAdd && (
                <Button onClick={onAdd} className="flex items-center gap-2">
                    <FiPlus className="text-lg" />
                    添加第一个{type}
                </Button>
            )}
        </motion.div>
    );
};
