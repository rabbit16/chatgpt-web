import {
  ApiOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FormOutlined,
  HistoryOutlined,
  HomeOutlined,
  MoneyCollectFilled,
  NotificationOutlined,
  ProfileOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  TransactionOutlined,
  UserOutlined
} from '@ant-design/icons'

/**
 * 导航数据（扁平化）
 * ------------------------------------------------------------
 * 去掉了「更多」下拉：常驻项全部平铺，点得到就不用再展开。
 * - 商城 + 模型价格 → 「价格与充值」（同一页两个页签）
 * - 公告 + 留言 → 「公告留言」
 */

/** 首页：营销主页 */
const home = {
  path: '/',
  name: '首页',
  icon: <HomeOutlined />,
  message: '站点介绍、价格概览与接入方式'
}

/** 模型体验：对话 + 绘图（页内页签切换） */
const experience = {
  path: '/chat',
  name: '模型体验',
  icon: <ExperimentOutlined />,
  message: '对话与绘图，登录后保存历史'
}

/** 价格与充值：模型价格 + 余额充值 */
const priceShop = {
  path: '/price',
  name: '价格与充值',
  icon: <MoneyCollectFilled />,
  message: '公开参考价，注册后看折扣与余额'
}

const docs = {
  path: '/docs',
  name: '接入文档',
  icon: <BookOutlined />,
  message: '三步接入：密钥、地址、第一条请求'
}

const notice = {
  path: '/notice',
  name: '公告留言',
  icon: <NotificationOutlined />,
  message: '看通知、提建议，匿名也行'
}

const agent = {
  path: '/agent',
  name: 'Agent 接入',
  icon: <ApiOutlined />,
  message: '中转地址对接 Claude Code / Codex'
}

const software = {
  path: '/software',
  name: '软件下载',
  icon: <CloudDownloadOutlined />,
  message: '按分类浏览软件，跳转网盘下载'
}

/** 访客导航：全部平铺 */
const guestNav = [home, experience, priceShop, docs, agent, software, notice]

/** 登录后导航：多出与账号相关的入口 */
const userNav = [
  home,
  experience,
  priceShop,
  {
    path: '/usage',
    name: '使用记录',
    icon: <HistoryOutlined />,
    message: '查看本账号请求用量与扣费'
  },
  {
    path: '/tasks',
    name: '任务',
    icon: <ProfileOutlined />,
    message: '查看中转日志归并出的未完成任务'
  },
  agent,
  software,
  notice
]

const admin = {
  path: '/admin',
  routes: [
    { path: '/admin', name: '总览', icon: <DashboardOutlined /> },
    { path: '/admin/users', name: '用户', icon: <TeamOutlined /> },
    { path: '/admin/announcement', name: '公告', icon: <NotificationOutlined /> },
    { path: '/admin/feedback', name: '留言', icon: <FormOutlined /> },
    { path: '/admin/orders', name: '订单', icon: <TransactionOutlined /> },
    { path: '/admin/usage', name: '请求用量', icon: <BarChartOutlined /> },
    { path: '/admin/tasks', name: '代理任务', icon: <ProfileOutlined /> },
    { path: '/admin/vendors', name: '供应商', icon: <CloudServerOutlined /> },
    { path: '/admin/prompt', name: 'Prompt 注入', icon: <BulbOutlined /> },
    { path: '/admin/pricing', name: '费率设置', icon: <SettingOutlined /> },
    { path: '/admin/software', name: '软件下载', icon: <CloudDownloadOutlined /> },
    { path: '/admin/profile', name: '个人资料', icon: <UserOutlined /> },
    { path: '/admin/shop', name: '商城', icon: <ShopOutlined /> }
  ]
}

export default {
  home,
  experience,
  priceShop,
  docs,
  notice,
  guestNav,
  userNav,
  admin
}
