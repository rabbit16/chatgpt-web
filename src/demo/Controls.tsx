import { useLocation } from 'react-router-dom'
import { demoRole, demoScenario } from './runtime'

const destinations = [
  ['/', '首页'], ['/chat', '对话'], ['/draw', '绘图'], ['/price', '价格'], ['/price?tab=wallet', '钱包'],
  ['/result', '支付结果'], ['/invoice', '开票'], ['/agent', 'Agent'], ['/guide', '教程'], ['/projects', '商城'],
  ['/usage', '使用记录'], ['/notice', '公告留言'], ['/profile', '资料'], ['/login', '登录'], ['/admin', '后台']
]

export default function DemoControls() {
  const location = useLocation()
  const select = (key: string, value: string) => {
    sessionStorage.setItem(`rabbitj.demo.${key}`, value)
    sessionStorage.removeItem('rabbitj.demo.user')
    window.location.reload()
  }
  return <details style={{ position: 'fixed', zIndex: 990, bottom: 'calc(12px + env(safe-area-inset-bottom))', right: 12, maxWidth: 'calc(100% - 24px)', background: 'var(--surface)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
    <summary style={{ cursor: 'pointer' }}>本地演示</summary>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBlock: 8 }}>
      <label>角色 <select value={demoRole()} onChange={(event) => select('role', event.target.value)}>
        <option value="guest">访客</option><option value="user">已登录</option><option value="administrator">管理员</option>
      </select></label>
      <label>场景 <select value={demoScenario()} onChange={(event) => select('scenario', event.target.value)}>
        <option value="normal">常规</option><option value="loading">加载</option><option value="empty">空数据</option><option value="error">失败</option>
        <option value="pay-success">支付成功</option><option value="pay-failed">支付失败</option>
      </select></label>
      <button type="button" onClick={() => {
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith('rabbitj.demo.')) sessionStorage.removeItem(key)
        }
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('rabbitj.demo.')) localStorage.removeItem(key)
        }
        window.location.href = '/'
      }}>重置演示</button>
      <label>页面 <select value={location.pathname + location.search} onChange={(event) => { window.location.href = event.target.value }}>
        <option value="">选择页面</option>
        {destinations.map(([path, label]) => <option key={path} value={path}>{label}</option>)}
      </select></label>
    </div>
  </details>
}
