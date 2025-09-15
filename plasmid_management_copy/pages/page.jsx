'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button as AntButton, App, Modal, ConfigProvider, Form, message } from 'antd';
import { Button } from '@/app/components/catalyst/button';
import { FiDatabase, FiPlus } from 'react-icons/fi';

// 组件引入（从集中管理的components目录）
import { PlasmidHeader } from '@/app/components/plasmid/PlasmidHeader';
import { PlasmidFilter } from '@/app/components/plasmid/PlasmidFilter';
import { PlasmidTable } from '@/app/components/plasmid/PlasmidTable';
import { PlasmidFormModal } from '@/app/components/plasmid/PlasmidFormModal';
import { PlasmidBoxFormModal } from '@/app/components/plasmid/PlasmidBoxFormModal';
import { PlasmidEmptyState } from '@/app/components/plasmid/PlasmidEmptyState';
import { PlasmidBoxCard } from '@/app/components/plasmid/PlasmidBoxCard';
import { PlasmidBoxGrid } from '@/app/components/plasmid/PlasmidBoxGrid';

// hooks, utils 等从当前目录引入
import { usePlasmidData } from './hooks/usePlasmidData';
import { usePlasmidBox } from './hooks/usePlasmidBox';
import { getUniqueFieldValues } from './utils/plasmidHelpers';

export default function PlasmidsManagement() {
    return (
        <ConfigProvider>
            <App>
                <Form.Provider>
                    <PlasmidsContent />
                </Form.Provider>
            </App>
        </ConfigProvider>
    );
}

