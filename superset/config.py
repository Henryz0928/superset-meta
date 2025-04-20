# 根据 Apache 许可证 2.0 版本授权
# 你可以通过获取许可证副本来使用本软件
# 许可证副本请参见：http://www.apache.org/licenses/LICENSE-2.0
#
# 除非适用法律要求或书面同意，否则根据许可证分发的软件是基于
# "按原样" 提供的，没有任何明示或暗示的保证或条件。
# 请参阅许可证以了解特定语言下的权限和限制。
#
# 本文件遵循 Apache 许可证 2.0 版本
# 有关版权所有权的更多信息，请参见 NOTICE 文件
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# 除非适用法律要求或书面同意，根据许可证分发的软件是
# 基于"按原样"提供的，不附带任何明示或暗示的担保或条件。
# 有关许可证下特定的权限和限制，请参见许可证。
"""Superset 的主配置文件

本文件中的所有配置都可以被覆盖，只需要在你的 PYTHONPATH 中提供一个 superset_config 文件
因为在本文件末尾有一个 ``from superset_config import *`` 语句。
"""

# mypy: 忽略错误
# pylint: 禁用过多行数警告
from __future__ import annotations

import importlib.util
import json
import logging
import os
import re
import sys
from collections import OrderedDict
from contextlib import contextmanager
from datetime import timedelta
from email.mime.multipart import MIMEMultipart
from importlib.resources import files
from typing import Any, Callable, Iterator, Literal, TYPE_CHECKING, TypedDict

import click
from celery.schedules import crontab
from flask import Blueprint
from flask_appbuilder.security.manager import AUTH_DB
from flask_caching.backends.base import BaseCache
from pandas import Series
from pandas._libs.parsers import STR_NA_VALUES
from sqlalchemy.engine.url import URL
from sqlalchemy.orm.query import Query

from superset.advanced_data_type.plugins.internet_address import internet_address
from superset.advanced_data_type.plugins.internet_port import internet_port
from superset.advanced_data_type.types import AdvancedDataType
from superset.constants import CHANGE_ME_SECRET_KEY
from superset.jinja_context import BaseTemplateProcessor
from superset.key_value.types import JsonKeyValueCodec
from superset.stats_logger import DummyStatsLogger
from superset.superset_typing import CacheConfig
from superset.tasks.types import ExecutorType
from superset.utils import core as utils
from superset.utils.core import NO_TIME_RANGE, parse_boolean_string, QuerySource
from superset.utils.encrypt import SQLAlchemyUtilsAdapter
from superset.utils.log import DBEventLogger
from superset.utils.logging_configurator import DefaultLoggingConfigurator

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla import models
    from sqlglot import Dialect, Dialects

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    DialectExtensions = dict[str, Dialects | type[Dialect]]

# 实时统计日志记录器，存在一个 StatsD 实现
STATS_LOGGER = DummyStatsLogger()

# 默认情况下，使用 `DBEventLogger` 将事件记录到元数据数据库
# 注意：你可以使用 `StdOutEventLogger` 进行调试
# 注意：你可以通过扩展 `AbstractEventLogger` 来编写自己的事件记录器
# https://github.com/apache/superset/blob/master/superset/utils/log.py
EVENT_LOGGER = DBEventLogger()

SUPERSET_LOG_VIEW = True

BASE_DIR = str(files("superset"))
if "SUPERSET_HOME" in os.environ:
    DATA_DIR = os.environ["SUPERSET_HOME"]
else:
    DATA_DIR = os.path.expanduser("~/.superset")

# ---------------------------------------------------------
# Superset 特定配置
# ---------------------------------------------------------
VERSION_INFO_FILE = str(files("superset") / "static/version_info.json")
PACKAGE_JSON_FILE = str(files("superset") / "static/assets/package.json")


# 这里可以指定多个网站图标。"href" 属性是必需的，
# 但 "sizes"、"type" 和 "rel" 是可选的。
# 例如：
# {
#     "href":path/to/image.png",
#     "sizes": "16x16",
#     "type": "image/png"
#     "rel": "icon"
# },
FAVICONS = [{"href": "/static/assets/images/favicon.png"}]


def _try_json_readversion(filepath: str) -> str | None:
    try:
        with open(filepath) as f:
            return json.load(f).get("version")
    except Exception:  # pylint: disable=broad-except
        return None


def _try_json_readsha(filepath: str, length: int) -> str | None:
    try:
        with open(filepath) as f:
            return json.load(f).get("GIT_SHA")[:length]
    except Exception:  # pylint: disable=broad-except
        return None


#
# 如果为 True，将跳过加载 alembic.init 中的日志配置
#
ALEMBIC_SKIP_LOG_CONFIG = False

# 根据加载此配置的上下文，version_info.json 文件可能存在也可能不存在，
# 因为它是在通过 setup.py 安装时生成的。如果我们正在实际运行 Superset，
# 那么它一定已经安装了，因此文件会存在。但是在运行单元测试时，
# 该文件将不存在，所以我们会回退到读取 package.json
VERSION_STRING = _try_json_readversion(VERSION_INFO_FILE) or _try_json_readversion(
    PACKAGE_JSON_FILE
)

VERSION_SHA_LENGTH = 8
VERSION_SHA = _try_json_readsha(VERSION_INFO_FILE, VERSION_SHA_LENGTH)

# 构建号会在 About 部分显示（如果可用）。
# 这可以在构建时替换以显示构建信息。
BUILD_NUMBER = None

# 在图表浏览器和 SQL Lab 探索中使用的默认可视化类型
DEFAULT_VIZ_TYPE = "table"

# 请求图表数据时的默认行数限制
ROW_LIMIT = 50000
# 在探索视图中从数据源请求样本时的默认行数限制
SAMPLES_ROW_LIMIT = 1000
# 原生过滤器的默认行数限制
NATIVE_FILTER_DEFAULT_ROW_LIMIT = 1000
# 过滤器选择自动完成检索的最大行数
FILTER_SELECT_ROW_LIMIT = 10000
# 探索中的默认时间过滤器
# 值可以是 "Last day"（最近一天）, "Last week"（最近一周）, "<ISO date> : now"（从某个日期到现在）等
DEFAULT_TIME_FILTER = NO_TIME_RANGE

# 这是一个重要的设置，应该低于你的负载均衡器/代理服务器的超时设置
# [load balancer / proxy / envoy / kong / ...]
# 你还应该确保配置你的 WSGI 服务器
# (gunicorn, nginx, apache, ...) 的超时设置小于或等于这个值
SUPERSET_WEBSERVER_TIMEOUT = int(timedelta(minutes=1).total_seconds())

# 这两个设置用于仪表盘周期性强制刷新功能
# 当用户选择的自动强制刷新频率
# < SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT
# 他们将在刷新间隔模态框中看到警告消息
# 详情请查看 PR #9886
SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT = 0
SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE = None

SUPERSET_DASHBOARD_POSITION_DATA_LIMIT = 65535
# CUSTOM_SECURITY_MANAGER = None
SQLALCHEMY_TRACK_MODIFICATIONS = False
# ---------------------------------------------------------

# 你的应用程序密钥。确保在 superset_config.py 中覆盖它
# 或使用 `SUPERSET_SECRET_KEY` 环境变量。
# 使用强大的复杂字母数字字符串，并使用工具帮助你生成
# 足够随机的序列，例如：openssl rand -base64 42"
SECRET_KEY = os.environ.get("SUPERSET_SECRET_KEY") or CHANGE_ME_SECRET_KEY

# SQLAlchemy 连接字符串
SQLALCHEMY_DATABASE_URI = (
    f"""sqlite:///{os.path.join(DATA_DIR, "superset.db")}?check_same_thread=false"""
)

# MySQL 示例连接字符串
# SQLALCHEMY_DATABASE_URI = 'mysql://myapp@localhost/myapp'
# PostgreSQL 示例连接字符串
# SQLALCHEMY_DATABASE_URI = 'postgresql://root:password@localhost/myapp'

# 此配置通过 flask-sqlalchemy 暴露，可用于设置你的元数据
# 数据库连接设置。你可以使用它来设置特定于你正在使用的
# 数据库引擎的任意连接设置。
# 注意：你可以使用它来设置数据库的隔离级别，例如：
# `SQLALCHEMY_ENGINE_OPTIONS = {"isolation_level": "READ COMMITTED"}`
# 另外请注意，我们建议在常规操作中使用 READ COMMITTED。
# 在这里了解更多 https://flask-sqlalchemy.palletsprojects.com/en/3.1.x/config/
SQLALCHEMY_ENGINE_OPTIONS = {}

# 要为所有 SQLALCHEMY 连接设置自定义密码存储，
# 实现一个接受类型为 'sqla.engine.url' 的单个参数的函数，
# 返回密码并设置 SQLALCHEMY_CUSTOM_PASSWORD_STORE。
#
# 例如：
# def lookup_password(url):
#     return 'secret'
# SQLALCHEMY_CUSTOM_PASSWORD_STORE = lookup_password
SQLALCHEMY_CUSTOM_PASSWORD_STORE = None

#
# EncryptedFieldTypeAdapter 用于在构建包含敏感字段的 SqlAlchemy 模型时，
# 这些字段在发送到数据库之前需要进行应用级加密。
#
# 注意：默认实现利用 SqlAlchemyUtils 的 EncryptedType，它默认
# 使用 AesEngine，该引擎在底层使用 AES-128，并使用应用程序的 SECRET_KEY
# 作为密钥材料。请注意，AesEngine 允许对加密字段进行查询。
#
# 要更改默认引擎，你需要定义自己的适配器：
#
# 例如：
#
# class AesGcmEncryptedAdapter(
#     AbstractEncryptedFieldAdapter
# ):
#     def create(
#         self,
#         app_config: Optional[Dict[str, Any]],
#         *args: List[Any],
#         **kwargs: Optional[Dict[str, Any]],
#     ) -> TypeDecorator:
#         if app_config:
#             return EncryptedType(
#                 *args, app_config["SECRET_KEY"], engine=AesGcmEngine, **kwargs
#             )
#         raise Exception("Missing app_config kwarg")
#
#
#  SQLALCHEMY_ENCRYPTED_FIELD_TYPE_ADAPTER = AesGcmEncryptedAdapter
SQLALCHEMY_ENCRYPTED_FIELD_TYPE_ADAPTER = (  # pylint: disable=invalid-name
    SQLAlchemyUtilsAdapter
)

# 使用额外的方言扩展默认的 SQLGlot 方言
SQLGLOT_DIALECTS_EXTENSIONS: DialectExtensions | Callable[[], DialectExtensions] = {}

# 查询搜索获取的查询限制数
QUERY_SEARCH_LIMIT = 1000

# Flask-WTF 的 CSRF 保护标志
WTF_CSRF_ENABLED = True

# 添加需要豁免 CSRF 保护的端点
WTF_CSRF_EXEMPT_LIST = [
    "superset.views.core.log",
    "superset.views.core.explore_json",
    "superset.charts.data.api.data",
    "superset.dashboards.api.cache_dashboard_screenshot",
]

