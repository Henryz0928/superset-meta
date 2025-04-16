/**
 * 根据 Apache License 2.0 版本（"许可证"）授权；
 * 除非遵守许可证，否则您不得使用此文件。
 * 您可以在以下位置获取许可证副本：
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * 除非适用法律要求或书面同意，
 * 根据许可证分发的软件是基于"按原样"分发的，
 * 不附带任何明示或暗示的担保或条件。
 * 有关许可证下特定语言的权限和限制，
 * 请参见许可证。
 */
import { Suspense, useEffect } from 'react';
import { hot } from 'react-hot-loader/root';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  useLocation,
} from 'react-router-dom';
import { bindActionCreators } from 'redux';
import { css } from '@superset-ui/core';
import { GlobalStyles } from 'src/GlobalStyles';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Loading from 'src/components/Loading';
import { Layout } from 'src/components';
import Menu from 'src/features/home/Menu';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import setupApp from 'src/setup/setupApp';
import setupPlugins from 'src/setup/setupPlugins';
import { setupAGGridModules } from 'src/setup/setupAGGridModules';
import { routes, isFrontendRoute } from 'src/views/routes';
import { Logger, LOG_ACTIONS_SPA_NAVIGATION } from 'src/logger/LogUtils';
import setupExtensions from 'src/setup/setupExtensions';
import { logEvent } from 'src/logger/actions';
import { store } from 'src/views/store';
import { RootContextProviders } from './RootContextProviders';
import { ScrollToTop } from './ScrollToTop';

setupApp();
setupPlugins();
setupExtensions();
setupAGGridModules();

const bootstrapData = getBootstrapData();

// 存储上一次访问的路径
let lastLocationPathname: string;

const boundActions = bindActionCreators({ logEvent }, store.dispatch);

// 路径日志记录器组件
const LocationPathnameLogger = () => {
  const location = useLocation();
  useEffect(() => {
    // 记录单页应用用户导航的客户端路由变化
    boundActions.logEvent(LOG_ACTIONS_SPA_NAVIGATION, {
      path: location.pathname,
    });
    // 重置性能日志计时器起点，避免软导航
    // 导致仪表板性能测量出现问题
    if (lastLocationPathname && lastLocationPathname !== location.pathname) {
      Logger.markTimeOrigin();
    }
    lastLocationPathname = location.pathname;
  }, [location.pathname]);
  return <></>;
};

// 主应用组件
const App = () => (
  <Router basename={applicationRoot()}>
    <ScrollToTop />
    <LocationPathnameLogger />
    <RootContextProviders>
      <GlobalStyles />
      <Menu
        data={bootstrapData.common.menu_data}
        isFrontendRoute={isFrontendRoute}
      />
      <Switch>
        {routes.map(({ path, Component, props = {}, Fallback = Loading }) => (
          <Route path={path} key={path}>
            <Suspense fallback={<Fallback />}>
              <Layout.Content
                css={css`
                  display: flex;
                  flex-direction: column;
                `}
              >
                <ErrorBoundary
                  css={css`
                    margin: 16px;
                  `}
                >
                  <Component user={bootstrapData.user} {...props} />
                </ErrorBoundary>
              </Layout.Content>
            </Suspense>
          </Route>
        ))}
      </Switch>
      <ToastContainer />
    </RootContextProviders>
  </Router>
);

// 导出热更新包装的应用组件
export default hot(App);
