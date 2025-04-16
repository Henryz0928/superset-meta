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
/app/docker/docker-init.sh

# TODO: 从环境变量复制配置覆盖

# TODO: 以分离状态运行 celery
export SERVER_THREADS_AMOUNT=8
# 启动 web 服务器

/app/docker/entrypoints/run-server.sh