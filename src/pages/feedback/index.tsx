import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, Form, Input, Pagination, Spin, Switch, Tag, message } from 'antd'
import Layout from '@/components/Layout'
import { userStore } from '@/store'
import { getFeedbackList, postFeedback } from '@/request/api'
import styles from './index.module.less'

type FeedbackForm = {
  content: string
  contact?: string
  nickname?: string
  anonymous: boolean
}

type FeedbackItem = {
  id: number
  content: string
  nickname: string
  anonymous: boolean
  insert_time: string
  reply?: string
  reply_time?: string
}

const PAGE_SIZE = 10

function FeedbackPage() {
  const [form] = Form.useForm<FeedbackForm>()
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<FeedbackItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const { token, user_info } = userStore()
  const anonymous = Form.useWatch('anonymous', form)
  const loggedName = user_info?.data?.bodyMessage?.userName

  const loadList = useCallback(async (nextPage = 1) => {
    setLoading(true)
    try {
      const res: any = await getFeedbackList({ page: nextPage, page_num: PAGE_SIZE })
      const payload = res?.data || {}
      setList(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList(1)
  }, [loadList])

  const onFinish = async (values: FeedbackForm) => {
    const content = (values.content || '').trim()
    if (content.length < 5) {
      message.warning('留言至少 5 个字')
      return
    }
    setSubmitting(true)
    try {
      const res: any = await postFeedback({
        content,
        contact: (values.contact || '').trim() || undefined,
        nickname: values.anonymous
          ? (values.nickname || '').trim() || undefined
          : (values.nickname || loggedName || '').trim() || undefined,
        anonymous: values.anonymous,
        userId: false ? null : user_info?.data?.bodyMessage?.userId ?? null
      })
      if (res?.data?.code === '0' || res?.code === 0) {
        message.success(res?.data?.codeMsg || '留言已收到，感谢反馈')
        form.resetFields()
        form.setFieldsValue({ anonymous: true })
        await loadList(1)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <section className={styles.hero}>
            <div>
              <p className={styles.kicker}>公共留言板</p>
              <h1>看看大家怎么说</h1>
              <p className={styles.lead}>
                这里是共享频道，所有人都能看到留言和管理员回复。默认匿名：不署名就不绑定账号，也不会留下可识别身份；联系方式选填，你不填我们就不记录。
              </p>
            </div>
          </section>

          <div className={styles.board}>
            <section className={`${styles.card} ${styles.listCard}`}>
              <div className={styles.listHead}>
                <h2>全部留言</h2>
                <span>共 {total} 条，按最新在前</span>
              </div>
              <Spin spinning={loading}>
                {list.length === 0 ? (
                  <Empty description="还没有留言，来写第一条吧" />
                ) : (
                  <div className={styles.list}>
                    {list.map((item) => (
                      <article key={item.id} className={styles.item}>
                        <div className={styles.itemMeta}>
                          <strong>{item.nickname}</strong>
                          {item.anonymous ? <Tag>匿名</Tag> : <Tag color="blue">署名</Tag>}
                          <time>{item.insert_time}</time>
                        </div>
                        <p>{item.content}</p>
                        {item.reply ? (
                          <div className={styles.reply}>
                            <div className={styles.replyMeta}>
                              <strong>管理员</strong>
                              <Tag color="blue">回复</Tag>
                              {item.reply_time ? <time>{item.reply_time}</time> : null}
                            </div>
                            <p>{item.reply}</p>
                          </div>
                        ) : null}
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
                    onChange={(next) => loadList(next)}
                  />
                </div>
              ) : null}
            </section>

            <section className={`${styles.card} ${styles.formCard}`}>
              <h2>写一条留言</h2>
              <Form
                form={form}
                layout="vertical"
                initialValues={{ anonymous: true, nickname: '', contact: '' }}
                onFinish={onFinish}
              >
                <Form.Item
                  label="留言内容"
                  name="content"
                  rules={[
                    { required: true, message: '请填写留言' },
                    { min: 5, message: '至少 5 个字' },
                    { max: 2000, message: '最多 2000 字' }
                  ]}
                >
                  <Input.TextArea
                    rows={6}
                    maxLength={2000}
                    showCount
                    placeholder="想说的话写在这里，比如哪里不好用、希望支持什么模型。"
                  />
                </Form.Item>
                <Form.Item
                  label={anonymous ? '联系方式（选填，不填则不记录）' : '联系方式（选填，不公开）'}
                  name="contact"
                >
                  <Input
                    maxLength={100}
                    placeholder={
                      anonymous
                        ? '可不填。填写后仅用于私下回复，不会出现在留言墙'
                        : '微信 / 邮箱 / 手机，方便我们私下回复'
                    }
                  />
                </Form.Item>
                <Form.Item label="昵称（选填，会展示在墙上）" name="nickname">
                  <Input maxLength={50} placeholder={anonymous ? '不填则显示「匿名用户」' : '方便大家认出你'} />
                </Form.Item>
                <Form.Item label="匿名提交" name="anonymous" valuePropName="checked">
                  <Switch
                    checkedChildren="匿名"
                    unCheckedChildren="署名"
                    onChange={(checked) => {
                      if (checked) {
                        form.setFieldsValue({
                          nickname: loggedName,
                          contact: form.getFieldValue('contact') || ''
                        })
                      } else if (token && loggedName) {
                        form.setFieldsValue({ nickname: loggedName })
                      }
                    }}
                  />
                </Form.Item>
                <p className={styles.hint}>
                  {anonymous
                    ? '匿名不会绑定登录账号，也不会记录身份信息。昵称、联系方式都可不填；不填就不会保存。'
                    : token
                      ? '署名会关联当前登录账号（不公开展示）。昵称会显示在留言墙上。'
                      : '当前未登录，署名只会公开你填写的昵称。'}
                </p>
                <Button type="primary" htmlType="submit" size="large" loading={submitting} block>
                  发布到留言板
                </Button>
              </Form>
            </section>
          </div>
        </div>
      </Layout>
    </div>
  )
}

export default FeedbackPage
