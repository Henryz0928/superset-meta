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
import rison from 'rison';
import { PureComponent, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Radio } from 'src/components/Radio';
import Card from 'src/components/Card';
import Alert from 'src/components/Alert';
import Badge from 'src/components/Badge';
import {
  css,
  isFeatureEnabled,
  getCurrencySymbol,
  ensureIsArray,
  FeatureFlag,
  styled,
  SupersetClient,
  t,
  withTheme,
  getClientErrorObject,
} from '@superset-ui/core';
import { Select, AsyncSelect, Row, Col } from 'src/components';
import { FormLabel } from 'src/components/Form';
import Button from 'src/components/Button';
import Tabs from 'src/components/Tabs';
import CertifiedBadge from 'src/components/CertifiedBadge';
import WarningIconWithTooltip from 'src/components/WarningIconWithTooltip';
import DatabaseSelector from 'src/components/DatabaseSelector';
import Label from 'src/components/Label';
import Loading from 'src/components/Loading';
import TableSelector from 'src/components/TableSelector';
import EditableTitle from 'src/components/EditableTitle';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import TextControl from 'src/explore/components/controls/TextControl';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import SpatialControl from 'src/explore/components/controls/SpatialControl';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Icons } from 'src/components/Icons';
import CurrencyControl from 'src/explore/components/controls/CurrencyControl';
import CollectionTable from './CollectionTable';
import Fieldset from './Fieldset';
import Field from './Field';
import { fetchSyncedColumns, updateColumns } from './utils';

const DatasourceContainer = styled.div`
  .change-warning {
    margin: 16px 10px 0;
    color: ${({ theme }) => theme.colors.warning.base};
  }

  .change-warning .bold {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }

  .form-group.has-feedback > .help-block {
    margin-top: 8px;
  }

  .form-group.form-group-md {
    margin-bottom: 8px;
  }
`;

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const StyledTableTabs = styled(Tabs)`
  overflow: visible;
  .ant-tabs-content-holder {
    overflow: visible;
  }
`;

const StyledBadge = styled(Badge)`
  .antd5-badge-count {
    line-height: ${({ theme }) => theme.gridUnit * 4}px;
    height: ${({ theme }) => theme.gridUnit * 4}px;
    margin-left: ${({ theme }) => theme.gridUnit}px;
  }
`;

const EditLockContainer = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  display: flex;
  align-items: center;
  a {
    padding: 0 10px;
  }
