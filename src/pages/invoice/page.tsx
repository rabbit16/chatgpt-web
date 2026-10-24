import InvoicePanel from '@/pages/invoice'
import Layout from '@/components/Layout'
import styles from './index.module.less'

/**
 * 开票中心（独立页面，2026-10-24）
 * ------------------------------------------------------------
 * 站长要求：开票要独立成栏目，不能藏在「充值商城 › 我的发票」页签里。
 * 页面本体复用 InvoicePanel（同一份逻辑，价格页第三个页签仍可用，老链接不断）。
 */
function InvoicePage() {
  return (
    <div className={styles.page}>
      <Layout>
        <InvoicePanel />
      </Layout>
    </div>
  )
}

export default InvoicePage
