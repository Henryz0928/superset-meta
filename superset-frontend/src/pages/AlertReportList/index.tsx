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

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  t,
  css,
  useTheme,
  SupersetClient,
  makeApi,
  styled,
  getExtensionsRegistry,
} from '@superset-ui/core';
import { extendedDayjs } from 'src/utils/dates';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import FacePile from 'src/components/FacePile';
import { Tooltip } from 'src/components/Tooltip';
import ListView, {
  FilterOperator,
  Filters,
  ListViewProps,
} from 'src/components/ListView';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { Switch } from 'src/components/Switch';
import { DATETIME_WITH_TIME_ZONE } from 'src/constants';
import withToasts from 'src/components/MessageToasts/withToasts';
import AlertStatusIcon from 'src/features/alerts/components/AlertStatusIcon';
import RecipientIcon from 'src/features/alerts/components/RecipientIcon';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DeleteModal from 'src/components/DeleteModal';
import LastUpdated from 'src/components/LastUpdated';
import {
  useListViewResource,
  useSingleViewResource,
} from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import Owner from 'src/types/Owner';
import AlertReportModal from 'src/features/alerts/AlertReportModal';
import { AlertObject, AlertState } from 'src/features/alerts/types';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { Icons } from 'src/components/Icons';

const extensionsRegistry = getExtensionsRegistry();

const PAGE_SIZE = 25;

const AlertStateLabel: Record<AlertState, string> = {
  // [AlertState.Success]: t('Success'),
  // [AlertState.Working]: t('Working'),
  // [AlertState.Error]: t('Error'),
  // [AlertState.Noop]: t('Not triggered'),
  // [AlertState.Grace]: t('On Grace'),
  [AlertState.Success]: t('成功'),
  [AlertState.Working]: t('工作'),
  [AlertState.Error]: t('错误'),
  [AlertState.Noop]: t('未触发'),
  [AlertState.Grace]: t('宽限'),
};

interface AlertListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  isReportEnabled: boolean;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}
const deleteAlerts = makeApi<number[], { message: string }>({
  requestType: 'rison',
  method: 'DELETE',
  endpoint: '/api/v1/report/',
});