`;

const ColumnButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.gridUnit * 2}px`}
`;

const StyledLabelWrapper = styled.div`
  display: flex;
  align-items: center;
  span {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const StyledColumnsTabWrapper = styled.div`
  .table > tbody > tr > td {
    vertical-align: middle;
  }

  .ant-tag {
    margin-top: ${({ theme }) => theme.gridUnit}px;
  }
`;

const StyledButtonWrapper = styled.span`
  ${({ theme }) => `
    margin-top: ${theme.gridUnit * 3}px;
    margin-left: ${theme.gridUnit * 3}px;
    button>span>:first-of-type {
      margin-right: 0;
    }
  `}
`;

const sqlTooltipOptions = {
  placement: 'topRight',
  // title: t(
  //   'If changes are made to your SQL query, ' +
  //     'columns in your dataset will be synced when saving the dataset.',
  // ),
  title: t(
    '如果对您的 SQL 查询进行了更改， ' +
    '您的数据集中列将在保存数据集时同步。',
  ),
};

const checkboxGenerator = (d, onChange) => (
  <CheckboxControl value={d} onChange={onChange} />
);
const DATA_TYPES = [
  // { value: 'STRING', label: t('STRING') },
  // { value: 'NUMERIC', label: t('NUMERIC') },
  // { value: 'DATETIME', label: t('DATETIME') },
  // { value: 'BOOLEAN', label: t('BOOLEAN') },
  { value: 'STRING', label: t('字符串') },
  { value: 'NUMERIC', label: t('数字') },
  { value: 'DATETIME', label: t('日期时间') },
  { value: 'BOOLEAN', label: t('布尔') },
];

const DATASOURCE_TYPES_ARR = [
  // { key: 'physical', label: t('Physical (table or view)') },
  // { key: 'virtual', label: t('Virtual (SQL)') },
  { key: 'physical', label: t('物理（表或视图）') },
  { key: 'virtual', label: t('虚拟 (SQL)') },
];
const DATASOURCE_TYPES = {};
DATASOURCE_TYPES_ARR.forEach(o => {
  DATASOURCE_TYPES[o.key] = o;
});

function CollectionTabTitle({ title, collection }) {
  return (
    <div
      css={{ display: 'flex', alignItems: 'center' }}
      data-test={`collection-tab-${title}`}
    >
      {title}{' '}
      <StyledBadge count={collection ? collection.length : 0} showZero />
    </div>
  );
}

CollectionTabTitle.propTypes = {
  title: PropTypes.string,
  collection: PropTypes.array,
};

function ColumnCollectionTable({
  columns,
  datasource,
  onColumnsChange,
  onDatasourceChange,
  editableColumnName,
  showExpression,
  allowAddItem,
  allowEditDataType,
  itemGenerator,
  columnLabelTooltips,
}) {
  return (
    <CollectionTable
      tableColumns={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? [
            'column_name',
            'advanced_data_type',
            'type',
            'is_dttm',
            'main_dttm_col',
            'filterable',
            'groupby',
          ]
          : [
            'column_name',
            'type',
            'is_dttm',
            'main_dttm_col',
            'filterable',
            'groupby',
          ]
      }
      sortColumns={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? [
            'column_name',
            'advanced_data_type',
            'type',
            'is_dttm',
            'main_dttm_col',
            'filterable',
            'groupby',
          ]
          : [
            'column_name',
            'type',
            'is_dttm',
            'main_dttm_col',
            'filterable',
            'groupby',
          ]
      }
      allowDeletes
      allowAddItem={allowAddItem}
      itemGenerator={itemGenerator}
      collection={columns}
      columnLabelTooltips={columnLabelTooltips}
      stickyHeader
      expandFieldset={
        <FormContainer>
          <Fieldset compact>
            {showExpression && (
              <Field
                fieldKey="expression"
                // label={t('SQL expression')}
                label={t('SQL 表达式')}
                control={
                  <TextAreaControl
                    language="markdown"
                    offerEditInModal={false}
                    resize="vertical"
                  />
                }
              />
            )}
            <Field
              fieldKey="verbose_name"
              // label={t('Label')}
              label={t('标签')}
              control={
                <TextControl
                  controlId="verbose_name"
                  // placeholder={t('Label')}
                  placeholder={t('标签')}
                />
              }
            />
            <Field
              fieldKey="description"
              // label={t('Description')}
              label={t('描述')}
              control={
                <TextControl
                  controlId="description"
                  // placeholder={t('Description')}
                  placeholder={t('描述')}
                />
              }
            />
            {allowEditDataType && (
              <Field
                fieldKey="type"
                // label={t('Data type')}
                label={t('数据类型')}
                control={
                  <Select
                    // ariaLabel={t('Data type')}
                    ariaLabel={t('数据类型')}
                    options={DATA_TYPES}
                    name="type"
                    allowNewOptions
                    allowClear
                  />
                }
              />
            )}
            {isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes) ? (
              <Field
                fieldKey="advanced_data_type"
                // label={t('Advanced data type')}
                label={t('高级数据类型')}
                control={
                  <TextControl
                    controlId="advanced_data_type"
                    // placeholder={t('Advanced Data type')}
                    placeholder={t('高级数据类型')}
                  />
                }
              />
            ) : (
              <></>
            )}
            <Field
              fieldKey="python_date_format"
              // label={t('Datetime format')}
              label={t('日期时间格式')}
              description={
                /* Note the fragmented translations may not work. */
                // <div>
                //   {t('The pattern of timestamp format. For strings use ')}
                //   <a href="https://docs.python.org/2/library/datetime.html#strftime-strptime-behavior">
                //     {t('Python datetime string pattern')}
                //   </a>
                //   {t(' expression which needs to adhere to the ')}
                //   <a href="https://en.wikipedia.org/wiki/ISO_8601">
                //     {t('ISO 8601')}
                //   </a>
                //   {t(` standard to ensure that the lexicographical ordering
                //       coincides with the chronological ordering. If the
                //       timestamp format does not adhere to the ISO 8601 standard
                //       you will need to define an expression and type for
                //       transforming the string into a date or timestamp. Note
                //       currently time zones are not supported. If time is stored
                //       in epoch format, put \`epoch_s\` or \`epoch_ms\`. If no pattern
                //       is specified we fall back to using the optional defaults on a per
                //       database/column name level via the extra parameter.`)}
                // </div>
                <div>
                  {t('时间戳格式的模式。对于字符串使用 ')}
                  <a href="https://docs.python.org/2/library/datetime.html#strftime-strptime-behavior">
                    {t('Python 日期时间字符串模式')}
                  </a>
                  {t(' 需要遵守的表达式 ')}
                  <a href="https://en.wikipedia.org/wiki/ISO_8601">
                    {t('ISO 8601')}
                  </a>
                  {t(` 确保按照字典顺序排序的标准
                    与时间顺序一致如果
                    时间戳格式不符合 ISO 8601 标准
                    您需要定义一个表达式和类型
                    将字符串转换为日期或时间戳。注意
                    目前时区不被支持。如果存储了时间，请注意时区问题。
                    在 epoch 格式中，请使用`epoch_s`或`epoch_ms`。如果没有指定模式，则会退回到使用每个数据库/列名称级别的可选默认值。
                    在没有指定模式的情况下，我们将退回到使用每个数据库/列名称级别的可选默认值。
                    通过 extra 参数在数据库/列名称级别进行设置。`)}
                </div>
              }
              control={
                <TextControl
                  controlId="python_date_format"
                  placeholder="%Y-%m-%d"
                />
              }
            />
            <Field
              fieldKey="certified_by"
              // label={t('Certified By')}
              label={t('认证由')}
              // description={t('Person or group that has certified this metric')}
              description={t('已认证此指标的个人或团体')}
              control={
                <TextControl
                  controlId="certified"
                  // placeholder={t('Certified by')}
                  placeholder={t('认证由')}
                />
              }
            />
            <Field
              fieldKey="certification_details"
              // label={t('Certification details')}
              // description={t('Details of the certification')}
              label={t('认证详情')}
              description={t('认证详情')}
              control={
                <TextControl
                  controlId="certificationDetails"
                  // placeholder={t('Certification details')}
                  placeholder={t('认证详情')}
                />
              }
            />
          </Fieldset>
        </FormContainer>
      }
      columnLabels={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          // ? {
          //   column_name: t('Column'),
          //   advanced_data_type: t('Advanced data type'),
          //   type: t('Data type'),
          //   groupby: t('Is dimension'),
          //   is_dttm: t('Is temporal'),
          //   main_dttm_col: t('Default datetime'),
          //   filterable: t('Is filterable'),
          // }
          // : {
          //   column_name: t('Column'),
          //   type: t('Data type'),
          //   groupby: t('Is dimension'),
          //   is_dttm: t('Is temporal'),
          //   main_dttm_col: t('Default datetime'),
          //   filterable: t('Is filterable'),
          // }
          ? {
            column_name: t('列'),
            advanced_data_type: t('高级数据类型'),
            type: t('数据类型'),
            groupby: t('维度'),
            is_dttm: t('临时的'),
            main_dttm_col: t('默认日期时间'),
            filterable: t('可筛选'),
          }
          : {
            column_name: t('列'),
            type: t('数据类型'),
            groupby: t('维度'),
            is_dttm: t('临时的'),
            main_dttm_col: t('默认日期时间'),
            filterable: t('可筛选'),
          }
      }
      onChange={onColumnsChange}
      itemRenderers={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? {
            column_name: (v, onItemChange, _, record) =>
              editableColumnName ? (
                <StyledLabelWrapper>
                  {record.is_certified && (
                    <CertifiedBadge
                      certifiedBy={record.certified_by}
                      details={record.certification_details}
                    />
                  )}
                  <EditableTitle
                    canEdit
                    title={v}
                    onSaveTitle={onItemChange}
                  />
                </StyledLabelWrapper>
              ) : (
                <StyledLabelWrapper>
                  {record.is_certified && (
                    <CertifiedBadge
                      certifiedBy={record.certified_by}
                      details={record.certification_details}
                    />
                  )}
                  {v}
                </StyledLabelWrapper>
              ),
            main_dttm_col: (value, _onItemChange, _label, record) => {
              const checked = datasource.main_dttm_col === record.column_name;
              const disabled = !columns.find(
                column => column.column_name === record.column_name,
              ).is_dttm;
              return (
                <Radio
                  data-test={`radio-default-dttm-${record.column_name}`}
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onDatasourceChange({
                      ...datasource,
                      main_dttm_col: record.column_name,
                    })
                  }
                />
              );
            },
            type: d => (d ? <Label>{d}</Label> : null),
            advanced_data_type: d => (
              <Label onChange={onColumnsChange}>{d}</Label>
            ),
            is_dttm: checkboxGenerator,
            filterable: checkboxGenerator,
            groupby: checkboxGenerator,
          }
          : {
            column_name: (v, onItemChange, _, record) =>
              editableColumnName ? (
                <StyledLabelWrapper>
                  {record.is_certified && (
                    <CertifiedBadge
                      certifiedBy={record.certified_by}
                      details={record.certification_details}
                    />
                  )}
                  <TextControl value={v} onChange={onItemChange} />
                </StyledLabelWrapper>
              ) : (
                <StyledLabelWrapper>
                  {record.is_certified && (
                    <CertifiedBadge
                      certifiedBy={record.certified_by}
                      details={record.certification_details}
                    />
                  )}
                  {v}
                </StyledLabelWrapper>
              ),
            main_dttm_col: (value, _onItemChange, _label, record) => {
              const checked = datasource.main_dttm_col === record.column_name;
              const disabled = !columns.find(
                column => column.column_name === record.column_name,
              ).is_dttm;
              return (
                <Radio
                  data-test={`radio-default-dttm-${record.column_name}`}
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onDatasourceChange({
                      ...datasource,
                      main_dttm_col: record.column_name,
                    })
                  }
                />
              );
            },
            type: d => (d ? <Label>{d}</Label> : null),
            is_dttm: checkboxGenerator,
            filterable: checkboxGenerator,
            groupby: checkboxGenerator,
          }
      }
    />
  );
}
ColumnCollectionTable.propTypes = {
  columns: PropTypes.array.isRequired,
  datasource: PropTypes.object.isRequired,
  onColumnsChange: PropTypes.func.isRequired,
  onDatasourceChange: PropTypes.func.isRequired,
  editableColumnName: PropTypes.bool,
  showExpression: PropTypes.bool,
  allowAddItem: PropTypes.bool,
  allowEditDataType: PropTypes.bool,
  itemGenerator: PropTypes.func,
};
ColumnCollectionTable.defaultProps = {
  editableColumnName: false,
  showExpression: false,
  allowAddItem: false,
  allowEditDataType: false,
  itemGenerator: () => ({
    // column_name: t('<new column>'),
    column_name: t('<新建列>'),
    filterable: true,
    groupby: true,
  }),
};