# 是否在调试模式下运行 Web 服务器
DEBUG = parse_boolean_string(os.environ.get("FLASK_DEBUG"))
FLASK_USE_RELOAD = True

# 启用 Python 调用分析。开启此功能并在页面 URL 后附加 ``?_instrument=1``
# 以查看调用堆栈。
PROFILING = False

# Superset 允许将服务器端 Python 堆栈跟踪显示给用户
# 当此功能开启时。这可能会有安全隐患，
# 在生产环境中建议关闭此功能以提高安全性。
SHOW_STACKTRACE = False

# 当 ENABLE_PROXY_FIX 为 True 时使用所有 X-Forwarded 头部。
# 当代理到不同端口时，将 "x_port" 设置为 0 以避免下游问题。
ENABLE_PROXY_FIX = False
PROXY_FIX_CONFIG = {"x_for": 1, "x_proto": 1, "x_host": 1, "x_port": 1, "x_prefix": 1}

# SQL Lab 查询调度的配置。
SCHEDULED_QUERIES: dict[str, Any] = {}

# FAB 速率限制：这是一个用于防止 DDOS 攻击的安全功能。
# 该功能默认开启以确保 Superset 的安全性，但你应该
# 根据需要调整限制。你可以在这里了解更多关于不同参数的信息：
# https://flask-limiter.readthedocs.io/en/stable/configuration.html
RATELIMIT_ENABLED = os.environ.get("SUPERSET_ENV") == "production"
RATELIMIT_APPLICATION = "50 per second"  # 每秒 50 次
AUTH_RATE_LIMITED = True
AUTH_RATE_LIMIT = "5 per second"  # 每秒 5 次
# 符合存储方案的存储位置。查看 limits 库了解允许的值：
# https://limits.readthedocs.io/en/stable/storage.html
# RATELIMIT_STORAGE_URI = "redis://host:port"
# 返回当前请求唯一标识的可调用对象。
# RATELIMIT_REQUEST_IDENTIFIER = flask.Request.endpoint

# ------------------------------
# 应用程序构建器全局设置
# ------------------------------
# 取消注释以设置你的应用程序名称
APP_NAME = "Superset"

# 指定应用程序图标
APP_ICON = "/static/assets/images/superset-logo-horiz.png"

# 指定点击 logo 后将用户带到哪里
# 默认值 None 将带你到 '/superset/welcome'
# 你也可以指定相对 URL，例如 '/superset/welcome' 或 '/dashboards/list'
# 或者指定完整的 URL，例如 'https://foo.bar'
LOGO_TARGET_PATH = None

# 指定鼠标悬停在应用程序图标/Logo 上时显示的工具提示
LOGO_TOOLTIP = ""

# 指定应该出现在 logo 右侧的任何文本
LOGO_RIGHT_TEXT: Callable[[], str] | str = ""

# 为 superset openapi 规范启用 SWAGGER UI
# 例如：http://localhost:8080/swagger/v1
FAB_API_SWAGGER_UI = True

# ----------------------------------------------------
# 认证配置
# ----------------------------------------------------
# 认证类型
# AUTH_OID：用于 OpenID
# AUTH_DB：用于数据库（用户名/密码）
# AUTH_LDAP：用于 LDAP
# AUTH_REMOTE_USER：用于使用来自 web 服务器的 REMOTE_USER
AUTH_TYPE = AUTH_DB

# 取消注释以设置完整的管理员角色名称
# AUTH_ROLE_ADMIN = 'Admin'

# 取消注释以设置公共角色名称，无需认证
# AUTH_ROLE_PUBLIC = 'Public'

# 是否允许用户自行注册
# AUTH_USER_REGISTRATION = True

# 用户自行注册时的默认角色
# AUTH_USER_REGISTRATION_ROLE = "Public"

# 使用 LDAP 认证时，设置 LDAP 服务器
# AUTH_LDAP_SERVER = "ldap://ldapserver.new"

# 取消注释以设置 OpenID 认证的提供者示例
# OPENID_PROVIDERS = [
#    { 'name': 'Yahoo', 'url': 'https://open.login.yahoo.com/' },
#    { 'name': 'Flickr', 'url': 'https://www.flickr.com/<username>' },
# ]
# ---------------------------------------------------
# 角色配置
# ---------------------------------------------------
# 授予公共角色与选定的内置角色相同的权限集。
# 如果想要允许匿名用户查看仪表盘，这很有用。
# 仍然需要对特定数据集进行显式授权。
PUBLIC_ROLE_LIKE: str | None = None

# ---------------------------------------------------
# Babel 翻译配置
# ---------------------------------------------------
# 设置默认语言
BABEL_DEFAULT_LOCALE = "zh"
# 应用程序默认翻译路径
BABEL_DEFAULT_FOLDER = "superset/translations"
# 应用程序允许的翻译语言
LANGUAGES = {
    "en": {"flag": "us", "name": "英语"},
    "es": {"flag": "es", "name": "西班牙语"},
    "it": {"flag": "it", "name": "意大利语"},
    "fr": {"flag": "fr", "name": "法语"},
    "zh": {"flag": "cn", "name": "中文"},
    "zh_TW": {"flag": "tw", "name": "繁体中文"},
    "ja": {"flag": "jp", "name": "日语"},
    "de": {"flag": "de", "name": "德语"},
    "pl": {"flag": "pl", "name": "波兰语"},
    "pt": {"flag": "pt", "name": "葡萄牙语"},
    "pt_BR": {"flag": "br", "name": "巴西葡萄牙语"},
    "ru": {"flag": "ru", "name": "俄语"},
    "ko": {"flag": "kr", "name": "韩语"},
    "sk": {"flag": "sk", "name": "斯洛伐克语"},
    "sl": {"flag": "si", "name": "斯洛文尼亚语"},
    "nl": {"flag": "nl", "name": "荷兰语"},
    "uk": {"flag": "uk", "name": "乌克兰语"},
}
# 默认关闭 i18n，因为大多数语言的翻译
# 都不完整且维护不善。
LANGUAGES = {}


# 覆盖默认的 d3 区域格式
# 默认值等同于
# D3_FORMAT = {
#     "decimal": ".",           # - 小数点字符串（例如，"."）
#     "thousands": ",",         # - 千位分隔符字符串（例如，","）
#     "grouping": [3],          # - 分组大小数组（例如，[3]），根据需要循环使用
#     "currency": ["$", ""]     # - 货币前缀/后缀字符串（例如，["$", ""]）
# }
# https://github.com/d3/d3-format/blob/main/README.md#formatLocale
class D3Format(TypedDict, total=False):
    decimal: str
    thousands: str
    grouping: list[int]
    currency: list[str]


D3_FORMAT: D3Format = {}


# 覆盖默认的 d3 时间格式
# 默认值等同于
# D3_TIME_FORMAT = {
#     "dateTime": "%x, %X",          # 日期时间格式
#     "date": "%-m/%-d/%Y",         # 日期格式
#     "time": "%-I:%M:%S %p",       # 时间格式
#     "periods": ["AM", "PM"],      # 上午/下午
#     "days": ["星期日", "星期一", "星期二", "星期三",
#              "星期四", "星期五", "星期六"],
#     "shortDays": ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
#     "months": ["一月", "二月", "三月", "四月",
#                "五月", "六月", "七月", "八月",
#                "九月", "十月", "十一月", "十二月"],
#     "shortMonths": ["1月", "2月", "3月", "4月",
#                     "5月", "6月", "7月", "8月",
#                     "9月", "10月", "11月", "12月"]
# }
# https://github.com/d3/d3-time-format/tree/main#locales
class D3TimeFormat(TypedDict, total=False):
    date: str
    dateTime: str
    time: str
    periods: list[str]
    days: list[str]
    shortDays: list[str]
    months: list[str]
    shortMonths: list[str]


D3_TIME_FORMAT: D3TimeFormat = {}

# 支持的货币类型
CURRENCIES = [
    "USD",
    "EUR",
    "GBP",
    "INR",
    "MXN",
    "JPY",
    "CNY",
]  # 美元、欧元、英镑、印度卢比、墨西哥比索、日元、人民币

