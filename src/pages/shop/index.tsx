import { useEffect, useState } from 'react'
import UserInfoCard from '@/components/UserInfoCard'
import styles from './index.module.less'
import Layout from '@/components/Layout'
import { configStore, shopStore, userStore } from '@/store'
import { Button, Input, Modal, Pagination, QRCode, Radio, Space, Table, message } from 'antd'
import GoodsList from '@/components/GoodsList'
import { CloseCircleFilled, SyncOutlined } from '@ant-design/icons'
import { shopAsync, userAsync } from '@/store/async'
import { getUserTurnover, postPayPrecreate, postUseCarmi } from '@/request/api'
import { ProductInfo, TurnoverInfo } from '@/types'
import OpenAiLogo from '@/components/OpenAiLogo'
import { Link } from 'react-router-dom'
import {getAliPayPage}from '../../request/api'

function GoodsPay() {
  const { token, user_info } = userStore();
  const [payAmount,setPayAmount] = useState(10);

  const payInfo: {
    [key: string]: {
      icon: string
      message: string
      color: string
    }
  } = {
    wxpay: {
      icon: 'https://u1.dl0.cn/icon/wxpay_icon.png',
      message: '请使用微信扫码支付',
      color: '#24aa39'
    },
    alipay: {
      icon: 'https://u1.dl0.cn/icon/alipay_icon.png',
      message: '请使用支付宝扫码支付',
      color: '#1678ff'
    },
    qqpay: {
      icon: 'https://u1.dl0.cn/icon/qqpay_icon.png',
      message: '请使用QQ扫码支付',
      color: '#10b8f6'
    }
  }

  const [turnover, setTurnover] = useState<{
    page: number
    pageSize: number
    loading: boolean
    rows: Array<TurnoverInfo>
    count: number
  }>({
    page: 1,
    pageSize: 10,
    loading: false,
    rows: [],
    count: 1
  })

  const [payModal, setPayModal] = useState<{
    open: boolean
    status: 'loading' | 'fail' | 'pay'
    order_id?: string
    pay_url?: string
    pay_key?: string
  }>({
    open: false,
    status: 'pay',
    order_id: '',
    pay_url: 'sdsgsdgsdg'
  })

  useEffect(() => {
    // shopAsync.fetchProduct()
    // onTurnoverLog(turnover.page, turnover.pageSize)
  }, [])

  function onTurnoverLog(page: number, pageSize: number) {
    setTurnover((l) => ({ ...l, page, pageSize, loading: true }))
    getUserTurnover({
      page: page,
      page_size: pageSize
    })
      .then((res) => {
        if (res.code) return
        setTurnover((l) => ({ ...l, page, ...res.data, loading: false }))
      })
      .finally(() => {
        setTurnover((l) => ({ ...l, page, loading: false }))
      })
  }

  async function onPay(item: ProductInfo, pay_type: string) {
    setPayModal((p) => ({ ...p, open: true }))
    const payres = await postPayPrecreate({
      pay_type,
      product_id: item.id,
      quantity: 1
    })
    if (payres.code) {
      setPayModal((p) => ({ ...p, status: 'fail' }))
      return
    }
    setPayModal((p) => ({ ...p, status: 'pay', ...payres.data }))
  }


  const [carmiLoading, setCarmiLoading] = useState(false)
  const getPostMoney=()=>{
    const params = {
      money:payAmount,
      userId:user_info?.data?.bodyMessage?.userId,
      function_code:'chatGpt'
    }
    getAliPayPage(params).then((res)=>{
      const data = res.data?.payUrl;
      console.log(res,data);
      
      window.open(data,'_self')
    })
  }


  if (!token) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <OpenAiLogo rotate width="3em" height="3em" />
      </div>
    )
  }

  return (
    <div className={styles.goodsPay}>
      <Layout>
        <div className={styles.goodsPay_container}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {/* 用户信息 */}
            <UserInfoCard info={user_info} />
            {/* 卡密充值区 */}
            <div className={styles.goodsPay_card}>
              <h4>卡密充值</h4>
              <Input.Search
                loading={carmiLoading}
                placeholder="请输入充值金额"
                allowClear
                enterButton="充值"
                size="large"
                bordered
                onChange={(e:any)=>{
                  console.log(e);
                  
                }}
                value={payAmount}
                onSearch={getPostMoney}
              />
            </div>
            {/* <div className={styles.goodsPay_card}>
              <h4
                onClick={() => {
                  onTurnoverLog(1, turnover.pageSize)
                }}
              >
                订单记录 <SyncOutlined spin={turnover.loading} />
              </h4>
              <Table<TurnoverInfo>
                scroll={{
                  x: 800
                }}
                bordered
                loading={turnover.loading}
                dataSource={turnover.rows}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '描述',
                    dataIndex: 'describe',
                    key: 'describe'
                  },
                  {
                    title: '额度',
                    key: 'value',
                    render: (data) => {
                      return <a key={data.value}>{data.value}</a>
                    }
                  },
                  {
                    title: '日期',
                    dataIndex: 'create_time',
                    key: 'create_time'
                  }
                ]}
              />
              <div className={styles.goodsPay_pagination}>
                <Pagination
                  size="small"
                  current={turnover.page}
                  defaultCurrent={turnover.page}
                  defaultPageSize={turnover.pageSize}
                  total={turnover.count}
                  onChange={(current, pageSize) => {
                    onTurnoverLog(current, pageSize)
                  }}
                  hideOnSinglePage
                />
              </div>
            </div> */}
          </Space>
        </div>
      </Layout>
    </div>
  )
}

export default GoodsPay
