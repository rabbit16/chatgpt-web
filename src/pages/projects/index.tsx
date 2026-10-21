import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, Form, Input, Modal, Spin, Tag, message } from 'antd'
import {
  AppleOutlined,
  CloudUploadOutlined,
  GithubOutlined,
  LinkOutlined,
  LinuxOutlined,
  ReloadOutlined,
  RightOutlined,
  WindowsOutlined
} from '@ant-design/icons'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import PillTabs from '@/components/PillTabs'
import { userStore } from '@/store'
import {
  PLATFORM_LABEL,
  getMySubmissions,
  getOpenSourceProjects,
  submitProject,
  type OpenSourceProject,
  type ProjectPlatform
} from '@/request/projects'
import styles from './index.module.less'

type TabKey = 'all' | 'mine'

const PLATFORMS: { key: ProjectPlatform; label: string; icon: JSX.Element }[] = [
  { key: 'windows', label: 'Windows', icon: <WindowsOutlined /> },
  { key: 'macos', label: 'macOS', icon: <AppleOutlined /> },
  { key: 'linux', label: 'Linux', icon: <LinuxOutlined /> }
]

type FormValues = {
  name: string
  summary: string
  repo_url?: string
  version: string
  changelog?: string
  windows?: string
  macos?: string
  linux?: string
}

/**
 * 开源项目（新）
 * ------------------------------------------------------------
 * 目的：把站点周边的小工具（第一个是「余额兔」）集中展示，三平台可下载；
 * 注册用户都能上传新项目或给自己的项目发新版本，但**必须经过站长审核**才上架。
 * 后端接口约定见 docs/后端接口-开源项目.md，未就绪前走本地兜底。
 */
