import { ReactNode, useState } from 'react'
import styles from './index.module.less'

type Props = {
  /** 软件封面地址（后端 cover_url，当前线上是 data:image/...;base64 内联图） */
  src?: string
  /** 没有封面 / 封面加载失败时显示的兜底图标 */
  fallback: ReactNode
  /** 尺寸与 IconBadge 对齐：md=36（列表行）、lg=44（详情页头） */
  size?: 'md' | 'lg'
}

/**
 * 软件封面（2026-10-25 站长要求）
 * ------------------------------------------------------------
 * 站长原话：「红框里这个可以直接上传，把它变成封面吗？就是我们在上传的时候，
 * 其实选择了封面的。如果有封面的话，就把它在这显现出来。」
 *
 * 背景：后端 /user/software/list 的 cover_url 一直是**有值的**
 * （线上实测 4 条全是 data:image/jpeg;base64,...），
 * 只是前端一直在用硬编码的平台图标（IconBadge + PLATFORM_ICON / InboxOutlined），
 * 把这份数据完全忽略了。所以这里不是「新增能力」，是**把已经存在的数据显示出来**。
 *
 * 为什么不直接塞进 IconBadge：
 *   IconBadge 是「柔和底色 + 同色系图标」的图标容器，内容是 ReactNode 图标；
 *   图片需要 object-fit / lazy / onError 这套图片专属行为，
 *   硬塞会让那个全站统一的组件变成万能容器，职责就糊了。
 *   但**尺寸与圆角刻意和 IconBadge 完全对齐**（md=36/12px、lg=44/16px），
 *   这样有没有封面的行放在一起，左边一列仍然是对齐的。
 *
 * 三条容错（站长特别要求）：
 *   1. 坏图兜底：onError 时把 failed 置 true，回退成原来的图标，绝不显示破图标；
 *   2. object-fit: cover：封面比例与容器不一致时裁切而不是拉扁变形；
 *   3. loading="lazy"：列表一屏多行时，屏幕外的图先不下载，省流量。
 * 另外容器底色用 --surface-sunken，图片解码完成前不会闪白块（深色模式尤其明显）。
 */
function CoverBadge({ src, fallback, size = 'md' }: Props) {
  const [failed, setFailed] = useState(false)
  const url = (src || '').trim()

  // 没封面，或者这张封面加载失败 → 一律回到图标，界面永远有东西可看
  if (!url || failed) {
    return <span className={[styles.wrap, styles[size], styles.fallback].join(' ')}>{fallback}</span>
  }

  return (
    <span className={[styles.wrap, styles[size]].join(' ')}>
      <img
        className={styles.img}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </span>
  )
}

export default CoverBadge
