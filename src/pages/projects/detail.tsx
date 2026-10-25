import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, Spin, Tag } from 'antd'
import {
  AppleOutlined,
  ArrowLeftOutlined,
  CloudDownloadOutlined,
  DownloadOutlined,
  GithubOutlined,
  InboxOutlined,
  LinuxOutlined,
  WindowsOutlined
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '@/components/Layout'
import CoverBadge from '@/components/CoverBadge'
import {
  PLATFORM_LABEL,
  REVIEW_LABEL,
  formatFileSize,
  getMarketDetail,
  platformsOf,
  type SoftwareRecord
} from '@/request/software'
import styles from './detail.module.less'

/**
 * 软件详情页
 * ------------------------------------------------------------
 * 列表一行放不下全部信息，点进来才看完整介绍、安装包与更新说明。
 * 数据走 getMarketDetail（GET /user/software/detail?id=）；
 * 后端未提供该接口时，请求层会自动降级为「从公开列表里找同 id」。
 */
function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<SoftwareRecord | null>(null)
  const [localMode, setLocalMode] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getMarketDetail(id)
      setItem(res.item || null)
      setLocalMode(res.local)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className={styles.page}>
        <Layout>
          <div className={styles.wrap}>
            <Spin />
          </div>
        </Layout>
      </div>
    )
  }

  if (!item) {
    return (
      <div className={styles.page}>
        <Layout>
          <div className={styles.wrap}>
            <Empty description="没有找到这个软件，可能已下架或链接有误">
              <Button type="primary" onClick={() => navigate('/projects')}>
                返回软件商城
              </Button>
            </Empty>
          </div>
        </Layout>
      </div>
    )
  }

  // 平台列表统一走 platformsOf：兼容后端只返回单数 platform 的过渡期
  const entries = platformsOf(item)
  const isOfficial = item.source === 'official'
  const PLATFORM_ICON: Record<string, JSX.Element> = {
    windows: <WindowsOutlined />,
    macos: <AppleOutlined />,
    linux: <LinuxOutlined />
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <Link to="/projects" className={styles.back}>
            <ArrowLeftOutlined /> 返回软件商城
          </Link>

          <header className={styles.head}>
            {/* 有封面显示站长上传的图，没有/加载失败回退图标（2026-10-25 站长要求） */}
            <CoverBadge src={item.cover_url} size="lg" fallback={<InboxOutlined />} />
            <div className={styles.headText}>
              <h1>
                {item.name}
                {isOfficial ? <Tag color="blue">官方</Tag> : <Tag>用户上传</Tag>}
                {!isOfficial && item.review_status !== 'approved' ? (
                  <Tag color={item.review_status === 'rejected' ? 'red' : 'gold'}>
                    {REVIEW_LABEL[item.review_status]}
                  </Tag>
                ) : null}
              </h1>
              <p>{item.summary}</p>
              <div className={styles.meta}>
                {item.author_name ? <span>作者：{item.author_name}</span> : null}
                {item.category_name ? <span>分类：{item.category_name}</span> : null}
                {item.version ? <span>版本：v{item.version}</span> : null}
                {item.repo_url ? (
                  <a href={item.repo_url} target="_blank" rel="noreferrer">
                    <GithubOutlined /> 开源仓库
                  </a>
                ) : null}
              </div>
            </div>
          </header>

          {!isOfficial && item.review_status === 'rejected' ? (
            <p className={styles.desc}>
              <strong>审核未通过：</strong>
              {item.reviewer_note || '站长没有填写原因，可以重新提交或在留言区询问。'}
            </p>
          ) : null}

          <section className={styles.downloads}>
            <h2>下载</h2>
            <div className={styles.releaseList}>
              {entries.length ? (
                entries.map((entry) => (
                  <div key={entry.platform} className={styles.releaseRow}>
                    <span className={styles.releaseIcon}>{PLATFORM_ICON[entry.platform]}</span>
                    <div className={styles.releaseMeta}>
                      <strong>
                        {PLATFORM_LABEL[entry.platform]} 安装包
                        {entry.version || item.version ? ` · v${entry.version || item.version}` : ''}
                      </strong>
                      <span>
                        {formatFileSize(entry.file_size || item.file_size) || '体积未标注'}
                        {entry.download_count ? ` · 下载 ${entry.download_count} 次` : ''}
                      </span>
                    </div>
                    {entry.file_url ? (
                      <Button
                        type="primary"
                        icon={<CloudDownloadOutlined />}
                        href={entry.file_url}
                        target="_blank"
                      >
                        下载
                      </Button>
                    ) : (
                      <Tag>安装包待上传</Tag>
                    )}
                  </div>
                ))
              ) : (
                <div className={styles.releaseRow}>
                  <span className={styles.releaseIcon}>
                    <InboxOutlined />
                  </span>
                  <div className={styles.releaseMeta}>
                    <strong>安装包</strong>
                    <span>尚未上传</span>
                  </div>
                  <Tag>安装包待上传</Tag>
                </div>
              )}
            </div>
            {!isOfficial && item.review_status === 'pending' ? (
              <p className={styles.pendingNote}>这份投稿正在等待站长审核，通过后会出现在公开列表。</p>
            ) : null}
            {localMode ? (
              <p className={styles.pendingNote}>本地模式：下面是本机暂存的数据，后端接口接入后自动切到真实数据。</p>
            ) : null}
          </section>

          {item.category_name || item.file_size || item.download_count !== undefined ? (
            <section className={styles.downloads}>
              <h2>信息</h2>
              <div className={styles.releaseList}>
                {item.category_name ? (
                  <div className={styles.releaseRow}>
                    <span className={styles.releaseIcon}>#</span>
                    <div className={styles.releaseMeta}>
                      <strong>分类</strong>
                      <span>{item.category_name}</span>
                    </div>
                  </div>
                ) : null}
                <div className={styles.releaseRow}>
                  <span className={styles.releaseIcon}>
                    <DownloadOutlined />
                  </span>
                  <div className={styles.releaseMeta}>
                    <strong>下载量</strong>
                    <span>{item.download_count ?? 0} 次</span>
                  </div>
                </div>
                {item.insert_time ? (
                  <div className={styles.releaseRow}>
                    <span className={styles.releaseIcon}>#</span>
                    <div className={styles.releaseMeta}>
                      <strong>上架时间</strong>
                      <span>{String(item.insert_time).slice(0, 10)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {item.changelog ? (
            <section className={styles.changelog}>
              <h2>更新说明</h2>
              <ul>
                <li>{item.changelog}</li>
              </ul>
            </section>
          ) : null}
        </div>
      </Layout>
    </div>
  )
}

export default ProjectDetailPage
