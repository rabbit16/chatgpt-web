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
      paddingInline: 16,
      // 验收阻塞项 4：antd 把 colorPrimary #5b8af0 推导成更暗的 #5078cf，
      // 配白字只有 4.26:1 未达 AA。显式给近黑字，在 #5078cf 上约 8.2:1。
      primaryColor: '#141417'
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
 * 深色版：中性深灰黑分层 + 提亮的文字与品牌蓝。
 * 参考 DSH 的深色界面：不是一整块深蓝，而是「近黑底 → 抬起的卡片 → 更亮的浮层」，
 * 文字用偏暖的灰白，长时间看不刺眼。数值与 tokens.less 的 [data-theme='dark'] 一一对应。
 */
export const antdDarkTheme: ThemeConfig = {
  algorithm: antdAlgorithm.darkAlgorithm,
  token: {
    ...baseToken,
    // 深色主按钮：原来 #6f9dff + 白字只有 2.64:1（AA 要求 4.5），手机上发虚。
    // 换成 #5b8af0 + 近黑字 #141417 = 5.55:1，达到 AA（2026-10-24 视觉验收 P7）。
    colorPrimary: '#5b8af0',
    colorInfo: '#6f9dff',
    colorSuccess: '#4ade80',
    colorWarning: '#fbbf24',
    colorError: '#f87171',
    colorLink: '#8ab0ff',
    colorTextBase: '#f0f0f3',
    colorText: '#f0f0f3',
    colorTextSecondary: '#cfcfd6',
    colorTextTertiary: '#a4a4ad',
    colorTextQuaternary: '#87878f',
    colorBorder: '#34343a',
    colorBorderSecondary: '#2a2a30',
    colorBgLayout: '#18181b',
    colorBgContainer: '#222226',
    colorBgElevated: '#2a2a2f',
    colorFillAlter: '#2a2a2f',
    colorFillSecondary: '#313137',
    colorFillTertiary: '#2a2a2f',

    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    boxShadowSecondary: '0 18px 44px rgba(0, 0, 0, 0.5)'
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
      activeShadow: '0 0 0 3px rgba(111, 157, 255, 0.24)'
    },
    InputNumber: {
      activeShadow: '0 0 0 3px rgba(111, 157, 255, 0.24)'
    },
    Select: {
      optionSelectedBg: '#2b3546'
    },
    Card: {
      paddingLG: 24,
      headerFontSize: 16
    },
    Table: {
      headerBg: '#1f1f23',
      headerColor: '#cfcfd6',
      headerSplitColor: 'transparent',
      rowHoverBg: '#26262b',
      borderColor: '#2a2a30',
      cellPaddingBlock: 12
    },
    Tabs: {
      itemSelectedColor: '#8ab0ff',
      inkBarColor: '#8ab0ff',
      titleFontSize: 14
    },
    Menu: {
      itemSelectedBg: '#2b3546',
      itemSelectedColor: '#8ab0ff',
      itemHoverBg: '#2a2a2f',
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
      defaultBg: '#2a2a2f',
      borderRadiusSM: 6
    },
    Segmented: {
      itemSelectedBg: '#2a2a31',
      trackBg: '#1c1c20',
      borderRadius: 8
    },
    Pagination: {
      itemActiveBg: '#2b3546'
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
      labelColor: '#cfcfd6',
      labelFontSize: 14
    },
    Empty: {
      colorTextDescription: '#87878f'
    }
  }
}

/** 按当前生效主题取一套配置 */
export function getAntdTheme(dark: boolean): ThemeConfig {
  return dark ? antdDarkTheme : antdTheme
}

export default antdTheme
