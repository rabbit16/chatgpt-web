import {
	ChatsInfo,
  ProductInfo,
  RequestChatOptions,
  RequestLoginParams,
  ResponseConfigData,
  ResponseLoginData,
  UserInfo,
  Register,
  Login
} from '@/types'
import request from '.'
import userStore from '@/store/user/slice'
import {
  buildLlmRequestBody,
  errorWantsOtherTokenLimit,
  swapTokenLimitField,
  type ChatMessage,
  type LlmProtocol
} from '@/utils/llmProtocol'

const llmBaseUrl = (import.meta.env.VITE_LLM_BASE_URL || '/llm').replace(/\/$/, '')

export function userBillInfo(params:{userId:string}){
  return request.post('/user/get_user_info',params)
}

export function userBillList(params:{userId:number,page:number,page_num:number}){
  return request.post('/user/user_bill_list',params)
}

export function getFunctionList(){
  return request.post('/user/function_list')
}

export function getModelList(){
  let phone = ''
  try {
    phone = getLlmApiKey('获取模型列表')
  } catch (error) {
    return Promise.reject(error)
  }
  return fetch(`${llmBaseUrl}/models`, { headers: { Authorization: `Bearer ${phone}` } }).then(async (response) => {
    if (!response.ok) throw new Error(`获取模型列表失败 (${response.status})`)
    return response.json() as Promise<{
      data: Array<{ id: string; protocol?: string; owned_by?: string }>
      protocol_routes?: Array<{ model: string; protocol: string }>
    }>
  })
}

export function getAliPayPage(params:{userId:string,money:number,function_code:string}){
  return request.post('/user/pay_rabbit',params)
}

export function payVerify(params:{codeNum:string}) {
  return request.post('/user/verify_pay_again', params)
}

// 虎皮椒下单：pay_type 传 auto，后端按 UA 分流手机 H5 / 电脑扫码
export function createXuHuPayOrder(params:{
  userId: number
  money: number
  function_code: string
  pay_type?: 'auto' | 'h5' | 'qrcode'
  description?: string
}) {
  return request.post('/user/xunhupay/pay', params)
}

// 虎皮椒查单，paid 为 true 表示已入账
export function queryXuHuPayOrder(outTradeNo: string) {
  return request.get(`/user/xunhupay/query/${encodeURIComponent(outTradeNo)}`)
}

// 虎皮椒配置自检，configured 为 false 说明后端缺 AppID/Secret
export function getXuHuPayStatus() {
  return request.get('/user/xunhupay/status')
}

// 读取全站当前生效的支付通道（公开接口，登录前也可调用）
export function getPayChannel() {
  return request.get('/user/pay/channel')
}

// 管理员切换全站支付通道
export function setPayChannel(params: { channel: string }) {
  return request.post('/user/admin/payment/channel', params)
}

export function getGPTListMessage(params:{userId:number,page:number,page_num:number,allContext:boolean,chat_id?:string}){
  return request.post('/user/getContextList',params)
}

export function searchChatMessages(params: { userId: number; keyword: string; page: number; page_num: number }) {
  return request.post<{ code: string; codeMsg: string; context_dict: ChatsInfo[]; total: number }>(
    '/user/searchChat', params
  )
}

export function delGPTListMessage(params:{userId:number,chat_id:string}){
  return request.post('/user/deleteChat',params)
}

export function delGPTListAll(params:{userId:number}){
  return request.post('/user/deleteAllChat',params)
}

export function postLogin(params: Login) {
  return request.post('/user/verify', params)
}

export function postRegister(params: Register) {
  return request.post('/user/register', params)
}

export function suggestAnonymousUsername() {
  return request.post('/user/anonymous/username', {})
}

export function sendPasswordCode(params: { email: string }) {
  return request.post('/user/password/send_code', params)
}

export function resetPassword(params: { email: string; code: string; password: string }) {
  return request.post('/user/password/reset', params)
}

export function updateProfile(params: {
  name: string
  telephone?: string
  email?: string
  old_password?: string
  new_password?: string
}) {
  return request.post('/user/profile/update', params)
}

export function postChatCompletions(
  params: any,option:any
) {
  return request.gptPost('/user/gpt/ask',params,option)
}

