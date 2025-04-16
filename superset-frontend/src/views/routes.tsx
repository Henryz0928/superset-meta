/**
 * 授权给 Apache 软件基金会(ASF)，基于一个或多个贡献者
 * 许可协议。有关详细信息，请参阅随本作品分发的
 * NOTICE 文件，了解版权所有权相关信息。
 * ASF 根据 Apache 许可证 2.0 版（"许可证"）
 * 向您授予本文件的使用许可；除非符合许可证的
 * 要求，否则您不得使用此文件。
 * 您可以在以下位置获取许可证副本：
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * 除非适用法律要求或书面同意，根据许可证分发的
 * 软件是基于"按原样"分发的，不附带任何明示或
 * 暗示的担保或条件。请参阅许可证了解具体的
 * 权限和限制。
 */
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { lazy, ComponentType, ComponentProps } from 'react';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import getBootstrapData from 'src/utils/getBootstrapData';

// 由于这是首页，所以不进行懒加载
import Home from 'src/pages/Home';

const ChartCreation = lazy(
  () =>
    import(/* webpackChunkName: "ChartCreation" */ 'src/pages/ChartCreation'),
);

const AnnotationLayerList = lazy(
  () =>
    import(
      /* webpackChunkName: "AnnotationLayerList" */ 'src/pages/AnnotationLayerList'
    ),
);

const AlertReportList = lazy(
  () =>
    import(
      /* webpackChunkName: "AlertReportList" */ 'src/pages/AlertReportList'
    ),
);

const AnnotationList = lazy(
  () =>
    import(/* webpackChunkName: "AnnotationList" */ 'src/pages/AnnotationList'),
);

const ChartList = lazy(
  () => import(/* webpackChunkName: "ChartList" */ 'src/pages/ChartList'),
);

const CssTemplateList = lazy(
  () =>
    import(
      /* webpackChunkName: "CssTemplateList" */ 'src/pages/CssTemplateList'
    ),
);

const DashboardList = lazy(
  () =>
    import(/* webpackChunkName: "DashboardList" */ 'src/pages/DashboardList'),
);

const Dashboard = lazy(
  () => import(/* webpackChunkName: "Dashboard" */ 'src/pages/Dashboard'),
);

const DatabaseList = lazy(
  () => import(/* webpackChunkName: "DatabaseList" */ 'src/pages/DatabaseList'),
);

const DatasetList = lazy(
  () => import(/* webpackChunkName: "DatasetList" */ 'src/pages/DatasetList'),
);

const DatasetCreation = lazy(
  () =>
    import(
      /* webpackChunkName: "DatasetCreation" */ 'src/pages/DatasetCreation'
    ),
);

const ExecutionLogList = lazy(
  () =>
    import(
      /* webpackChunkName: "ExecutionLogList" */ 'src/pages/ExecutionLogList'
    ),
);

const Chart = lazy(
  () => import(/* webpackChunkName: "Chart" */ 'src/pages/Chart'),
);

const QueryHistoryList = lazy(
  () =>
    import(
      /* webpackChunkName: "QueryHistoryList" */ 'src/pages/QueryHistoryList'
    ),
);

const SavedQueryList = lazy(
  () =>
    import(/* webpackChunkName: "SavedQueryList" */ 'src/pages/SavedQueryList'),
);

const SqlLab = lazy(
  () => import(/* webpackChunkName: "SqlLab" */ 'src/pages/SqlLab'),
);

const AllEntities = lazy(
  () => import(/* webpackChunkName: "AllEntities" */ 'src/pages/AllEntities'),
);

const Tags = lazy(
  () => import(/* webpackChunkName: "Tags" */ 'src/pages/Tags'),
);

const RowLevelSecurityList = lazy(
  () =>
    import(
      /* webpackChunkName: "RowLevelSecurityList" */ 'src/pages/RowLevelSecurityList'
    ),
);

const RolesList = lazy(
  () => import(/* webpackChunkName: "RolesList" */ 'src/pages/RolesList'),
);

type Routes = {
  path: string;
  Component: ComponentType;
  Fallback?: ComponentType;
  props?: ComponentProps<any>;
}[];

export const routes: Routes = [
  {
    path: '/superset/welcome/',
    Component: Home,
  },
  {
    path: '/dashboard/list/',
    Component: DashboardList,
  },
  {
    path: '/superset/dashboard/:idOrSlug/',
    Component: Dashboard,
  },
  {
    path: '/chart/add',
    Component: ChartCreation,
  },
  {
    path: '/chart/list/',
    Component: ChartList,
  },
  {
    path: '/tablemodelview/list/',
    Component: DatasetList,
  },
  {
    path: '/databaseview/list/',
    Component: DatabaseList,
  },
  {
    path: '/savedqueryview/list/',
    Component: SavedQueryList,
  },
  {
    path: '/csstemplatemodelview/list/',
    Component: CssTemplateList,
  },
  {
    path: '/annotationlayer/list/',
    Component: AnnotationLayerList,
  },
  {
    path: '/annotationlayer/:annotationLayerId/annotation/',
    Component: AnnotationList,
  },
  {
    path: '/sqllab/history/',
    Component: QueryHistoryList,
  },
  {
    path: '/alert/list/',
    Component: AlertReportList,
  },
  {
    path: '/report/list/',
    Component: AlertReportList,
    props: {
      isReportEnabled: true,
    },
  },
  {
    path: '/alert/:alertId/log/',
    Component: ExecutionLogList,
  },
  {
    path: '/report/:alertId/log/',
    Component: ExecutionLogList,
    props: {
      isReportEnabled: true,
    },
  },
  {
    path: '/explore/',
    Component: Chart,
  },
  {
    path: '/superset/explore/p',
    Component: Chart,
  },
  {
    path: '/dataset/add/',
    Component: DatasetCreation,
  },
  {
    path: '/dataset/:datasetId',
    Component: DatasetCreation,
  },
  {
    path: '/rowlevelsecurity/list',
    Component: RowLevelSecurityList,
  },
  {
    path: '/sqllab/',
    Component: SqlLab,
  },
];

if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
  routes.push({
    path: '/superset/all_entities/',
    Component: AllEntities,
  });
  routes.push({
    path: '/superset/tags/',
    Component: Tags,
  });
}

const user = getBootstrapData()?.user;
const isAdmin = isUserAdmin(user);

if (isAdmin) {
  routes.push({
    path: '/roles/',
    Component: RolesList,
  });
}
// 从前端路由路径创建映射
const frontEndRoutes: Record<string, boolean> = routes
  .map(r => r.path)
  .reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: true,
    }),
    {},
  );

export const isFrontendRoute = (path?: string): boolean => {
  if (path) {
    const basePath = path.split(/[?#]/)[0]; // 剥离查询参数和链接书签
    return !!frontEndRoutes[basePath];
  }
  return false;
};