# ---------------------------------------------------
# Feature flags
# ---------------------------------------------------
# 这里设置默认的功能标记。这些值可以被
# superset_config.py 中的 FEATURE_FLAGS 配置覆盖
# 例如，这里设置 DEFAULT_FEATURE_FLAGS = { 'FOO': True, 'BAR': False }
# 而在 superset_config.py 中设置 FEATURE_FLAGS = { 'BAR': True, 'BAZ': True }
# 最终合并后的功能标记将是 { 'FOO': True, 'BAR': True, 'BAZ': True }
DEFAULT_FEATURE_FLAGS: dict[str, bool] = {
    # 当使用支持 JOIN 操作的较新版本 Druid 时启用此项
    "DRUID_JOINS": False,
    "DYNAMIC_PLUGINS": False,
    "ENABLE_TEMPLATE_PROCESSING": False,
    # 允许使用 JavaScript 控件组件
    # 这使程序员可以通过在控件中输入 JavaScript 来自定义某些图表（如地理空间图表）。
    # 这会带来 XSS 安全漏洞风险
    "ENABLE_JAVASCRIPT_CONTROLS": False,  # 已弃用
    # 启用此功能后，Presto 中的嵌套类型将被
    # 展开为额外的列和/或数组。这是实验性功能，
    # 并不是对所有嵌套类型都有效。
    "PRESTO_EXPAND_DATA": False,
    # 暴露用于计算缩略图的 API 端点
    "THUMBNAILS": False,
    # 启用通过 webdriver 缓存和检索仪表盘截图的端点。
    # 需要配置 Celery 和使用 THUMBNAIL_CACHE_CONFIG 的缓存。
    "ENABLE_DASHBOARD_SCREENSHOT_ENDPOINTS": False,
    # 使用 web driver 生成仪表盘的截图（PDF 或 JPG）。
    # 禁用时，截图由浏览器即时生成。
    # 此功能标记用于仪表盘视图中的下载功能。
    # 它依赖于启用 ENABLE_DASHBOARD_SCREENSHOT_ENDPOINT。
    "ENABLE_DASHBOARD_DOWNLOAD_WEBDRIVER_SCREENSHOT": False,
    "TAGGING_SYSTEM": False,
    "SQLLAB_BACKEND_PERSISTENCE": True,
    "LISTVIEWS_DEFAULT_CARD_VIEW": False,
    # 为 True 时，在 Markdown 组件中转义 HTML（而不是渲染它）
    "ESCAPE_MARKDOWN_HTML": False,
    "DASHBOARD_VIRTUALIZATION": True,
    # 此功能标记仍处于测试阶段，不建议在生产环境中使用。
    "GLOBAL_ASYNC_QUERIES": False,
    "EMBEDDED_SUPERSET": False,
    # 启用警报和报告的新实现
    "ALERT_REPORTS": False,
    "ALERT_REPORT_TABS": False,
    "ALERT_REPORT_SLACK_V2": False,
    "DASHBOARD_RBAC": False,
    "ENABLE_ADVANCED_DATA_TYPES": False,
    # 启用 ALERTS_ATTACH_REPORTS 时，系统会发送带有截图和链接的
    # 电子邮件和 Slack 消息
    # 禁用 ALERTS_ATTACH_REPORTS 时，对于 'alert' 类型的报告，系统不会生成截图，
    # 只发送带有链接的电子邮件和 Slack 消息；
    # 对于 'report' 类型的报告，仍然发送带有截图和链接的电子邮件和 Slack 消息
    "ALERTS_ATTACH_REPORTS": True,
    # 允许用户导出表格可视化类型的完整 CSV。
    # 这可能导致服务器内存不足或计算资源耗尽。
    "ALLOW_FULL_CSV_EXPORT": False,
    "ALLOW_ADHOC_SUBQUERY": False,
    "USE_ANALOGOUS_COLORS": False,
    # 将 RLS 规则应用于 SQL Lab 查询。这需要解析和操作查询，
    # 可能会破坏查询和/或允许用户绕过 RLS。请谨慎使用！
    "RLS_IN_SQLLAB": False,
    # 尝试优化SQL查询 - 目前只支持谓词下推
    "OPTIMIZE_SQL": False,
    # 当模拟用户时,使用电子邮件前缀而不是用户名
    "IMPERSONATE_WITH_EMAIL_PREFIX": False,
    # 在启用用户模拟的数据源中启用按模拟键(例如用户名)缓存
    "CACHE_IMPERSONATION": False,
    # 为Superset缓存启用按用户键缓存(不是数据库缓存模拟)
    "CACHE_QUERY_BY_USER": False,
    # 启用图表嵌入共享
    "EMBEDDABLE_CHARTS": True,
    "DRILL_TO_DETAIL": True,  # 已弃用
    "DRILL_BY": True,
    "DATAPANEL_CLOSED_BY_DEFAULT": False,
    # 此功能默认关闭,目前仅支持Presto、Postgres和Bigquery。
    # 还需要在数据库级别通过添加键值对 `cost_estimate_enabled: true` 到数据库的 `extra` 属性来启用。
    "ESTIMATE_QUERY_COST": False,
    # 允许用户在创建数据库时启用SSH隧道。
    # 用户必须检查数据库引擎是否支持SSH隧道,
    # 否则启用此标志对数据库不会有任何影响。
    "SSH_TUNNELING": False,
    "AVOID_COLORS_COLLISION": True,
    # 不在菜单中显示用户信息
    "MENU_HIDE_USER_INFO": False,
    # 允许用户添加一个可以跨数据库查询的 `superset://` 数据库。这是一个
    # 实验性功能,具有潜在的安全和性能风险,请谨慎使用。如果启用此功能,
    # 你还可以在此文件中的 `SUPERSET_META_DB_LIMIT` 配置值中设置每个数据库
    # 返回的数据限制。
    "ENABLE_SUPERSET_META_DB": False,
    # 设置为True以使用Playwright替代Selenium来执行报告和缩略图。
    # 与Selenium不同,Playwright报告支持deck.gl可视化
    # 启用此功能标志需要安装 "playwright" pip包
    "PLAYWRIGHT_REPORTS_AND_THUMBNAILS": False,
    # 设置为True以启用实验性图表插件
    "CHART_PLUGINS_EXPERIMENTAL": False,
    # 无论数据库配置设置如何,强制SQLLAB使用Celery异步运行
    "SQLLAB_FORCE_RUN_ASYNC": False,
    # 设置为True以启用工厂重置CLI命令
    "ENABLE_FACTORY_RESET_COMMAND": False,
    # Superset是否应该使用Slack头像作为用户头像。
    # 如果启用,你需要将 "https://avatars.slack-edge.com" 添加到
    # TALISMAN_CONFIG 中的允许域名列表
    "SLACK_ENABLE_AVATARS": False,
    # 允许用户在电子邮件主题中可选地指定日期格式,如果启用则将解析这些格式
    "DATE_FORMAT_IN_EMAIL_SUBJECT": False,
    # Allow metrics and columns to be grouped into (potentially nested) folders in the
    # chart builder
    "DATASET_FOLDERS": False,
}

# ------------------------------
# SSH 隧道
# ------------------------------
# 允许用户在连接到SSH隧道时将主机设置为
# localhost和任何其他别名(0.0.0.0)
# ----------------------------------------------------------------------
#                             |
# -------------+              |    +----------+
#     本地     |              |    |  远程    | :22 SSH
#     客户端   | <== SSH ========> |  服务器  | :8080 web服务
# -------------+              |    +----------+
#                             |
#                          防火墙 (仅开放22端口)

# ----------------------------------------------------------------------
SSH_TUNNEL_MANAGER_CLASS = "superset.extensions.ssh.SSHManager"
SSH_TUNNEL_LOCAL_BIND_ADDRESS = "127.0.0.1"
#: 隧道连接超时时间(秒)(open_channel超时)
SSH_TUNNEL_TIMEOUT_SEC = 10.0
#: 传输套接字超时时间(秒)(``socket.settimeout``)
SSH_TUNNEL_PACKET_TIMEOUT_SEC = 1.0


# Feature flags may also be set via 'SUPERSET_FEATURE_' prefixed environment vars.
DEFAULT_FEATURE_FLAGS.update(
    {
        k[len("SUPERSET_FEATURE_") :]: parse_boolean_string(v)
        for k, v in os.environ.items()
        if re.search(r"^SUPERSET_FEATURE_\w+", k)
    }
)

# This function can be overridden to customize the name of the user agent
# triggering the query.
USER_AGENT_FUNC: Callable[[Database, QuerySource | None], str] | None = None

# 这只是一个默认值
FEATURE_FLAGS: dict[str, bool] = {}

# 一个接收所有功能标志字典的函数
# (DEFAULT_FEATURE_FLAGS与FEATURE_FLAGS合并)
# 可以修改它并返回一个类似的字典。注意传递给函数的功能标志字典
# 是配置中字典的深拷贝,因此可以修改而不会产生副作用
#
# GET_FEATURE_FLAGS_FUNC可用于实现渐进式发布、
# 基于角色的功能或完整的A/B测试框架。
#
# from flask import g, request
# def GET_FEATURE_FLAGS_FUNC(feature_flags_dict: Dict[str, bool]) -> Dict[str, bool]:
#     if hasattr(g, "user") and g.user.is_active:
#         feature_flags_dict['some_feature'] = g.user and g.user.get_id() == 5
#     return feature_flags_dict
GET_FEATURE_FLAGS_FUNC: Callable[[dict[str, bool]], dict[str, bool]] | None = None
# 一个接收功能标志名称和可选默认值的函数。
# 与GET_FEATURE_FLAGS_FUNC有类似的功能,但在只评估单个功能标志时
# 不需要强制评估所有功能标志,这很有用。
#
# 注意,当设置配置键时,默认的`get_feature_flags`将使用此可调用对象
# 评估每个功能,因此不要同时使用GET_FEATURE_FLAGS_FUNC
# 和IS_FEATURE_ENABLED_FUNC。
IS_FEATURE_ENABLED_FUNC: Callable[[str, bool | None], bool] | None = None
# 一个扩展/覆盖前端`bootstrap_data.common`对象的函数。
# 可用于实现自定义前端功能,
# 或动态更改某些配置。
#
# `bootstrap_data.common`中的值应具有以下特征:
# - 它们不特定于用户正在访问的页面
# - 它们不包含机密信息
#
# 接收转换前的通用引导数据作为参数。
# 返回一个包含应添加或覆盖到数据中的字典。
COMMON_BOOTSTRAP_OVERRIDES_FUNC: Callable[  # noqa: E731
    [dict[str, Any]], dict[str, Any]
] = lambda data: {}

# EXTRA_CATEGORICAL_COLOR_SCHEMES用于添加自定义分类颜色方案
# "我的自定义暖到热"颜色方案示例代码
# EXTRA_CATEGORICAL_COLOR_SCHEMES = [
#     {
#         "id": 'myVisualizationColors',
#         "description": '',
#         "label": '我的可视化颜色',
#         "isDefault": True,
#         "colors":
#          ['#006699', '#009DD9', '#5AAA46', '#44AAAA', '#DDAA77', '#7799BB', '#88AA77',
#          '#552288', '#5AAA46', '#CC7788', '#EEDD55', '#9977BB', '#BBAA44', '#DDCCDD']
#     }]

# 这只是一个默认值
EXTRA_CATEGORICAL_COLOR_SCHEMES: list[dict[str, Any]] = []

# THEME_OVERRIDES用于为superset添加自定义主题
# "我的主题"自定义方案示例代码
# THEME_OVERRIDES = {
#   "borderRadius": 4,
#   "colors": {
#     "primary": {
#       "base": 'red',
#     },
#     "secondary": {
#       "base": 'green',
#     },
#     "grayscale": {
#       "base": 'orange',
#     }
#   }
# }

THEME_OVERRIDES: dict[str, Any] = {}

# EXTRA_SEQUENTIAL_COLOR_SCHEMES用于添加自定义顺序颜色方案
# EXTRA_SEQUENTIAL_COLOR_SCHEMES =  [
#     {
#         "id": 'warmToHot',
#         "description": '',
#         "isDiverging": True,
#         "label": '我的自定义暖到热',
#         "isDefault": True,
#         "colors":
#          ['#552288', '#5AAA46', '#CC7788', '#EEDD55', '#9977BB', '#BBAA44', '#DDCCDD',
#          '#006699', '#009DD9', '#5AAA46', '#44AAAA', '#DDAA77', '#7799BB', '#88AA77']
#     }]

# 这只是一个默认值
EXTRA_SEQUENTIAL_COLOR_SCHEMES: list[dict[str, Any]] = []

# 用于执行缓存预热任务的用户
# 默认情况下,使用主要所有者预热缓存。要回退到使用
# 固定用户(本例中为admin),请使用以下配置:
#
# from superset.tasks.types import ExecutorType, FixedExecutor
#
# CACHE_WARMUP_EXECUTORS = [ExecutorType.OWNER, FixedExecutor("admin")]
CACHE_WARMUP_EXECUTORS = [ExecutorType.OWNER]

# ---------------------------------------------------
# 缩略图配置(在功能标志后面)
# ---------------------------------------------------
# 默认情况下,缩略图按用户渲染,对于匿名用户将回退到Selenium
# 用户。与警报和报告类似,缩略图
# 可以配置为始终以固定用户身份渲染。请参阅
# `superset.tasks.types.ExecutorType`获取执行器选项的完整列表。
# 要始终使用固定用户账户(本例中为admin),请使用以下
# 配置:
#
# from superset.tasks.types import ExecutorType, FixedExecutor
#
# THUMBNAIL_EXECUTORS = [FixedExecutor("admin")]
THUMBNAIL_EXECUTORS = [ExecutorType.CURRENT_USER]

