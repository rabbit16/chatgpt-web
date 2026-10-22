import { theme as antdAlgorithm } from 'antd'
import type { ThemeConfig } from 'antd'

/**
 * antd 主题（T1 / 深色 2026-10-22）
 * ------------------------------------------------------------
 * 让 antd 自带的按钮、输入框、表格、弹窗、分页等组件
 * 自动长成方向 A 的样子，不用逐页写 CSS 去覆盖。
 *
 * 原则：
 * 1. 颜色只从 tokens.less 的 CSS 变量取值语义来，这里用具体值对齐；
 * 2. 只改"长得像什么"，不改交互行为；
 * 3. 想调全站圆角/主色，改这一处 + tokens.less 同步即可；
 * 4. 深色版用 antd 的 darkAlgorithm + 同一套语义值，避免两套主题越改越分叉。
 */

const FONT_FAMILY =
  "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif"

const baseToken: ThemeConfig['token'] = {
  borderRadius: 12,
  borderRadiusLG: 16,
  borderRadiusSM: 12,
  borderRadiusXS: 8,
  fontFamily: FONT_FAMILY,
  fontSize: 14,
  controlHeight: 36,
  controlHeightLG: 44,
  controlHeightSM: 28,
  wireframe: false
}

export const antdTheme: ThemeConfig = {
  token: {
    ...baseToken,
    colorPrimary: '#1877ff',
    colorInfo: '#1877ff',
    colorSuccess: '#12b76a',
    colorWarning: '#f79009',
    colorError: '#f04438',
    colorTextBase: '#101828',
    colorText: '#101828',
    colorTextSecondary: '#475467',
    colorTextTertiary: '#667085',
    colorTextQuaternary: '#98a2b3',
    colorBorder: '#e4e9f2',
    colorBorderSecondary: '#eef2f7',
    colorBgLayout: '#f7f9fd',
    colorBgContainer: '#ffffff',
    colorFillAlter: '#f4f6fb',

    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.05)',
    boxShadowSecondary: '0 12px 32px rgba(16, 24, 40, 0.1)'
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 500,
      paddingInline: 16
    },
    Input: {
      paddingInline: 12,
      activeShadow: '0 0 0 3px rgba(24, 119, 255, 0.16)'
    },
    InputNumber: {
      activeShadow: '0 0 0 3px rgba(24, 119, 255, 0.16)'
    },
    Select: {
      optionSelectedBg: '#e8f1ff'
    },
    Card: {
      paddingLG: 24,
      headerFontSize: 16,
      boxShadowTertiary: '0 8px 24px rgba(16, 24, 40, 0.05)'
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475467',
      headerSplitColor: 'transparent',
      rowHoverBg: '#f7f9fd',
      borderColor: '#eef2f7',
      cellPaddingBlock: 12
    },
    Tabs: {
      itemSelectedColor: '#1877ff',
      inkBarColor: '#1877ff',
      titleFontSize: 14
    },
    Menu: {
      itemSelectedBg: '#e8f1ff',
      itemSelectedColor: '#1877ff',
      itemHoverBg: '#f4f6fb',
      itemHeight: 40
    },
    Modal: {
      borderRadiusLG: 16,
      titleFontSize: 18
    },
    Drawer: {
      paddingLG: 24
    },
    Tag: {
      defaultBg: '#f4f6fb',
      borderRadiusSM: 6
    },
    Segmented: {
      itemSelectedBg: '#ffffff',
      trackBg: '#f4f6fb',
      borderRadius: 8
    },
    Pagination: {
      itemActiveBg: '#e8f1ff'
    },
    Message: {
      borderRadiusLG: 12
    },
    Notification: {
      borderRadiusLG: 12
    },
    Tooltip: {
      borderRadius: 8
    },
    Form: {
      labelColor: '#344054',
      labelFontSize: 14
    },
    Empty: {
      colorTextDescription: '#98a2b3'
    }
  }
}

/**
 * 深色版：偏蓝的近黑底 + 抬一层的蓝灰卡片 + 提亮的品牌蓝。
 * 数值与 tokens.less 的 [data-theme='dark'] 一一对应，改一处要两边同步。
 */
export const antdDarkTheme: ThemeConfig = {
  algorithm: antdAlgorithm.darkAlgorithm,
  token: {
    ...baseToken,
    colorPrimary: '#5b93ff',
    colorInfo: '#5b93ff',
    colorSuccess: '#34d399',
    colorWarning: '#f5b544',
    colorError: '#f87171',
    colorLink: '#6ba1ff',
    colorTextBase: '#eef3ff',
    colorText: '#eef3ff',
    colorTextSecondary: '#b9c6de',
    colorTextTertiary: '#8f9dbb',
    colorTextQuaternary: '#6c7b9b',
    colorBorder: '#223050',
    colorBorderSecondary: '#1a2742',
    colorBgLayout: '#080f1c',
    colorBgContainer: '#0f1829',
    colorBgElevated: '#16233a',
    colorFillAlter: '#16233a',
    colorFillSecondary: '#1a2742',
    colorFillTertiary: '#16233a',

    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    boxShadowSecondary: '0 18px 44px rgba(0, 0, 0, 0.55)'
  },
  components: {
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
      fontWeight: 500,
      paddingInline: 16
    },
    Input: {
      paddingInline: 12,
      activeShadow: '0 0 0 3px rgba(91, 147, 255, 0.24)'
    },
    InputNumber: {
      activeShadow: '0 0 0 3px rgba(91, 147, 255, 0.24)'
    },
    Select: {
      optionSelectedBg: '#17294a'
    },
    Card: {
      paddingLG: 24,
      headerFontSize: 16
    },
    Table: {
      headerBg: '#111d33',
      headerColor: '#b9c6de',
      headerSplitColor: 'transparent',
      rowHoverBg: '#14203a',
      borderColor: '#1a2742',
      cellPaddingBlock: 12
    },
    Tabs: {
      itemSelectedColor: '#6ba1ff',
      inkBarColor: '#6ba1ff',
      titleFontSize: 14
    },
    Menu: {
      itemSelectedBg: '#17294a',
      itemSelectedColor: '#6ba1ff',
      itemHoverBg: '#16233a',
      itemHeight: 40
    },
    Modal: {
      borderRadiusLG: 16,
      titleFontSize: 18
    },
    Drawer: {
      paddingLG: 24
    },
    Tag: {
      defaultBg: '#16233a',
      borderRadiusSM: 6
    },
    Segmented: {
      itemSelectedBg: '#1a2742',
      trackBg: '#111d33',
      borderRadius: 8
    },
    Pagination: {
      itemActiveBg: '#17294a'
    },
    Message: {
      borderRadiusLG: 12
    },
    Notification: {
      borderRadiusLG: 12
    },
    Tooltip: {
      borderRadius: 8
    },
    Form: {
      labelColor: '#d7e1f5',
      labelFontSize: 14
    },
    Empty: {
      colorTextDescription: '#6c7b9b'
    }
  }
}

/** 按当前生效主题取一套配置 */
export function getAntdTheme(dark: boolean): ThemeConfig {
  return dark ? antdDarkTheme : antdTheme
}

export default antdTheme
