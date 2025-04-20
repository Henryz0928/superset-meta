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
import { useMemo, useState, useCallback, ReactElement } from 'react';
import { Link, useHistory } from 'react-router-dom';
import {
  css,
  QueryState,
  styled,
  SupersetClient,
  t,
  useTheme,
} from '@superset-ui/core';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
  shortenSQL,
} from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import Label from 'src/components/Label';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import Popover from 'src/components/Popover';
import { commonMenuData } from 'src/features/home/commonMenuData';
import ListView, {
  Filters,
  FilterOperator,
  ListViewProps,
} from 'src/components/ListView';
import { Tooltip } from 'src/components/Tooltip';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { DATETIME_WITH_TIME_ZONE, TIME_WITH_MS } from 'src/constants';
import { QueryObject, QueryObjectColumns } from 'src/views/CRUD/types';

import { Icons } from 'src/components/Icons';
import QueryPreviewModal from 'src/features/queries/QueryPreviewModal';
import { addSuccessToast } from 'src/components/MessageToasts/actions';
import getOwnerName from 'src/utils/getOwnerName';
import { extendedDayjs } from 'src/utils/dates';

const PAGE_SIZE = 25;
const SQL_PREVIEW_MAX_LINES = 4;

const TopAlignedListView = styled(ListView)<ListViewProps<QueryObject>>`
  table .table-cell {
    vertical-align: top;
  }
`;

SyntaxHighlighter.registerLanguage('sql', sql);
const StyledSyntaxHighlighter = styled(SyntaxHighlighter)`
  height: ${({ theme }) => theme.gridUnit * 26}px;
  overflow: hidden !important; /* needed to override inline styles */
  text-overflow: ellipsis;
  white-space: nowrap;
`;

interface QueryListProps {
  addDangerToast: (msg: string, config?: any) => any;
  addSuccessToast: (msg: string, config?: any) => any;
}

const StyledTableLabel = styled.div`
  .count {
    margin-left: 5px;
    color: ${({ theme }) => theme.colors.primary.base};
    text-decoration: underline;
    cursor: pointer;
  }
`;

const StyledPopoverItem = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
`;

const TimerLabel = styled(Label)`
  text-align: left;
  font-family: ${({ theme }) => theme.typography.families.monospace};
