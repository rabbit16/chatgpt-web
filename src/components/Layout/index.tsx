import { MenuDataItem, ProLayout } from '@ant-design/pro-components'
import HeaderRender from '../HeaderRender'
import { ChatsInfo } from '@/types'
import React, { useEffect, useState } from 'react'
import { MenuProps } from 'antd'
import { configStore } from '@/store'
import { sanitizeHtml } from '@/utils'
import { useNarrow } from '@/hooks/useNarrow'
import SiteFooter from '@/components/SiteFooter'
import layoutStyles from './index.module.less'

type Props = {
  menuExtraRender?: () => React.ReactNode
  route?: {
    path: string
    routes: Array<ChatsInfo>
  }
  menuItemRender?: (
    item: MenuDataItem & {
      isUrl: boolean
      onClick: () => void
    },
    defaultDom: React.ReactNode,
    menuProps: MenuProps | any
  ) => React.ReactNode | undefined
  menuDataRender?: (menuData: MenuDataItem[]) => MenuDataItem[]
  menuFooterRender?: (props?: any) => React.ReactNode
  menuProps?: MenuProps
  keepSiderWhenMenuEmpty?: boolean
  homeAppearance?: boolean
  siderCollapsed?: boolean
  onSiderCollapsedChange?: (collapsed: boolean) => void
  children?: React.ReactNode
}

function Layout(props: Props) {
  const { menuExtraRender = () => <></>, menuItemRender = () => undefined } = props
  // 窄屏布局内边距：与 src/hooks/useNarrow 同一断点，保证各页判断一致
  const isNarrowLayout = useNarrow()
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false)
  const effectiveWorkspaceCollapsed = props.siderCollapsed ?? workspaceCollapsed
  const changeWorkspaceCollapsed = (collapsed: boolean) => {
    setWorkspaceCollapsed(collapsed)
    props.onSiderCollapsedChange?.(collapsed)
  }

  const website_logo = configStore((state) => state.website_logo)
  const website_title = configStore((state) => state.website_title)
  const website_footer = configStore((state) => state.website_footer)
  const website_description = configStore((state) => state.website_description)
  const website_keywords = configStore((state) => state.website_keywords)
  function createMetaElement(key: string, value: string) {
    const isMeta = document.querySelector(`meta[name="${key}"]`)
    if (!isMeta) {
      const head = document.querySelector('head')
      const meta = document.createElement('meta')
      meta.name = key
      meta.content = value
      head?.appendChild(meta)
    }
  }

  useEffect(() => {
    createMetaElement('description', website_description)
    createMetaElement('keywords', website_keywords)
  }, [])
  return (
    <ProLayout
      className={layoutStyles.neon}
      title={website_title}
      logo={website_logo}
      layout="mix"
      splitMenus={false}
      contentWidth="Fluid"
      fixedHeader
      fixSiderbar
      headerRender={HeaderRender}
      contentStyle={{
        background: 'transparent'
      }}
      token={{
        pageContainer: {
          paddingInlinePageContainerContent: props.homeAppearance ? 0 : isNarrowLayout ? 12 : 40,
          paddingBlockPageContainerContent: props.homeAppearance ? 0 : isNarrowLayout ? 8 : 24
        }
      }}
      footerRender={() => <SiteFooter />}
      siderMenuType="group"
      style={{
        background: 'transparent'
      }}
      menu={{
        hideMenuWhenCollapsed: false,
        locale: false,
        collapsedShowGroupTitle: false
      }}
      suppressSiderWhenMenuEmpty={!props.keepSiderWhenMenuEmpty}
      siderWidth={264}
      collapsed={props.keepSiderWhenMenuEmpty ? effectiveWorkspaceCollapsed : undefined}
      onCollapse={props.keepSiderWhenMenuEmpty ? changeWorkspaceCollapsed : undefined}
      collapsedButtonRender={props.keepSiderWhenMenuEmpty ? false : undefined}
      menuExtraRender={menuExtraRender}
      menuItemRender={menuItemRender}
      route={props.route}
      menuDataRender={props.menuDataRender}
      avatarProps={{
        src: 'https://u1.dl0.cn/icon/1682426702646avatarf3db669b024fad66-1930929abe2847093.png',
        size: 'small',
        render: (p, dom) => <>{dom}</>
      }}
      menuFooterRender={(p) => {
        return (
          <div>
            {props.menuFooterRender?.(p)}
            {website_footer && (
              <div
                style={{
                  marginTop: 12
                }}
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(website_footer)
                }}
              />
            )}
          </div>
        )
      }}
      menuProps={props.menuProps}
      breadcrumbRender={() => []}
    >
      {props.children}
    </ProLayout>
  )
}

export default Layout