function StackedField({ label, formElement }) {
  return (
    <div>
      <div>
        <strong>{label}</strong>
      </div>
      <div>{formElement}</div>
    </div>
  );
}

StackedField.propTypes = {
  label: PropTypes.string,
  formElement: PropTypes.node,
};

function FormContainer({ children }) {
  return <Card padded>{children}</Card>;
}

FormContainer.propTypes = {
  children: PropTypes.node,
};

const propTypes = {
  datasource: PropTypes.object.isRequired,
  onChange: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  setIsEditing: PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
  setIsEditing: () => {},
};

function OwnersSelector({ datasource, onChange }) {
  const loadOptions = useCallback((search = '', page, pageSize) => {
    const query = rison.encode({ filter: search, page, page_size: pageSize });
    return SupersetClient.get({
      endpoint: `/api/v1/dataset/related/owners?q=${query}`,
    }).then(response => ({
      data: response.json.result
        .filter(item => item.extra.active)
        .map(item => ({
          value: item.value,
          label: item.text,
        })),
      totalCount: response.json.count,
    }));
  }, []);

  return (
    <AsyncSelect
      // ariaLabel={t('Select owners')}
      ariaLabel={t('选择所有者')}
      mode="multiple"
      name="owners"
      value={datasource.owners}
      options={loadOptions}
      onChange={onChange}
      // header={<FormLabel>{t('Owners')}</FormLabel>}
      header={<FormLabel>{t('所有者')}</FormLabel>}
      allowClear
    />
  );
}

