import {
  ApiOutlined,
  BarChartOutlined,
  BookOutlined,
  ExperimentOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  BulbOutlined,
  DashboardOutlined,
  ProfileOutlined,
  FormOutlined,
  HistoryOutlined,
  MoneyCollectFilled,
  NotificationOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  TransactionOutlined,
  UserOutlined
} from '@ant-design/icons'

/**
 * 导航数据（T2 · IA-2 极简顶栏 + 更多）
 * ------------------------------------------------------------
 * 原来 11 项平铺挤一行，1366 宽会贴边。
 * 现在分三层：
 *   primary —— 顶栏常驻 5 项（高频）
 *   more    —— 收进「更多」下拉（低频）
 *   web     —— 完整列表，保留给移动端抽屉与旧调用方
 * 账号相关（个人资料/钱包/后台）在头像菜单里，不占顶栏。
 */

/**
 * 模型体验：对话与绘图合并成一个入口（页内用页签切换），菜单只占一格。
 */
const experience = {
  path: '/chat',
  name: '模型体验',
  icon: <ExperimentOutlined />,
  message: '对话与绘图，登录后保存历史'
}

const primary = [
  experience,
  {
    path: '/shop',
    name: '商城',
    icon: <ShopOutlined />,
    message: '账户余额和充值套餐记录'
  },
  {
    path: '/price',
    name: '模型价格',
    icon: <MoneyCollectFilled />,
    message: '查看当前账号美元价目'
  },
  {
    path: '/usage',
    name: '使用记录',
    icon: <HistoryOutlined />,
    message: '查看本账号请求用量与扣费'
  }
]

const more = [
  {
    path: '/tasks',
    name: '任务',
    icon: <ProfileOutlined />,
    message: '查看中转日志归并出的未完成任务'
  },
  {
    path: '/agent',
    name: 'Agent 接入',
    icon: <ApiOutlined />,
    message: '中转地址对接 Claude Code / Codex'
  },
  {
    path: '/software',
    name: '软件下载',
    icon: <CloudDownloadOutlined />,
    message: '按分类浏览软件，跳转网盘下载'
  },
  {
    path: '/announcement',
    name: '公告',
    icon: <NotificationOutlined />,
    message: '查看站点公告与历史通知'
  },
  {
    path: '/feedback',
    name: '留言',
    icon: <FormOutlined />,
    message: '可匿名留言，不留名就不记身份'
  },
  {
    path: '/profile',
    name: '个人资料',
    icon: <UserOutlined />,
    message: '修改名称、手机号、邮箱和密码'
  }
]

/**
 * 未登录访客导航（S3）
 * ------------------------------------------------------------
 * 站点定位是"卖 API 中转"，访客第一眼要看到"体验 / 价格 / 文档"，
 * 而不是把首页当成一个聊天工具。商品类（商城）与账号类（使用记录）收进「更多」。
 */
const guestPrimary = [
  {
    ...experience,
    message: '不登录也能试对话与绘图，历史不保存'
  },
  {
    path: '/price',
    name: '模型价格',
    icon: <MoneyCollectFilled />,
    message: '公开参考价，注册后看你的折扣'
  },
  {
    path: '/docs',
    name: '接入文档',
    icon: <BookOutlined />,
    message: '三步接入：密钥、地址、第一条请求'
  }
]

const guestMore = [
  {
    path: '/shop',
    name: '商城',
    icon: <ShopOutlined />,
    message: '账户余额和充值套餐记录'
  },
  {
    path: '/agent',
    name: 'Agent 接入',
    icon: <ApiOutlined />,
    message: '中转地址对接 Claude Code / Codex'
  },
  {
    path: '/software',
    name: '软件下载',
    icon: <CloudDownloadOutlined />,
    message: '按分类浏览软件，跳转网盘下载'
  },
  {
    path: '/announcement',
    name: '公告',
    icon: <NotificationOutlined />,
    message: '查看站点公告与历史通知'
  },
  {
    path: '/feedback',
    name: '留言',
    icon: <FormOutlined />,
    message: '可匿名留言，不留名就不记身份'
  }
]

// 完整列表：顶栏常驻 + 更多，供移动端与既有调用方使用
const web = [...primary, ...more]

const admin = {
  path: '/admin',
  routes: [
    {
      path: '/admin',
      name: '总览',
      icon: <DashboardOutlined />
    },
    {
      path: '/admin/users',
      name: '用户',
      icon: <TeamOutlined />
    },
    {
      path: '/admin/announcement',
      name: '公告',
      icon: <NotificationOutlined />
    },
    {
      path: '/admin/feedback',
      name: '留言',
      icon: <FormOutlined />
    },
    {
      path: '/admin/orders',
      name: '订单',
      icon: <TransactionOutlined />
    },
    {
      path: '/admin/usage',
      name: '请求用量',
      icon: <BarChartOutlined />
    },
    {
      path: '/admin/tasks',
      name: '代理任务',
      icon: <ProfileOutlined />
    },
    {
      path: '/admin/vendors',
      name: '供应商',
      icon: <CloudServerOutlined />
    },
    {
      path: '/admin/prompt',
      name: 'Prompt 注入',
      icon: <BulbOutlined />
    },
    {
      path: '/admin/pricing',
      name: '费率设置',
      icon: <SettingOutlined />
    },
    {
      path: '/admin/software',
      name: '软件下载',
      icon: <CloudDownloadOutlined />
    }
  ]
}

export default {
  web,
  experience,
  primary,
  more,
  guestPrimary,
  guestMore,
  admin
}
