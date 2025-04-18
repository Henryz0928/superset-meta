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
import { t, styled, SupersetClient, useTheme, css } from '@superset-ui/core';
import { useMemo, useState } from 'react';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import { Icons } from 'src/components/Icons';
import ListView, {
  FetchDataConfig,
  FilterOperator,
  ListViewProps,
  Filters,
} from 'src/components/ListView';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Tooltip } from 'src/components/Tooltip';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import RowLevelSecurityModal from 'src/features/rls/RowLevelSecurityModal';
import { RLSObject } from 'src/features/rls/types';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';

const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

interface RLSProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function RowLevelSecurityList(props: RLSProps) {
  const { addDangerToast, addSuccessToast, user } = props;
  const [ruleModalOpen, setRuleModalOpen] = useState<boolean>(false);
  const [currentRule, setCurrentRule] = useState(null);
  const theme = useTheme();

  const {
    state: {
      loading,
      resourceCount: rulesCount,
      resourceCollection: rules,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<RLSObject>(
    'rowlevelsecurity',
    // t('Row Level Security'),
    '行级安全',
    addDangerToast,
    true,
    undefined,
    undefined,
    true,
  );

  function handleRuleEdit(rule: null) {
    setCurrentRule(rule);
    setRuleModalOpen(true);
  }

  function handleRuleDelete(
    { id, name }: RLSObject,
    refreshData: (arg0?: FetchDataConfig | null) => void,
    addSuccessToast: (arg0: string) => void,
    addDangerToast: (arg0: string) => void,
  ) {
    return SupersetClient.delete({
      endpoint: `/api/v1/rowlevelsecurity/${id}`,
    }).then(
      () => {
        refreshData();
        // addSuccessToast(t('Deleted %s', name));
        addSuccessToast('已删除 %s', name);
      },
      createErrorHandler(errMsg =>
        // addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
        addDangerToast(t('删除时出现了一个问题 %s: %s', name, errMsg)),
      ),
    );
  }
  function handleBulkRulesDelete(rulesToDelete: RLSObject[]) {
    const ids = rulesToDelete.map(({ id }) => id);
    return SupersetClient.delete({
      endpoint: `/api/v1/rowlevelsecurity/?q=${rison.encode(ids)}`,
    }).then(
      () => {
        refreshData();
        // addSuccessToast(t(`Deleted`));
        addSuccessToast(t(`已删除`));
      },
      createErrorHandler(errMsg =>
        // addDangerToast(t('There was an issue deleting rules: %s', errMsg)),
        addDangerToast(t('删除规则时出现了一个问题: %s', errMsg)),
      ),
    );
  }

  function handleRuleModalHide() {
    setCurrentRule(null);
    setRuleModalOpen(false);
    refreshData();
  }

  const canWrite = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canExport = hasPerm('can_export');

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        // Header: t('Name'),
        Header: t('名称'),
      },
      {
        accessor: 'filter_type',
        // Header: t('Filter Type'),
        Header: t('过滤类型'),
        size: 'xl',
      },
      {
        accessor: 'group_key',
        // Header: t('Group Key'),
        Header: t('组键'),
        size: 'xl',
      },
      {
        accessor: 'clause',
        // Header: t('Clause'),
        Header: t('条款'),
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
        // Header: t('Last modified'),
        Header: t('最后修改于'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () =>
            handleRuleDelete(
              original,
              refreshData,
              addSuccessToast,
              addDangerToast,
            );
          const handleEdit = () => handleRuleEdit(original);
          return (
            <Actions className="actions">
              {canWrite && (
                <ConfirmStatusChange
                  // title={t('Please confirm')}
                  title={t('请确认')}
                  description={
                    <>
                      {/* {t('Are you sure you want to delete')}{' '} */}
                      {t('您确定要删除吗？')}{' '}
                      <b>{original.name}</b>
                    </>
                  }
                  onConfirm={handleDelete}
                >
                  {confirmDelete => (
                    <Tooltip
                      id="delete-action-tooltip"
                      // title={t('Delete')}
                      title={t('删除')}
                      placement="bottom"
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmDelete}
                      >
                        <Icons.DeleteOutlined
                          data-test="rls-list-trash-icon"
                          iconSize="l"
                        />
                      </span>
                    </Tooltip>
                  )}
                </ConfirmStatusChange>
              )}
              {canEdit && (
                <Tooltip
                  id="edit-action-tooltip"
                  // title={t('Edit')}
                  title={t('修改')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleEdit}
                  >
                    <Icons.EditOutlined data-test="edit-alt" iconSize="l" />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        hidden: !canEdit && !canWrite && !canExport,
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [
      user.userId,
      canEdit,
      canWrite,
      canExport,
      hasPerm,
      refreshData,
      addDangerToast,
      addSuccessToast,
    ],
  );

  const emptyState = {
    // title: t('No Rules yet'),
    title: t('暂无规则'),
    image: 'filter-results.svg',
    buttonAction: () => handleRuleEdit(null),
    buttonText: canEdit ? (
      <>
        <Icons.PlusOutlined
          iconColor={theme.colors.primary.light5}
          iconSize="m"
          css={css`
            margin: auto ${theme.gridUnit * 2}px auto 0;
            vertical-align: text-top;
          `}
          data-test="add-rule-empty"
        />
        {/* {t('Rule')} */}
        {t('规则')}
      </>
    ) : null,
  };

  const filters: Filters = useMemo(
    () => [
      {
        // Header: t('Name'),
        Header: t('名称'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.StartsWith,
      },
      {
        // Header: t('Filter Type'),
        Header: t('过滤类型'),
        key: 'filter_type',
        id: 'filter_type',
        input: 'select',
        operator: FilterOperator.Equals,
        // unfilteredLabel: t('Any'),
        unfilteredLabel: t('任何'),
        selects: [
          // { label: t('Regular'), value: 'Regular' },
          // { label: t('Base'), value: 'Base' },
          { label: t('常规'), value: 'Regular' },
          { label: t('基础'), value: 'Base' },
        ],
      },
      {
        // Header: t('Group Key'),
        Header: t('组键'),
        key: 'search',
        id: 'group_key',
        input: 'search',
        operator: FilterOperator.StartsWith,
      },
      {
        // Header: t('Modified by'),
        Header: t('修改于'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        // unfilteredLabel: t('All'),
        unfilteredLabel: t('全部'),
        fetchSelects: createFetchRelated(
          'rowlevelsecurity',
          'changed_by',
          createErrorHandler(errMsg =>
            // t(
            //   'An error occurred while fetching dataset datasource values: %s',
            //   errMsg,
            // ),
            t(
              '获取数据集数据源值时发生错误: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
      },
    ],
    [user],
  );

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
  const PAGE_SIZE = 25;

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canWrite) {
    subMenuButtons.push({
      name: (
        <>
          <Icons.PlusOutlined
            iconColor={theme.colors.primary.light5}
            iconSize="m"
            css={css`
              margin: auto ${theme.gridUnit * 2}px auto 0;
              vertical-align: text-top;
            `}
            data-test="add-rule"
          />
          {/* {t('Rule')} */}
          {t('规则')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => handleRuleEdit(null),
    });
    subMenuButtons.push({
      // name: t('Bulk select'),
      name: t('批量选择'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
  }

  return (
    <>
      {/* <SubMenu name={t('Row Level Security')} buttons={subMenuButtons} /> */}
      <SubMenu name={t('行级安全')} buttons={subMenuButtons} />
      <ConfirmStatusChange
        // title={t('Please confirm')}
        title={t('请确认')}
        // description={t('Are you sure you want to delete the selected rules?')}
        description={t('您确定要删除已选规则吗？')}
        onConfirm={handleBulkRulesDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canWrite) {
            bulkActions.push({
              key: 'delete',
              // name: t('Delete'),
              name: t('删除'),
              type: 'danger',
              onSelect: confirmDelete,
            });
          }
          return (
            <>
              <RowLevelSecurityModal
                rule={currentRule}
                addDangerToast={addDangerToast}
                onHide={handleRuleModalHide}
                addSuccessToast={addSuccessToast}
                show={ruleModalOpen}
              />
              <ListView<RLSObject>
                className="rls-list-view"
                bulkActions={bulkActions}
                bulkSelectEnabled={bulkSelectEnabled}
                disableBulkSelect={toggleBulkSelect}
                columns={columns}
                count={rulesCount}
                data={rules}
                emptyState={emptyState}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                addDangerToast={addDangerToast}
                addSuccessToast={addSuccessToast}
                refreshData={() => {}}
                pageSize={PAGE_SIZE}
              />
            </>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(RowLevelSecurityList);
