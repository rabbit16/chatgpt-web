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
  WalletOutlined,
} from '@ant-design/icons'

/**
 * 导航数据（扁平化）
 * ------------------------------------------------------------
 * 去掉了「更多」下拉：常驻项全部平铺，点得到就不用再展开。
 * - 模型价格 / 我的钱包 → 两个独立菜单项，共用 /price（靠 ?tab= 区分）
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

/**
 * 模型价格 / 我的钱包（2026-10-25 从「充值商城」拆成两个导航项）
 * ------------------------------------------------------------
 * 站长要求：「模型价格」和「我的钱包」应是两个独立入口，而不是挤在一个「充值商城」里
 * 再让用户进去自己找页签。
 *
 * 两者共用 /price 这一个路由，只靠 query 区分：
 *   · 模型价格 → /price（含裸链接、tab=price、老值 tab=shop）
 *   · 我的钱包 → /price?tab=wallet
 *
 * 关键约定（改这里之前先读）：
 *   1. matchTab 是给 MenuList 判断高亮用的，取值与该页 viewTab 语义完全对齐：
 *      price 页 viewTab = (rawTab === 'wallet' ? 'wallet' : 'price')，
 *      即**没有 tab 参数也等价于 price**。所以「模型价格」在裸 /price 下也必须高亮，
 *      否则用户点完页内页签回到价格时菜单会不亮（父 agent 特别提醒过的坑）。
 *   2. 没有 matchTab 的普通菜单项（首页、AI 工作台…）行为保持原样：只比 pathname。
 *   3. 两个图标必须不同（价格=金额符号，钱包=钱包），并排放才不会认错。
 *   4. guestNav 不放「我的钱包」：访客没有钱包，点了只会弹登录，体验差。
 */
const priceModels = {
  // 显式带 ?tab=price：与页内 switchTab 现在写入的值保持一致，
  // 这样「点菜单」「点页内页签」得到的 URL 是同一个形态，不会来回漂移。
  // 高亮判断用 item.path.split('?')[0]，所以裸 /price 打开时它也照样点亮。
  path: '/price?tab=price',
  name: '模型价格',
  icon: <DollarOutlined />,
  /** 该导航项归属的页内页签；与 price 页 ViewTab 的取值一致 */
  matchTab: 'price',
  message: '各模型单价、按量计费换算，选型前先比价'
}

const wallet = {
  path: '/price?tab=wallet',
  name: '我的钱包',
  icon: <WalletOutlined />,
  matchTab: 'wallet',
  message: '余额、充值、支付记录都在这里'
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

/**
 * Agent 接入（2026-10-24 独立成导航项；2026-10-25 并入「接入教程」并改名）
 * ------------------------------------------------------------
 * 群聊原话：「有用户提出单独做一个小按钮」「不要放在教程里面」「客户找了半天」
 * 「结果在教程里面找到接入接口」「不醒目」。
 * 所以「拿地址和密钥」这件事必须有自己的一格，而不是藏在教程的第 2 步里。
 *
 * 2026-10-25 站长又要求：「把这个接入教程并入现在的左侧这个接入导航栏中的这个按钮，
 * 然后这个接入呢要改成叫 agent 接入……页签里面应该有两个小页签，
 * 一个是地址密钥，还有一个是接入教程。」
 *
 * 所以：
 *   · 名字从「接入」改为「Agent 接入」（避免和产品名/其他「接入」字样混淆）；
 *   · 「接入教程」不再是独立导航项，改成 /agent 页内的第二个页签；
 *   · 但 /guide 路由保留（老书签、页面内「看完整教程」按钮都还指向它），
 *     所以 matchAlso 里列上 /guide —— 用户在 /guide 时，顶栏「Agent 接入」照样高亮，
 *     因为教程在逻辑上就是 Agent 接入的一部分，不该出现「进了教程导航全灭」的情况。
 */
const agent = {
  path: '/agent',
  name: 'Agent 接入',
  icon: <ApiOutlined />,
  /** 除本路径外，这些路径也算「Agent 接入」选中（教程是它的页签） */
  matchAlso: ['/guide'],
  message: '接口地址、API 密钥，外加一步步的接入教程'
}

const projects = {
  path: '/projects',
  name: '软件商城',
  icon: <CodeOutlined />,
  message: '官方客户端与用户投稿工具，审核后上架'
}

const usage = {
  path: '/usage',
  name: '使用记录',
  icon: <HistoryOutlined />,
  message: '用量、扣费与任务'
}

/**
 * 访客导航顺序（漏斗）：认识 → 试 → 价 → 拿值 → 照着做 → 生态 → 互动
 * 首页 / AI 工作台 / 模型价格 / 接入 / 接入教程 / 软件商城 / 公告留言
 *
 * 「接入」紧跟「模型价格」：看完价第一件事就是拿密钥去填软件，
 * 放在教程前面，用户不用先学会怎么填才能拿到值。
 *
 * 访客**不放「我的钱包」**：没有账号就没有钱包，点了只会弹登录框，
 * 平白多一道墙；访客只需要能看到「模型价格」。
 */
const guestNav = [home, experience, priceModels, agent, projects, notice]

/**
 * 登录后导航：在「模型价格」后面接「我的钱包」（看完价就能充），
 * 再接使用记录、Agent 接入、软件商城、公告留言，保持与访客版相近的相对位置，
 * 减少登录前后切换时的认知跳变。
 *
 * 2026-10-25 站长追加要求：**「开票中心」从顶栏撤掉**。
 * 原话：「导航里开票中心可以不需要了，因为在我的钱包这个页面横幅上它是有开票中心的……
 * 把那个开票中心挪到右上角用户头像那个下拉里，让它不要在导航栏占位置。」
 * 所以 invoice 不再进 userNav，入口改到 HeaderRender 的用户下拉菜单；
 * invoice 对象定义与 /invoice 路由**都保留**，页面本身照常可访问。
 *
 * 2026-10-25 站长指定顺序（从左往右，**不要再随意调整**）：
 *   首页 → AI 工作台 → 模型价格 → 我的钱包 → Agent 接入 → 软件商城 → 使用记录 → 公告留言
 */
const userNav = [
  home,
  experience,
  priceModels,
  wallet,
  agent,
  projects,
  usage,
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
  /** 2026-10-25 起「充值商城」拆成这两项，保留 priceShop 别名指向价格项，
      避免其他地方（或有旧引用的代码）取不到 */
  priceModels,
  wallet,
  priceShop: priceModels,
  invoice,
  agent,
  projects,
  usage,
  notice,
  guestNav,
  userNav,
  admin
}
