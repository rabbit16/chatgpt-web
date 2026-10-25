import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Tag,
  Upload,
  message
} from 'antd'
import {
  AppleOutlined,
  CloudUploadOutlined,
  GithubOutlined,
  InboxOutlined,
  LinkOutlined,
  LinuxOutlined,
  ReloadOutlined,
  RightOutlined,
  WindowsOutlined
} from '@ant-design/icons'
import Layout from '@/components/Layout'
import CoverBadge from '@/components/CoverBadge'
import PillTabs from '@/components/PillTabs'
import { userStore } from '@/store'
import {
  PLATFORM_LABEL,
  REVIEW_LABEL,
  formatFileSize,
  getMarketCategories,
  getMarketList,
  getMySubmissions,
  platformsOf,
  submitSoftware,
  uploadUserPackage,
  type SoftwareCategoryRecord,
  type SoftwarePlatform,
  type SoftwareRecord
} from '@/request/software'
import styles from './index.module.less'

type TabKey = 'all' | 'official' | 'community' | 'mine'

/** 分类筛选的哨兵值：'all' = 不过滤。用字符串避免和真实分类 id 冲突 */
type CategoryKey = 'all' | string

const PLATFORMS: { key: SoftwarePlatform; label: string; icon: JSX.Element }[] = [
  { key: 'windows', label: 'Windows', icon: <WindowsOutlined /> },
  { key: 'macos', label: 'macOS', icon: <AppleOutlined /> },
  { key: 'linux', label: 'Linux', icon: <LinuxOutlined /> }
]

const PLATFORM_ICON: Record<SoftwarePlatform, JSX.Element> = {
  windows: <WindowsOutlined />,
  macos: <AppleOutlined />,
  linux: <LinuxOutlined />
}

type FormValues = {
  name: string
  summary: string
  category_id?: number
  repo_url?: string
  version: string
  changelog?: string
  windows?: string
  macos?: string
  linux?: string
}

/**
 * 软件商城
 * ------------------------------------------------------------
 * 两类软件，规则不同：
 *   · 官方软件（source=official）：管理员在后台直传，提交即上架，不进审核队列。
 *   · 用户上传（source=user）：注册用户投稿 → 后台审核 → 通过后才出现在公开列表。
 *
 * 数据契约集中在 src/request/software.ts；接口没上线时进入「本地模式」，
 * 用 localStorage 暂存并在页面顶部明确提示，不显示任何假数据。
 */
