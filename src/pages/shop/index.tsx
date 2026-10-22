import { useEffect, useMemo, useState } from 'react'
import UserInfoCard from '@/components/UserInfoCard'
import styles from './index.module.less'
import Layout from '@/components/Layout'
import { userStore, paymentStore } from '@/store'
import {Image,Spin, Button, InputNumber, Modal, Pagination, Space, Table, message } from 'antd'
import { SyncOutlined } from '@ant-design/icons'
import {
  userBillList,
  userBillInfo,
  getUserPricing,
  createXuHuPayOrder,
  queryXuHuPayOrder,
  type UserModelRate
} from '@/request/api'
import OpenAiLogo from '@/components/OpenAiLogo'
import { useNavigate } from 'react-router-dom'
import {getAliPayPage,payVerify}from '../../request/api'
import { clearPendingOrder, readPendingOrder, savePendingOrder } from '@/utils/payment'
import {
  PROVIDER_META,
  enrichVendorModel,
  formatUsd,
  pickFeaturedModelIds
} from '@/data/modelPricing'

type FeaturedCard = {
  id: string
  name: string
  provider: keyof typeof PROVIDER_META
  inputUsd: number
  outputUsd: number
  cachedInputUsd: number
  intro?: string
}

const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || ''

function GoodsPay() {
  const navigate = useNavigate()
  const { token, user_info, llm_api_key } = userStore();
  const phone =
    (user_info as any)?.data?.bodyMessage?.telephone ||
    (user_info as any)?.telephone ||
    ''
  const credential =
    (llm_api_key || '').startsWith('sk-') || /^1[3-9]\d{9}$/.test(llm_api_key || '')
      ? llm_api_key
      : phone
  const [featuredPrices, setFeaturedPrices] = useState<FeaturedCard[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(false)
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
  const [customAmount, setCustomAmount] = useState<number | null>(null)
  const paymentChannel = paymentStore((state) => state.channel)
  const [payOrder, setPayOrder] = useState<{ outTradeNo: string; payType: string } | null>(null)
  const getPostMoney=(value:number)=>{
    if (!Number.isInteger(value) || value <= 0) {
      message.warning('充值金额必须是大于 0 的整数')
      return
    }
    const userId = user_info?.data?.bodyMessage?.userId
    setMoneyObj((e:any)=>({...e,visiblePop:true,loading:true,url:''}))
    if (paymentChannel === 'xunhupay') {
      createXuHuPayOrder({
        userId,
        money: value,
        function_code: 'chatGpt',
        pay_type: 'auto'
      }).then((res:any) => {
        const data = res.data || {}
        if (String(data.code) !== '0') {
          message.error(data.codeMsg || '下单失败，请稍后重试')
          setMoneyObj((e:any) => ({ ...e, loading: false }))
          return
        }
        if (data.payType === 'h5') {
          // 手机端直接跳转，订单号先落盘，回来后查单确认。
          savePendingOrder({
            outTradeNo: data.outTradeNo,
            channel: 'xunhupay',
            money: value,
            createdAt: Date.now()
          })
          setMoneyObj((e:any) => ({ ...e, visiblePop: false, loading: false }))
          window.location.href = data.payUrl
          return
        }
        setPayOrder({ outTradeNo: data.outTradeNo, payType: data.payType })
        setMoneyObj((e:any) => ({
          ...e,
          visiblePop: true,
          loading: false,
          url: data.payUrl
        }))
      }).catch(() => {
        setMoneyObj((e:any) => ({ ...e, loading: false }))
      })
      return
    }
    getAliPayPage({
      money:value,
      userId,
      function_code:'chatGpt'
    }).then((res)=>{
      const data = res.data?.payUrl||{};
      const {code_num,request_id,data:{QRcode_url}} = data;
      setMoneyObj({visiblePop:true,url:QRcode_url,code_num,request_id,loading:false})
    })
  }
  const finishPaid = (tip: string) => {
    message.success(tip)
    clearPendingOrder()
    setPayOrder(null)
    setMoneyObj({loading:false,visiblePop:false,url:'',code_num:'',request_id:''})
    setUpdata({})
  }
  const handleOk =async()=>{
    if (paymentChannel === 'xunhupay') {
      if (!payOrder) return
      const res:any = await queryXuHuPayOrder(payOrder.outTradeNo)
      const data = res.data || {}
      if (data.paid) {
        finishPaid('支付成功')
      } else {
        message.info('还未收到支付结果，请完成支付后再试')
      }
      return
    }
    const res = await payVerify({codeNum:moneyObj.code_num});
    if(res?.data?.code==='0'){
      finishPaid('支付成功')
    }
  }
  const handleCancel=()=>{
    setPayOrder(null)
    setMoneyObj({loading:false,visiblePop:false,url:'',code_num:'',request_id:''})
  }
  // 虎皮椒二维码弹出后自动轮询，最多 10 分钟。
  useEffect(() => {
    if (paymentChannel !== 'xunhupay' || !payOrder || !moneyObj.visiblePop) return
    const startedAt = Date.now()
    let stopped = false
    const timer = setInterval(() => {
      if (stopped) return
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        clearInterval(timer)
        return
      }
      queryXuHuPayOrder(payOrder.outTradeNo)
        .then((res:any) => {
          if (stopped) return
          if (res.data?.paid) {
            stopped = true
            clearInterval(timer)
            finishPaid('支付成功')
          }
        })
        .catch(() => null)
    }, 4000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [payOrder, moneyObj.visiblePop, paymentChannel])
  const handleCustomRecharge = () => {
    if (customAmount == null || !Number.isInteger(customAmount) || customAmount <= 0) {
      message.warning('充值金额必须是大于 0 的整数')
      setCustomAmount(null)
      return
    }
    getPostMoney(customAmount)
  }
  const renderMoneyList=()=>{
    const moneyInfoList =[
      {day:"",money:1,level:'',Describe:"体验一下gpt。"},
      {day:"",money:10,level:'',Describe:"攒着\n够用好多次了\n适合轻量用户。"},
      // {day:30,money:20,level:'gpt3.5购买',Describe:"享受\n1.gpt3.5免费使用",bigMoney:25},
      // {day:30,money:69.9,level:'gpt4购买',Describe:"享受\n1.gpt4免费使用",bigMoney:140},
      {day:"",money:20,level:'',Describe:"主打一个双倍享受"},
      {day:"",money:50,level:'',Describe:"中度使用用户\n基本满足gpt4的需求\n实现3.5自由。"},
      {day:"",money:100,level:'',Describe:"gpt4随便用\n3.5不屑一顾。"}
      
      // {day:90,money:89.9,level:'季度购买',Describe:"享受\n1.gpt3.5免费使用\n2.gpt4每天30次",bigMoney:105},
      // {day:180,money:169.9,level:'半年购买',Describe:"享受\n1.gpt3.5免费使用\n2.gpt4每天36次",bigMoney:190}, 
      // {day:365,money:269.9,level:'包年购买',Describe:"享受\n1.gpt3.5免费使用\n2.gpt4每天88次",bigMoney:420},
    ]
    return moneyInfoList.map((value:any)=>{
      return (
        <div className={styles.item} key={value.money} onClick={()=>{getPostMoney(value.money)}}>
          <span className={styles.level}>{value.level}</span>
          <div className={styles.days}>
            {value.day}
          </div>
          <div className={styles.money_box}>
            {value.money}元<span className={styles.old_money}>{value.bigMoney}</span>
          </div>
          <span className={styles.describe}>
            {value.Describe}
          </span>
        </div>
      )
    })
  }
  // 手机 H5 支付会跳走再回来，页面重新加载后立刻用落盘的订单号查一次。
  useEffect(() => {
    const pending = readPendingOrder()
    if (!pending || paymentChannel !== 'xunhupay' || !token) return
    queryXuHuPayOrder(pending.outTradeNo).then((res:any) => {
      const data = res.data || {}
      if (data.paid) {
        message.success('支付成功，余额已到账')
        clearPendingOrder()
        setUpdata({})
      }
    }).catch(() => null)
  }, [])
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
      const res = await userBillList(params);
      if(res?.code === 0){
        setBillList(res.data.user_bill_list)
        setListTotal(res.data.totalNum)
      }
    }
    fetchUserBillList()
  }, [tableObj,updata])

  // 热门模型：只展示当前供应商实际有的，并取最新推荐
  useEffect(() => {
    if (!token || !credential) {
      setFeaturedPrices([])
      return
    }
    const controller = new AbortController()
    setFeaturedLoading(true)
    getUserPricing({ signal: controller.signal })
      .then((data) => {
        const grouped = new Map<string, UserModelRate[]>()
        for (const item of data.models || []) {
          if (!item?.model) continue
          if (!grouped.has(item.model)) grouped.set(item.model, [])
          grouped.get(item.model)!.push(item)
        }
        const ids = data.model_ids?.length
          ? data.model_ids.filter((id) => grouped.has(id))
          : [...grouped.keys()]
        for (const id of grouped.keys()) {
          if (!ids.includes(id)) ids.push(id)
        }
        const featuredIds = pickFeaturedModelIds(ids, 3)
        setFeaturedPrices(
          featuredIds.map((id) => {
            const rates = grouped.get(id) || []
            const standard = rates.find((r) => r.service_tier === 'standard') || rates[0]
            const enriched = enrichVendorModel({
              id,
              name: rates[0]?.display_name,
              owned_by: rates[0]?.owned_by
            })
            return {
              id,
              name: enriched.name,
              provider: enriched.provider,
              inputUsd: Number(standard?.input || 0),
              outputUsd: Number(standard?.output || 0),
              cachedInputUsd: Number(standard?.cache_read || 0),
              intro: enriched.intro
            }
          })
        )
      })
      .catch(() => setFeaturedPrices([]))
      .finally(() => setFeaturedLoading(false))
    return () => controller.abort()
  }, [token, credential])

  const featuredHint = useMemo(() => {
    if (!featuredPrices.length) return '跟随当前供应商最新可用模型'
    return featuredPrices.map((item) => item.name).join(' · ')
  }, [featuredPrices])




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
        <Modal
          title={paymentChannel === 'xunhupay' ? '微信支付（虎皮椒）' : '微信支付'}
          open={moneyObj.visiblePop}
          onOk={handleOk}
          onCancel={handleCancel}
        >

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
        {supportPhone && (
          <>
            <div>若支付出现问题请联系客服:</div>
            <a href={`tel:${supportPhone}`}>{supportPhone}</a>
          </>
        )}
        </Modal>
        <div className={styles.goodsPay_container}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {/* 用户信息 */}
            <UserInfoCard info={user_info} data={{num4:num4,num:askNum,avatar:user_info?.data?.bodyMessage?.userName.slice(0,1)}} />
            {/* 卡密充值区 */}
            <div className={styles.goodsPay_card}>
              <h4>充值选项 冲多少花多少(手机端需要保存图片在微信扫码支付哦～手机端可左右滑动屏幕观看更多支付选项，电脑端需要按鼠标中键左右拖动)</h4>
              <div className={styles.goodsPay_card_item_box}>
             {renderMoneyList()}
             </div>
              <div className={styles.customRecharge}>
                <div>
                  <strong>自定义金额</strong>
                  <p>只能充值大于 0 的整数，单位：元</p>
                </div>
                <div className={styles.customRecharge_form}>
                  <InputNumber
                    min={1}
                    max={100000}
                    step={1}
                    precision={0}
                    value={customAmount ?? undefined}
                    placeholder="输入整数金额"
                    addonAfter="元"
                    controls
                    parser={(value) => {
                      const text = String(value ?? '')
                      if (text.trim().startsWith('-')) return '' as unknown as number
                      const intPart = text.replace(/[^\d.]/g, '').split('.')[0]
                      if (!intPart) return '' as unknown as number
                      const amount = Number(intPart)
                      return amount > 0 ? amount : ('' as unknown as number)
                    }}
                    onChange={(value) => {
                      if (value == null || value === ('' as unknown as number)) {
                        setCustomAmount(null)
                        return
                      }
                      const amount = Math.floor(Number(value))
                      setCustomAmount(Number.isFinite(amount) && amount > 0 ? amount : null)
                    }}
                    onPressEnter={handleCustomRecharge}
                  />
                  <Button type="primary" onClick={handleCustomRecharge}>
                    自定义充值
                  </Button>
                </div>
              </div>
            </div>
            <div className={styles.goodsPay_card}>
              <h4 className={styles.priceTitle}>
                <span>热门模型价格（当前供应商 · 美元 / 百万 tokens）</span>
                <Button type="link" onClick={() => navigate('/price')}>查看完整价目</Button>
              </h4>
              <p style={{ margin: '0 0 12px', color: '#667085', fontSize: 13 }}>
                {featuredLoading ? '正在读取当前供应商价目…' : featuredHint}
              </p>
              <div className={styles.pricePreview}>
                {featuredPrices.map((item) => (
                  <div className={styles.pricePreviewItem} key={item.id} onClick={() => navigate('/price')}>
                    <span className={styles.priceProvider}>{PROVIDER_META[item.provider].label}</span>
                    <strong>{item.name}</strong>
                    <div>输入 {formatUsd(item.inputUsd)}</div>
                    <div>输出 {formatUsd(item.outputUsd)}</div>
                    <div>缓存命中 {formatUsd(item.cachedInputUsd)}</div>
                    {item.intro ? <div style={{ marginTop: 6, color: '#98a2b3', fontSize: 12 }}>{item.intro}</div> : null}
                  </div>
                ))}
                {!featuredLoading && featuredPrices.length === 0 ? (
                  <div style={{ color: '#98a2b3', fontSize: 13 }}>暂无可用模型价目，请稍后在「模型价格」页查看</div>
                ) : null}
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
