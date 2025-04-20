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
import { Component } from 'react';
import PropTypes from 'prop-types';
import { Input } from 'src/components/Input';
import Button from 'src/components/Button';
import { Select, Row, Col } from 'src/components';
import { t, styled } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import BoundsControl from '../BoundsControl';
import CheckboxControl from '../CheckboxControl';
import ControlPopover from '../ControlPopover/ControlPopover';

const propTypes = {
  label: PropTypes.string,
  tooltip: PropTypes.string,
  colType: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
  timeLag: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  timeRatio: PropTypes.string,
  comparisonType: PropTypes.string,
  showYAxis: PropTypes.bool,
  yAxisBounds: PropTypes.array,
  bounds: PropTypes.array,
  d3format: PropTypes.string,
  dateFormat: PropTypes.string,
  onChange: PropTypes.func,
};

const defaultProps = {
  label: t('Time series columns'),
  tooltip: '',
  colType: '',
  width: '',
  height: '',
  timeLag: '',
  timeRatio: '',
  comparisonType: '',
  showYAxis: false,
  yAxisBounds: [null, null],
  bounds: [null, null],
  d3format: '',
  dateFormat: '',
};

const comparisonTypeOptions = [
  // { value: 'value', label: t('Actual value'), key: 'value' },
  // { value: 'diff', label: t('Difference'), key: 'diff' },
  // { value: 'perc', label: t('Percentage'), key: 'perc' },
  // { value: 'perc_change', label: t('Percentage change'), key: 'perc_change' },
  { value: 'value', label: t('实际值'), key: 'value' },
  { value: 'diff', label: t('差异'), key: 'diff' },
  { value: 'perc', label: t('百分比'), key: 'perc' },
  { value: 'perc_change', label: t('百分比变化'), key: 'perc_change' },
];

const colTypeOptions = [
  // { value: 'time', label: t('Time comparison'), key: 'time' },
  // { value: 'contrib', label: t('Contribution'), key: 'contrib' },
  // { value: 'spark', label: t('Sparkline'), key: 'spark' },
  // { value: 'avg', label: t('Period average'), key: 'avg' },
  { value: 'time', label: t('时间比较'), key: 'time' },
  { value: 'contrib', label: t('贡献'), key: 'contrib' },
  { value: 'spark', label: t('迷你图'), key: 'spark' },
  { value: 'avg', label: t('周期平均值'), key: 'avg' },
];

const StyledRow = styled(Row)`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  display: flex;
  align-items: center;
`;

const StyledCol = styled(Col)`
  display: flex;
  align-items: center;
`;

const StyledTooltip = styled(InfoTooltipWithTrigger)`
  margin-left: ${({ theme }) => theme.gridUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
`;

const ButtonBar = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 5}px;
  display: flex;
  justify-content: center;
