import type { ReactNode } from 'react'
import { Button, Dropdown, Tooltip } from 'antd'
import { CheckOutlined, DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { themeStore, THEME_LABEL, useResolvedTheme, type ThemeMode } from '@/store/theme'
import styles from './index.module.less'

/**
 * 右上角外观切换（浅色 / 深色 / 跟随系统）
 * ------------------------------------------------------------
 * 交互照模板站：点一下弹三选一，当前项打勾。
 * 默认「跟随系统」，所以大多数人第一次打开就和他电脑/手机一致。
 */
const MODE_ICON: Record<ThemeMode, ReactNode> = {
  light: <SunOutlined />,
  dark: <MoonOutlined />,
  system: <DesktopOutlined />
}

const MODES: ThemeMode[] = ['light', 'dark', 'system']

function ThemeToggle() {
  const mode = themeStore((state) => state.mode)
  const setMode = themeStore((state) => state.setMode)
  const resolved = useResolvedTheme()

  const items = MODES.map((item) => ({
    key: item,
    icon: MODE_ICON[item],
    label: (
      <span className={styles.label}>
        {THEME_LABEL[item]}
        {item === 'system' ? <em>现在与{resolved === 'dark' ? '深色' : '浅色'}一致</em> : null}
        {item === mode ? <CheckOutlined className={styles.check} /> : null}
      </span>
    )
  }))

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      arrow
      menu={{
        items,
        onClick: ({ key }) => setMode(key as ThemeMode)
      }}
    >
      <Tooltip title={`外观：${THEME_LABEL[mode]}`} mouseEnterDelay={0.4}>
        <Button
          type="text"
          className={styles.btn}
          icon={MODE_ICON[mode]}
          aria-label={`切换外观，当前${THEME_LABEL[mode]}`}
        />
      </Tooltip>
    </Dropdown>
  )
}

export default ThemeToggle
