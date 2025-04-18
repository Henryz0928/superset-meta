""" 此文件可以覆盖config.py """

import os
# from datetime import timedelta

# # 数据库配置
# SQLALCHEMY_DATABASE_URI = 'postgresql://user:password@localhost:5432/superset'

# # Redis 配置
# REDIS_HOST = 'localhost'
# REDIS_PORT = 6379
# REDIS_DB = 0
# REDIS_CACHE_DB = 1

# # Celery 配置
# class CeleryConfig:
#     BROKER_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'
#     CELERY_IMPORTS = ('superset.sql_lab', )
#     CELERY_RESULT_BACKEND = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'
#     CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}

# CELERY_CONFIG = CeleryConfig

# # 缓存配置
# CACHE_CONFIG = {
#     'CACHE_TYPE': 'redis',
#     'CACHE_DEFAULT_TIMEOUT': 300,  # 5分钟
#     'CACHE_KEY_PREFIX': 'superset_',
#     'CACHE_REDIS_HOST': REDIS_HOST,
#     'CACHE_REDIS_PORT': REDIS_PORT,
#     'CACHE_REDIS_DB': REDIS_CACHE_DB,
# }

# # 安全设置
# SECRET_KEY = 'your-secure-key-here'  # 请更改为安全的随机字符串
# ENABLE_PROXY_FIX = True
# TALISMAN_ENABLED = True

# # 认证配置
# AUTH_TYPE = 'db'  # 数据库认证
# AUTH_USER_REGISTRATION = True
# AUTH_USER_REGISTRATION_ROLE = "Public"

# # 语言设置
# BABEL_DEFAULT_LOCALE = 'zh'
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
    'zh': {'flag': 'cn', 'name': '中文'},
}

# # 功能标记配置
# FEATURE_FLAGS = {
#     'DASHBOARD_RBAC': True,
#     'ALERT_REPORTS': True,
#     'DASHBOARD_NATIVE_FILTERS': True,
#     'DRILL_TO_DETAIL': True,
#     'ENABLE_TEMPLATE_PROCESSING': True,
# }

# # SQL Lab 设置
# SQL_MAX_ROW = 100000
# SQL_QUERY_MUTATOR = lambda sql: sql  # 可以用来修改查询

# # 日志配置
# LOGGING_CONFIGURATOR = DefaultLoggingConfigurator()
# ENABLE_TIME_ROTATE = True
# TIME_ROTATE_LOG_LEVEL = 'DEBUG'
# FILENAME = os.path.join(DATA_DIR, 'superset.log')
# ROLLOVER = 'midnight'
# INTERVAL = 1
# BACKUP_COUNT = 30