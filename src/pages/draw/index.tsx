import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Empty,
  Image,
  Input,
  Pagination,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  message
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PictureOutlined,
  ReloadOutlined,
  UploadOutlined
} from '@ant-design/icons'
import Layout from '@/components/Layout'
import { userStore } from '@/store'
import {
  getUserPricing,
  postImagesEdits,
  postImagesGenerations,
  type ImageGenerationResult,
  type UserImageModelRate
} from '@/request/api'
import {
  compareModelNewestFirst,
  enrichVendorModel,
  formatUsd,
  getImageModelIntro,
  isPerImageBilling,
  pickImageTierPrice,
  resolveImageSizeTier
} from '@/data/modelPricing'
import {
  clearDrawImages,
  deleteDrawImage,
  drawCacheUserKey,
  downloadDrawImage,
  getDrawImageBlob,
  listDrawImagesPage,
  saveDrawImageToCache,
  type DrawCacheRecord
} from '@/utils/drawImageCache'
import styles from './index.module.less'

const SIZES = [
  { label: '1024×1024（1K）', value: '1024x1024' },
  { label: '1536×1024 横图（2K）', value: '1536x1024' },
  { label: '1024×1536 竖图（2K）', value: '1024x1536' },
  { label: '2048×2048（2K）', value: '2048x2048' },
  { label: '4096×4096（4K）', value: '4096x4096' },
  { label: '自动', value: 'auto' }
]

const QUALITIES = [
  { label: '自动', value: 'auto' },
  { label: '低 (low)', value: 'low' },
  { label: '中 (medium)', value: 'medium' },
  { label: '高 (high)', value: 'high' }
]

const PAGE_SIZE = 6
const MAX_IMAGE_BYTES = 15 * 1024 * 1024

type DrawMode = 'text' | 'img2img' | 'edit'
type GalleryItem = DrawCacheRecord & { previewUrl: string }

const MODE_LABEL: Record<DrawMode, string> = {
  text: '文生图',
  img2img: '图生图',
  edit: '修改图片'
}

const MODE_GUIDE: Record<DrawMode, { title: string; steps: string[]; example: string }> = {
  text: {
    title: '只写文字，从零生成一张新图',
    steps: [
      '选图像模型和尺寸。',
      '在提示词里写清主体、风格、光线和构图。',
      '点「生成图片」。请求走 /v1/images/generations。'
    ],
    example: '一只坐在窗边的橘猫，柔和阳光，写实摄影，浅景深'
  },
  img2img: {
    title: '在本机选一张参考图，按文字重新生成',
    steps: [
      '从本机选择参考图（png / jpg / webp，15MB 以内），或从下方图库点「作为参考图」。图片只读进浏览器，不会先传到网站。',
      '提示词写你希望保留什么、改成什么风格或场景。',
      'GPT Image 可把「贴合原图」设为高，主体和细节更接近原图；设为低，允许更大改动。',
      '点「按参考图生成」。图片数据放进同一次 /v1/images/edits 请求，由中转转发，网站不保存原图。'
    ],
    example: '保留人物姿态和构图，改成水彩插画，背景换成雨后的街道'
  },
  edit: {
    title: '在原图上改内容，大部分时候只写说明就够',
    steps: [
      '从本机选择要修改的原图，或从下方图库点「去修改」。原图只留在浏览器里。',
      '在修改说明里写清楚改什么、哪里不要动。例如：把背景换成沙滩，人不要动。',
      '整张图换风格、换场景，不用选下面的「只改一块」。',
      '点「修改图片」。图片数据随这次请求转发，网站不保存原图。'
    ],
    example: '把背景换成雪山，人物和服装不要改'
  }
}

function supportsGptImageControls(model: string) {
  return /gpt-image|chatgpt-image/i.test(model || '')
}