# 默认情况下,缩略图摘要是根据图表/仪表板元数据中的各种参数计算的,
# 对于用户特定的缩略图,还包括用户名。要指定自定义摘要函数,
# 请使用以下配置参数定义接收以下内容的回调:
# 1. 模型(仪表板或图表)
# 2. 执行器类型(例如 ExecutorType.FIXED_USER)
# 3. 执行器的用户名(注意,这是由`THUMBNAIL_EXECUTORS`定义的执行器;
#    只有当执行器类型等于`ExecutorType.CURRENT_USER`时,
#    执行器才等于当前登录的用户)
# 并返回最终的摘要字符串:
THUMBNAIL_DASHBOARD_DIGEST_FUNC: (
    Callable[[Dashboard, ExecutorType, str], str | None] | None
) = None
THUMBNAIL_CHART_DIGEST_FUNC: Callable[[Slice, ExecutorType, str], str | None] | None = (
    None
)

THUMBNAIL_CACHE_CONFIG: CacheConfig = {
    "CACHE_TYPE": "NullCache",
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=7).total_seconds()),
    "CACHE_NO_NULL_WARNING": True,
}
THUMBNAIL_ERROR_CACHE_TTL = int(timedelta(days=1).total_seconds())

# Selenium在尝试定位页面元素并等待该元素加载以进行截图时的超时时间
SCREENSHOT_LOCATE_WAIT = int(timedelta(seconds=10).total_seconds())
# Selenium在等待所有名为"loading"的DOM类元素消失后的超时时间
SCREENSHOT_LOAD_WAIT = int(timedelta(minutes=1).total_seconds())
# Selenium销毁重试次数
SCREENSHOT_SELENIUM_RETRIES = 5
# 给Selenium一个提前启动时间,以秒为单位
SCREENSHOT_SELENIUM_HEADSTART = 3
# 等待图表动画的时间,以秒为单位
SCREENSHOT_SELENIUM_ANIMATION_WAIT = 5
# 在截图中用真实错误消息替换意外错误
SCREENSHOT_REPLACE_UNEXPECTED_ERRORS = False
# 等待错误消息模态框显示的最长时间,以秒为单位
SCREENSHOT_WAIT_FOR_ERROR_MODAL_VISIBLE = 5
# 等待错误消息模态框关闭的最长时间,以秒为单位
SCREENSHOT_WAIT_FOR_ERROR_MODAL_INVISIBLE = 5
# Playwright在加载新页面时等待的事件
# 可能的值: "load", "commit", "domcontentloaded", "networkidle"
# 文档: https://playwright.dev/python/docs/api/class-page#page-goto-option-wait-until
SCREENSHOT_PLAYWRIGHT_WAIT_EVENT = "load"
# Playwright浏览器上下文的所有操作的默认超时时间
SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT = int(
    timedelta(seconds=30).total_seconds() * 1000
)

# ---------------------------------------------------
# 图像和文件配置
# ---------------------------------------------------
# 使用带文件的模型时的文件上传文件夹
UPLOAD_FOLDER = BASE_DIR + "/static/uploads/"
UPLOAD_CHUNK_SIZE = 4096

# ---------------------------------------------------
# 缓存配置
# ---------------------------------------------------
# 默认缓存超时时间,适用于所有缓存后端,除非在各个缓存配置中特别覆盖
CACHE_DEFAULT_TIMEOUT = int(timedelta(days=1).total_seconds())

# Superset对象的默认缓存
CACHE_CONFIG: CacheConfig = {"CACHE_TYPE": "NullCache"}

# 数据源元数据和查询结果的缓存
DATA_CACHE_CONFIG: CacheConfig = {"CACHE_TYPE": "NullCache"}

# 仪表板过滤器状态的缓存。`CACHE_TYPE`默认为`SupersetMetastoreCache`,
# 它将值存储在Superset元存储的键值表中,这是Superset正常运行所必需的,
# 但可以被任何`Flask-Caching`后端替换。
FILTER_STATE_CACHE_CONFIG: CacheConfig = {
    "CACHE_TYPE": "SupersetMetastoreCache",
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=90).total_seconds()),
    # 检索缓存值时是否重置超时时间?
    "REFRESH_TIMEOUT_ON_RETRIEVAL": True,
    # 以下参数仅适用于`MetastoreCache`:
    # 条目应如何序列化/反序列化?
    "CODEC": JsonKeyValueCodec(),
}

# 探索表单数据状态的缓存。`CACHE_TYPE`默认为`SupersetMetastoreCache`,
# 它将值存储在Superset元存储的键值表中,这是Superset正常运行所必需的,
# 但可以被任何`Flask-Caching`后端替换。
EXPLORE_FORM_DATA_CACHE_CONFIG: CacheConfig = {
    "CACHE_TYPE": "SupersetMetastoreCache",
    "CACHE_DEFAULT_TIMEOUT": int(timedelta(days=7).total_seconds()),
    # 检索缓存值时是否重置超时时间?
    "REFRESH_TIMEOUT_ON_RETRIEVAL": True,
    # 以下参数仅适用于`MetastoreCache`:
    # 条目应如何序列化/反序列化?
    "CODEC": JsonKeyValueCodec(),
}

# 通过数据源UID(通过CacheKey)存储缓存键,用于自定义处理/失效
STORE_CACHE_KEYS_IN_METADATA_DB = False

# CORS选项
# 注意: 启用此功能需要安装CORS相关的Python依赖
# `pip install .[cors]`或`pip install apache_superset[cors]`
ENABLE_CORS = False
CORS_OPTIONS: dict[Any, Any] = {}

# 对Markdown中使用的HTML内容进行清理,以确保安全渲染。
# 出于安全原因,不建议禁用此选项。如果你希望允许
# 默认清理模式中未包含的有效安全元素,请使用
# HTML_SANITIZATION_SCHEMA_EXTENSIONS配置。
HTML_SANITIZATION = True

# Use this configuration to extend the HTML sanitization schema.
# By default we use the GitHub schema defined in
# https://github.com/syntax-tree/hast-util-sanitize/blob/main/lib/schema.js
# For example, the following configuration would allow the rendering of the
# style attribute for div elements and the ftp protocol in hrefs:
# HTML_SANITIZATION_SCHEMA_EXTENSIONS = {
#   "attributes": {
#     "div": ["style"],
#   },
#   "protocols": {
#     "href": ["ftp"],
#   }
# }
# Be careful when extending the default schema to avoid XSS attacks.
HTML_SANITIZATION_SCHEMA_EXTENSIONS: dict[str, Any] = {}

# Chrome allows up to 6 open connections per domain at a time. When there are more
# than 6 slices in dashboard, a lot of time fetch requests are queued up and wait for
# next available socket. PR #5039 added domain sharding for Superset,
# and this feature can be enabled by configuration only (by default Superset
# doesn't allow cross-domain request). This feature is deprecated, annd will be removed
# in the next major version of Superset, as enabling HTTP2 will serve the same goals.
SUPERSET_WEBSERVER_DOMAINS = None  # deprecated

# Allowed format types for upload on Database view
EXCEL_EXTENSIONS = {"xlsx", "xls"}
CSV_EXTENSIONS = {"csv", "tsv", "txt"}
COLUMNAR_EXTENSIONS = {"parquet", "zip"}
ALLOWED_EXTENSIONS = {*EXCEL_EXTENSIONS, *CSV_EXTENSIONS, *COLUMNAR_EXTENSIONS}

# CSV选项: 将作为参数传递给DataFrame.to_csv方法的键值对。
# 注意: 不应覆盖index选项
CSV_EXPORT = {"encoding": "utf-8"}

# Excel选项: 将作为参数传递给DataFrame.to_excel方法的键值对。
# 注意: 不应覆盖index选项
EXCEL_EXPORT: dict[str, Any] = {}

# ---------------------------------------------------
# 时间粒度配置
# ---------------------------------------------------
# 要在应用程序中禁用的时间粒度列表(参见
# superset/db_engine_specs/base.py中的内置时间粒度)。
# 例如: 要禁用1秒时间粒度:
# TIME_GRAIN_DENYLIST = ['PT1S']
TIME_GRAIN_DENYLIST: list[str] = []

# 使用与superset/db_engine_specs/base.py中类似的定义
# 来支持额外的时间粒度。
# 例如: 添加一个新的2秒时间粒度:
# TIME_GRAIN_ADDONS = {'PT2S': '2 second'}
TIME_GRAIN_ADDONS: dict[str, str] = {}

# 每个引擎的额外时间粒度实现。
# 要截断的列在表达式中用`{col}`表示。
# 例如: 在clickhouse引擎上实现2秒时间粒度:
# TIME_GRAIN_ADDON_EXPRESSIONS = {
#     'clickhouse': {
#         'PT2S': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 2)*2)'
#     }
# }
TIME_GRAIN_ADDON_EXPRESSIONS: dict[str, dict[str, str]] = {}

# 自定义时间粒度和人工连接列生成器的映射,用于
# 在结果和时间偏移之间生成连接键。
# 参见 superset/common/query_context_processor.get_aggregated_join_column
#
# 按财年聚合的连接列生成器示例
# def join_producer(row: Series, column_index: int) -> str:
#    return row[index].strftime("%F")
#
# TIME_GRAIN_JOIN_COLUMN_PRODUCERS = {"P1F": join_producer}
TIME_GRAIN_JOIN_COLUMN_PRODUCERS: dict[str, Callable[[Series, int], str]] = {}

# ---------------------------------------------------
# 在你的环境中不允许使用的可视化类型列表
# 例如: 禁用数据透视表和树形图:
#  VIZ_TYPE_DENYLIST = ['pivot_table', 'treemap']
# ---------------------------------------------------

VIZ_TYPE_DENYLIST: list[str] = []

# --------------------------------------------------
# 要注册的模块、数据源和中间件
# --------------------------------------------------
DEFAULT_MODULE_DS_MAP = OrderedDict(
    [
        ("superset.connectors.sqla.models", ["SqlaTable"]),
    ]
)
ADDITIONAL_MODULE_DS_MAP: dict[str, list[str]] = {}
ADDITIONAL_MIDDLEWARE: list[Callable[..., Any]] = []

# 1) https://docs.python-guide.org/writing/logging/
# 2) https://docs.python.org/2/library/logging.config.html

# 默认配置器将使用下面的LOG_*设置
LOGGING_CONFIGURATOR = DefaultLoggingConfigurator()

# 控制台日志设置

LOG_FORMAT = "%(asctime)s:%(levelname)s:%(name)s:%(message)s"
LOG_LEVEL = logging.DEBUG if DEBUG else logging.INFO

# ---------------------------------------------------
# 启用时间轮转日志处理器
# ---------------------------------------------------
# LOG_LEVEL = DEBUG, INFO, WARNING, ERROR, CRITICAL

ENABLE_TIME_ROTATE = False
TIME_ROTATE_LOG_LEVEL = logging.DEBUG if DEBUG else logging.INFO
FILENAME = os.path.join(DATA_DIR, "superset.log")
ROLLOVER = "midnight"
INTERVAL = 1
BACKUP_COUNT = 30

# 用于审计查询的自定义日志记录器。这可以用来将运行的查询发送到
# 结构化的不可变存储以进行审计。该函数会在SQL Lab和图表/仪表板中
# 的每个查询运行时被调用。
# def QUERY_LOGGER(
#     database,
#     query,
#     schema=None,
#     client=None,
#     security_manager=None,
#     log_params=None,
# ):
#     pass
QUERY_LOGGER = None

