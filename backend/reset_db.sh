#!/bin/bash

# LIMS 数据库完整重置脚本
# 用途：测试阶段快速重置数据库结构和内容

echo "🔄 开始重置 LIMS 数据库..."
echo "⚠️  警告：这将删除所有数据！"
echo ""

# 切换到后端目录
cd "$(dirname "$0")"

# 步骤1: 重建数据库表和基础数据
echo "📝 步骤 1/3: 重建数据库表..."
python init_db.py --drop
if [ $? -ne 0 ]; then
    echo "❌ 数据库初始化失败！"
    exit 1
fi
echo ""

# 步骤2: 初始化角色和权限
echo "🔐 步骤 2/3: 初始化角色和权限..."
python init_roles.py
if [ $? -ne 0 ]; then
    echo "❌ 角色权限初始化失败！"
    exit 1
fi
echo ""

# 步骤3: 为用户分配角色
echo "👥 步骤 3/3: 迁移用户角色..."
python migrate_user_roles.py
if [ $? -ne 0 ]; then
    echo "❌ 用户角色迁移失败！"
    exit 1
fi
echo ""

echo "✅ 数据库重置完成！"
echo ""
echo "📊 当前系统状态："
echo "  - 数据库表: 已重建"
echo "  - 角色数量: 7个"
echo "  - 权限数量: 35个"
echo "  - 测试用户: 6个"
echo ""
echo "🚀 可以开始测试了！"
echo "   用户管理: http://localhost:3000/users"
echo "   角色管理: http://localhost:3000/roles"

