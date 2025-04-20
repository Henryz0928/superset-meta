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

import {
  FeatureFlag,
  isFeatureEnabled,
  styled,
  SupersetClient,
  t,
  css,
  useTheme,
} from '@superset-ui/core';
import { useCallback, useMemo, useState, MouseEvent } from 'react';
import { Link, useHistory } from 'react-router-dom';
import rison from 'rison';
import {
  createErrorHandler,
  createFetchDistinct,
  createFetchRelated,
} from 'src/views/CRUD/utils';
import { useSelector } from 'react-redux';
import Popover from 'src/components/Popover';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import handleResourceExport from 'src/utils/export';
import SubMenu, { ButtonProps, SubMenuProps } from 'src/features/home/SubMenu';
import ListView, {
  FilterOperator,
  Filters,
  ListViewProps,
} from 'src/components/ListView';
import Loading from 'src/components/Loading';
import DeleteModal from 'src/components/DeleteModal';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import { TagsList } from 'src/components/Tags';
import { Tooltip } from 'src/components/Tooltip';
import { commonMenuData } from 'src/features/home/commonMenuData';
import { QueryObjectColumns, SavedQueryObject } from 'src/views/CRUD/types';
import Tag from 'src/types/TagType';
import ImportModelsModal from 'src/components/ImportModal/index';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { loadTags } from 'src/components/Tags/utils';
import { Icons } from 'src/components/Icons';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import SavedQueryPreviewModal from 'src/features/queries/SavedQueryPreviewModal';
import { findPermission } from 'src/utils/findPermission';

const PAGE_SIZE = 25;
// const PASSWORDS_NEEDED_MESSAGE = t(
//   'The passwords for the databases below are needed in order to ' +
//     'import them together with the saved queries. Please note that the ' +
//     '"Secure Extra" and "Certificate" sections of ' +
//     'the database configuration are not present in export files, and ' +
//     'should be added manually after the import if they are needed.',
// );
const PASSWORDS_NEEDED_MESSAGE = t(
  '以下数据库需要密码，以便 ' +
    '将它们与保存的查询一起导入。请注意 ' +
    '"安全额外”和“证书”部分 ' +
    '数据库配置不存在于导出文件中，并且 ' +
    '如果需要，应在导入后手动添加。',
);
// const CONFIRM_OVERWRITE_MESSAGE = t(
//   'You are importing one or more saved queries that already exist. ' +
//     'Overwriting might cause you to lose some of your work. Are you ' +
//     'sure you want to overwrite?',
// );
const CONFIRM_OVERWRITE_MESSAGE = t(
  '您正在导入一个或多个已存在的保存查询。' +
    '覆盖可能会导致您丢失一些工作。您 ' +
    '确定要覆盖吗？',
);

interface SavedQueryListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
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

