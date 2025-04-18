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
import { ChangeEvent, useState, useEffect, FC } from 'react';

import rison from 'rison';
import Modal from 'src/components/Modal';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import { FormLabel } from 'src/components/Form';
import { t, styled, SupersetClient } from '@superset-ui/core';
// eslint-disable-next-line no-restricted-imports
import { Input } from 'antd'; // TODO: Remove antd
import { Divider } from 'src/components/Divider';
import Button from 'src/components/Button';
import { Tag } from 'src/views/CRUD/types';
import { fetchObjectsByTagIds } from 'src/features/tags/tags';

const StyledModalBody = styled.div`
  .ant-select-dropdown {
    max-height: ${({ theme }) => theme.gridUnit * 40}px;
  }
  .tag-input {
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
`;

export interface TaggableResourceOption {
  label: string;
  value: number;
  key: number;
}

export enum TaggableResources {
  Chart = 'chart',
  Dashboard = 'dashboard',
  SavedQuery = 'query',
}

interface TagModalProps {
  onHide: () => void;
  refreshData: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  show: boolean;
  clearOnHide?: boolean;
  editTag?: Tag | null;
}

const TagModal: FC<TagModalProps> = ({
  show,
  onHide,
  editTag,
  refreshData,
  addSuccessToast,
  addDangerToast,
  clearOnHide = false,
}) => {
  const [dashboardsToTag, setDashboardsToTag] = useState<
    TaggableResourceOption[]
  >([]);
  const [chartsToTag, setChartsToTag] = useState<TaggableResourceOption[]>([]);
  const [savedQueriesToTag, setSavedQueriesToTag] = useState<
    TaggableResourceOption[]
  >([]);

  const [tagName, setTagName] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const isEditMode = !!editTag;
  const modalTitle = isEditMode ? 'Edit Tag' : 'Create Tag';

  const clearResources = () => {
    setDashboardsToTag([]);
    setChartsToTag([]);
    setSavedQueriesToTag([]);
  };

  const clearTagForm = () => {
    setTagName('');
    setDescription('');
    setDashboardsToTag([]);
    setChartsToTag([]);
    setSavedQueriesToTag([]);
  };

  useEffect(() => {
    const resourceMap: { [key: string]: TaggableResourceOption[] } = {
      [TaggableResources.Dashboard]: [],
      [TaggableResources.Chart]: [],
      [TaggableResources.SavedQuery]: [],
    };

    const updateResourceOptions = ({ id, name, type }: Tag) => {
      const resourceOptions = resourceMap[type];
      if (resourceOptions) {
        resourceOptions.push({
          value: id,
          label: name,
          key: id,
        });
      }
    };
    clearResources();
    if (isEditMode) {
      fetchObjectsByTagIds(
        { tagIds: [editTag.id], types: null },
        (data: Tag[]) => {
          data.forEach(updateResourceOptions);
          setDashboardsToTag(resourceMap[TaggableResources.Dashboard]);
          setChartsToTag(resourceMap[TaggableResources.Chart]);
          setSavedQueriesToTag(resourceMap[TaggableResources.SavedQuery]);
        },
        (error: Response) => {
          // addDangerToast('Error Fetching Tagged Objects');
          addDangerToast('获取标记对象时出错');
        },
      );
      setTagName(editTag.name);
      setDescription(editTag.description);
    }
  }, [editTag]);

  const loadData = async (
    search: string,
    page: number,
    pageSize: number,
    columns: string[],
    filterColumn: string,
    orderColumn: string,
    endpoint: string,
  ) => {
    const queryParams = rison.encode({
      columns,
      filters: [
        {
          col: filterColumn,
          opr: 'ct',
          value: search,
        },
      ],
      page,
      order_column: orderColumn,
    });

    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/${endpoint}/?q=${queryParams}`,
    });
    const { result, count } = json;

    return {
      data: result.map((item: Record<string, any> & { id: number }) => ({
        value: item.id,
        label: item[filterColumn],
      })),
      totalCount: count,
    };
  };

  const loadCharts = async (search: string, page: number, pageSize: number) =>
    loadData(
      search,
      page,
      pageSize,
      ['id', 'slice_name'],
      'slice_name',
      'slice_name',
      'chart',
    );

  const loadDashboards = async (
    search: string,
    page: number,
    pageSize: number,
  ) =>
    loadData(
      search,
      page,
      pageSize,
      ['id', 'dashboard_title'],
      'dashboard_title',
      'dashboard_title',
      'dashboard',
    );

  const loadQueries = async (search: string, page: number, pageSize: number) =>
    loadData(
      search,
      page,
      pageSize,
      ['id', 'label'],
      'label',
      'label',
      'saved_query',
    );

  const handleOptionChange = (resource: TaggableResources, data: any) => {
    if (resource === TaggableResources.Dashboard) setDashboardsToTag(data);
    else if (resource === TaggableResources.Chart) setChartsToTag(data);
    else if (resource === TaggableResources.SavedQuery)
      setSavedQueriesToTag(data);
  };

  const handleTagNameChange = (ev: ChangeEvent<HTMLInputElement>) =>
    setTagName(ev.target.value);
  const handleDescriptionChange = (ev: ChangeEvent<HTMLInputElement>) =>
    setDescription(ev.target.value);

  const onSave = () => {
    const dashboards = dashboardsToTag.map(dash => ['dashboard', dash.value]);
    const charts = chartsToTag.map(chart => ['chart', chart.value]);
    const savedQueries = savedQueriesToTag.map(q => ['query', q.value]);

    if (isEditMode) {
      SupersetClient.put({
        endpoint: `/api/v1/tag/${editTag.id}`,
        jsonPayload: {
          description,
          name: tagName,
          objects_to_tag: [...dashboards, ...charts, ...savedQueries],
        },
      })
        .then(({ json = {} }) => {
          refreshData();
          clearTagForm();
          // addSuccessToast(t('Tag updated'));
          addSuccessToast(t('标签已更新'));
          onHide();
        })
        .catch(err => {
          // addDangerToast(err.message || 'Error Updating Tag');
          addDangerToast(err.message || '更新标签时出错');
        });
    } else {
      SupersetClient.post({
        endpoint: `/api/v1/tag/`,
        jsonPayload: {
          description,
          name: tagName,
          objects_to_tag: [...dashboards, ...charts, ...savedQueries],
        },
      })
        .then(({ json = {} }) => {
          refreshData();
          clearTagForm();
          // addSuccessToast(t('Tag created'));
          addSuccessToast(t('标签创建'));
          onHide();
        })
        // .catch(err => addDangerToast(err.message || 'Error Creating Tag'));
        .catch(err => addDangerToast(err.message || '创建标记时出错'));
    }
  };

  return (
    <Modal
      title={modalTitle}
      onHide={() => {
        if (clearOnHide) clearTagForm();
        onHide();
      }}
      show={show}
      footer={
        <div>
          <Button
            data-test="modal-save-dashboard-button"
            buttonStyle="secondary"
            onClick={onHide}
          >
            {/* {t('Cancel')} */}
            {t('取消')}
          </Button>
          <Button
            data-test="modal-save-dashboard-button"
            buttonStyle="primary"
            onClick={onSave}
          >
            {/* {t('Save')} */}
            {t('保存')}
          </Button>
        </div>
      }
    >
      <StyledModalBody>
        {/* <FormLabel>{t('Tag name')}</FormLabel> */}
        <FormLabel>{t('标签名称')}</FormLabel>
        <Input
          className="tag-input"
          onChange={handleTagNameChange}
          // placeholder={t('Name of your tag')}
          placeholder={t('您的标签名称')}
          value={tagName}
        />
        {/* <FormLabel>{t('Description')}</FormLabel> */}
        <FormLabel>{t('描述')}</FormLabel>
        <Input
          className="tag-input"
          onChange={handleDescriptionChange}
          // placeholder={t('Add description of your tag')}
          placeholder={t('添加您的标签描述')}
          value={description}
        />
        <Divider />
        <AsyncSelect
          className="tag-input"
          // ariaLabel={t('Select dashboards')}
          ariaLabel={t('选择仪表盘')}
          mode="multiple"
          name="dashboards"
          // @ts-ignore
          value={dashboardsToTag}
          options={loadDashboards}
          onChange={value =>
            handleOptionChange(TaggableResources.Dashboard, value)
          }
          // header={<FormLabel>{t('Dashboards')}</FormLabel>}
          header={<FormLabel>{t('仪表盘')}</FormLabel>}
          allowClear
        />
        <AsyncSelect
          className="tag-input"
          // ariaLabel={t('Select charts')}
          ariaLabel={t('选择图表')}
          mode="multiple"
          name="charts"
          // @ts-ignore
          value={chartsToTag}
          options={loadCharts}
          onChange={value => handleOptionChange(TaggableResources.Chart, value)}
          // header={<FormLabel>{t('Charts')}</FormLabel>}
          header={<FormLabel>{t('图表')}</FormLabel>}
          allowClear
        />
        <AsyncSelect
          className="tag-input"
          // ariaLabel={t('Select saved queries')}
          ariaLabel={t('选择已保存的查询')}
          mode="multiple"
          name="savedQueries"
          // @ts-ignore
          value={savedQueriesToTag}
          options={loadQueries}
          onChange={value =>
            handleOptionChange(TaggableResources.SavedQuery, value)
          }
          // header={<FormLabel>{t('Saved queries')}</FormLabel>}
          header={<FormLabel>{t('保存的查询')}</FormLabel>}
          allowClear
        />
      </StyledModalBody>
    </Modal>
  );
};

export default TagModal;
