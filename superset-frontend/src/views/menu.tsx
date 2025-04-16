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
import 'src/public-path';

// Menu 应用程序。用于布局中尚未包含 Menu 组件的视图中。
// 例如，后端渲染的视图
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom';
import { Route, BrowserRouter } from 'react-router-dom';
import { CacheProvider } from '@emotion/react';
import { QueryParamProvider } from 'use-query-params';
import createCache from '@emotion/cache';
import { ThemeProvider } from '@superset-ui/core';
import Menu from 'src/features/home/Menu';
import { theme } from 'src/preamble';
import { AntdThemeProvider } from 'src/components/AntdThemeProvider';
import getBootstrapData from 'src/utils/getBootstrapData';
import { setupStore } from './store';

// 禁用连接到 redux 调试器，以便注入到菜单下方的 React 应用程序
// （如 SqlLab 或 Explore）可以将其 redux store 连接到调试器
const store = setupStore({ disableDebugger: true });
const bootstrapData = getBootstrapData();
const menu = { ...bootstrapData.common.menu_data };

const emotionCache = createCache({
  key: 'menu',
});

const app = (
  // @ts-ignore: emotion 类型定义在 core 和 cache 之间不兼容
  <CacheProvider value={emotionCache}>
    <ThemeProvider theme={theme}>
      <AntdThemeProvider>
        <Provider store={store}>
          <BrowserRouter>
            <QueryParamProvider
              ReactRouterRoute={Route}
              stringifyOptions={{ encode: false }}
            >
              <Menu data={menu} />
            </QueryParamProvider>
          </BrowserRouter>
        </Provider>
      </AntdThemeProvider>
    </ThemeProvider>
  </CacheProvider>
);

ReactDOM.render(app, document.getElementById('app-menu'));