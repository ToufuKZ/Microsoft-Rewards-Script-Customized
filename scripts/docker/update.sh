#!/bin/bash
set -e

echo "[$(date)] 开始更新Microsoft Rewards脚本..."

# 进入应用目录
cd /usr/src/microsoft-rewards-script

echo "[$(date)] 检查Git存储库状态..."

# 检查是否为Git存储库
if [ ! -d ".git" ]; then
    echo "[$(date)] 初始化Git存储库..."
    git init
    git remote add origin https://github.com/ToufuKZ/Microsoft-Rewards-Script-Customized.git
    git fetch
    git checkout main
else
    echo "[$(date)] 拉取最新代码..."
    git pull origin v3
fi

echo "[$(date)] 代码拉取完成，开始安装依赖..."

# 安装依赖（仅运行时依赖）
npm ci --omit=dev --ignore-scripts

echo "[$(date)] 依赖安装完成，开始构建..."

# 构建项目
npm run build

echo "[$(date)] 构建完成，重启定时任务..."

# 重启cron服务
service cron restart

echo "[$(date)] 更新完成！脚本已成功更新到最新版本。"
echo "[$(date)] 下次计划运行时间：$(crontab -l | grep -v '^#' | grep -v 'update.sh' | head -1)"