const RefreshContainer = styled.div`
  width: 100%;
  padding: 0 ${({ theme }) => theme.gridUnit * 4}px
    ${({ theme }) => theme.gridUnit * 3}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

const StyledHeaderWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  > *:first-child {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const HeaderExtension = extensionsRegistry.get('alertsreports.header.icon');

function AlertList({
  addDangerToast,
  isReportEnabled = false,
  user,
  addSuccessToast,
}: AlertListProps) {
  const theme = useTheme();
  // const title = isReportEnabled ? t('Report') : t('Alert');
  // const titlePlural = isReportEnabled ? t('reports') : t('alerts');
  const title = isReportEnabled ? t('报告') : t('警报');
  const titlePlural = isReportEnabled ? t('报告') : t('警报');
  const pathName = isReportEnabled ? 'Reports' : 'Alerts';
  const initialFilters = useMemo(
    () => [
      {
        id: 'type',
        operator: FilterOperator.Equals,
        value: isReportEnabled ? 'Report' : 'Alert',
      },
    ],
    [isReportEnabled],
  );
  const {
    state: {
      loading,
      resourceCount: alertsCount,
      resourceCollection: alerts,
      bulkSelectEnabled,
      lastFetched,
    },
    hasPerm,
    fetchData,
    setResourceCollection,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<AlertObject>(
    'report',
    // t('report'),
    t('报告'),
    addDangerToast,
    true,
    undefined,
    initialFilters,
  );

  const { updateResource } = useSingleViewResource<Partial<AlertObject>>(
    'report',
    // t('reports'),
    t('报告'),
    addDangerToast,
  );

  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);
  const [currentAlert, setCurrentAlert] = useState<Partial<AlertObject> | null>(
    null,
  );
  const [currentAlertDeleting, setCurrentAlertDeleting] =
    useState<AlertObject | null>(null);

  // Actions
  function handleAlertEdit(alert: AlertObject | null) {
    setCurrentAlert(alert);
    setAlertModalOpen(true);
  }

  const generateKey = () => `${new Date().getTime()}`;

  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canCreate = hasPerm('can_write');

  useEffect(() => {
    if (bulkSelectEnabled && canDelete) {
      toggleBulkSelect();
    }
  }, [isReportEnabled]);

  const handleAlertDelete = ({ id, name }: AlertObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/report/${id}`,
    }).then(
      () => {
        refreshData();
        setCurrentAlertDeleting(null);
        // addSuccessToast(t('Deleted: %s', name));
        addSuccessToast(t('已删除: %s', name));
      },
      createErrorHandler(errMsg =>
        // addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
        addDangerToast(t('删除时出现了一个问题 %s: %s', name, errMsg)),
      ),
    );
  };

  const handleBulkAlertDelete = async (alertsToDelete: AlertObject[]) => {
    try {
      const { message } = await deleteAlerts(
        alertsToDelete.map(({ id }) => id),
      );
      refreshData();
      addSuccessToast(message);
    } catch (e) {
      createErrorHandler(errMsg =>
        addDangerToast(
          // t(
          //   'There was an issue deleting the selected %s: %s',
          //   titlePlural,
          //   errMsg,
          // ),
          t(
            '删除所选项时出现了问题 %s: %s',
            titlePlural,
            errMsg,
          ),
        ),
      )(e);
    }
  };

  const initialSort = [{ id: 'name', desc: true }];

  const toggleActive = useCallback(
    (data: AlertObject, checked: boolean) => {
      if (data?.id) {
        const update_id = data.id;
        const original = [...alerts];

        setResourceCollection(
          original.map(alert => {
            if (alert?.id === data.id) {
              return {
                ...alert,
                active: checked,
              };
            }

            return alert;
          }),
        );

        updateResource(update_id, { active: checked }, false, false)
          .then()
          .catch(() => setResourceCollection(original));
      }
    },
    [alerts, setResourceCollection, updateResource],
  );

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { last_state: lastState },
          },
        }: any) => (
          <AlertStatusIcon
            state={lastState}
            isReportEnabled={isReportEnabled}
          />
        ),
        accessor: 'last_state',
        size: 'xs',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { last_eval_dttm: lastEvalDttm },
          },
        }: any) =>
          lastEvalDttm
            ? extendedDayjs
                .utc(lastEvalDttm)
                .local()
                .format(DATETIME_WITH_TIME_ZONE)
            : '',
        accessor: 'last_eval_dttm',
        // Header: t('Last run'),
        Header: t('上次运行'),
        size: 'lg',
      },
      {
        accessor: 'name',
        // Header: t('Name'),
        Header: t('名称'),
        size: 'xl',
      },
      {
        // Header: t('Schedule'),
        Header: t('日程'),
        accessor: 'crontab_humanized',
        size: 'xl',
        Cell: ({
          row: {
            original: { crontab_humanized = '', timezone },
          },
        }: any) => (
          <Tooltip
            title={`${crontab_humanized} (${timezone})`}
            placement="topLeft"
          >
            <span>{`${crontab_humanized} (${timezone})`}</span>
          </Tooltip>
        ),
      },
      {
        Cell: ({
          row: {
            original: { recipients },
          },
        }: any) =>
          recipients.map((r: any) => (
            <RecipientIcon key={r.id} type={r.type} />
          )),
        accessor: 'recipients',
        // Header: t('Notification method'),
        Header: t('通知方式'),
        disableSortBy: true,
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { owners = [] },
          },
        }: any) => <FacePile users={owners} />,
        // Header: t('Owners'),
        Header: t('所有者'),
        id: 'owners',
        disableSortBy: true,
        size: 'xl',
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
          const allowEdit =
            original.owners.map((o: Owner) => o.id).includes(user.userId) ||
            isUserAdmin(user);

          return (
            <Switch
              disabled={!allowEdit}
              data-test="toggle-active"
              checked={original.active}
              onClick={(checked: boolean) => toggleActive(original, checked)}
              size="small"
            />
          );
        },
        // Header: t('Active'),
        Header: t('活跃'),
        accessor: 'active',
        id: 'active',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const history = useHistory();
          const handleEdit = () => handleAlertEdit(original);
          const handleDelete = () => setCurrentAlertDeleting(original);
          const handleGotoExecutionLog = () =>
            history.push(`/${original.type.toLowerCase()}/${original.id}/log`);

          const allowEdit =
            original.owners.map((o: Owner) => o.id).includes(user.userId) ||
            isUserAdmin(user);

          const actions = [
            canEdit
              ? {
                  label: 'execution-log-action',
                  // tooltip: t('Execution log'),
                  tooltip: t('执行日志'),
                  placement: 'bottom',
                  icon: 'FileTextOutlined',
                  onClick: handleGotoExecutionLog,
                }
              : null,
            canEdit
              ? {
                  label: allowEdit ? 'edit-action' : 'preview-action',
                  // tooltip: allowEdit ? t('Edit') : t('View'),
                  tooltip: allowEdit ? t('修改') : t('查看'),
                  placement: 'bottom',
                  icon: allowEdit ? 'EditOutlined' : 'Binoculars',
                  onClick: handleEdit,
                }
              : null,
            allowEdit && canDelete
              ? {
                  label: 'delete-action',
                  // tooltip: t('Delete'),
                  tooltip: t('删除'),
                  placement: 'bottom',
                  icon: 'DeleteOutlined',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => item !== null);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        hidden: !canEdit && !canDelete,
        disableSortBy: true,
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [canDelete, canEdit, isReportEnabled, toggleActive],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
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
          />
          {title}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        handleAlertEdit(null);
      },
    });
  }
  if (canDelete) {
    subMenuButtons.push({
      // name: t('Bulk select'),
      name: t('批量选择'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
      'data-test': 'bulk-select-toggle',
    });
  }

  const emptyState = {
    // title: t('No %s yet', titlePlural),
    title: t('暂无 %s', titlePlural),
    image: 'filter-results.svg',
    buttonAction: () => handleAlertEdit(null),
    buttonText: canCreate ? (
      <>
        <Icons.PlusOutlined
          iconColor={theme.colors.primary.light5}
          iconSize="m"
          css={css`
            margin: auto ${theme.gridUnit * 2}px auto 0;
            vertical-align: text-top;
          `}
          data-test="add-annotation-layer-button"
        />
        {title}{' '}
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
        operator: FilterOperator.Contains,
      },
      {
        // Header: t('Owner'),
        Header: t('所有者'),
        key: 'owner',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        // unfilteredLabel: t('All'),
        unfilteredLabel: t('全部'),
        fetchSelects: createFetchRelated(
          'report',
          'owners',
          createErrorHandler(errMsg =>
            // t('An error occurred while fetching owners values: %s', errMsg),
            t('获取所有者时发生错误: %s', errMsg),
          ),
          user,
        ),
        paginate: true,
      },
      {
        // Header: t('Status'),
        Header: t('状态'),
        key: 'status',
        id: 'last_state',
        input: 'select',
        operator: FilterOperator.Equals,
        // unfilteredLabel: 'Any',
        unfilteredLabel: '任何',
        selects: [
          {
            label: AlertStateLabel[AlertState.Success],
            value: AlertState.Success,
          },
          {
            label: AlertStateLabel[AlertState.Working],
            value: AlertState.Working,
          },
          { label: AlertStateLabel[AlertState.Error], value: AlertState.Error },
          { label: AlertStateLabel[AlertState.Noop], value: AlertState.Noop },
          { label: AlertStateLabel[AlertState.Grace], value: AlertState.Grace },
        ],
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
          'report',
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
    [],
  );

  const header = HeaderExtension ? (
    <StyledHeaderWithIcon>
      {/* <div>{t('Alerts & reports')}</div> */}
      <div>{t('警报及报告')}</div>
      <HeaderExtension />
    </StyledHeaderWithIcon>
  ) : (
    // t('Alerts & reports')
    t('警报及报告')
  );

  return (
    <>
      <SubMenu
        activeChild={pathName}
        name={header}
        tabs={[
          {
            name: 'Alerts',
            // label: t('Alerts'),
            label: t('警报'),
            url: '/alert/list/',
            usesRouter: true,
            'data-test': 'alert-list',
          },
          {
            name: 'Reports',
            // label: t('Reports'),
            label: t('报告'),
            url: '/report/list/',
            usesRouter: true,
            'data-test': 'report-list',
          },
        ]}
        buttons={subMenuButtons}
      >
        <RefreshContainer>
          <LastUpdated updatedAt={lastFetched} update={() => refreshData()} />
        </RefreshContainer>
      </SubMenu>
      <AlertReportModal
        alert={currentAlert}
        addDangerToast={addDangerToast}
        layer={currentAlert}
        onHide={() => {
          setAlertModalOpen(false);
          setCurrentAlert(null);
          refreshData();
        }}
        show={alertModalOpen}
        isReport={isReportEnabled}
        key={currentAlert?.id || generateKey()}
      />
      {currentAlertDeleting && (
        <DeleteModal
          // description={t(
          //   'This action will permanently delete %s.',
          //   currentAlertDeleting.name,
          // )}
          description={t(
            '此操作将永久删除 %s.',
            currentAlertDeleting.name,
          )}
          onConfirm={() => {
            if (currentAlertDeleting) {
              handleAlertDelete(currentAlertDeleting);
            }
          }}
          onHide={() => setCurrentAlertDeleting(null)}
          open
          // title={t('Delete %s?', title)}
          title={t('删除 %s?', title)}
        />
      )}
      <ConfirmStatusChange
        // title={t('Please confirm')}
        title={t('请确认')}
        // description={t(
        //   'Are you sure you want to delete the selected %s?',
        //   titlePlural,
        // )}
        description={t(
          '您确定要删除已选中的项吗？ %s?',
          titlePlural,
        )}
        onConfirm={handleBulkAlertDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = canDelete
            ? [
                {
                  key: 'delete',
                  // name: t('Delete'),
                  name: t('删除'),
                  onSelect: confirmDelete,
                  type: 'danger',
                },
              ]
            : [];
          return (
            <ListView<AlertObject>
              className="alerts-list-view"
              columns={columns}
              count={alertsCount}
              data={alerts}
              emptyState={emptyState}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              refreshData={refreshData}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              pageSize={PAGE_SIZE}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AlertList);
