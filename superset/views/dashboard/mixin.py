# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from flask_babel import lazy_gettext as _

from superset import security_manager
from superset.dashboards.filters import DashboardAccessFilter


class DashboardMixin:  # pylint: disable=too-few-public-methods
    # list_title = _("Dashboards")
    # show_title = _("Show Dashboard")
    # add_title = _("Add Dashboard")
    # edit_title = _("Edit Dashboard")
    list_title = _("仪表盘")
    show_title = _("显示仪表盘")
    add_title = _("添加仪表盘")
    edit_title = _("修改仪表盘")

    list_columns = ["dashboard_link", "creator", "published", "modified"]
    order_columns = ["dashboard_link", "modified", "published"]
    edit_columns = [
        "dashboard_title",
        "slug",
        "owners",
        "roles",
        "position_json",
        "css",
        "json_metadata",
        "published",
    ]
    show_columns = edit_columns + ["charts"]
    search_columns = ("dashboard_title", "slug", "owners", "published")
    add_columns = edit_columns
    base_order = ("changed_on", "desc")
    # description_columns = {
    #     "position_json": _(
    #         "This json object describes the positioning of the widgets in "
    #         "the dashboard. It is dynamically generated when adjusting "
    #         "the widgets size and positions by using drag & drop in "
    #         "the dashboard view"
    #     ),
    #     "css": _(
    #         "The CSS for individual dashboards can be altered here, or "
    #         "in the dashboard view where changes are immediately "
    #         "visible"
    #     ),
    #     "slug": _("To get a readable URL for your dashboard"),
    #     "json_metadata": _(
    #         "This JSON object is generated dynamically when clicking "
    #         "the save or overwrite button in the dashboard view. It "
    #         "is exposed here for reference and for power users who may "
    #         "want to alter specific parameters."
    #     ),
    #     "owners": _("Owners is a list of users who can alter the dashboard."),
    #     "roles": _(
    #         "Roles is a list which defines access to the dashboard. "
    #         "Granting a role access to a dashboard will bypass dataset level checks."
    #         "If no roles are defined, regular access permissions apply."
    #     ),
    #     "published": _(
    #         "Determines whether or not this dashboard is "
    #         "visible in the list of all dashboards"
    #     ),
    # }
    description_columns = {
        "position_json": _(
            "这个 JSON 对象描述了控件的位置布局 "
            "仪表盘。它在调整时动态生成。 "
            "通过拖放来调整小部件的大小和位置 "
            "仪表盘视图"
        ),
        "css": _(
            "这里可以修改各个仪表盘的 CSS，或 "
            "在仪表盘视图中，更改会立即 "
            "可见"
        ),
        "slug": _("为您的仪表盘获取一个可读的 URL"),
        "json_metadata": _(
            "这个 JSON 对象在点击时动态生成 "
            "在仪表盘视图中的保存或覆盖按钮。它 "
            "这里暴露了相关内容，供参考，并供可能需要的高级用户使用 "
            "想要修改特定参数。"
        ),
        "owners": _("所有者是可以更改仪表板的用户列表。"),
        "roles": _(
            "角色是一个定义仪表板访问权限的列表。 "
            "授予角色对仪表盘的访问权限将绕过数据集级别的检查。"
            "如果没有定义角色，则应用常规访问权限。"
        ),
        "published": _(
            "确定此仪表板是否 "
            "在所有仪表板列表中可见"
        ),
    }
    base_filters = [["slice", DashboardAccessFilter, lambda: []]]
    # label_columns = {
    #     "dashboard_link": _("Dashboard"),
    #     "dashboard_title": _("Title"),
    #     "slug": _("Slug"),
    #     "charts": _("Charts"),
    #     "owners": _("Owners"),
    #     "roles": _("Roles"),
    #     "published": _("Published"),
    #     "creator": _("Creator"),
    #     "modified": _("Modified"),
    #     "position_json": _("Position JSON"),
    #     "css": _("CSS"),
    #     "json_metadata": _("JSON Metadata"),
    # }
    label_columns = {
        "dashboard_link": _("仪表盘"),
        "dashboard_title": _("标题"),
        "slug": _("子弹"),
        "charts": _("图表"),
        "owners": _("所有者"),
        "roles": _("角色"),
        "published": _("发布"),
        "creator": _("创建者"),
        "modified": _("修改过的"),
        "position_json": _("位置 JSON"),
        "css": _("CSS"),
        "json_metadata": _("JSON 元数据"),
    }

    def pre_delete(self, item: "DashboardMixin") -> None:
        security_manager.raise_for_ownership(item)
