<!--
授权给 Apache 软件基金会(ASF)的一个或多个
贡献者许可协议。有关版权所有权的更多信息，
请参阅随本作品分发的 NOTICE 文件。
ASF 根据 Apache 许可证 2.0 版本向您授权本文件
（"许可证"）；除非符合许可证的规定，
否则您不得使用此文件。
您可以在以下位置获取许可证副本：

  http://www.apache.org/licenses/LICENSE-2.0

除非适用法律要求或书面同意，否则根据许可证分发的
软件是基于"按原样"的基础分发的，
没有任何明示或暗示的保证或条件。
有关许可证下的特定语言管理权限和
限制，请参阅许可证。
-->

# 使用 Docker 开始使用 Superset

Docker 是开始使用 Superset 的一种简单方法。

## 前提条件

1. [Docker](https://www.docker.com/get-started)
2. [Docker Compose](https://docs.docker.com/compose/install/)

## 配置

`/app/pythonpath` 文件夹从 [`./docker/pythonpath_dev`](./pythonpath_dev) 挂载，
其中包含一个基础配置文件 [`./docker/pythonpath_dev/superset_config.py`](./pythonpath_dev/superset_config.py)，
用于本地开发。

### 本地覆盖

要在本地覆盖配置设置，只需将 [`./docker/pythonpath_dev/superset_config_local.example`](./pythonpath_dev/superset_config_local.example)
复制到 `./docker/pythonpath_dev/superset_config_docker.py`（git 已忽略）并填写您的覆盖设置。

### 本地包

如果您想添加 Python 包以在本地测试数据库等功能，只需添加本地 requirements.txt 文件（`./docker/requirements-local.txt`）
并重建 Docker 堆栈即可。

步骤：

1. 创建 `./docker/requirements-local.txt`
2. 添加您的新包
3. 重建 docker compose
    1. `docker compose down -v`
    2. `docker compose up`

## 初始化数据库

数据库将通过初始化容器（[`superset-init`](./docker-init.sh)）在启动时自行初始化。这可能需要一分钟。

## 正常运行

要运行容器，只需执行：`docker compose up`

等待几分钟让 Superset 完成初始化后，您可以打开浏览器并访问 [`http://localhost:8088`](http://localhost:8088)
开始您的旅程。

## 开发

在运行时，当修改 Superset 的 Python 和 JavaScript 源代码时，容器服务器将自动重载。
不过别忘了刷新页面以使新的前端生效。

## 生产环境

可以通过使用 [`docker-compose-non-dev.yml`](../docker-compose-non-dev.yml) 在非开发模式下运行 Superset。此文件不包括开发所需的卷。

## 资源限制

如果您在 macOS 上构建时退出并显示 137，则需要增加 Docker 资源。请参阅[此处](https://docs.docker.com/docker-for-mac/#advanced)的说明（搜索 memory）