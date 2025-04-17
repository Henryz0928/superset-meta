# 授权给Apache软件基金会(ASF)，基于一个或多个
# 贡献者许可协议。请参阅随附的NOTICE文件，
# 以获取有关版权所有权的更多信息。
# ASF根据Apache许可证2.0版（"许可证"）
# 向您授权此文件；除非符合许可证，
# 否则不得使用此文件。您可以在以下网址获取许可证副本：
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# 除非适用法律要求或书面同意，否则根据许可证分发的
# 软件是基于"按原样"分发的，
# 没有任何明示或暗示的担保或条件。
# 有关许可证下特定的语言管理权限和
# 限制，请参阅许可证。
from __future__ import annotations

import logging
import os
import sys
from typing import cast, Iterable, Optional

if sys.version_info >= (3, 11):
    from wsgiref.types import StartResponse, WSGIApplication, WSGIEnvironment
else:
    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from _typeshed.wsgi import StartResponse, WSGIApplication, WSGIEnvironment


from flask import Flask
from werkzeug.exceptions import NotFound

from superset.initialization import SupersetAppInitializer

logger = logging.getLogger(__name__)


def create_app(
    superset_config_module: Optional[str] = None,
    superset_app_root: Optional[str] = None,
) -> Flask:
    """
    创建并配置Superset应用实例。

    参数:
        superset_config_module: 自定义配置模块的路径，如果为None则使用环境变量中的配置
        superset_app_root: 应用的根路径，可用于在非根目录部署应用

    返回:
        配置好的Flask应用实例
    """
    app = SupersetApp(__name__)

    try:
        # 允许用户完全覆盖我们的配置
        config_module = superset_config_module or os.environ.get(
            "SUPERSET_CONFIG", "superset.config"
        )
        app.config.from_object(config_module)

        # 允许应用部署在非根路径上
        # *请注意，此功能仍处于测试阶段。*
        app_root = cast(
            str, superset_app_root or os.environ.get("SUPERSET_APP_ROOT", "/")
        )
        if app_root != "/":
            app.wsgi_app = AppRootMiddleware(app.wsgi_app, app_root)
            # 如果未设置，手动配置依赖于app_root值的选项，以便开箱即用
            if not app.config["STATIC_ASSETS_PREFIX"]:
                app.config["STATIC_ASSETS_PREFIX"] = app_root
            if app.config["APPLICATION_ROOT"] == "/":
                app.config["APPLICATION_ROOT"] = app_root

        app_initializer = app.config.get("APP_INITIALIZER", SupersetAppInitializer)(app)
        app_initializer.init_app()

        return app

    # 确保引导错误始终被记录
    except Exception:
        logger.exception("创建应用失败")
        raise


class SupersetApp(Flask):
    """
    Superset应用类，继承自Flask。
    用于扩展Flask功能，为Superset特定需求提供基础。
    """

    pass


class AppRootMiddleware:
    """
    一个将应用附加到固定前缀位置的中间件。

    该中间件负责处理应用部署在非根路径时的URL路由和重定向。

    请参阅 https://wsgi.readthedocs.io/en/latest/definitions.html
    了解SCRIPT_NAME和PATH_INFO的定义。
    """

    def __init__(
        self,
        wsgi_app: WSGIApplication,
        app_root: str,
    ):
        """
        初始化中间件。

        参数:
            wsgi_app: WSGI应用实例
            app_root: 应用根路径前缀
        """
        self.wsgi_app = wsgi_app
        self.app_root = app_root

    def __call__(
        self, environ: WSGIEnvironment, start_response: StartResponse
    ) -> Iterable[bytes]:
        """
        WSGI调用接口，处理请求路径与应用根路径的适配。

        参数:
            environ: WSGI环境字典
            start_response: WSGI响应启动函数

        返回:
            应用处理结果
        """
        original_path_info = environ.get("PATH_INFO", "")
        if original_path_info.startswith(self.app_root):
            environ["PATH_INFO"] = original_path_info.removeprefix(self.app_root)
            environ["SCRIPT_NAME"] = self.app_root
            return self.wsgi_app(environ, start_response)
        else:
            return NotFound()(environ, start_response)
