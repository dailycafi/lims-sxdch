---
name: deploy
description: 部署 LIMS 系统到生产服务器。当用户提到"部署"、"发布"、"上线"、"deploy"时触发。
metadata:
  version: "1.0.0"
---

# LIMS 部署技能

将本地代码部署到生产服务器 (223.4.24.30)。

## 服务器信息

- **IP**: 223.4.24.30
- **应用用户**: lims
- **项目路径**: `/home/lims/www/lims-sxdch`
- **线上地址**: https://lims.insimedge.com

## 部署流程

部署分为两个阶段：**本地准备** 和 **远程部署**。

---

## 阶段一：本地准备

在发起远程部署前，**必须**先完成以下本地检查：

### 1.1 检查代码状态

```bash
git status
```

确保没有未提交的更改，或者所有更改都已暂存。

### 1.2 运行前端构建

```bash
cd frontend && npm run build
```

**必须通过**，否则不要继续部署。

### 1.3 提交并推送代码

```bash
git add .
git commit -m "描述本次修改"
git push origin main
```

### 本地准备检查清单

- [ ] `git status` 确认更改已暂存
- [ ] `npm run build` 构建成功
- [ ] `git push origin main` 推送成功

**只有以上全部通过，才能进入远程部署阶段。**

---

## 阶段二：远程部署

### 第一步：SSH 连接服务器

```bash
ssh root@223.4.24.30
```

### 第三步：切换到 lims 用户

```bash
su lims
cd ~/www/lims-sxdch
```

### 第四步：拉取最新代码

```bash
git pull --rebase
```

如果有冲突，需要先解决冲突再继续。

### 第五步：后端部署

#### 4.1 激活虚拟环境

```bash
cd backend
source venv/bin/activate
```

#### 4.2 安装依赖（如有新增）

```bash
pip install -r requirements.txt
```

#### 4.3 检查是否需要更新数据库

如果有模型变更（询问用户或根据 git diff 判断），运行：

```bash
python init_db.py --drop
```

**警告**：`--drop` 会清空所有数据，生产环境慎用！

#### 4.4 退出到 root 用户，重启后端服务

```bash
exit  # 退出 lims 用户，回到 root
sudo systemctl restart lims-backend
```

#### 4.5 检查后端服务状态

```bash
sudo systemctl status lims-backend
```

确保显示 `active (running)`，无错误信息。

### 第六步：前端部署

#### 5.1 切换回 lims 用户

```bash
su lims
cd ~/www/lims-sxdch/frontend
```

#### 5.2 安装依赖（如有新增）

```bash
npm install
```

#### 5.3 构建前端

```bash
npm run build
```

确保构建成功，无错误。

#### 5.4 重启前端服务

```bash
pm2 restart lims-frontend
```

#### 5.5 检查前端服务状态

```bash
pm2 status
```

确保 `lims-frontend` 状态为 `online`。

### 第七步：验证部署

使用浏览器访问并验证：

1. **打开网站**：`browser_navigate` 到 `https://lims.insimedge.com`
2. **检查页面加载**：`browser_snapshot` 确认页面正常显示
3. **测试登录**：
   - 输入用户名：`admin`
   - 输入密码：`admin123`（或当前有效的测试密码）
   - 点击登录按钮
4. **确认登录成功**：检查是否进入主界面

## 快速命令参考

### 本地准备

```bash
# 检查状态
git status

# 构建前端（必须通过）
cd frontend && npm run build

# 提交推送
git add .
git commit -m "描述本次修改"
git push origin main
```

### 远程部署

```bash
# 1. SSH 连接
ssh root@223.4.24.30

# 2. 拉取代码
su lims
cd ~/www/lims-sxdch
git pull --rebase

# 3. 后端
cd backend
source venv/bin/activate
pip install -r requirements.txt
# python init_db.py --drop  # 仅在需要时执行
exit

# 4. 重启后端
sudo systemctl restart lims-backend
sudo systemctl status lims-backend

# 5. 前端
su lims
cd ~/www/lims-sxdch/frontend
npm install
npm run build
pm2 restart lims-frontend
pm2 status
```

## 检查清单

### 本地准备
- [ ] `git status` 确认更改状态
- [ ] `npm run build` 构建成功
- [ ] `git push origin main` 推送成功

### 远程部署
- [ ] SSH 连接成功
- [ ] git pull 无冲突
- [ ] 后端依赖已安装
- [ ] 数据库已同步（如需要）
- [ ] `systemctl status lims-backend` 显示 `active (running)`
- [ ] 前端 build 成功
- [ ] `pm2 status` 显示 `lims-frontend` 为 `online`
- [ ] https://lims.insimedge.com 可访问
- [ ] 登录功能正常

## 常见问题

| 问题 | 解决方案 |
|-----|---------|
| git pull 冲突 | `git stash` 暂存本地更改，pull 后 `git stash pop` |
| 后端启动失败 | 查看日志：`journalctl -u lims-backend -n 50` |
| 前端 build 失败 | 检查 TypeScript 错误，本地先 `npm run build` 通过 |
| pm2 重启失败 | `pm2 logs lims-frontend` 查看错误 |
| 网站无法访问 | 检查 nginx：`sudo nginx -t && sudo systemctl reload nginx` |

## 回滚

如果部署出现问题需要回滚：

```bash
su lims
cd ~/www/lims-sxdch
git log --oneline -5  # 查看最近提交
git reset --hard <commit-hash>  # 回滚到指定版本

# 然后重新执行后端和前端重启步骤
```
