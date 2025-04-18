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
import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import transformProps from './transformProps';
import buildQuery from './buildQuery';
import example1 from './images/example1.png';
import example2 from './images/example2.png';
import example3 from './images/example3.png';
import thumbnail from './images/thumbnail.png';
import controlPanel from './controlPanel';

const metadata = new ChartMetadata({
  // category: t('Correlation'),
  // description: t(
  //   'Visualize a related metric across pairs of groups. Heatmaps excel at showcasing the correlation or strength between two groups. Color is used to emphasize the strength of the link between each pair of groups.',
  // ),
  category: t('相关性'),
  description: t(
    '可视化两个组之间的相关度或强度。热图擅长展示两个组之间的相关性或强度。颜色用于强调每对组之间的联系强度。',
  ),
  exampleGallery: [{ url: example1 }, { url: example2 }, { url: example3 }],
  // name: t('Heatmap'),
  // tags: [
  //   t('Business'),
  //   t('Intensity'),
  //   t('Density'),
  //   t('Single Metric'),
  //   t('ECharts'),
  //   t('Featured'),
  // ],
  name: t('热力图'),
  tags: [
    t('商业'),
    t('强度'),
    t('密度'),
    t('单个度量'),
    t('ECharts'),
    t('特色'),
  ],
  thumbnail,
});

export default class EchartsHeatmapChartPlugin extends ChartPlugin {
  constructor() {
    super({
      buildQuery,
      loadChart: () => import('./Heatmap'),
      metadata,
      transformProps,
      controlPanel,
    });
  }
}