function PlasmidsContent() {
    // 使用App.useApp()获取message和modal实例
    const { message, modal } = App.useApp();

    // 使用自定义 hooks 管理状态，传入message实例
    const {
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
    } = usePlasmidData(message);

    const {
        boxes,
        currentBox,
        isBoxViewMode,
        viewMode,
        boxListPage,
        isLoading: isBoxLoading,
        setCurrentBox,
        setIsBoxViewMode,
        setViewMode,
        setBoxListPage,
        handleBoxClick,
        addBox,
        updateBox,
        deleteBox,
        loadBoxes
    } = usePlasmidBox(message);

    // 添加调试日志
    console.log('调试信息:', {
        isBoxLoading,
        boxesLength: boxes?.length,
        boxes: boxes
    });

    // 本地状态管理
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [currentPlasmid, setCurrentPlasmid] = React.useState(null);
    const [isFilterExpanded, setIsFilterExpanded] = React.useState(false);
    const [activeFilters, setActiveFilters] = React.useState({});
    const [searchText, setSearchText] = React.useState('');
    const [mainListPage, setMainListPage] = React.useState(1);
    const mainListItemsPerPage = 10;
    const [isNewBoxModalOpen, setIsNewBoxModalOpen] = useState(false);
    const [selectedPlasmidId, setSelectedPlasmidId] = useState(null);
    const [highlightedPosition, setHighlightedPosition] = useState(null);
    const [boxModalSource, setBoxModalSource] = useState(null); // 'plasmid' 或 null

    // 处理函数
    const handleAddClick = () => {
        setCurrentPlasmid(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (plasmid) => {
        setCurrentPlasmid(plasmid);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (plasmid) => {
        // 使用modal API而不是Modal组件
        modal.confirm({
            title: '确认删除',
            content: `确定要删除质粒 ${plasmid.name} 吗？`,
            okText: '确认',
            cancelText: '取消',
            okButtonProps: {
                danger: true
            },
            onOk: async () => {
                try {
                    await deletePlasmid(plasmid.id);
                    message.success('删除成功');
                    await loadPlasmids();
                } catch (error) {
                    message.error('删除失败');
                    console.error('删除失败:', error);
                }
            }
        });
    };

    const handleFilterChange = (field, values) => {
        const newFilters = { ...activeFilters };
        if (values && values.length) {
            newFilters[field] = values;
        } else {
            delete newFilters[field];
        }
        setActiveFilters(newFilters);
        applyFilters(newFilters, searchText);
    };

    const clearAllFilters = () => {
        setActiveFilters({});
        setSearchText('');
        applyFilters({}, '');
    };

    const handlePlasmidSelect = (plasmidId) => {
        setSelectedPlasmidId(plasmidId === selectedPlasmidId ? null : plasmidId);
    };

    const handleEditBoxClick = async (box) => {
        try {
            setCurrentBox(box);
            setIsNewBoxModalOpen(true);
        } catch (error) {
            message.error('编辑失败');
            console.error('编辑失败:', error);
        }
    };

    const handleDeleteBoxClick = (box) => {
        modal.confirm({
            title: '确认删除',
            content: `确定要删除质粒盒 ${box.name} 吗？`,
            okText: '确认',
            cancelText: '取消',
            okButtonProps: {
                danger: true
            },
            onOk: async () => {
                try {
                    await deleteBox(box.id);
                    message.success('删除成功');
                    await loadBoxes();
                } catch (error) {
                    message.error('删除失败');
                    console.error('删除失败:', error);
                }
            }
        });
    };

    const handleSubmit = async (values) => {
        try {
            console.log('【调试-页面】接收到的表单数据:', {
                box_id: values.box_id,
                position: values.position,
                // 其他关键字段...
            });

            if (currentPlasmid) {
                console.log('【调试-页面】准备更新质粒:', currentPlasmid.id);
                await updatePlasmid(currentPlasmid.id, values);
            } else {
                console.log('【调试-页面】准备创建质粒');
                await addPlasmid(values);
            }

            // 关闭模态框
            setIsModalOpen(false);

            // 直接重新加载数据，移除setTimeout
            await loadPlasmids();
            // 如果有box_id，我们也需要更新box的信息
            if (values.box_id) {
                await loadBoxes();
            }

        } catch (error) {
            console.error('操作失败:', error);
            message.error(currentPlasmid ? '质粒更新失败' : '质粒添加失败');
        }
    };

    const handleBoxModalClose = () => {
        setIsNewBoxModalOpen(false);
        setCurrentBox(null);
        // 如果是从质粒创建窗口打开的，不要关闭质粒窗口
        if (boxModalSource !== 'plasmid') {
            setBoxModalSource(null);
        }
    };

    const handleBoxCreate = (source) => {
        setBoxModalSource(source);
        setIsNewBoxModalOpen(true);
    };

    const handleBoxSubmit = async (values) => {
        try {
            if (currentBox) {
                // 编辑模式
                const updateData = {
                    name: values.name,
                    location: values.location,
                    rows: currentBox.rows,
                    columns: currentBox.columns,
                    slots: currentBox.slots,
                    used: currentBox.used || 0,
                    layoutType: currentBox.layoutType || 'grid'
                };

                await updateBox(currentBox.id, updateData);
            } else {
                // 创建模式
                const newBox = await addBox({
                    name: values.name,
                    location: values.location,
                    rows: parseInt(values.rows),
                    columns: parseInt(values.columns),
                    slots: parseInt(values.rows) * parseInt(values.columns),
                    used: 0,
                    layoutType: 'grid'
                });
                message.success('质粒盒创建成功');
            }

            setIsNewBoxModalOpen(false);
            setCurrentBox(null);
            await loadBoxes();

            if (boxModalSource === 'plasmid') {
                setIsModalOpen(false);
                setTimeout(() => {
                    setIsModalOpen(true);
                }, 100);
            }
            setBoxModalSource(null);
        } catch (error) {
            console.error('质粒盒操作失败:', error);
            message.error(currentBox ? '质粒盒更新失败' : '质粒盒创建失败');
        }
    };

    // 渲染主列表视图
    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
            >
                {isBoxViewMode && currentBox ? (
                    // 质粒盒详情视图
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setIsBoxViewMode(false);
                                        setCurrentBox(null);
                                    }}
                                >
                                    返回
                                </Button>
                                <h2 className="text-xl font-medium">
                                    质粒盒：{currentBox.name}
                                </h2>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={viewMode === 'grid' ? 'solid' : 'outline'}
                                    onClick={() => setViewMode('grid')}
                                >
                                    网格视图
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === 'list' ? 'solid' : 'outline'}
                                    onClick={() => setViewMode('list')}
                                >
                                    列表视图
                                </Button>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <p className="text-gray-500">ID</p>
                                    <p className="font-medium">{currentBox.id}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">存放位置</p>
                                    <p className="font-medium">{currentBox.location}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">使用情况</p>
                                    <p className="font-medium">
                                        {plasmids.filter(p => p.box_id === currentBox.id).length} / {currentBox.slots || (currentBox.rows * currentBox.columns) || 0} 个位置
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-500">布局</p>
                                    <p className="font-medium">
                                        {currentBox.rows || 0} × {currentBox.columns || 0}
                                    </p>
                                </div>
                            </div>

                            {viewMode === 'grid' ? (
                                <PlasmidBoxGrid
                                    currentBox={currentBox}
                                    plasmids={plasmids.filter(p => p.box_id === currentBox.id)}
                                    selectedPlasmidId={selectedPlasmidId}
                                    highlightedPosition={highlightedPosition}
                                    onPlasmidSelect={handlePlasmidSelect}
                                    onPositionHover={setHighlightedPosition}
                                />
                            ) : (
                                <PlasmidTable
                                    plasmids={plasmids.filter(p => p.box_id === currentBox.id)}
                                    currentPage={boxListPage}
                                    itemsPerPage={10}
                                    onPageChange={setBoxListPage}
                                    onEditClick={handleEditClick}
                                    onDeleteClick={handleDeleteClick}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <PlasmidHeader
                            onAddClick={handleAddClick}
                            useMockData={useMockData}
                            showAddButton={plasmids.length > 0}
                        />

                        {/* 质粒管理部分 */}
                        {isLoading ? (
                            <div className="flex justify-center items-center p-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                                <h3 className="text-red-800 text-lg font-medium mb-2">加载数据出错</h3>
                                <p className="text-red-600">{error}</p>
                                <Button onClick={loadPlasmids} className="mt-4" variant="outline">重试</Button>
                            </div>
                        ) : plasmids.length === 0 ? (
                            <PlasmidEmptyState
                                type="质粒"
                                message="您还没有添加任何质粒。点击下方按钮创建您的第一个质粒。"
                                icon={FiDatabase}
                                onAdd={handleAddClick}
                            />
                        ) : (
                            <>
                                <PlasmidFilter
                                    searchText={searchText}
                                    onSearchChange={(value) => {
                                        setSearchText(value);
                                        handleSearch(value);
                                    }}
                                    isFilterExpanded={isFilterExpanded}
                                    onFilterExpandChange={setIsFilterExpanded}
                                    activeFilters={activeFilters}
                                    onFilterChange={handleFilterChange}
                                    onClearFilters={clearAllFilters}
                                    getUniqueFieldValues={getUniqueFieldValues}
                                    filteredCount={filteredPlasmids.length}
                                    totalCount={plasmids.length}
                                    plasmids={plasmids}
                                />

                                <PlasmidTable
                                    plasmids={filteredPlasmids}
                                    currentPage={mainListPage}
                                    itemsPerPage={mainListItemsPerPage}
                                    onPageChange={setMainListPage}
                                    onBoxClick={handleBoxClick}
                                    onEditClick={handleEditClick}
                                    onDeleteClick={handleDeleteClick}
                                />
                            </>
                        )}

                        {/* 质粒盒管理部分 */}
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="flex justify-between items-center p-4 border-b">
                                <h2 className="text-lg font-medium">质粒盒管理</h2>
                                {boxes && boxes.length > 0 && (
                                    <Button
                                        onClick={() => handleBoxCreate('plasmid')}
                                        className="flex items-center gap-2"
                                    >
                                        <FiPlus className="text-lg" />
                                        添加质粒盒
                                    </Button>
                                )}
                            </div>

                            {isBoxLoading ? (
                                <div className="p-8 text-center text-gray-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                                    <p>加载质粒盒数据中...</p>
                                </div>
                            ) : (!boxes || boxes.length === 0) ? (
                                <PlasmidEmptyState
                                    type="质粒盒"
                                    message="您还没有添加任何质粒盒。质粒盒可以帮助您更好地管理和组织质粒。"
                                    icon={FiDatabase}
                                    onAdd={() => handleBoxCreate('plasmid')}
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                                    {boxes.map((box, index) => (
                                        <PlasmidBoxCard
                                            key={box.id}
                                            box={box}
                                            onBoxClick={handleBoxClick}
                                            onEditClick={handleEditBoxClick}
                                            onDeleteClick={handleDeleteBoxClick}
                                            index={index}
                                            plasmids={plasmids}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <PlasmidFormModal
                            isOpen={isModalOpen}
                            onClose={() => setIsModalOpen(false)}
                            currentPlasmid={currentPlasmid}
                            plasmidsCount={plasmids.length}
                            onSubmit={handleSubmit}
                            boxes={boxes}
                            onBoxCreate={() => handleBoxCreate('plasmid')}
                            plasmids={plasmids}
                        />

                        {isNewBoxModalOpen && (
                            <PlasmidBoxFormModal
                                isOpen={isNewBoxModalOpen}
                                onClose={handleBoxModalClose}
                                currentBox={currentBox}
                                boxesCount={boxes.length}
                                onSubmit={handleBoxSubmit}
                            />
                        )}
                    </>
                )}
            </motion.div>
        </>
    );
}
