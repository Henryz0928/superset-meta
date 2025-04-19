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
import { ControlPanelSectionConfig } from '../types';

// A few standard controls sections that are used internally.
// Not recommended for use in third-party plugins.

const baseTimeSection = {
  // label: t('Time'),
  label: t('时间'),
  expanded: true,
  // description: t('Time related form attributes'),
  description: t('时间相关的表单属性'),
};

export const legacyTimeseriesTime: ControlPanelSectionConfig = {
  ...baseTimeSection,
  controlSetRows: [
    ['granularity'],
    ['granularity_sqla'],
    ['time_grain_sqla'],
    ['time_range'],
  ],
};

export const datasourceAndVizType: ControlPanelSectionConfig = {
  // label: t('Datasource & Chart Type'),
  label: t('数据源 & 图表类型'),
  expanded: true,
  controlSetRows: [
    ['datasource'],
    ['viz_type'],
    [
      {
        name: 'slice_id',
        config: {
          type: 'HiddenControl',
          // label: t('Chart ID'),
          label: t('图表 ID'),
          hidden: true,
          // description: t('The id of the active chart'),
          description: t('当前活动图表的 ID'),
        },
      },
      {
        name: 'cache_timeout',
        config: {
          type: 'HiddenControl',
          // label: t('Cache Timeout (seconds)'),
          label: t('缓存超时（秒）'),
          hidden: true,
          // description: t('The number of seconds before expiring the cache'),
          description: t('缓存过期前的秒数'),
        },
      },
      {
        name: 'url_params',
        config: {
          type: 'HiddenControl',
          // label: t('URL Parameters'),
          label: t('URL 参数'),
          hidden: true,
          // description: t(
          //   'Extra url parameters for use in Jinja templated queries',
          // ),
          description: t(
            '额外的 URL 参数用于 Jinja 模板查询中',
          ),
        },
      },
      {
        name: 'custom_params',
        config: {
          type: 'HiddenControl',
          // label: t('Extra Parameters'),
          label: t('额外参数'),
          hidden: true,
          // description: t(
          //   'Extra parameters that any plugins can choose to set for use in Jinja templated queries',
          // ),
          description: t(
            '任何插件可以选择设置的额外参数，用于在 Jinja 模板查询中使用',
          ),
        },
      },
    ],
  ],
};

export const colorScheme: ControlPanelSectionConfig = {
  // label: t('Color Scheme'),
  label: t('颜色方案'),
  controlSetRows: [['color_scheme']],
};

export const annotations: ControlPanelSectionConfig = {
  // label: t('Annotations and Layers'),
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
          // description: t('Annotation Layers'),
          description: t('注释层'),
          renderTrigger: true,
        },
      },
    ],
  ],
};
