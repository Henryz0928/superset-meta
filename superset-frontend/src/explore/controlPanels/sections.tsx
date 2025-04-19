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
  ControlPanelSectionConfig,
  ControlSubSectionHeader,
} from '@superset-ui/chart-controls';

export const datasourceAndVizType: ControlPanelSectionConfig = {
  controlSetRows: [
    ['datasource'],
    ['viz_type'],
    [
      {
        name: 'slice_id',
        config: {
          type: 'HiddenControl',
          label: t('Chart ID'),
          hidden: true,
          description: t('The id of the active chart'),
        },
      },
      {
        name: 'cache_timeout',
        config: {
          type: 'HiddenControl',
          label: t('Cache Timeout (seconds)'),
          hidden: true,
          description: t('The number of seconds before expiring the cache'),
        },
      },
      {
        name: 'url_params',
        config: {
          type: 'HiddenControl',
          label: t('URL parameters'),
          hidden: true,
          description: t('Extra parameters for use in jinja templated queries'),
        },
      },
    ],
  ],
};

export const colorScheme: ControlPanelSectionConfig = {
  // label: t('Color scheme'),
  label: t('颜色方案'),
  controlSetRows: [['color_scheme']],
};

export const sqlaTimeSeries: ControlPanelSectionConfig = {
  // label: t('Time'),
  // description: t('Time related form attributes'),
  label: t('时间'),
  description: t('时间相关的表单属性'),
  expanded: true,
  controlSetRows: [['granularity_sqla'], ['time_range']],
};

export const annotations: ControlPanelSectionConfig = {
  // label: t('Annotations and layers'),
  label: t('注释和图层'),
  tabOverride: 'data',
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'annotation_layers',
        config: {
          type: 'AnnotationLayerControl',
          label: '',
          default: [],
          // description: t('Annotation layers'),
          description: t('注释层'),
          renderTrigger: true,
          tabOverride: 'data',
        },
      },
    ],
  ],
};

