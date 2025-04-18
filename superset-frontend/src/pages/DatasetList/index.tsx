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
  getExtensionsRegistry,
  styled,
  SupersetClient,
  useTheme,
  css,
  t,
} from '@superset-ui/core';
import { FunctionComponent, useState, useMemo, useCallback, Key } from 'react';
import { Link, useHistory } from 'react-router-dom';
import rison from 'rison';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
} from 'src/views/CRUD/utils';
import { ColumnObject } from 'src/features/datasets/types';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import { DatasourceModal } from 'src/components/Datasource';
import DeleteModal from 'src/components/DeleteModal';
import handleResourceExport from 'src/utils/export';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import { DatasetTypeLabel } from 'src/components/Label';
import Loading from 'src/components/Loading';
import SubMenu, { SubMenuProps, ButtonProps } from 'src/features/home/SubMenu';
import Owner from 'src/types/Owner';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Tooltip } from 'src/components/Tooltip';
import { Icons } from 'src/components/Icons';
import FacePile from 'src/components/FacePile';
import CertifiedBadge from 'src/components/CertifiedBadge';
import InfoTooltip from 'src/components/InfoTooltip';
import ImportModelsModal from 'src/components/ImportModal/index';
import WarningIconWithTooltip from 'src/components/WarningIconWithTooltip';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { GenericLink } from 'src/components/GenericLink/GenericLink';

import {
  PAGE_SIZE,
  SORT_BY,
  PASSWORDS_NEEDED_MESSAGE,
  CONFIRM_OVERWRITE_MESSAGE,
} from 'src/features/datasets/constants';
import DuplicateDatasetModal from 'src/features/datasets/DuplicateDatasetModal';
import { useSelector } from 'react-redux';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';

const extensionsRegistry = getExtensionsRegistry();
const DatasetDeleteRelatedExtension = extensionsRegistry.get(
  'dataset.delete.related',
);

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const Actions = styled.div`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.base};

    .disabled {
      svg,
      i {
        &:hover {
          path {
            fill: ${theme.colors.grayscale.light1};
          }
        }
      }
      color: ${theme.colors.grayscale.light1};
      .antd5-menu-item:hover {
        cursor: default;
      }
      &::after {
        color: ${theme.colors.grayscale.light1};
      }
    }
  `}
