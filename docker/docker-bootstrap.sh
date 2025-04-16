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

set -eo pipefail

# 使 Python 交互式运行
if [ "$DEV_MODE" == "true" ]; then
    if [ "$(whoami)" = "root" ] && command -v uv > /dev/null 2>&1; then
      echo "以可编辑模式重新安装应用"
      uv pip install -e .
    fi
fi
REQUIREMENTS_LOCAL="/app/docker/requirements-local.txt"
PORT=${PORT:-8088}
# 如果运行 Cypress - 覆盖 admin 的密码并导出环境变量
if [ "$CYPRESS_CONFIG" == "true" ]; then
    export SUPERSET_TESTENV=true
    export POSTGRES_DB=superset_cypress
    export SUPERSET__SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://superset:superset@db:5432/superset_cypress
    PORT=8081
fi
if [[ "$DATABASE_DIALECT" == postgres* ]] && [ "$(whoami)" = "root" ]; then
    # 旧版镜像可能没有安装 postgres 开发依赖
    echo "正在安装 postgres 依赖"
    if command -v uv > /dev/null 2>&1; then
        # 在新版镜像中使用 uv
        uv pip install -e .[postgres]
    else
        # 在旧版镜像中使用 pip
        pip install -e .[postgres]
    fi
fi
#
# 确保已安装开发依赖
#
if [ -f "${REQUIREMENTS_LOCAL}" ]; then
  echo "正在安装本地覆盖依赖：${REQUIREMENTS_LOCAL}"
  if command -v uv > /dev/null 2>&1; then
    uv pip install --no-cache-dir -r "${REQUIREMENTS_LOCAL}"
  else
    pip install --no-cache-dir -r "${REQUIREMENTS_LOCAL}"
  fi
else
  echo "跳过本地覆盖依赖安装"
fi

case "${1}" in
  worker)
    echo "正在启动 Celery worker..."
    # 默认仅设置 2 个 worker 以控制开发环境中的内存使用
    celery --app=superset.tasks.celery_app:app worker -O fair -l INFO --concurrency=${CELERYD_CONCURRENCY:-2}
    ;;
  beat)
    echo "正在启动 Celery beat..."
    rm -f /tmp/celerybeat.pid
    celery --app=superset.tasks.celery_app:app beat --pidfile /tmp/celerybeat.pid -l INFO -s "${SUPERSET_HOME}"/celerybeat-schedule
    ;;
  app)
    echo "正在启动 Web 应用（使用开发服务器）..."
    flask run -p $PORT --with-threads --reload --debugger --host=0.0.0.0
    ;;
  app-gunicorn)
    echo "正在启动 Web 应用..."
    /usr/bin/run-server.sh
    ;;
  *)
    echo "未知操作！"
    ;;
esac