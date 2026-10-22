import { useEffect, useState } from 'react'
import { Alert, Button, Form, InputNumber, message } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { getGlobalPricing, updateGlobalPricing, type GlobalPricing } from '@/request/api'
import styles from './index.module.less'

function AdminPricing() {
  const [form] = Form.useForm<GlobalPricing>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState<GlobalPricing | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getGlobalPricing()
      form.setFieldsValue(data)
      setCurrent(data)
    } catch (err) {
      setCurrent(null)
      setError(err instanceof Error ? err.message : '读取费率失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async (values: GlobalPricing) => {
    setSaving(true)
    setError('')
    try {
      await updateGlobalPricing(values)
      const actual = await getGlobalPricing()
      form.setFieldsValue(actual)
      setCurrent(actual)
      message.success('费率已更新')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新费率失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>全局费率</h1>
          <p>未单独设置的供应商沿用这里。某个供应商要不同加价，去「供应商」里填它自己的加价系数。</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} disabled={saving}>
          重新读取
        </Button>
      </header>

      {error && <Alert showIcon type="error" message={error} className={styles.alert} />}
      <Alert
        showIcon
        type="warning"
        className={styles.alert}
        message="影响后续计费"
        description="扣费：上游美元成本 × 汇率 × 加价系数 × 用户倍率 × 用户折扣。前台价目展示为应付美元价（不含汇率）。已产生的账单不会重算。供应商 base_url 请到「供应商」栏目管理。"
      />

      <Form form={form} layout="vertical" onFinish={save} className={styles.form}>
        <Form.Item
          name="usd_cny_rate"
          label="美元兑人民币汇率"
          extra="用于服务端扣费入账换算人民币；前台价目页直接展示美元，不依赖此汇率反推。"
          rules={[{ required: true, type: 'number', min: 0.000001, max: 100, message: '请输入大于 0 且不超过 100 的汇率' }]}
        >
          <InputNumber min={0.000001} max={100} step={0.01} precision={6} disabled={!current || loading || saving} />
        </Form.Item>
        <Form.Item
          name="profit_multiplier"
          label="成本加价系数"
          extra="例如 1.5 表示在上游美元成本价基础上加价 50%，再乘用户个人倍率和折扣后得到用户应付美元价。"
          rules={[{ required: true, type: 'number', min: 0.000001, max: 100, message: '请输入大于 0 且不超过 100 的加价系数' }]}
        >
          <InputNumber min={0.000001} max={100} step={0.1} precision={6} disabled={!current || loading || saving} />
        </Form.Item>
        <div className={styles.actions}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={!current || loading}>
            保存费率
          </Button>
        </div>
      </Form>
    </div>
  )
}

export default AdminPricing
