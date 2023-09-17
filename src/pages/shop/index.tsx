import { useEffect, useState } from 'react'
import UserInfoCard from '@/components/UserInfoCard'
import styles from './index.module.less'
import Layout from '@/components/Layout'
import { configStore, shopStore, userStore } from '@/store'
import { Button, Input, Modal, Pagination, QRCode, Radio, Space, Table, message } from 'antd'
import GoodsList from '@/components/GoodsList'
import { CloseCircleFilled, SyncOutlined } from '@ant-design/icons'
import { shopAsync, userAsync } from '@/store/async'
import { getUserTurnover, postPayPrecreate, postUseCarmi,userBillList,userBillInfo } from '@/request/api'
import { ProductInfo, TurnoverInfo } from '@/types'
import OpenAiLogo from '@/components/OpenAiLogo'
import { Link } from 'react-router-dom'
import {getAliPayPage}from '../../request/api'

function GoodsPay() {
  const { token, user_info } = userStore();
  const [payAmount,setPayAmount] = useState(10);
  const [billList,setBillList] = useState([]);
  const [tableObj,setTableObj] = useState({
    current:1,
    pageSize:5,
  })
  const [askNum,setAskNum]=useState(0);
  const [listTotal,setListTotal] = useState(0);
  const getPostMoney=()=>{
    const params = {
      money:payAmount,
      userId:user_info?.data?.bodyMessage?.userId,
      function_code:'chatGpt'
    }
    getAliPayPage(params).then((res)=>{
      const data = res.data?.payUrl;
      window.open(data,'_self')
    })
  }
  useEffect(()=>{
    userBillInfo({userId:user_info?.data?.bodyMessage?.userId}).then((res)=>{
      if(res.code===0){

      }
    })
  },[])
  useEffect(() => {
    async function fetchUserBillList() {
      const params = {
        page:tableObj.current,
        userId:Number(user_info?.data?.bodyMessage?.userId),
        page_num:tableObj.pageSize
      }
      let res = await userBillList(params);
      if(res?.code === 0){
        setBillList(res.data.user_bill_list)
        setListTotal(res.data.totalNum)
      }
    }
    fetchUserBillList()
  }, [tableObj])




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
            <UserInfoCard info={user_info} data={{num:listTotal,avatar:user_info?.data?.bodyMessage?.userName.slice(0,1)}} />
            {/* 卡密充值区 */}
            <div className={styles.goodsPay_card}>
              <h4>卡密充值</h4>
              <Input.Search
                loading={false}
                placeholder="请输入充值金额"
                allowClear
                enterButton="充值"
                size="large"
                bordered
                onChange={(e:any)=>{
                  let data = e.target.value;
                  data = data.match(/[0-9]*/g);
                  data = data.join().length!==0?Number(data.join('')):''
                  setPayAmount(data)
                }}
                value={payAmount}
                onSearch={getPostMoney}
              />
            </div>
            <div className={styles.goodsPay_card}>
              <h4
                onClick={() => {
                  // onTurnoverLog(1, turnover.pageSize)
                }}
              >
                订单记录 <SyncOutlined spin={false} />
              </h4>
              <Table
                scroll={{
                  x: 800
                }}
                bordered
                loading={false}
                dataSource={billList}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '单号',
                    dataIndex: 'bill_id',
                    key: 'bill_id'
                  },
                  {
                    title: '模型',
                    key: 'function_name',
                    dataIndex:'function_name'
                  },
                  {
                    title: '日期',
                    dataIndex: 'generate_time',
                    key: 'generate_time'
                  },{
                    title:'金额',
                    dataIndex:'pay',
                    key:'pay'
                  }
                ]}
              />
              <div className={styles.goodsPay_pagination}>
                <Pagination
                  size="small"
                  current={tableObj.current}
                  pageSize={tableObj.pageSize}
                  total={listTotal}
                  onChange={(current, pageSize) => {
                    console.log(current, pageSize);
                    setTableObj({current,pageSize})
                  }}
                />
              </div>
            </div>
          </Space>
        </div>
      </Layout>
    </div>
  )
}

export default GoodsPay