function resultToSrc(first?: ImageGenerationResult['data'][number]) {
  if (first?.b64_json) {
    return `data:${first.mime || 'image/png'};base64,${first.b64_json}`
  }
  return first?.url || ''
}

function readLocalImage(accept: string, onFile: (file: File) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      message.warning('请选择图片文件')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      message.warning('图片请小于 15MB')
      return
    }
    onFile(file)
  }
  input.click()
}

function formatTierMap(tiers?: Record<string, number>) {
  if (!tiers) return []
  return (['1k', '2k', '4k'] as const)
    .filter((key) => typeof tiers[key] === 'number')
    .map((key) => `${key.toUpperCase()} ${formatUsd(tiers[key])}/张`)
}

function DrawPage() {
  const { token, user_info, setLoginModal, llm_api_key } = userStore()
  const phone =
    (user_info as any)?.data?.bodyMessage?.telephone || (user_info as any)?.telephone || ''
  const credential =
    (llm_api_key || '').startsWith('sk-') || /^1[3-9]\d{9}$/.test(llm_api_key || '')
      ? llm_api_key
      : phone
  const userKey = drawCacheUserKey(phone || credential)

  const [models, setModels] = useState<UserImageModelRate[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelId, setModelId] = useState('')
  const [mode, setMode] = useState<DrawMode>('text')
  const [size, setSize] = useState('1024x1024')
  const [quality, setQuality] = useState('auto')
  const [fidelity, setFidelity] = useState<'high' | 'low'>('high')
  const [prompt, setPrompt] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [maskFile, setMaskFile] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const [galleryTotal, setGalleryTotal] = useState(0)
  const [galleryPage, setGalleryPage] = useState(1)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const previewUrlsRef = useRef<string[]>([])

  const revokePreviewUrls = useCallback(() => {
    for (const url of previewUrlsRef.current) {
      URL.revokeObjectURL(url)
    }
    previewUrlsRef.current = []
  }, [])

  const loadGallery = useCallback(
    async (page: number) => {
      setGalleryLoading(true)
      try {
        const { items, total } = await listDrawImagesPage(userKey, page, PAGE_SIZE)
        revokePreviewUrls()
        const withUrls: GalleryItem[] = []
        for (const item of items) {
          const blob = await getDrawImageBlob(item.id)
          if (!blob) continue
          const previewUrl = URL.createObjectURL(blob)
          previewUrlsRef.current.push(previewUrl)
          withUrls.push({ ...item, previewUrl })
        }
        setGallery(withUrls)
        setGalleryTotal(total)
        const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
        if (page > maxPage) setGalleryPage(maxPage)
      } catch (err) {
        message.error(err instanceof Error ? err.message : '读取本地图库失败')
        setGallery([])
        setGalleryTotal(0)
      } finally {
        setGalleryLoading(false)
      }
    },
    [userKey, revokePreviewUrls]
  )

  useEffect(() => {
    void loadGallery(galleryPage)
    return () => revokePreviewUrls()
  }, [galleryPage, userKey, loadGallery, revokePreviewUrls])

  const loadModels = async (signal?: AbortSignal) => {
    setLoadingModels(true)
    setError('')
    try {
      const data = await getUserPricing({ signal })
      const list = [...(data.image_models || [])].sort((a, b) =>
        compareModelNewestFirst(a.model, b.model)
      )
      setModels(list)
      if (list.length && !list.some((item) => item.model === modelId)) {
        setModelId(list[0].model)
      }
    } catch (err) {
      if (!signal?.aborted) {
        setModels([])
        setError(err instanceof Error ? err.message : '获取图像模型失败')
      }
    } finally {
      if (!signal?.aborted) setLoadingModels(false)
    }
  }

  useEffect(() => {
    if (!sourceFile) {
      setSourcePreview('')
      return
    }
    const url = URL.createObjectURL(sourceFile)
    setSourcePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [sourceFile])

  useEffect(() => {
    if (!token || !credential) return
    const controller = new AbortController()
    void loadModels(controller.signal)
    return () => controller.abort()
  }, [token, credential])

  const current = useMemo(
    () => models.find((item) => item.model === modelId) || models[0],
    [models, modelId]
  )
  const enriched = current
    ? enrichVendorModel({
        id: current.model,
        name: current.display_name,
        owned_by: current.owned_by
      })
    : null
  const intro = current ? getImageModelIntro(current.model) || enriched?.intro : ''
  const perImage = isPerImageBilling(current)
  const sizeTier = resolveImageSizeTier(size)
  const estimateUsd = perImage ? pickImageTierPrice(current?.per_image_tiers, size) : null
  const gptImage = supportsGptImageControls(current?.model || '')
  const needsSource = mode !== 'text'
  const guide = MODE_GUIDE[mode]

  const onGenerate = async () => {
    const text = prompt.trim()
    if (!text) {
      message.warning(mode === 'edit' ? '请填写修改说明' : '请填写提示词')
      return
    }
    if (!current?.model) {
      message.warning('当前供应商暂无可用图像模型')
      return
    }
    if (needsSource && !sourceFile) {
      message.warning(mode === 'edit' ? '请先从本机选择要修改的原图' : '请先从本机选择参考图')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    setError('')
    try {
      let res: ImageGenerationResult
      if (needsSource && sourceFile) {
        res = await postImagesEdits(
          {
            model: current.model,
            prompt: text,
            image: sourceFile,
            mask: mode === 'edit' && gptImage ? maskFile : null,
            n: 1,
            size,
            quality,
            input_fidelity: gptImage ? fidelity : undefined,
            response_format: 'b64_json'
          },
          controller.signal
        )
      } else {
        res = await postImagesGenerations(
          {
            model: current.model,
            prompt: text,
            n: 1,
            size,
            quality,
            response_format: 'b64_json'
          },
          controller.signal
        )
      }
      const src = resultToSrc(res.data?.[0])
      if (!src) throw new Error('上游未返回图片数据')

      try {
        await saveDrawImageToCache(userKey, {
          model: current.model,
          prompt: text,
          src,
          size,
          quality,
          mode,
          billing: res.billing?.notice
        })
        setGalleryPage(1)
        await loadGallery(1)
        message.success('生成成功，已写入本机浏览器缓存，请及时下载保存')
      } catch (cacheErr) {
        message.warning(
          cacheErr instanceof Error
            ? `生成成功，但本地缓存失败：${cacheErr.message}，请立即手动下载`
            : '生成成功，但本地缓存失败，请立即手动下载'
        )
      }

    } catch (err) {
      if ((err as any)?.name === 'AbortError') return
      setError(err instanceof Error ? err.message : '图像处理失败')
    } finally {
      setGenerating(false)
    }
  }

  const onDownload = async (item: DrawCacheRecord) => {
    try {
      await downloadDrawImage(item)
      message.success('已开始下载')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '下载失败')
    }
  }

  const onDelete = async (id: string) => {
    try {
      await deleteDrawImage(id)
      message.success('已从本地图库删除')
      await loadGallery(galleryPage)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const onUseCached = async (item: DrawCacheRecord, nextMode: DrawMode) => {
    try {
      const blob = await getDrawImageBlob(item.id)
      if (!blob) throw new Error('本地缓存中找不到该图片')
      const file = new File([blob], `draw-${item.id.slice(0, 8)}.png`, { type: blob.type || 'image/png' })
      setMode(nextMode)
      setSourceFile(file)
      setMaskFile(null)
      message.success(nextMode === 'edit' ? '已填入待修改的原图，请写修改说明' : '已填入参考图，请写想生成的画面')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      message.error(err instanceof Error ? err.message : '读取本地图片失败')
    }
  }

  const onClearAll = async () => {
    try {
      const n = await clearDrawImages(userKey)
      message.success(n ? `已清空 ${n} 张本地缓存` : '本地图库已是空的')
      setGalleryPage(1)
      await loadGallery(1)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '清空失败')
    }
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <div>
              <p className={styles.kicker}>
                <PictureOutlined /> 文生图 · 图生图 · 修改图片
              </p>
              <h1>AI 绘图</h1>
              <p>
                文生图从文字出图；图生图和修改图片在本机选图，提交时把图片数据放进同一次请求由中转转发，网站不保存原图。修改图片时，多数情况写清楚改哪里即可；只有必须锁住其余画面时，才用「只改一块」。价格跟随当前供应商。
              </p>
            </div>
            {token && credential ? (
              <Button icon={<ReloadOutlined />} loading={loadingModels} onClick={() => void loadModels()}>
                刷新模型
              </Button>
            ) : null}
          </header>

          <Alert
            showIcon
            type="warning"
            className={styles.storageNotice}
            message="图像仅保存在您当前设备的浏览器中"
            description={
              <span>
                本网站<strong>数据库不存储</strong>您的原图和生成结果。参考图只在浏览器里读取，点生成时把图片数据放进同一次请求，由中转转发。生成结果写入本机 IndexedDB。刷新页面或重启浏览器后仍可在此查看（同一台电脑、同一浏览器）。
                换设备、换浏览器、清除站点数据或卸载浏览器会导致<strong>永久丢失</strong>，若满意请及时点击「下载」保存到本地磁盘。
              </span>
            }
          />

          <section className={styles.guide}>
            {(Object.keys(MODE_GUIDE) as DrawMode[]).map((key) => {
              const item = MODE_GUIDE[key]
              return (
                <button
                  key={key}
                  type="button"
                  className={mode === key ? `${styles.guideCard} ${styles.guideOn}` : styles.guideCard}
                  onClick={() => setMode(key)}
                >
                  <strong>{MODE_LABEL[key]}</strong>
                  <span>{item.title}</span>
                </button>
              )
            })}
          </section>

          <Alert
            showIcon
            type="info"
            message={`怎么用「${MODE_LABEL[mode]}」`}
            description={
              <div className={styles.howTo}>
                <ol>
                  {guide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p>示例提示词：{guide.example}</p>
                {mode === 'edit' ? (
                  <div className={styles.maskHelp}>
                    <p>「只改一块」是可选的，多数人用不到。它是一张和原图一样大的 PNG，专门圈出允许重画的位置：要改的地方做成透明，其余涂实。</p>
                    <p>适合：去掉路人、水印或杂物；只换背景、人不要动；只改衣服或手里的东西。整张图换风格时不要用。不会做这种图就跳过，把位置写进修改说明。</p>
                  </div>
                ) : null}
              </div>
            }
          />

          {!token ? (
            <Alert
              showIcon
              type="info"
              message="登录后即可按上面的步骤出图"
              description={
                <Button type="link" onClick={() => setLoginModal(true)}>
                  登录 / 注册
                </Button>
              }
            />
          ) : !credential ? (
            <Alert showIcon type="warning" message="请先到「Agent 接入」页创建 sk- 密钥，再调用绘图" />
          ) : error && !models.length ? (
            <Alert showIcon type="error" message={error} action={<Button onClick={() => void loadModels()}>重试</Button>} />
          ) : null}

          {token && credential ? (
            <section className={styles.panel}>
              <div className={styles.field}>
                <label>用法</label>
                <Segmented
                  block
                  value={mode}
                  onChange={(value) => setMode(value as DrawMode)}
                  options={(Object.keys(MODE_LABEL) as DrawMode[]).map((key) => ({
                    label: MODE_LABEL[key],
                    value: key
                  }))}
                />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>图像模型</label>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    loading={loadingModels}
                    value={current?.model}
                    onChange={setModelId}
                    options={models.map((item) => ({
                      value: item.model,
                      label: item.display_name || item.model
                    }))}
                    placeholder={loadingModels ? '加载中…' : '选择模型'}
                  />
                </div>
                <div className={styles.field}>
                  <label>尺寸</label>
                  <Select value={size} onChange={setSize} options={SIZES} />
                </div>
                <div className={styles.field}>
                  <label>质量</label>
                  <Select value={quality} onChange={setQuality} options={QUALITIES} />
                </div>
                {needsSource && gptImage ? (
                  <div className={styles.field}>
                    <label>贴合原图</label>
                    <Select
                      value={fidelity}
                      onChange={setFidelity}
                      options={[
                        { label: '高：尽量保留原图细节', value: 'high' },
                        { label: '低：允许更大改动', value: 'low' }
                      ]}
                    />
                  </div>
                ) : null}
              </div>

              {current ? (
                <div className={styles.meta}>
                  <Tag color="blue">{current.model}</Tag>
                  {perImage ? (
                    <>
                      <Tag color="green">按张计费 · {sizeTier.toUpperCase()}</Tag>
                      {formatTierMap(current.per_image_tiers).map((text) => (
                        <span key={text}>{text}</span>
                      ))}
                      {estimateUsd != null ? (
                        <span>当前尺寸预估 {formatUsd(estimateUsd)} / 张</span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Tag>按 tokens 计费</Tag>
                      <span>文本输入 {formatUsd(current.text_input)} / 百万 tokens</span>
                      <span>图像输入 {formatUsd(current.image_input)} / 百万 tokens</span>
                      <span>输出 {formatUsd(current.output)} / 百万 tokens</span>
                    </>
                  )}
                </div>
              ) : null}
              {intro ? <p className={styles.intro}>{intro}</p> : null}

              {needsSource ? (
                <div className={styles.uploadRow}>
                  <div className={styles.field}>
                    <label>{mode === 'edit' ? '要修改的原图' : '参考图'}</label>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() =>
                        readLocalImage('image/png,image/jpeg,image/webp,image/gif', setSourceFile)
                      }
                    >
                      {sourceFile ? '更换图片' : mode === 'edit' ? '选择原图' : '选择参考图'}
                    </Button>
                    {sourceFile ? (
                      <div className={styles.fileLine}>
                        {sourcePreview ? (
                          <img className={styles.thumb} src={sourcePreview} alt="" />
                        ) : null}
                        <span>{sourceFile.name}</span>
                        <Button type="link" size="small" onClick={() => setSourceFile(null)}>
                          移除
                        </Button>
                      </div>
                    ) : (
                      <p className={styles.fileHint}>
                        只从本机读入，不会先传到网站。也可在下方图库里把已有图片设为参考图。
                      </p>
                    )}
                  </div>
                  {mode === 'edit' && gptImage ? (
                    <div className={styles.field}>
                      <label>只改一块（可选，多数情况不用选）</label>
                      <div className={styles.maskHelp}>
                        <p>这是一张和原图一样大的 PNG，用来圈出「只许改这里」。</p>
                        <p>要改的地方做成透明，不想动的地方涂实。透明处会重画，涂实处尽量保持原样。</p>
                        <p>适合这些情况：去掉路人、水印或杂物；只换背景，人不要动；只改衣服颜色或手里的东西。</p>
                        <p>整张图都要换风格时不要选。不会做这种图也没关系，把要改的位置写进修改说明即可。</p>
                      </div>
                      <Button icon={<UploadOutlined />} onClick={() => readLocalImage('image/png', setMaskFile)}>
                        {maskFile ? '更换这张圈选图' : '选择「只改这一块」的图'}
                      </Button>
                      {maskFile ? (
                        <div className={styles.fileLine}>
                          <span>{maskFile.name}</span>
                          <Button type="link" size="small" onClick={() => setMaskFile(null)}>
                            移除
                          </Button>
                        </div>
                      ) : (
                        <p className={styles.fileHint}>不选的话，就按修改说明处理整张图。这张图也只在提交时随请求转发，宽高要和原图一样。</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.field}>
                <label>{mode === 'edit' ? '修改说明' : '提示词'}</label>
                <Input.TextArea
                  rows={5}
                  maxLength={4000}
                  showCount
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={guide.example}
                />
              </div>

              {error ? <Alert showIcon type="error" message={error} style={{ marginBottom: 12 }} /> : null}

              <Space>
                <Button type="primary" size="large" loading={generating} onClick={() => void onGenerate()}>
                  {mode === 'edit' ? '修改图片' : mode === 'img2img' ? '按参考图生成' : '生成图片'}
                </Button>
                {generating ? (
                  <Button
                    onClick={() => {
                      abortRef.current?.abort()
                      setGenerating(false)
                    }}
                  >
                    取消
                  </Button>
                ) : null}
              </Space>
            </section>
          ) : null}

          <section className={styles.panel}>
            <div className={styles.galleryHead}>
              <div>
                <h2>本地图库</h2>
                <p className={styles.galleryHint}>
                  共 {galleryTotal} 张 · 保存在本机浏览器 · 第 {galleryPage} 页
                </p>
              </div>
              <Space wrap>
                <Button
                  icon={<ReloadOutlined />}
                  loading={galleryLoading}
                  onClick={() => void loadGallery(galleryPage)}
                >
                  刷新列表
                </Button>
                <Popconfirm
                  title="清空本机图库？"
                  description="仅删除浏览器缓存，不影响已下载到磁盘的文件。"
                  onConfirm={() => void onClearAll()}
                  disabled={!galleryTotal}
                >
                  <Button danger icon={<DeleteOutlined />} disabled={!galleryTotal}>
                    清空本地图库
                  </Button>
                </Popconfirm>
              </Space>
            </div>

            {!gallery.length && !galleryLoading ? (
              <Empty description="还没有本地缓存的生成记录，生成后会自动保存在本机" />
            ) : (
              <>
                <div className={styles.grid}>
                  {gallery.map((item) => (
                    <article key={item.id} className={styles.card}>
                      <Image src={item.previewUrl} alt={item.prompt} />
                      <div className={styles.cardBody}>
                        <strong>{item.model}</strong>
                        <p>{item.prompt}</p>
                        <time>{item.timeLabel}</time>
                        {item.mode ? <Tag>{MODE_LABEL[item.mode]}</Tag> : null}
                        {item.size ? (
                          <div className={styles.metaLine}>
                            尺寸 {item.size}
                            {item.quality ? ` · 质量 ${item.quality}` : ''}
                          </div>
                        ) : null}
                        {item.billing ? <div className={styles.bill}>{item.billing}</div> : null}
                        <Space className={styles.cardActions} wrap>
                          <Button
                            type="primary"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={() => void onDownload(item)}
                          >
                            下载
                          </Button>
                          {token && credential ? (
                            <>
                              <Button size="small" icon={<PictureOutlined />} onClick={() => void onUseCached(item, 'img2img')}>
                                作为参考图
                              </Button>
                              <Button size="small" icon={<EditOutlined />} onClick={() => void onUseCached(item, 'edit')}>
                                去修改
                              </Button>
                            </>
                          ) : null}
                          <Popconfirm title="从本机图库删除这张？" onConfirm={() => void onDelete(item.id)}>
                            <Button size="small" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      </div>
                    </article>
                  ))}
                </div>
                {galleryTotal > PAGE_SIZE ? (
                  <div className={styles.pagination}>
                    <Pagination
                      current={galleryPage}
                      pageSize={PAGE_SIZE}
                      total={galleryTotal}
                      showSizeChanger={false}
                      onChange={(p) => setGalleryPage(p)}
                      showTotal={(t) => `共 ${t} 张`}
                    />
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </Layout>
    </div>
  )
}

export default DrawPage
