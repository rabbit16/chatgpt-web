import { useEffect, useState } from 'react'
import { Form, Input, Modal, Radio, message } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import IconBadge from '@/components/IconBadge'
import { createInvoice, type InvoiceTitleType } from '@/request/invoice'
import { normalizePayload } from '@/utils/payment'
import styles from './index.module.less'

/**
 * 发票申请弹窗（按订单开）
 * ------------------------------------------------------------
 * 从「支付记录」里某一笔充值点「开发票」打开，金额和订单号来自这条记录，
 * 用户只填抬头、税号、邮箱。一单一票，已开票的订单不会再出现这个按钮。
 */

export type InvoiceBill = {
  bill_id: string
  pay: number
  generate_time?: string
  function_name?: string
}

type Props = {
  open: boolean
  bill: InvoiceBill | null
  /** 默认带上账号邮箱，用户可改 */
  defaultEmail?: string
  onClose: () => void
  onSubmitted?: () => void
}

function InvoiceApplyModal({ open, bill, defaultEmail, onClose, onSubmitted }: Props) {
  const [form] = Form.useForm()
  const [titleType, setTitleType] = useState<InvoiceTitleType>('company')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue({ title_type: 'company', email: defaultEmail || '' })
    setTitleType('company')
  }, [open, defaultEmail, form])

  const submit = async () => {
    if (!bill) return
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const res: any = await createInvoice({
        bill_id: String(bill.bill_id),
        // amount / order_no 只为兼容旧后端，金额以后端按订单核验为准
        amount: Number(bill.pay),
        order_no: String(bill.bill_id),
        title_type: values.title_type,
        title: String(values.title || '').trim(),
        tax_no: values.title_type === 'company' ? String(values.tax_no || '').trim() : undefined,
        email: String(values.email || '').trim(),
        remark: values.remark ? String(values.remark).trim() : undefined
      })
      const data = normalizePayload<any>(res)
      if (String(data.code ?? '') !== '0') {
        message.error(data.codeMsg || '提交失败，请稍后再试')
        return
      }
      message.success('已提交，审核通过后电子发票会发到邮箱')
      onSubmitted?.()
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
      title="申请电子普通发票"
      onCancel={onClose}
      width={480}
      centered
      bodyStyle={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}
      okText="提交申请"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={() => void submit()}
      destroyOnClose
    >
      <div className={styles.billCard}>
        <IconBadge icon={<FileTextOutlined />} tone="amber" size="md" />
        <div className={styles.billInfo}>
          <span>本笔充值</span>
          <strong className={styles.amount}>¥{Number(bill?.pay || 0).toFixed(2)}</strong>
          <span className={styles.orderNo}>订单号 {bill?.bill_id || ''}</span>
        </div>
      </div>

      <p className={styles.hint}>一单一票：只对这一笔充值开票，已开票的订单不能重复申请。</p>

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
        审核通过后 1–3 个工作日开出；已开票的订单在「我的发票」里能看到发票号。
      </p>
    </Modal>
  )
}

export default InvoiceApplyModal