function ProjectsPage() {
  const navigate = useNavigate()
  const token = userStore((state) => state.token)
  const setLoginModal = userStore((state) => state.setLoginModal)

  const [projects, setProjects] = useState<OpenSourceProject[]>([])
  const [mine, setMine] = useState<OpenSourceProject[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<FormValues>()

  const load = async () => {
    setLoading(true)
    try {
      const [list, myList] = await Promise.all([
        getOpenSourceProjects(),
        token ? getMySubmissions() : Promise.resolve([])
      ])
      setProjects(list)
      setMine(myList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const openUpload = () => {
    if (!token) {
      message.info('上传需要先登录，登录后即可提交项目或新版本')
      setLoginModal(true)
      return
    }
    form.resetFields()
    setOpen(true)
  }

  const onSubmit = async (values: FormValues) => {
    const releases = PLATFORMS.map((p) => ({
      platform: p.key,
      file_url: (values[p.key] || '').trim()
    })).filter((item) => item.file_url)

    if (!releases.length) {
      message.warning('至少填一个平台的安装包地址，站长才审得动')
      return
    }

    setSubmitting(true)
    try {
      const res = await submitProject({
        name: values.name.trim(),
        summary: values.summary.trim(),
        repo_url: (values.repo_url || '').trim(),
        version: values.version.trim(),
        changelog: (values.changelog || '').trim(),
        releases
      })
      if (res.ok) {
        message.success(
          res.local
            ? '已提交，等待站长审核（后端接口就绪后会自动同步到后台）'
            : '已提交，等待站长审核'
        )
        setOpen(false)
        setTab('mine')
        await load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const renderReleaseRow = (release: OpenSourceProject['releases'][number], platform: ProjectPlatform) => {
    const meta = PLATFORMS.find((p) => p.key === platform)
    const ready = Boolean(release?.file_url)
    return (
      <div key={platform} className={styles.releaseRow}>
        <span className={styles.releaseIcon}>{meta?.icon}</span>
        <div className={styles.releaseMeta}>
          <strong>{PLATFORM_LABEL[platform]}</strong>
          <span>{release?.version ? `v${release.version}` : '版本待定'}</span>
        </div>
        {ready ? (
          <Button
            type="primary"
            size="small"
            icon={<CloudUploadOutlined />}
            href={release.file_url}
            target="_blank"
          >
            下载
          </Button>
        ) : (
          <Tag>安装包待上传</Tag>
        )}
      </div>
    )
  }

  /** 列表行：图标 + 名称 + 一句介绍 + 可用平台，整行可点进详情页 */
  const renderProjectRow = (item: OpenSourceProject) => {
    const approved = item.releases.filter((r) => r.platform && r.status !== 'rejected')
    const readyCount = approved.filter((r) => r.file_url).length
    return (
      <button
        key={item.id}
        type="button"
        className={styles.row}
        onClick={() => navigate(`/projects/${item.id}`)}
      >
        <IconBadge icon={<span className={styles.bunny}>🐰</span>} tone="rose" size="md" />
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>
            {item.name}
            {item.official && <Tag color="blue">官方</Tag>}
            {item.status === 'pending' && <Tag color="orange">待审核</Tag>}
          </span>
          <span className={styles.rowDesc}>{item.summary}</span>
        </span>
        <span className={styles.rowMeta}>
          {PLATFORMS.filter((p) => approved.some((r) => r.platform === p.key)).map((p) => (
            <span key={p.key} className={styles.rowPlatform}>
              {p.icon}
            </span>
          ))}
          <span className={styles.rowCount}>{readyCount ? `${readyCount} 个包` : '待上传'}</span>
          <RightOutlined className={styles.rowArrow} />
        </span>
      </button>
    )
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <GithubOutlined /> 社区共建
            </p>
            <h1>开源项目</h1>
            <p className={styles.lead}>
              本站自研及社区贡献的客户端与工具集中展示于此。首个项目为「余额兔」：常驻桌面的小工具，可随时查看账户余额与当日
              Token 用量。所有项目开源且免费下载；注册用户亦可提交自己的项目或发布新版本，
              <strong>每个版本均需经站长审核</strong>后方可上架。
            </p>
            <div className={styles.headActions}>
              <Button type="primary" icon={<CloudUploadOutlined />} onClick={openUpload}>
                上传项目 / 发新版
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
                刷新
              </Button>
            </div>
          </header>

          <PillTabs
            ariaLabel="开源项目"
            value={tab}
            onChange={(next) => setTab(next as TabKey)}
            items={[
              { key: 'all', label: '全部项目' },
              { key: 'mine', label: '我的提交' }
            ]}
          />

          <Spin spinning={loading}>
            {tab === 'all' ? (
              <div className={styles.list}>
                {projects.map(renderProjectRow)}
              </div>
            ) : !token ? (
              <div className={styles.emptyCard}>
                <Empty description="登录后可以查看自己提交的项目与审核状态" />
                <Button type="primary" onClick={() => setLoginModal(true)}>
                  登录 / 注册
                </Button>
              </div>
            ) : mine.length ? (
              <div className={styles.list}>{mine.map(renderProjectRow)}</div>
            ) : (
              <div className={styles.emptyCard}>
                <Empty description="还没有提交过项目" />
                <Button icon={<CloudUploadOutlined />} onClick={openUpload}>
                  上传第一个
                </Button>
              </div>
            )}
          </Spin>

          <section className={styles.rules}>
            <h2>提交与审核规则</h2>
            <ul>
              <li>所有注册用户均可提交，提交后进入后台「待审核」队列，审核通过后公开展示。</li>
              <li>请提供开源仓库地址；安装包可使用直链或网盘链接，并注明版本号与更新说明。</li>
              <li>发布新版本同样需要提交并审核一次，通过后自动替换旧版本的下载入口。</li>
              <li>不接受包含挖矿、恶意扣费、窃取密钥或违反平台规则的工具，一经发现立即下架。</li>
            </ul>
          </section>
        </div>
      </Layout>

      <Modal
        title="上传项目 / 发布新版本"
        open={open}
        onCancel={() => setOpen(false)}
        okText="提交审核"
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => form.submit()}
        width={620}
        destroyOnClose
      >
        <p className={styles.modalTip}>
          提交后进入站长审核队列，通过后自动上架；在「我的提交」里能看到状态。
        </p>
        <Form form={form} layout="vertical" onFinish={(values) => void onSubmit(values)}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '填一个名字' }]}>
            <Input placeholder="例如：余额兔" maxLength={40} />
          </Form.Item>
          <Form.Item
            name="summary"
            label="一句话简介"
            rules={[{ required: true, message: '用一句话说清它解决什么问题' }]}
          >
            <Input placeholder="例如：桌面小宠物，抬头就能看到余额和最近用量" maxLength={80} />
          </Form.Item>
          <Form.Item name="repo_url" label="开源仓库地址（选填）">
            <Input placeholder="https://github.com/你/项目" prefix={<GithubOutlined />} />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true, message: '例如 0.1.0' }]}
          >
            <Input placeholder="0.1.0" maxLength={20} />
          </Form.Item>
          <Form.Item name="changelog" label="这次更新了什么（选填）">
            <Input.TextArea rows={3} maxLength={300} showCount placeholder="修了什么问题、加了什么功能" />
          </Form.Item>

          <p className={styles.formLabel}>三个平台的安装包地址（至少填一个）</p>
          {PLATFORMS.map((p) => (
            <Form.Item key={p.key} name={p.key} label={PLATFORM_LABEL[p.key]}>
              <Input placeholder="直链或网盘链接" prefix={<LinkOutlined />} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}

export default ProjectsPage