# 设置此 API 密钥以启用 Mapbox 可视化
MAPBOX_API_KEY = os.environ.get("MAPBOX_API_KEY", "")

# 任何分析数据库查询返回的最大行数
SQL_MAX_ROW = 100000

# SQL Lab UI 中显示的最大行数
# 设置此值是为了避免浏览器中的内存/本地存储问题。不影响导出的 CSV
DISPLAY_MAX_ROW = 10000

# SQL Lab 查询的默认行数限制。可以在 SQL Lab UI 中设置新的限制来覆盖
DEFAULT_SQLLAB_LIMIT = 1000

# 当功能标记 ENABLE_SUPERSET_META_DB 开启时，Superset Meta DB 的限制
SUPERSET_META_DB_LIMIT: int | None = 1000

# 在 sqllab 保存查询和调度查询模态框中添加警告消息
SQLLAB_SAVE_WARNING_MESSAGE = None
SQLLAB_SCHEDULE_WARNING_MESSAGE = None

# SQL Lab 的最大有效负载大小(MB)，用于防止大结果导致浏览器挂起
SQLLAB_PAYLOAD_MAX_MB = None

# 仪表盘自动刷新时强制刷新
DASHBOARD_AUTO_REFRESH_MODE: Literal["fetch", "force"] = "force"
# 仪表盘自动刷新间隔
DASHBOARD_AUTO_REFRESH_INTERVALS = [
    [0, "不刷新"],
    [10, "10 秒"],
    [30, "30 秒"],
    [60, "1 分钟"],
    [300, "5 分钟"],
    [1800, "30 分钟"],
    [3600, "1 小时"],
    [21600, "6 小时"],
    [43200, "12 小时"],
    [86400, "24 小时"],
]

# 这用作警报和报告调度器任务的解决方案，以获取 celery beat 触发它的时间
# 详见 https://github.com/celery/celery/issues/6974
CELERY_BEAT_SCHEDULER_EXPIRES = timedelta(weeks=1)

# 默认的 celery 配置使用 SQLA 作为代理，在生产环境中
# 你需要使用适当的代理，如这里指定的:
# https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/index.html


class CeleryConfig:  # pylint: disable=too-few-public-methods
    broker_url = "sqla+sqlite:///celerydb.sqlite"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
        "superset.tasks.thumbnails",
        "superset.tasks.cache",
        "superset.tasks.slack",
    )
    result_backend = "db+sqlite:///celery_results.sqlite"
    worker_prefetch_multiplier = 1
    task_acks_late = False
    task_annotations = {
        "sql_lab.get_sql_results": {
            "rate_limit": "100/s",
        },
    }
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
            "options": {"expires": int(CELERY_BEAT_SCHEDULER_EXPIRES.total_seconds())},
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=0, hour=0),
        },
        # 取消注释以启用查询表的清理
        # "prune_query": {
        #     "task": "prune_query",
        #     "schedule": crontab(minute=0, hour=0, day_of_month=1),
        #     "kwargs": {"retention_period_days": 180},
        # },
        # 取消注释以启用日志表的清理
        # "prune_logs": {
        #     "task": "prune_logs",
        #     "schedule": crontab(minute="*", hour="*"),
        #     "kwargs": {"retention_period_days": 180},
        # },
        # 取消注释以启用 Slack 频道缓存预热
        # "slack.cache_channels": {
        #     "task": "slack.cache_channels",
        #     "schedule": crontab(minute="0", hour="*"),
        # },
    }


CELERY_CONFIG: type[CeleryConfig] = CeleryConfig

# 将 celery 配置设置为 None 以禁用上述所有配置
# CELERY_CONFIG = None

# Superset 服务器要提供的额外静态 HTTP 头。注意
# Flask-Talisman 会应用相关的安全 HTTP 头。
#
# DEFAULT_HTTP_HEADERS: 设置 HTTP 头的默认值。这些值可以在应用程序中被覆盖
# OVERRIDE_HTTP_HEADERS: 设置 HTTP 头的覆盖值。这些值将覆盖应用程序中设置的任何值
DEFAULT_HTTP_HEADERS: dict[str, Any] = {}
OVERRIDE_HTTP_HEADERS: dict[str, Any] = {}
HTTP_HEADERS: dict[str, Any] = {}

# 此处的数据库 ID 将作为 SQL Lab 中的默认选择
DEFAULT_DB_ID = None

# SQL Lab 同步查询的超时时长
SQLLAB_TIMEOUT = int(timedelta(seconds=30).total_seconds())

# SQL Lab 查询验证的超时时长
SQLLAB_VALIDATION_TIMEOUT = int(timedelta(seconds=10).total_seconds())

# SQL Lab 默认数据库 ID
SQLLAB_DEFAULT_DBID = None

# 查询在被 celery 终止之前可以运行的最大时长
SQLLAB_ASYNC_TIME_LIMIT_SEC = int(timedelta(hours=6).total_seconds())

# 一些数据库支持运行 EXPLAIN 查询，允许用户在运行查询之前
# 估算查询成本。这些 EXPLAIN 查询应该有一个较小的超时时长
SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT = int(timedelta(seconds=10).total_seconds())

# SQL Lab 通过 resultsKey 获取查询结果的超时时长
# 0 表示无超时限制
SQLLAB_QUERY_RESULT_TIMEOUT = 0

# 数据库返回的成本是一个相对值；为了将成本映射到一个具体的值，
# 你需要定义一个自定义格式化器，该格式化器会考虑你的特定基础设施。
# 例如，你可以通过对查询运行 EXPLAIN 来进行事后分析，
# 并计算相对成本的直方图以将成本表示为百分位数。这一步是可选的，
# 因为每个数据库引擎规范都有自己的查询成本格式化器，
# 但如果你想自定义它，可以在配置中定义：  # noqa: E501

# def postgres_query_cost_formatter(
#     result: List[Dict[str, Any]]
# ) -> List[Dict[str, str]]:
#     # 25, 50, 75% percentiles
#     percentile_costs = [100.0, 1000.0, 10000.0]
#
#     out = []
#     for row in result:
#         relative_cost = row["Total cost"]
#         percentile = bisect.bisect_left(percentile_costs, relative_cost) + 1
#         out.append({
#             "Relative cost": relative_cost,
#             "Percentile": str(percentile * 25) + "%",
#         })
#
#     return out
#
# QUERY_COST_FORMATTERS_BY_ENGINE: {"postgresql": postgres_query_cost_formatter}
QUERY_COST_FORMATTERS_BY_ENGINE: dict[
    str, Callable[[list[dict[str, Any]]], list[dict[str, Any]]]
] = {}

# 控制是否应该在 CTA（create table as 查询）上强制执行限制的标志。
SQLLAB_CTAS_NO_LIMIT = False

# 这允许你为 SQL Lab 中的"CREATE TABLE AS"或 CTAS 功能定义自定义逻辑，
# 该逻辑定义了给定用户的目标 schema 应该在哪里。
# 数据库的`CTAS Schema`设置优先于此设置。
# 下面的示例返回用户名，CTA 查询将把表写入到名为`username`的 schema 中
# SQLLAB_CTAS_SCHEMA_NAME_FUNC = lambda database, user, schema, sql: user.username
# 这是一个更复杂的示例，根据数据库，你可以利用可用数据
# 为 CTA 查询分配 schema：
# def compute_schema_name(database: Database, user: User, schema: str, sql: str) -> str:
#     if database.name == 'mysql_payments_slave':
#         return 'tmp_superset_schema'
#     if database.name == 'presto_gold':
#         return user.username
#     if database.name == 'analytics':
#         if 'analytics' in [r.name for r in user.roles]:
#             return 'analytics_cta'
#         else:
#             return f'tmp_{schema}'
# 函数接受数据库对象、用户对象、schema 名称和将要运行的 sql。
SQLLAB_CTAS_SCHEMA_NAME_FUNC: None | (
    Callable[[Database, models.User, str, str], str]
) = None

# 如果启用，可以通过使用"Run Async"按钮/功能来存储
# SQL Lab 中长时间运行的查询结果
RESULTS_BACKEND: BaseCache | None = None

# 使用 PyArrow 和 MessagePack 进行异步查询结果序列化，
# 而不是 JSON。此功能需要社区进行额外测试才能完全采用，
# 因此提供此配置选项，以便在发现破坏性问题时可以禁用。
RESULTS_BACKEND_USE_MSGPACK = True

# 用于存储从 CSV 文件创建的外部 hive 表的 S3 存储桶。
# 例如，'companyname-superset'
CSV_TO_HIVE_UPLOAD_S3_BUCKET = None

# 上述存储桶中将包含所有外部表的目录
CSV_TO_HIVE_UPLOAD_DIRECTORY = "EXTERNAL_HIVE_TABLES/"


# 基于使用的数据库、用户和提供的 schema 动态创建上传目录的函数
def CSV_TO_HIVE_UPLOAD_DIRECTORY_FUNC(  # pylint: disable=invalid-name  # noqa: N802
    database: Database,
    user: models.User,  # pylint: disable=unused-argument
    schema: str | None,
) -> str:
    # 注意最后的空路径会强制添加一个尾部斜杠
    return os.path.join(
        CSV_TO_HIVE_UPLOAD_DIRECTORY, str(database.id), schema or "", ""
    )


# 存储从上传 CSV 创建的表的 hive 命名空间
UPLOADED_CSV_HIVE_NAMESPACE: str | None = None


# 计算 CSV 上传允许的 schema 的函数。
# 允许的 schema 将是 schemas_allowed_for_file_upload
# 数据库配置和此函数结果的并集。
def allowed_schemas_for_csv_upload(  # pylint: disable=unused-argument
    database: Database,
    user: models.User,
) -> list[str]:
    return [UPLOADED_CSV_HIVE_NAMESPACE] if UPLOADED_CSV_HIVE_NAMESPACE else []


ALLOWED_USER_CSV_SCHEMA_FUNC = allowed_schemas_for_csv_upload

# CSV 上传时应该被视为空值的值。
CSV_DEFAULT_NA_NAMES = list(STR_NA_VALUES)

# 一个字典，其中的项目会被合并到 SQL Lab 的 Jinja 上下文中。
# 现有上下文会通过此字典进行更新，这意味着现有键的值会被此字典的内容覆盖。
# 通过 JINJA_CONTEXT_ADDONS 暴露功能存在安全隐患，因为它为用户执行不受信任的代码打开了一个窗口。
# 确保暴露的对象（以及附加到这些对象的对象）是无害的很重要。
# 我们建议只暴露返回原生类型的简单/纯函数。
JINJA_CONTEXT_ADDONS: dict[str, Callable[..., Any]] = {}

# 一个宏模板处理器字典（按引擎分类），会被合并到全局模板处理器中。
# 现有的模板处理器会通过此字典进行更新，这意味着现有的键会被此字典的内容覆盖。
# 自定义插件不一定需要使用 Jinja 模板语言。
# 这允许你为每个引擎定义自定义的模板处理逻辑。
# 示例值 = `{"presto": CustomPrestoTemplateProcessor}`
CUSTOM_TEMPLATE_PROCESSORS: dict[str, type[BaseTemplateProcessor]] = {}

