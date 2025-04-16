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

#
# 始终首先安装本地覆盖
#
/app/docker/docker-bootstrap.sh

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    STEP_CNT=4
else
    STEP_CNT=3
fi

echo_step() {
cat <<EOF
######################################################################
初始化步骤 ${1}/${STEP_CNT} [${2}] -- ${3}
######################################################################
EOF
}
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
# 如果运行 Cypress - 覆盖 admin 的密码并导出环境变量
if [ "$CYPRESS_CONFIG" == "true" ]; then
    ADMIN_PASSWORD="general"
    export SUPERSET_TESTENV=true
    export POSTGRES_DB=superset_cypress
    export SUPERSET__SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://superset:superset@db:5432/superset_cypress
fi
# 初始化数据库
echo_step "1" "开始" "应用数据库迁移"
superset db upgrade
echo_step "1" "完成" "应用数据库迁移"

# 创建管理员用户
echo_step "2" "开始" "设置管理员用户 ( admin / $ADMIN_PASSWORD )"
if [ "$CYPRESS_CONFIG" == "true" ]; then
    superset load_test_users
else
    superset fab create-admin \
        --username admin \
        --email admin@superset.com \
        --password "$ADMIN_PASSWORD" \
        --firstname Superset \
        --lastname Admin
fi
echo_step "2" "完成" "设置管理员用户"
# 创建默认角色和权限
echo_step "3" "开始" "设置角色和权限"
superset init
echo_step "3" "完成" "设置角色和权限"

if [ "$SUPERSET_LOAD_EXAMPLES" = "yes" ]; then
    # 加载一些示例数据
    echo_step "4" "开始" "加载示例"
    # 如果运行 Cypress 使用 superset_test_config - 加载测试所需的数据
    if [ "$CYPRESS_CONFIG" == "true" ]; then
        superset load_examples --load-test-data
    else
        superset load_examples
    fi
    echo_step "4" "完成" "加载示例"
fi