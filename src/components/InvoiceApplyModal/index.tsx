import { useEffect, useMemo, useState } from 'react'
import { Form, Input, Modal, Radio, message } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import IconBadge from '@/components/IconBadge'
import { submitInvoiceApplication, type InvoiceTitleType } from '@/request/invoice'
import { formatCny, sumCny } from '@/utils/money'
import { userStore } from '@/store'
import styles from './index.module.less'

/**
 * 发票申请弹窗（按订单开，支持多笔合并）
 * ------------------------------------------------------------
 * 从「开票中心/支付记录」里某一笔充值点「开发票」打开，金额和订单号来自这条记录，
 * 用户只填抬头、税号、邮箱。一单一票，已开票的订单不会再出现这个按钮。
 *
 * 2026-10-24 新增「合并开票」：站长要求可以把多笔充值合成一张发票，金额自动相加。
 * 兼容方式：新增可选 prop `bills`。不传 = 完全走原来的单笔逻辑（价格页/充值商城
 * 的调用处一行都不用改），传了且多于 1 笔 = 合并模式。
 */

export type InvoiceBill = {
  bill_id: string
  pay: number
  generate_time?: string
  function_name?: string
}

/** 提交结果回传：页面据此决定是否刷新、是否退出选择态、是否做合并结果自检 */
export type InvoiceSubmittedInfo = {
  billIds: string[]
  /** 是否合并提交（多笔） */
  merged: boolean
  /** 后端是否确认成功（业务失败时是 false，弹窗会留在原地让用户改完重试） */
  success: boolean
}

type Props = {
  open: boolean
  /** 单笔：要开票的那笔充值 */
  bill: InvoiceBill | null
  /**
   * 合并开票：参与合并的充值列表（可选）
   * 不传时按 `bill` 单笔走，保持向后兼容。
   */
  bills?: InvoiceBill[] | null
  /** 默认带上账号邮箱，用户可改 */
  defaultEmail?: string
  onClose: () => void
  onSubmitted?: (info?: InvoiceSubmittedInfo) => void
}

