# 授权给 Apache 软件基金会(ASF)的一个或多个
# 贡献者许可协议。有关版权所有权的更多信息，
# 请参阅随本作品分发的 NOTICE 文件。
# ASF 根据 Apache 许可证 2.0 版本向您授权本文件
#（"许可证"）；除非符合许可证的规定，
# 否则您不得使用此文件。
# 您可以在以下位置获取许可证副本：
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# 除非适用法律要求或书面同意，否则根据许可证分发的
# 软件是基于"按原样"的基础分发的，
# 没有任何明示或暗示的保证或条件。
# 有关许可证下的特定语言管理权限和
# 限制，请参阅许可证。
#
# 此文件包含在最终的 Docker 镜像中，在将镜像部署到生产环境时应该被覆盖。
# 这里配置的设置旨在用于本地开发环境。另外请注意，superset_config_docker.py 
# 作为最后一步被导入，用作覆盖这里配置的"默认值"的手段
#

import logging
import os
import sys

from celery.schedules import crontab
from flask_caching.backends.filesystemcache import FileSystemCache

logger = logging.getLogger()

# ...existing code...

# SQLAlchemy 连接字符串
SQLALCHEMY_DATABASE_URI = (
    f"{DATABASE_DIALECT}://"
    f"{DATABASE_USER}:{DATABASE_PASSWORD}@"
    f"{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_DB}"
)

# ...existing code...

# 使用 docker compose 时基础 URL 应该是 http://superset_nginx{ENV{BASEPATH}}/
WEBDRIVER_BASEURL = f"http://superset_app{os.environ.get('SUPERSET_APP_ROOT', '/')}/"

# 邮件报告超链接的基础 URL
WEBDRIVER_BASEURL_USER_FRIENDLY = (
    f"http://localhost:8888/{os.environ.get('SUPERSET_APP_ROOT', '/')}/"
)

# ...existing code...

if os.getenv("CYPRESS_CONFIG") == "true":
    # 当作为 cypress 后端运行服务时，我们需要导入位于
    # tests/integration_tests/superset_test_config.py 的配置
    base_dir = os.path.dirname(__file__)
    module_folder = os.path.abspath(
        os.path.join(base_dir, "../../tests/integration_tests/")
    )
    sys.path.insert(0, module_folder)
    from superset_test_config import *  # noqa

    sys.path.pop(0)

#
# 可选导入 superset_config_docker.py（它将被包含在 PYTHONPATH 中）
# 以允许覆盖本地设置
#
try:
    import superset_config_docker
    from superset_config_docker import *  # noqa

    logger.info(
        f"已加载您的 Docker 配置：[{superset_config_docker.__file__}]"
    )
except ImportError:
    logger.info("使用默认 Docker 配置...")