export function postStreamChatCompletions(params: {
  model: string
  messages: ChatMessage[]
  stream: true
  max_tokens?: number
}, signal: AbortSignal): Promise<Response & { llmProtocol?: LlmProtocol }> {
  let phone = ''
  try {
    phone = getLlmApiKey('调用 LLM', true)
  } catch (error) {
    return Promise.reject(error)
  }

  const { protocol, path, body } = buildLlmRequestBody(params)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${phone}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream'
  }
  if (protocol === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01'
    headers['x-api-key'] = phone
  }

  const send = (payload: Record<string, unknown>) =>
    fetch(`${llmBaseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    })

  return send(body).then(async (response) => {
    // 模型实际只接受另一种长度字段时，换字段再发一次，避免对话直接失败。
    if (!response.ok && protocol === 'openai') {
      const preview = await response.clone().text().catch(() => '')
      const alternate = swapTokenLimitField(body)
      if (alternate && errorWantsOtherTokenLimit(preview)) {
        const retried = await send(alternate)
        Object.defineProperty(retried, 'llmProtocol', { value: protocol, enumerable: false })
        return retried as Response & { llmProtocol: LlmProtocol }
      }
    }
    Object.defineProperty(response, 'llmProtocol', { value: protocol, enumerable: false })
    return response as Response & { llmProtocol: LlmProtocol }
  })
}

export function addUserMessages(params:{userId:string}){
  return request.post('/user/createChat',params)
}

export function saveChatMessage(params: {
  userId: number | string
  contextId: string | number
  prompt: string
  gpt: string
  mode?: string
  start_time?: string
  answer_time?: string
}) {
  return request.post('/user/saveChatMessage', {
    userId: Number(params.userId),
    contextId: String(params.contextId),
    prompt: params.prompt,
    gpt: params.gpt,
    mode: params.mode,
    start_time: params.start_time,
    answer_time: params.answer_time
  })
}

export function getMessageList(params:{userId:string}){
  return request.post('/user/getContextList',params)
}

export function gptAsk(params:any,option:any){
  return request.gptPost('/user/gpt/ask',params,option)
}

export function getUserInfo() {
  return request.get<UserInfo>('/api/user/info')
}

export function getCode(params: { source: string }) {
  return request.post('/api/send_sms', params)
}

export function putUserPassword(params: RequestLoginParams) {
  return request.put('/api/user/password', params)
}

export function getConfig() {
  return request.get<ResponseConfigData>('/api/config')
}

export function postFeedback(params: {
  content: string
  contact?: string
  nickname?: string
  anonymous?: boolean
  userId?: number | null
}) {
  return request.post('/user/feedback', params)
}

export function getFeedbackList(params: { page?: number; page_num?: number }) {
  return request.post('/user/feedback/list', {
    page: params.page || 1,
    page_num: params.page_num || 10
  })
}

export type TaskStatus = 'running' | 'failed' | 'done'
export type TaskScope = 'open' | 'all' | TaskStatus

export type TaskItem = {
  id: number
  user_id: number | null
  account: string
  model: string
  source: string
  path: string
  status: TaskStatus
  status_source: 'log' | 'manual' | string
  suggested_status: TaskStatus
  finish: string
  result: string
  decision: string
  steps: number
  last_request_id: string
  http_status: number | null
  started_at: string | null
  updated_at: string | null
}

export type TaskCounts = {
  open: number
  all: number
  running: number
  failed: number
  done: number
}

export type TaskListResponse = {
  total: number
  limit: number
  offset: number
  scope: string
  counts: TaskCounts
  items: TaskItem[]
}

async function taskFetch(path: string, init: RequestInit = {}) {
  const response = await llmFetch(path, init, '查询任务')
  return response.json()
}

export function getTaskList(params: { scope?: TaskScope; account?: string; limit?: number; offset?: number }) {
  const q = new URLSearchParams()
  q.set('scope', params.scope || 'open')
  q.set('limit', String(params.limit ?? 50))
  q.set('offset', String(params.offset ?? 0))
  if (params.account) q.set('account', params.account)
  return taskFetch(`/tasks?${q}`) as Promise<TaskListResponse>
}

export function updateTaskStatus(params: { id: number; status: TaskStatus }) {
  return taskFetch('/tasks/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  }) as Promise<{ item: TaskItem }>
}

export function reevaluateTask(id: number) {
  return taskFetch('/tasks/reevaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }) as Promise<{ item: TaskItem }>
}

export function completeAllTasks(account?: string) {
  return taskFetch('/tasks/complete-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: account || null })
  }) as Promise<{ updated: number }>
}

export function deleteTask(id: number) {
  return taskFetch('/tasks/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  }) as Promise<{ deleted: number }>
}

export function deleteDoneTasks(account?: string) {
  return taskFetch('/tasks/delete-done', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: account || null })
  }) as Promise<{ deleted: number }>
}

export function getAdminOverview() {
  return request.post('/user/admin/overview', {})
}

export function getSession() {
  return request.post('/user/session', {})
}

export function getAdminUsers(params: { page?: number; page_num?: number; keyword?: string }) {
  return request.post('/user/admin/users', {
    page: params.page || 1,
    page_num: params.page_num || 10,
    keyword: params.keyword || ''
  })
}

export function updateAdminUser(params: {
  userId: number
  token?: number
  discount?: number
  money_rate?: number
  is_delete?: boolean
  is_staff?: boolean
  username?: string
  password?: string
  username_login?: boolean
}) {
  return request.post('/user/admin/user/update', params)
}

export function createAdminUser(params: {
  username: string
  password: string
  name?: string
  email?: string
  telephone?: string
  token?: number
  username_login?: boolean
  is_staff?: boolean
}) {
  return request.post('/user/admin/user/create', params)
}

export function getAdminFeedback(params: { page?: number; page_num?: number; only_unread?: boolean }) {
  return request.post('/user/admin/feedback', {
    page: params.page || 1,
    page_num: params.page_num || 10,
    only_unread: Boolean(params.only_unread)
  })
}

export function updateAdminFeedback(params: {
  id: number
  is_read?: boolean
  is_delete?: boolean
  reply?: string
}) {
  return request.post('/user/admin/feedback/update', params)
}

/**
 * 彻底删除一条留言（2026-10-24 站长需求：「留言给我一个删除的按钮，后台的，不然删不掉」）
 * ------------------------------------------------------------
 * 原来的「隐藏」只是 `is_delete: true` 标记，数据仍在库里，列表里还能点「恢复」，
 * 站长要的是真正删掉。这里单独开一个接口，**等后端在
 * `POST /user/admin/feedback/delete` 实现后即生效**；后端未就绪时前端会
 * 明确提示「后端接口未接入」，不会静默失败。
 * 参数只用 id，不要传整条数据。
 */
export function deleteAdminFeedback(params: { id: number }) {
  return request.post('/user/admin/feedback/delete', params)
}

export function getAdminOrders(params: { page?: number; page_num?: number; userId?: number }) {
  return request.post('/user/admin/orders', {
    page: params.page || 1,
    page_num: params.page_num || 10,
    userId: params.userId || null
  })
}

export type AnnouncementItem = {
  id: number
  title: string
  content: string
  sort: number
  status: number
  insert_time: string
  update_time: string
  is_delete?: boolean
}

export function getAnnouncementList(params: { page?: number; page_num?: number }) {
  return request.post('/user/announcement/list', {
    page: params.page || 1,
    page_num: params.page_num || 10
  })
}

export function getLatestAnnouncement() {
  return request.post('/user/announcement/latest', {})
}

export function getAdminAnnouncement(params: { page?: number; page_num?: number }) {
  return request.post('/user/admin/announcement', {
    page: params.page || 1,
    page_num: params.page_num || 10
  })
}

export function createAdminAnnouncement(params: {
  title: string
  content: string
  status?: number
  sort?: number
}) {
  return request.post('/user/admin/announcement/create', params)
}

export function updateAdminAnnouncement(params: {
  id: number
  title?: string
  content?: string
  status?: number
  sort?: number
  is_delete?: boolean
}) {
  return request.post('/user/admin/announcement/update', params)
}

export type SoftwareLink = {
  label: string
  url: string
  code?: string
}

export type SoftwareCategoryItem = {
  id: number
  name: string
  sort: number
  status: number
  insert_time: string
  update_time: string
  is_delete?: boolean
}

export type SoftwareItem = {
  id: number
  category_id: number
  category_name: string
  name: string
  summary: string
  cover_url: string
  version: string
  links: SoftwareLink[]
  sort: number
  status: number
  insert_time: string
  update_time: string
  is_delete?: boolean
}

export function getSoftwareCategories() {
  return request.post('/user/software/category/list', {})
}

export function getSoftwareList(params: {
  page?: number
  page_num?: number
  category_id?: number | null
  keyword?: string
}) {
  return request.post('/user/software/list', {
    page: params.page || 1,
    page_num: params.page_num || 12,
    category_id: params.category_id || null,
    keyword: params.keyword || ''
  })
}

export function getAdminSoftwareCategories(params: { page?: number; page_num?: number }) {
  return request.post('/user/admin/software/category', {
    page: params.page || 1,
    page_num: params.page_num || 10
  })
}

export function createAdminSoftwareCategory(params: { name: string; status?: number; sort?: number }) {
  return request.post('/user/admin/software/category/create', params)
}

export function updateAdminSoftwareCategory(params: {
  id: number
  name?: string
  status?: number
  sort?: number
  is_delete?: boolean
}) {
  return request.post('/user/admin/software/category/update', params)
}

export function getAdminSoftware(params: {
  page?: number
  page_num?: number
  category_id?: number | null
  keyword?: string
}) {
  return request.post('/user/admin/software', {
    page: params.page || 1,
    page_num: params.page_num || 10,
    category_id: params.category_id || null,
    keyword: params.keyword || ''
  })
}

export function createAdminSoftware(params: {
  category_id: number
  name: string
  summary?: string
  cover_url?: string
  version?: string
  links: SoftwareLink[]
  status?: number
  sort?: number
}) {
  return request.post('/user/admin/software/create', params)
}

export function updateAdminSoftware(params: {
  id: number
  category_id?: number
  name?: string
  summary?: string
  cover_url?: string
  version?: string
  links?: SoftwareLink[]
  status?: number
  sort?: number
  is_delete?: boolean
}) {
  return request.post('/user/admin/software/update', params)
}

function isModelRequestPath(path: string) {
  return /\/(chat\/completions|messages|responses|embeddings|images|audio)(\/|$)/.test(path)
    || path.includes(':generateContent')
    || path.includes('/v1beta/')
}

function getLlmApiKey(action = '请求 LLM 接口', forModel = false) {
  const state = userStore.getState()
  const stored = (state.llm_api_key || '').trim()
  if (stored.startsWith('sk-')) return stored
  const info = state.user_info as
    | { data?: { bodyMessage?: { telephone?: string; allow_phone_key?: boolean } }; telephone?: string }
    | undefined
  const phone = info?.data?.bodyMessage?.telephone || info?.telephone || ''
  const allow = state.allow_phone_key ?? info?.data?.bodyMessage?.allow_phone_key
  // 生成过 sk- 后，手机号只能用于价目、用量、列表等，不能再请求模型。
  if (forModel && allow === false) {
    throw new Error(`请先到「Agent 接入」页创建并选择 sk- 密钥后再${action}`)
  }
  if (/^1[3-9]\d{9}$/.test(stored)) return stored
  if (phone) return phone
  throw new Error(`没有可用密钥，无法${action}`)
}

export type UserApiKeyItem = {
  id: number
  name: string
  key_mask: string
  is_active: boolean
  created_at: string
  api_key?: string
}

export function listUserApiKeys() {
  return request.post('/user/api_key/list', {})
}

export function createUserApiKey(name: string) {
  return request.post('/user/api_key/create', { name })
}

export function disableUserApiKey(id: number) {
  return request.post('/user/api_key/disable', { id })
}

export function enableUserApiKey(id: number) {
  return request.post('/user/api_key/enable', { id })
}

export function deleteUserApiKey(id: number) {
  return request.post('/user/api_key/delete', { id })
}

async function llmFetch(path: string, init: RequestInit = {}, action = '请求 LLM 接口') {
  const phone = getLlmApiKey(action, isModelRequestPath(path))
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${phone}`)
  const response = await fetch(`${llmBaseUrl}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? 'no-store'
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${action}失败 (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return response
}

export type GlobalPricing = {
  usd_cny_rate: number
  profit_multiplier: number
}

export async function getGlobalPricing(): Promise<GlobalPricing> {
  const response = await llmFetch('/admin/pricing', { method: 'GET' }, '费率读取')
  return response.json() as Promise<GlobalPricing>
}

export async function updateGlobalPricing(settings: GlobalPricing): Promise<void> {
  await llmFetch(
    '/admin/pricing',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    },
    '费率更新'
  )
}

export type CatalogKindPolicy = {
  enabled: boolean
  cost_rate?: number | null
}

export type CatalogPolicy = {
  providers: Record<string, CatalogKindPolicy>
}

export type VendorKeyInfo = {
  id: number
  name: string
  api_key_hint: string
  is_default: boolean
  is_active: boolean
  note?: string
}

export type UpstreamVendor = {
  id?: number
  code: string
  name: string
  base_url: string
  has_api_key?: boolean
  api_key_hint?: string
  /** 该供应商下可命名的多把 Key，只回掩码 */
  keys?: VendorKeyInfo[]
  pricing_url?: string | null
  pricing_mode?: 'manual' | 'catalog_rate' | string
  cost_rate?: number | null
  catalog_policy?: CatalogPolicy | null
  profit_multiplier?: number | null
  is_default?: boolean
  is_current?: boolean
  is_active?: boolean
  model_count?: number
  sort_order?: number
  last_synced_at?: string | null
  balance?: VendorBalance | null
}

export type VendorBalance = {
  ok: boolean
  vendor: string
  value: number | null
  currency: string
  fetched_at?: string | null
  error?: string
}

export type VendorsResponse = {
  current_vendor: string | null
  vendors: UpstreamVendor[]
}

export type VendorUpsertPayload = {
  code: string
  name: string
  base_url: string
  api_key?: string | null
  pricing_url?: string | null
  pricing_mode?: 'manual' | 'catalog_rate' | string
  cost_rate?: number | null
  catalog_policy?: CatalogPolicy | null
  profit_multiplier?: number | null
  is_active?: boolean
  is_default?: boolean
  sort_order?: number
  reapply_catalog?: boolean
}

export type VendorModelCost = {
  model: string
  service_tier?: string
  kind?: string
  catalog_provider?: string
  display_name?: string
  owned_by?: string
  input: number
  output: number
  cache_read?: number
  cache_write?: number
  /** 可选原价（USD/1M）。设置后 1:1 按原价计美元，人民币扣费只乘汇率 */
  original_input?: number | null
  original_output?: number | null
  original_cache_read?: number | null
  original_cache_write?: number | null
  /** 按官方倍数从本行短上下文成本价换算，不单独入库 */
  long_context?: LongContextRate | null
}

export type VendorModelPricePayload = {
  service_tier?: string
  kind?: string
  display_name?: string
  owned_by?: string
  input: number
  output: number
  cache_read?: number
  cache_write?: number
  original_input?: number | null
  original_output?: number | null
  original_cache_read?: number | null
  original_cache_write?: number | null
}

function normalizeVendorModelList(data: unknown): VendorModelCost[] {
  if (Array.isArray(data)) return data as VendorModelCost[]
  if (data && typeof data === 'object') {
    const obj = data as { models?: VendorModelCost[]; items?: VendorModelCost[]; prices?: VendorModelCost[] }
    if (Array.isArray(obj.models)) return obj.models
    if (Array.isArray(obj.items)) return obj.items
    if (Array.isArray(obj.prices)) return obj.prices
  }
  return []
}

export async function getVendors(signal?: AbortSignal): Promise<VendorsResponse> {
  const response = await llmFetch('/vendors', { method: 'GET', signal }, '获取供应商列表')
  return response.json() as Promise<VendorsResponse>
}

/** 管理端：含 pricing_mode / cost_rate */
export async function getAdminVendors(signal?: AbortSignal): Promise<VendorsResponse> {
  const response = await llmFetch('/admin/vendors', { method: 'GET', signal }, '获取供应商管理列表')
  return response.json() as Promise<VendorsResponse>
}

export async function upsertVendor(payload: VendorUpsertPayload): Promise<UpstreamVendor | void> {
  const response = await llmFetch(
    '/admin/vendors',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存供应商'
  )
  const text = await response.text()
  if (!text) return
  try {
    return JSON.parse(text) as UpstreamVendor
  } catch {
    return
  }
}

export async function activateVendor(code: string): Promise<void> {
  await llmFetch(`/admin/vendors/${encodeURIComponent(code)}/activate`, { method: 'POST' }, '切换当前供应商')
}

function vendorKeyPath(code: string, keyId?: number): string {
  const base = `/admin/vendors/${encodeURIComponent(code)}/keys`
  return keyId == null ? base : `${base}/${keyId}`
}

export async function getVendorKeys(code: string): Promise<{ keys: VendorKeyInfo[] }> {
  const response = await llmFetch(vendorKeyPath(code), { method: 'GET' }, '读取供应商 Key')
  return response.json()
}

export async function createVendorKey(
  code: string,
  payload: { name: string; api_key: string; note?: string }
): Promise<{ key: VendorKeyInfo; keys: VendorKeyInfo[] }> {
  const response = await llmFetch(
    vendorKeyPath(code),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '新增供应商 Key'
  )
  return response.json()
}

export async function updateVendorKey(
  code: string,
  keyId: number,
  payload: {
    name?: string
    /** 不传表示保持原密钥 */
    api_key?: string
    note?: string
    is_active?: boolean
    is_default?: boolean
  }
): Promise<{ key: VendorKeyInfo; keys: VendorKeyInfo[] }> {
  const response = await llmFetch(
    vendorKeyPath(code, keyId),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存供应商 Key'
  )
  return response.json()
}

export async function deleteVendorKey(code: string, keyId: number): Promise<{ keys: VendorKeyInfo[] }> {
  const response = await llmFetch(vendorKeyPath(code, keyId), { method: 'DELETE' }, '删除供应商 Key')
  return response.json()
}

export async function refreshVendorPricing(code: string): Promise<{ ok: boolean; updated?: boolean; count?: number; error?: string }> {
  const response = await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/refresh`,
    { method: 'POST' },
    '同步供应商价目'
  )
  return response.json()
}