class DatasourceEditor extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      datasource: {
        ...props.datasource,
        owners: props.datasource.owners.map(owner => ({
          value: owner.value || owner.id,
          label: owner.label || `${owner.first_name} ${owner.last_name}`,
        })),
        metrics: props.datasource.metrics?.map(metric => {
          const {
            certified_by: certifiedByMetric,
            certification_details: certificationDetails,
          } = metric;
          const {
            certification: { details, certified_by: certifiedBy } = {},
            warning_markdown: warningMarkdown,
          } = JSON.parse(metric.extra || '{}') || {};
          return {
            ...metric,
            certification_details: certificationDetails || details,
            warning_markdown: warningMarkdown || '',
            certified_by: certifiedBy || certifiedByMetric,
          };
        }),
      },
      errors: [],
      isSqla:
        props.datasource.datasource_type === 'table' ||
        props.datasource.type === 'table',
      isEditMode: false,
      databaseColumns: props.datasource.columns.filter(col => !col.expression),
      calculatedColumns: props.datasource.columns.filter(
        col => !!col.expression,
      ),
      metadataLoading: false,
      activeTabKey: 0,
      datasourceType: props.datasource.sql
        ? DATASOURCE_TYPES.virtual.key
        : DATASOURCE_TYPES.physical.key,
    };

    this.onChange = this.onChange.bind(this);
    this.onChangeEditMode = this.onChangeEditMode.bind(this);
    this.onDatasourcePropChange = this.onDatasourcePropChange.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.tableChangeAndSyncMetadata =
      this.tableChangeAndSyncMetadata.bind(this);
    this.syncMetadata = this.syncMetadata.bind(this);
    this.setColumns = this.setColumns.bind(this);
    this.validateAndChange = this.validateAndChange.bind(this);
    this.handleTabSelect = this.handleTabSelect.bind(this);
    this.currencies = ensureIsArray(props.currencies).map(currencyCode => ({
      value: currencyCode,
      label: `${getCurrencySymbol({
        symbol: currencyCode,
      })} (${currencyCode})`,
    }));
  }

  onChange() {
    // Emptying SQL if "Physical" radio button is selected
    // Currently the logic to know whether the source is
    // physical or virtual is based on whether SQL is empty or not.
    const { datasourceType, datasource } = this.state;
    const sql =
      datasourceType === DATASOURCE_TYPES.physical.key ? '' : datasource.sql;
    const newDatasource = {
      ...this.state.datasource,
      sql,
      columns: [...this.state.databaseColumns, ...this.state.calculatedColumns],
    };
    this.props.onChange(newDatasource, this.state.errors);
  }

  onChangeEditMode() {
    this.props.setIsEditing(!this.state.isEditMode);
    this.setState(prevState => ({ isEditMode: !prevState.isEditMode }));
  }

  onDatasourceChange(datasource, callback = this.validateAndChange) {
    this.setState({ datasource }, callback);
  }

  onDatasourcePropChange(attr, value) {
    if (value === undefined) return; // if value is undefined do not update state
    const datasource = { ...this.state.datasource, [attr]: value };
    this.setState(
      prevState => ({
        datasource: { ...prevState.datasource, [attr]: value },
      }),
      attr === 'table_name'
        ? this.onDatasourceChange(datasource, this.tableChangeAndSyncMetadata)
        : this.onDatasourceChange(datasource, this.validateAndChange),
    );
  }

  onDatasourceTypeChange(datasourceType) {
    this.setState({ datasourceType });
  }

  setColumns(obj) {
    // update calculatedColumns or databaseColumns
    this.setState(obj, this.validateAndChange);
  }

  validateAndChange() {
    this.validate(this.onChange);
  }

  tableChangeAndSyncMetadata() {
    this.validate(() => {
      this.syncMetadata();
      this.onChange();
    });
  }

  async syncMetadata() {
    const { datasource } = this.state;
    this.setState({ metadataLoading: true });
    try {
      const newCols = await fetchSyncedColumns(datasource);
      const columnChanges = updateColumns(
        datasource.columns,
        newCols,
        this.props.addSuccessToast,
      );
      this.setColumns({
        databaseColumns: columnChanges.finalColumns.filter(
          col => !col.expression, // remove calculated columns
        ),
      });
      // this.props.addSuccessToast(t('Metadata has been synced'));
      this.props.addSuccessToast(t('元数据已同步'));
      this.setState({ metadataLoading: false });
    } catch (error) {
      const { error: clientError, statusText } =
        await getClientErrorObject(error);
      this.props.addDangerToast(
        // clientError || statusText || t('An error has occurred'),
        clientError || statusText || t('发生了一个错误'),
      );
      this.setState({ metadataLoading: false });
    }
  }

  findDuplicates(arr, accessor) {
    const seen = {};
    const dups = [];
    arr.forEach(obj => {
      const item = accessor(obj);
      if (item in seen) {
        dups.push(item);
      } else {
        seen[item] = null;
      }
    });
    return dups;
  }

  validate(callback) {
    let errors = [];
    let dups;
    const { datasource } = this.state;

    // Looking for duplicate column_name
    dups = this.findDuplicates(datasource.columns, obj => obj.column_name);
    errors = errors.concat(
      // dups.map(name => t('Column name [%s] is duplicated', name)),
      dups.map(name => t('列名 [%s] 重复', name)),
    );

    // Looking for duplicate metric_name
    dups = this.findDuplicates(datasource.metrics, obj => obj.metric_name);
    errors = errors.concat(
      // dups.map(name => t('Metric name [%s] is duplicated', name)),
      dups.map(name => t('指标名 [%s] 重复的', name)),
    );

    // Making sure calculatedColumns have an expression defined
    const noFilterCalcCols = this.state.calculatedColumns.filter(
      col => !col.expression && !col.json,
    );
    errors = errors.concat(
      noFilterCalcCols.map(col =>
        // t('Calculated column [%s] requires an expression', col.column_name),
        t('计算列 [%s] 需要一个表达式', col.column_name),
      ),
    );

    // validate currency code
    try {
      this.state.datasource.metrics?.forEach(
        metric =>
          metric.currency?.symbol &&
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: metric.currency.symbol,
          }),
      );
    } catch {
      // errors = errors.concat([t('Invalid currency code in saved metrics')]);
      errors = errors.concat([t('保存的指标中无效的货币代码')]);
    }

    this.setState({ errors }, callback);
  }

  handleTabSelect(activeTabKey) {
    this.setState({ activeTabKey });
  }

  sortMetrics(metrics) {
    return metrics.sort(({ id: a }, { id: b }) => b - a);
  }

  renderSettingsFieldset() {
    const { datasource } = this.state;
    return (
      <Fieldset
        // title={t('Basic')}
        title={t('基本')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        <Field
          fieldKey="description"
          // label={t('Description')}
          label={t('描述')}
          control={
            <TextAreaControl
              language="markdown"
              offerEditInModal={false}
              resize="vertical"
            />
          }
        />
        <Field
          fieldKey="default_endpoint"
          // label={t('Default URL')}
          label={t('默认 URL')}
          // description={t(
          //   `Default URL to redirect to when accessing from the dataset list page.
          //   Accepts relative URLs such as <span style=„white-space: nowrap;”>/superset/dashboard/{id}/</span>`,
          // )}
          description={t(
            `从数据集列表页面访问时重定向的默认 URL。
            接受类似<span style="white-space: nowrap;">/superset/dashboard/{id}/</span>这样的相对 URL`,
          )}
          control={<TextControl controlId="default_endpoint" />}
        />
        <Field
          inline
          fieldKey="filter_select_enabled"
          // label={t('Autocomplete filters')}
          // description={t('Whether to populate autocomplete filters options')}
          label={t('自动补全过滤器')}
          description={t('是否填充自动完成过滤选项')}
          control={<CheckboxControl />}
        />
        {this.state.isSqla && (
          <Field
            fieldKey="fetch_values_predicate"
            // label={t('Autocomplete query predicate')}
            label={t('自动补全查询谓词')}
            // description={t(
            //   'When using "Autocomplete filters", this can be used to improve performance ' +
            //   'of the query fetching the values. Use this option to apply a ' +
            //   'predicate (WHERE clause) to the query selecting the distinct ' +
            //   'values from the table. Typically the intent would be to limit the scan ' +
            //   'by applying a relative time filter on a partitioned or indexed time-related field.',
            // )}
            description={t(
              '使用“自动完成过滤器”时，这可以用来提高性能 ' +
              '查询获取值时使用。请使用此选项应用一个 ' +
              '将 WHERE 子句作为谓词添加到查询中以选择不同的 ' +
              '表中的值。通常的意图是限制扫描。 ' +
              '通过在分区或索引的时间相关字段上应用相对时间过滤器。',
            )}
            control={
              <TextAreaControl
                language="sql"
                controlId="fetch_values_predicate"
                minLines={5}
                resize="vertical"
              />
            }
          />
        )}
        {this.state.isSqla && (
          <Field
            fieldKey="extra"
            // label={t('Extra')}
            label={t('额外')}
            // description={t(
            //   'Extra data to specify table metadata. Currently supports ' +
            //   'metadata of the format: `{ "certification": { "certified_by": ' +
            //   '"Data Platform Team", "details": "This table is the source of truth." ' +
            //   '}, "warning_markdown": "This is a warning." }`.',
            // )}
            description={t(
              '额外的数据以指定表元数据。当前支持 ' +
              'metadata 格式如下：```{ "certification": { "certified_by": ```' +
              '"Data Platform Team", "details": "这张表是真相的来源。"" ' +
              '}, "warning_markdown": "这是一条警告。" }`.',
            )}
            control={
              <TextAreaControl
                controlId="extra"
                language="json"
                offerEditInModal={false}
                resize="vertical"
              />
            }
          />
        )}
        <OwnersSelector
          datasource={datasource}
          onChange={newOwners => {
            this.onDatasourceChange({ ...datasource, owners: newOwners });
          }}
        />
      </Fieldset>
    );
  }

  renderAdvancedFieldset() {
    const { datasource } = this.state;
    return (
      <Fieldset
        // title={t('Advanced')}
        title={t('高级')}
        item={datasource}
        onChange={this.onDatasourceChange}
      >
        <Field
          fieldKey="cache_timeout"
          // label={t('Cache timeout')}
          label={t('缓存超时')}
          // description={t(
          //   'The duration of time in seconds before the cache is invalidated. Set to -1 to bypass the cache.',
          // )}
          description={t(
            '缓存失效前的秒数。设置为-1 以跳过缓存。',
          )}
          control={<TextControl controlId="cache_timeout" />}
        />
        <Field
          fieldKey="offset"
          // label={t('Hours offset')}
          label={t('时区偏移量')}
          control={<TextControl controlId="offset" />}
          // description={t(
          //   'The number of hours, negative or positive, to shift the time column. This can be used to move UTC time to local time.',
          // )}
          description={t(
            '要将时间列向前或向后移动的小时数，可以是正数或负数。这可以用于将 UTC 时间转换为本地时间。',
          )}
        />
        {this.state.isSqla && (
          <Field
            fieldKey="template_params"
            // label={t('Template parameters')}
            label={t('模板参数')}
            // description={t(
            //   'A set of parameters that become available in the query using Jinja templating syntax',
            // )}
            description={t(
              '在查询中使用 Jinja 模板语法可用的一组参数',
            )}
            control={<TextControl controlId="template_params" />}
          />
        )}
        <Field
          inline
          fieldKey="normalize_columns"
          // label={t('Normalize column names')}
          // description={t(
          //   'Allow column names to be changed to case insensitive format, if supported (e.g. Oracle, Snowflake).',
          // )}
          label={t('规范化列名称')}
          description={t(
            '允许将列名更改为不区分大小写的格式（例如：Oracle、Snowflake）。',
          )}
          control={<CheckboxControl controlId="normalize_columns" />}
        />
        <Field
          inline
          fieldKey="always_filter_main_dttm"
          // label={t('Always filter main datetime column')}
          // description={t(
          //   `When the secondary temporal columns are filtered, apply the same filter to the main datetime column.`,
          // )}
          label={t('始终过滤主要时间日期列')}
          description={t(
            `当次级时间列被过滤时，将相同的过滤器应用于主日期时间列。`,
          )}
          control={<CheckboxControl controlId="always_filter_main_dttm" />}
        />
      </Fieldset>
    );
  }

  renderSpatialTab() {
    const { datasource } = this.state;
    const { spatials, all_cols: allCols } = datasource;
    return (
      <Tabs.TabPane
        tab={<CollectionTabTitle collection={spatials} title={t('Spatial')} />}
        key={4}
      >
        <CollectionTable
          tableColumns={['name', 'config']}
          onChange={this.onDatasourcePropChange.bind(this, 'spatials')}
          itemGenerator={() => ({
            // name: t('<new spatial>'),
            // type: t('<no type>'),
            name: t('<新空间>'),
            type: t('<无类型>'),
            config: null,
          })}
          collection={spatials}
          allowDeletes
          itemRenderers={{
            name: (d, onChange) => (
              <EditableTitle canEdit title={d} onSaveTitle={onChange} />
            ),
            config: (v, onChange) => (
              <SpatialControl value={v} onChange={onChange} choices={allCols} />
            ),
          }}
        />
      </Tabs.TabPane>
    );
  }

  renderSourceFieldset() {
    const { datasource } = this.state;
    return (
      <div>
        <EditLockContainer>
          <span role="button" tabIndex={0} onClick={this.onChangeEditMode}>
            {this.state.isEditMode ? (
              <Icons.UnlockOutlined
                iconSize="xl"
                css={theme => css`
                  margin: auto ${theme.gridUnit}px auto 0;
                `}
              />
            ) : (
              <Icons.LockOutlined
                iconSize="xl"
                css={theme => ({
                  margin: `auto ${theme.gridUnit}px auto 0`,
                })}
              />
            )}
          </span>
          {!this.state.isEditMode && (
            // <div>{t('Click the lock to make changes.')}</div>
            <div>{t('点击锁以进行更改。')}</div>
          )}
          {this.state.isEditMode && (
            // <div>{t('Click the lock to prevent further changes.')}</div>
            <div>{t('点击锁以防止进一步更改。')}</div>
          )}
        </EditLockContainer>
        <div className="m-l-10 m-t-20 m-b-10">
          {DATASOURCE_TYPES_ARR.map(type => (
            <Radio
              key={type.key}
              value={type.key}
              inline
              onChange={this.onDatasourceTypeChange.bind(this, type.key)}
              checked={this.state.datasourceType === type.key}
              disabled={!this.state.isEditMode}
            >
              {type.label}
            </Radio>
          ))}
        </div>
        <hr />
        <Fieldset item={datasource} onChange={this.onDatasourceChange} compact>
          {this.state.datasourceType === DATASOURCE_TYPES.virtual.key && (
            <div>
              {this.state.isSqla && (
                <>
                  <Col xs={24} md={12}>
                    <Field
                      fieldKey="databaseSelector"
                      // label={t('Virtual')}
                      label={t('虚拟')}
                      control={
                        <div css={{ marginTop: 8 }}>
                          <DatabaseSelector
                            db={datasource?.database}
                            catalog={datasource.catalog}
                            schema={datasource.schema}
                            onCatalogChange={catalog =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('catalog', catalog)
                            }
                            onSchemaChange={schema =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('schema', schema)
                            }
                            onDbChange={database =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('database', database)
                            }
                            formMode={false}
                            handleError={this.props.addDangerToast}
                            readOnly={!this.state.isEditMode}
                          />
                        </div>
                      }
                    />
                    <div css={{ width: 'calc(100% - 34px)', marginTop: -16 }}>
                      <Field
                        fieldKey="table_name"
                        // label={t('Name')}
                        label={t('名称')}
                        control={
                          <TextControl
                            controlId="table_name"
                            onChange={table => {
                              this.onDatasourcePropChange('table_name', table);
                            }}
                            // placeholder={t('Dataset name')}
                            placeholder={t('数据集名称')}
                            disabled={!this.state.isEditMode}
                          />
                        }
                      />
                    </div>
                  </Col>
                  <Field
                    fieldKey="sql"
                    label={t('SQL')}
                    // description={t(
                    //   'When specifying SQL, the datasource acts as a view. ' +
                    //   'Superset will use this statement as a subquery while grouping and filtering ' +
                    //   'on the generated parent queries.',
                    // )}
                    description={t(
                      '在指定 SQL 时，数据源充当视图。 ' +
                      'Superset 将会使用这条语句作为子查询，在分组和过滤时使用 ' +
                      '在生成的父查询上。',
                    )}
                    control={
                      <TextAreaControl
                        language="sql"
                        offerEditInModal={false}
                        minLines={20}
                        maxLines={Infinity}
                        readOnly={!this.state.isEditMode}
                        resize="both"
                        tooltipOptions={sqlTooltipOptions}
                      />
                    }
                  />
                </>
              )}
            </div>
          )}
          {this.state.datasourceType === DATASOURCE_TYPES.physical.key && (
            <Col xs={24} md={12}>
              {this.state.isSqla && (
                <Field
                  fieldKey="tableSelector"
                  // label={t('Physical')}
                  label={t('物理')}
                  control={
                    <div css={{ marginTop: 8 }}>
                      <TableSelector
                        clearable={false}
                        database={{
                          ...datasource.database,
                          database_name:
                            datasource.database?.database_name ||
                            datasource.database?.name,
                        }}
                        dbId={datasource.database?.id}
                        handleError={this.props.addDangerToast}
                        catalog={datasource.catalog}
                        schema={datasource.schema}
                        sqlLabMode={false}
                        tableValue={datasource.table_name}
                        onCatalogChange={
                          this.state.isEditMode
                            ? catalog =>
                              this.onDatasourcePropChange('catalog', catalog)
                            : undefined
                        }
                        onSchemaChange={
                          this.state.isEditMode
                            ? schema =>
                              this.onDatasourcePropChange('schema', schema)
                            : undefined
                        }
                        onDbChange={
                          this.state.isEditMode
                            ? database =>
                              this.onDatasourcePropChange(
                                'database',
                                database,
                              )
                            : undefined
                        }
                        onTableSelectChange={
                          this.state.isEditMode
                            ? table =>
                              this.onDatasourcePropChange('table_name', table)
                            : undefined
                        }
                        readOnly={!this.state.isEditMode}
                      />
                    </div>
                  }
                  // description={t(
                  //   'The pointer to a physical table (or view). Keep in mind that the chart is ' +
                  //   'associated to this Superset logical table, and this logical table points ' +
                  //   'the physical table referenced here.',
                  // )}
                  description={t(
                    '指向一个物理表（或视图）的指针。请注意，图表是 ' +
                    '与此 Superset 逻辑表关联，并且该逻辑表指向 ' +
                    '这里引用的物理表。',
                  )}
                />
              )}
            </Col>
          )}
        </Fieldset>
      </div>
    );
  }

  renderErrors() {
    if (this.state.errors.length > 0) {
      return (
        <Alert
          css={theme => ({ marginBottom: theme.gridUnit * 4 })}
          type="error"
          message={
            <>
              {this.state.errors.map(err => (
                <div key={err}>{err}</div>
              ))}
            </>
          }
        />
      );
    }
    return null;
  }

  renderMetricCollection() {
    const { datasource } = this.state;
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? this.sortMetrics(metrics) : [];
    return (
      <CollectionTable
        tableColumns={['metric_name', 'verbose_name', 'expression']}
        sortColumns={['metric_name', 'verbose_name', 'expression']}
        columnLabels={{
          // metric_name: t('Metric Key'),
          // verbose_name: t('Label'),
          // expression: t('SQL expression'),
          metric_name: t('指标键'),
          verbose_name: t('标签'),
          expression: t('SQL 表达式'),
        }}
        columnLabelTooltips={{
          // metric_name: t(
          //   'This field is used as a unique identifier to attach ' +
          //   'the metric to charts. It is also used as the alias in the ' +
          //   'SQL query.',
          // ),
          metric_name: t(
            '此字段用作唯一标识符以附加 ' +
            '指标图表。它也被用作其中的别名。 ' +
            'SQL 查询。',
          ),
        }}
        expandFieldset={
          <FormContainer>
            <Fieldset compact>
              <Field
                fieldKey="description"
                // label={t('Description')}
                label={t('描述')}
                control={
                  <TextControl
                    controlId="description"
                    // placeholder={t('Description')}
                    placeholder={t('描述')}
                  />
                }
              />
              <Field
                fieldKey="d3format"
                // label={t('D3 format')}
                label={t('D3 格式')}
                control={
                  <TextControl controlId="d3format" placeholder="%y/%m/%d" />
                }
              />
              <Field
                fieldKey="currency"
                // label={t('Metric currency')}
                label={t('度量货币')}
                control={
                  <CurrencyControl
                    currencySelectOverrideProps={{
                      // placeholder: t('Select or type currency symbol'),
                      placeholder: t('选择或输入货币符号'),
                    }}
                    symbolSelectAdditionalStyles={css`
                      max-width: 30%;
                    `}
                  />
                }
              />
              <Field
                // label={t('Certified by')}
                label={t('认证由')}
                fieldKey="certified_by"
                // description={t(
                //   'Person or group that has certified this metric',
                // )}
                description={t(
                  '已认证此指标的人员或团体',
                )}
                control={
                  <TextControl
                    controlId="certified_by"
                    // placeholder={t('Certified by')}
                    placeholder={t('认证由')}
                  />
                }
              />
              <Field
                // label={t('Certification details')}
                label={t('认证详情')}
                fieldKey="certification_details"
                // description={t('Details of the certification')}
                description={t('认证详情')}
                control={
                  <TextControl
                    controlId="certification_details"
                    // placeholder={t('Certification details')}
                    placeholder={t('认证详情')}
                  />
                }
              />
              <Field
                // label={t('Warning')}
                label={t('警告')}
                fieldKey="warning_markdown"
                // description={t('Optional warning about use of this metric')}
                description={t('关于使用此指标的可选警告')}
                control={
                  <TextAreaControl
                    controlId="warning_markdown"
                    language="markdown"
                    offerEditInModal={false}
                    resize="vertical"
                  />
                }
              />
            </Fieldset>
          </FormContainer>
        }
        collection={sortedMetrics}
        allowAddItem
        onChange={this.onDatasourcePropChange.bind(this, 'metrics')}
        itemGenerator={() => ({
          // metric_name: t('<new metric>'),
          metric_name: t('<新指标>'),
          verbose_name: '',
          expression: '',
        })}
        itemCellProps={{
          expression: () => ({
            width: '240px',
          }),
        }}
        itemRenderers={{
          metric_name: (v, onChange, _, record) => (
            <FlexRowContainer>
              {record.is_certified && (
                <CertifiedBadge
                  certifiedBy={record.certified_by}
                  details={record.certification_details}
                />
              )}
              {record.warning_markdown && (
                <WarningIconWithTooltip
                  warningMarkdown={record.warning_markdown}
                />
              )}
              <EditableTitle canEdit title={v} onSaveTitle={onChange} />
            </FlexRowContainer>
          ),
          verbose_name: (v, onChange) => (
            <TextControl canEdit value={v} onChange={onChange} />
          ),
          expression: (v, onChange) => (
            <TextAreaControl
              canEdit
              initialValue={v}
              onChange={onChange}
              extraClasses={['datasource-sql-expression']}
              language="sql"
              offerEditInModal={false}
              minLines={5}
              textAreaStyles={{ minWidth: '200px', maxWidth: '450px' }}
              resize="both"
            />
          ),
          description: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={<TextControl value={v} onChange={onChange} />}
            />
          ),
          d3format: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={<TextControl value={v} onChange={onChange} />}
            />
          ),
        }}
        allowDeletes
        stickyHeader
      />
    );
  }

  render() {
    const { datasource, activeTabKey } = this.state;
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? this.sortMetrics(metrics) : [];
    const { theme } = this.props;

    return (
      <DatasourceContainer data-test="datasource-editor">
        {this.renderErrors()}
        <Alert
          css={theme => ({ marginBottom: theme.gridUnit * 4 })}
          type="warning"
          message={
            <>
              {/* <strong>{t('Be careful.')} </strong>
              {t(
                'Changing these settings will affect all charts using this dataset, including charts owned by other people.',
              )} */}
              {' '}
                <strong>{t('小心。')} </strong>
              {t(
                '更改这些设置将会影响使用此数据集的所有图表，包括其他人员拥有的图表。',
              )}
            </>
          }
        />
        <StyledTableTabs
          fullWidth={false}
          id="table-tabs"
          data-test="edit-dataset-tabs"
          onChange={this.handleTabSelect}
          defaultActiveKey={activeTabKey}
        >
          {/* <Tabs.TabPane key={0} tab={t('Source')}> */}
          <Tabs.TabPane key={0} tab={t('源')}>
            {this.renderSourceFieldset(theme)}
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <CollectionTabTitle
                collection={sortedMetrics}
                // title={t('Metrics')}
                title={t('指标')}
              />
            }
            key={1}
          >
            {this.renderMetricCollection()}
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <CollectionTabTitle
                collection={this.state.databaseColumns}
                // title={t('Columns')}
                title={t('列')}
              />
            }
            key={2}
          >
            <StyledColumnsTabWrapper>
              <ColumnButtonWrapper>
                <StyledButtonWrapper>
                  <Button
                    buttonSize="small"
                    buttonStyle="tertiary"
                    onClick={this.syncMetadata}
                    className="sync-from-source"
                    disabled={this.state.isEditMode}
                  >
                    <Icons.DatabaseOutlined iconSize="m" />
                    {/* {t('Sync columns from source')} */}
                    {t('从源同步列')}
                  </Button>
                </StyledButtonWrapper>
              </ColumnButtonWrapper>
              <ColumnCollectionTable
                className="columns-table"
                columns={this.state.databaseColumns}
                datasource={datasource}
                onColumnsChange={databaseColumns =>
                  this.setColumns({ databaseColumns })
                }
                onDatasourceChange={this.onDatasourceChange}
              />
              {this.state.metadataLoading && <Loading />}
            </StyledColumnsTabWrapper>
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <CollectionTabTitle
                collection={this.state.calculatedColumns}
                // title={t('Calculated columns')}
                title={t('计算列')}
              />
            }
            key={3}
          >
            <StyledColumnsTabWrapper>
              <ColumnCollectionTable
                columns={this.state.calculatedColumns}
                onColumnsChange={calculatedColumns =>
                  this.setColumns({ calculatedColumns })
                }
                columnLabelTooltips={{
                  // column_name: t(
                  //   'This field is used as a unique identifier to attach ' +
                  //   'the calculated dimension to charts. It is also used ' +
                  //   'as the alias in the SQL query.',
                  // ),
                  column_name: t(
                    '此字段用作唯一标识符以附加 ' +
                    '计算得到的尺寸用于图表。它也被用于 ' +
                    '作为 SQL 查询中的别名。',
                  ),
                }}
                onDatasourceChange={this.onDatasourceChange}
                datasource={datasource}
                editableColumnName
                showExpression
                allowAddItem
                allowEditDataType
                itemGenerator={() => ({
                  // column_name: t('<new column>'),
                  column_name: t('<新列>'),
                  filterable: true,
                  groupby: true,
                  // expression: t('<enter SQL expression here>'),
                  expression: t('<在此处输入 SQL 表达式>'),
                  __expanded: true,
                })}
              />
            </StyledColumnsTabWrapper>
          </Tabs.TabPane>
          {/* <Tabs.TabPane key={4} tab={t('Settings')}> */}
          <Tabs.TabPane key={4} tab={t('设置')}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <FormContainer>{this.renderSettingsFieldset()}</FormContainer>
              </Col>
              <Col xs={24} md={12}>
                <FormContainer>{this.renderAdvancedFieldset()}</FormContainer>
              </Col>
            </Row>
          </Tabs.TabPane>
        </StyledTableTabs>
      </DatasourceContainer>
    );
  }
}

DatasourceEditor.defaultProps = defaultProps;
DatasourceEditor.propTypes = propTypes;

const DataSourceComponent = withTheme(DatasourceEditor);

export default withToasts(DataSourceComponent);
