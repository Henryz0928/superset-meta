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

# 默认标志
REQUIRES_BUILD_ESSENTIAL=false
USE_CACHE=true

# 过滤参数
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --requires-build-essential)
      REQUIRES_BUILD_ESSENTIAL=true
      ;;
    --no-cache)
      USE_CACHE=false
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done

# 如果需要则安装 build-essential
if $REQUIRES_BUILD_ESSENTIAL; then
  echo "正在安装构建包 build-essential..."
  apt-get update -qq \
    && apt-get install -yqq --no-install-recommends build-essential
fi

# 选择是否使用 pip 缓存
if $USE_CACHE; then
  echo "正在使用 pip 缓存..."
  uv pip install "${ARGS[@]}"
else
  echo "禁用 pip 缓存..."
  uv pip install --no-cache-dir "${ARGS[@]}"
fi

# 如果之前安装了 build-essential 则移除
if $REQUIRES_BUILD_ESSENTIAL; then
  echo "正在移除 build-essential 以保持镜像精简..."
  apt-get autoremove -yqq --purge build-essential \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*
fi

echo "Python 包安装成功。"