export const NVD3TimeSeries: ControlPanelSectionConfig[] = [
  {
    // label: t('Query'),
    label: t('查询'),
    expanded: true,
    controlSetRows: [
      ['metrics'],
      ['adhoc_filters'],
      ['groupby'],
      ['limit', 'timeseries_limit_metric'],
      ['order_desc'],
      [
        {
          name: 'contribution',
          config: {
            type: 'CheckboxControl',
            // label: t('Contribution'),
            label: t('贡献'),
            default: false,
            // description: t('Compute the contribution to the total'),
            description: t('计算对总和的贡献'),
          },
        },
      ],
      ['row_limit', null],
    ],
  },
  {
    // label: t('Advanced analytics'),
    label: t('高级分析'),
    tabOverride: 'data',
    // description: t(
    //   'This section contains options ' +
    //     'that allow for advanced analytical post processing ' +
    //     'of query results',
    // ),
    description: t(
      '本节包含选项 ' +
        '允许进行高级分析后处理 ' +
        '查询结果',
    ),
    controlSetRows: [
      [
        <ControlSubSectionHeader>
          {/* {t('Rolling window')} */}
          {t('滚动窗口')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'rolling_type',
          config: {
            type: 'SelectControl',
            // label: t('Rolling function'),
            label: t('滚动函数'),
            default: 'None',
            // choices: [
            //   ['None', t('None')],
            //   ['mean', t('mean')],
            //   ['sum', t('sum')],
            //   ['std', t('std')],
            //   ['cumsum', t('cumsum')],
            // ],
            // description: t(
            //   'Defines a rolling window function to apply, works along ' +
            //     'with the [Periods] text box',
            // ),
            choices: [
              ['None', t('无')],
              ['mean', t('平均')],
              ['sum', t('求和')],
              ['std', t('标准差')],
              ['cumsum', t('累计和')],
            ],
            description: t(
              '定义一个滚动窗口函数，沿此应用 ' +
                '带有 [周期] 文本框',
            ),
          },
        },
        {
          name: 'rolling_periods',
          config: {
            type: 'TextControl',
            // label: t('Periods'),
            label: t('周期'),
            isInt: true,
            // description: t(
            //   'Defines the size of the rolling window function, ' +
            //     'relative to the time granularity selected',
            // ),
            description: t(
              '定义滚动窗口函数的大小 ' +
                '根据选择的时间粒度',
            ),
          },
        },
        {
          name: 'min_periods',
          config: {
            type: 'TextControl',
            // label: t('Min periods'),
            label: t('最小周期'),
            isInt: true,
            // description: t(
            //   'The minimum number of rolling periods required to show ' +
            //     'a value. For instance if you do a cumulative sum on 7 days ' +
            //     'you may want your "Min Period" to be 7, so that all data points ' +
            //     'shown are the total of 7 periods. This will hide the "ramp up" ' +
            //     'taking place over the first 7 periods',
            // ),
            description: t(
              '所需的最小滚动周期数以显示 ' +
                '值。例如，如果你对 7 天的数据进行累计求和。 ' +
                '你可能希望你的"Min Period"为 7，这样所有数据点 ' +
                '显示的是 7 个周期的总和。这将隐藏“ramp up”部分。" ' +
                '在前 7 个时期进行',
            ),
          },
        },
      ],
      [
        <ControlSubSectionHeader>
          {/* {t('Time comparison')} */}
          {t('时间比较')}
        </ControlSubSectionHeader>,
      ],
      [
        {
          name: 'time_compare',
          config: {
            type: 'SelectControl',
            multi: true,
            freeForm: true,
            // label: t('Time shift'),
            label: t('时间移位'),
            // choices: [
            //   ['1 day', t('1 day')],
            //   ['1 week', t('1 week')],
            //   ['28 days', t('28 days')],
            //   ['30 days', t('30 days')],
            //   ['52 weeks', t('52 weeks')],
            //   ['1 year', t('1 year')],
            //   ['104 weeks', t('104 weeks')],
            //   ['2 years', t('2 years')],
            //   ['156 weeks', t('156 weeks')],
            //   ['3 years', t('3 years')],
            // ],
            // description: t(
            //   'Overlay one or more timeseries from a ' +
            //     'relative time period. Expects relative time deltas ' +
            //     'in natural language (example: 24 hours, 7 days, ' +
            //     '52 weeks, 365 days). Free text is supported.',
            // ),
            choices: [
              ['1 day', t('1 天')],
              ['1 week', t('1 周')],
              ['28 days', t('28 天')],
              ['30 days', t('30 天')],
              ['52 weeks', t('52 周')],
              ['1 year', t('1 年')],
              ['104 weeks', t('104 周')],
              ['2 years', t('2 年')],
              ['156 weeks', t('156 周')],
              ['3 years', t('3 年')],
            ],
            description: t(
              '从一个或多个时间序列中叠加一次或多次 ' +
                '相对时间周期。期望相对时间差。 ' +
                '在自然语言（例如：24 小时，7 天，） ' +
                '52 weeks, 365 days). Free text is supported.',
            ),
          },
        },
        {
          name: 'comparison_type',
          config: {
            type: 'SelectControl',
            label: t('Calculation type'),
            default: 'values',
            choices: [
              ['values', t('Actual values')],
              ['absolute', t('Difference')],
              ['percentage', t('Percentage change')],
              ['ratio', t('Ratio')],
            ],
            description: t(
              'How to display time shifts: as individual lines; as the ' +
                'difference between the main time series and each time shift; ' +
                'as the percentage change; or as the ratio between series and time shifts.',
            ),
          },
        },
      ],
      [<ControlSubSectionHeader>{t('Resample')}</ControlSubSectionHeader>],
      [
        {
          name: 'resample_rule',
          config: {
            type: 'SelectControl',
            freeForm: true,
            label: t('Rule'),
            default: null,
            choices: [
              ['1T', t('1T')],
              ['1H', t('1H')],
              ['1D', t('1D')],
              ['7D', t('7D')],
              ['1M', t('1M')],
              ['1AS', t('1AS')],
            ],
            description: t('Pandas resample rule'),
          },
        },
        {
          name: 'resample_method',
          config: {
            type: 'SelectControl',
            freeForm: true,
            label: t('Method'),
            default: null,
            choices: [
              ['asfreq', t('asfreq')],
              ['bfill', t('bfill')],
              ['ffill', t('ffill')],
              ['median', t('median')],
              ['mean', t('mean')],
              ['sum', t('sum')],
            ],
            description: t('Pandas resample method'),
          },
        },
      ],
    ],
  },
];
