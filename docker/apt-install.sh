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
set -euo pipefail

# 确保以 root 身份运行此脚本
if [[ $EUID -ne 0 ]]; then
  echo "此脚本必须以 root 身份运行" >&2
  exit 1
fi

# 检查所需参数
if [[ $# -lt 1 ]]; then
  echo "用法: $0 <包1> [<包2> ...]" >&2
  exit 1
fi

# 用于更好的日志显示的颜色（可选）
GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

# 安装包并清理
echo -e "${GREEN}正在更新包列表...${RESET}"
apt-get update -qq

echo -e "${GREEN}正在安装包: $@${RESET}"
apt-get install -yqq --no-install-recommends "$@"

echo -e "${GREEN}正在自动删除不必要的包...${RESET}"
apt-get autoremove -y

echo -e "${GREEN}正在清理包缓存和元数据...${RESET}"
apt-get clean
rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/* /var/tmp/*

echo -e "${GREEN}安装和清理完成。${RESET}"