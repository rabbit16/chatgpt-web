import React from 'react'
import rabbitLogo from '@/assets/brand/rabbitj-a2.svg'
import rabbitLoading from '@/assets/brand/rabbitj-a2-loading.svg'
import styles from './index.module.less'

/**
 * 首屏加载骨架（2026-10-24 视觉验收第 1 条）
 * ------------------------------------------------------------
 * 原来是「全屏居中一个旋转 logo」：弱网或冷启动时用户只看到一片白，
 * 3 秒还在等就会以为站点挂了直接关掉。
 * 现在给出一块「看得懂正在发生什么」的骨架：品牌 + 一句说明 + 三张占位卡，
 * 形状和真实页面接近，加载完不会突然跳版。
 */
function AppLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite" aria-label="页面加载中">
      <div className={styles.loadingBrand}>
        <picture><source media="(prefers-reduced-motion: reduce)" srcSet={rabbitLogo} /><img src={rabbitLoading} width={36} height={36} alt="" /></picture>
        <span className={styles.loadingText}>正在加载…</span>
      </div>

      <div className={styles.loadingCards}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.loadingCard}>
            <div className={styles.loadingLine} style={{ width: '42%' }} />
            <div className={styles.loadingLine} style={{ width: '72%', height: 20 }} />
            <div className={styles.loadingLine} style={{ width: '56%' }} />
          </div>
        ))}
      </div>


    </div>
  )
}

export default AppLoading
