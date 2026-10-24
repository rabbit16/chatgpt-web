import {
  ApiOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DashboardOutlined,
  DollarOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FormOutlined,
  HistoryOutlined,
  HomeOutlined,
  MoneyCollectFilled,
  NotificationOutlined,
  ProfileOutlined,
  SettingOutlined,
  TeamOutlined,
  TransactionOutlined,
} from '@ant-design/icons'

/**
 * 导航数据（扁平化）
 * ------------------------------------------------------------
 * 去掉了「更多」下拉：常驻项全部平铺，点得到就不用再展开。
 * - 商城 + 模型价格 → 「充值商城」（同一页两个页签）
 * - 公告 + 留言 → 「公告留言」
 */

/** 首页：营销主页 */
const home = {
  path: '/',
  name: '首页',
  icon: <HomeOutlined />,
  message: '站点介绍、价格概览与接入方式'
}

/** AI 工作台：在线对话 + 绘图（页内页签切换） */
const experience = {
  path: '/chat',
  name: 'AI 工作台',
  icon: <ExperimentOutlined />,
  message: '在线对话与绘图，充值后直接用'
}

/** 充值商城：模型价格 + 余额充值 */
const priceShop = {
  path: '/price',
  name: '充值商城',
  icon: <MoneyCollectFilled />,
  message: '模型价格、余额充值、支付记录都在这里'
}

/**
 * 开票中心（2026-10-24 站长要求「开票独立成栏目」）
 * ------------------------------------------------------------
 * 以前开票藏在「充值商城 › 我的发票」第三个页签，用户得先猜；
 * 而且开票申请曾被写进公开留言墙，造成税号/邮箱泄露。
 * 现在独立成菜单项：申请、进度、被驳回的理由都在自己的页面里。
 */
const invoice = {
  path: '/invoice',
  name: '开票中心',
  icon: <FileTextOutlined />,
  message: '一笔订单开一张电子发票，被驳回能看到原因'
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

const guide = {
  path: '/guide',
  name: '接入指南',
  icon: <BookOutlined />,
  message: '三个值、四步流程、各软件怎么填'
}

const projects = {
  path: '/projects',
  name: '软件商城',
  icon: <CodeOutlined />,
  message: '余额兔等周边工具，三平台下载与上传'
}

const usage = {
  path: '/usage',
  name: '使用记录',
  icon: <HistoryOutlined />,
  message: '用量、扣费与任务'
}

/**
 * 访客导航顺序（漏斗）：认识 → 试 → 价 → 接 → 生态 → 互动
 * 首页 / AI 工作台 / 充值商城 / 使用记录 / 接入指南 / 软件商城 / 公告留言
 */
const guestNav = [home, experience, priceShop, guide, projects, notice]

/** 登录后导航：多出与账号相关的入口 */
/**
 * 登录后导航：在「充值商城」后面插入「使用记录」（刚花完钱最想核对账），
 * 其余顺序与访客一致，减少切换身份后的认知跳变。
 */
const userNav = [home, experience, priceShop, invoice, usage, guide, projects, notice]

const admin = {
  path: '/admin',
  routes: [
    { path: '/admin', name: '总览', icon: <DashboardOutlined /> },
    { path: '/admin/users', name: '用户', icon: <TeamOutlined /> },
    { path: '/admin/announcement', name: '公告', icon: <NotificationOutlined /> },
    { path: '/admin/feedback', name: '留言', icon: <FormOutlined /> },
    { path: '/admin/orders', name: '订单', icon: <TransactionOutlined /> },
    { path: '/admin/invoices', name: '开票', icon: <FileTextOutlined /> },
    { path: '/admin/projects', name: '软件审核', icon: <CodeOutlined /> },
    { path: '/admin/paychannel', name: '支付方式', icon: <MoneyCollectFilled /> },
    { path: '/admin/usage', name: '请求用量', icon: <BarChartOutlined /> },
    { path: '/admin/tasks', name: '代理任务', icon: <ProfileOutlined /> },
    { path: '/admin/vendors', name: '供应商', icon: <CloudServerOutlined /> },
    { path: '/admin/userprice', name: '用户专属价', icon: <DollarOutlined /> },
    { path: '/admin/prompt', name: 'Prompt 注入', icon: <BulbOutlined /> },
    { path: '/admin/pricing', name: '费率设置', icon: <SettingOutlined /> },
    { path: '/admin/software', name: '软件下载', icon: <CloudDownloadOutlined /> }
    /* 2026-10-24 站长反馈：下面两项点了是 404（菜单里有、routes 里没有），
       已删除。若要恢复，需先在 routers/index.tsx 补对应路由：
       { path: '/admin/profile', name: '个人资料', icon: <UserOutlined /> }
       { path: '/admin/shop', name: '商城', icon: <ShopOutlined /> } */
  ]
}

export default {
  home,
  experience,
  priceShop,
  invoice,
  guide,
  projects,
  usage,
  notice,
  guestNav,
  userNav,
  admin
}
