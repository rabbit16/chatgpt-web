import { useEffect, useState } from 'react'
import UserInfoCard from '@/components/UserInfoCard'
import styles from './index.module.less'
import Layout from '@/components/Layout'
import { configStore, shopStore, userStore } from '@/store'
import {Image,Spin, Button, Input, Modal, Pagination, QRCode, Radio, Space, Table, message } from 'antd'
import GoodsList from '@/components/GoodsList'
import { CloseCircleFilled, SyncOutlined } from '@ant-design/icons'
import { shopAsync, userAsync } from '@/store/async'
import { getUserTurnover, postPayPrecreate, postUseCarmi,userBillList,userBillInfo } from '@/request/api'
import { ProductInfo, TurnoverInfo } from '@/types'
import OpenAiLogo from '@/components/OpenAiLogo'
import { Link } from 'react-router-dom'
import {getAliPayPage,payVerify}from '../../request/api'

function GoodsPay() {
  const { token, user_info } = userStore();
  const [billList,setBillList] = useState([]);
  const [tableObj,setTableObj] = useState({
    current:1,
    pageSize:5,
  })
  const [num4,set4Num] = useState(0)
  const [moneyObj,setMoneyObj] = useState({loading:false,visiblePop:false,url:'',code_num:'',request_id:'',})
  const [askNum,setAskNum]=useState(0);
  const [listTotal,setListTotal] = useState(0);
  const [updata,setUpdata] = useState({});
  const getPostMoney=(value:number)=>{
    const params = {
      money:value,
      userId:user_info?.data?.bodyMessage?.userId,
      function_code:'chatGpt'
    }
    setMoneyObj((e:any)=>({...e,visiblePop:true,loading:true}))
    getAliPayPage(params).then((res)=>{
      console.log(res);
     
      const data = res.data?.payUrl||{};
      const {code_num,request_id,data:{QRcode_url}} = data;
      setMoneyObj({visiblePop:true,url:QRcode_url,code_num,request_id,loading:false})
      // setMoneyObj((e:any)=>({...e,url:}));
    })
  }
  const handleOk =async()=>{
    const res = await payVerify({codeNum:moneyObj.code_num});
    console.log(res);
    if(res?.data?.code==='0'){
      message.success('支付成功');
      setMoneyObj((e:any)=>({...e,visiblePop:false}))
    }
    
  }
  const handleCancel=()=>{
    setMoneyObj({loading:false,visiblePop:false,url:'',code_num:'',request_id:'',})
  }
  const renderMoneyList=()=>{
    const moneyInfoList =[
      {day:30,money:15,level:'普通会员',Describe:"享受\n1.gpt3.5每天30次 \n2.gpt4 每3天10次plus会员",bigMoney:20},
      {day:30,money:35,level:'plus会员',Describe:"享受\n1.gpt3.5免费畅用 \n2.gpt4.0 每天15次",bigMoney:50},
      {day:30,money:5,level:'按次购买',Describe:"20次gpt3.5对话",bigMoney:10},
      {day:30,money:10,level:'按次购买',Describe:"12次gpt4.0对话",bigMoney:15}]
    return moneyInfoList.map((value:any)=>{
      return (
      
        <div className={styles.item} onClick={()=>{getPostMoney(value.money)}}>
          <span className={styles.level}>{value.level}</span>
          <div className={styles.days}>
            {value.day}天
          </div>
          <div className={styles.money_box}>
            {value.money}元<span className={styles.old_money}>{value.bigMoney}元</span>
          </div>
          <span className={styles.describe}>
            {value.Describe}
          </span>
        </div>
     
      )
    })
  }
  useEffect(()=>{
    userBillInfo({userId:user_info?.data?.bodyMessage?.userId}).then((res)=>{
      console.log(res);
      if(res.code===0){
        console.log(res);
        setAskNum(res.data.userMessage.token)
        set4Num(res.data.userMessage.plus_user_count)
      }
    })
  },[updata])
  useEffect(() => {
    async function fetchUserBillList() {
      const params = {
        page:tableObj.current,
        userId:Number(user_info?.data?.bodyMessage?.userId),
        page_num:tableObj.pageSize
      }
      let res = await userBillList(params);
      console.log(res);
      
      if(res?.code === 0){
        setBillList(res.data.user_bill_list)
        setListTotal(res.data.totalNum)
      }
    }
    fetchUserBillList()
  }, [tableObj,updata])




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
        <Modal title="微信支付" open={moneyObj.visiblePop} onOk={handleOk} onCancel={handleCancel}>

        <div style={{display:'flex',justifyContent:'center'}}>
        <Spin spinning={moneyObj.loading}>
        <Image
        preview={false}
          width={200}
          height={200}
          src={moneyObj.url}
          fallback="data:image/png;base64,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"
        />

        </Spin>
        </div>
        <div>若支付出现问题请请联系客服:</div>
          <a href="tel:17511684584">17511684584</a>
        </Modal>
        <div className={styles.goodsPay_container}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {/* 用户信息 */}
            <UserInfoCard info={user_info} data={{num4:num4,num:askNum,avatar:user_info?.data?.bodyMessage?.userName.slice(0,1)}} />
            {/* 卡密充值区 */}
            <div className={styles.goodsPay_card}>
              <h4>会员选项</h4>
              <div className={styles.goodsPay_card_item_box}>
             {renderMoneyList()}
             </div>
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