function SavedQueryList({
  addDangerToast,
  addSuccessToast,
  user,
}: SavedQueryListProps) {
  const theme = useTheme();
  const {
    state: {
      loading,
      resourceCount: queryCount,
      resourceCollection: queries,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<SavedQueryObject>(
    'saved_query',
    // t('Saved queries'),
    t('保存查询'),
    addDangerToast,
  );
  const { roles } = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const canReadTag = findPermission('can_read', 'Tag', roles);
  const [queryCurrentlyDeleting, setQueryCurrentlyDeleting] =
    useState<SavedQueryObject | null>(null);
  const [savedQueryCurrentlyPreviewing, setSavedQueryCurrentlyPreviewing] =
    useState<SavedQueryObject | null>(null);
  const [importingSavedQuery, showImportModal] = useState<boolean>(false);
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [sshTunnelPasswordFields, setSSHTunnelPasswordFields] = useState<
    string[]
  >([]);
  const [sshTunnelPrivateKeyFields, setSSHTunnelPrivateKeyFields] = useState<
    string[]
  >([]);
  const [
    sshTunnelPrivateKeyPasswordFields,
    setSSHTunnelPrivateKeyPasswordFields,
  ] = useState<string[]>([]);
  const history = useHistory();

  const openSavedQueryImportModal = () => {
    showImportModal(true);
  };

  const closeSavedQueryImportModal = () => {
    showImportModal(false);
  };

  const handleSavedQueryImport = () => {
    showImportModal(false);
    refreshData();
    // addSuccessToast(t('Query imported'));
    addSuccessToast(t('查询已导入'));
  };

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');

  const handleSavedQueryPreview = useCallback(
    (id: number) => {
      SupersetClient.get({
        endpoint: `/api/v1/saved_query/${id}`,
      }).then(
        ({ json = {} }) => {
          setSavedQueryCurrentlyPreviewing({ ...json.result });
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            // t('There was an issue previewing the selected query %s', errMsg),
            t('预览所选查询时出现问题 %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Saved queries',
    ...commonMenuData,
  };

  const subMenuButtons: Array<ButtonProps> = [];

  if (canDelete) {
    subMenuButtons.push({
      // name: t('Bulk select'),
      name: t('批量选择'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  subMenuButtons.push({
    name: (
      <Link
        to="/sqllab?new=true"
        css={css`
          display: flex;
          &:hover {
            color: currentColor;
            text-decoration: none;
          }
        `}
      >
        <Icons.PlusOutlined
          iconColor={theme.colors.primary.light5}
          iconSize="m"
          css={css`
            margin: auto ${theme.gridUnit * 2}px auto 0;
          `}
        />
        {/* {t('Query')} */}
        {t('查询')}
      </Link>
    ),
    buttonStyle: 'primary',
  });

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <Tooltip
          id="import-tooltip"
          // title={t('Import queries')}
          title={t('导入查询')}
          placement="bottomRight"
          data-test="import-tooltip-test"
        >
          <Icons.DownloadOutlined data-test="import-icon" />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openSavedQueryImportModal,
      'data-test': 'import-button',
    });
  }

  menuData.buttons = subMenuButtons;

  // Action methods
  const openInSqlLab = (id: number, openInNewWindow: boolean) => {
    if (openInNewWindow) {
      window.open(`/sqllab?savedQueryId=${id}`);
    } else {
      history.push(`/sqllab?savedQueryId=${id}`);
    }
  };

  const copyQueryLink = useCallback(
    async (savedQuery: SavedQueryObject) => {
      try {
        const payload = {
          dbId: savedQuery.db_id,
          name: savedQuery.label,
          schema: savedQuery.schema,
          catalog: savedQuery.catalog,
          sql: savedQuery.sql,
          autorun: false,
          templateParams: null,
        };

        const response = await SupersetClient.post({
          endpoint: '/api/v1/sqllab/permalink',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const { url: permalink } = response.json;

        await navigator.clipboard.writeText(permalink);
        // addSuccessToast(t('Link Copied!'));
        addSuccessToast(t('链接已复制!'));
      } catch (error) {
        // addDangerToast(t('There was an error generating the permalink.'));
        addDangerToast(t('生成永久链接时出现错误。'));
      }
    },
    [addDangerToast, addSuccessToast],
  );

  const handleQueryDelete = ({ id, label }: SavedQueryObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/saved_query/${id}`,
    }).then(
      () => {
        refreshData();
        setQueryCurrentlyDeleting(null);
        // addSuccessToast(t('Deleted: %s', label));
        addSuccessToast(t('已删除: %s', label));
      },
      createErrorHandler(errMsg =>
        // addDangerToast(t('There was an issue deleting %s: %s', label, errMsg)),
        addDangerToast(t('删除时出现了一个问题 %s: %s', label, errMsg)),
      ),
    );
  };

  const handleBulkSavedQueryExport = (
    savedQueriesToExport: SavedQueryObject[],
  ) => {
    const ids = savedQueriesToExport.map(({ id }) => id);
    handleResourceExport('saved_query', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const handleBulkQueryDelete = (queriesToDelete: SavedQueryObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/saved_query/?q=${rison.encode(
        queriesToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          // t('There was an issue deleting the selected queries: %s', errMsg),
          t('删除选定的查询时遇到问题: %s', errMsg),
        ),
      ),
    );
  };

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'label',
        // Header: t('Name'),
        Header: t('名称'),
        Cell: ({
          row: {
            original: { id, label },
          },
        }: any) => <Link to={`/sqllab?savedQueryId=${id}`}>{label}</Link>,
      },
      {
        accessor: 'description',
        // Header: t('Description'),
        Header: t('描述'),
      },
      {
        accessor: 'database.database_name',
        // Header: t('Database'),
        Header: t('数据库'),
        size: 'xl',
      },
      {
        accessor: 'database',
        hidden: true,
        disableSortBy: true,
      },
      {
        accessor: 'schema',
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
          const main = names?.shift() || '';

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
        accessor: 'sql_tables',
        // Header: t('Tables'),
        Header: t('表'),
        size: 'xl',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { tags = [] },
          },
        }: any) => (
          // Only show custom type tags
          <TagsList tags={tags.filter((tag: Tag) => tag.type === 1)} />
        ),
        // Header: t('Tags'),
        Header: t('标签'),
        accessor: 'tags',
        disableSortBy: true,
        hidden: !isFeatureEnabled(FeatureFlag.TaggingSystem),
      },
      {
        Cell: ({
          row: {
            original: {
              changed_by: changedBy,
              changed_on_delta_humanized: changedOn,
            },
          },
        }: any) => <ModifiedInfo user={changedBy} date={changedOn} />,
        // Header: t('Last modified'),
        Header: t('最后修改'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handlePreview = () => {
            handleSavedQueryPreview(original.id);
          };
          const handleEdit = ({ metaKey }: MouseEvent) =>
            openInSqlLab(original.id, Boolean(metaKey));
          const handleCopy = () => copyQueryLink(original);
          const handleExport = () => handleBulkSavedQueryExport([original]);
          const handleDelete = () => setQueryCurrentlyDeleting(original);

          const actions = [
            {
              label: 'preview-action',
              // tooltip: t('Query preview'),
              tooltip: t('查询预览'),
              placement: 'bottom',
              icon: 'Binoculars',
              onClick: handlePreview,
            },
            canEdit && {
              label: 'edit-action',
              // tooltip: t('Edit query'),
              tooltip: t('编辑查询'),
              placement: 'bottom',
              icon: 'EditOutlined',
              onClick: handleEdit,
            },
            {
              label: 'copy-action',
              // tooltip: t('Copy query URL'),
              tooltip: t('复制查询 URL'),
              placement: 'bottom',
              icon: 'CopyOutlined',
              onClick: handleCopy,
            },
            canExport && {
              label: 'export-action',
              // tooltip: t('Export query'),
              tooltip: t('导出查询'),
              placement: 'bottom',
              icon: 'UploadOutlined',
              onClick: handleExport,
            },
            canDelete && {
              label: 'delete-action',
              // tooltip: t('Delete query'),
              tooltip: t('删除查询'),
              placement: 'bottom',
              icon: 'DeleteOutlined',
              onClick: handleDelete,
            },
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [canDelete, canEdit, canExport, copyQueryLink, handleSavedQueryPreview],
  );

  const filters: Filters = useMemo(
    () => [
      {
        // Header: t('Search'),
        Header: t('搜索'),
        id: 'label',
        key: 'search',
        input: 'search',
        operator: FilterOperator.AllText,
        toolTipDescription:
          'Searches all text fields: Name, Description, Database & Schema',
      },
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
          'saved_query',
          'database',
          createErrorHandler(errMsg =>
            addDangerToast(
              // t(
              //   'An error occurred while fetching dataset datasource values: %s',
              //   errMsg,
              // ),
              t(
                '获取数据集数据源时发生错误: %s',
                errMsg,
              ),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Schema'),
        id: 'schema',
        key: 'schema',
        input: 'select',
        operator: FilterOperator.Equals,
        // unfilteredLabel: 'All',
        unfilteredLabel: '全部',
        fetchSelects: createFetchDistinct(
          'saved_query',
          'schema',
          createErrorHandler(errMsg =>
            addDangerToast(
              // t('An error occurred while fetching schema values: %s', errMsg),
              t('获取 schema 时发生错误: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      ...((isFeatureEnabled(FeatureFlag.TaggingSystem) && canReadTag
        ? [
            {
              // Header: t('Tag'),
              Header: t('标签'),
              id: 'tags',
              key: 'tags',
              input: 'select',
              operator: FilterOperator.SavedQueryTagById,
              fetchSelects: loadTags,
            },
          ]
        : []) as Filters),
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
          'saved_query',
          'changed_by',
          createErrorHandler(errMsg =>
            // t(
            //   'An error occurred while fetching dataset datasource values: %s',
            //   errMsg,
            // ),
            t(
              '获取数据集数据源时发生错误: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
      },
    ],
    [addDangerToast],
  );

  return (
    <>
      <SubMenu {...menuData} />
      {queryCurrentlyDeleting && (
        <DeleteModal
          // description={t(
          //   'This action will permanently delete the saved query.',
          // )}
          description={t(
            '此操作将永久删除保存的查询。',
          )}
          onConfirm={() => {
            if (queryCurrentlyDeleting) {
              handleQueryDelete(queryCurrentlyDeleting);
            }
          }}
          onHide={() => setQueryCurrentlyDeleting(null)}
          open
          // title={t('Delete Query?')}
          title={t('删除查询?')}
        />
      )}
      {savedQueryCurrentlyPreviewing && (
        <SavedQueryPreviewModal
          fetchData={handleSavedQueryPreview}
          onHide={() => setSavedQueryCurrentlyPreviewing(null)}
          savedQuery={savedQueryCurrentlyPreviewing}
          queries={queries}
          openInSqlLab={openInSqlLab}
          show
        />
      )}
      <ConfirmStatusChange
        // title={t('Please confirm')}
        title={t('请确认')}
        // description={t('Are you sure you want to delete the selected queries?')}
        escription={t('您确定要删除已选的查询吗？')}
        onConfirm={handleBulkQueryDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              // name: t('Delete'),
              name: t('删除'),
              onSelect: confirmDelete,
              type: 'danger',
            });
          }
          if (canExport) {
            bulkActions.push({
              key: 'export',
              // name: t('Export'),
              name: t('导出'),
              type: 'primary',
              onSelect: handleBulkSavedQueryExport,
            });
          }
          return (
            <ListView<SavedQueryObject>
              className="saved_query-list-view"
              columns={columns}
              count={queryCount}
              data={queries}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              highlightRowId={savedQueryCurrentlyPreviewing?.id}
              enableBulkTag
              bulkTagResourceName="query"
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>

      <ImportModelsModal
        resourceName="saved_query"
        // resourceLabel={t('queries')}
        resourceLabel={t('查询')}
        passwordsNeededMessage={PASSWORDS_NEEDED_MESSAGE}
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleSavedQueryImport}
        show={importingSavedQuery}
        onHide={closeSavedQueryImportModal}
        passwordFields={passwordFields}
        setPasswordFields={setPasswordFields}
        sshTunnelPasswordFields={sshTunnelPasswordFields}
        setSSHTunnelPasswordFields={setSSHTunnelPasswordFields}
        sshTunnelPrivateKeyFields={sshTunnelPrivateKeyFields}
        setSSHTunnelPrivateKeyFields={setSSHTunnelPrivateKeyFields}
        sshTunnelPrivateKeyPasswordFields={sshTunnelPrivateKeyPasswordFields}
        setSSHTunnelPrivateKeyPasswordFields={
          setSSHTunnelPrivateKeyPasswordFields
        }
      />
      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(SavedQueryList);
