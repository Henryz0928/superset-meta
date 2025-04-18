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
import { useEffect, SetStateAction, Dispatch, useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import TableSelector, { TableOption } from 'src/components/TableSelector';
import { DatabaseObject } from 'src/components/DatabaseSelector';
import { EmptyState } from 'src/components/EmptyState';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { LocalStorageKeys, getItem } from 'src/utils/localStorageHelpers';
import {
  DatasetActionType,
  DatasetObject,
} from 'src/features/datasets/AddDataset/types';
import { Table } from 'src/hooks/apiResources';

interface LeftPanelProps {
  setDataset: Dispatch<SetStateAction<object>>;
  dataset?: Partial<DatasetObject> | null;
  datasetNames?: (string | null | undefined)[] | undefined;
}

const LeftPanelStyle = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 4}px;
    height: 100%;
    background-color: ${theme.colors.grayscale.light5};
    position: relative;
    .emptystate {
      height: auto;
      margin-top: ${theme.gridUnit * 17.5}px;
    }
    .section-title {
      margin-top: ${theme.gridUnit * 5.5}px;
      margin-bottom: ${theme.gridUnit * 11}px;
      font-weight: ${theme.typography.weights.bold};
    }
    .table-title {
      margin-top: ${theme.gridUnit * 11}px;
      margin-bottom: ${theme.gridUnit * 6}px;
      font-weight: ${theme.typography.weights.bold};
    }
    .options-list {
      overflow: auto;
      position: absolute;
      bottom: 0;
      top: ${theme.gridUnit * 92.25}px;
      left: ${theme.gridUnit * 3.25}px;
      right: 0;

      .no-scrollbar {
        margin-right: ${theme.gridUnit * 4}px;
      }

      .options {
        cursor: pointer;
        padding: ${theme.gridUnit * 1.75}px;
        border-radius: ${theme.borderRadius}px;
        :hover {
          background-color: ${theme.colors.grayscale.light4}
        }
      }

      .options-highlighted {
        cursor: pointer;
        padding: ${theme.gridUnit * 1.75}px;
        border-radius: ${theme.borderRadius}px;
        background-color: ${theme.colors.primary.dark1};
        color: ${theme.colors.grayscale.light5};
      }

      .options, .options-highlighted {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }
    form > span[aria-label="refresh"] {
      position: absolute;
      top: ${theme.gridUnit * 69}px;
      left: ${theme.gridUnit * 42.75}px;
      font-size: ${theme.gridUnit * 4.25}px;
    }
    .table-form {
      margin-bottom: ${theme.gridUnit * 8}px;
    }
    .loading-container {
      position: absolute;
      top: ${theme.gridUnit * 89.75}px;
      left: 0;
      right: 0;
      text-align: center;
      img {
        width: ${theme.gridUnit * 20}px;
        margin-bottom: ${theme.gridUnit * 2.5}px;
      }
      p {
        color: ${theme.colors.grayscale.light1};
      }
    }
`}
`;

export default function LeftPanel({
  setDataset,
  dataset,
  datasetNames,
}: LeftPanelProps) {
  const { addDangerToast } = useToasts();

  const setDatabase = useCallback(
    (db: Partial<DatabaseObject>) => {
      setDataset({ type: DatasetActionType.SelectDatabase, payload: { db } });
    },
    [setDataset],
  );
  const setCatalog = (catalog: string | null) => {
    if (catalog) {
      setDataset({
        type: DatasetActionType.SelectCatalog,
        payload: { name: 'catalog', value: catalog },
      });
    }
  };
  const setSchema = (schema: string) => {
    if (schema) {
      setDataset({
        type: DatasetActionType.SelectSchema,
        payload: { name: 'schema', value: schema },
      });
    }
  };
  const setTable = (tableName: string) => {
    setDataset({
      type: DatasetActionType.SelectTable,
      payload: { name: 'table_name', value: tableName },
    });
  };
  useEffect(() => {
    const currentUserSelectedDb = getItem(
      LocalStorageKeys.Database,
      null,
    ) as DatabaseObject;
    if (currentUserSelectedDb) {
      setDatabase(currentUserSelectedDb);
    }
  }, [setDatabase]);

  const customTableOptionLabelRenderer = useCallback(
    (table: Table) => (
      <TableOption
        table={
          datasetNames?.includes(table.value)
            ? {
                ...table,
                extra: {
                  // warning_markdown: t('This table already has a dataset'),
                  warning_markdown: t('这张表已经有一个数据集'),
                },
              }
            : table
        }
      />
    ),
    [datasetNames],
  );
  const getDatabaseEmptyState = (emptyResultsWithSearch: boolean) => (
    <EmptyState
      image="empty.svg"
      // title={
      //   emptyResultsWithSearch
      //     ? t('No databases match your search')
      //     : t('No databases available')
      // }
      title={
        emptyResultsWithSearch
          ? t('没有数据库匹配您的搜索')
          : t('没有可用的数据库')
      }
      description={
        <span>
          {/* {t('Manage your databases')}{' '}
          <a href="/databaseview/list">{t('here')}</a> */}
          {t('管理您的数据库')}{' '}
          <a href="/databaseview/list">{t('这里')}</a>
        </span>
      }
      size="small"
    />
  );

  return (
    <LeftPanelStyle>
      <TableSelector
        database={dataset?.db}
        handleError={addDangerToast}
        emptyState={getDatabaseEmptyState(false)}
        onDbChange={setDatabase}
        onCatalogChange={setCatalog}
        onSchemaChange={setSchema}
        onTableSelectChange={setTable}
        sqlLabMode={false}
        customTableOptionLabelRenderer={customTableOptionLabelRenderer}
        {...(dataset?.catalog && { catalog: dataset.catalog })}
        {...(dataset?.schema && { schema: dataset.schema })}
      />
    </LeftPanelStyle>
  );
}