# 由 API / Superset 控制且不应由人工更改的角色。
ROBOT_PERMISSION_ROLES = ["Public", "Gamma", "Alpha", "Admin", "sql_lab"]

CONFIG_PATH_ENV_VAR = "SUPERSET_CONFIG_PATH"

# 如果指定了一个可调用对象，它将在应用程序启动时被调用，
# 同时传递一个 Flask 应用程序的引用。这可以用来以任何方式修改 Flask 应用程序。
# 示例：FLASK_APP_MUTATOR = lambda x: x.before_request = f
FLASK_APP_MUTATOR = None

# SMTP 服务器配置
SMTP_HOST = "localhost"
SMTP_STARTTLS = True
SMTP_SSL = False
SMTP_USER = "superset"
SMTP_PORT = 25
SMTP_PASSWORD = "superset"  # noqa: S105
SMTP_MAIL_FROM = "superset@superset.com"
# 如果为 True，则使用默认系统根 CA 证书创建一个
# 具有 ssl.Purpose.CLIENT_AUTH 的默认 SSL 上下文
SMTP_SSL_SERVER_AUTH = False
ENABLE_CHUNK_ENCODING = False

# 是否将 flask_appbuilder 包的日志级别提升到 ERROR
# 在调试 FAB 相关问题（如权限管理）时设置为 False
SILENCE_FAB = True

FAB_ADD_SECURITY_VIEWS = True
FAB_ADD_SECURITY_API = True
FAB_ADD_SECURITY_PERMISSION_VIEW = False
FAB_ADD_SECURITY_VIEW_MENU_VIEW = False
FAB_ADD_SECURITY_PERMISSION_VIEWS_VIEW = False

# 包含常见错误及其解决方案的页面链接
# 它将被附加到 sql_lab 错误的底部
TROUBLESHOOTING_LINK = ""

# CSRF 令牌超时，设置为 None 则令牌永不过期
WTF_CSRF_TIME_LIMIT = int(timedelta(weeks=1).total_seconds())

# 此链接应指向一个页面，其中包含如何获取数据源访问权限的说明
# 它将被放置在权限错误的底部
PERMISSION_INSTRUCTIONS_LINK = ""

# 通过传递外部蓝图到你的配置中来集成到应用程序中
# 这些蓝图将被集成到应用程序中
BLUEPRINTS: list[Blueprint] = []

# 提供一个可调用对象，接收一个tracking_url并返回另一个URL
# 这用于将内部Hadoop作业跟踪器URL转换为代理URL


# 转换Hive和Presto引擎的SQL查询跟踪URL。你也可以
# 通过向转换器函数添加第二个参数来访问查询本身的信息，例如：
#   TRACKING_URL_TRANSFORMER = (
#       lambda url, query: url if is_fresh(query) else None
#   )
# pylint: disable-next=unnecessary-lambda-assignment
TRACKING_URL_TRANSFORMER = lambda url: url  # noqa: E731


# 自定义每个引擎的轮询时间
DB_POLL_INTERVAL_SECONDS: dict[str, int] = {}

# 使用Presto引擎时连续轮询之间的间隔
# 参见：https://github.com/dropbox/PyHive/blob/8eb0aeab8ca300f3024655419b93dad926c1a351/pyhive/presto.py#L93  # pylint: disable=line-too-long,useless-suppression  # noqa: E501
PRESTO_POLL_INTERVAL = int(timedelta(seconds=1).total_seconds())

# 允许为每个数据库引擎设置自定义认证列表
# 示例：
# from your.module import AuthClass
# from another.extra import auth_method
#
# ALLOWED_EXTRA_AUTHENTICATIONS: Dict[str, Dict[str, Callable[..., Any]]] = {
#     "trino": {
#         "custom_auth": AuthClass,
#         "another_auth_method": auth_method,
#     },
# }
ALLOWED_EXTRA_AUTHENTICATIONS: dict[str, dict[str, Callable[..., Any]]] = {}

# 应该复制给每个新用户的模板仪表板的ID
DASHBOARD_TEMPLATE_ID = None


# 一个包装`create_engine`调用的上下文管理器。这可以用于许多
# 用途，比如使用chroot防止第三方驱动访问文件系统，或者
# 为数据库驱动设置自定义配置。
@contextmanager
def engine_context_manager(  # pylint: disable=unused-argument
    database: Database,
    catalog: str | None,
    schema: str | None,
) -> Iterator[None]:
    yield None


ENGINE_CONTEXT_MANAGER = engine_context_manager

# 一个可调用对象，允许在运行时动态修改数据库连接URL和参数。
# 这允许进行用户模拟或执行任意逻辑。例如，你可以为不同用户
# 配置不同的连接参数，或将其电子邮件地址作为用户名。
# 该函数接收连接URI对象、连接参数、用户名，并返回修改后的URI和参数对象。
# 示例：
#   def DB_CONNECTION_MUTATOR(uri, params, username, security_manager, source):
#       user = security_manager.find_user(username=username)
#       if user and user.email:
#           uri.username = user.email
#       return uri, params
#
# 注意，返回的uri和params将直接传递给sqlalchemy的
# `create_engine(url, **params)`
DB_CONNECTION_MUTATOR = None


# 一个在每次调用DB引擎规格时被调用的可调用对象
# 用于对引擎URI进行自定义验证。
# 参见：superset.db_engine_specs.base.BaseEngineSpec.validate_database_uri
# 示例：
#   def DB_ENGINE_URI_VALIDATOR(sqlalchemy_uri: URL):
#       if not <some condition>:
#           raise Exception("URI invalid")
#
DB_SQLA_URI_VALIDATOR: Callable[[URL], None] | None = None

# 每个引擎的禁用SQL函数集合。这用于限制在SQL Lab和图表中
# 使用不安全的SQL函数。字典的键是引擎名称，值是禁用函数的集合。
DISALLOWED_SQL_FUNCTIONS: dict[str, set[str]] = {
    "postgresql": {
        "database_to_xml",
        "inet_client_addr",
        "inet_server_addr",
        "query_to_xml",
        "query_to_xml_and_xmlschema",
        "table_to_xml",
        "table_to_xml_and_xmlschema",
        "version",
    },
    "clickhouse": {"url", "version", "currentDatabase", "hostName"},
    "mysql": {"version"},
}


# 一个拦截并可以修改将要执行的SQL的函数。
# 常见用例是为SQL添加一些注释头，
# 包含诸如用户名和工作节点信息等
#
#    def SQL_QUERY_MUTATOR(
#        sql,
#        security_manager=security_manager,
#        database=database,
#    ):
#        dttm = datetime.now().isoformat()
#        return f"-- [SQL LAB] {user_name} {dttm}\n{sql}"
#
# 注意：为了向后兼容，你可以在函数定义中解包上述任何参数，
# 但要保持**kwargs作为最后一个参数，以允许将来添加新参数而不会出错。
# 注意：此函数中的任何操作都不会影响缓存键，因此理想情况下，
# 这个函数应该是"函数式"的，即对于相同的输入总是产生相同的输出。
def SQL_QUERY_MUTATOR(  # pylint: disable=invalid-name,unused-argument  # noqa: N802
    sql: str, **kwargs: Any
) -> str:
    return sql


# 一个变量，用于选择是在拆分输入查询之前还是之后应用SQL_QUERY_MUTATOR  # noqa: E501
# 它允许SQL_QUERY_MUTATOR函数不仅仅用于添加注释
# 用法：如果你想对给定查询的每个语句应用更改，设置MUTATE_AFTER_SPLIT = True  # noqa: E501
# 一个用例是，如果数据有基于角色的访问控制，你想在每个用户查询旁边
# 添加一个SET ROLE语句。更改此变量可以保持SQL_Lab和图表的功能。
MUTATE_AFTER_SPLIT = False


# 布尔配置，决定是否也要对告警SQL查询进行修改。
MUTATE_ALERT_QUERY = False


# 这允许用户向任何发出的电子邮件添加头部数据。例如，
# 如果你需要在头部包含元数据，或者想要更改
# 电子邮件标题、头部或发件人的规格。
def EMAIL_HEADER_MUTATOR(  # pylint: disable=invalid-name,unused-argument  # noqa: N802
    msg: MIMEMultipart, **kwargs: Any
) -> MIMEMultipart:
    return msg


# 定义要从所有用户下拉列表中排除的用户名列表
# 包括所有者、created_by过滤器等
# 也可以通过重写security manager中的get_exclude_users_from_lists方法
# 来排除用户
EXCLUDE_USERS_FROM_LISTS: list[str] | None = None

# 对于数据库连接，如果你不希望某些数据库显示为可用，
# 这个字典将从可用列表/下拉列表中移除这些引擎。
# 可用列表是由已安装的驱动程序生成的，某些引擎有多个驱动程序。
# 例如，DBS_AVAILABLE_DENYLIST: Dict[str, Set[str]] = {"databricks": {"pyhive", "pyodbc"}}  # noqa: E501
DBS_AVAILABLE_DENYLIST: dict[str, set[str]] = {}

# 此认证提供程序用于需要访问受保护资源的后台（离线）任务。
# 最终用户可以重写它以支持自定义认证机制
MACHINE_AUTH_PROVIDER_CLASS = "superset.utils.machine_auth.MachineAuthProvider"

# ---------------------------------------------------
# 告警和报告
# ---------------------------------------------------
# 用于告警/报告（Feature flask ALERT_REPORTS）设置滑动cron窗口大小，
# 应该与celery beat配置同步并减去1秒
ALERT_REPORTS_CRON_WINDOW_SIZE = 59
ALERT_REPORTS_WORKING_TIME_OUT_KILL = True
# 尝试以哪个用户身份执行告警/报告。默认情况下，
# 以告警/报告的主要所有者身份执行（优先考虑最后的
# 修改者，然后是创建者，如果他们在所有者列表中的话，
# 否则使用第一个所有者）。
#
# 要首先尝试以所有者列表中的创建者身份执行（如果存在），然后回退
# 到创建者，然后是所有者列表中的最后修改者（如果存在），然后是
# 最后修改者，然后是所有者，最后是"admin"用户，设置如下：
#
# from superset.tasks.types import ExecutorType, FixedExecutor
#
# ALERT_REPORTS_EXECUTORS = [
#     ExecutorType.CREATOR_OWNER,
#     ExecutorType.CREATOR,
#     ExecutorType.MODIFIER_OWNER,
#     ExecutorType.MODIFIER,
#     ExecutorType.OWNER,
#     FixedExecutor("admin"),
# ]
ALERT_REPORTS_EXECUTORS: list[ExecutorType] = [ExecutorType.OWNER]
# 如果ALERT_REPORTS_WORKING_TIME_OUT_KILL为True，设置celery硬超时
# 等于工作超时 + ALERT_REPORTS_WORKING_TIME_OUT_LAG
ALERT_REPORTS_WORKING_TIME_OUT_LAG = int(timedelta(seconds=10).total_seconds())
# 如果ALERT_REPORTS_WORKING_TIME_OUT_KILL为True，设置celery硬超时
# 等于工作超时 + ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG
ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG = int(timedelta(seconds=1).total_seconds())
# 用户创建告警时使用的默认值
ALERT_REPORTS_DEFAULT_WORKING_TIMEOUT = 3600
ALERT_REPORTS_DEFAULT_RETENTION = 90
ALERT_REPORTS_DEFAULT_CRON_VALUE = "0 0 * * *"  # 每天
# 如果设置为true，不会发送通知，工作进程只会记录一条消息。
# 对调试有用
ALERT_REPORTS_NOTIFICATION_DRY_RUN = False
# 运行查询的最大尝试次数，用于防止由临时错误导致的
# 错误返回给用户。设置为>1的值以启用重试。
ALERT_REPORTS_QUERY_EXECUTION_MAX_TRIES = 1
# 截图的自定义宽度
ALERT_REPORTS_MIN_CUSTOM_SCREENSHOT_WIDTH = 600
ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH = 2400
# 设置执行之间的最小间隔阈值（对每个告警/报告）
# 值应该是整数，即 int(timedelta(minutes=5).total_seconds())
# 你也可以分配一个返回预期整数的函数给配置
ALERT_MINIMUM_INTERVAL = int(timedelta(minutes=0).total_seconds())
REPORT_MINIMUM_INTERVAL = int(timedelta(minutes=0).total_seconds())

