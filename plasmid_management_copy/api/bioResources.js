// app/api/bioResources.js

import apiClient from './axiosClient';

// ===== 通用资源类型API =====

/**
 * 获取资源类型列表
 * @param {Object} params - 请求参数
 * @param {string} [params.category] - 资源分类名称，可选
 * @returns {Promise<Array>} 资源类型列表
 */
export const fetchResourceTypes = async (params = {}) => {
    try {
        const { category } = params;
        const queryParams = new URLSearchParams(
            category ? { category } : {}
        );

        const response = await apiClient.get(`/bio-resources/types?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error('获取资源类型列表失败:', error);
        throw error;
    }
};

/**
 * 获取特定资源类型详情
 * @param {string} typeId - 资源类型ID
 * @returns {Promise<Object>} 资源类型详情
 */
export const fetchResourceType = async (typeId) => {
    try {
        const response = await apiClient.get(`/bio-resources/types/${typeId}`);
        return response.data;
    } catch (error) {
        console.error(`获取资源类型 ${typeId} 详情失败:`, error);
        throw error;
    }
};

// ===== 通用资源项API =====

/**
 * 获取资源项列表
 * @param {Object} params - 请求参数
 * @param {string} [params.type_id] - 资源类型ID，可选
 * @param {string} [params.type_key] - 资源类型键名，可选
 * @returns {Promise<Array>} 资源项列表
 */
export const fetchResourceItems = async (params = {}) => {
    try {
        const { type_id, type_key } = params;
        const queryParams = new URLSearchParams(
            Object.entries({ type_id, type_key })
                .filter(([_, value]) => value !== undefined)
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
        );

        const response = await apiClient.get(`/bio-resources/items?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error('获取资源项列表失败:', error);
        throw error;
    }
};

/**
 * 创建资源项
 * @param {Object} data - 资源项创建数据
 * @returns {Promise<Object>} 创建的资源项
 */
export const createResourceItem = async (data) => {
    try {
        console.log('创建资源项数据:', data);
        const response = await apiClient.post('/bio-resources/items', data);
        return response.data;
    } catch (error) {
        console.error('创建资源项失败:', error);
        throw error;
    }
};

/**
 * 获取特定资源项
 * @param {string} itemId - 资源项ID
 * @returns {Promise<Object>} 资源项详情
 */
export const fetchResourceItem = async (itemId) => {
    try {
        const response = await apiClient.get(`/bio-resources/items/${itemId}`);
        return response.data;
    } catch (error) {
        console.error(`获取资源项 ${itemId} 详情失败:`, error);
        throw error;
    }
};

/**
 * 更新资源项
 * @param {string} itemId - 资源项ID
 * @param {Object} data - 资源项更新数据
 * @returns {Promise<Object>} 更新后的资源项
 */
export const updateResourceItem = async (itemId, data) => {
    try {
        console.log(`更新资源项 ${itemId} 数据:`, data);
        const response = await apiClient.put(`/bio-resources/items/${itemId}`, data);
        return response.data;
    } catch (error) {
        console.error(`更新资源项 ${itemId} 失败:`, error);
        throw error;
    }
};

/**
 * 删除资源项
 * @param {string} itemId - 资源项ID
 * @returns {Promise<Object>} 删除确认消息
 */
export const deleteResourceItem = async (itemId) => {
    try {
        const response = await apiClient.delete(`/bio-resources/items/${itemId}`);
        return response.data;
    } catch (error) {
        console.error(`删除资源项 ${itemId} 失败:`, error);
        throw error;
    }
};

// ===== 质粒特定API =====

/**
 * 获取所有质粒
 * @param {Object} params - 请求参数
 * @param {string} [params.vector] - 载体，可选
 * @param {string} [params.resistance] - 抗性，可选
 * @param {string} [params.status] - 状态，可选
 * @param {string} [params.location] - 位置，可选
 * @param {string} [params.box_id] - 盒子ID，可选
 * @param {string} [params.keeper] - 保管人，可选
 * @returns {Promise<Array>} 所有符合条件的质粒列表
 */
export const fetchAllPlasmids = async (params = {}) => {
    try {
        const queryParams = new URLSearchParams(
            Object.entries(params)
                .filter(([_, value]) => value !== undefined && value !== null && value !== '')
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
        );

        const response = await apiClient.get(`/bio-resources/plasmids?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error('获取质粒列表失败:', error);
        throw error;
    }
};

/**
 * 获取质粒盒列表
 * @returns {Promise<Array>} 质粒盒列表
 */
export const fetchPlasmidBoxes = async () => {
    try {
        const response = await apiClient.get('/bio-resources/plasmids/boxes');
        return response.data;
    } catch (error) {
        console.error('获取质粒盒列表失败:', error);
        throw error;
    }
};

/**
 * 创建质粒
 * @param {Object} data - 质粒创建数据
 * @returns {Promise<Object>} 创建的质粒
 */
export const createPlasmid = async (data) => {
    try {
        const response = await apiClient.post('/bio-resources/plasmids', data);
        return response.data;
    } catch (error) {
        console.error('创建质粒失败:', error);
        throw error;
    }
};

/**
 * 获取特定质粒
 * @param {string} plasmidId - 质粒ID
 * @returns {Promise<Object>} 质粒详情
 */
export const fetchPlasmid = async (plasmidId) => {
    try {
        const response = await apiClient.get(`/bio-resources/plasmids/${plasmidId}`);
        return response.data;
    } catch (error) {
        console.error(`获取质粒 ${plasmidId} 详情失败:`, error);
        throw error;
    }
};

/**
 * 更新质粒
 * @param {string} plasmidId - 质粒ID
 * @param {Object} data - 质粒更新数据
 * @returns {Promise<Object>} 更新后的质粒
 */
export const updatePlasmid = async (plasmidId, data) => {
    try {
        const response = await apiClient.put(`/bio-resources/plasmids/${plasmidId}`, data);
        return response.data;
    } catch (error) {
        console.error(`更新质粒 ${plasmidId} 失败:`, error);
        throw error;
    }
};

/**
 * 删除质粒
 * @param {string} plasmidId - 质粒ID
 * @returns {Promise<Object>} 删除确认消息
 */
export const deletePlasmid = async (plasmidId) => {
    try {
        const response = await apiClient.delete(`/bio-resources/plasmids/${plasmidId}`);
        return response.data;
    } catch (error) {
        console.error(`删除质粒 ${plasmidId} 失败:`, error);
        throw error;
    }
};

/**
 * 获取特定盒子内所有质粒
 * @param {string} boxId - 质粒盒ID
 * @returns {Promise<Array>} 盒子内所有质粒列表
 */
export const fetchPlasmidsInBox = async (boxId) => {
    try {
        const response = await apiClient.get(`/bio-resources/plasmids/boxes/${boxId}/plasmids`);
        return response.data;
    } catch (error) {
        console.error(`获取质粒盒 ${boxId} 内质粒失败:`, error);
        throw error;
    }
};

// ===== 细胞系特定API =====

/**
 * 获取所有细胞系
 * @param {Object} params - 请求参数
 * @param {string} [params.type] - 细胞类型，可选
 * @param {string} [params.status] - 状态，可选
 * @param {string} [params.location] - 位置，可选
 * @param {string} [params.keeper] - 保管人，可选
 * @returns {Promise<Array>} 所有符合条件的细胞系列表
 */
export const fetchAllCellLines = async (params = {}) => {
    try {
        const queryParams = new URLSearchParams(
            Object.entries(params)
                .filter(([_, value]) => value !== undefined && value !== null && value !== '')
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
        );

        const response = await apiClient.get(`/bio-resources/cell-lines/all?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error('获取细胞系列表失败:', error);
        throw error;
    }
};

/**
 * 更新细胞系传代记录
 * @param {string} itemId - 细胞系ID
 * @param {Object} data - 传代记录数据
 * @param {string} data.passage_date - 传代日期
 * @param {string} [data.notes] - 传代备注信息，可选
 * @returns {Promise<Object>} 更新后的细胞系
 */
export const updateCellLinePassage = async (itemId, data) => {
    try {
        console.log(`更新细胞系 ${itemId} 传代记录:`, data);
        const response = await apiClient.post(`/bio-resources/cell-lines/${itemId}/passage`, data);
        return response.data;
    } catch (error) {
        console.error(`更新细胞系 ${itemId} 传代记录失败:`, error);
        throw error;
    }
};

/**
 * 获取细胞系传代历史
 * @param {string} cellLineId - 细胞系ID
 * @returns {Promise<Array>} 传代历史记录列表
 */
export const fetchCellLinePassageHistory = async (cellLineId) => {
    try {
        const response = await apiClient.get(`/bio-resources/cell-lines/${cellLineId}/passages`);
        return response.data;
    } catch (error) {
        console.error(`获取细胞系 ${cellLineId} 传代历史失败:`, error);
        throw error;
    }
};

// ===== 通用搜索和导出API =====

/**
 * 资源搜索
 * @param {Object} params - 请求参数
 * @param {string} params.query - 搜索关键词
 * @param {string} [params.resource_type] - 资源类型，可选
 * @returns {Promise<Array>} 符合搜索条件的资源项列表
 */
export const searchResources = async (params = {}) => {
    try {
        const { query, resource_type } = params;

        if (!query) {
            throw new Error('搜索关键词不能为空');
        }

        const queryParams = new URLSearchParams({
            query,
            ...(resource_type && { resource_type })
        });

        const response = await apiClient.get(`/bio-resources/search?${queryParams}`);
        return response.data;
    } catch (error) {
        console.error('资源搜索失败:', error);
        throw error;
    }
};

/**
 * 资源导出
 * @param {Object} data - 请求体
 * @param {string} data.resource_type - 资源类型键名
 * @param {Object} [data.filters] - 筛选条件，可选
 * @returns {Promise<Blob>} Excel文件下载
 */
export const exportResources = async (data) => {
    try {
        console.log('导出资源数据:', data);

        const response = await apiClient.post('/bio-resources/export', data, {
            responseType: 'blob',
            headers: {
                'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Type': 'application/json'
            }
        });

        if (!(response.data instanceof Blob)) {
            throw new Error('服务器响应格式错误：预期接收Blob类型数据');
        }

        return response.data;
    } catch (error) {
        console.error('导出资源失败:', error);

        // 如果错误响应是Blob类型，尝试解析错误信息
        if (error.response?.data instanceof Blob) {
            try {
                const text = await error.response.data.text();
                const errorData = JSON.parse(text);
                throw new Error(`导出失败: ${errorData.detail || JSON.stringify(errorData)}`);
            } catch (e) {
                throw new Error(`导出失败: ${error.message}`);
            }
        }

        throw error;
    }
};
// 修改函数名以匹配使用
export const createPlasmidBox = async (data) => {
    try {
        const response = await apiClient.post('/bio-resources/plasmids/boxes', data);
        return response.data;
    } catch (error) {
        console.error('创建质粒盒失败:', error);
        throw error;
    }
};

export const updatePlasmidBox = async (boxId, data) => {
    try {
        const response = await apiClient.put(`/bio-resources/plasmids/boxes/${boxId}`, data);
        return response.data;
    } catch (error) {
        console.error(`更新质粒盒 ${boxId} 失败:`, error);
        throw error;
    }
};

export const deletePlasmidBox = async (boxId) => {
    try {
        const response = await apiClient.delete(`/bio-resources/plasmids/boxes/${boxId}`);
        return response.data;
    } catch (error) {
        console.error(`删除质粒盒 ${boxId} 失败:`, error);
        throw error;
    }
};

// 将质粒放入盒子
export const putPlasmidInBox = async (boxId, plasmidId, position) => {
    try {
        const response = await apiClient.post(`/bio-resources/plasmids/boxes/${boxId}/plasmids/${plasmidId}?position=${position}`);
        return response.data;
    } catch (error) {
        console.error(`将质粒 ${plasmidId} 放入盒子 ${boxId} 失败:`, error);
        throw error;
    }
};

// 从盒子中移除质粒
export const removePlasmidFromBox = async (boxId, plasmidId) => {
    try {
        const response = await apiClient.delete(`/bio-resources/plasmids/boxes/${boxId}/plasmids/${plasmidId}`);
        return response.data;
    } catch (error) {
        console.error(`从盒子 ${boxId} 移除质粒 ${plasmidId} 失败:`, error);
        throw error;
    }
};

// 添加新的 API 函数
export const createCellLine = async (data) => {
    try {
        const response = await apiClient.post('/bio-resources/cell-lines', data);
        return response.data;
    } catch (error) {
        console.error('创建细胞系失败:', error);
        throw error;
    }
};

export const updateCellLine = async (id, data) => {
    try {
        const response = await apiClient.put(`/bio-resources/cell-lines/${id}`, data);
        return response.data;
    } catch (error) {
        console.error(`更新细胞系 ${id} 失败:`, error);
        throw error;
    }
};

export const deleteCellLine = async (id) => {
    try {
        const response = await apiClient.delete(`/bio-resources/cell-lines/${id}`);
        return response.data;
    } catch (error) {
        console.error(`删除细胞系 ${id} 失败:`, error);
        throw error;
    }
};