`;

type Dataset = {
  changed_by_name: string;
  changed_by: string;
  changed_on_delta_humanized: string;
  database: {
    id: string;
    database_name: string;
  };
  kind: string;
  explore_url: string;
  id: number;
  owners: Array<Owner>;
  schema: string;
  table_name: string;
};

interface VirtualDataset extends Dataset {
  extra: Record<string, any>;
  sql: string;
}

interface DatasetListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

const DatasetList: FunctionComponent<DatasetListProps> = ({
  addDangerToast,
  addSuccessToast,
  user,
}) => {
  const history = useHistory();
  const theme = useTheme();
  const {
    state: {
      loading,
      resourceCount: datasetCount,
      resourceCollection: datasets,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = 
  // useListViewResource<Dataset>('dataset', t('dataset'), addDangerToast);
  useListViewResource<Dataset>('dataset', t('数据集'), addDangerToast);

  const [datasetCurrentlyDeleting, setDatasetCurrentlyDeleting] = useState<
    | (Dataset & {
        charts: any;
        dashboards: any;
      })
    | null
  >(null);

  const [datasetCurrentlyEditing, setDatasetCurrentlyEditing] =
    useState<Dataset | null>(null);

  const [datasetCurrentlyDuplicating, setDatasetCurrentlyDuplicating] =
    useState<VirtualDataset | null>(null);

  const [importingDataset, showImportModal] = useState<boolean>(false);
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

  const PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET = useSelector<any, boolean>(
    state =>
      state.common?.conf?.PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET || false,
  );

  const openDatasetImportModal = () => {
    showImportModal(true);
  };

  const closeDatasetImportModal = () => {
    showImportModal(false);
  };

  const handleDatasetImport = () => {
    showImportModal(false);
    refreshData();
    // addSuccessToast(t('Dataset imported'));
    addSuccessToast(t('数据集已导入'));
  };

  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canCreate = hasPerm('can_write');
  const canDuplicate = hasPerm('can_duplicate');
  const canExport = hasPerm('can_export');

  const initialSort = SORT_BY;

  const openDatasetEditModal = useCallback(
    ({ id }: Dataset) => {
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${id}`,
      })
        .then(({ json = {} }) => {
          const addCertificationFields = json.result.columns.map(
            (column: ColumnObject) => {
              const {
                certification: { details = '', certified_by = '' } = {},
              } = JSON.parse(column.extra || '{}') || {};
              return {
                ...column,
                certification_details: details || '',
                certified_by: certified_by || '',
                is_certified: details || certified_by,
              };
            },
          );
          // eslint-disable-next-line no-param-reassign
          json.result.columns = [...addCertificationFields];
          setDatasetCurrentlyEditing(json.result);
        })
        .catch(() => {
          addDangerToast(
            // t('An error occurred while fetching dataset related data'),
            t('获取数据集相关数据时发生错误'),
          );
        });
    },
    [addDangerToast],
  );

  const openDatasetDeleteModal = (dataset: Dataset) =>
    SupersetClient.get({
      endpoint: `/api/v1/dataset/${dataset.id}/related_objects`,
    })
      .then(({ json = {} }) => {
        setDatasetCurrentlyDeleting({
          ...dataset,
          charts: json.charts,
          dashboards: json.dashboards,
        });
      })
      .catch(
        createErrorHandler(errMsg =>
          // t(
          //   'An error occurred while fetching dataset related data: %s',
          //   errMsg,
          // ),
          t(
            '获取数据集相关数据时发生错误: %s',
            errMsg,
          ),
        ),
      );

  const openDatasetDuplicateModal = (dataset: VirtualDataset) => {
    setDatasetCurrentlyDuplicating(dataset);
  };

  const handleBulkDatasetExport = (datasetsToExport: Dataset[]) => {
    const ids = datasetsToExport.map(({ id }) => id);
    handleResourceExport('dataset', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { kind },
          },
        }: any) => null,
        accessor: 'kind_icon',
        disableSortBy: true,
        size: 'xs',
        id: 'id',
      },
      {
        Cell: ({
          row: {
            original: {
              extra,
              table_name: datasetTitle,
              description,
              explore_url: exploreURL,
            },
          },
        }: any) => {
          let titleLink: JSX.Element;
          if (PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET) {
            titleLink = (
              <Link data-test="internal-link" to={exploreURL}>
                {datasetTitle}
              </Link>
            );
          } else {
            titleLink = (
              // exploreUrl can be a link to Explore or an external link
              // in the first case use SPA routing, else use HTML anchor
              <GenericLink to={exploreURL}>{datasetTitle}</GenericLink>
            );
          }
          try {
            const parsedExtra = JSON.parse(extra);
            return (
              <FlexRowContainer>
                {parsedExtra?.certification && (
                  <CertifiedBadge
                    certifiedBy={parsedExtra.certification.certified_by}
                    details={parsedExtra.certification.details}
                    size="l"
                  />
                )}
                {parsedExtra?.warning_markdown && (
                  <WarningIconWithTooltip
                    warningMarkdown={parsedExtra.warning_markdown}
                    size="l"
                  />
                )}
                {titleLink}
                {description && <InfoTooltip tooltip={description} />}
              </FlexRowContainer>
            );
          } catch {
            return titleLink;
          }
        },
        // Header: t('Name'),
        Header: t('名称'),
        accessor: 'table_name',
      },
      {
        Cell: ({
          row: {
            original: { kind },
          },
        }: any) => <DatasetTypeLabel datasetType={kind} />,
        // Header: t('Type'),
        Header: t('类型'),
        accessor: 'kind',
        disableSortBy: true,
        size: 'md',
      },
      {
        // Header: t('Database'),
        Header: t('数据库'),
        accessor: 'database.database_name',
        size: 'lg',
      },
      {
        Header: t('Schema'),
        accessor: 'schema',
        size: 'lg',
      },
      {
        accessor: 'database',
        disableSortBy: true,
        hidden: true,
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
        size: 'lg',
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
        Header: t('最后修改'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        accessor: 'sql',
        hidden: true,
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: any) => {
          // Verify owner or isAdmin
          const allowEdit =
            original.owners.map((o: Owner) => o.id).includes(user.userId) ||
            isUserAdmin(user);

          const handleEdit = () => openDatasetEditModal(original);
          const handleDelete = () => openDatasetDeleteModal(original);
          const handleExport = () => handleBulkDatasetExport([original]);
          const handleDuplicate = () => openDatasetDuplicateModal(original);
          if (!canEdit && !canDelete && !canExport && !canDuplicate) {
            return null;
          }
          return (
            <Actions className="actions">
              {canDelete && (
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
                    onClick={handleDelete}
                  >
                    <Icons.DeleteOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              {canExport && (
                <Tooltip
                  id="export-action-tooltip"
                  // title={t('Export')}
                  title={t('导出')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleExport}
                  >
                    <Icons.UploadOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              {canEdit && (
                <Tooltip
                  id="edit-action-tooltip"
                  // title={
                  //   allowEdit
                  //     ? t('Edit')
                  //     : t(
                  //         'You must be a dataset owner in order to edit. Please reach out to a dataset owner to request modifications or edit access.',
                  //       )
                  // }
                  title={
                    allowEdit
                      ? t('修改')
                      : t(
                          '您必须是数据集的所有者才能编辑。请联系数据集的所有者以请求修改或编辑权限。',
                        )
                  }
                  placement="bottomRight"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className={allowEdit ? 'action-button' : 'disabled'}
                    onClick={allowEdit ? handleEdit : undefined}
                  >
                    <Icons.EditOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              {canDuplicate && original.kind === 'virtual' && (
                <Tooltip
                  id="duplicate-action-tooltip"
                  // title={t('Duplicate')}
                  title={t('重复')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDuplicate}
                  >
                    <Icons.CopyOutlined />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        hidden: !canEdit && !canDelete && !canDuplicate,
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [canEdit, canDelete, canExport, openDatasetEditModal, canDuplicate, user],
  );

  const filterTypes: Filters = useMemo(
    () => [
      {
        // Header: t('Name'),
        Header: t('名称'),
        key: 'search',
        id: 'table_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        // Header: t('Type'),
        Header: t('类型'),
        key: 'sql',
        id: 'sql',
        input: 'select',
        operator: FilterOperator.DatasetIsNullOrEmpty,
        // unfilteredLabel: 'All',
        unfilteredLabel: '全部',
        selects: [
          // { label: t('Virtual'), value: false },
          // { label: t('Physical'), value: true },
          { label: t('虚拟'), value: false },
          { label: t('物理'), value: true },
        ],
      },
      {
        // Header: t('Database'),
        Header: t('数据库'),
        key: 'database',
        id: 'database',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        // unfilteredLabel: 'All',
        unfilteredLabel: '全部',
        fetchSelects: createFetchRelated(
          'dataset',
          'database',
          createErrorHandler(errMsg =>
            // t('An error occurred while fetching datasets: %s', errMsg),
            t('在获取数据集时发生错误: %s', errMsg),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Schema'),
        key: 'schema',
        id: 'schema',
        input: 'select',
        operator: FilterOperator.Equals,
        // unfilteredLabel: 'All',
        unfilteredLabel: '全部',
        fetchSelects: createFetchDistinct(
          'dataset',
          'schema',
          createErrorHandler(errMsg =>
            // t('An error occurred while fetching schema values: %s', errMsg),
            t('获取 schema 时发生错误: %s', errMsg),
          ),
        ),
        paginate: true,
      },
      {
        // Header: t('Owner'),
        Header: '所有者',
        key: 'owner',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        // unfilteredLabel: 'All',
        unfilteredLabel: '全部',
        fetchSelects: createFetchRelated(
          'dataset',
          'owners',
          createErrorHandler(errMsg =>
            // t(
            //   'An error occurred while fetching dataset owner values: %s',
            //   errMsg,
            // ),
            t(
              '获取数据集所有者时发生错误: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
      },
      {
        // Header: t('Certified'),
        Header: t('认证'),
        key: 'certified',
        id: 'id',
        urlDisplay: 'certified',
        input: 'select',
        operator: FilterOperator.DatasetIsCertified,
        // unfilteredLabel: t('Any'),
        unfilteredLabel: t('任何'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
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
          'dataset',
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

  const menuData: SubMenuProps = {
    activeChild: 'Datasets',
    // name: t('Datasets'),
    name: t('数据集'),
  };

  const buttonArr: Array<ButtonProps> = [];

  if (canDelete || canExport) {
    buttonArr.push({
      // name: t('Bulk select'),
      name: t('批量选择'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  if (canCreate) {
    buttonArr.push({
      name: (
        <>
          <Icons.PlusOutlined
            iconColor={theme.colors.primary.light5}
            iconSize="m"
            css={css`
              vertical-align: text-top;
            `}
          />
          {/* {t('Dataset')} */}
          {t('数据集')}
        </>
      ),
      onClick: () => {
        history.push('/dataset/add/');
      },
      buttonStyle: 'primary',
    });

    buttonArr.push({
      name: (
        <Tooltip
          id="import-tooltip"
          // title={t('Import datasets')}
          title={t('导入数据集')}
          placement="bottomRight"
        >
          <Icons.DownloadOutlined
            iconColor={theme.colors.primary.dark1}
            data-test="import-button"
          />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openDatasetImportModal,
    });
  }

  menuData.buttons = buttonArr;

  const closeDatasetDeleteModal = () => {
    setDatasetCurrentlyDeleting(null);
  };

  const closeDatasetEditModal = () => {
    setDatasetCurrentlyEditing(null);
  };

  const closeDatasetDuplicateModal = () => {
    setDatasetCurrentlyDuplicating(null);
  };

  const handleDatasetDelete = ({ id, table_name: tableName }: Dataset) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/${id}`,
    }).then(
      () => {
        refreshData();
        setDatasetCurrentlyDeleting(null);
        // addSuccessToast(t('Deleted: %s', tableName));
        addSuccessToast(t('已删除: %s', tableName));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          // t('There was an issue deleting %s: %s', tableName, errMsg),
          t('删除时出现了一个问题 %s: %s', tableName, errMsg),
        ),
      ),
    );
  };

  const handleBulkDatasetDelete = (datasetsToDelete: Dataset[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/?q=${rison.encode(
        datasetsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          // t('There was an issue deleting the selected datasets: %s', errMsg),
          t('删除选中的数据集时遇到问题: %s', errMsg),
        ),
      ),
    );
  };

  const handleDatasetDuplicate = (newDatasetName: string) => {
    if (datasetCurrentlyDuplicating === null) {
      // addDangerToast(t('There was an issue duplicating the dataset.'));
      addDangerToast(t('复制数据集时出现了问题。'));
    }

    SupersetClient.post({
      endpoint: `/api/v1/dataset/duplicate`,
      jsonPayload: {
        base_model_id: datasetCurrentlyDuplicating?.id,
        table_name: newDatasetName,
      },
    }).then(
      () => {
        setDatasetCurrentlyDuplicating(null);
        refreshData();
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          // t('There was an issue duplicating the selected datasets: %s', errMsg),
          t('复制选定的数据集时出现了问题: %s', errMsg),
        ),
      ),
    );
  };

  return (
    <>
      <SubMenu {...menuData} />
      {datasetCurrentlyDeleting && (
        <DeleteModal
          description={
            <>
              <p>
                {/* {t('The dataset')} */}
                {t('该数据集')}
                <b> {datasetCurrentlyDeleting.table_name} </b>
                {/* {t(
                  'is linked to %s charts that appear on %s dashboards. Are you sure you want to continue? Deleting the dataset will break those objects.',
                  datasetCurrentlyDeleting.charts.count,
                  datasetCurrentlyDeleting.dashboards.count,
                )} */}
                 {t(
                  '链接到 %s 图表，这些图表显示在 %s 仪表板。您确定要继续吗？删除数据集将破坏这些对象。',
                  datasetCurrentlyDeleting.charts.count,
                  datasetCurrentlyDeleting.dashboards.count,
                )}
              </p>
              {datasetCurrentlyDeleting.dashboards.count >= 1 && (
                <>
                  {/* <h4>{t('Affected Dashboards')}</h4> */}
                  <h4>{t('受影响的仪表盘')}</h4>
                  <ul>
                    {datasetCurrentlyDeleting.dashboards.result
                      .slice(0, 10)
                      .map(
                        (
                          result: { id: Key | null | undefined; title: string },
                          index: number,
                        ) => (
                          <li key={result.id}>
                            <a
                              href={`/superset/dashboard/${result.id}`}
                              target="_atRiskItem"
                            >
                              {result.title}
                            </a>
                          </li>
                        ),
                      )}
                    {datasetCurrentlyDeleting.dashboards.result.length > 10 && (
                      <li>
                        {/* {t(
                          '... and %s others',
                          datasetCurrentlyDeleting.dashboards.result.length -
                            10,
                        )} */}
                          {t(
                          '... 和 %s 其它',
                          datasetCurrentlyDeleting.dashboards.result.length -
                            10,
                        )}
                      </li>
                    )}
                  </ul>
                </>
              )}
              {datasetCurrentlyDeleting.charts.count >= 1 && (
                <>
                  {/* <h4>{t('Affected Charts')}</h4> */}
                  <h4>{t('受影响的图表')}</h4>
                  <ul>
                    {datasetCurrentlyDeleting.charts.result.slice(0, 10).map(
                      (
                        result: {
                          id: Key | null | undefined;
                          slice_name: string;
                        },
                        index: number,
                      ) => (
                        <li key={result.id}>
                          <a
                            href={`/explore/?slice_id=${result.id}`}
                            target="_atRiskItem"
                          >
                            {result.slice_name}
                          </a>
                        </li>
                      ),
                    )}
                    {datasetCurrentlyDeleting.charts.result.length > 10 && (
                      <li>
                        {/* {t(
                          '... and %s others',
                          datasetCurrentlyDeleting.charts.result.length - 10,
                        )} */}
                          {t(
                          '... 和 %s 其它',
                          datasetCurrentlyDeleting.charts.result.length - 10,
                        )}
                      </li>
                    )}
                  </ul>
                </>
              )}
              {DatasetDeleteRelatedExtension && (
                <DatasetDeleteRelatedExtension
                  dataset={datasetCurrentlyDeleting}
                />
              )}
            </>
          }
          onConfirm={() => {
            if (datasetCurrentlyDeleting) {
              handleDatasetDelete(datasetCurrentlyDeleting);
            }
          }}
          onHide={closeDatasetDeleteModal}
          open
          // title={t('Delete Dataset?')}
          title={t('删除数据集？')}
        />
      )}
      {datasetCurrentlyEditing && (
        <DatasourceModal
          datasource={datasetCurrentlyEditing}
          onDatasourceSave={refreshData}
          onHide={closeDatasetEditModal}
          show
        />
      )}
      <DuplicateDatasetModal
        dataset={datasetCurrentlyDuplicating}
        onHide={closeDatasetDuplicateModal}
        onDuplicate={handleDatasetDuplicate}
      />
      <ConfirmStatusChange
        // title={t('Please confirm')}
        title={t('请确认')}
        // description={t(
        //   'Are you sure you want to delete the selected datasets?',
        // )}
        description={t(
          '您确定要删除已选的数据集吗？',
        )}
        onConfirm={handleBulkDatasetDelete}
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
              onSelect: handleBulkDatasetExport,
            });
          }
          return (
            <ListView<Dataset>
              className="dataset-list-view"
              columns={columns}
              data={datasets}
              count={datasetCount}
              pageSize={PAGE_SIZE}
              fetchData={fetchData}
              filters={filterTypes}
              loading={loading}
              initialSort={initialSort}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              refreshData={refreshData}
              renderBulkSelectCopy={selected => {
                const { virtualCount, physicalCount } = selected.reduce(
                  (acc, e) => {
                    if (e.original.kind === 'physical') acc.physicalCount += 1;
                    else if (e.original.kind === 'virtual') {
                      acc.virtualCount += 1;
                    }
                    return acc;
                  },
                  { virtualCount: 0, physicalCount: 0 },
                );

                if (!selected.length) {
                  // return t('0 Selected');
                  return t('已选中 0');
                }
                if (virtualCount && !physicalCount) {
                  // return t(
                  //   '%s Selected (Virtual)',
                  //   selected.length,
                  //   virtualCount,
                  // );
                  return t(
                    '%s 已选中（虚拟）',
                    selected.length,
                    virtualCount,
                  );
                }
                if (physicalCount && !virtualCount) {
                  // return t(
                  //   '%s Selected (Physical)',
                  //   selected.length,
                  //   physicalCount,
                  // );
                  return t(
                    '%s 已选中 (物理)',
                    selected.length,
                    physicalCount,
                  );
                }

                // return t(
                //   '%s Selected (%s Physical, %s Virtual)',
                //   selected.length,
                //   physicalCount,
                //   virtualCount,
                // );
                return t(
                  '%s 已选中 (%s 物理, %s 虚拟)',
                  selected.length,
                  physicalCount,
                  virtualCount,
                );
              }}
            />
          );
        }}
      </ConfirmStatusChange>

      <ImportModelsModal
        resourceName="dataset"
        // resourceLabel={t('dataset')}
        resourceLabel={t('数据集')}
        passwordsNeededMessage={PASSWORDS_NEEDED_MESSAGE}
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleDatasetImport}
        show={importingDataset}
        onHide={closeDatasetImportModal}
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
};

export default withToasts(DatasetList);
