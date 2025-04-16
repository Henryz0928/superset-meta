#!/usr/bin/env bash
#
# 授权给 Apache 软件基金会(ASF)的一个或多个
# 贡献者许可协议。有关版权所有权的更多信息，
# 请参阅随本作品分发的 NOTICE 文件。
# ASF 根据 Apache 许可证 2.0 版本向您授权本文件
#（"许可证"）；除非符合许可证的规定，
# 否则您不得使用此文件。
# 您可以在以下位置获取许可证副本：
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# 除非适用法律要求或书面同意，否则根据许可证分发的
# 软件是基于"按原样"的基础分发的，
# 没有任何明示或暗示的保证或条件。
# 有关许可证下的特定语言管理权限和
# 限制，请参阅许可证。
#
set -e

# Puppeteer 所需的包：
if [ "$PUPPETEER_SKIP_CHROMIUM_DOWNLOAD" = "false" ]; then
    apt update
    apt install -y chromium
fi

if [ "$BUILD_SUPERSET_FRONTEND_IN_DOCKER" = "true" ]; then
    echo "在 Docker 容器内以开发模式构建 Superset 前端"
    cd /app/superset-frontend

    if [ "$NPM_RUN_PRUNE" = "true" ]; then
        echo "运行 'npm run prune'"
        npm run prune
    fi

    echo "运行 'npm install'"
    npm install

    echo "启动 webpack 开发服务器"
    # 启动 webpack 开发服务器，动态服务于 http://localhost:9000
    # 它代理到后端服务 http://localhost:8088
    npm run dev-server

else
    echo "跳过前端构建步骤 - 您需要在主机上手动运行！"
    echo "请参考：https://superset.apache.org/docs/contributing/development/#webpack-dev-server"
fi