export async function getVendorBalance(code: string, refresh = false): Promise<VendorBalance> {
  const q = refresh ? '?refresh=true' : ''
  const response = await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/balance${q}`,
    { method: 'GET' },
    '查询号商余额'
  )
  return response.json()
}

/** 管理端：官方标准价目录；可带 cost_rate 预览倍率后成本价 */
export async function getOfficialPricingCatalog(costRate?: number): Promise<{
  currency: string
  price_unit: string
  source: string
  cost_rate: number | null
  count: number
  models: VendorModelCost[]
}> {
  const q = costRate != null && costRate > 0 ? `?cost_rate=${encodeURIComponent(String(costRate))}` : ''
  const response = await llmFetch(`/admin/pricing/catalog${q}`, { method: 'GET' }, '读取官方价目目录')
  return response.json()
}

/** catalog_rate 供应商：按最新官方目录 × 已存倍率重写价目 */
export async function reapplyVendorCatalog(code: string): Promise<{
  ok: boolean
  vendor: string
  cost_rate: number
  count: number
  pricing_mode: string
}> {
  const response = await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/reapply-catalog`,
    { method: 'POST' },
    '按标准价重算'
  )
  return response.json()
}

/** 管理端：列出某供应商原始美元成本价 */
export async function getAdminVendorModels(code: string): Promise<VendorModelCost[]> {
  const response = await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/models`,
    { method: 'GET' },
    '读取供应商成本价'
  )
  return normalizeVendorModelList(await response.json())
}

/** 管理端：读单个模型成本价 */
export async function getAdminVendorModel(
  code: string,
  model: string,
  serviceTier = 'standard'
): Promise<VendorModelCost> {
  const q = new URLSearchParams({ service_tier: serviceTier })
  const response = await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/models/${encodeURIComponent(model)}?${q}`,
    { method: 'GET' },
    '读取模型成本价'
  )
  const data = await response.json()
  if (data && typeof data === 'object' && (data as { price?: VendorModelCost }).price) {
    return (data as { price: VendorModelCost }).price
  }
  return data as VendorModelCost
}

