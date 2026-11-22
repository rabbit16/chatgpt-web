import { Link } from 'react-router-dom'
import rabbitLogo from '@/assets/brand/rabbitj-a2.svg'
import styles from './index.module.less'

/** ICP 备案号：与域名 www.rabbitj.top 的备案主体一致 */
const ICP_RECORD = '沪ICP备2021037462号-1'
const ICP_LINK = 'https://beian.miit.gov.cn/'
/**
 * 公安联网备案号：拿到后填这里（形如 沪公网安备3101xxxxxxxx号），
 * 留空则整块不渲染。填了记得同时补 POLICE_LINK。
 */
const POLICE_RECORD = ''
const POLICE_LINK = ''

export default function SiteFooter() {
  return (
    <footer className={styles.container} aria-label="rabbitJ 站点导航">
      <div className={styles.footer}>
        <Link to="/" className={styles.footerBrand} aria-label="rabbitJ 首页">
          <img src={rabbitLogo} alt="" />
          <span>rabbitJ</span>
        </Link>
        <div className={styles.footerInfo}>
          <div className={styles.footerGroups}>
            <div className={styles.footerGroup}>
              <h3>产品</h3>
              <Link to="/chat">AI 工作台</Link>
              <Link to="/draw">AI 绘图</Link>
              <Link to="/agent">工具接入</Link>
              <Link to="/price">模型价格</Link>
            </div>
            <div className={styles.footerGroup}>
              <h3>资源</h3>
              <Link to="/projects">软件商城</Link>
              <Link to="/guide">接入指南</Link>
              <Link to="/notice">公告留言</Link>
            </div>
            <div className={styles.footerGroup}>
              <h3>账户</h3>
              <Link to="/price?tab=wallet">我的钱包</Link>
              <Link to="/usage">使用记录</Link>
              <Link to="/profile">个人资料</Link>
            </div>
          </div>
          <p className={styles.footerNote}>
            网页体验、模型绘图与工具接入 · 选择适合你的入口，按页面提示继续。
          </p>
          <div className={styles.footerLegal}>
            <span>© {new Date().getFullYear()} rabbitJ</span>
            <a href={ICP_LINK} target="_blank" rel="noopener noreferrer">
              {ICP_RECORD}
            </a>
            {POLICE_RECORD ? (
              <a href={POLICE_LINK} target="_blank" rel="noopener noreferrer">
                {POLICE_RECORD}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  )
}
