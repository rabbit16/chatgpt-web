import { Button, Card, Result, Space } from 'antd'
import { Link, useLocation } from 'react-router-dom'
import Layout from '@/components/Layout'

export default function Page404() {
  const { state } = useLocation()
  const forbidden = state?.forbidden === true
  return <Layout>
    <Card style={{ maxWidth: 720, margin: '24px auto', borderRadius: 16 }}>
      <Result status={forbidden ? '403' : '404'}
        title={forbidden ? '当前账号没有访问权限' : '找不到这个页面'}
        subTitle={forbidden ? '你可以返回首页，或继续浏览公开的模型价格和接入文档。' : '链接可能已经调整。可从公开入口继续浏览。'}
        extra={<Space wrap>
          <Link to="/"><Button type="primary">返回首页</Button></Link>
          <Link to="/price"><Button>模型价格</Button></Link>
          <Link to="/guide"><Button>接入文档</Button></Link>
        </Space>}
      />
    </Card>
  </Layout>
}