function ProjectsPage() {
  const navigate = useNavigate()
  const token = userStore((state) => state.token)
  const setLoginModal = userStore((state) => state.setLoginModal)

  const [list, setList] = useState<SoftwareRecord[]>([])
  const [mine, setMine] = useState<SoftwareRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [localMode, setLocalMode] = useState(false)
  /** 「我的提交」单独降级：接口挂了只在该页签内提示，不影响整页 */
  const [mineLocal, setMineLocal] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<SoftwareCategoryRecord[]>([])
  /** 分类栏只在接口成功且拿到可用分类时才渲染（失败=增强功能不显示，主体照常） */
  const [categoryReady, setCategoryReady] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all')
  const [uploadingPlatform, setUploadingPlatform] = useState<SoftwarePlatform | null>(null)
  const [form] = Form.useForm<FormValues>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, mineRes] = await Promise.all([
        // page_num 走 getMarketList 内部夹取（后端上限 50，写大会被 422 拒掉）
        getMarketList({ page_num: 50 }),
        token ? getMySubmissions() : Promise.resolve({ list: [] as SoftwareRecord[], total: 0, local: false })
      ])
      setList(res.list)
      setMine(mineRes.list)
      /**
       * 2026-10-25 修正：整页的「本地模式」只由**商城列表**接口决定。
       * ------------------------------------------------------------
       * 原来写的是 res.local || mineRes.local。实测发现 /user/software/list 是好的（能拿到 4 条），
       * 真正失败的是附属接口 /user/software/my-submissions（后端 500），
       * 结果整页顶着「本地模式：后端接口未接入」，让站长以为商城没连上后端 —— 与事实相反。
       * 现在「我的提交」失败只影响它自己那个页签（见下方 mineLocal），不再污染整页。
       */
      setLocalMode(res.local)
      setMineLocal(mineRes.local)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * 拉分类列表（页面挂载 + 打开上传弹窗都用它）
   * ------------------------------------------------------------
   * 实测返回体（2026-10-25 线上）是**顶层 list、没有 data 包裹**：
   *   {"code":"0","codeMsg":"成功","list":[{"id":3,"name":"效率软件","sort":1,"status":1,...}]}
   * 而站内其它接口普遍是 {code, data:{list}}。两种形态都得认，所以这里挨个探。
   *
   * 顺序很关键：先看 res.list（本接口真实形态），再看 res.data.list / res.data。
   * 原来只写了 data.list || data —— 这条接口永远解析出空数组，分类栏也就永远不出现。
   *
   * 失败策略（分类是增强功能，不能拖垮整页）：catch 里只把 categoryReady 置 false，
   * 不弹 message、不 setLocalMode —— 商城主体、上传、刷新全部照常工作。
   */
  const loadCategories = useCallback(async (): Promise<SoftwareCategoryRecord[]> => {
    /**
     * 用 getMarketCategories（自己发 fetch）而不是 @/request/api 的 getSoftwareCategories：
     * 后者走站内 request 封装，分类接口返错时会弹**全局红色「错误」通知**，
     * 而分类是增强功能，挂了不该在商城头顶挂个红框（2026-10-25 实测复现）。
     * 这个函数失败时返回 null，全程静默。
     */
    const rows = await getMarketCategories()
    if (!rows) {
      // 分类接口挂了：清空并隐藏分类栏，页面其余部分完全不受影响
      setCategories([])
      setCategoryReady(false)
      return []
    }
    /**
     * 只保留「启用 + 未删除」的分类。
     * 站长在后台停用/删掉一个分类，商城里就不该再出现它的按钮 ——
     * 否则用户点进去必然是空列表，像是页面坏了。
     */
    const usable = rows
      .filter((item) => item && item.id !== undefined && item.id !== null)
      .filter((item) => Number(item.status) === 1 && item.is_delete !== true)
      .filter((item) => Boolean(String(item.name || '').trim()))
      /**
       * 按 sort 升序，sort 相同按 id 升序。
       * 后端返回的顺序是 [效率软件(sort=1), AI(Agent)软件(sort=0)] —— 不是排好的，
       * 直接渲染会显示成「效率软件、AI(Agent)软件」，反直觉。必须前端排。
       */
      .sort((a, b) => {
        const sa = Number(a.sort) || 0
        const sb = Number(b.sort) || 0
        if (sa !== sb) return sa - sb
        return Number(a.id) - Number(b.id)
      })
    setCategories(usable)
    setCategoryReady(usable.length > 0)
    return usable
  }, [])

  /**
   * 分类栏是页面的一部分（不只是上传弹窗），挂载时就得拉，否则第二排永远是空的。
   * 注意：这个 effect 必须写在 loadCategories **之后** ——
   * const 声明的箭头函数有暂时性死区（TDZ），effect 的依赖数组在渲染期求值，
   * 放到定义之前会直接抛 ReferenceError: Cannot access 'loadCategories' before initialization，
   * 整个页面白屏（2026-10-25 实际踩到，npm run build 查不出来，只有跑起来才发现）。
   */
  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  /** 是否有记录的后端来源字段缺失、由前端推断（决定是否显示那句如实说明） */
  const hasInferredSource = useMemo(() => list.some((item) => item.source_inferred), [list])

  const officialList = useMemo(() => list.filter((item) => item.source === 'official'), [list])
  const communityList = useMemo(() => list.filter((item) => item.source === 'user'), [list])

  /**
   * 分类过滤（本地过滤，2026-10-25）
   * ------------------------------------------------------------
   * 为什么选本地过滤而不是「切分类就重新请求」：
   *   1. 后端 page_num 上限 50，商城一次就把全量拉回来了，本地筛不丢数据；
   *   2. 切分类零延迟零闪烁 —— 重新请求会先转圈再回来，连点 3 次就闪 3 次；
   *   3. 两层筛选要叠加（来源 × 分类），本地只算一遍，不存在请求竞态
   *      （慢的那个请求后回来会把列表盖成旧分类的结果）。
   * 代价是数据量涨到几百条以上时首屏变重，那时再改成传 category_id 走服务端；
   * getMarketList 已支持 category_id，切换成本很低。
   *
   * 脏数据兼容：后端若有记录没返回 category_id，这类记录
   *   · 「全部分类」下 → 照常显示（不能因为缺字段就藏掉整个软件）
   *   · 具体分类下   → 不显示（无法断定它属于该分类，宁可漏不可错）
   *   Number(undefined) 是 NaN，NaN === 任何值都是 false，天然满足该规则，不会报错。
   */
  const matchCategory = useCallback(
    (item: SoftwareRecord) => {
      if (selectedCategory === 'all') return true
      const cid = Number(item.category_id)
      if (!Number.isFinite(cid)) return false
      return cid === Number(selectedCategory)
    },
    [selectedCategory]
  )

  /** 当前页签的原始集合 → 再叠加分类过滤（两层叠加就在这里） */
  const allFiltered = useMemo(() => list.filter(matchCategory), [list, matchCategory])
  const officialFiltered = useMemo(
    () => officialList.filter(matchCategory),
    [officialList, matchCategory]
  )
  const communityFiltered = useMemo(
    () => communityList.filter(matchCategory),
    [communityList, matchCategory]
  )

  /** 当前选中分类的名字（'all' 时为 undefined），分类感知的空状态文案要用 */
  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return undefined
    return categories.find((item) => String(item.id) === selectedCategory)?.name
  }, [categories, selectedCategory])

  /**
   * 每个分类在当前页签内的条数，用于按钮上的弱化计数。
   * 按当前页签的集合算（切页签数字跟着变），脏数据无 category_id 时跳过。
   */
  const categoryCounts = useMemo(() => {
    const source = tab === 'official' ? officialList : tab === 'community' ? communityList : list
    const map = new Map<string, number>()
    source.forEach((item) => {
      const cid = Number(item.category_id)
      if (!Number.isFinite(cid)) return
      const key = String(cid)
      map.set(key, (map.get(key) || 0) + 1)
    })
    return map
  }, [tab, list, officialList, communityList])

  /**
   * 选中分类被后台停用/删除后的自愈
   * ------------------------------------------------------------
   * 场景：站长正停在「效率软件」筛选上，管理员同时在后台把这个分类停用了。
   * 刷新后分类按钮消失，但 selectedCategory 还停在那个 id →
   * 用户会看到一片空白且没有任何按钮能点回「全部分类」—— 死胡同。
   * 这里一旦发现当前选中项已不在可用分类里，就退回「全部分类」。
   */
  useEffect(() => {
    if (selectedCategory === 'all') return
    if (!categoryReady) return
    const stillExists = categories.some((item) => String(item.id) === selectedCategory)
    if (!stillExists) setSelectedCategory('all')
  }, [categories, categoryReady, selectedCategory])

  const openUpload = () => {
    if (!token) {
      message.info('上传需要先登录，登录后即可提交自己的软件')
      setLoginModal(true)
      return
    }
    form.resetFields()
    void loadCategories()
    setOpen(true)
  }

  /** 单个平台上传安装包：接口不通就退回「只填链接」，不阻断投稿 */
  const onPickFile = async (platform: SoftwarePlatform, file: File) => {
    const MAX = 200 * 1024 * 1024
    if (file.size > MAX) {
      message.error('安装包不能超过 200MB')
      return
    }
    setUploadingPlatform(platform)
    try {
      const res = await uploadUserPackage(file)
      if (res.ok && res.url) {
        form.setFieldValue(platform, res.url)
        message.success('已上传，提交后等待站长审核')
      } else {
        message.warning('安装包直传接口暂未开通，请改为粘贴网盘链接')
      }
    } finally {
      setUploadingPlatform(null)
    }
  }

  const onSubmit = async (values: FormValues) => {
    const platforms = PLATFORMS.map((p) => ({
      platform: p.key,
      file_url: (values[p.key] || '').trim()
    })).filter((item) => item.file_url)

    if (!platforms.length) {
      message.warning('至少填一个平台的安装包地址，站长才审得动')
      return
    }

    setSubmitting(true)
    try {
      const res = await submitSoftware({
        name: values.name.trim(),
        summary: values.summary.trim(),
        category_id: values.category_id,
        version: values.version.trim(),
        changelog: (values.changelog || '').trim(),
        repo_url: (values.repo_url || '').trim(),
        platforms
      })
      if (res.ok) {
        message.success(
          res.local ? '已提交，等待审核（本地暂存，后端接口接入后自动同步）' : '已提交，等待站长审核'
        )
        setOpen(false)
        setTab('mine')
        await load()
      } else {
        message.error('提交失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** 一句话状态：官方已上架 / 待审核 / 已通过 / 已驳回 */
  const reviewTag = (item: SoftwareRecord) => {
    if (item.source === 'official') return null
    if (item.review_status === 'approved') return <Tag color="green">{REVIEW_LABEL.approved}</Tag>
    if (item.review_status === 'rejected') return <Tag color="red">{REVIEW_LABEL.rejected}</Tag>
    return <Tag color="gold">{REVIEW_LABEL.pending}</Tag>
  }

  /**
   * 列表行：图标 + 名称 + 简介 + 平台图标组 + 包体积，整行可点进详情
   * 平台一律走 platformsOf(item)：后端只给单数 platform 的老数据也能正常显示。
   */
  const renderRow = (item: SoftwareRecord) => {
    const entries = platformsOf(item)
    const ready = entries.filter((entry) => entry.file_url)
    const size = formatFileSize(ready[0]?.file_size ?? entries[0]?.file_size)
    return (
      <button
        key={String(item.id)}
        type="button"
        className={styles.row}
        onClick={() => navigate(`/projects/${item.id}`)}
      >
        {/* 有封面就显示站长上传的封面图，没有（或加载失败）才回退到平台图标。
            2026-10-25 站长要求：cover_url 一直有值，之前前端完全没读它。 */}
        <CoverBadge
          src={item.cover_url}
          size="md"
          fallback={entries[0] ? PLATFORM_ICON[entries[0].platform] : <InboxOutlined />}
        />
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>
            {item.name}
            {item.source === 'official' ? (
              <span className={styles.badgeOfficial}>官方</span>
            ) : (
              <Tag className={styles.badgeUser}>用户上传</Tag>
            )}
            {reviewTag(item)}
          </span>
          <span className={styles.rowDesc}>
            {item.summary}
            {item.review_status === 'rejected' && item.reviewer_note ? (
              <span className={styles.reviewNote}>驳回原因：{item.reviewer_note}</span>
            ) : null}
          </span>
        </span>
        <span className={styles.rowMeta}>
          {item.version ? <span className={styles.rowVersion}>v{item.version}</span> : null}
          {entries.length ? (
            <span className={styles.rowPlatforms}>
              {entries.map((entry) => (
                <span
                  key={entry.platform}
                  className={styles.rowPlatform}
                  title={
                    entry.file_url
                      ? `${PLATFORM_LABEL[entry.platform]} 可下载`
                      : `${PLATFORM_LABEL[entry.platform]} 待上传`
                  }
                >
                  {PLATFORM_ICON[entry.platform]}
                </span>
              ))}
            </span>
          ) : null}
          <span className={styles.rowCount}>{size || '体积待补'}</span>
          <RightOutlined className={styles.rowArrow} />
        </span>
      </button>
    )
  }

  /**
   * 分类感知的空状态文案（2026-10-25）
   * ------------------------------------------------------------
   * 空列表有两种完全不同的原因，笼统写一句话会误导站长：
   *   · 这个页签本来就没有内容 → 「官方还没有上架软件」
   *   · 有内容，但被分类筛空了 → 「这个分类下还没有官方软件」
   * 后者还要给一个「看全部」的出口，否则用户会以为软件被删了。
   */
  const emptyText = (base: string, scoped: string) =>
    selectedCategory !== 'all' ? scoped : base

  /** 分类筛空时提供的一键返回：不是分类的问题，是整个页签没内容 */
  const clearCategoryExtra = () =>
    selectedCategory !== 'all' ? (
      <Button onClick={() => setSelectedCategory('all')}>看全部分类</Button>
    ) : undefined

  const renderList = (rows: SoftwareRecord[], emptyTextValue: string, extra?: JSX.Element) => {
    if (!rows.length) {
      return (
        <div className={styles.emptyCard}>
          <Empty description={emptyTextValue} />
          {extra}
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
        </div>
      )
    }
    return <div className={styles.list}>{rows.map(renderRow)}</div>
  }

  const renderContent = () => {
    if (tab === 'all') {
      return renderList(
        allFiltered,
        selectedCategoryName
          ? `「${selectedCategoryName}」分类下还没有上架的软件`
          : '还没有上架的软件，官方正在准备中',
        clearCategoryExtra()
      )
    }
    if (tab === 'official') {
      return renderList(
        officialFiltered,
        emptyText('官方还没有上架软件', `这个分类下还没有官方软件`),
        clearCategoryExtra()
      )
    }
    if (tab === 'community') {
      return renderList(
        communityFiltered,
        emptyText('还没有用户上传的软件，欢迎第一个投稿', '这个分类下还没有用户上传的软件'),
        clearCategoryExtra()
      )
    }
    if (!token) {
      return (
        <div className={styles.emptyCard}>
          <Empty description="登录后可以查看自己提交的软件与审核状态" />
          <Button type="primary" onClick={() => setLoginModal(true)}>
            登录 / 注册
          </Button>
        </div>
      )
    }
    if (mineLocal) {
      return (
        <div className={styles.emptyCard}>
          <Empty description="「我的提交」接口暂时不可用" />
          <p className={styles.localHintText}>
            商城列表本身是正常的（上面三个页签都能看到官方软件）；
            只是查看个人投稿记录的这个接口后端还没跑通，不影响下载。稍后再试即可。
          </p>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            重新获取
          </Button>
        </div>
      )
    }
    return renderList(
      mine,
      '还没有提交过软件',
      <Button icon={<CloudUploadOutlined />} onClick={openUpload}>
        上传第一个
      </Button>
    )
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          {/**
           * 两层筛选（2026-10-25 站长验收反馈「主次关系不太明确」）
           * ------------------------------------------------------------
           * 站长原话：红框（来源页签）应该是主要的，绿框（分类）是辅助的，
           * 「要有一个大小的区分，还有一个颜色深浅的区分」。
           *
           * 做法：两排仍用同一个 PillTabs 组件，但各自外面包一层局部类做「变体」：
           *   · sourceRail  → 主排：14px / 9px 18px / 高约 40px，选中态品牌实底白字
           *   · categoryBar → 次排：12.5px / 5px 13px / 高约 30px，选中态白底 + 品牌色描边
           * 为什么不直接改 PillTabs：它还被 AI 工作台、充值商城、公告页用着，
           * 动组件会连带那三处一起变（全局回归风险）。样式全部落在
           * projects/index.module.less 的局部类里，由 CSS Modules 哈希隔离。
           * 两排之间用 .filterStack 的 gap 拉开 12px，让人一眼看出是「两层」而不是一排。
           */}
          <div className={styles.filterStack}>
            <div className={styles.sourceRail}>
              <PillTabs
                ariaLabel="软件商城"
                value={tab}
                onChange={(next) => setTab(next as TabKey)}
                items={[
                  { key: 'all', label: '全部' },
                  { key: 'official', label: '官方软件' },
                  { key: 'community', label: '用户上传' },
                  { key: 'mine', label: '我的提交' }
                ]}
              />
            </div>

          {/**
           * 第二排：分类筛选（2026-10-25）
           * ------------------------------------------------------------
           * 紧跟来源页签放，因为这两排是同一件事的两个维度（来源 × 分类），
           * 分开放在页面上下两处会让人以为它们互不相干。
           *
           * 三条必须遵守的规则：
           *   1. 「我的提交」不显示 —— 那是自己的投稿记录，按分类筛没有意义；
           *   2. 分类全部由后端驱动，前端不写死任何分类名或 id（后台加一个这里就多一个）；
           *   3. 接口失败/categoryReady=false 时整排不渲染，商城主体照常工作。
           *
           * 语义用 role=group + aria-pressed，而不是第二个 role=tablist：
           * 相邻两个 tablist 会让读屏软件把「分类」误读成另一个页签组，
           * 而它其实是页签内的过滤器（切换不换内容区，只是收窄列表）。
           */}
          {tab !== 'mine' && categoryReady ? (
            <div className={styles.categoryBar}>
              <div className={styles.categoryScroll}>
                <div className={styles.categoryTabs} role="group" aria-label="按分类筛选">
                  <button
                    type="button"
                    className={[
                      styles.categoryTab,
                      selectedCategory === 'all' ? styles.categoryTabActive : ''
                    ].join(' ')}
                    aria-pressed={selectedCategory === 'all'}
                    onClick={() => setSelectedCategory('all')}
                  >
                    全部分类
                  </button>
                  {categories.map((item) => {
                    const key = String(item.id)
                    const count = categoryCounts.get(key) || 0
                    const active = selectedCategory === key
                    return (
                      <button
                        key={key}
                        type="button"
                        className={[styles.categoryTab, active ? styles.categoryTabActive : ''].join(
                          ' '
                        )}
                        aria-pressed={active}
                        onClick={() => setSelectedCategory(key)}
                      >
                        {item.name}
                        {/* 计数为 0 不显示：0 会让「刚建好还没挂软件」的分类看着像坏了 */}
                        {count > 0 ? <span className={styles.categoryCount}>{count}</span> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
          </div>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <GithubOutlined /> 官方客户端与社区工具
            </p>
            <h1>软件商城</h1>
            <p className={styles.lead}>
              官方软件由站长直接上传、即传即上架；用户也能投稿自己的作品，
              <strong>提交后进入后台审核，通过后才会出现在这里</strong>。
              所有软件都标注来源与版本，下载前可以点进详情看更新说明。
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

          {hasInferredSource ? (
            <Alert
              type="info"
              showIcon
              className={styles.localHint}
              message="来源归类说明"
              description="后端列表接口暂未返回「官方 / 用户投稿」字段，这里的来源是按现有数据推断的：查不到来源信息的记录一律归为官方（历史上这些都是站长在后台直录）。后端补上该字段后会自动按真实值显示，无需改前端。"
            />
          ) : null}

          {localMode ? (
            <Alert
              type="warning"
              showIcon
              className={styles.localHint}
              message="本地模式：后端接口未接入"
              description="当前展示的是这台浏览器暂存的数据，提交与审核只在本机生效。后端 /user/software/* 与 /user/admin/software/review/* 上线后会自动切换到真实数据。"
            />
          ) : null}

          <Spin spinning={loading}>{renderContent()}</Spin>

          <section className={styles.rules}>
            <h2>来源与审核规则</h2>
            <ul>
              <li>
                <strong>官方软件</strong>：由站长在后台直传安装包，提交即上架，不需要审核。
              </li>
              <li>
                <strong>用户上传</strong>：注册用户均可投稿，提交后进入「待审核」，站长通过后才公开。
              </li>
              <li>安装包可直传（≤200MB）或填网盘链接；请注明版本号与这次更新了什么。</li>
              <li>发布新版本同样需要提交并审核一次，通过后替换旧版本的下载入口。</li>
              <li>不接受挖矿、恶意扣费、窃取密钥或违反平台规则的工具，一经发现立即下架。</li>
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
        width={640}
        destroyOnClose
      >
        <p className={styles.modalTip}>
          提交后进入站长审核队列，通过后自动上架；状态和驳回原因都能在「我的提交」里看到。
        </p>
        <Form form={form} layout="vertical" onFinish={(values) => void onSubmit(values)}>
          <Form.Item name="name" label="软件名称" rules={[{ required: true, message: '填一个名字' }]}>
            <Input placeholder="例如：余额查询助手" maxLength={40} />
          </Form.Item>
          <Form.Item
            name="summary"
            label="一句话简介"
            rules={[{ required: true, message: '用一句话说清它解决什么问题' }]}
          >
            <Input placeholder="例如：桌面小工具，抬头就能看到余额和最近用量" maxLength={80} />
          </Form.Item>
          <Form.Item name="category_id" label="分类（选填）">
            <Select
              allowClear
              placeholder="选择分类"
              options={categories.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item name="repo_url" label="开源仓库地址（选填）">
            <Input placeholder="https://github.com/你/项目" prefix={<GithubOutlined />} />
          </Form.Item>
          <Form.Item name="version" label="版本号" rules={[{ required: true, message: '例如 0.1.0' }]}>
            <Input placeholder="0.1.0" maxLength={20} />
          </Form.Item>
          <Form.Item name="changelog" label="这次更新了什么（选填）">
            <Input.TextArea rows={3} maxLength={300} showCount placeholder="修了什么问题、加了什么功能" />
          </Form.Item>

          <p className={styles.formLabel}>安装包（至少填一个平台）</p>
          <p className={styles.formHint}>
            可以选文件直传，也可以粘贴网盘链接；直传接口未开通时会提示改用链接。
          </p>
          {PLATFORMS.map((p) => (
            <Form.Item key={p.key} name={p.key} label={PLATFORM_LABEL[p.key]}>
              <Input
                placeholder="直链或网盘链接"
                prefix={<LinkOutlined />}
                addonAfter={
                  <Upload
                    accept=".zip,.dmg,.exe,.msi,.deb,.rpm,.tar.gz,.7z,.rar,.AppImage"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void onPickFile(p.key, file as File)
                      return false
                    }}
                  >
                    <span className={styles.uploadTrigger}>
                      {uploadingPlatform === p.key ? '上传中…' : '选文件'}
                    </span>
                  </Upload>
                }
              />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}

export default ProjectsPage