/** 管理端：单独改某个模型成本价（新增或覆盖） */
export async function updateAdminVendorModel(
  code: string,
  model: string,
  payload: VendorModelPricePayload
): Promise<VendorModelCost | void> {
  const response = await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/models/${encodeURIComponent(model)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '更新模型成本价'
  )
  const text = await response.text()
  if (!text) return
  try {
    const data = JSON.parse(text) as { price?: VendorModelCost } & VendorModelCost
    return data.price || data
  } catch {
    return
  }
}

/** 管理端：删除某个模型成本价（软删） */
export async function deleteAdminVendorModel(
  code: string,
  model: string,
  serviceTier = 'standard'
): Promise<void> {
  const q = new URLSearchParams({ service_tier: serviceTier })
  await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/models/${encodeURIComponent(model)}?${q}`,
    { method: 'DELETE' },
    '删除模型成本价'
  )
}

/** 管理端：批量写入模型成本价 */
export async function upsertVendorModels(code: string, models: VendorModelCost[]): Promise<void> {
  await llmFetch(
    `/admin/vendors/${encodeURIComponent(code)}/models`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ models })
    },
    '批量写入供应商模型价'
  )
}

export type LongContextRate = {
  /** prompt token 阈值。prompt = 非缓存输入 + 缓存读取 + 缓存写入 */
  threshold: number
  /** gt：超过阈值；ge：达到阈值 */
  op: 'gt' | 'ge'
  input: number
  output: number
  cache_read: number
  cache_write: number
  input_multiplier?: number
  output_multiplier?: number
}

export type UserModelRate = {
  model: string
  display_name?: string
  owned_by?: string
  service_tier: string
  unit: string
  input: number
  output: number
  cache_read: number
  cache_write: number
  /** 该档公布了长上下文差价时才有；价格已含利润与用户倍率 */
  long_context?: LongContextRate | null
}

export type UserImageModelRate = {
  model: string
  display_name?: string
  owned_by?: string
  service_tier?: string
  /** per_image = 按张（Teamo GPT Image）；token = 按百万 tokens */
  billing?: 'per_image' | 'token' | string
  unit?: string
  text_input: number
  image_input: number
  output: number
  /** Teamo 按输出最长边：1k / 2k / 4k，单位 USD / 张（已含利润与用户倍率） */
  per_image_tiers?: Record<string, number>
}

export type UserPricing = {
  currency: 'USD' | string
  price_unit: string
  vendor?: {
    code: string
    name: string
    base_url: string
    is_current?: boolean
    last_synced_at?: string | null
  }
  usd_cny_rate: number
  profit_multiplier: number
  money_rate: number
  discount: number
  model_ids?: string[]
  models: UserModelRate[]
  image_models: UserImageModelRate[]
}

export type ModelRouteUser = {
  user_id: number
  name?: string
  telephone?: string
  email?: string
}

export type ModelRouteRule = {
  id: number
  model: string
  vendor_code: string
  is_active: boolean
  has_api_key?: boolean
  api_key_hint?: string
  /** 指定该供应商下的某把命名 Key */
  api_key_id?: number | null
  /** 后端回传的 Key 名称，便于列表展示 */
  key_name?: string
  /** 空数组表示全部用户 */
  user_ids?: number[]
  users?: ModelRouteUser[]
  /** 分组批量规则的分组名；空表示单模型规则 */
  group_name?: string
  note?: string
  created_at?: string
  updated_at?: string
}

export async function getAdminModelRoutes(signal?: AbortSignal): Promise<{
  routes: ModelRouteRule[]
  vendors: UpstreamVendor[]
}> {
  const response = await llmFetch('/admin/model-routes', { method: 'GET', signal }, '读取模型路由')
  return response.json()
}

export async function upsertAdminModelRoute(payload: {
  id?: number
  model: string
  vendor_code: string
  is_active?: boolean
  note?: string
  /** 不传表示保持原密钥；空字符串表示清除覆盖，改回供应商密钥 */
  api_key?: string
  /** 使用该供应商下的哪把命名 Key；0 表示清除 */
  api_key_id?: number
  /** 不传表示保持原名单；空数组表示全部用户 */
  user_ids?: number[]
  /** 分组名：同组共用 vendor/Key/用户名单 */
  group_name?: string
  /** 分组批量：一次把多个对外模型名指向同一上游；传了它就以它为准 */
  models?: string[]
}): Promise<{ ok: boolean; route: ModelRouteRule; routes: ModelRouteRule[] }> {
  const response = await llmFetch(
    '/admin/model-routes',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存模型路由'
  )
  return response.json()
}

export async function deleteAdminModelRoute(id: number): Promise<void> {
  await llmFetch(`/admin/model-routes/${id}`, { method: 'DELETE' }, '删除模型路由')
}

export type UserModelPriceRule = {
  id: number
  user_id: number
  model: string
  service_tier: string
  /** 以下均为 USD / 1M tokens，命中后即用户最终应付价（计时只再乘汇率） */
  input: number
  output: number
  cache_read: number
  cache_write: number
  text_input: number
  image_input: number
  per_image_tiers?: Record<string, number> | null
  is_active: boolean
  note?: string
  user?: { user_id: number; name?: string; telephone?: string; email?: string }
  created_at?: string
  updated_at?: string
}

export async function getAdminUserModelPrices(signal?: AbortSignal): Promise<{ prices: UserModelPriceRule[] }> {
  const response = await llmFetch('/admin/user-model-prices', { method: 'GET', signal }, '读取用户专属价')
  return response.json()
}

export async function upsertAdminUserModelPrice(payload: {
  id?: number
  user_id: number
  model: string
  service_tier?: string
  input_price: number
  output_price: number
  cache_read_price?: number
  cache_write_price?: number
  text_input_price?: number
  image_input_price?: number
  per_image_tiers?: Record<string, number> | null
  is_active?: boolean
  note?: string
}): Promise<{ ok: boolean; price: UserModelPriceRule; prices: UserModelPriceRule[] }> {
  const response = await llmFetch(
    '/admin/user-model-prices',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存用户专属价'
  )
  return response.json()
}

export async function deleteAdminUserModelPrice(id: number): Promise<void> {
  await llmFetch(`/admin/user-model-prices/${id}`, { method: 'DELETE' }, '删除用户专属价')
}

export type ModelRewriteRule = {
  id: number
  /** 请求里的旧模型，可带末尾 * 表示前缀 */
  model: string
  /** 实际转发、记账、计费使用的模型 */
  target_model: string
  is_active: boolean
  user_ids?: number[]
  users?: ModelRouteUser[]
  note?: string
  created_at?: string
  updated_at?: string
}

export async function getAdminModelRewrites(signal?: AbortSignal): Promise<{ rewrites: ModelRewriteRule[] }> {
  const response = await llmFetch('/admin/model-rewrites', { method: 'GET', signal }, '读取模型改写')
  return response.json()
}

export async function upsertAdminModelRewrite(payload: {
  id?: number
  model: string
  target_model: string
  is_active?: boolean
  note?: string
  /** 不传表示保持原名单；空数组表示全部用户 */
  user_ids?: number[]
}): Promise<{ ok: boolean; rewrite: ModelRewriteRule; rewrites: ModelRewriteRule[] }> {
  const response = await llmFetch(
    '/admin/model-rewrites',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存模型改写'
  )
  return response.json()
}

export async function deleteAdminModelRewrite(id: number): Promise<void> {
  await llmFetch(`/admin/model-rewrites/${id}`, { method: 'DELETE' }, '删除模型改写')
}

export async function replaceAdminModelRouteKeys(payload: {
  model: string
  api_key: string
}): Promise<{ ok: boolean; updated: number; models: string[]; routes: ModelRouteRule[] }> {
  const response = await llmFetch(
    '/admin/model-routes/replace-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '按模型替换密钥'
  )
  return response.json()
}

export type ModelProtocolRule = {
  id: number
  model: string
  protocol: 'openai' | 'anthropic' | 'responses' | string
  is_active: boolean
  note?: string
  created_at?: string
  updated_at?: string
}

export async function getAdminModelProtocols(signal?: AbortSignal): Promise<{ protocols: ModelProtocolRule[] }> {
  const response = await llmFetch('/admin/model-protocols', { method: 'GET', signal }, '读取模型协议')
  return response.json()
}

export async function upsertAdminModelProtocol(payload: {
  id?: number
  model: string
  protocol: string
  is_active?: boolean
  note?: string
}): Promise<{ ok: boolean; protocol: ModelProtocolRule; protocols: ModelProtocolRule[] }> {
  const response = await llmFetch(
    '/admin/model-protocols',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存模型协议'
  )
  return response.json()
}

export async function deleteAdminModelProtocol(id: number): Promise<void> {
  await llmFetch(`/admin/model-protocols/${id}`, { method: 'DELETE' }, '删除模型协议')
}

export type ModelAliasRule = {
  id: number
  alias: string
  target_model: string
  protocol: 'auto' | 'openai' | 'anthropic' | 'responses' | string
  hide_target: boolean
  is_active: boolean
  note?: string
  created_at?: string
  updated_at?: string
}

export async function getAdminModelAliases(signal?: AbortSignal): Promise<{ aliases: ModelAliasRule[] }> {
  const response = await llmFetch('/admin/model-aliases', { method: 'GET', signal }, '读取模型别名')
  return response.json()
}

export async function upsertAdminModelAlias(payload: {
  id?: number
  alias: string
  target_model: string
  protocol?: string
  hide_target?: boolean
  is_active?: boolean
  note?: string
}): Promise<{ ok: boolean; alias: ModelAliasRule; aliases: ModelAliasRule[] }> {
  const response = await llmFetch(
    '/admin/model-aliases',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存模型别名'
  )
  return response.json()
}

export async function deleteAdminModelAlias(id: number): Promise<void> {
  await llmFetch(`/admin/model-aliases/${id}`, { method: 'DELETE' }, '删除模型别名')
}

export type PromptInjectionScope = 'all' | 'category' | 'model'
export type PromptInjectionPosition = 'append' | 'prepend' | 'first'

export type PromptInjectionRule = {
  id: number
  name: string
  scope: PromptInjectionScope | string
  target: string
  content: string
  position: PromptInjectionPosition | string
  is_active: boolean
  sort_order: number
  note?: string
  created_at?: string
  updated_at?: string
}

export async function getAdminPromptInjections(signal?: AbortSignal): Promise<{ injections: PromptInjectionRule[] }> {
  const response = await llmFetch('/admin/prompt-injections', { method: 'GET', signal }, '读取 Prompt 注入')
  return response.json()
}

export async function upsertAdminPromptInjection(payload: {
  id?: number
  name: string
  scope: string
  target?: string
  content: string
  position?: string
  is_active?: boolean
  sort_order?: number
  note?: string
}): Promise<{ ok: boolean; injection: PromptInjectionRule; injections: PromptInjectionRule[] }> {
  const response = await llmFetch(
    '/admin/prompt-injections',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    '保存 Prompt 注入'
  )
  return response.json()
}

export async function deleteAdminPromptInjection(id: number): Promise<void> {
  await llmFetch(`/admin/prompt-injections/${id}`, { method: 'DELETE' }, '删除 Prompt 注入')
}

export async function getUserPricing(params?: {
  vendor?: string
  baseUrl?: string
  signal?: AbortSignal
}): Promise<UserPricing> {
  const q = new URLSearchParams()
  if (params?.vendor) q.set('vendor', params.vendor)
  else if (params?.baseUrl) q.set('base_url', params.baseUrl)
  const suffix = q.toString() ? `?${q}` : ''
  const response = await llmFetch(`/pricing/models${suffix}`, { method: 'GET', signal: params?.signal }, '获取模型价目')
  return response.json() as Promise<UserPricing>
}

export type ImageGenerationParams = {
  model: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  response_format?: 'b64_json' | 'url'
}

export type ImageEditParams = ImageGenerationParams & {
  image: File
  /** 透明区域会被重绘，尺寸需与原图一致；不传则整图按提示词重绘 */
  mask?: File | null
  /** gpt-image：high 更贴原图细节，low 允许更大改动 */
  input_fidelity?: 'high' | 'low'
}

export type ImageGenerationResult = {
  created?: number
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string; mime?: string }>
  billing?: {
    notice?: string
    charged?: number
    profit?: number
    remain?: number
  }
}

/** TeamRouter / OpenAI 兼容：POST /v1/images/generations */
export async function postImagesGenerations(
  params: ImageGenerationParams,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  const response = await llmFetch(
    '/images/generations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        n: params.n ?? 1,
        size: params.size || '1024x1024',
        quality: params.quality || 'auto',
        response_format: params.response_format || 'b64_json'
      }),
      signal
    },
    '图像生成'
  )
  return response.json() as Promise<ImageGenerationResult>
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return btoa(binary)
}

/** 本地读出的图片转成 data URL，放进 JSON，由中转原样转发，不走文件上传存储 */
async function imageFileToDataUrl(file: Blob): Promise<string> {
  const mime = file.type || 'image/png'
  return `data:${mime};base64,${await blobToBase64(file)}`
}

/** TeamRouter / OpenAI 兼容：POST /v1/images/edits。图片数据在请求体里转发，不单独存盘 */
export async function postImagesEdits(
  params: ImageEditParams,
  signal?: AbortSignal
): Promise<ImageGenerationResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    image: await imageFileToDataUrl(params.image),
    n: params.n ?? 1,
    size: params.size || '1024x1024',
    quality: params.quality || 'auto',
    response_format: params.response_format || 'b64_json'
  }
  if (params.mask) body.mask = await imageFileToDataUrl(params.mask)
  if (params.input_fidelity) body.input_fidelity = params.input_fidelity
  const response = await llmFetch(
    '/images/edits',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    },
    '图像编辑'
  )
  return response.json() as Promise<ImageGenerationResult>
}

export type UsageStatus = 'pending' | 'billed' | 'unbilled' | 'failed'

export type UsageItem = {
  request_id: string
  user_id: number | null
  model: string
  path: string
  source: string
  status: UsageStatus
  http_status: number | null
  input_tokens: number | null
  output_tokens: number | null
  cache_read_tokens: number | null
  cache_write_tokens: number | null
  /** short / long；该模型没有长短上下文差价时为空 */
  context_tier?: 'short' | 'long' | null
  charged_cny: number | null
  /** 这笔扣费之后的账户余额。未计费时为空 */
  balance_cny?: number | null
  cost_cny: number | null
  profit_cny: number | null
  /** 首字时延，毫秒。非流式或尚未记录时为空 */
  ttfb_ms?: number | null
  created_at: string | null
}

export type UsageResponse = {
  total: number
  limit: number
  offset: number
  items: UsageItem[]
}

/** 列表与 summary 共用的筛选参数 */
export type UsageQueryFilters = {
  userId?: number
  model?: string
  modelPrefix?: string
  status?: UsageStatus
  source?: string
  path?: string
  requestId?: string
  /** 起始时间（含），如 2026-09-01T00:00:00 */
  from?: string
  /** 结束时间（不含），如 2026-10-01T00:00:00 */
  to?: string
}

export type UsageSummary = {
  filters?: {
    user_id?: number | null
    model?: string | null
    model_prefix?: string | null
    status?: string | null
    source?: string | null
    path?: string | null
    request_id?: string | null
    from?: string | null
    to?: string | null
  }
  request_count: number
  billed_count?: number
  pending_count?: number
  unbilled_count?: number
  failed_count?: number
  sum_charged_cny: number | null
  /** 成功充值合计。只跟用户走，不受模型或时间筛选影响 */
  sum_recharge_cny?: number | null
  sum_cost_cny: number | null
  sum_profit_cny: number | null
  sum_input_tokens?: number | null
  sum_output_tokens?: number | null
  sum_cache_read_tokens?: number | null
  sum_cache_write_tokens?: number | null
}

export type UsageLatencyModel = {
  model: string
  window_count: number
  avg_ttfb_ms: number | null
  max_ttfb_ms: number | null
  latest_ttfb_ms: number | null
  alert: boolean
}

export type UsageLatency = {
  window: number
  alert_ms: number
  lookback_days: number | null
  models: UsageLatencyModel[]
}

function appendUsageFilters(q: URLSearchParams, filters?: UsageQueryFilters) {
  if (!filters) return
  if (filters.userId != null) q.set('user_id', String(filters.userId))
  if (filters.model) q.set('model', filters.model)
  else if (filters.modelPrefix) q.set('model_prefix', filters.modelPrefix)
  if (filters.status) q.set('status', filters.status)
  if (filters.source) q.set('source', filters.source)
  if (filters.path) q.set('path', filters.path)
  if (filters.requestId) q.set('request_id', filters.requestId)
  if (filters.from) q.set('from', filters.from)
  if (filters.to) q.set('to', filters.to)
}

export async function getRequestUsage(
  params: UsageQueryFilters & {
    limit?: number
    offset?: number
  } = {}
): Promise<UsageResponse> {
  const phone = getLlmApiKey('查询用量')
  const q = new URLSearchParams()
  q.set('limit', String(params.limit ?? 50))
  q.set('offset', String(params.offset ?? 0))
  appendUsageFilters(q, params)

  const response = await fetch(`${llmBaseUrl}/usage?${q}`, {
    headers: { Authorization: `Bearer ${phone}` }
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`用量查询失败 (${response.status}) ${text}`)
  }
  return response.json() as Promise<UsageResponse>
}

export async function getUsageSummary(filters: UsageQueryFilters = {}): Promise<UsageSummary> {
  const phone = getLlmApiKey('查询用量汇总')
  const q = new URLSearchParams()
  appendUsageFilters(q, filters)
  const suffix = q.toString() ? `?${q}` : ''

  const response = await fetch(`${llmBaseUrl}/usage/summary${suffix}`, {
    headers: { Authorization: `Bearer ${phone}` }
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`用量汇总失败 (${response.status}) ${text}`)
  }
  return response.json() as Promise<UsageSummary>
}

/** 按模型统计最近一个窗口的平均首字时延。筛选参数与用量查询一致。 */
export async function getUsageLatency(filters: UsageQueryFilters = {}): Promise<UsageLatency> {
  const phone = getLlmApiKey('查询首字时延')
  const q = new URLSearchParams()
  appendUsageFilters(q, filters)
  const suffix = q.toString() ? `?${q}` : ''

  const response = await fetch(`${llmBaseUrl}/usage/latency${suffix}`, {
    headers: { Authorization: `Bearer ${phone}` }
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`首字时延查询失败 (${response.status}) ${text}`)
  }
  return response.json() as Promise<UsageLatency>
}
