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
import {
  configureStore,
  ConfigureStoreOptions,
  StoreEnhancer,
} from '@reduxjs/toolkit';
import thunk from 'redux-thunk';
import { api } from 'src/hooks/apiResources/queryApi';
import messageToastReducer from 'src/components/MessageToasts/reducers';
import charts from 'src/components/Chart/chartReducer';
import dataMask from 'src/dataMask/reducer';
import reports from 'src/features/reports/ReportModal/reducer';
import dashboardInfo from 'src/dashboard/reducers/dashboardInfo';
import dashboardState from 'src/dashboard/reducers/dashboardState';
import dashboardFilters from 'src/dashboard/reducers/dashboardFilters';
import nativeFilters from 'src/dashboard/reducers/nativeFilters';
import dashboardDatasources from 'src/dashboard/reducers/datasources';
import sliceEntities from 'src/dashboard/reducers/sliceEntities';
import dashboardLayout from 'src/dashboard/reducers/undoableDashboardLayout';
import logger from 'src/middleware/loggerMiddleware';
import saveModal from 'src/explore/reducers/saveModalReducer';
import explore from 'src/explore/reducers/exploreReducer';
import exploreDatasources from 'src/explore/reducers/datasourcesReducer';

import { persistSqlLabStateEnhancer } from 'src/SqlLab/middlewares/persistSqlLabStateEnhancer';
import sqlLabReducer from 'src/SqlLab/reducers/sqlLab';
import getInitialState from 'src/SqlLab/reducers/getInitialState';
import { DatasourcesState } from 'src/dashboard/types';
import {
  DatasourcesActionPayload,
  DatasourcesAction,
} from 'src/dashboard/actions/datasources';
import { nanoid } from 'nanoid';
import {
  BootstrapUser,
  UndefinedUser,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { AnyDatasourcesAction } from 'src/explore/actions/datasourcesActions';
import { HydrateExplore } from 'src/explore/actions/hydrateExplore';
import getBootstrapData from 'src/utils/getBootstrapData';
import { Dataset } from '@superset-ui/chart-controls';

// 某些 reducer 不做任何操作，Redux 仅用于引用初始"状态"。
// 随着客户端应用程序承担更多责任，这种情况可能会改变。
const noopReducer =
  <STATE = unknown>(initialState: STATE) =>
  (state: STATE = initialState) =>
    state;

const bootstrapData = getBootstrapData();

export const USER_LOADED = 'USER_LOADED';

export type UserLoadedAction = {
  type: typeof USER_LOADED;
  user: UserWithPermissionsAndRoles;
};

export const userReducer = (
  user = bootstrapData.user || {},
  action: UserLoadedAction,
): BootstrapUser | UndefinedUser => {
  if (action.type === USER_LOADED) {
    return action.user;
  }
  return user;
};

const getMiddleware: ConfigureStoreOptions['middleware'] =
  getDefaultMiddleware =>
    process.env.REDUX_DEFAULT_MIDDLEWARE
      ? getDefaultMiddleware({
          immutableCheck: {
            warnAfter: 200,
          },
          serializableCheck: {
            // Ignores AbortController instances
            ignoredActionPaths: [/queryController/g],
            ignoredPaths: [/queryController/g],
            warnAfter: 200,
          },
        }).concat(logger, api.middleware)
      : [thunk, logger, api.middleware];

// TODO: 这个 reducer 是 Dashboard 和 Explore reducer 的组合。
// 正确的处理方式是在共享文件中统一这两个模块的 action 和 reducer。
// 这涉及一个统一参数类型和移动文件的大型重构。我们应该在一个专门的 PR 中处理这个问题。
const CombinedDatasourceReducers = (
  datasources: DatasourcesState | undefined | { [key: string]: Dataset },
  action: DatasourcesActionPayload | AnyDatasourcesAction | HydrateExplore,
) => {
  if (action.type === DatasourcesAction.SetDatasources) {
    return dashboardDatasources(
      datasources as DatasourcesState | undefined,
      action as DatasourcesActionPayload,
    );
  }
  return exploreDatasources(
    datasources as { [key: string]: Dataset },
    action as AnyDatasourcesAction | HydrateExplore,
  );
};

const reducers = {
  sqlLab: sqlLabReducer,
  localStorageUsageInKilobytes: noopReducer(0),
  messageToasts: messageToastReducer,
  common: noopReducer(bootstrapData.common),
  user: userReducer,
  impressionId: noopReducer(nanoid()),
  charts,
  datasources: CombinedDatasourceReducers,
  dashboardInfo,
  dashboardFilters,
  dataMask,
  nativeFilters,
  dashboardState,
  dashboardLayout,
  sliceEntities,
  reports,
  saveModal,
  explore,
};

/* 在某些情况下，jinja 模板会在 basic.html 中注入两个独立的 React 应用
 * 一个用于顶部导航菜单，另一个用于菜单下方的应用程序
 * 第一个连接到 Redux 调试器的应用会获胜，这就是菜单阻止
 * 应用程序连接到 Redux 调试器的原因。
 * 使用 disableDebugger 为 true 的 setupStore 可以让 menu.tsx 组件避免连接
 * Redux 调试器，从而使应用程序可以连接到 Redux 调试器
 */
export function setupStore({
  disableDebugger = false,
  initialState = getInitialState(bootstrapData),
  rootReducers = reducers,
  ...overrides
}: {
  disableDebugger?: boolean;
  initialState?: ConfigureStoreOptions['preloadedState'];
  rootReducers?: ConfigureStoreOptions['reducer'];
} & Partial<ConfigureStoreOptions> = {}) {
  return configureStore({
    preloadedState: initialState,
    reducer: {
      [api.reducerPath]: api.reducer,
      ...rootReducers,
    },
    middleware: getMiddleware,
    devTools: process.env.WEBPACK_MODE === 'development' && !disableDebugger,
    enhancers: [persistSqlLabStateEnhancer as StoreEnhancer],
    ...overrides,
  });
}

export const store = setupStore();
export type RootState = ReturnType<typeof store.getState>;
