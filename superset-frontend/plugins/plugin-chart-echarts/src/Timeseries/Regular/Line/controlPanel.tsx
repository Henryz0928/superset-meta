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
import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlPanelsContainerProps,
  ControlSubSectionHeader,
  D3_TIME_FORMAT_DOCS,
  getStandardizedControls,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

import { EchartsTimeseriesSeriesType } from '../../types';
import {
  DEFAULT_FORM_DATA,
  TIME_SERIES_DESCRIPTION_TEXT,
} from '../../constants';
import {
  legendSection,
  minorTicks,
  richTooltipSection,
  seriesOrderSection,
  showValueSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
} from '../../../controls';

const {
  area,
  logAxis,
  markerEnabled,
  markerSize,
  minorSplitLine,
  opacity,
  rowLimit,
  seriesType,
  truncateYAxis,
  yAxisBounds,
  zoomable,
} = DEFAULT_FORM_DATA;
const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.echartsTimeSeriesQueryWithXAxisSort,
    sections.advancedAnalyticsControls,
    sections.annotationsAndLayersControls,
    sections.forecastIntervalControls,
    sections.titleControls,
    {
      // label: t('Chart Options'),
      label: t('图表选项'),
      expanded: true,
      controlSetRows: [
        ...seriesOrderSection,
        ['color_scheme'],
        ['time_shift_color'],
        [
          {
            name: 'seriesType',
            config: {
              type: 'SelectControl',
              // label: t('Series Style'),
              label: t('系列风格'),
              renderTrigger: true,
              default: seriesType,
              // choices: [
              //   [EchartsTimeseriesSeriesType.Line, t('Line')],
              //   [EchartsTimeseriesSeriesType.Scatter, t('Scatter')],
              //   [EchartsTimeseriesSeriesType.Smooth, t('Smooth Line')],
              //   [EchartsTimeseriesSeriesType.Bar, t('Bar')],
              //   [EchartsTimeseriesSeriesType.Start, t('Step - start')],
              //   [EchartsTimeseriesSeriesType.Middle, t('Step - middle')],
              //   [EchartsTimeseriesSeriesType.End, t('Step - end')],
              // ],
              // description: t('Series chart type (line, bar etc)'),
              choices: [
                [EchartsTimeseriesSeriesType.Line, t('行')],
                [EchartsTimeseriesSeriesType.Scatter, t('散射')],
                [EchartsTimeseriesSeriesType.Smooth, t('平滑线条')],
                [EchartsTimeseriesSeriesType.Bar, t('条')],
                [EchartsTimeseriesSeriesType.Start, t('步骤-启动')],
                [EchartsTimeseriesSeriesType.Middle, t('步骤-中间')],
                [EchartsTimeseriesSeriesType.End, t('步骤 - 结束')],
              ],
              description: t('系列图表类型（线图、柱图等）'),
            },
          },
        ],
        ...showValueSection,
        [
          {
            name: 'area',
            config: {
              type: 'CheckboxControl',
              // label: t('Area Chart'),
              label: t('区域图'),
              renderTrigger: true,
              default: area,
              // description: t(
              //   'Draw area under curves. Only applicable for line types.',
              // ),
              description: t(
                '绘制曲线下的面积。仅适用于线型。',
              ),
            },
          },
        ],
        [
          {
            name: 'opacity',
            config: {
              type: 'SliderControl',
              // label: t('Area chart opacity'),
              label: t('区域图透明度'),
              renderTrigger: true,
              min: 0,
              max: 1,
              step: 0.1,
              default: opacity,
              // description: t(
              //   'Opacity of Area Chart. Also applies to confidence band.',
              // ),
              description: t(
                '区域图的透明度。也适用于置信区间。',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.area?.value),
            },
          },
        ],
        [
          {
            name: 'markerEnabled',
            config: {
              type: 'CheckboxControl',
              // label: t('Marker'),
              label: t('标记'),
              renderTrigger: true,
              default: markerEnabled,
              // description: t(
              //   'Draw a marker on data points. Only applicable for line types.',
              // ),
              description: t(
                '在数据点上绘制标记。仅适用于线型。',
              ),
            },
          },
        ],
        [
          {
            name: 'markerSize',
            config: {
              type: 'SliderControl',
              // label: t('Marker Size'),
              label: t('标记的大小'),
              renderTrigger: true,
              min: 0,
              max: 20,
              default: markerSize,
              // description: t(
              //   'Size of marker. Also applies to forecast observations.',
              // ),
              description: t(
                '标记的大小。也适用于预报观测。',
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.markerEnabled?.value),
            },
          },
        ],
        [
          {
            name: 'zoomable',
            config: {
              type: 'CheckboxControl',
              // label: t('Data Zoom'),
              label: t('数据缩放'),
              default: zoomable,
              renderTrigger: true,
              // description: t('Enable data zooming controls'),
              description: t('启用数据缩放控制'),
            },
          },
        ],
        [minorTicks],
        ...legendSection,
        // [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
        [<ControlSubSectionHeader>{t('X 轴')}</ControlSubSectionHeader>],
        [
          {
            name: 'x_axis_time_format',
            config: {
              ...sharedControls.x_axis_time_format,
              default: 'smart_date',
              description: `${D3_TIME_FORMAT_DOCS}. ${TIME_SERIES_DESCRIPTION_TEXT}`,
            },
          },
        ],
        [xAxisLabelRotation],
        ...richTooltipSection,
        // eslint-disable-next-line react/jsx-key
        // [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
        [<ControlSubSectionHeader>{t('Y 轴')}</ControlSubSectionHeader>],
        ['y_axis_format'],
        ['currency_format'],
        [
          {
            name: 'logAxis',
            config: {
              type: 'CheckboxControl',
              // label: t('Logarithmic y-axis'),
              label: t('对数 y 轴'),
              renderTrigger: true,
              default: logAxis,
              // description: t('Logarithmic y-axis'),
              description: t('对数 y 轴'),
            },
          },
        ],
        [
          {
            name: 'minorSplitLine',
            config: {
              type: 'CheckboxControl',
              // label: t('Minor Split Line'),
              label: t('次分割线'),
              renderTrigger: true,
              default: minorSplitLine,
              // description: t('Draw split lines for minor y-axis ticks'),
              description: t('绘制次要 y 轴刻度的分割线'),
            },
          },
        ],
        [truncateXAxis],
        [xAxisBounds],
        [
          {
            name: 'truncateYAxis',
            config: {
              type: 'CheckboxControl',
              // label: t('Truncate Y Axis'),
              label: t('截断 Y 轴'),
              default: truncateYAxis,
              renderTrigger: true,
              // description: t(
              //   'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
              // ),
              description: t(
                'Y 轴截断。可以通过指定最小或最大边界来覆盖。',
              ),
            },
          },
        ],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              // label: t('Y Axis Bounds'),
              label: t('Y 轴范围'),
              renderTrigger: true,
              default: yAxisBounds,
              // description: t(
              //   'Bounds for the Y-axis. When left empty, the bounds are ' +
              //     'dynamically defined based on the min/max of the data. Note that ' +
              //     "this feature will only expand the axis range. It won't " +
              //     "narrow the data's extent.",
              // ),
              description: t(
                'Y 轴的范围。当留空时，范围是 ' +
                  '动态定义，基于数据的最小值/最大值。请注意， ' +
                  "这个功能只会扩展轴的范围。它不会 " +
                  "缩小数据的范围。",
              ),
              visibility: ({ controls }: ControlPanelsContainerProps) =>
                Boolean(controls?.truncateYAxis?.value),
            },
          },
        ],
      ],
    },
  ],
  controlOverrides: {
    row_limit: {
      default: rowLimit,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metrics: getStandardizedControls().popAllMetrics(),
    groupby: getStandardizedControls().popAllColumns(),
  }),
};

export default config;
