import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Spin, Tag } from 'antd'
import {
  AppleOutlined,
  ArrowLeftOutlined,
  CloudDownloadOutlined,
  GithubOutlined,
  LinuxOutlined,
  WindowsOutlined
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import {
  PLATFORM_LABEL,
  getOpenSourceProjects,
  type OpenSourceProject,
  type ProjectPlatform
} from '@/request/projects'
import styles from './detail.module.less'

const PLATFORMS: { key: ProjectPlatform; label: string; icon: JSX.Element }[] = [
  { key: 'windows', label: 'Windows', icon: <WindowsOutlined /> },
  { key: 'macos', label: 'macOS', icon: <AppleOutlined /> },
  { key: 'linux', label: 'Linux', icon: <LinuxOutlined /> }
]

/**
 * 项目详情页
 * ------------------------------------------------------------
 * 列表只占一行，点进来才看完整介绍与下载。这样列表能放很多项目不臃肿。
 * 数据仍复用 getOpenSourceProjects（接口就绪后自动切换）。
 */
function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<OpenSourceProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await getOpenSourceProjects()
        if (alive) setProjects(list)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const project = useMemo(() => projects.find((item) => String(item.id) === String(id)), [projects, id])

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

  if (!project) {
    return (
      <div className={styles.page}>
        <Layout>
          <div className={styles.wrap}>
            <Empty description="没有找到这个项目，可能已下架或链接有误">
              <Button type="primary" onClick={() => navigate('/projects')}>
                返回项目列表
              </Button>
            </Empty>
          </div>
        </Layout>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <Link to="/projects" className={styles.back}>
            <ArrowLeftOutlined /> 返回项目列表
          </Link>

          <header className={styles.head}>
            <IconBadge icon={<span className={styles.bunny}>🐰</span>} tone="rose" size="lg" />
            <div className={styles.headText}>
              <h1>
                {project.name}
                {project.official && <Tag color="blue">官方</Tag>}
              </h1>
              <p>{project.summary}</p>
              <div className={styles.meta}>
                {project.author_name ? <span>作者：{project.author_name}</span> : null}
                {project.repo_url ? (
                  <a href={project.repo_url} target="_blank" rel="noreferrer">
                    <GithubOutlined /> 开源仓库
                  </a>
                ) : (
                  <span className={styles.muted}>仓库待补充</span>
                )}
              </div>
            </div>
          </header>

          {project.description ? <p className={styles.desc}>{project.description}</p> : null}

          <section className={styles.downloads}>
            <h2>下载</h2>
            <div className={styles.releaseList}>
              {PLATFORMS.map((p) => {
                const release = project.releases.find((r) => r.platform === p.key && r.status !== 'rejected')
                const ready = Boolean(release?.file_url)
                return (
                  <div key={p.key} className={styles.releaseRow}>
                    <span className={styles.releaseIcon}>{p.icon}</span>
                    <div className={styles.releaseMeta}>
                      <strong>{PLATFORM_LABEL[p.key]}</strong>
                      <span>
                        {release?.version ? `v${release.version}` : '版本待定'}
                        {release?.file_size ? ` · ${release.file_size}` : ''}
                      </span>
                    </div>
                    {ready ? (
                      <Button type="primary" icon={<CloudDownloadOutlined />} href={release!.file_url} target="_blank">
                        下载
                      </Button>
                    ) : (
                      <Tag>安装包待上传</Tag>
                    )}
                  </div>
                )
              })}
            </div>
            {project.releases.some((r) => r.status === 'pending') ? (
              <p className={styles.pendingNote}>有版本正在等待站长审核，通过后会自动出现在这里。</p>
            ) : null}
          </section>

          {/* 版本时间线：一眼看清哪个平台哪一版改了什么 */}
          <section className={styles.changelog}>
            <h2>版本更新</h2>
            <ol className={styles.timeline}>
              {[...project.releases]
                .filter((r) => r.status !== 'rejected')
                .sort((a, b) => String(b.version).localeCompare(String(a.version), 'en', { numeric: true }))
                .map((r) => (
                  <li key={r.id} className={styles.timelineItem}>
                    <span className={styles.timelineDot} />
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineHead}>
                        <strong>
                          {PLATFORM_LABEL[r.platform]} v{r.version || '—'}
                        </strong>
                        {r.created_at ? <time>{String(r.created_at).slice(0, 10)}</time> : null}
                        <Tag color={r.status === 'approved' ? 'green' : 'orange'}>
                          {r.status === 'approved' ? '已上架' : '审核中'}
                        </Tag>
                      </div>
                      <p>{r.changelog || '这一版没有填写更新说明。'}</p>
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      </Layout>
    </div>
  )
}

export default ProjectDetailPage
