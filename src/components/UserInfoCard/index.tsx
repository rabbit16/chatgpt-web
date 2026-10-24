import { UserInfo } from '@/types'
import styles from './index.module.less'
import { Avatar } from 'antd'
import { formatCny } from '@/utils/money'

function UserInfoCard(props: { info?: UserInfo,  children?: React.ReactNode;data?:{num4:number,num:number,avatar:string} }) {

  return (
    <div className={styles.userInfo}>
      <div className={styles.userInfo_card}>
        <div className={styles.userInfo_avatar}>
        <Avatar style={{ backgroundColor: 'red', verticalAlign: 'middle' }} size="large" >
        {props.data?.avatar}
      </Avatar>
        </div>
        {/* 余额区块（2026-10-24 视觉验收 P3/P6）：
            原来两个 antd Statistic 并排、中间空 100px，且余额不带 ¥ 符号、
            小数位和顶栏那条不一致（顶栏 ¥128.18 vs 这里 128.209）。
            现在统一用 formatCny，并把余额做成这一屏最大的数字。 */}
        <div className={styles.userInfo_vip}>
          <div className={styles.userInfo_balance}>
            <span className={styles.userInfo_balance__label}>当前余额</span>
            <b className={styles.userInfo_balance__value}>{formatCny(props.data?.num)}</b>
          </div>
          <div className={styles.userInfo_discount}>
            <span>今日 Token 折扣</span>
            <b>{props.data?.num4 ?? '-'}</b>
          </div>
        </div>
      </div>
      {props.children}
    </div>
  )
}

export default UserInfoCard