# 用于所有告警和报告电子邮件的自定义前缀
EMAIL_REPORTS_SUBJECT_PREFIX = "[Report] "

# 告警和报告电子邮件中行动号召链接的文本
EMAIL_REPORTS_CTA = "在Superset中探索"

# Superset报告的Slack API令牌，可以是字符串或可调用对象
SLACK_API_TOKEN: Callable[[], str] | str | None = None
SLACK_PROXY = None
SLACK_CACHE_TIMEOUT = int(timedelta(days=1).total_seconds())

# 用于生成报告的webdriver。使用以下之一：
# firefox
#   要求：安装geckodriver和firefox
#   限制：有时可能会有bug
# chrome:
#   要求：headless chrome
#   限制：无法生成元素的截图
WEBDRIVER_TYPE = "firefox"

# 窗口大小 - 这将影响数据的渲染
WEBDRIVER_WINDOW = {
    "dashboard": (1600, 2000),
    "slice": (3000, 1200),
    "pixel_density": 1,
}

# 可选的覆盖默认认证钩子，用于为离线webdriver提供认证
# （当使用Selenium时）或浏览器上下文（当使用Playwright时 - 参见
# PLAYWRIGHT_REPORTS_AND_THUMBNAILS功能标志）
WEBDRIVER_AUTH_FUNC = None

# 要按原样传递给webdriver的任何配置选项
WEBDRIVER_CONFIGURATION = {
    "options": {"capabilities": {}, "preferences": {}, "binary_location": ""},
    "service": {"log_output": "/dev/null", "service_args": [], "port": 0, "env": {}},
}

# 要作为参数传递给配置对象的其他参数
# 注意：如果使用Chrome，你需要添加"--marionette"参数
WEBDRIVER_OPTION_ARGS = ["--headless"]

# 用于访问用户界面的基础URL
WEBDRIVER_BASEURL = "http://0.0.0.0:8080/"
# 电子邮件报告超链接的基础URL
WEBDRIVER_BASEURL_USER_FRIENDLY = WEBDRIVER_BASEURL
# selenium等待页面加载和渲染电子邮件报告的时间
EMAIL_PAGE_RENDER_WAIT = int(timedelta(seconds=30).total_seconds())

# 将用户发送到可以报告bug的链接
BUG_REPORT_URL = None
BUG_REPORT_TEXT = "报告bug"
BUG_REPORT_ICON = None  # 推荐大小：16x16

# 将用户发送到可以阅读更多关于Superset信息的链接
DOCUMENTATION_URL = None
DOCUMENTATION_TEXT = "文档"
DOCUMENTATION_ICON = None  # 推荐大小：16x16

# 时间选择器中的最近N天相对于什么：
# 'today'表示是本地时区的午夜（00:00:00）
# 'now'表示相对于查询发出的时间
# 如果开始和结束时间都设置为now，这将使时间
# 过滤器成为一个移动窗口。如果只将结束时间设置为now，
# 开始时间将设置为午夜，而结束时间将相对于
# 查询发出的时间。
DEFAULT_RELATIVE_START_TIME = "today"
DEFAULT_RELATIVE_END_TIME = "today"

# 配置每个引擎使用哪个SQL验证器
SQL_VALIDATORS_BY_ENGINE = {
    "presto": "PrestoDBSQLValidator",
    "postgresql": "PostgreSQLValidator",
}

# 按顺序排列的首选数据库列表。这些数据库将在
# "添加数据库

# 允许用户使用个人OAuth2令牌进行认证的数据库所需的详细信息。
# 更多信息请参见 https://github.com/apache/superset/issues/20300。
# scope和URI通常是可选的。
# 注意：如果你在此文件中更改id、scope或URI，你可能需要清除  # noqa: E501
# 数据库中的现有令牌。这需要通过运行查询来
# 删除现有令牌。
DATABASE_OAUTH2_CLIENTS: dict[str, dict[str, Any]] = {
    # "Google Sheets": {
    #     "id": "XXX.apps.googleusercontent.com",
    #     "secret": "GOCSPX-YYY",
    #     "scope": " ".join(
    #         [
    #             "https://www.googleapis.com/auth/drive.readonly",
    #             "https://www.googleapis.com/auth/spreadsheets",
    #             "https://spreadsheets.google.com/feeds",
    #         ]
    #     ),
    #     "authorization_request_uri": "https://accounts.google.com/o/oauth2/v2/auth",
    #     "token_request_uri": "https://oauth2.googleapis.com/token",
    # },
}

# OAuth2状态使用以下算法编码为JWT。
DATABASE_OAUTH2_JWT_ALGORITHM = "HS256"

# 默认情况下，重定向URI指向/api/v1/database/oauth2/，不需要
# 指定。如果你运行多个Superset实例，你可能想要使用
# 代理处理重定向，因为重定向URI需要在OAuth2应用程序中注册。
# 在这种情况下，代理可以通过查看OAuth2状态对象中的
# `default_redirect_uri`属性将请求转发到正确的实例。
# DATABASE_OAUTH2_REDIRECT_URI = "http://localhost:8088/api/v1/database/oauth2/"

# 获取访问和刷新令牌时的超时时间。
DATABASE_OAUTH2_TIMEOUT = timedelta(seconds=30)

# 启用/禁用 CSP 警告
CONTENT_SECURITY_POLICY_WARNING = True

# 是否启用 Talisman
TALISMAN_ENABLED = utils.cast_to_boolean(os.environ.get("TALISMAN_ENABLED", True))

# 如果你想启用 Talisman，你想如何配置它？
# 有关设置 Talisman 的更多信息，请参考
# https://superset.apache.org/docs/configuration/networking-settings/#changing-flask-talisman-csp

TALISMAN_CONFIG = {
    "content_security_policy": {
        "base-uri": ["'self'"],
        "default-src": ["'self'"],
        "img-src": [
            "'self'",
            "blob:",
            "data:",
            "https://apachesuperset.gateway.scarf.sh",
            "https://static.scarf.sh/",
            # "https://cdn.brandfolder.io", # Uncomment when SLACK_ENABLE_AVATARS is True  # noqa: E501
            "ows.terrestris.de",
        ],
        "worker-src": ["'self'", "blob:"],
        "connect-src": [
            "'self'",
            "https://api.mapbox.com",
            "https://events.mapbox.com",
        ],
        "object-src": "'none'",
        "style-src": [
            "'self'",
            "'unsafe-inline'",
        ],
        "script-src": ["'self'", "'strict-dynamic'"],
    },
    "content_security_policy_nonce_in": ["script-src"],
    "force_https": False,
    "session_cookie_secure": False,
}
# React 在开发模式下需要 `eval` 才能正常工作
TALISMAN_DEV_CONFIG = {
    "content_security_policy": {
        "base-uri": ["'self'"],
        "default-src": ["'self'"],
        "img-src": [
            "'self'",
            "blob:",
            "data:",
            "https://apachesuperset.gateway.scarf.sh",
            "https://static.scarf.sh/",
            "https://cdn.brandfolder.io",
            "ows.terrestris.de",
        ],
        "worker-src": ["'self'", "blob:"],
        "connect-src": [
            "'self'",
            "https://api.mapbox.com",
            "https://events.mapbox.com",
        ],
        "object-src": "'none'",
        "style-src": [
            "'self'",
            "'unsafe-inline'",
        ],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    },
    "content_security_policy_nonce_in": ["script-src"],
    "force_https": False,
    "session_cookie_secure": False,
}

#
# Flask 会话 cookie 选项
#
# 详细信息请参见 https://flask.palletsprojects.com/en/1.1.x/security/#set-cookie-options
#
SESSION_COOKIE_HTTPONLY = True  # 是否阻止前端 JS 读取 cookie？
SESSION_COOKIE_SECURE = False  # 是否阻止通过非 TLS 传输 cookie？
SESSION_COOKIE_SAMESITE: Literal["None", "Lax", "Strict"] | None = "Lax"
# 是否使用 flask-session 的服务器端会话或 Flask 安全 cookie
SESSION_SERVER_SIDE = False
# 使用 Redis 作为服务器端会话后端的配置示例
# from flask_session import RedisSessionInterface
#
# SESSION_SERVER_SIDE = True
# SESSION_TYPE = "redis"
# SESSION_REDIS = Redis(host="localhost", port=6379, db=0)
#
# 其他可能的配置选项和后端：
# # https://flask-session.readthedocs.io/en/latest/config.html

# 缓存静态资源
SEND_FILE_MAX_AGE_DEFAULT = int(timedelta(days=365).total_seconds())

# 存储示例数据的数据库 URI，如果设置为 `None` 则默认指向
# SQLALCHEMY_DATABASE_URI
SQLALCHEMY_EXAMPLES_URI = (
    "sqlite:///" + os.path.join(DATA_DIR, "examples.db") + "?check_same_thread=false"
)

# 渲染 UI 时要添加到所有静态资源路径的可选前缀。
# 这对于在外部 CDN 中托管资源很有用
STATIC_ASSETS_PREFIX = ""

# 某些 SQLAlchemy 连接字符串可能会使 Superset 面临安全风险。
# 通常不应允许这些连接。
PREVENT_UNSAFE_DB_CONNECTIONS = True

# 如果为 true，前端将把数据集上的所有默认 URL 作为相对 URL 处理
PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET = True

# 定义数据集数据导入允许的 URL 列表 (v1)。
# 简单示例，仅允许属于特定域的 URL：
# ALLOWED_IMPORT_URL_DOMAINS = [
#     r"^https://.+\.domain1\.com\/?.*", r"^https://.+\.domain2\.com\/?.*"
# ]
DATASET_IMPORT_ALLOWED_DATA_URLS = [r".*"]

# 使用自定义证书时用于存储生成的 SSL 证书的路径。
# 默认为临时目录。
# 示例：SSL_CERT_PATH = "/certs"
SSL_CERT_PATH: str | None = None

