import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Empty, Image, Input, Pagination, Spin, Tag, message } from 'antd'
import { CloudDownloadOutlined, DownloadOutlined, PictureOutlined } from '@ant-design/icons'
import Layout from '@/components/Layout'
import {
  getSoftwareCategories,
  getSoftwareList,
  type SoftwareCategoryItem,
  type SoftwareItem,
  type SoftwareLink
} from '@/request/api'
import { copyToClipboard } from '@/utils'
import styles from './index.module.less'

const PAGE_SIZE = 12

function Cover({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <div className={styles.cover}>
        <PictureOutlined className={styles.placeholder} />
      </div>
    )
  }
  return (
    <div className={styles.cover}>
      <Image src={url} alt={name} preview onError={() => setFailed(true)} />
    </div>
  )
}

function DownloadLinks({ links }: { links: SoftwareLink[] }) {
  const copyCode = async (code: string) => {
    try {
      await copyToClipboard(code)
      message.success('提取码已复制')
    } catch {
      message.warning('复制失败，请手动复制')
    }
  }

  return (
    <div className={styles.links}>
      {links.map((link, index) => (
        <div key={`${link.url}-${index}`} className={styles.linkGroup}>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            href={link.url}
            target="_blank"
            rel="noreferrer"
          >
            {link.label || '下载'}
          </Button>
          {link.code ? (
            <Button size="small" onClick={() => copyCode(link.code || '')}>
              提取码 {link.code}
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function SoftwarePage() {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<SoftwareCategoryItem[]>([])
  const [list, setList] = useState<SoftwareItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    getSoftwareCategories().then((res: any) => {
      setCategories(res?.data?.list || [])
    })
  }, [])

  const loadList = useCallback(async (nextPage: number, nextCategory: number | null, nextKeyword: string) => {
    setLoading(true)
    try {
      const res: any = await getSoftwareList({
        page: nextPage,
        page_num: PAGE_SIZE,
        category_id: nextCategory,
        keyword: nextKeyword
      })
      const payload = res?.data || {}
      setList(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList(1, categoryId, keyword)
  }, [categoryId, keyword, loadList])

  const onSearch = () => {
    const next = draft.trim()
    if (next === keyword) {
      loadList(1, categoryId, next)
      return
    }
    setKeyword(next)
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <section className={styles.hero}>
            <div>
              <p className={styles.kicker}>
                <CloudDownloadOutlined /> 软件下载
              </p>
              <h1>软件下载</h1>
              <p className={styles.lead}>按分类浏览，或用关键字搜索名称和简介。</p>
            </div>
          </section>

          <Alert
            className={styles.notice}
            type="info"
            showIcon
            message="下载前请看"
            description="链接是网盘链接，打开后到网盘下载。网盘里包含主流系统的安装包，请按自己电脑的系统和架构选择：Windows x64、Windows ARM64、macOS、Linux。"
          />

          <section className={styles.card}>
            <div className={styles.filters}>
              <div className={styles.search}>
                <Input
                  allowClear
                  value={draft}
                  placeholder="搜索名称或简介"
                  onChange={(event) => {
                    const value = event.target.value
                    setDraft(value)
                    if (!value && keyword) setKeyword('')
                  }}
                  onPressEnter={onSearch}
                />
                <Button type="primary" onClick={onSearch}>
                  搜索
                </Button>
              </div>
              <div className={styles.categories}>
                <Button type={categoryId == null ? 'primary' : 'default'} onClick={() => setCategoryId(null)}>
                  全部
                </Button>
                {categories.map((item) => (
                  <Button
                    key={item.id}
                    type={categoryId === item.id ? 'primary' : 'default'}
                    onClick={() => setCategoryId(item.id)}
                  >
                    {item.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className={styles.listHead}>
              <h2>{keyword ? `搜索「${keyword}」` : '全部软件'}</h2>
              <span>共 {total} 个</span>
            </div>
            <Spin spinning={loading}>
              {list.length === 0 ? (
                <Empty description={keyword ? '没有匹配的软件' : '暂无软件'} />
              ) : (
                <div className={styles.grid}>
                  {list.map((item) => (
                    <article key={item.id} className={styles.item}>
                      <Cover url={item.cover_url} name={item.name} />
                      <div className={styles.body}>
                        <div className={styles.meta}>
                          {item.category_name ? <Tag>{item.category_name}</Tag> : null}
                          {item.version ? <Tag color="blue">{item.version}</Tag> : null}
                        </div>
                        <h3 className={styles.name}>{item.name}</h3>
                        {item.summary ? <p className={styles.summary}>{item.summary}</p> : null}
                        <p className={styles.hint}>
                          网盘内含 Windows x64、Windows ARM64、macOS、Linux 安装包，请按本机系统选择。
                        </p>
                        <DownloadLinks links={item.links || []} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Spin>
            {total > PAGE_SIZE ? (
              <div className={styles.pager}>
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  showSizeChanger={false}
                  onChange={(next) => loadList(next, categoryId, keyword)}
                />
              </div>
            ) : null}
          </section>
        </div>
      </Layout>
    </div>
  )
}

export default SoftwarePage
