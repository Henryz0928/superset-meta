/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Component } from 'react';
import { t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import { PublishedLabel } from 'src/components/Label';
import { HeaderProps, HeaderDropdownProps } from '../Header/types';

export type DashboardPublishedStatusType = {
  dashboardId: HeaderDropdownProps['dashboardId'];
  userCanEdit: HeaderDropdownProps['userCanEdit'];
  userCanSave: HeaderDropdownProps['userCanSave'];
  isPublished: HeaderProps['isPublished'];
  savePublished: HeaderProps['savePublished'];
};

// const draftButtonTooltip = t(
//   'This dashboard is not published, it will not show up in the list of dashboards. ' +
//     'Click here to publish this dashboard.',
// );
const draftButtonTooltip = t(
  '这个仪表盘未发布，它不会出现在仪表盘列表中。 ' +
    '点击此处发布此仪表盘。',
);

// const draftDivTooltip = t(
//   'This dashboard is not published which means it will not show up in the list of dashboards.' +
//     ' Favorite it to see it there or access it by using the URL directly.',
// );
const draftDivTooltip = t(
  '这个仪表盘未发布，这意味着它不会出现在仪表盘列表中。' +
    ' 收藏它以查看它或直接使用链接访问它。',
);

// const publishedTooltip = t(
//   'This dashboard is published. Click to make it a draft.',
// );
const publishedTooltip = t(
  '此仪表板已发布。点击可将其保存为草稿。',
);

export default class PublishedStatus extends Component<DashboardPublishedStatusType> {
  constructor(props: DashboardPublishedStatusType) {
    super(props);
    this.togglePublished = this.togglePublished.bind(this);
  }

  togglePublished() {
    this.props.savePublished(this.props.dashboardId, !this.props.isPublished);
  }

  render() {
    const { isPublished, userCanEdit, userCanSave } = this.props;

    // Show everybody the draft badge
    if (!isPublished) {
      // if they can edit the dash, make the badge a button
      if (userCanEdit && userCanSave) {
        return (
          <Tooltip
            id="unpublished-dashboard-tooltip"
            placement="bottom"
            title={draftButtonTooltip}
          >
            <div>
              <PublishedLabel
                isPublished={isPublished}
                onClick={this.togglePublished}
              />
            </div>
          </Tooltip>
        );
      }
      return (
        <Tooltip
          id="unpublished-dashboard-tooltip"
          placement="bottom"
          title={draftDivTooltip}
        >
          <div>
            <PublishedLabel isPublished={isPublished} />
          </div>
        </Tooltip>
      );
    }

    // Show the published badge for the owner of the dashboard to toggle
    if (userCanEdit && userCanSave) {
      return (
        <Tooltip
          id="published-dashboard-tooltip"
          placement="bottom"
          title={publishedTooltip}
        >
          <div>
            <PublishedLabel
              isPublished={isPublished}
              onClick={this.togglePublished}
            />
          </div>
        </Tooltip>
      );
    }

    // Don't show anything if one doesn't own the dashboard and it is published
    return null;
  }
}
