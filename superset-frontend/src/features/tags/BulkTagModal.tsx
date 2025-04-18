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
import { useState, useEffect, FC } from 'react';

import { t, styled, SupersetClient } from '@superset-ui/core';
import { FormLabel } from 'src/components/Form';
import Modal from 'src/components/Modal';
import AsyncSelect from 'src/components/Select/AsyncSelect';
import Button from 'src/components/Button';
import { loadTags } from 'src/components/Tags/utils';
import { TaggableResourceOption } from 'src/features/tags/TagModal';

const BulkTagModalContainer = styled.div`
  .bulk-tag-text {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2.5}px;
  }
`;

interface BulkTagModalProps {
  onHide: () => void;
  refreshData: () => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  show: boolean;
  selected: any[];
  resourceName: string;
}

const BulkTagModal: FC<BulkTagModalProps> = ({
  show,
  selected = [],
  onHide,
  refreshData,
  resourceName,
  addSuccessToast,
  addDangerToast,
}) => {
  useEffect(() => {}, []);
  const [tags, setTags] = useState<TaggableResourceOption[]>([]);

  const onSave = async () => {
    await SupersetClient.post({
      endpoint: `/api/v1/tag/bulk_create`,
      jsonPayload: {
        tags: tags.map(tag => ({
          name: tag.label,
          objects_to_tag: selected.map(item => [
            resourceName,
            +item.original.id,
          ]),
        })),
      },
    })
      .then(({ json = {} }) => {
        const skipped = json.result.objects_skipped;
        const tagged = json.result.objects_tagged;
        if (skipped.length > 0) {
          addSuccessToast(
            // t(
            //   '%s items could not be tagged because you don’t have edit permissions to all selected objects.',
            //   skipped.length,
            //   resourceName,
            // ),
            t(
              '%s 因为您没有选中对象的所有编辑权限，无法对这些项进行标记。',
              skipped.length,
              resourceName,
            ),
          );
        }
        // addSuccessToast(t('Tagged %s %ss', tagged.length, resourceName));
        addSuccessToast(t('标记 %s %ss', tagged.length, resourceName));
      })
      .catch(err => {
        // addDangerToast(t('Failed to tag items'));
        addDangerToast(t('无法标记项目'));
      });

    refreshData();
    onHide();
    setTags([]);
  };

  return (
    <Modal
      // title={t('Bulk tag')}
      title={t('批量标签')}
      show={show}
      onHide={() => {
        setTags([]);
        onHide();
      }}
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
      <BulkTagModalContainer>
        <div className="bulk-tag-text">
          {/* {t('You are adding tags to %s %ss', selected.length, resourceName)} */}
          {t('您正在添加标签到 %s %ss', selected.length, resourceName)}
        </div>
        {/* <FormLabel>{t('tags')}</FormLabel> */}
        <FormLabel>{t('标签')}</FormLabel>
        <AsyncSelect
          ariaLabel="tags"
          // @ts-ignore
          value={tags}
          options={loadTags}
          onHide={onHide}
          // @ts-ignore
          onChange={tags => setTags(tags)}
          // placeholder={t('Select Tags')}
          placeholder={t('选择标签')}
          mode="multiple"
        />
      </BulkTagModalContainer>
    </Modal>
  );
};

export default BulkTagModal;
