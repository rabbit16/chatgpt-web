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
        {/* 统一栅格容器：P5 要求所有页内容从同一条左边界开始。
            原来这里的 .wrap 样式写了却没人用（死代码），导致发票页仍撑满
            1349px、H1 落在 x=40，与其它页 x≈125 对不齐（验收阻塞项 2）。 */}
        <div className={styles.wrap}>
          <InvoicePanel />
        </div>
      </Layout>
    </div>
  )
}

export default InvoicePage
