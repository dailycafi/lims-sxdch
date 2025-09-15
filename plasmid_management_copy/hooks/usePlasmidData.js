import { useState, useEffect } from 'react';
import { generateMockPlasmids } from '../mock/mockPlasmids';
import {
    fetchAllPlasmids,
    createPlasmid,
    updatePlasmid as updatePlasmidApi,
    deletePlasmid as deletePlasmidApi
} from '@/app/api/bioResources';

export const usePlasmidData = (messageApi) => {
    const [plasmids, setPlasmids] = useState([]);
    const [filteredPlasmids, setFilteredPlasmids] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [useMockData, setUseMockData] = useState(false);

    // 超时控制函数
    const timeoutPromise = (promise, timeout = 8000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('请求超时，已切换到演示数据')), timeout)
            )
        ]);
    };

    // 加载质粒数据
    const loadPlasmids = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchAllPlasmids();
            setPlasmids(data);
            setFilteredPlasmids(data);
            setUseMockData(false);
        } catch (err) {
            console.error('加载质粒数据失败:', err);
            const mockData = generateMockPlasmids();
            setPlasmids(mockData);
            setFilteredPlasmids(mockData);
            setUseMockData(true);
            setError(`${err.message || '加载质粒数据失败，请稍后重试'}。已显示演示数据。`);
            messageApi?.warning('已切换到演示数据模式');
        } finally {
            setIsLoading(false);
        }
    };

    // 搜索和筛选
    const handleSearch = (searchText) => {
        if (!searchText) {
            setFilteredPlasmids(plasmids);
            return;
        }

        const filtered = plasmids.filter(plasmid =>
            String(plasmid.id)?.toLowerCase().includes(searchText.toLowerCase()) ||
            String(plasmid.name)?.toLowerCase().includes(searchText.toLowerCase()) ||
            String(plasmid.vector)?.toLowerCase().includes(searchText.toLowerCase()) ||
            String(plasmid.target)?.toLowerCase().includes(searchText.toLowerCase())
        );
        setFilteredPlasmids(filtered);
    };

    // 应用筛选条件
    const applyFilters = (filters, searchText) => {
        let filtered = [...plasmids];

        // 先应用搜索
        if (searchText) {
            filtered = filtered.filter(plasmid =>
                String(plasmid.id)?.toLowerCase().includes(searchText.toLowerCase()) ||
                String(plasmid.name)?.toLowerCase().includes(searchText.toLowerCase()) ||
                String(plasmid.vector)?.toLowerCase().includes(searchText.toLowerCase()) ||
                String(plasmid.target)?.toLowerCase().includes(searchText.toLowerCase())
            );
        }

        // 再应用其他筛选条件
        Object.entries(filters).forEach(([field, values]) => {
            if (values && values.length > 0) {
                filtered = filtered.filter(plasmid =>
                    values.includes(String(plasmid[field]))
                );
            }
        });

        setFilteredPlasmids(filtered);
    };

    // 添加质粒
    const addPlasmid = async (newPlasmidData) => {
        try {
            let newPlasmid;
            if (!useMockData) {
                newPlasmid = await createPlasmid(newPlasmidData);
            } else {
                newPlasmid = {
                    ...newPlasmidData,
                    id: `P${(plasmids.length + 1).toString().padStart(7, '0')}`,
                    created_at: new Date().toISOString(),
                    created_by: 1
                };
            }
            const updatedPlasmids = [...plasmids, newPlasmid];
            setPlasmids(updatedPlasmids);
            setFilteredPlasmids(updatedPlasmids);
            messageApi?.success('质粒添加成功');
            return newPlasmid;
        } catch (err) {
            messageApi?.error('质粒添加失败');
            throw err;
        }
    };

    // 更新质粒
    const updatePlasmid = async (id, data) => {
        try {
            console.log('【调试-Hook】准备更新质粒:', {
                id,
                box_id: data.box_id,
                position: data.position
            });

            const response = await updatePlasmidApi(id, data);
            console.log('【调试-Hook】API响应:', response);

            const updatedPlasmids = plasmids.map(p => {
                if (p.id === id) {
                    return {
                        ...p,
                        ...response,
                        box: response.box,
                        box_id: response.box_id,
                        position: response.position
                    };
                }
                return p;
            });

            console.log('【调试-Hook】更新后的质粒列表:', updatedPlasmids);
            setPlasmids(updatedPlasmids);
            setFilteredPlasmids(updatedPlasmids);
            return response;
        } catch (error) {
            console.error('更新质粒失败:', error);
            throw error;
        }
    };

    // 删除质粒
    const deletePlasmid = async (plasmidId) => {
        try {
            if (!useMockData) {
                await deletePlasmidApi(plasmidId);
            }
            const updatedPlasmids = plasmids.filter(p => p.id !== plasmidId);
            setPlasmids(updatedPlasmids);
            setFilteredPlasmids(updatedPlasmids);
            messageApi?.success('质粒删除成功');
        } catch (err) {
            messageApi?.error('质粒删除失败');
            throw err;
        }
    };

    useEffect(() => {
        loadPlasmids();
    }, []);

    return {
        plasmids,
        filteredPlasmids,
        isLoading,
        error,
        useMockData,
        handleSearch,
        applyFilters,
        addPlasmid,
        updatePlasmid,
        deletePlasmid,
        loadPlasmids
    };
};
