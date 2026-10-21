import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, Form, Input, Modal, Spin, Tag, message } from 'antd'
import {
  AppleOutlined,
  CloudUploadOutlined,
  GithubOutlined,
  LinkOutlined,
  LinuxOutlined,
  ReloadOutlined,
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

  const official = useMemo(() => projects.find((item) => item.official), [projects])
  const others = useMemo(() => projects.filter((item) => !item.official), [projects])

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

  const renderProjectCard = (item: OpenSourceProject) => (
    <article key={item.id} className={styles.card}>
      <div className={styles.cardHead}>
        <IconBadge icon={<span className={styles.bunny}>🐰</span>} tone="rose" size="lg" />
        <div className={styles.cardTitle}>
          <h3>
            {item.name}
            {item.official && <Tag color="blue">官方</Tag>}
            {item.status === 'pending' && <Tag color="orange">待审核</Tag>}
          </h3>
          <p>{item.summary}</p>
        </div>
      </div>

      {item.description && <p className={styles.cardDesc}>{item.description}</p>}

      <div className={styles.releaseList}>
        {PLATFORMS.map((p) => {
          const release = item.releases.find((r) => r.platform === p.key && r.status !== 'rejected')
          return renderReleaseRow(release || ({ platform: p.key } as any), p.key)
        })}
      </div>

      <div className={styles.cardFoot}>
        <span>{item.author_name ? `作者：${item.author_name}` : '作者未署名'}</span>
        {item.repo_url ? (
          <a href={item.repo_url} target="_blank" rel="noreferrer">
            <GithubOutlined /> 开源仓库
          </a>
        ) : (
          <span className={styles.muted}>代码仓库待补充</span>
        )}
      </div>
    </article>
  )

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
              这里放站点周边的小工具，第一个是「余额兔」：桌面常驻的小兔子，抬头就能看到你充的钱还剩多少、今天用了多少
              token。所有项目开源、免费下载；注册用户也可以上传自己的项目或发新版本，
              <strong>每个版本都要经过站长审核</strong>才会上架。
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
              <>
                {official && renderProjectCard(official)}
                {others.length ? (
                  <div className={styles.grid}>{others.map(renderProjectCard)}</div>
                ) : (
                  <div className={styles.emptyCard}>
                    <Empty description="还没有其他项目，第一个上传的会出现在这里" />
                  </div>
                )}
              </>
            ) : !token ? (
              <div className={styles.emptyCard}>
                <Empty description="登录后可以查看自己提交的项目与审核状态" />
                <Button type="primary" onClick={() => setLoginModal(true)}>
                  登录 / 注册
                </Button>
              </div>
            ) : mine.length ? (
              <div className={styles.grid}>{mine.map(renderProjectCard)}</div>
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
            <h2>上传规则</h2>
            <ul>
              <li>任何注册用户都能上传，提交后进入后台「待审核」，站长通过后才会出现在上面。</li>
              <li>项目请提供开源仓库地址；安装包给直链或网盘链接，注明版本号与更新说明。</li>
              <li>自己的项目发新版本，同样是提交一次、审核一次，通过后替换旧版本的下载入口。</li>
              <li>不接受带挖矿、薅羊毛脚本、恶意扣费或窃取密钥的工具，发现即下架。</li>
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
