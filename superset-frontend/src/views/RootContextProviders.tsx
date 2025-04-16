/**
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

import { Route } from 'react-router-dom';
import { getExtensionsRegistry, ThemeProvider } from '@superset-ui/core';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryParamProvider } from 'use-query-params';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import getBootstrapData from 'src/utils/getBootstrapData';
import { AntdThemeProvider } from '../components/AntdThemeProvider';
import { store } from './store';
import FlashProvider from '../components/FlashProvider';
import { theme } from '../preamble';
import { EmbeddedUiConfigProvider } from '../components/UiConfigContext';
import { DynamicPluginProvider } from '../components/DynamicPlugins';

const { common } = getBootstrapData();

const extensionsRegistry = getExtensionsRegistry();

export const RootContextProviders: React.FC = ({ children }) => {
  const RootContextProviderExtension = extensionsRegistry.get(
    'root.context.provider',
  );

  return (
    <ThemeProvider theme={theme}>
      <AntdThemeProvider>
        <ReduxProvider store={store}>
          <DndProvider backend={HTML5Backend}>
            <FlashProvider messages={common.flash_messages}>
              <EmbeddedUiConfigProvider>
                <DynamicPluginProvider>
                  <QueryParamProvider
                    ReactRouterRoute={Route}
                    stringifyOptions={{ encode: false }}
                  >
                    {RootContextProviderExtension ? (
                      <RootContextProviderExtension>
                        {children}
                      </RootContextProviderExtension>
                    ) : (
                      children
                    )}
                  </QueryParamProvider>
                </DynamicPluginProvider>
              </EmbeddedUiConfigProvider>
            </FlashProvider>
          </DndProvider>
        </ReduxProvider>
      </AntdThemeProvider>
    </ThemeProvider>
  );
};
