import type { ThemeConfig } from 'antd'

/**
 * antd 主题（T1）
 * ------------------------------------------------------------
 * 让 antd 自带的按钮、输入框、表格、弹窗、分页等组件
 * 自动长成方向 A 的样子，不用逐页写 CSS 去覆盖。
 *
 * 原则：
 * 1. 颜色只从 tokens.less 的 CSS 变量取值语义来，这里用具体值对齐；
 * 2. 只改"长得像什么"，不改交互行为；
 * 3. 想调全站圆角/主色，改这一处 + tokens.less 同步即可。
 */
export const antdTheme: ThemeConfig = {
  token: {
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

    // 圆角只留 3 档：控件 12 / 卡片 16 / 药丸（借鉴模板站的克制）
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 12,
    borderRadiusXS: 8,

    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,

    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    boxShadow: '0 8px 24px rgba(16, 24, 40, 0.05)',
    boxShadowSecondary: '0 12px 32px rgba(16, 24, 40, 0.1)',
    wireframe: false
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

export default antdTheme
