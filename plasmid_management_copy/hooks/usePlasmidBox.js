import { useState, useEffect } from 'react';
import { generateMockBoxes } from '../mock/mockPlasmidBoxes';
import {
    fetchPlasmidBoxes,
    createPlasmidBox,
    updatePlasmidBox as updatePlasmidBoxApi,
    deletePlasmidBox as deletePlasmidBoxApi,
    fetchPlasmidsInBox
} from '@/app/api/bioResources';

export const usePlasmidBox = (messageApi) => {
    const [boxes, setBoxes] = useState([]);
    const [currentBox, setCurrentBox] = useState(null);
    const [boxPlasmids, setBoxPlasmids] = useState({});
    const [isBoxViewMode, setIsBoxViewMode] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [boxListPage, setBoxListPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [useMockBoxData, setUseMockBoxData] = useState(false);

    // 超时控制函数
    const timeoutPromise = (promise, timeout = 8000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('请求超时，已切换到演示数据')), timeout)
            )
        ]);
    };

    // 加载质粒盒数据
    const loadBoxes = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('尝试加载质粒盒数据');
            const data = await timeoutPromise(fetchPlasmidBoxes());
            console.log('API返回的质粒盒数据:', data);
            setBoxes(data || []);
            setUseMockBoxData(false);
        } catch (err) {
            console.error('加载质粒盒数据失败:', err);
            setError(`${err.message || '加载质粒盒数据失败，请稍后重试'}`);
            messageApi?.error('加载质粒盒数据失败');
        } finally {
            setIsLoading(false);
        }
    };

    // 加载盒子内的质粒
    const loadBoxPlasmids = async (boxId) => {
        try {
            const plasmids = await fetchPlasmidsInBox(boxId);
            setBoxPlasmids(prev => ({
                ...prev,
                [boxId]: plasmids
            }));
            return plasmids;
        } catch (err) {
            console.error(`加载质粒盒 ${boxId} 的质粒失败:`, err);
            messageApi?.error(`加载质粒盒内容失败`);
            throw err;
        }
    };

    // 处理盒子点击
    const handleBoxClick = async (boxId) => {
        try {
            const selectedBox = boxes.find(box => box.id === boxId);
            if (selectedBox) {
                setCurrentBox(selectedBox);
                setIsBoxViewMode(true); // 切换到盒子视图模式
            }
        } catch (error) {
            messageApi.error('加载质粒盒详情失败');
            console.error('加载详情失败:', error);
        }
    };

    // 添加新盒子
    const addBox = async (newBoxData) => {
        try {
            let newBox;
            if (!useMockBoxData) {
                newBox = await createPlasmidBox(newBoxData);
            } else {
                newBox = {
                    ...newBoxData,
                    id: `BOX${(boxes.length + 1).toString().padStart(3, '0')}`,
                    created_at: new Date().toISOString(),
                    created_by: 1
                };
            }
            setBoxes([...boxes, newBox]);
            messageApi?.success('质粒盒添加成功');
            return newBox;
        } catch (err) {
            messageApi?.error('质粒盒添加失败');
            throw err;
        }
    };

    // 更新盒子
    const updateBox = async (boxId, updatedData) => {
        try {
            let updatedBox;
            if (!useMockBoxData) {
                // 需要计算当前盒子已使用的位置数量
                const used = updatedData.used !== undefined ?
                    updatedData.used :
                    boxPlasmids[boxId]?.length || 0;

                updatedBox = await updatePlasmidBoxApi(boxId, {
                    ...updatedData,
                    used
                });
            } else {
                updatedBox = {
                    ...boxes.find(b => b.id === boxId),
                    ...updatedData,
                    updated_at: new Date().toISOString()
                };
            }
            setBoxes(boxes.map(b => b.id === boxId ? updatedBox : b));
            if (currentBox && currentBox.id === boxId) {
                setCurrentBox(updatedBox);
            }
            messageApi?.success('质粒盒更新成功');
            return updatedBox;
        } catch (err) {
            messageApi?.error('质粒盒更新失败');
            throw err;
        }
    };

    // 删除盒子
    const deleteBox = async (boxId) => {
        try {
            if (!useMockBoxData) {
                await deletePlasmidBoxApi(boxId);
            }
            setBoxes(boxes.filter(b => b.id !== boxId));
            if (currentBox && currentBox.id === boxId) {
                setCurrentBox(null);
                setIsBoxViewMode(false);
            }
            // 清除盒子中的质粒数据
            setBoxPlasmids(prev => {
                const newBoxPlasmids = { ...prev };
                delete newBoxPlasmids[boxId];
                return newBoxPlasmids;
            });
            messageApi?.success('质粒盒删除成功');
        } catch (err) {
            messageApi?.error('质粒盒删除失败');
            throw err;
        }
    };

    useEffect(() => {
        loadBoxes();
    }, []);

    // 添加boxes变化的监听
    useEffect(() => {
        console.log('boxes状态更新:', boxes);
    }, [boxes]);

    console.log('当前boxes状态:', boxes);

    return {
        boxes,
        currentBox,
        boxPlasmids,
        isBoxViewMode,
        viewMode,
        boxListPage,
        isLoading,
        error,
        useMockBoxData,
        setCurrentBox,
        setIsBoxViewMode,
        setViewMode,
        setBoxListPage,
        handleBoxClick,
        addBox,
        updateBox,
        deleteBox,
        loadBoxes,
        loadBoxPlasmids
    };
};
