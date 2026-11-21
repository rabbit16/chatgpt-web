import type { ChatsInfo } from '@/types'
import type { AnnouncementItem } from '@/request/api'
import type { PayChannel } from '@/store/payment/slice'
import { PUBLIC_IMAGE_MODELS, PUBLIC_MODEL_IDS, PUBLIC_MODELS } from '@/data/publicPricing'
import { demoRole, demoScenario } from './runtime'

type DemoKey = { id: number; name: string; api_key: string; key_mask: string; is_active: boolean; created_at: string }
const stamp = '2026-11-12T10:30:00+08:00'
const initialProfile = { userId: 900001, userName: '演示账户', username: 'rabbitj-demo', email: 'demo@example.invalid', telephone: '', is_staff: false }
function readDemo<T>(key: string, fallback: T): T {
  try { return JSON.parse(sessionStorage.getItem(`rabbitj.demo.${key}`) || 'null') ?? fallback } catch { return fallback }
}
function saveDemo(key: string, value: unknown) {
  sessionStorage.setItem(`rabbitj.demo.${key}`, JSON.stringify(value))
}
let profile = readDemo('profile', { ...initialProfile, is_anonymous: false })
let registeredPassword = readDemo('registered-password', '')
let resetEmail = readDemo('reset-email', '')
const demoResetCode = '123456'
let pricing = readDemo('pricing', { usd_cny_rate: 7.2, profit_multiplier: 1.5 })
let payChannel = readDemo<PayChannel>('pay-channel', 'xunhupay')
const payChannels = [
  { value: 'xunhupay', name: '虎皮椒' },
  { value: 'lantu', name: '蓝兔（旧通道）' }
]
let keys = readDemo<DemoKey[]>('keys', [])
let adminUsers = readDemo('admin-users', [
  { user_id: 900002, name: '样例用户', username: 'demo-member', telephone: '', email: 'member@example.invalid', token: 20, discount: 1, money_rate: 1, is_staff: false, is_delete: false, username_login: true }
])
let billList = readDemo('bills', [{ bill_id: 'DEMO-ORDER-001', generate_time: stamp, pay: 20, function_name: '钱包充值' }])
let announcements = readDemo<AnnouncementItem[]>('announcements', [
  { id: 401, title: '本地演示公告', content: '这里可以预览公告已读与分页。', status: 1, sort: 0, insert_time: stamp, update_time: stamp }
])
let feedback = readDemo('feedback', [
  { id: 401, content: '这是本地示例留言。', nickname: '演示访客', anonymous: true, insert_time: stamp, reply: '这是一条模拟管理员回复。', reply_time: stamp, is_read: false, is_delete: false }
])
let invoiceList = readDemo<Record<string, unknown>[]>('invoices', [])
type DemoOrder = { id: string; amount: number; paid: boolean }
let order: DemoOrder | undefined = readDemo<DemoOrder | undefined>('order', undefined)
let submissions = readDemo<Record<string, unknown>[]>('submissions', [])
const software = { id: 101, name: 'rabbitJ 接入工具示例', summary: '用于预览安装、版本和下载入口。', source: 'official', category_id: 1, version: '1.0.0', status: 1, platforms: [{ platform: 'windows', file_url: 'data:text/plain,rabbitJ%20local%20preview' }] }
let taskRows = [{ id: 201, user_id: 900001, account: '演示账户', model: 'demo-model', source: 'demo', path: '/chat/completions', status: 'running', status_source: 'log', suggested_status: 'running', finish: '', result: '请求处理中', decision: '本地模拟', steps: 1, last_request_id: 'DEMO-REQ-001', http_status: 200, started_at: stamp, updated_at: stamp }]
let serial = Date.now()
let conversations = readDemo<ChatsInfo[]>('chats', [{ id: 'demo-chat-1', path: 'demo-chat-1', name: '接入演示会话', data: [] }])
const demoModels = PUBLIC_MODEL_IDS.slice(0, 8)
const demoImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#e4edff"/><circle cx="215" cy="55" r="24" fill="#a9bcff"/><path d="M0 180L100 72l82 108 60-55 78 55" fill="#7897dd"/></svg>')}`

