import {
  ApiOutlined,
  BarChartOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  BulbOutlined,
  CommentOutlined,
  DashboardOutlined,
  ProfileOutlined,
  FormOutlined,
  HistoryOutlined,
  MoneyCollectFilled,
  NotificationOutlined,
  PictureOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  TransactionOutlined,
  UserOutlined
} from '@ant-design/icons'

const web = [
  {
    path: '/',
    name: '对话',
    icon: <CommentOutlined />,
    message: '与智能AI进行对话交流'
  },
  {
    path: '/draw',
    name: '绘图',
    icon: <PictureOutlined />,
    message: 'TeamRouter 图像模型生成图片'
  },
  {
    path: '/shop',
    name: '商城',
    icon: <ShopOutlined />,
    message: '账户余额和充值套餐记录'
  },
  {
    path: '/tasks',
    name: '任务',
    icon: <ProfileOutlined />,
    message: '查看中转日志归并出的未完成任务'
  },
  {
    path: '/usage',
    name: '使用记录',
    icon: <HistoryOutlined />,
    message: '查看本账号请求用量与扣费'
  },
  {
    path: '/price',
    name: '模型价格',
    icon: <MoneyCollectFilled />,
    message: '查看当前账号美元价目'
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
    path: '/profile',
    name: '个人资料',
    icon: <UserOutlined />,
    message: '修改名称、手机号、邮箱和密码'
  }
]

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
      path: '/admin/paychannel',
      name: '支付方式',
      icon: <MoneyCollectFilled />
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
  admin
}