`;

export default class TimeSeriesColumnControl extends Component {
  constructor(props) {
    super(props);

    this.onSave = this.onSave.bind(this);
    this.onClose = this.onClose.bind(this);
    this.resetState = this.resetState.bind(this);
    this.initialState = this.initialState.bind(this);
    this.onPopoverVisibleChange = this.onPopoverVisibleChange.bind(this);

    this.state = this.initialState();
  }

  initialState() {
    return {
      label: this.props.label,
      tooltip: this.props.tooltip,
      colType: this.props.colType,
      width: this.props.width,
      height: this.props.height,
      timeLag: this.props.timeLag || 0,
      timeRatio: this.props.timeRatio,
      comparisonType: this.props.comparisonType,
      showYAxis: this.props.showYAxis,
      yAxisBounds: this.props.yAxisBounds,
      bounds: this.props.bounds,
      d3format: this.props.d3format,
      dateFormat: this.props.dateFormat,
      popoverVisible: false,
    };
  }

  resetState() {
    const initialState = this.initialState();
    this.setState({ ...initialState });
  }

  onSave() {
    this.props.onChange(this.state);
    this.setState({ popoverVisible: false });
  }

  onClose() {
    this.resetState();
  }

  onSelectChange(attr, opt) {
    this.setState({ [attr]: opt });
  }

  onTextInputChange(attr, event) {
    this.setState({ [attr]: event.target.value });
  }

  onCheckboxChange(attr, value) {
    this.setState({ [attr]: value });
  }

  onBoundsChange(bounds) {
    this.setState({ bounds });
  }

  onPopoverVisibleChange(popoverVisible) {
    if (popoverVisible) {
      this.setState({ popoverVisible });
    } else {
      this.resetState();
    }
  }

  onYAxisBoundsChange(yAxisBounds) {
    this.setState({ yAxisBounds });
  }

  textSummary() {
    return `${this.props.label}`;
  }

  formRow(label, tooltip, ttLabel, control) {
    return (
      <StyledRow>
        <StyledCol xs={24} md={11}>
          {label}
          <StyledTooltip placement="top" tooltip={tooltip} label={ttLabel} />
        </StyledCol>
        <Col xs={24} md={13}>
          {control}
        </Col>
      </StyledRow>
    );
  }

  renderPopover() {
    return (
      <div id="ts-col-popo" style={{ width: 320 }}>
        {this.formRow(
          // t('Label'),
          // t('The column header label'),
          t('标签'),
          t('列标题标签'),
          'time-lag',
          <Input
            value={this.state.label}
            onChange={this.onTextInputChange.bind(this, 'label')}
            // placeholder={t('Label')}
            placeholder={t('标签')}
          />,
        )}
        {this.formRow(
          // t('Tooltip'),
          // t('Column header tooltip'),
          t('提示框'),
          t('列标题提示框'),
          'col-tooltip',
          <Input
            value={this.state.tooltip}
            onChange={this.onTextInputChange.bind(this, 'tooltip')}
            // placeholder={t('Tooltip')}
            placeholder={t('提示框')}
          />,
        )}
        {this.formRow(
          // t('Type'),
          // t('Type of comparison, value difference or percentage'),
          t('类型'),
          t('比较类型、值差或百分比'),
          'col-type',
          <Select
            // ariaLabel={t('Type')}
            ariaLabel={t('类型')}
            value={this.state.colType || undefined}
            onChange={this.onSelectChange.bind(this, 'colType')}
            options={colTypeOptions}
          />,
        )}
        <hr />
        {this.state.colType === 'spark' &&
          this.formRow(
            // t('Width'),
            // t('Width of the sparkline'),
            t('宽度'),
            t('迷你图的宽度'),
            'spark-width',
            <Input
              value={this.state.width}
              onChange={this.onTextInputChange.bind(this, 'width')}
              // placeholder={t('Width')}
              placeholder={t('宽度')}
            />,
          )}
        {this.state.colType === 'spark' &&
          this.formRow(
            // t('Height'),
            // t('Height of the sparkline'),
            t('高度'),
            t('迷你图的高度'),
            'spark-width',
            <Input
              value={this.state.height}
              onChange={this.onTextInputChange.bind(this, 'height')}
              // placeholder={t('Height')}
              placeholder={t('高度')}
            />,
          )}
        {['time', 'avg'].indexOf(this.state.colType) >= 0 &&
          this.formRow(
            // t('Time lag'),
            // t(
            //   'Number of periods to compare against. You can use negative numbers to compare from the beginning of the time range.',
            // ),
            t('时间滞后'),
            t(
              '要比较的期间数。您可以使用负数从时间范围的开始进行比较。',
            ),
            'time-lag',
            <Input
              value={this.state.timeLag}
              onChange={this.onTextInputChange.bind(this, 'timeLag')}
              // placeholder={t('Time Lag')}
              placeholder={t('时间滞后')}
            />,
          )}
        {['spark'].indexOf(this.state.colType) >= 0 &&
          this.formRow(
            // t('Time ratio'),
            // t('Number of periods to ratio against'),
            t('时间比例'),
            t('比率对应的周期数'),
            'time-ratio',
            <Input
              value={this.state.timeRatio}
              onChange={this.onTextInputChange.bind(this, 'timeRatio')}
              // placeholder={t('Time Ratio')}
              placeholder={t('时间比例')}
            />,
          )}
        {this.state.colType === 'time' &&
          this.formRow(
            // t('Type'),
            // t('Type of comparison, value difference or percentage'),
            t('类型'),
            t('比较类型，值差异或百分比'),
            'comp-type',
            <Select
              // ariaLabel={t('Type')}
              ariaLabel={t('类型')}
              value={this.state.comparisonType || undefined}
              onChange={this.onSelectChange.bind(this, 'comparisonType')}
              options={comparisonTypeOptions}
            />,
          )}
        {this.state.colType === 'spark' &&
          this.formRow(
            // t('Show Y-axis'),
            // t(
            //   'Show Y-axis on the sparkline. Will display the manually set min/max if set or min/max values in the data otherwise.',
            // ),
            t('显示 Y 轴'),
            t(
              '显示折线图上的 Y 轴。如果手动设置了最小值和最大值，则显示这些值；否则，显示数据中的最小值和最大值。',
            ),
            'show-y-axis-bounds',
            <CheckboxControl
              value={this.state.showYAxis}
              onChange={this.onCheckboxChange.bind(this, 'showYAxis')}
            />,
          )}
        {this.state.colType === 'spark' &&
          this.formRow(
            // t('Y-axis bounds'),
            // t('Manually set min/max values for the y-axis.'),
            t('Y 轴范围'),
            t('手动设置 y 轴的最小/最大值。'),
            'y-axis-bounds',
            <BoundsControl
              value={this.state.yAxisBounds}
              onChange={this.onYAxisBoundsChange.bind(this)}
            />,
          )}
        {this.state.colType !== 'spark' &&
          this.formRow(
            // t('Color bounds'),
            // t(`Number bounds used for color encoding from red to blue.
            //    Reverse the numbers for blue to red. To get pure red or blue,
            //    you can enter either only min or max.`),
            // 'bounds',
            t('颜色范围'),
            t(`从红色到蓝色用于颜色编码的数值范围。
               将蓝色的数字颠倒过来，以获得纯粹的红色或蓝色。
               您可以输入最小值或最大值。`),
            'bounds',
            <BoundsControl
              value={this.state.bounds}
              onChange={this.onBoundsChange.bind(this)}
            />,
          )}
        {this.formRow(
          // t('Number format'),
          // t('Optional d3 number format string'),
          t('数字格式'),
          t('可选的 d3 数字格式字符串'),
          'd3-format',
          <Input
            value={this.state.d3format}
            onChange={this.onTextInputChange.bind(this, 'd3format')}
            // placeholder={t('Number format string')}
            placeholder={t('数字格式字符串')}
          />,
        )}
        {this.state.colType === 'spark' &&
          this.formRow(
            // t('Date format'),
            // t('Optional d3 date format string'),
            t('日期格式'),
            t('可选的 d3 日期格式字符串'),
            'date-format',
            <Input
              value={this.state.dateFormat}
              onChange={this.onTextInputChange.bind(this, 'dateFormat')}
              // placeholder={t('Date format string')}
              placeholder={t('日期格式字符串')}
            />,
          )}
        <ButtonBar>
          <Button buttonSize="small" onClick={this.onClose} cta>
            {/* {t('Close')} */}
            {t('关闭')}
          </Button>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            onClick={this.onSave}
            cta
          >
            {/* {t('Save')} */}
            {t('保存')}
          </Button>
        </ButtonBar>
      </div>
    );
  }

  render() {
    return (
      <span>
        {this.textSummary()}{' '}
        <ControlPopover
          trigger="click"
          content={this.renderPopover()}
          title={t('Column Configuration')}
          open={this.state.popoverVisible}
          onOpenChange={this.onPopoverVisibleChange}
        >
          <InfoTooltipWithTrigger
            icon="edit"
            className="text-primary"
            label="edit-ts-column"
          />
        </ControlPopover>
      </span>
    );
  }
}

TimeSeriesColumnControl.propTypes = propTypes;
TimeSeriesColumnControl.defaultProps = defaultProps;
