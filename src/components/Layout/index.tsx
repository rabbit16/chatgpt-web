import { MenuDataItem, ProLayout } from '@ant-design/pro-components'
import HeaderRender from '../HeaderRender'
import { ChatsInfo } from '@/types'
import React, { useEffect } from 'react'
import { MenuProps } from 'antd'
import { configStore } from '@/store'
import { sanitizeHtml } from '@/utils'

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
  children?: React.ReactNode
}

function Layout(props: Props) {
  const { menuExtraRender = () => <></>, menuItemRender = () => undefined } = props

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
      title={website_title}
      logo={website_logo}
      layout="mix"
      splitMenus={false}
      contentWidth="Fluid"
      fixedHeader
      fixSiderbar
      headerHeight={56}
      headerRender={HeaderRender}
      contentStyle={{
        background: 'var(--surface)'
      }}
      siderMenuType="group"
      style={{
        background: 'var(--surface)'
      }}
      menu={{
        hideMenuWhenCollapsed: true,
        locale: false,
        collapsedShowGroupTitle: false
      }}
      suppressSiderWhenMenuEmpty={!props.keepSiderWhenMenuEmpty}
      siderWidth={264}
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
