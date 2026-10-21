import { useSearchParams } from 'react-router-dom'
import { BarChartOutlined, ProfileOutlined } from '@ant-design/icons'
import Layout from '@/components/Layout'
import PillTabs from '@/components/PillTabs'
import { UsagePanel } from '@/pages/usage'
import { TasksPanel } from '@/pages/tasks'
import styles from './index.module.less'

type TabKey = 'usage' | 'tasks'

/**
 * 用量与任务（合并原「使用记录」「任务」）
 * ------------------------------------------------------------
 * 任务本来就是从请求日志里归并出来的未完成项，和用量是同一份数据，
 * 分成两个菜单只会让人多点一次。现在一页两个页签。
 */
function RecordsPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabKey = params.get('tab') === 'tasks' ? 'tasks' : 'usage'

  const switchTab = (next: string) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'tasks') nextParams.set('tab', 'tasks')
    else nextParams.delete('tab')
    setParams(nextParams, { replace: true })
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <BarChartOutlined /> 账号数据
            </p>
            <h1>用量与任务</h1>
            <p className={styles.lead}>
              每次请求扣了多少、还剩多少余额，都在「用量记录」；中途没跑完的请求会被归并成「任务」，方便回来接着处理。
            </p>
          </header>

          <PillTabs
            ariaLabel="用量与任务"
            value={tab}
            onChange={switchTab}
            items={[
              { key: 'usage', label: '用量记录', icon: <BarChartOutlined /> },
              { key: 'tasks', label: '任务', icon: <ProfileOutlined /> }
            ]}
          />

          {tab === 'usage' ? <UsagePanel /> : <TasksPanel />}
        </div>
      </Layout>
    </div>
  )
}

export default RecordsPage
