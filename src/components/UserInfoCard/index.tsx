import { UserInfo } from '@/types'
import styles from './index.module.less'
import { Space, Statistic, Tooltip,Avatar } from 'antd'
import { useMemo } from 'react'

function UserInfoCard(props: { info?: UserInfo,  children?: React.ReactNode;data?:{num4:number,num:number,avatar:string} }) {

  return (
    <div className={styles.userInfo}>
      <div className={styles.userInfo_card}>
        <div className={styles.userInfo_avatar}>
        <Avatar style={{ backgroundColor: 'red', verticalAlign: 'middle' }} size="large" >
        {props.data?.avatar}
      </Avatar>
        </div>
        <div className={styles.userInfo_vip}>
          <Space wrap size="large">
            <Statistic title="当前余额" value={props.data?.num} />
            <Statistic title="今日token计算折扣" value={props.data?.num4} />
            {/* <Statistic title="累计充值" value={props.data?.num4} /> */}
          </Space>
        </div>
      </div>
      {props.children}
    </div>
  )
}

export default UserInfoCard
