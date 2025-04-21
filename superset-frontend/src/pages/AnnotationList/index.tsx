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

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, Link, useHistory } from 'react-router-dom';
import {
  css,
  t,
  useTheme,
  styled,
  SupersetClient,
  getClientErrorObject,
} from '@superset-ui/core';
import dayjs from 'dayjs';
import rison from 'rison';

import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DeleteModal from 'src/components/DeleteModal';
import ListView, { ListViewProps } from 'src/components/ListView';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';

import { AnnotationObject } from 'src/features/annotations/types';
import AnnotationModal from 'src/features/annotations/AnnotationModal';
import { Icons } from 'src/components/Icons';

const PAGE_SIZE = 25;

interface AnnotationListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const StyledHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: row;

    a,
    Link {
      margin-left: ${theme.gridUnit * 4}px;
      font-size: ${theme.typography.sizes.s}px;
      font-weight: ${theme.typography.weights.normal};
      text-decoration: underline;
    }
  `}
`;

function AnnotationList({
  addDangerToast,
  addSuccessToast,
}: AnnotationListProps) {
  const theme = useTheme();
  const { annotationLayerId }: any = useParams();
  const {
    state: {
      loading,
      resourceCount: annotationsCount,
      resourceCollection: annotations,
      bulkSelectEnabled,
    },
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<AnnotationObject>(
    `annotation_layer/${annotationLayerId}/annotation`,
    t('annotation'),
    addDangerToast,
    false,
  );
  const [annotationModalOpen, setAnnotationModalOpen] =
    useState<boolean>(false);
  const [annotationLayerName, setAnnotationLayerName] = useState<string>('');
  const [currentAnnotation, setCurrentAnnotation] =
    useState<AnnotationObject | null>(null);
  const [annotationCurrentlyDeleting, setAnnotationCurrentlyDeleting] =
    useState<AnnotationObject | null>(null);
  const handleAnnotationEdit = (annotation: AnnotationObject | null) => {
    setCurrentAnnotation(annotation);
    setAnnotationModalOpen(true);
  };

  const fetchAnnotationLayer = useCallback(
    async function fetchAnnotationLayer() {
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/annotation_layer/${annotationLayerId}`,
        });
        setAnnotationLayerName(response.json.result.name);
      } catch (response) {
        await getClientErrorObject(response).then(({ error }: any) => {
          addDangerToast(error.error || error.statusText || error);
        });
      }
    },
    [annotationLayerId],
  );

  const handleAnnotationDelete = ({ id, short_descr }: AnnotationObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/${annotationLayerId}/annotation/${id}`,
    }).then(
      () => {
        refreshData();
        setAnnotationCurrentlyDeleting(null);
        // addSuccessToast(t('Deleted: %s', short_descr));
        addSuccessToast(t('已删除: %s', short_descr));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          // t('There was an issue deleting %s: %s', short_descr, errMsg),
          t('删除时出现了一个问题 %s: %s', short_descr, errMsg),
        ),
      ),
    );
  };

  const handleBulkAnnotationsDelete = (
    annotationsToDelete: AnnotationObject[],
  ) => {
    SupersetClient.delete({
      endpoint: `/api/v1/annotation_layer/${annotationLayerId}/annotation/?q=${rison.encode(
        annotationsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          // t('There was an issue deleting the selected annotations: %s', errMsg),
          t('删除选定的注释时出现了问题: %s', errMsg),
        ),
      ),
    );
  };

  // get the Annotation Layer
  useEffect(() => {
    fetchAnnotationLayer();
  }, [fetchAnnotationLayer]);

  const initialSort = [{ id: 'short_descr', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'short_descr',
        // Header: t('Name'),
        Header: t('名称'),
      },
      {
        accessor: 'long_descr',
        // Header: t('Description'),
        Header: t('描述'),
      },
      {
        Cell: ({
          row: {
            original: { start_dttm: startDttm },
          },
        }: {
          row: { original: AnnotationObject };
        }) => dayjs(new Date(startDttm)).format('ll'),
        // Header: t('Start'),
        Header: t('开始'),
        accessor: 'start_dttm',
      },
      {
        Cell: ({
          row: {
            original: { end_dttm: endDttm },
          },
        }: {
          row: { original: AnnotationObject };
        }) => dayjs(new Date(endDttm)).format('ll'),
        // Header: t('End'),
        Header: t('结束'),
        accessor: 'end_dttm',
      },
      {
        Cell: ({
          row: { original },
        }: {
          row: { original: AnnotationObject };
        }) => {
          const handleEdit = () => handleAnnotationEdit(original);
          const handleDelete = () => setAnnotationCurrentlyDeleting(original);
          const actions = [
            {
              label: 'edit-action',
              // tooltip: t('Edit annotation'),
              tooltip: t('编辑注解'),
              placement: 'bottom',
              icon: 'EditOutlined',
              onClick: handleEdit,
            },
            {
              label: 'delete-action',
              // tooltip: t('Delete annotation'),
              tooltip: t('删除注解'),
              placement: 'bottom',
              icon: 'DeleteOutlined',
              onClick: handleDelete,
            },
          ];
          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [true, true],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

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
        {/* {t('Annotation')} */}
        {t('注解')}
      </>
    ),
    buttonStyle: 'primary',
    onClick: () => {
      handleAnnotationEdit(null);
    },
  });

  subMenuButtons.push({
    // name: t('Bulk select'),
    name: t('批量选择'),
    onClick: toggleBulkSelect,
    buttonStyle: 'secondary',
    'data-test': 'annotation-bulk-select',
  });

  let hasHistory = true;

  try {
    useHistory();
  } catch (err) {
    // If error is thrown, we know not to use <Link> in render
    hasHistory = false;
  }

  const emptyState = {
    // title: t('No annotation yet'),
    title: t('还没有注释'),
    image: 'filter-results.svg',
    buttonAction: () => {
      handleAnnotationEdit(null);
    },
    buttonText: (
      <>
        <Icons.PlusOutlined
          iconColor={theme.colors.primary.light5}
          iconSize="m"
          css={css`
            margin: auto ${theme.gridUnit * 2}px auto 0;
            vertical-align: text-top;
          `}
        />
        {/* {t('Annotation')} */}
        {t('注解')}
      </>
    ),
  };

  return (
    <>
      <SubMenu
        name={
          <StyledHeader>
            {/* <span>{t('Annotation Layer %s', annotationLayerName)}</span> */}
            <span>{t('注解层 %s', annotationLayerName)}</span>
            <span>
              {/* {hasHistory ? (
                <Link to="/annotationlayer/list/">{t('Back to all')}</Link>
              ) : (
                <a href="/annotationlayer/list/">{t('Back to all')}</a>
              )} */}
                  {hasHistory ? (
                <Link to="/annotationlayer/list/">{t('返回全部')}</Link>
              ) : (
                <a href="/annotationlayer/list/">{t('返回全部')}</a>
              )}
            </span>
          </StyledHeader>
        }
        buttons={subMenuButtons}
      />
      <AnnotationModal
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        annotation={currentAnnotation}
        show={annotationModalOpen}
        onAnnotationAdd={() => refreshData()}
        annotationLayerId={annotationLayerId}
        onHide={() => setAnnotationModalOpen(false)}
      />
      {annotationCurrentlyDeleting && (
        <DeleteModal
          // description={t(
          //   'Are you sure you want to delete %s?',
          //   annotationCurrentlyDeleting?.short_descr,
          // )}
          description={t(
            '您确定要删除吗？ %s?',
            annotationCurrentlyDeleting?.short_descr,
          )}
          onConfirm={() => {
            if (annotationCurrentlyDeleting) {
              handleAnnotationDelete(annotationCurrentlyDeleting);
            }
          }}
          onHide={() => setAnnotationCurrentlyDeleting(null)}
          open
          // title={t('Delete Annotation?')}
          title={t('删除注释？')}
        />
      )}
      <ConfirmStatusChange
        // title={t('Please confirm')}
        // description={t(
        //   'Are you sure you want to delete the selected annotations?',
        // )}
        title={t('请确认')}
        description={t(
          '您确定要删除已选注释吗？',
        )}
        onConfirm={handleBulkAnnotationsDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [
            {
              key: 'delete',
              // name: t('Delete'),
              name: t('删除'),
              onSelect: confirmDelete,
              type: 'danger',
            },
          ];

          return (
            <ListView<AnnotationObject>
              className="annotations-list-view"
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              columns={columns}
              count={annotationsCount}
              data={annotations}
              disableBulkSelect={toggleBulkSelect}
              emptyState={emptyState}
              fetchData={fetchData}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              refreshData={refreshData}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AnnotationList);
