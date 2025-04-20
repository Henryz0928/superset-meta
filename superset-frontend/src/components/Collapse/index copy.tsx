import { styled } from '@superset-ui/core';
// eslint-disable-next-line no-restricted-imports
import { Collapse as AntdCollapse } from 'antd';
// eslint-disable-next-line no-restricted-imports
import { CollapseProps as AntdCollapseProps } from 'antd/lib/collapse';

export interface CollapseProps extends AntdCollapseProps {
  light?: boolean;
  bigger?: boolean;
  bold?: boolean;
  animateArrows?: boolean;
}

const Collapse = Object.assign(
  styled(({ light, bigger, bold, animateArrows, ...props }: CollapseProps) => (
    <AntdCollapse {...props} />
  ))`
    .ant-collapse-item {
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.06) 0%,
        rgba(255, 255, 255, 0.02) 100%
      );
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      transition: box-shadow 0.3s ease;

      &:hover {
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
      }

      .ant-collapse-header {
        font-weight: ${({ bold, theme }) =>
          bold ? theme.typography.weights.bold : theme.typography.weights.normal};
        font-size: ${({ bigger, theme }) =>
          bigger ? `${theme.gridUnit * 4}px` : 'inherit'};
        color: rgba(0, 0, 0, 0.85);
        background-color: rgba(255, 255, 255, 0.04);
        padding: 12px 16px;
        transition: background-color 0.3s ease, color 0.3s ease;

        .ant-collapse-arrow svg {
          transition: ${({ animateArrows }) =>
            animateArrows ? 'transform 0.24s ease' : 'none'};
          color: #999;
        }

        &:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: #000;
        }

        ${({ expandIconPosition }) =>
          expandIconPosition === 'right' &&
          `
            .anticon.anticon-right.ant-collapse-arrow > svg {
              transform: rotate(90deg) !important;
            }
          `}

        ${({ light, theme }) =>
          light &&
          `
            color: ${theme.colors.grayscale.light4};
            .ant-collapse-arrow svg {
              color: ${theme.colors.grayscale.light4};
            }
          `}

        ${({ ghost, bordered, theme }) =>
          ghost &&
          bordered &&
          `
            border-bottom: 1px solid ${theme.colors.grayscale.light3};
          `}
      }

      .ant-collapse-content {
        background-color: rgba(255, 255, 255, 0.025);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        transition: all 0.3s ease;

        .ant-collapse-content-box {
          padding: 16px;
          color: rgba(0, 0, 0, 0.75);

          .loading.inline {
            margin: ${({ theme }) => theme.gridUnit * 12}px auto;
            display: block;
          }
        }
      }
    }

    .ant-collapse-item-active {
      .ant-collapse-header {
        ${({ expandIconPosition }) =>
          expandIconPosition === 'right' &&
          `
            .anticon.anticon-right.ant-collapse-arrow > svg {
              transform: rotate(-90deg) !important;
            }
          `}
      }
    }
  `,
  {
    Panel: AntdCollapse.Panel,
  },
);

export default Collapse;
