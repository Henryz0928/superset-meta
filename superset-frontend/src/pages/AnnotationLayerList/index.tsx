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

import { useMemo, useState } from 'react';
import rison from 'rison';
import { t, SupersetClient, useTheme, css } from '@superset-ui/core';
import { Link, useHistory } from 'react-router-dom';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import AnnotationLayerModal from 'src/features/annotationLayers/AnnotationLayerModal';
import { AnnotationLayerObject } from 'src/features/annotationLayers/types';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { Icons } from 'src/components/Icons';
import { navigateTo } from 'src/utils/navigationUtils';

const PAGE_SIZE = 25;

interface AnnotationLayersListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function AnnotationLayersList({
  addDangerToast,
  addSuccessToast,
  user,
}: AnnotationLayersListProps) {
  const theme = useTheme();
  const {
    state: {
      loading,
      resourceCount: layersCount,
      resourceCollection: layers,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<AnnotationLayerObject>(
    'annotation_layer',
    // t('Annotation layers'),
    t('注释层'),
    addDangerToast,
  );

  const [annotationLayerModalOpen, setAnnotationLayerModalOpen] =
    useState<boolean>(false);
  const [currentAnnotationLayer, setCurrentAnnotationLayer] =
    useState<AnnotationLayerObject | null>(null);

  const [layerCurrentlyDeleting, setLayerCurrentlyDeleting] =
    useState<AnnotationLayerObject | null>(null);

  const handleLayerDelete = ({ id, name }: AnnotationLayerObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/${id}`,
    }).then(
      () => {
        refreshData();
        setLayerCurrentlyDeleting(null);
        // addSuccessToast(t('Deleted: %s', name));
        addSuccessToast(t('已删除: %s', name));
      },
      createErrorHandler(errMsg =>
        // addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
        addDangerToast(t('删除时出现了一个问题 %s: %s', name, errMsg)),
      ),
    );
  };

  const handleBulkLayerDelete = (layersToDelete: AnnotationLayerObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/?q=${rison.encode(
        layersToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          // t('There was an issue deleting the selected layers: %s', errMsg),
          t('删除所选图层时出现问题: %s', errMsg),
        ),
      ),
    );
  };

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');

  function handleAnnotationLayerEdit(layer: AnnotationLayerObject | null) {
    setCurrentAnnotationLayer(layer);
    setAnnotationLayerModalOpen(true);
  }

  const initialSort = [{ id: 'name', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        // Header: t('Name'),
        Header: t('名称'),
        Cell: ({
          row: {
            original: { id, name },
          },
        }: any) => {
          let hasHistory = true;

          try {
            useHistory();
          } catch (err) {
            // If error is thrown, we know not to use <Link> in render
            hasHistory = false;
          }

          if (hasHistory) {
            return <Link to={`/annotationlayer/${id}/annotation`}>{name}</Link>;
          }

          return <a href={`/annotationlayer/${id}/annotation`}>{name}</a>;
        },
      },
      {
        accessor: 'descr',
        // Header: t('Description'),
        Header: t('描述'),
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
        accessor: 'changed_on',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handleAnnotationLayerEdit(original);
          const handleDelete = () => setLayerCurrentlyDeleting(original);

          const actions = [
            canEdit
              ? {
                  label: 'edit-action',
                  // tooltip: t('Edit template'),
                  tooltip: t('修改模板'),
                  placement: 'bottom',
                  icon: 'EditOutlined',
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  // tooltip: t('Delete template'),
                  tooltip: t('删除模板'),
                  placement: 'bottom',
                  icon: 'DeleteOutlined',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        disableSortBy: true,
        hidden: !canEdit && !canDelete,
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [canDelete, canCreate],
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
              vertical-align: text-top;
            `}
          />
          {/* {t('Annotation layer')} */}
          {t('注释层')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        handleAnnotationLayerEdit(null);
      },
    });
  }

  if (canDelete) {
    subMenuButtons.push({
      // name: t('Bulk select'),
      name: t('批量选择'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

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
        // Header: t('Changed by'),
        Header: t('变更与'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        // unfilteredLabel: t('All'),
        unfilteredLabel: t('全部'),
        fetchSelects: createFetchRelated(
          'annotation_layer',
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
    [],
  );

  const emptyState = {
    // title: t('No annotation layers yet'),
    title: t('没有注释层'),
    image: 'filter-results.svg',
    buttonAction: () => handleAnnotationLayerEdit(null),
    buttonText: (
      <>
        <Icons.PlusOutlined
          iconSize="m"
          iconColor={theme.colors.primary.light5}
        />
        {/* {t('Annotation layer')} */}
        {t('注释层')}
      </>
    ),
  };

  const onLayerAdd = (id?: number) => {
    navigateTo(`/annotationlayer/${id}/annotation`);
  };

  const onModalHide = () => {
    refreshData();
    setAnnotationLayerModalOpen(false);
  };

  return (
    <>
      {/* <SubMenu name={t('Annotation layers')} buttons={subMenuButtons} /> */}
      <SubMenu name={t('注释层')} buttons={subMenuButtons} />
      <AnnotationLayerModal
        addDangerToast={addDangerToast}
        layer={currentAnnotationLayer}
        onLayerAdd={onLayerAdd}
        onHide={onModalHide}
        show={annotationLayerModalOpen}
      />
      {layerCurrentlyDeleting && (
        <DeleteModal
          // description={t('This action will permanently delete the layer.')}
          description={t('此操作将永久删除图层。')}
          onConfirm={() => {
            if (layerCurrentlyDeleting) {
              handleLayerDelete(layerCurrentlyDeleting);
            }
          }}
          onHide={() => setLayerCurrentlyDeleting(null)}
          open
          // title={t('Delete Layer?')}
          title={t('删除图层？')}
        />
      )}
      <ConfirmStatusChange
        // title={t('Please confirm')}
        title={t('请确认')}
        // description={t('Are you sure you want to delete the selected layers?')}
        description={t('您确定要删除选定的图层吗？')}
        onConfirm={handleBulkLayerDelete}
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
            <ListView<AnnotationLayerObject>
              className="annotation-layers-list-view"
              columns={columns}
              count={layersCount}
              data={layers}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              emptyState={emptyState}
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AnnotationLayersList);
