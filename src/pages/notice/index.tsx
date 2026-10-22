import { useSearchParams } from 'react-router-dom'
import { NotificationOutlined, MessageOutlined } from '@ant-design/icons'
import Layout from '@/components/Layout'
import AnnouncementPanel from '@/pages/announcement'
import FeedbackPanel from '@/pages/feedback'
import styles from './index.module.less'

type TabKey = 'notice' | 'feedback'

/**
 * 公告与留言（合并页）
 * ------------------------------------------------------------
 * 原来「公告」「留言」是两个一级入口，各自一个页面，内容都很少。
 * 现在合成一页两个页签：看通知、提建议在同一个地方，导航少一格。
 * 老链接 /announcement、/feedback 会重定向到这里并自动切到对应页签。
 */
function NoticePage() {
  const [params, setParams] = useSearchParams()
  const tab: TabKey = params.get('tab') === 'feedback' ? 'feedback' : 'notice'

  const switchTab = (next: TabKey) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'notice') nextParams.delete('tab')
    else nextParams.set('tab', 'feedback')
    setParams(nextParams, { replace: true })
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <div className={styles.tabs} role="tablist" aria-label="公告与留言">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'notice'}
              className={[styles.tab, tab === 'notice' ? styles.active : ''].join(' ')}
              onClick={() => switchTab('notice')}
            >
              <NotificationOutlined />
              公告
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'feedback'}
              className={[styles.tab, tab === 'feedback' ? styles.active : ''].join(' ')}
              onClick={() => switchTab('feedback')}
            >
              <MessageOutlined />
              留言墙
            </button>
          </div>

          <header className={styles.head}>
            <p className={styles.kicker}>
              <NotificationOutlined /> 站点动态
            </p>
            <h1>公告与留言</h1>
            <p className={styles.lead}>
              站点通知与问题反馈集中于此：公告按时间排序；遇到问题或希望新增模型，可在此留言，支持匿名提交。
            </p>
          </header>

          {tab === 'notice' ? <AnnouncementPanel /> : <FeedbackPanel />}
        </div>
      </Layout>
    </div>
  )
}

export default NoticePage