# SQLA 表格转换器，每次我们获取某个表的元数据时
# (superset.connectors.sqla.models.SqlaTable)，我们调用这个钩子
# 以允许通过此回调修改对象。
# 这可以用于根据命名约定等设置对象的任何属性。
# 你可以在测试中找到示例。

# pylint: disable-next=unnecessary-lambda-assignment
SQLA_TABLE_MUTATOR = lambda table: table  # noqa: E731


# 全局异步查询配置选项
# 需要启用 GLOBAL_ASYNC_QUERIES 功能标志
GLOBAL_ASYNC_QUERY_MANAGER_CLASS = (
    "superset.async_events.async_query_manager.AsyncQueryManager"
)
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_PREFIX = "async-events-"
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT = 1000
GLOBAL_ASYNC_QUERIES_REDIS_STREAM_LIMIT_FIREHOSE = 1000000
GLOBAL_ASYNC_QUERIES_REGISTER_REQUEST_HANDLERS = True
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME = "async-token"
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SECURE = False
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_SAMESITE: None | (Literal["None", "Lax", "Strict"]) = (
    None
)
GLOBAL_ASYNC_QUERIES_JWT_COOKIE_DOMAIN = None
GLOBAL_ASYNC_QUERIES_JWT_SECRET = "test-secret-change-me"  # noqa: S105
GLOBAL_ASYNC_QUERIES_TRANSPORT: Literal["polling", "ws"] = "polling"
GLOBAL_ASYNC_QUERIES_POLLING_DELAY = int(
    timedelta(milliseconds=500).total_seconds() * 1000
)
GLOBAL_ASYNC_QUERIES_WEBSOCKET_URL = "ws://127.0.0.1:8080/"

# 全局异步查询缓存后端配置选项：
# - 设置 'CACHE_TYPE' 为 'RedisCache' 以使用 RedisCacheBackend
# - 设置 'CACHE_TYPE' 为 'RedisSentinelCache' 以使用 RedisSentinelCacheBackend
GLOBAL_ASYNC_QUERIES_CACHE_BACKEND = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": "localhost",
    "CACHE_REDIS_PORT": 6379,
    "CACHE_REDIS_USER": "",
    "CACHE_REDIS_PASSWORD": "",
    "CACHE_REDIS_DB": 0,
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_REDIS_SENTINELS": [("localhost", 26379)],
    "CACHE_REDIS_SENTINEL_MASTER": "mymaster",
    "CACHE_REDIS_SENTINEL_PASSWORD": None,
    "CACHE_REDIS_SSL": False,  # True 或 False
    "CACHE_REDIS_SSL_CERTFILE": None,
    "CACHE_REDIS_SSL_KEYFILE": None,
    "CACHE_REDIS_SSL_CERT_REQS": "required",
    "CACHE_REDIS_SSL_CA_CERTS": None,
}

# 嵌入式配置选项
GUEST_ROLE_NAME = "Public"
GUEST_TOKEN_JWT_SECRET = "test-guest-secret-change-me"  # noqa: S105
GUEST_TOKEN_JWT_ALGO = "HS256"  # noqa: S105
GUEST_TOKEN_HEADER_NAME = "X-GuestToken"  # noqa: S105
GUEST_TOKEN_JWT_EXP_SECONDS = 300  # 5 分钟
# 嵌入式 Superset 的访客令牌受众，可以是字符串或可调用对象
GUEST_TOKEN_JWT_AUDIENCE: Callable[[], str] | str | None = None

# 可以提供一个可调用对象来对访客令牌配置进行额外验证
# 例如某些 RLS 参数：
# lambda x: len(x['rls']) == 1 and "tenant_id=" in x['rls'][0]['clause']
#
# 接收 GuestTokenUser 字典作为参数
# 从可调用对象返回 False 将向用户返回 HTTP 400。

GUEST_TOKEN_VALIDATOR_HOOK = None

# SQL 数据集健康检查。注意如果启用，强烈建议对可调用对象进行记忆化以提高性能，例如：
#
#    @cache_manager.cache.memoize(timeout=0)
#    def DATASET_HEALTH_CHECK(datasource: SqlaTable) -> Optional[str]:
#        if (
#            datasource.sql and
#            len(SQLScript(datasource.sql).tables) == 1
#        ):
#            return (
#                "此虚拟数据集只查询一个表，因此可以通过直接查询该表来替代。"
#            )
#
#        return None
#
# 在 FLASK_APP_MUTATOR 可调用对象中，即一旦应用程序和缓存初始化完成，
# 如果回调函数发生变化，还需要添加以下逻辑来清除所有数据源的缓存。
#
#    def FLASK_APP_MUTATOR(app: Flask) -> None:
#        name = "DATASET_HEALTH_CHECK"
#        func = app.config[name]
#        code = func.uncached.__code__.co_code
#
#        if cache_manager.cache.get(name) != code:
#            cache_manager.cache.delete_memoized(func)
#            cache_manager.cache.set(name, code, timeout=0)
#
DATASET_HEALTH_CHECK: Callable[[SqlaTable], str] | None = None

# 高级数据类型键应与列元数据中设置的相对应
ADVANCED_DATA_TYPES: dict[str, AdvancedDataType] = {
    "internet_address": internet_address,
    "port": internet_port,
}

# 默认情况下，欢迎页面显示用户有权访问的所有图表和仪表盘。
# 这可以更改为仅显示示例，或通过提供标题和 FAB 过滤器来显示自定义视图：
# WELCOME_PAGE_LAST_TAB = (
#     "Xyz",
#     [{"col": 'created_by', "opr": 'rel_o_m', "value": 10}],
# )
WELCOME_PAGE_LAST_TAB: Literal["examples", "all"] | tuple[str, list[dict[str, Any]]] = (
    "all"
)

# 压缩文件的最大允许大小
ZIPPED_FILE_MAX_SIZE = 100 * 1024 * 1024  # 100MB
# 压缩文件的最大允许压缩比
ZIP_FILE_MAX_COMPRESS_RATIO = 200.0

# 导航栏上显示的环境标签配置。将 'text' 设置为 '' 将隐藏标签。  # noqa: E501
# 'color' 可以是十六进制颜色代码，或点索引的主题颜色（例如 error.base）
ENVIRONMENT_TAG_CONFIG = {
    "variable": "SUPERSET_ENV",
    "values": {
        "debug": {
            "color": "error.base",
            "text": "flask-debug",
        },
        "development": {
            "color": "error.base",
            # "text": "Development",
            "text": "开发",
        },
        "production": {
            "color": "",
            "text": "",
        },
    },
}


# 额外的相关查询过滤器使得可以限制在 UI 中显示的对象。
# 例如，要在"所有者"下拉列表中只显示"admin"或以字母"b"开头的用户，
# 你可以在配置中添加以下内容：
# def user_filter(query: Query, *args, *kwargs):
#     from superset import security_manager
#
#     user_model = security_manager.user_model
#     filters = [
#         user_model.username == "admin",
#         user_model.username.ilike("b%"),
#     ]
#     return query.filter(or_(*filters))
#
#  EXTRA_RELATED_QUERY_FILTERS = {"user": user_filter}
#
# 类似地，要限制"角色"下拉列表中的角色，你可以为"role"键提供自定义
# 过滤器回调。
class ExtraRelatedQueryFilters(TypedDict, total=False):
    role: Callable[[Query], Query]
    user: Callable[[Query], Query]


EXTRA_RELATED_QUERY_FILTERS: ExtraRelatedQueryFilters = {}


# 额外的动态查询过滤器使得可以在应用任何其他过滤之前限制在 UI 中显示的对象。
# 例如，当考虑使用功能标志和默认应用的常规角色过滤器一起过滤时很有用。
# 例如，要在"数据库连接"列表中只显示以字母"b"开头的数据库，
# 你可以在配置中添加以下内容：
# def initial_database_filter(query: Query, *args, *kwargs):
#     from superset.models.core import Database
#
#     filter = Database.database_name.startswith('b')
#     return query.filter(filter)
#
#  EXTRA_DYNAMIC_QUERY_FILTERS = {"database": initial_database_filter}
class ExtraDynamicQueryFilters(TypedDict, total=False):
    databases: Callable[[Query], Query]


EXTRA_DYNAMIC_QUERY_FILTERS: ExtraDynamicQueryFilters = {}


# 添加目录权限的迁移可能需要相当长的时间来执行，因为它必须为凭据可访问的
# 所有其他目录中的所有模式和目录创建权限。此标志允许跳过这些次要权限的
# 创建，仅关注默认目录的权限。这些次要权限可以稍后通过 UI 编辑数据库
# 连接来创建（无需停机）。
CATALOGS_SIMPLIFIED_MIGRATION: bool = False


# 在更新数据库连接或手动触发权限同步时，命令以同步模式执行。如果你配置了
# celery worker，建议将下面的配置更改为 ``True`` 以异步模式运行此过程。
# 一个数据库连接可能有数百个目录，每个目录有数千个模式，这大大增加了处理
# 时间。以异步模式运行可以避免长时间保持 Web API 调用打开。
SYNC_DB_PERMISSIONS_IN_ASYNC_MODE: bool = False

# 自定义登陆start
# from custom_security import CustomSecurityManager
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from custom_security import CustomSecurityManager
# 配置 Flask-AppBuilder 使用自定义安全管理器
# AUTH_TYPE = 1  # AUTH_DB，数据库认证
# SECURITY_MANAGER_CLASS = CustomSecurityManager
CUSTOM_SECURITY_MANAGER = CustomSecurityManager

# 可选：配置其他安全相关选项
# FAB_ADD_SECURITY_VIEWS = True  # 确保安全视图可用
# WTF_CSRF_ENABLED = True  # 启用 CSRF 保护
# 自定义登陆end


# -------------------------------------------------------------------
# *                警告：在此处停止编辑                    *
# -------------------------------------------------------------------
# 不要在此行下面添加配置值，因为本地配置将无法覆盖它们。
if CONFIG_PATH_ENV_VAR in os.environ:
    # Explicitly import config module that is not necessarily in pythonpath; useful
    # for case where app is being executed via pex.
    cfg_path = os.environ[CONFIG_PATH_ENV_VAR]
    try:
        module = sys.modules[__name__]
        spec = importlib.util.spec_from_file_location("superset_config", cfg_path)
        override_conf = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(override_conf)
        for key in dir(override_conf):
            if key.isupper():
                setattr(module, key, getattr(override_conf, key))

        click.secho(f"Loaded your LOCAL configuration at [{cfg_path}]", fg="cyan")
    except Exception:
        logger.exception(
            "Failed to import config for %s=%s", CONFIG_PATH_ENV_VAR, cfg_path
        )
        raise
elif importlib.util.find_spec("superset_config"):
    try:
        # pylint: disable=import-error,wildcard-import,unused-wildcard-import
        import superset_config
        from superset_config import *  # noqa: F403, F401

        click.secho(
            f"Loaded your LOCAL configuration at [{superset_config.__file__}]",
            fg="cyan",
        )
    except Exception:
        logger.exception("Found but failed to import local superset_config")
        raise