`;

function QueryList({ addDangerToast }: QueryListProps) {
  const {
    state: { loading, resourceCount: queryCount, resourceCollection: queries },
    fetchData,
  } = useListViewResource<QueryObject>(
    'query',
    // t('Query history'),
    t('查询历史'),
    addDangerToast,
    false,
  );

  const [queryCurrentlyPreviewing, setQueryCurrentlyPreviewing] =
    useState<QueryObject>();

  const theme = useTheme();
  const history = useHistory();

  const handleQueryPreview = useCallback(
    (id: number) => {
      SupersetClient.get({
        endpoint: `/api/v1/query/${id}`,
      }).then(
        ({ json = {} }) => {
          setQueryCurrentlyPreviewing({ ...json.result });
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            // t('There was an issue previewing the selected query. %s', errMsg),
            t('预览所选查询时出现了一些问题。 %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Query history',
    ...commonMenuData,
  };

  const initialSort = [{ id: QueryObjectColumns.StartTime, desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { status },
          },
        }: {
          row: {
            original: {
              status: QueryState;
            };
          };
        }) => {
          const statusConfig: {
            name: ReactElement | null;
            label: string;
          } = {
            name: null,
            label: '',
          };
          if (status === QueryState.Success) {
            statusConfig.name = (
              <Icons.CheckOutlined
                iconSize="m"
                iconColor={theme.colors.success.base}
                css={css`
                  vertical-align: -webkit-baseline-middle;
                `}
              />
            );
            // statusConfig.label = t('Success');
            statusConfig.label = t('成功');
          } else if (
            status === QueryState.Failed ||
            status === QueryState.Stopped
          ) {
            statusConfig.name = (
              <Icons.CloseOutlined
                iconSize="xs"
                iconColor={
                  status === QueryState.Failed
                    ? theme.colors.error.base
                    : theme.colors.grayscale.base
                }
              />
            );
            // statusConfig.label = t('Failed');
            statusConfig.label = t('失败');
          } else if (status === QueryState.Running) {
            statusConfig.name = (
              <Icons.Running iconColor={theme.colors.primary.base} />
            );
            // statusConfig.label = t('Running');
            statusConfig.label = t('运行中');
          } else if (status === QueryState.TimedOut) {
            statusConfig.name = (
              <Icons.CircleSolid iconColor={theme.colors.grayscale.light1} />
            );
            // statusConfig.label = t('Offline');
            statusConfig.label = t('离线');
          } else if (
            status === QueryState.Scheduled ||
            status === QueryState.Pending
          ) {
            statusConfig.name = <Icons.Queued />;
            // statusConfig.label = t('Scheduled');
            statusConfig.label = t('计划中的');
          }
          return (
            <Tooltip title={statusConfig.label} placement="bottom">
              <span>{statusConfig.name}</span>
            </Tooltip>
          );
        },
        accessor: QueryObjectColumns.Status,
        size: 'xs',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.StartTime,
        // Header: t('Time'),
        Header: t('时间'),
        size: 'xl',
        Cell: ({
          row: {
            original: { start_time },
          },
        }: any) => {
          const start = extendedDayjs.utc(start_time).local();
          const formattedStartTimeData = start
            .format(DATETIME_WITH_TIME_ZONE)
            .split(' ');

          const formattedStartTime = (
            <>
              {formattedStartTimeData[0]} <br />
              {formattedStartTimeData[1]}
            </>
          );
          return formattedStartTime;
        },
      },
      {
        // Header: t('Duration'),
        Header: t('持续时间'),
        size: 'xl',
        Cell: ({
          row: {
            original: { status, start_time, end_time },
          },
        }: any) => {
          const timerType = status === QueryState.Failed ? 'danger' : status;
          const timerTime = end_time
            ? extendedDayjs(extendedDayjs.utc(end_time - start_time)).format(
                TIME_WITH_MS,
              )
            : '00:00:00.000';
          return (
            <TimerLabel type={timerType} role="timer">
              {timerTime}
            </TimerLabel>
          );
        },
      },
      {
        accessor: QueryObjectColumns.TabName,
        // Header: t('Tab name'),
        Header: t('标签名称'),
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.DatabaseName,
        // Header: t('Database'),
        Header: t('数据库'),
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.Database,
        hidden: true,
      },
      {
        accessor: QueryObjectColumns.Schema,
        Header: t('Schema'),
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { sql_tables: tables = [] },
          },
        }: any) => {
          const names = tables.map((table: any) => table.table);
          const main = names.length > 0 ? names.shift() : '';

          if (names.length) {
            return (
              <StyledTableLabel>
                <span>{main}</span>
                <Popover
                  placement="right"
                  // title={t('TABLES')}
                  title={t('表')}
                  trigger="click"
                  content={
                    <>
                      {names.map((name: string) => (
                        <StyledPopoverItem key={name}>{name}</StyledPopoverItem>
                      ))}
                    </>
                  }
                >
                  <span className="count">(+{names.length})</span>
                </Popover>
              </StyledTableLabel>
            );
          }

          return main;
        },
        accessor: QueryObjectColumns.SqlTables,
        // Header: t('Tables'),
        Header: t('表'),
        size: 'xl',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.UserFirstName,
        // Header: t('User'),
        Header: t('用户'),
        size: 'xl',
        Cell: ({
          row: {
            original: { user },
          },
        }: any) => getOwnerName(user),
      },
      {
        accessor: QueryObjectColumns.User,
        hidden: true,
      },
      {
        accessor: QueryObjectColumns.Rows,
        // Header: t('Rows'),
        Header: t('行'),
        size: 'md',
      },
      {
        accessor: QueryObjectColumns.Sql,
        Header: t('SQL'),
        Cell: ({ row: { original, id } }: any) => (
          <div
            tabIndex={0}
            role="button"
            data-test={`open-sql-preview-${id}`}
            onClick={() => setQueryCurrentlyPreviewing(original)}
          >
            <StyledSyntaxHighlighter language="sql" style={github}>
              {shortenSQL(original.sql, SQL_PREVIEW_MAX_LINES)}
            </StyledSyntaxHighlighter>
          </div>
        ),
      },
      {
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        disableSortBy: true,
        Cell: ({
          row: {
            original: { id },
          },
        }: any) => (
          <Tooltip title={t('Open query in SQL Lab')} placement="bottom">
            <Link to={`/sqllab?queryId=${id}`}>
              <Icons.Full iconSize="l" />
            </Link>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  const filters: Filters = useMemo(
    () => [
      {
        // Header: t('Database'),
        Header: t('数据库'),
        key: 'database',
        id: 'database',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        // unfilteredLabel: t('All'),
        unfilteredLabel: t('全部'),
        fetchSelects: createFetchRelated(
          'query',
          'database',
          createErrorHandler(errMsg =>
            addDangerToast(
              // t('An error occurred while fetching database values: %s', errMsg),
              t('获取数据库时发生错误: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        // Header: t('State'),
        Header: t('状态'),
        key: 'state',
        id: 'status',
        input: 'select',
        operator: FilterOperator.Equals,
        // unfilteredLabel: 'All',
        unfilteredLabel: '全部',
        fetchSelects: createFetchDistinct(
          'query',
          'status',
          createErrorHandler(errMsg =>
            addDangerToast(
              // t('An error occurred while fetching schema values: %s', errMsg),
              t('获取 schema 值时发生错误: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        // Header: t('User'),
        Header: t('用户'),
        key: 'user',
        id: 'user',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        // unfilteredLabel: 'All',
        unfilteredLabel: '全部',
        fetchSelects: createFetchRelated(
          'query',
          'user',
          createErrorHandler(errMsg =>
            addDangerToast(
              // t('An error occurred while fetching user values: %s', errMsg),
              t('获取用户时发生错误: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        // Header: t('Time range'),
        Header: t('时间范围'),
        key: 'start_time',
        id: 'start_time',
        input: 'datetime_range',
        operator: FilterOperator.Between,
      },
      {
        // Header: t('Search by query text'),
        Header: t('按查询文本搜索'),
        key: 'sql',
        id: 'sql',
        input: 'search',
        operator: FilterOperator.Contains,
      },
    ],
    [addDangerToast],
  );

  return (
    <>
      <SubMenu {...menuData} />
      {queryCurrentlyPreviewing && (
        <QueryPreviewModal
          onHide={() => setQueryCurrentlyPreviewing(undefined)}
          query={queryCurrentlyPreviewing}
          queries={queries}
          fetchData={handleQueryPreview}
          openInSqlLab={(id: number) => history.push(`/sqllab?queryId=${id}`)}
          show
        />
      )}
      <TopAlignedListView
        className="query-history-list-view"
        columns={columns}
        count={queryCount}
        data={queries}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        highlightRowId={queryCurrentlyPreviewing?.id}
        refreshData={() => {}}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
    </>
  );
}

export default withToasts(QueryList);
