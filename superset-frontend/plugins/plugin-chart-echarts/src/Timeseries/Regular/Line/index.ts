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
import { AnnotationType, Behavior, t } from '@superset-ui/core';
import {
  EchartsTimeseriesChartProps,
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
} from '../../types';
import buildQuery from '../../buildQuery';
import controlPanel from './controlPanel';
import transformProps from '../../transformProps';
import thumbnail from './images/thumbnail.png';
import example1 from './images/Line1.png';
import example2 from './images/Line2.png';
import { EchartsChartPlugin } from '../../../types';

const lineTransformProps = (chartProps: EchartsTimeseriesChartProps) =>
  transformProps({
    ...chartProps,
    formData: {
      ...chartProps.formData,
      seriesType: EchartsTimeseriesSeriesType.Line,
    },
  });

export default class EchartsTimeseriesLineChartPlugin extends EchartsChartPlugin<
  EchartsTimeseriesFormData,
  EchartsTimeseriesChartProps
> {
  constructor() {
    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../../EchartsTimeseries'),
      metadata: {
        behaviors: [
          Behavior.InteractiveChart,
          Behavior.DrillToDetail,
          Behavior.DrillBy,
        ],
        // category: t('Evolution'),
        // credits: ['https://echarts.apache.org'],
        // description: t(
        //   'Line chart is used to visualize measurements taken over a given category. Line chart is a type of chart which displays information as a series of data points connected by straight line segments. It is a basic type of chart common in many fields.',
        // ),
        category: t('演变'),
        credits: ['https://echarts.apache.org'],
        description: t(
          '折线图用于可视化给定类别下的测量值。折线图是一种通过直线段连接数据点来显示信息的图表。这是一种在许多领域常见的基本图表类型。',
        ),
        exampleGallery: [{ url: example1 }, { url: example2 }],
        supportedAnnotationTypes: [
          AnnotationType.Event,
          AnnotationType.Formula,
          AnnotationType.Interval,
          AnnotationType.Timeseries,
        ],
        // name: t('Line Chart'),
        // tags: [
        //   t('ECharts'),
        //   t('Predictive'),
        //   t('Advanced-Analytics'),
        //   t('Line'),
        //   t('Featured'),
        // ],
        name: t('折线图'),
        tags: [
          t('ECharts'),
          t('预测'),
          t('高级分析'),
          t('行'),
          t('特色'),
        ],
        thumbnail,
      },
      transformProps: lineTransformProps,
    });
  }
}