export function demoAccount() {
  const role = demoRole()
  return { role, data: { bodyMessage: { ...profile, is_staff: role === 'administrator' } } }
}

export function installDemoTransport() {
  const original = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href)
    if (['blob:', 'data:'].includes(url.protocol)) return original(input, init)
    const path = url.pathname.replace(/^\/(?:llm\/)?v1(?=\/)/, '').replace(/^\/llm(?=\/)/, '')
    const method = init?.method || (input instanceof Request ? input.method : 'GET')
    const body = typeof init?.body === 'string' ? (() => { try { return JSON.parse(init.body) } catch { return {} } })() : {}
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    const wrapped = (data: Record<string, unknown> = {}) => json({ code: 0, message: '', data: { code: '0', ...data } })
    function listPage<T>(rows: T[]) {
      const page = Math.max(1, Math.floor(Number(body.page)) || 1)
      const size = Math.max(1, Math.floor(Number(body.page_num)) || 10)
      const offset = (page - 1) * size
      return wrapped({ list: rows.slice(offset, offset + size), total: rows.length, page })
    }
    const fail = (message: string, status = 503) => json({ code: status, message, data: { code: String(status), codeMsg: message } }, status)
    const scenario = demoScenario()
    if (scenario === 'loading') await new Promise<void>((resolve) => setTimeout(resolve, 4500))
    if (scenario === 'error' && !['/user/session', '/user/pay/channel'].includes(path)) return fail('本地演示：读取或操作失败，请重试。')
    const empty = scenario === 'empty'
    const session = demoAccount()
    if (path === '/user/pay/channel') return json({ code: '0', channel: payChannel, channels: payChannels })
    if (path === '/user/session') return wrapped(session.data)
    if (path === '/user/verify') {
      const account = String(body.userId || '').trim()
      const loginIds = registeredPassword ? [profile.username, profile.email, profile.telephone] : [initialProfile.username, initialProfile.email]
      if (!account || !loginIds.includes(account) || (registeredPassword && body.password !== registeredPassword)) {
        return fail('演示账号或密码不匹配。', 400)
      }
      if (demoRole() === 'guest') sessionStorage.setItem('rabbitj.demo.role', 'user')
      return new Response(JSON.stringify({ code: 0, message: '', data: { code: '0', ...demoAccount().data } }), {
        headers: { 'Content-Type': 'application/json', 'x-set-cookie': 'token=local-preview' }
      })
    }
    if (path === '/user/anonymous/username') return wrapped({ username: `demo-anon-${serial++}` })
    if (path === '/user/register') {
      if (!body.name || !body.password || (body.anonymous ? !body.username : !body.telephone || !body.email)) {
        return fail('请填写完整的演示注册资料。', 400)
      }
      profile = {
        ...initialProfile,
        userName: String(body.name),
        username: String(body.anonymous ? body.username : body.telephone),
        email: String(body.email || ''),
        telephone: String(body.telephone || ''),
        is_anonymous: Boolean(body.anonymous)
      }
      registeredPassword = String(body.password)
      saveDemo('profile', profile)
      saveDemo('registered-password', registeredPassword)
      return wrapped(demoAccount().data)
    }
    if (path === '/user/password/send_code') {
      if (!body.email || body.email !== profile.email) return fail('请填写已登记的演示邮箱。', 400)
      resetEmail = String(body.email)
      saveDemo('reset-email', resetEmail)
      return wrapped({ codeMsg: `本地演示验证码 ${demoResetCode}` })
    }
    if (path === '/user/password/reset') {
      if (!resetEmail || resetEmail !== body.email || String(body.code) !== demoResetCode || !body.password) {
        return fail('演示邮箱或验证码不正确，请重新核对。', 400)
      }
      registeredPassword = String(body.password)
      resetEmail = ''
      saveDemo('registered-password', registeredPassword)
      saveDemo('reset-email', '')
      return wrapped()
    }

    if (path === '/user/get_user_info') {
      const paid = billList.filter((bill) => bill.bill_id.startsWith('DEMO-PAY-'))
      const balance = paid.reduce((total, bill) => total + bill.pay, 36.5)
      return wrapped({ userMessage: { token: balance, plus_user_count: 0 } })
    }
    if (path === '/user/user_bill_list') return wrapped({ user_bill_list: empty ? [] : billList, totalNum: empty ? 0 : billList.length })
    if (path === '/user/announcement/latest' || path === '/user/announcement/list') {
      const visible = empty ? [] : announcements.filter((item) => item.status === 1 && !item.is_delete)
      return path.endsWith('/latest') ? wrapped({ item: visible[0] ?? null }) : listPage(visible)
    }
    if (path === '/user/api_key/list') return json({ code: '0', message: '', data: { code: '0', keys: empty ? [] : keys, allow_phone_key: false }, keys: empty ? [] : keys })
    if (demoRole() !== 'administrator' && (path.startsWith('/user/admin/') || path.startsWith('/admin/'))) return fail('当前演示角色无管理员权限。', 403)
    if (path === '/user/admin/users') {
      const keyword = String(body.keyword || '').trim().toLowerCase()
      const filtered = adminUsers.filter((item) => {
        const values = [item.name, item.username, item.email, item.telephone, String(item.user_id)]
        return !keyword || values.some((value) => value.toLowerCase().includes(keyword))
      })
      return listPage(empty ? [] : filtered)
    }
    if (path === '/user/admin/user/create' || path === '/user/admin/user/update') {
      const creating = path.endsWith('/create')
      const previous = adminUsers.find((item) => item.user_id === Number(body.userId))
      if (!creating && !previous) return fail('找不到演示用户。', 404)
      const username = String(body.username ?? previous?.username ?? '').trim()
      if (!username || (creating && !body.password)) return fail('请填写演示用户的用户名和密码。', 400)
      if (adminUsers.some((item) => item.username === username && item.user_id !== previous?.user_id)) {
        return fail('该演示用户名已存在。', 409)
      }
      const item = {
        user_id: previous?.user_id ?? serial++, username,
        name: String(body.name ?? previous?.name ?? username),
        telephone: String(body.telephone ?? previous?.telephone ?? ''),
        email: String(body.email ?? previous?.email ?? ''),
        token: Number(body.token ?? previous?.token ?? 0),
        discount: Number(body.discount ?? previous?.discount ?? 1),
        money_rate: Number(body.money_rate ?? previous?.money_rate ?? 1),
        is_staff: Boolean(body.is_staff ?? previous?.is_staff),
        is_delete: Boolean(body.is_delete ?? previous?.is_delete),
        username_login: Boolean(body.username_login ?? previous?.username_login)
      }
      adminUsers = creating ? [item, ...adminUsers] : adminUsers.map((row) => row.user_id === item.user_id ? item : row)
      saveDemo('admin-users', adminUsers)
      return wrapped({ item })
    }
    if (path === '/user/admin/orders') {
      const orders = billList.map((bill) => ({ ...bill, user_id: profile.userId, money: bill.pay }))
      return listPage(empty ? [] : orders.filter((item) => !body.userId || item.user_id === Number(body.userId)))
    }
    if (path === '/user/admin/announcement') return listPage(empty ? [] : announcements.filter((item) => !item.is_delete))
    if (path === '/user/admin/announcement/create' || path === '/user/admin/announcement/update') {
      const previous = announcements.find((item) => item.id === Number(body.id))
      const creating = path.endsWith('/create')
      if (!creating && (!previous || previous.is_delete)) return fail('找不到公告。', 404)
      const title = String(body.title ?? previous?.title ?? '').trim()
      const content = String(body.content ?? previous?.content ?? '').trim()
      if (!title || !content) return fail('请填写公告标题和内容。', 400)
      const time = new Date().toISOString()
      const item: AnnouncementItem = {
        id: previous?.id ?? serial++, title, content,
        status: Number(body.status ?? previous?.status ?? 1), sort: Number(body.sort ?? previous?.sort ?? 0),
        is_delete: Boolean(body.is_delete), insert_time: previous?.insert_time ?? time, update_time: time
      }
      announcements = [item, ...announcements.filter((row) => row.id !== item.id)]
        .sort((left, right) => right.sort - left.sort || right.id - left.id)
      saveDemo('announcements', announcements)
      return wrapped({ item })
    }
    if (path === '/user/admin/feedback') {
      return listPage(empty ? [] : feedback.filter((item) => !body.only_unread || !item.is_read))
    }
    if (path === '/user/admin/feedback/update' || path === '/user/admin/feedback/delete') {
      const target = feedback.find((item) => item.id === Number(body.id))
      if (!target) return fail('找不到留言。', 404)
      if (path.endsWith('/delete')) {
        feedback = feedback.filter((item) => item.id !== target.id)
      } else {
        if (typeof body.reply === 'string') {
          target.reply = body.reply.trim()
          target.reply_time = new Date().toISOString()
        }
        if (typeof body.is_read === 'boolean') target.is_read = body.is_read
        if (typeof body.is_delete === 'boolean') target.is_delete = body.is_delete
      }
      saveDemo('feedback', feedback)
      return wrapped()
    }
    if (path === '/user/admin/payment/channel') {
      if (!payChannels.some(({ value }) => value === body.channel)) return fail('支付通道无效', 400)
      payChannel = body.channel
      saveDemo('pay-channel', payChannel)
      return wrapped({ channel: payChannel, channels: payChannels })
    }
    if (path === '/user/xunhupay/status') return wrapped({ configured: true })
    if (path === '/admin/pricing' && method === 'GET') return json(pricing)
    if (path === '/admin/pricing' && method === 'PUT') {
      const { usd_cny_rate, profit_multiplier } = body
      if (![usd_cny_rate, profit_multiplier].every((rate) => typeof rate === 'number' && rate > 0 && rate <= 100)) {
        return fail('请输入有效的汇率和加价系数', 400)
      }
      pricing = { usd_cny_rate, profit_multiplier }
      saveDemo('pricing', pricing)
      return json(pricing)
    }
    if (path === '/user/api_key/create' && demoRole() !== 'guest') {
      const id = serial++
      const key = { id, name: String(body.name || '接入演示'), api_key: `sk-local-demo-${id}`, key_mask: `sk-local••••${id}`, is_active: true, created_at: stamp }
      keys = [...keys, key]
      saveDemo('keys', keys)
      return wrapped({ key })
    }
    if (['/user/api_key/enable', '/user/api_key/disable', '/user/api_key/delete'].includes(path) && demoRole() !== 'guest') {
      keys = path.endsWith('/delete') ? keys.filter((key) => key.id !== body.id) : keys.map((key) => key.id === body.id ? { ...key, is_active: path.endsWith('/enable') } : key)
      saveDemo('keys', keys)
      return wrapped()
    }
    if (path === '/pricing/models') return json({ currency: 'USD', price_unit: 'per 1M tokens', models: empty ? [] : PUBLIC_MODELS, model_ids: empty ? [] : PUBLIC_MODEL_IDS, image_models: empty ? [] : PUBLIC_IMAGE_MODELS, discount: 1 })
    if (path === '/models') return json({ data: empty ? [] : demoModels.map((id) => ({ id, object: 'model' })) })
    if (path === '/images/generations' || path === '/images/edits') return json({ data: [{ url: demoImage }] })
    if (['/messages', '/chat/completions', '/responses'].includes(path)) {
      const text = '这是一条本地演示回复。你可以继续编辑文稿或发送消息。'
      const chunk = path === '/messages'
        ? { type: 'content_block_delta', delta: { type: 'text_delta', text } }
        : { choices: [{ index: 0, delta: { content: text } }] }
      const done = path === '/messages' ? JSON.stringify({ type: 'message_stop' }) : '[DONE]'
      return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${done}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })
    }
    if (['/user/xunhupay/pay', '/user/pay_rabbit'].includes(path) && demoRole() !== 'guest') {
      const amount = Number(body.money)
      if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return fail('请输入有效金额', 400)
      order = { id: `DEMO-PAY-${serial++}`, amount, paid: false }
      saveDemo('order', order)
      if (path === '/user/pay_rabbit') {
        return wrapped({ payUrl: { code_num: order.id, request_id: order.id, data: { QRcode_url: demoImage } } })
      }
      if (window.matchMedia('(max-width: 720px)').matches) return wrapped({ outTradeNo: order.id, payType: 'h5', payUrl: '/result?demoReturn=1' })
      return wrapped({ outTradeNo: order.id, payType: 'native', payUrl: demoImage })
    }
    const oldChannelQuery = path === '/user/verify_pay_again'
    if ((oldChannelQuery || path.startsWith('/user/xunhupay/query/')) && demoRole() !== 'guest') {
      const orderId = oldChannelQuery ? String(body.codeNum || '') : path.split('/').pop()
      if (!order || order.id !== orderId) return fail('未找到该演示订单', 404)
      if (scenario === 'pay-failed' && !order.paid) return wrapped({ paid: false, status: 'failed' })
      if (scenario === 'pay-success' && !order.paid) {
        order.paid = true
        saveDemo('order', order)
        billList = [{ bill_id: order.id, generate_time: stamp, pay: order.amount, function_name: '钱包充值' }, ...billList]
        saveDemo('bills', billList)
      }
      if (oldChannelQuery && !order.paid) return wrapped({ code: 'pending', paid: false })
      return wrapped({ paid: order.paid })
    }
    if (path === '/user/invoice/summary') {
      const amount = (rows: Record<string, unknown>[]) => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      const recharge = empty ? 0 : billList.reduce((sum, row) => sum + row.pay, 0)
      const issued = empty ? 0 : amount(invoiceList.filter((row) => row.status === 'issued'))
      const pending = empty ? 0 : amount(invoiceList.filter((row) => row.status === 'pending' || row.status === 'issuing'))
      return wrapped({ recharge_total: recharge, issued_amount: issued, pending_amount: pending, invoiceable_amount: recharge - issued - pending })
    }
    if (path === '/user/invoice/list' || path === '/user/admin/invoice/list') {
      const page = Number(body.page) || 1
      const pageSize = Number(body.page_num) || 10
      const rows = empty ? [] : invoiceList.filter((row) => (!body.userId || body.userId === row.user_id) && (!body.status || body.status === 'all' || body.status === row.status))
      return wrapped({ list: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page })
    }
    if (path === '/user/invoice/create' && demoRole() !== 'guest') {
      const billIds = [...new Set(String(body.bill_id || '').split(',').filter(Boolean))]
      const bills = billList.filter((bill) => billIds.includes(bill.bill_id))
      if (!billIds.length || bills.length !== billIds.length) return fail('订单不存在或尚未支付。', 400)
      if (invoiceList.some((row) => row.status !== 'rejected' && String(row.bill_id).split(',').some((id) => billIds.includes(id)))) {
        return fail('已有处理中的申请或已开票记录。', 409)
      }
      if (!body.title || !body.email || (body.title_type === 'company' && !body.tax_no)) return fail('发票资料填写不完整。', 400)
      const record = { ...body, bill_id: billIds.join(','), amount: bills.reduce((sum, bill) => sum + bill.pay, 0), user_id: profile.userId, id: serial++, status: 'pending', created_at: stamp }
      invoiceList = [record, ...invoiceList]
      saveDemo('invoices', invoiceList)
      return wrapped({ ...record, invoice: record })
    }
    if (path === '/user/admin/invoice/review') {
      const record = invoiceList.find((item) => item.id === body.id)
      if (!record) return fail('没有找到该申请。', 404)
      if (record.status !== 'pending' && record.status !== 'issuing') return fail('这条申请已处理。', 409)
      if (!(body.status === 'issued' && body.invoice_no) && !(body.status === 'rejected' && body.reject_reason)) {
        return fail('请填写发票号或驳回原因。', 400)
      }
      invoiceList = invoiceList.map((item) => item.id === body.id ? {
        ...item, status: body.status, invoice_no: body.invoice_no, reject_reason: body.reject_reason
      } : item)
      saveDemo('invoices', invoiceList)
      return wrapped()
    }
    if (path === '/user/invoice/cancel' && demoRole() !== 'guest') {
      const record = invoiceList.find((item) => item.id === body.id)
      if (!record || !['pending', 'issuing'].includes(String(record.status))) return fail('这条申请当前不能撤销。', 409)
      invoiceList = invoiceList.filter((item) => item.id !== body.id)
      saveDemo('invoices', invoiceList)
      return wrapped()
    }
    if (path === '/user/profile/update' && demoRole() !== 'guest') {
      profile = { ...profile, userName: String(body.name ?? profile.userName), telephone: String(body.telephone ?? profile.telephone), email: String(body.email ?? profile.email) }
      saveDemo('profile', profile)
      return wrapped({ bodyMessage: profile })
    }
    if (path === '/user/feedback/list') return listPage(empty ? [] : feedback.filter((item) => !item.is_delete))
    if (path === '/user/feedback' && method === 'POST') {
      const content = String(body.content || '').trim()
      if (!content) return fail('请填写留言内容。', 400)
      const anonymous = Boolean(body.anonymous)
      feedback = [{
        id: serial++, content, nickname: anonymous ? '匿名' : String(body.nickname || profile.userName),
        anonymous, insert_time: new Date().toISOString(), reply: '', reply_time: '', is_read: false, is_delete: false
      }, ...feedback]
      saveDemo('feedback', feedback)
      return wrapped()
    }
    if (path === '/user/getContextList' || path === '/user/searchChat') {
      const keyword = String(body.keyword || '').trim().toLowerCase()
      const filtered = empty ? [] : conversations.filter((chat) => {
        if (body.chat_id && chat.id !== String(body.chat_id)) return false
        return !keyword || [chat.name, ...chat.data.map((item) => item.text)].some((text) => text.toLowerCase().includes(keyword))
      })
      const pageSize = Number(body.page_num) || 10
      const offset = Math.max(0, (Number(body.page || 1) - 1) * pageSize)
      const rows = body.allContext ? filtered : filtered.slice(offset, offset + pageSize)
      return wrapped({ context_dict: rows, allContextNum: filtered.length, total: filtered.length })
    }
    if (path === '/user/createChat') {
      const id = `demo-chat-${serial++}`
      conversations = [{ id, path: id, name: '新对话', data: [] }, ...conversations]
      saveDemo('chats', conversations)
      return wrapped({ newChatId: id })
    }
    if (path === '/user/saveChatMessage') {
      const chat = conversations.find((item) => item.id === String(body.contextId))
      if (!chat) return fail('找不到这条演示会话', 404)
      const prompt = String(body.prompt || '')
      chat.data.push(
        { id: String(serial++), text: prompt, role: 'user', dateTime: String(body.start_time || stamp), status: 'pass' },
        { id: String(serial++), text: String(body.gpt || ''), role: 'assistant', dateTime: String(body.answer_time || stamp), status: 'pass' }
      )
      chat.name = prompt || chat.name
      saveDemo('chats', conversations)
      return wrapped()
    }
    if (path === '/user/deleteChat' || path === '/user/deleteAllChat') {
      conversations = path.endsWith('/deleteAllChat') ? [] : conversations.filter((row) => row.id !== String(body.chat_id))
      saveDemo('chats', conversations)
      return wrapped()
    }
    if (path === '/user/software/category/list') return wrapped({ list: [{ id: 1, name: '接入工具' }] })
    if (path === '/user/software/list') {
      const all: Record<string, unknown>[] = [software, ...submissions.filter((row) => row.review_status === 'approved')]
      const list = empty ? [] : all.filter((row) =>
        (!body.source || row.source === body.source) && (!body.category_id || row.category_id === body.category_id) &&
        (!body.keyword || String(row.name).toLowerCase().includes(String(body.keyword).toLowerCase())))
      return wrapped({ list, total: list.length })
    }
    if (path === '/user/software/detail') {
      const item = ([software, ...submissions] as Record<string, unknown>[]).find((row) => String(row.id) === url.searchParams.get('id'))
      return item ? wrapped({ item }) : fail('未找到该本地示例', 404)
    }
    if (path === '/user/software/my-submissions') return wrapped({ list: empty ? [] : submissions, total: empty ? 0 : submissions.length })
    if (path === '/user/software/upload' && demoRole() !== 'guest') return wrapped({ url: 'https://example.invalid/rabbitj-demo.zip' })
    if (path === '/user/software/submit' && demoRole() !== 'guest') {
      const id = serial++
      submissions = [{ ...body, id, source: 'user', author_name: '演示账户', review_status: 'pending', status: 0, insert_time: stamp }, ...submissions]
      saveDemo('submissions', submissions)
      return wrapped({ id })
    }
    if (path === '/user/admin/software/review/list') return wrapped({ list: submissions, total: submissions.length })
    if (path === '/user/admin/software/review') {
      submissions = submissions.map((row) => String(row.id) === String(body.id) ? { ...row, review_status: body.action === 'approve' ? 'approved' : 'rejected', reviewer_note: body.note } : row)
      saveDemo('submissions', submissions)
      return wrapped()
    }
    if (path === '/user/admin/overview') return wrapped({ overview: { user_count: 1, active_user_count: 1, balance_sum: 36.5, order_count: billList.length }, billing: {}, models: [] })
    if (path === '/user/admin/software') return listPage(empty ? [] : [software])
    if (path === '/tasks') {
      const scope = url.searchParams.get('scope')
      const all = empty ? [] : taskRows
      const items = all.filter((row) => scope === 'all' || (scope === 'open' ? row.status !== 'done' : row.status === scope))
      return json({ items, total: items.length, counts: { all: all.length, open: all.filter((row) => row.status !== 'done').length, running: all.filter((row) => row.status === 'running').length, done: all.filter((row) => row.status === 'done').length, failed: all.filter((row) => row.status === 'failed').length } })
    }
    if (path === '/tasks/status' || path === '/tasks/reevaluate') {
      taskRows = taskRows.map((row) => row.id === body.id ? { ...row, status: body.status || row.suggested_status } : row)
      return json({ ok: true })
    }
    if (path === '/tasks/delete') {
      taskRows = taskRows.filter((row) => row.id !== body.id)
      return json({ ok: true })
    }
    if (path === '/tasks/complete-all') {
      const updated = taskRows.filter((row) => row.status === 'running').length
      taskRows = taskRows.map((row) => row.status === 'running' ? { ...row, status: 'done' } : row)
      return json({ updated })
    }
    if (path === '/tasks/delete-done') {
      const before = taskRows.length
      taskRows = taskRows.filter((row) => row.status !== 'done')
      return json({ deleted: before - taskRows.length })
    }
    if (path.startsWith('/usage') && method === 'GET') {
      const status = url.searchParams.get('status')
      const include = !empty && (!status || status === 'billed')
      const row = { request_id: 'DEMO-REQ-002', user_id: 900001, model: demoModels[0], path: '/chat/completions', source: 'demo', status: 'billed', http_status: 200, input_tokens: 800, output_tokens: 240, cache_read_tokens: 0, cache_write_tokens: 0, charged_cny: 0.02, balance_cny: 36.5, created_at: stamp }
      const model = url.searchParams.get('model_prefix') || ''
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const matches = include && row.model.startsWith(model) && (!from || stamp >= from) && (!to || stamp < to)
      if (path === '/usage/summary') return json({ request_count: matches ? 1 : 0, billed_count: matches ? 1 : 0, sum_charged_cny: matches ? row.charged_cny : 0, sum_input_tokens: matches ? row.input_tokens : 0, sum_output_tokens: matches ? row.output_tokens : 0 })
      return json({ items: matches ? [row] : [], total: matches ? 1 : 0 })
    }
    return fail('此操作暂无本地演示数据。', 501)
  }
}