/** 明细里只要日期（订单号 + 金额 + 日期三列，带时分反而挤） */
function formatBillDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function InvoiceApplyModal({ open, bill, bills, defaultEmail, onClose, onSubmitted }: Props) {
  const { token, user_info, setLoginModal } = userStore()
  const [form] = Form.useForm()
  const [titleType, setTitleType] = useState<InvoiceTitleType>('company')
  const [submitting, setSubmitting] = useState(false)

  /**
   * 实际要开票的订单列表（单笔和合并统一成数组处理，下面的逻辑只写一遍）
   * 顺手按订单号去重：同一笔传两次会让后端在同一订单上开两张票。
   */
  const targets = useMemo(() => {
    const source = bills && bills.length ? bills : bill ? [bill] : []
    const seen = new Set<string>()
    return source.filter((item) => {
      const id = String(item?.bill_id ?? '')
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [bills, bill])

  const merged = targets.length > 1
  /** 合计金额：用 sumCny（按分计算）避免 199.3 + 199.7 = 399.00000000000006 */
  const total = useMemo(() => sumCny(targets.map((item) => item.pay)), [targets])

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ title_type: 'company', email: defaultEmail || '' })
    setTitleType('company')
  }, [open, defaultEmail, form])

  const submit = async () => {
    if (!targets.length) return
    // 没登录就别提交：后端中间件对「无 token 且无 referer」的请求会回一个
    // {"code":0} 的空壳，前端会误报「提交成功」，实际什么都没写进库。
    if (!token) {
      onClose()
      setLoginModal(true)
      return
    }
    const billIds = targets.map((item) => String(item.bill_id))
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const result = await submitInvoiceApplication({
        // 合并时用英文逗号拼接：老后端只认单笔字符串，至少能解析出第一笔，
        // 不会因为字段类型从 string 变 array 而把整条请求判为非法。
        bill_id: billIds.join(','),
        // 新字段：新后端读它来判断"要合并哪几笔"。两个都传的原因见 request/invoice.ts。
        bill_ids: merged ? billIds : undefined,
        // amount / order_no 只为兼容旧后端，金额以后端按订单核验为准。
        // 单笔时仍用原始 pay（与改动前完全一致），只有合并才用按分求和的结果。
        amount: merged ? total : Number(bill?.pay ?? targets[0]?.pay ?? 0),
        // 单笔时 order_no 就是那一笔的订单号，和改动前一模一样
        order_no: merged ? billIds.join(',') : billIds[0],
        title_type: values.title_type,
        title: String(values.title || '').trim(),
        tax_no: values.title_type === 'company' ? String(values.tax_no || '').trim() : undefined,
        email: String(values.email || '').trim(),
        remark: values.remark ? String(values.remark).trim() : undefined,
        userId: (user_info as any)?.data?.bodyMessage?.userId ?? (user_info as any)?.userId,
        userName: (user_info as any)?.data?.bodyMessage?.userName ?? (user_info as any)?.userName
      })
      if (result.channel === 'failed') {
        message.error('提交失败：网络异常，请稍后重试')
        return
      }
      if (result.channel === 'unavailable') {
        // 请求没拿到任何可识别的业务码（网络中断、网关 5xx 等）。
        // 不写留言墙（含税号/邮箱，公开可见），提示重试即可。
        message.error('提交失败：网络异常，请稍后重试')
        return
      }
      if (result.channel === 'business') {
        // 后端明确拒绝：原样展示后端原因（如「该订单已开过发票」），
        // 并刷新列表让按钮状态跟上，否则用户会一直点那笔订单的「开发票」。
        const reason = result.codeMsg || '提交被拒绝，请核对订单信息'
        if (merged) {
          // 合并开票是新功能，后端很可能还没实现。把所有可能原因一次说清楚，
          // 别让用户反复点「提交」却只看到一句含糊的失败。
          message.error({
            content: `${reason}。如果反复失败，说明后端暂不支持合并开票，请把这几笔订单号发给站长手动处理，或改成一笔一笔单独开票。`,
            duration: 8
          })
        } else {
          message.error(reason)
        }
        // success=false：页面只刷新列表，不退出选择态，方便用户改完直接重试
        onSubmitted?.({ billIds, merged, success: false })
        return
      }
      // 走到这里就是后端返回 code=0，申请已经落库、后台待审核列表里能看到。
      message.success(
        merged
          ? `已提交 ${billIds.length} 笔合并开票申请，合计 ${formatCny(total)}，请等待站长审核`
          : result.codeMsg || '申请已提交成功，请等待站长审核，通过后电子发票会发送到你的邮箱'
      )
      onSubmitted?.({ billIds, merged, success: true })
      onClose()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error('提交失败：开票服务暂时不可用，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={merged ? `合并申请电子普通发票（${targets.length} 笔）` : '申请电子普通发票'}
      onCancel={onClose}
      width={merged ? 520 : 480}
      centered
      bodyStyle={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}
      okText="提交申请"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={() => void submit()}
      destroyOnClose
    >
      {merged ? (
        <>
          <div className={styles.billCard}>
            <IconBadge icon={<FileTextOutlined />} tone="amber" size="md" />
            <div className={styles.billInfo}>
              <span>本张发票合并 {targets.length} 笔充值</span>
              <strong className={styles.amount}>{formatCny(total)}</strong>
              <span className={styles.orderNo}>合计金额已自动相加</span>
            </div>
          </div>

          {/* 明细：让用户提交前能自己核对订单号和金额，避免开错票 */}
          <ul className={styles.mergeList}>
            {targets.map((item, index) => (
              <li key={item.bill_id}>
                <span className={styles.mergeIndex}>{index + 1}</span>
                <span className={styles.mergeOrder}>{item.bill_id}</span>
                <time className={styles.mergeDate}>{formatBillDate(item.generate_time)}</time>
                <b className={styles.mergeAmount}>{formatCny(item.pay)}</b>
              </li>
            ))}
          </ul>

          <p className={styles.hint}>
            以上 {targets.length} 笔会开在同一张发票上，合计 {formatCny(total)}；已开票的订单已自动排除在外。
          </p>
        </>
      ) : (
        <>
          <div className={styles.billCard}>
            <IconBadge icon={<FileTextOutlined />} tone="amber" size="md" />
            <div className={styles.billInfo}>
              <span>本笔充值</span>
              <strong className={styles.amount}>{formatCny(bill?.pay)}</strong>
              <span className={styles.orderNo}>订单号 {bill?.bill_id || ''}</span>
            </div>
          </div>

          <p className={styles.hint}>一单一票：只对这一笔充值开票，已开票的订单不能重复申请。</p>
        </>
      )}

      <Form form={form} layout="vertical" requiredMark="optional" initialValues={{ title_type: 'company' }}>
        <Form.Item name="title_type" label="抬头类型" rules={[{ required: true }]}>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            onChange={(event) => setTitleType(event.target.value)}
          >
            <Radio.Button value="company">企业</Radio.Button>
            <Radio.Button value="personal">个人</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="title"
          label={titleType === 'company' ? '公司名称' : '个人姓名'}
          rules={[{ required: true, message: '请填写发票抬头' }]}
        >
          <Input maxLength={60} placeholder={titleType === 'company' ? '营业执照上的全称' : '与身份证一致'} />
        </Form.Item>

        {titleType === 'company' ? (
          <Form.Item
            name="tax_no"
            label="纳税人识别号"
            rules={[{ required: true, message: '企业抬头必须填税号' }]}
          >
            <Input maxLength={30} placeholder="15 / 18 / 20 位，字母数字" />
          </Form.Item>
        ) : null}

        <Form.Item
          name="email"
          label="接收邮箱"
          rules={[
            { required: true, message: '请填写接收电子发票的邮箱' },
            { type: 'email', message: '邮箱格式不对' }
          ]}
        >
          <Input maxLength={80} placeholder="发票 PDF 会发到这里" />
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <Input.TextArea maxLength={200} rows={2} placeholder="比如：抬头和上次一样" />
        </Form.Item>
      </Form>

      <p className={styles.footHint}>
        审核通过后 1–3 个工作日开出；已开票的订单在「开票中心」里能看到发票号。
      </p>
    </Modal>
  )
}

export default InvoiceApplyModal
