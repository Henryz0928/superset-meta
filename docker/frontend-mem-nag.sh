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

# 需要至少 3GB 的可用内存...
MIN_MEM_FREE_GB=3
MIN_MEM_FREE_KB=$(($MIN_MEM_FREE_GB*1000000))

echo_mem_warn() {
  MEM_FREE_KB=$(awk '/MemFree/ { printf "%s \n", $2 }' /proc/meminfo)
  MEM_FREE_GB=$(awk '/MemFree/ { printf "%s \n", $2/1024/1024 }' /proc/meminfo)

  if [[ "${MEM_FREE_KB}" -lt "${MIN_MEM_FREE_KB}" ]]; then
    cat <<EOF
    ===============================================
    ========  内存不足警告 ========================
    ===============================================

    看起来您只有 ${MEM_FREE_GB}GB 的可用内存。
    请将 Docker 资源增加到至少 ${MIN_MEM_FREE_GB}GB

    ===============================================
    ========  内存不足警告 ========================
    ===============================================
EOF
  else
    echo "内存检查通过 [${MEM_FREE_GB}GB 可用]"
  fi
}

# 当内存不足时总是显示警告...
echo_mem_warn