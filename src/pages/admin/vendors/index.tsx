import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Drawer,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message
} from 'antd'
import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  WalletOutlined
} from '@ant-design/icons'
import HorizontalDrag from '@/components/HorizontalDrag'
import {
  activateVendor,
  deleteAdminModelAlias,
  deleteAdminModelProtocol,
  deleteAdminModelRewrite,
  deleteAdminModelRoute,
  deleteAdminVendorModel,
  getAdminModelAliases,
  getAdminModelProtocols,
  getAdminModelRewrites,
  getAdminModelRoutes,
  getAdminUsers,
  getAdminVendorModels,
  getAdminVendors,
  getGlobalPricing,
  getOfficialPricingCatalog,
  createVendorKey,
  deleteVendorKey,
  getVendorBalance,
  getVendorKeys,
  reapplyVendorCatalog,
  refreshVendorPricing,
  replaceAdminModelRouteKeys,
  updateAdminVendorModel,
  updateVendorKey,
  upsertAdminModelAlias,
  upsertAdminModelProtocol,
  upsertAdminModelRewrite,
  upsertAdminModelRoute,
  upsertVendor,
  type ModelAliasRule,
  type ModelProtocolRule,
  type ModelRewriteRule,
  type ModelRouteRule,
  type ModelRouteUser,
  type CatalogPolicy,
  type UpstreamVendor,
  type VendorBalance,
  type VendorKeyInfo,
  type VendorModelCost,
  type VendorUpsertPayload
} from '@/request/api'
import { resolveProvider } from '@/data/modelPricing'
import styles from './index.module.less'

function routeUserLabel(user: ModelRouteUser) {
  const who = user.name || user.telephone || user.email || `#${user.user_id}`
  const extra = [user.telephone, user.email].filter((item) => item && item !== who).join(' / ')
  return extra ? `${who}（${extra}）` : who
}

function wildcardPrefix(pattern: string) {
  const text = pattern.trim().toLowerCase()
  if (text.length >= 3 && text.endsWith('*') && !text.slice(0, -1).includes('*')) return text.slice(0, -1)
  return ''
}

function composeModelPattern(model: string, matchPrefix: boolean) {
  const text = model.trim()
  if (!matchPrefix) return text
  const base = text.replace(/\*+$/g, '')
  if (base.length < 2 || base.includes('*')) {
    throw new Error('前缀至少 2 个字符，且不要包含 *，例如 gemini')
  }
  return `${base}*`
}

const PROTOCOL_OPTIONS = [
  { value: 'openai', label: 'OpenAI（/v1/chat/completions）' },
  { value: 'anthropic', label: 'Anthropic（/v1/messages）' },
  { value: 'responses', label: 'OpenAI Responses（/v1/responses）' }
]

function protocolLabel(value: string) {
  if (value === 'anthropic') return 'Anthropic'
  if (value === 'responses') return 'Responses'
  if (value === 'openai') return 'OpenAI'
  return value || '自动'
}

function routeQueryHits(ruleModel: string, query: string) {
  const rule = ruleModel.trim().toLowerCase()
  const text = query.trim().toLowerCase()
  if (!rule || !text) return false
  const rulePrefix = wildcardPrefix(rule)
  const queryPrefix = wildcardPrefix(text)
  if (rulePrefix) return (queryPrefix || text).startsWith(rulePrefix)
  if (queryPrefix) return rule.startsWith(queryPrefix)
  if (rule === text) return true
  if (rule.startsWith(`${text}-`) || text.startsWith(`${rule}-`)) return true
  if (!rule.includes('-') && text.split('-').includes(rule)) return true
  if (!text.includes('-') && rule.split('-').includes(text)) return true
  return false
}

type VendorFormValues = VendorUpsertPayload & {
  pricing_mode: 'manual' | 'catalog_rate'
  cost_rate?: number | null
  profit_multiplier?: number | null
  clear_api_key?: boolean
}

type EditableModelRow = VendorModelCost & {
  _key: string
  _dirty?: boolean
  _saving?: boolean
}

type ModelFormValues = {
  model: string
  service_tier: string
  kind: string
  input: number
  output: number
  cache_read: number
  cache_write: number
  original_input?: number | null
  original_output?: number | null
}

const PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'xai', label: 'Grok' },
  { id: 'google', label: 'Google' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'zhipu', label: '智谱' },
  { id: 'other', label: '其他' }
]

type ProviderPolicyMap = Record<string, { enabled: boolean; cost_rate: number | null }>

function defaultProviderPolicies(): ProviderPolicyMap {
  return Object.fromEntries(PROVIDER_OPTIONS.map((item) => [item.id, { enabled: true, cost_rate: null }]))
}

function catalogProviderOf(model: { model: string; owned_by?: string; catalog_provider?: string }) {
  if (model.catalog_provider) return model.catalog_provider
  return resolveProvider(model.model, model.owned_by)
}

function policyFromVendor(policy?: CatalogPolicy | null) {
  const providers = defaultProviderPolicies()
  for (const item of PROVIDER_OPTIONS) {
    const spec = policy?.providers?.[item.id]
    if (!spec) continue
    providers[item.id] = { enabled: spec.enabled !== false, cost_rate: spec.cost_rate ?? null }
  }
  return providers
}

function policyHint(policy?: CatalogPolicy | null) {
  if (!policy?.providers) return ''
  const bits: string[] = []
  for (const item of PROVIDER_OPTIONS) {
    const spec = policy.providers[item.id]
    if (!spec) continue
    if (spec.enabled === false) bits.push(`${item.label}不展示`)
    else if (spec.cost_rate) bits.push(`${item.label} ×${spec.cost_rate}`)
  }
  return bits.join(' · ')
}

function rowKey(model: string, tier?: string) {
  return `${model}::${tier || 'standard'}`
}

function formatBalanceTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function balanceColor(balance?: VendorBalance | null) {
  if (!balance?.ok || balance.value == null) return undefined
  if (balance.value < 5) return 'red'
  if (balance.value < 20) return 'orange'
  return 'green'
}

function AdminVendors() {
  const [loading, setLoading] = useState(false)
  const [actingCode, setActingCode] = useState('')
  const [error, setError] = useState('')
  const [vendors, setVendors] = useState<UpstreamVendor[]>([])
  const [currentVendor, setCurrentVendor] = useState<string | null>(null)
  const [globalMultiplier, setGlobalMultiplier] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<UpstreamVendor | null>(null)
  const [catalogModels, setCatalogModels] = useState<VendorModelCost[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [providerPolicies, setProviderPolicies] = useState<ProviderPolicyMap>(defaultProviderPolicies)
  const [modelOpen, setModelOpen] = useState(false)
  const [modelVendor, setModelVendor] = useState<UpstreamVendor | null>(null)
  const [modelRows, setModelRows] = useState<EditableModelRow[]>([])
  const [modelQuery, setModelQuery] = useState('')
  const [modelPage, setModelPage] = useState(1)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelSavingKey, setModelSavingKey] = useState('')
  const [form] = Form.useForm<VendorFormValues>()
  const [modelForm] = Form.useForm<ModelFormValues>()
  const [routes, setRoutes] = useState<ModelRouteRule[]>([])
  const [routeOpen, setRouteOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<ModelRouteRule | null>(null)
  const [routeSaving, setRouteSaving] = useState(false)
  const [routeTogglingId, setRouteTogglingId] = useState<number | null>(null)
  const [routeQuery, setRouteQuery] = useState('')
  const [replaceKey, setReplaceKey] = useState('')
  const [replacingKeys, setReplacingKeys] = useState(false)
  const [routeForm] = Form.useForm<{
    route_mode?: 'single' | 'group'
    model: string
    match_prefix?: boolean
    models?: string
    group_name?: string
    vendor_code: string
    api_key_id?: number | null
    is_active: boolean
    note?: string
    api_key?: string
    clear_api_key?: boolean
    user_ids?: number[]
  }>()
  const matchPrefix = Form.useWatch('match_prefix', routeForm)
  const routeMode = Form.useWatch('route_mode', routeForm) as string | undefined
  const routeVendorCode = Form.useWatch('vendor_code', routeForm)
  const [keyDrawer, setKeyDrawer] = useState<{ open: boolean; vendor: UpstreamVendor | null }>({
    open: false,
    vendor: null
  })
  const [keyRows, setKeyRows] = useState<VendorKeyInfo[]>([])
  const [keyLoading, setKeyLoading] = useState(false)
  const [keySaving, setKeySaving] = useState(false)
  const [editingKey, setEditingKey] = useState<VendorKeyInfo | null>(null)
  const [keyForm] = Form.useForm<{
    name: string
    api_key?: string
    note?: string
    is_active?: boolean
  }>()
  const [rewrites, setRewrites] = useState<ModelRewriteRule[]>([])
  const [rewriteOpen, setRewriteOpen] = useState(false)
  const [editingRewrite, setEditingRewrite] = useState<ModelRewriteRule | null>(null)
  const [rewriteSaving, setRewriteSaving] = useState(false)
  const [rewriteTogglingId, setRewriteTogglingId] = useState<number | null>(null)
  const [rewriteForm] = Form.useForm<{
    model: string
    match_prefix?: boolean
    target_model: string
    is_active: boolean
    note?: string
    user_ids?: number[]
  }>()
  const rewriteMatchPrefix = Form.useWatch('match_prefix', rewriteForm)
  const [rewriteUserOptions, setRewriteUserOptions] = useState<ModelRouteUser[]>([])
  const [rewriteUserSearching, setRewriteUserSearching] = useState(false)
  const rewriteUserSearchTimer = useRef<number | null>(null)
  const [protocols, setProtocols] = useState<ModelProtocolRule[]>([])
  const [protocolOpen, setProtocolOpen] = useState(false)
  const [editingProtocol, setEditingProtocol] = useState<ModelProtocolRule | null>(null)
  const [protocolSaving, setProtocolSaving] = useState(false)
  const [protocolForm] = Form.useForm<{
    model: string
    match_prefix?: boolean
    protocol: string
    is_active: boolean
    note?: string
  }>()
  const protocolMatchPrefix = Form.useWatch('match_prefix', protocolForm)
  const [routeUserOptions, setRouteUserOptions] = useState<ModelRouteUser[]>([])
  const [routeUserSearching, setRouteUserSearching] = useState(false)
  const routeUserSearchTimer = useRef<number | null>(null)
  const [aliases, setAliases] = useState<ModelAliasRule[]>([])
  const [aliasOpen, setAliasOpen] = useState(false)
  const [editingAlias, setEditingAlias] = useState<ModelAliasRule | null>(null)
  const [aliasSaving, setAliasSaving] = useState(false)
  const [aliasForm] = Form.useForm<{
    alias: string
    target_model: string
    protocol: string
    hide_target: boolean
    is_active: boolean
    note?: string
  }>()
  const pricingMode = Form.useWatch('pricing_mode', form)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAdminVendors()
      setVendors(data.vendors || [])
      setCurrentVendor(data.current_vendor)
      try {
        const pricing = await getGlobalPricing()
        setGlobalMultiplier(pricing.profit_multiplier)
      } catch {
        setGlobalMultiplier(null)
      }
      try {
        const routed = await getAdminModelRoutes()
        setRoutes(routed.routes || [])
      } catch {
        setRoutes([])
      }
      try {
        const rewritten = await getAdminModelRewrites()
        setRewrites(rewritten.rewrites || [])
      } catch {
        setRewrites([])
      }
      try {
        const routedProtocols = await getAdminModelProtocols()
        setProtocols(routedProtocols.protocols || [])
      } catch {
        setProtocols([])
      }
      try {
        const aliased = await getAdminModelAliases()
        setAliases(aliased.aliases || [])
      } catch {
        setAliases([])
      }
    } catch (err) {
      setVendors([])
      setCurrentVendor(null)
      setError(err instanceof Error ? err.message : '读取供应商失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!editorOpen || pricingMode !== 'catalog_rate') {
      setCatalogModels(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    void getOfficialPricingCatalog()
      .then((data) => {
        if (!cancelled) setCatalogModels(data.models || [])
      })
      .catch(() => {
        if (!cancelled) setCatalogModels(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editorOpen, pricingMode])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of catalogModels || []) {
      const type = catalogProviderOf(item)
      counts[type] = (counts[type] || 0) + 1
    }
    return counts
  }, [catalogModels])

  const previewCount = useMemo(() => {
    if (!catalogModels) return null
    return catalogModels.filter((item) => providerPolicies[catalogProviderOf(item)]?.enabled !== false).length
  }, [catalogModels, providerPolicies])

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      code: '',
      name: '',
      base_url: '',
      pricing_url: '',
      pricing_mode: 'catalog_rate',
      cost_rate: 0.2,
      profit_multiplier: null,
      is_active: true,
      is_default: false,
      sort_order: 100,
      reapply_catalog: true,
      api_key: '',
      clear_api_key: false
    })
    setProviderPolicies(policyFromVendor(null))
    setEditorOpen(true)
  }

  const openEdit = (vendor: UpstreamVendor) => {
    setEditing(vendor)
    form.setFieldsValue({
      code: vendor.code,
      name: vendor.name,
      base_url: vendor.base_url,
      pricing_url: vendor.pricing_url || '',
      pricing_mode: (vendor.pricing_mode as VendorFormValues['pricing_mode']) || 'manual',
      cost_rate: vendor.cost_rate ?? 0.2,
      profit_multiplier: vendor.profit_multiplier ?? null,
      is_active: vendor.is_active !== false,
      is_default: Boolean(vendor.is_default || vendor.is_current),
      sort_order: vendor.sort_order ?? 100,
      reapply_catalog: false,
      api_key: '',
      clear_api_key: false
    })
    setProviderPolicies(policyFromVendor(vendor.catalog_policy))
    setEditorOpen(true)
  }

  const saveVendor = async (values: VendorFormValues) => {
    const mode = values.pricing_mode || 'manual'
    if (mode === 'catalog_rate') {
      if (!PROVIDER_OPTIONS.some((item) => providerPolicies[item.id]?.enabled)) {
        message.error('请至少对外展示一家模型供应商')
        return
      }
    }
    setActingCode(values.code)
    setError('')
    try {
      const typedKey = (values.api_key || '').trim()
      const { clear_api_key: clearKey, api_key: _ignored, ...rest } = values
      const payload: VendorUpsertPayload = {
        ...rest,
        pricing_mode: mode,
        cost_rate: mode === 'catalog_rate' ? Number(values.cost_rate) : null,
        profit_multiplier: values.profit_multiplier ? Number(values.profit_multiplier) : null,
        pricing_url: mode === 'catalog_rate' ? null : values.pricing_url || null,
        reapply_catalog: mode === 'catalog_rate' ? Boolean(values.reapply_catalog || !editing) : false,
        catalog_policy:
          mode === 'catalog_rate'
            ? {
                providers: Object.fromEntries(
                  PROVIDER_OPTIONS.map((item) => [
                    item.id,
                    {
                      enabled: providerPolicies[item.id]?.enabled !== false,
                      cost_rate: providerPolicies[item.id]?.cost_rate ?? null
                    }
                  ])
                )
              }
            : undefined
      }
      if (typedKey) payload.api_key = typedKey
      else if (clearKey) payload.api_key = ''
      await upsertVendor(payload)
      message.success(editing ? '供应商已更新' : '供应商已创建')
      setEditorOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存供应商失败')
    } finally {
      setActingCode('')
    }
  }

  const openKeyDrawer = async (vendor: UpstreamVendor) => {
    setKeyDrawer({ open: true, vendor })
    setEditingKey(null)
    keyForm.resetFields()
    setKeyLoading(true)
    try {
      const data = await getVendorKeys(vendor.code)
      setKeyRows(data.keys || [])
    } catch (err) {
      message.error(err instanceof Error ? err.message : '读取 Key 失败')
    } finally {
      setKeyLoading(false)
    }
  }

  const refreshKeys = async (code: string, keys: VendorKeyInfo[]) => {
    setKeyRows(keys || [])
    setVendors((prev) =>
      prev.map((item) => (item.code === code ? { ...item, keys: keys || [] } : item))
    )
  }

  const startEditKey = (key: VendorKeyInfo) => {
    setEditingKey(key)
    keyForm.setFieldsValue({
      name: key.name,
      api_key: '',
      note: key.note || '',
      is_active: key.is_active
    })
  }

  const resetKeyForm = () => {
    setEditingKey(null)
    keyForm.resetFields()
  }

  const saveKey = async () => {
    const vendor = keyDrawer.vendor
    if (!vendor) return
    const values = await keyForm.validateFields()
    setKeySaving(true)
    try {
      if (editingKey) {
        const typed = (values.api_key || '').trim()
        const data = await updateVendorKey(vendor.code, editingKey.id, {
          name: values.name.trim(),
          note: values.note || '',
          is_active: values.is_active !== false,
          ...(typed ? { api_key: typed } : {})
        })
        await refreshKeys(vendor.code, data.keys)
        message.success('Key 已更新')
      } else {
        const data = await createVendorKey(vendor.code, {
          name: values.name.trim(),
          api_key: (values.api_key || '').trim(),
          note: values.note || ''
        })
        await refreshKeys(vendor.code, data.keys)
        message.success('Key 已新增')
      }
      resetKeyForm()
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存 Key 失败')
    } finally {
      setKeySaving(false)
    }
  }

  const setDefaultKey = async (key: VendorKeyInfo) => {
    const vendor = keyDrawer.vendor
    if (!vendor) return
    try {
      const data = await updateVendorKey(vendor.code, key.id, { is_default: true })
      await refreshKeys(vendor.code, data.keys)
      message.success(`已把「${key.name || key.api_key_hint}」设为默认 Key`)
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '设置默认失败')
    }
  }

  const removeKey = async (key: VendorKeyInfo) => {
    const vendor = keyDrawer.vendor
    if (!vendor) return
    try {
      const data = await deleteVendorKey(vendor.code, key.id)
      await refreshKeys(vendor.code, data.keys)
      if (editingKey?.id === key.id) resetKeyForm()
      message.success('Key 已删除')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const keyOptionsFor = (code?: string) => {
    if (!code) return []
    const vendor = vendors.find((item) => item.code === code)
    return (vendor?.keys || []).map((key) => ({
      value: key.id,
      label: `${key.name || '(未命名)'}  ${key.api_key_hint}${key.is_default ? '  [默认]' : ''}${key.is_active ? '' : '  [停用]'}`
    }))
  }

  const onActivate = async (code: string) => {
    setActingCode(code)
    setError('')
    try {
      await activateVendor(code)
      message.success(`已切换当前上游为 ${code}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '切换供应商失败')
    } finally {
      setActingCode('')
    }
  }

  const onRefresh = async (code: string) => {
    setActingCode(code)
    setError('')
    try {
      const result = await refreshVendorPricing(code)
      if (result.ok === false) throw new Error(result.error || '远程价目同步失败')
      message.success(`已同步 ${code} 价目${result.count != null ? `（${result.count} 条）` : ''}`)
      await load()
      if (modelOpen && modelVendor?.code === code) await loadModels(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步价目失败')
    } finally {
      setActingCode('')
    }
  }

  const onRefreshBalance = async (code: string) => {
    setActingCode(code)
    setError('')
    try {
      const balance = await getVendorBalance(code, true)
      setVendors((prev) => prev.map((item) => (item.code === code ? { ...item, balance } : item)))
      if (balance.ok && balance.value != null) {
        message.success(`已刷新 ${code} 余额：${balance.value.toFixed(2)} ${balance.currency || 'USD'}`)
      } else {
        message.warning(balance.error || '余额暂不可用')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询号商余额失败')
    } finally {
      setActingCode('')
    }
  }

  const onReapplyCatalog = async (code: string) => {
    setActingCode(code)
    setError('')
    try {
      const result = await reapplyVendorCatalog(code)
      message.success(`已按标准价×${result.cost_rate} 重算 ${result.count} 条`)
      await load()
      if (modelOpen && modelVendor?.code === code) await loadModels(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重算标准价失败')
    } finally {
      setActingCode('')
    }
  }

  const loadModels = async (code: string) => {
    setModelLoading(true)
    try {
      const rows = await getAdminVendorModels(code)
      setModelRows(
        rows.map((item) => ({
          ...item,
          service_tier: item.service_tier || 'standard',
          cache_read: item.cache_read ?? 0,
          cache_write: item.cache_write ?? 0,
          original_input: item.original_input ?? null,
          original_output: item.original_output ?? null,
          _key: rowKey(item.model, item.service_tier)
        }))
      )
    } catch (err) {
      setModelRows([])
      message.error(err instanceof Error ? err.message : '读取成本价失败')
    } finally {
      setModelLoading(false)
    }
  }

  const filteredModelRows = useMemo(() => {
    const query = modelQuery.trim().toLowerCase()
    if (!query) return modelRows
    return modelRows.filter((row) =>
      `${row.model} ${row.display_name || ''} ${row.service_tier || ''} ${row.kind || ''}`.toLowerCase().includes(query)
    )
  }, [modelQuery, modelRows])

  const openModels = async (vendor: UpstreamVendor) => {
    setModelVendor(vendor)
    setModelOpen(true)
    setModelQuery('')
    setModelPage(1)
    setModelRows([])
    modelForm.resetFields()
    modelForm.setFieldsValue({
      service_tier: 'standard',
      kind: 'chat',
      cache_read: 0,
      cache_write: 0,
      original_input: null,
      original_output: null
    })
    await loadModels(vendor.code)
  }

  const patchRow = (key: string, patch: Partial<EditableModelRow>) => {
    setModelRows((prev) => prev.map((row) => (row._key === key ? { ...row, ...patch, _dirty: true } : row)))
  }

  const saveRow = async (row: EditableModelRow) => {
    if (!modelVendor) return
    setModelSavingKey(row._key)
    try {
      await updateAdminVendorModel(modelVendor.code, row.model, {
        service_tier: row.service_tier || 'standard',
        kind: row.kind || 'chat',
        display_name: row.display_name,
        owned_by: row.owned_by,
        input: Number(row.input),
        output: Number(row.output),
        cache_read: Number(row.cache_read ?? 0),
        cache_write: Number(row.cache_write ?? 0),
        original_input: row.original_input == null || row.original_input === 0 ? null : Number(row.original_input),
        original_output: row.original_output == null || row.original_output === 0 ? null : Number(row.original_output),
        // 缓存原价随输入原价推导，手工保存时清空以免残留旧值
        original_cache_read: null,
        original_cache_write: null
      })
      message.success(`已保存 ${row.model}（${row.service_tier || 'standard'}）`)
      setModelRows((prev) => prev.map((item) => (item._key === row._key ? { ...item, _dirty: false } : item)))
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存模型价失败')
    } finally {
      setModelSavingKey('')
    }
  }

  const removeRow = async (row: EditableModelRow) => {
    if (!modelVendor) return
    setModelSavingKey(row._key)
    try {
      await deleteAdminVendorModel(modelVendor.code, row.model, row.service_tier || 'standard')
      message.success(`已删除 ${row.model}（${row.service_tier || 'standard'}）`)
      setModelRows((prev) => prev.filter((item) => item._key !== row._key))
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除模型价失败')
    } finally {
      setModelSavingKey('')
    }
  }

  const createModel = async (values: ModelFormValues) => {
    if (!modelVendor) return
    const model = values.model.trim()
    const tier = values.service_tier || 'standard'
    const key = rowKey(model, tier)
    setModelSavingKey(key)
    try {
      await updateAdminVendorModel(modelVendor.code, model, {
        service_tier: tier,
        kind: values.kind || 'chat',
        input: values.input,
        output: values.output,
        cache_read: values.cache_read ?? 0,
        cache_write: values.cache_write ?? 0,
        original_input:
          values.original_input == null || values.original_input === 0 ? null : Number(values.original_input),
        original_output:
          values.original_output == null || values.original_output === 0 ? null : Number(values.original_output),
        original_cache_read: null,
        original_cache_write: null
      })
      message.success(`已写入 ${model}（${tier}）`)
      modelForm.resetFields()
      modelForm.setFieldsValue({
        service_tier: 'standard',
        kind: 'chat',
        cache_read: 0,
        cache_write: 0,
        original_input: null,
        original_output: null
      })
      await loadModels(modelVendor.code)
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '写入模型价失败')
    } finally {
      setModelSavingKey('')
    }
  }

  const columns = useMemo(
    () => [
      {
        title: '供应商',
        dataIndex: 'name',
        render: (_: string, record: UpstreamVendor) => (
          <div>
            <div className={styles.nameRow}>
              <strong>{record.name}</strong>
              {(record.is_current || record.code === currentVendor) && <Tag color="blue">当前上游</Tag>}
              {record.is_default && <Tag>默认</Tag>}
              {record.is_active === false && <Tag color="default">停用</Tag>}
            </div>
            <div className={styles.code}>{record.code}</div>
          </div>
        )
      },
      {
        title: 'base_url',
        dataIndex: 'base_url',
        render: (value: string) => <code className={styles.url}>{value}</code>
      },
      {
        title: '计价',
        key: 'pricing',
        width: 160,
        render: (_: unknown, record: UpstreamVendor) => {
          if (record.pricing_mode === 'catalog_rate') {
            return (
              <div>
                <Tag color="green">标准价×倍率</Tag>
                <div className={styles.code}>× {record.cost_rate ?? '—'}</div>
                {policyHint(record.catalog_policy) ? (
                  <div className={styles.muted}>{policyHint(record.catalog_policy)}</div>
                ) : null}
              </div>
            )
          }
          return (
            <div>
              <Tag>手工/远程</Tag>
              {record.pricing_url ? <div className={styles.muted}>有 pricing_url</div> : null}
            </div>
          )
        }
      },
      {
        title: '号商 Key',
        key: 'api_key',
        width: 200,
        render: (_: unknown, record: UpstreamVendor) => (
          <Space direction="vertical" size={2}>
            {record.keys?.length ? (
              <Space size={4} wrap>
                <Tag color="blue">{record.keys.length} 把</Tag>
                {record.keys.find((item) => item.is_default) ? (
                  <Tag color="green">默认 {record.keys.find((item) => item.is_default)?.name}</Tag>
                ) : null}
              </Space>
            ) : record.has_api_key ? (
              <Tag color="green">{record.api_key_hint || '已设置'}</Tag>
            ) : (
              <span className={styles.muted}>未设置</span>
            )}
            <Button size="small" type="link" onClick={() => void openKeyDrawer(record)}>
              管理 Key
            </Button>
          </Space>
        )
      },
      {
        title: '加价',
        dataIndex: 'profit_multiplier',
        width: 120,
        render: (value?: number | null) =>
          value ? (
            <Tag color="purple">× {value}</Tag>
          ) : (
            <span className={styles.muted}>全局{globalMultiplier ? ` ${globalMultiplier}` : ''}</span>
          )
      },
      {
        title: '号商余额',
        key: 'balance',
        width: 180,
        render: (_: unknown, record: UpstreamVendor) => {
          if (record.code !== 'teamo') {
            return <span className={styles.muted}>—</span>
          }
          const balance = record.balance
          const busy = actingCode === record.code
          return (
            <div className={styles.balanceCell}>
              {balance?.ok && balance.value != null ? (
                <Tag color={balanceColor(balance)}>
                  {balance.value.toFixed(2)} {balance.currency || 'USD'}
                </Tag>
              ) : (
                <span className={styles.muted}>{balance?.error || '未查询'}</span>
              )}
              {balance?.fetched_at ? (
                <div className={styles.muted}>{formatBalanceTime(balance.fetched_at)}</div>
              ) : null}
              <Button
                type="link"
                size="small"
                icon={<WalletOutlined />}
                loading={busy}
                onClick={() => void onRefreshBalance(record.code)}
              >
                刷新余额
              </Button>
            </div>
          )
        }
      },
      {
        title: '模型数',
        dataIndex: 'model_count',
        width: 90,
        render: (value?: number) => value ?? '-'
      },
      {
        title: '最近同步',
        dataIndex: 'last_synced_at',
        width: 170,
        render: (value?: string | null) => value || <span className={styles.muted}>—</span>
      },
      {
        title: '操作',
        key: 'actions',
        width: 380,
        render: (_: unknown, record: UpstreamVendor) => {
          const busy = actingCode === record.code
          const isCurrent = record.is_current || record.code === currentVendor
          const isCatalog = record.pricing_mode === 'catalog_rate'
          return (
            <Space wrap size={[8, 8]}>
              <Button size="small" icon={<EditOutlined />} disabled={busy} onClick={() => openEdit(record)}>
                编辑
              </Button>
              <Button
                size="small"
                type={isCurrent ? 'default' : 'primary'}
                icon={<CheckCircleOutlined />}
                loading={busy}
                disabled={isCurrent}
                onClick={() => void onActivate(record.code)}
              >
                {isCurrent ? '使用中' : '设为当前'}
              </Button>
              {isCatalog ? (
                <Button
                  size="small"
                  icon={<ThunderboltOutlined />}
                  loading={busy}
                  onClick={() => void onReapplyCatalog(record.code)}
                >
                  重算标准价
                </Button>
              ) : (
                <Button
                  size="small"
                  icon={<CloudSyncOutlined />}
                  loading={busy}
                  disabled={!record.pricing_url}
                  onClick={() => void onRefresh(record.code)}
                >
                  同步价目
                </Button>
              )}
              <Button size="small" disabled={busy} onClick={() => void openModels(record)}>
                模型价
              </Button>
            </Space>
          )
        }
      }
    ],
    [actingCode, currentVendor, globalMultiplier]
  )

  const modelColumns = [
    {
      title: '模型',
      dataIndex: 'model',
      width: 180,
      render: (value: string, row: EditableModelRow) => (
        <span>
          {value}
          {row._dirty ? <Tag color="orange" style={{ marginLeft: 6 }}>未保存</Tag> : null}
          {row.original_input || row.original_output ? (
            <Tag color="gold" style={{ marginLeft: 6 }}>原价1:1</Tag>
          ) : null}
        </span>
      )
    },
    {
      title: '档位',
      dataIndex: 'service_tier',
      width: 110,
      render: (value: string) => value || 'standard'
    },
    {
      title: '成本输入',
      dataIndex: 'input',
      width: 110,
      render: (value: number, row: EditableModelRow) => (
        <InputNumber
          min={0}
          step={0.01}
          value={value}
          style={{ width: '100%' }}
          onChange={(next) => patchRow(row._key, { input: Number(next || 0) })}
        />
      )
    },
    {
      title: '成本输出',
      dataIndex: 'output',
      width: 110,
      render: (value: number, row: EditableModelRow) => (
        <InputNumber
          min={0}
          step={0.01}
          value={value}
          style={{ width: '100%' }}
          onChange={(next) => patchRow(row._key, { output: Number(next || 0) })}
        />
      )
    },
    {
      title: '原价输入',
      dataIndex: 'original_input',
      width: 110,
      render: (value: number | null | undefined, row: EditableModelRow) => (
        <InputNumber
          min={0}
          step={0.01}
          value={value ?? null}
          placeholder="可选"
          style={{ width: '100%' }}
          onChange={(next) =>
            patchRow(row._key, { original_input: next == null || next === 0 ? null : Number(next) })
          }
        />
      )
    },
    {
      title: '原价输出',
      dataIndex: 'original_output',
      width: 110,
      render: (value: number | null | undefined, row: EditableModelRow) => (
        <InputNumber
          min={0}
          step={0.01}
          value={value ?? null}
          placeholder="可选"
          style={{ width: '100%' }}
          onChange={(next) =>
            patchRow(row._key, { original_output: next == null || next === 0 ? null : Number(next) })
          }
        />
      )
    },
    {
      title: '缓存读',
      dataIndex: 'cache_read',
      width: 110,
      render: (value: number | undefined, row: EditableModelRow) => (
        <InputNumber
          min={0}
          step={0.01}
          value={value ?? 0}
          style={{ width: '100%' }}
          onChange={(next) => patchRow(row._key, { cache_read: Number(next || 0) })}
        />
      )
    },
    {
      title: '缓存写',
      dataIndex: 'cache_write',
      width: 110,
      render: (value: number | undefined, row: EditableModelRow) => (
        <InputNumber
          min={0}
          step={0.01}
          value={value ?? 0}
          style={{ width: '100%' }}
          onChange={(next) => patchRow(row._key, { cache_write: Number(next || 0) })}
        />
      )
    },
    {
      title: '长上下文',
      dataIndex: 'long_context',
      width: 220,
      render: (_: unknown, row: EditableModelRow) => {
        const spec = row.long_context
        if (!spec) return <span className={styles.muted}>无差价</span>
        const inputMul = spec.input_multiplier || 1
        const outputMul = spec.output_multiplier || 1
        const gate = spec.op === 'ge' ? `≥${Math.round(spec.threshold / 1000)}K` : `>${Math.round(spec.threshold / 1000)}K`
        const baseIn = Number(row.original_input || row.input)
        const baseOut = Number(row.original_output || row.output)
        return (
          <span className={styles.muted}>
            {gate} 输入 {(baseIn * inputMul).toFixed(4)} / 输出 {(baseOut * outputMul).toFixed(4)}
          </span>
        )
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, row: EditableModelRow) => {
        const saving = modelSavingKey === row._key
        return (
          <Space size={4}>
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!row._dirty && !saving}
              onClick={() => void saveRow(row)}
            >
              保存
            </Button>
            <Popconfirm
              title={`删除 ${row.model}（${row.service_tier || 'standard'}）？`}
              okText="删除"
              cancelText="取消"
              onConfirm={() => void removeRow(row)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} loading={saving} />
            </Popconfirm>
          </Space>
        )
      }
    }
  ]

  const searchRouteUsers = (keyword: string) => {
    if (routeUserSearchTimer.current) window.clearTimeout(routeUserSearchTimer.current)
    routeUserSearchTimer.current = window.setTimeout(async () => {
      setRouteUserSearching(true)
      try {
        const res: any = await getAdminUsers({ page: 1, page_num: 20, keyword: keyword.trim() })
        const list = res?.data?.list || []
        const found: ModelRouteUser[] = list.map((item: any) => ({
          user_id: Number(item.user_id),
          name: item.name || '',
          telephone: item.telephone || '',
          email: item.email || ''
        }))
        setRouteUserOptions((prev) => {
          const selected = new Set(routeForm.getFieldValue('user_ids') || [])
          const kept = prev.filter((item) => selected.has(item.user_id))
          const merged = [...kept]
          for (const item of found) {
            if (!merged.some((row) => row.user_id === item.user_id)) merged.push(item)
          }
          return merged
        })
      } catch (err) {
        message.error(err instanceof Error ? err.message : '搜索用户失败')
      } finally {
        setRouteUserSearching(false)
      }
    }, 250)
  }

  const openCreateRoute = () => {
    setEditingRoute(null)
    setRouteUserOptions([])
    routeForm.setFieldsValue({
      route_mode: 'single',
      model: '',
      models: '',
      group_name: '',
      match_prefix: false,
      vendor_code: vendors.find((item) => item.code !== currentVendor)?.code || vendors[0]?.code,
      is_active: true,
      note: '',
      api_key: '',
      clear_api_key: false,
      user_ids: []
    })
    setRouteOpen(true)
    searchRouteUsers('')
  }

  const openEditRoute = (row: ModelRouteRule) => {
    setEditingRoute(row)
    setRouteUserOptions(row.users || [])
    const prefix = Boolean(wildcardPrefix(row.model))
    routeForm.setFieldsValue({
      route_mode: 'single',
      model: prefix ? wildcardPrefix(row.model) : row.model,
      models: '',
      group_name: row.group_name || '',
      match_prefix: prefix,
      vendor_code: row.vendor_code,
      api_key_id: row.api_key_id ?? undefined,
      is_active: row.is_active,
      note: row.note || '',
      api_key: '',
      clear_api_key: false,
      user_ids: row.user_ids || []
    })
    setRouteOpen(true)
  }

  /** 把一行一个的模型名列表整理成后端要的数组（支持 gemini* 这类前缀写法）。 */
  const parseModelLines = (text?: string): string[] =>
    Array.from(
      new Set(
        (text || '')
          .split(/[\n,，;；\s]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    )

  const saveRoute = async () => {
    const values = await routeForm.validateFields()
    const isGroup = values.route_mode === 'group'
    let model = ''
    let models: string[] | undefined
    if (isGroup) {
      models = parseModelLines(values.models)
      if (!models.length) {
        message.error('请至少填一个模型名')
        return
      }
      model = models[0]
    } else {
      try {
        model = composeModelPattern(values.model, Boolean(values.match_prefix))
      } catch (err) {
        message.error(err instanceof Error ? err.message : '模型名不正确')
        return
      }
    }
    const typedKey = (values.api_key || '').trim()
    setRouteSaving(true)
    try {
      const data = await upsertAdminModelRoute({
        id: editingRoute?.id,
        model,
        models,
        group_name: (values.group_name || '').trim(),
        vendor_code: values.vendor_code,
        is_active: values.is_active,
        note: values.note,
        user_ids: values.user_ids || [],
        api_key_id: values.api_key_id || 0,
        ...(typedKey ? { api_key: typedKey } : values.clear_api_key ? { api_key: '' } : {})
      })
      setRoutes(data.routes || [])
      setRouteOpen(false)
      message.success('路由已保存，转发和价目立即生效，无需重启')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存路由失败')
    } finally {
      setRouteSaving(false)
    }
  }

  const removeRoute = async (row: ModelRouteRule) => {
    try {
      await deleteAdminModelRoute(row.id)
      setRoutes((prev) => prev.filter((item) => item.id !== row.id))
      message.success('已删除，该模型回到默认供应商')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const matchedRoutes = useMemo(() => {
    const query = routeQuery.trim()
    if (!query) return routes
    return routes.filter((row) => routeQueryHits(row.model, query))
  }, [routeQuery, routes])

  const replaceMatchedKeys = async () => {
    const query = routeQuery.trim()
    const nextKey = replaceKey.trim()
    if (!query || !nextKey || matchedRoutes.length === 0) return
    setReplacingKeys(true)
    try {
      const data = await replaceAdminModelRouteKeys({ model: query, api_key: nextKey })
      setRoutes(data.routes || [])
      setReplaceKey('')
      message.success(`已替换 ${data.updated} 条规则的密钥`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '替换密钥失败')
    } finally {
      setReplacingKeys(false)
    }
  }

  const toggleRoute = async (row: ModelRouteRule, isActive: boolean) => {
    setRouteTogglingId(row.id)
    try {
      const data = await upsertAdminModelRoute({
        id: row.id,
        model: row.model,
        vendor_code: row.vendor_code,
        is_active: isActive,
        note: row.note
      })
      setRoutes(data.routes || [])
      message.success(isActive ? `已启用 ${row.model} 的代理规则` : `已停用 ${row.model} 的代理规则`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '切换代理规则失败')
    } finally {
      setRouteTogglingId(null)
    }
  }

  const searchRewriteUsers = (keyword: string) => {
    if (rewriteUserSearchTimer.current) window.clearTimeout(rewriteUserSearchTimer.current)
    rewriteUserSearchTimer.current = window.setTimeout(async () => {
      setRewriteUserSearching(true)
      try {
        const res: any = await getAdminUsers({ page: 1, page_num: 20, keyword: keyword.trim() })
        const list = res?.data?.list || []
        const found: ModelRouteUser[] = list.map((item: any) => ({
          user_id: Number(item.user_id),
          name: item.name || '',
          telephone: item.telephone || '',
          email: item.email || ''
        }))
        setRewriteUserOptions((prev) => {
          const selected = new Set(rewriteForm.getFieldValue('user_ids') || [])
          const kept = prev.filter((item) => selected.has(item.user_id))
          const merged = [...kept]
          for (const item of found) {
            if (!merged.some((row) => row.user_id === item.user_id)) merged.push(item)
          }
          return merged
        })
      } catch (err) {
        message.error(err instanceof Error ? err.message : '搜索用户失败')
      } finally {
        setRewriteUserSearching(false)
      }
    }, 250)
  }

  const openCreateRewrite = () => {
    setEditingRewrite(null)
    setRewriteUserOptions([])
    rewriteForm.setFieldsValue({
      model: '',
      match_prefix: false,
      target_model: '',
      is_active: true,
      note: '',
      user_ids: []
    })
    setRewriteOpen(true)
    searchRewriteUsers('')
  }

  const openEditRewrite = (row: ModelRewriteRule) => {
    setEditingRewrite(row)
    setRewriteUserOptions(row.users || [])
    const prefix = Boolean(wildcardPrefix(row.model))
    rewriteForm.setFieldsValue({
      model: prefix ? wildcardPrefix(row.model) : row.model,
      match_prefix: prefix,
      target_model: row.target_model,
      is_active: row.is_active,
      note: row.note || '',
      user_ids: row.user_ids || []
    })
    setRewriteOpen(true)
  }

  const saveRewrite = async () => {
    const values = await rewriteForm.validateFields()
    let model = ''
    try {
      model = composeModelPattern(values.model, Boolean(values.match_prefix))
    } catch (err) {
      message.error(err instanceof Error ? err.message : '模型名不正确')
      return
    }
    setRewriteSaving(true)
    try {
      const data = await upsertAdminModelRewrite({
        id: editingRewrite?.id,
        model,
        target_model: values.target_model.trim(),
        is_active: values.is_active,
        note: values.note,
        user_ids: values.user_ids || []
      })
      setRewrites(data.rewrites || [])
      setRewriteOpen(false)
      message.success('改写已保存。之后的请求会按新模型转发、记账和计费')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存模型改写失败')
    } finally {
      setRewriteSaving(false)
    }
  }

  const removeRewrite = async (row: ModelRewriteRule) => {
    try {
      await deleteAdminModelRewrite(row.id)
      setRewrites((prev) => prev.filter((item) => item.id !== row.id))
      message.success('已删除，该模型不再改写')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const toggleRewrite = async (row: ModelRewriteRule, isActive: boolean) => {
    setRewriteTogglingId(row.id)
    try {
      const data = await upsertAdminModelRewrite({
        id: row.id,
        model: row.model,
        target_model: row.target_model,
        is_active: isActive,
        note: row.note,
        user_ids: row.user_ids || []
      })
      setRewrites(data.rewrites || [])
      message.success(isActive ? `已启用 ${row.model} → ${row.target_model}` : `已停用 ${row.model} 的改写`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '切换模型改写失败')
    } finally {
      setRewriteTogglingId(null)
    }
  }

  const openCreateProtocol = () => {
    setEditingProtocol(null)
    protocolForm.setFieldsValue({
      model: '',
      match_prefix: true,
      protocol: 'openai',
      is_active: true,
      note: ''
    })
    setProtocolOpen(true)
  }

  const openEditProtocol = (row: ModelProtocolRule) => {
    const prefix = Boolean(wildcardPrefix(row.model))
    setEditingProtocol(row)
    protocolForm.setFieldsValue({
      model: prefix ? wildcardPrefix(row.model) : row.model,
      match_prefix: prefix,
      protocol: row.protocol,
      is_active: row.is_active,
      note: row.note || ''
    })
    setProtocolOpen(true)
  }

  const saveProtocol = async () => {
    const values = await protocolForm.validateFields()
    let model = ''
    try {
      model = composeModelPattern(values.model, Boolean(values.match_prefix))
    } catch (err) {
      message.error(err instanceof Error ? err.message : '模型名不正确')
      return
    }
    setProtocolSaving(true)
    try {
      const data = await upsertAdminModelProtocol({
        id: editingProtocol?.id,
        model,
        protocol: values.protocol,
        is_active: values.is_active,
        note: values.note
      })
      setProtocols(data.protocols || [])
      setProtocolOpen(false)
      message.success('协议已保存，模型列表和对话会按这个协议请求')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存协议失败')
    } finally {
      setProtocolSaving(false)
    }
  }

  const removeProtocol = async (row: ModelProtocolRule) => {
    try {
      await deleteAdminModelProtocol(row.id)
      setProtocols((prev) => prev.filter((item) => item.id !== row.id))
      message.success('已删除，该模型回到按名字判断协议')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const openCreateAlias = () => {
    setEditingAlias(null)
    aliasForm.setFieldsValue({
      alias: '',
      target_model: '',
      protocol: 'auto',
      hide_target: false,
      is_active: true,
      note: ''
    })
    setAliasOpen(true)
  }

  const openEditAlias = (row: ModelAliasRule) => {
    setEditingAlias(row)
    aliasForm.setFieldsValue({
      alias: row.alias,
      target_model: row.target_model,
      protocol: row.protocol || 'auto',
      hide_target: row.hide_target,
      is_active: row.is_active,
      note: row.note || ''
    })
    setAliasOpen(true)
  }

  const saveAlias = async () => {
    const values = await aliasForm.validateFields()
    setAliasSaving(true)
    try {
      const data = await upsertAdminModelAlias({
        id: editingAlias?.id,
        alias: values.alias.trim(),
        target_model: values.target_model.trim(),
        protocol: values.protocol,
        hide_target: values.hide_target,
        is_active: values.is_active,
        note: values.note
      })
      setAliases(data.aliases || [])
      setAliasOpen(false)
      message.success('别名已保存，模型列表和转发立即生效，无需重启')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存别名失败')
    } finally {
      setAliasSaving(false)
    }
  }

  const removeAlias = async (row: ModelAliasRule) => {
    try {
      await deleteAdminModelAlias(row.id)
      setAliases((prev) => prev.filter((item) => item.id !== row.id))
      message.success('已删除别名')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>供应商 / base_url</h1>
          <p>
            同一 base_url 可建多组 code（如 yunxin-02 / yunxin-03），用「标准价×倍率」区分计价；用户端只看到应付美元价，看不到上游与倍率。
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增供应商
          </Button>
        </Space>
      </header>

      {error && <Alert showIcon type="error" message={error} className={styles.alert} />}
      <Alert
        showIcon
        type="info"
        className={styles.alert}
        message="计价说明"
        description="成本价（USD/百万 tokens）写入后，展示与扣费仍走：成本价 × 加价系数 × 用户 money_rate × discount。加价系数可按供应商单独设，不填则用「费率设置」里的全局值。标准价模式 = 标准目录 × 统一倍率；可以按 OpenAI、Anthropic、Grok 等原始供应商选择是否对外展示，并单独改倍率。"
      />

      <Table
        rowKey="code"
        loading={loading}
        columns={columns}
        dataSource={vendors}
        pagination={false}
        scroll={{ x: 1380 }}
      />

      <section className={styles.routeSection}>
        <div className={styles.sectionHead}>
          <div>
            <h2>按模型改代理</h2>
            <p>
              默认走上面当前供应商。写完整模型名，或打开前缀匹配后只写 gemini，所有以 gemini 开头的模型都走同一条规则。规则里加上用户后，只有这些用户会改走该厂商，模型价也按该厂商计算；不选用户则仍对所有人生效。需要时再填一把 Key，只覆盖这一条规则，不改供应商原来的密钥。要批量换 Key 时，按模型检索后一次替换命中的规则。保存后立刻生效。
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRoute}>
            新增规则
          </Button>
        </div>
        <div className={styles.replaceBar}>
          <Input
            allowClear
            value={routeQuery}
            placeholder="按模型检索，如 claude"
            onChange={(event) => setRouteQuery(event.target.value)}
          />
          <Input.Password
            value={replaceKey}
            placeholder="替换成这把 Key"
            autoComplete="new-password"
            onChange={(event) => setReplaceKey(event.target.value)}
          />
          <Popconfirm
            title={`替换 ${matchedRoutes.length} 条规则的 Key？`}
            description={matchedRoutes.map((row) => row.model).join('、')}
            okText="替换"
            cancelText="取消"
            disabled={!routeQuery.trim() || !replaceKey.trim() || matchedRoutes.length === 0}
            onConfirm={() => void replaceMatchedKeys()}
          >
            <Button
              loading={replacingKeys}
              disabled={!routeQuery.trim() || !replaceKey.trim() || matchedRoutes.length === 0}
            >
              替换匹配项
            </Button>
          </Popconfirm>
          {routeQuery.trim() ? <span className={styles.code}>匹配 {matchedRoutes.length} 条</span> : null}
        </div>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={matchedRoutes}
          locale={{ emptyText: routeQuery.trim() ? '没有匹配的模型规则' : '还没有单独改代理的模型' }}
          columns={[
            {
              title: '模型 / 关键字',
              dataIndex: 'model',
              render: (value: string, row: ModelRouteRule) => (
                <Space size={6}>
                  <code>{value}</code>
                  {wildcardPrefix(value) ? <Tag color="purple">前缀</Tag> : null}
                  {row.group_name ? <Tag color="cyan">{row.group_name}</Tag> : null}
                </Space>
              )
            },
            {
              title: '改走',
              dataIndex: 'vendor_code',
              render: (code: string) => {
                const vendor = vendors.find((item) => item.code === code)
                return (
                  <span>
                    <Tag color="blue">{vendor?.name || code}</Tag>
                    <small className={styles.code}>{vendor?.base_url || ''}</small>
                  </span>
                )
              }
            },
            {
              title: '适用用户',
              dataIndex: 'users',
              width: 220,
              render: (users: ModelRouteUser[] | undefined, row: ModelRouteRule) => {
                if (!row.user_ids?.length) return <Tag>全部用户</Tag>
                const list = users?.length ? users : row.user_ids.map((id) => ({ user_id: id }))
                return (
                  <Space size={4} wrap>
                    {list.map((user) => (
                      <Tag key={user.user_id}>{routeUserLabel(user)}</Tag>
                    ))}
                  </Space>
                )
              }
            },
            {
              title: '上游 Key',
              dataIndex: 'has_api_key',
              width: 160,
              render: (hasKey: boolean, row: ModelRouteRule) => {
                if (hasKey) return <Tag color="green">{row.api_key_hint || '已覆盖'}</Tag>
                if (row.api_key_id) return <Tag color="blue">{row.key_name || `Key #${row.api_key_id}`}</Tag>
                return <Tag>用供应商默认</Tag>
              }
            },
            {
              title: '生效',
              dataIndex: 'is_active',
              width: 90,
              render: (active: boolean, row: ModelRouteRule) => (
                <Switch
                  size="small"
                  checked={active}
                  loading={routeTogglingId === row.id}
                  checkedChildren="开"
                  unCheckedChildren="关"
                  onChange={(checked) => void toggleRoute(row, checked)}
                />
              )
            },
            { title: '备注', dataIndex: 'note' },
            {
              title: '操作',
              width: 160,
              render: (_: unknown, row: ModelRouteRule) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditRoute(row)}>
                    编辑
                  </Button>
                  <Popconfirm title={`删除 ${row.model}？`} okText="删除" cancelText="取消" onConfirm={() => void removeRoute(row)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </section>

      <section className={styles.routeSection}>
        <div className={styles.sectionHead}>
          <div>
            <h2>旧模型换成新模型</h2>
            <p>
              Agent 往往会自己点名一个旧模型，这边改不了。在这里把那个名字改成新模型再转发。命中之后，请求记录、扣费和回复里的计费说明都按新模型，不再按 Agent 原来写的那个。可写完整名，或打开前缀匹配覆盖一整类。不选用户则对所有人生效。目标模型需要已经有价格，否则请求会被拒绝。保存后立刻生效。
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRewrite}>
            新增改写
          </Button>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={rewrites}
          locale={{ emptyText: '还没有模型改写' }}
          columns={[
            {
              title: '请求里的模型',
              dataIndex: 'model',
              render: (value: string) => (
                <Space size={6}>
                  <code>{value}</code>
                  {wildcardPrefix(value) ? <Tag color="purple">前缀</Tag> : null}
                </Space>
              )
            },
            {
              title: '实际使用',
              dataIndex: 'target_model',
              render: (value: string) => <code>{value}</code>
            },
            {
              title: '适用用户',
              dataIndex: 'users',
              width: 220,
              render: (users: ModelRouteUser[] | undefined, row: ModelRewriteRule) => {
                if (!row.user_ids?.length) return <Tag>全部用户</Tag>
                const list = users?.length ? users : row.user_ids.map((id) => ({ user_id: id }))
                return (
                  <Space size={4} wrap>
                    {list.map((user) => (
                      <Tag key={user.user_id}>{routeUserLabel(user)}</Tag>
                    ))}
                  </Space>
                )
              }
            },
            {
              title: '生效',
              dataIndex: 'is_active',
              width: 90,
              render: (active: boolean, row: ModelRewriteRule) => (
                <Switch
                  size="small"
                  checked={active}
                  loading={rewriteTogglingId === row.id}
                  checkedChildren="开"
                  unCheckedChildren="关"
                  onChange={(checked) => void toggleRewrite(row, checked)}
                />
              )
            },
            { title: '备注', dataIndex: 'note' },
            {
              title: '操作',
              width: 160,
              render: (_: unknown, row: ModelRewriteRule) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditRewrite(row)}>
                    编辑
                  </Button>
                  <Popconfirm title={`删除 ${row.model} → ${row.target_model}？`} okText="删除" cancelText="取消" onConfirm={() => void removeRewrite(row)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </section>

      <section className={styles.routeSection}>
        <div className={styles.sectionHead}>
          <div>
            <h2>模型协议</h2>
            <p>
              给一类模型指定调用协议，网页对话和 /v1/models 都会带上。用户不用自己选 OpenAI 还是 Anthropic，避免选错协议导致失败。例如 gemini 前缀走 OpenAI，claude 前缀走 Anthropic。更长的前缀优先；模型别名里单独写的协议仍覆盖这里。
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateProtocol}>
            新增协议
          </Button>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={protocols}
          locale={{ emptyText: '还没有协议规则，对话仍按模型名判断' }}
          columns={[
            {
              title: '模型',
              dataIndex: 'model',
              render: (value: string) => (
                <Space size={6}>
                  <code>{value}</code>
                  {wildcardPrefix(value) ? <Tag color="purple">前缀</Tag> : null}
                </Space>
              )
            },
            {
              title: '协议',
              dataIndex: 'protocol',
              width: 140,
              render: (value: string) => <Tag>{protocolLabel(value)}</Tag>
            },
            {
              title: '状态',
              dataIndex: 'is_active',
              width: 90,
              render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '停用'}</Tag>
            },
            { title: '备注', dataIndex: 'note' },
            {
              title: '操作',
              width: 160,
              render: (_: unknown, row: ModelProtocolRule) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditProtocol(row)}>
                    编辑
                  </Button>
                  <Popconfirm title={`删除 ${row.model}？`} okText="删除" cancelText="取消" onConfirm={() => void removeProtocol(row)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </section>

      <section className={styles.routeSection}>
        <div className={styles.sectionHead}>
          <div>
            <h2>模型别名</h2>
            <p>
              例如把 grok-4.6 配成 gg-46：模型列表会给出别名，请求时再还原成真名转发。协议决定前端走 OpenAI 还是 Anthropic。用户端看不到真实模型名和上游。
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAlias}>
            新增别名
          </Button>
        </div>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          dataSource={aliases}
          locale={{ emptyText: '还没有模型别名' }}
          columns={[
            {
              title: '别名',
              dataIndex: 'alias',
              render: (value: string) => <code>{value}</code>
            },
            {
              title: '真实模型',
              dataIndex: 'target_model',
              render: (value: string) => <code>{value}</code>
            },
            {
              title: '协议',
              dataIndex: 'protocol',
              width: 120,
              render: (value: string) => {
                const label =
                  value === 'anthropic' ? 'Anthropic' : value === 'responses' ? 'Responses' : value === 'openai' ? 'OpenAI' : '自动'
                return <Tag>{label}</Tag>
              }
            },
            {
              title: '列表',
              dataIndex: 'hide_target',
              width: 110,
              render: (hide: boolean) => <Tag color={hide ? 'orange' : 'default'}>{hide ? '只露别名' : '别名+原名'}</Tag>
            },
            {
              title: '状态',
              dataIndex: 'is_active',
              width: 90,
              render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '停用'}</Tag>
            },
            { title: '备注', dataIndex: 'note' },
            {
              title: '操作',
              width: 160,
              render: (_: unknown, row: ModelAliasRule) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditAlias(row)}>
                    编辑
                  </Button>
                  <Popconfirm title={`删除 ${row.alias}？`} okText="删除" cancelText="取消" onConfirm={() => void removeAlias(row)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
      </section>

      <Modal
        title={editingRoute ? `编辑路由 · ${editingRoute.model}` : '新增模型路由'}
        open={routeOpen}
        onCancel={() => setRouteOpen(false)}
        onOk={() => void saveRoute()}
        confirmLoading={routeSaving}
        destroyOnClose
      >
        <Form form={routeForm} layout="vertical">
          <Form.Item
            name="route_mode"
            label="规则形态"
            extra="分组批量：一次填多个对外模型名，共用一个上游、一把 Key 和同一份用户名单；计价按最终路由到的模型算。"
            initialValue="single"
          >
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'single', label: '单模型规则' },
                { value: 'group', label: '分组批量（一对多）' }
              ]}
            />
          </Form.Item>
          <Form.Item
            name="group_name"
            label="分组名"
            extra="同一分组名下的模型在列表里折叠显示，方便一起改上游。留空表示不分组。"
          >
            <Input placeholder="例如 gemini 全家桶" />
          </Form.Item>
          {routeMode === 'group' ? (
            <>
              <Form.Item
                name="models"
                label="对外模型名（一行一个）"
                rules={[{ required: true, message: '请至少填一个模型名' }]}
                extra="可批量粘贴。以 * 结尾表示前缀匹配，例如 gemini* 会命中所有 gemini 开头的模型。"
              >
                <Input.TextArea rows={6} placeholder={'gemini-3.8-flash\ngemini-3.1-pro-preview\ngemini*'} />
              </Form.Item>
            </>
          ) : (
            <>
          <Form.Item
            name="model"
            label="模型名或关键字"
            rules={
              routeMode === 'group'
                ? []
                : [{ required: true, message: '请输入模型名' }]
            }
            extra={
              matchPrefix
                ? '只填前缀本身，例如 gemini。保存后 gemini-3.8-flash、gemini-3.1-pro-preview 都会走这条规则。更长的前缀优先。'
                : '可写完整名 gpt-5.6-luna，也可写 luna，后者会匹配名字里带这一段的模型。若要「gemini 开头都命中」，打开下面的前缀匹配。'
            }
          >
            <Input placeholder={matchPrefix ? 'gemini' : 'luna 或 gpt-5.6-luna'} />
          </Form.Item>
          <Form.Item
            name="match_prefix"
            label="前缀匹配"
            valuePropName="checked"
            extra="打开后，填写 gemini 即表示所有以 gemini 开头的模型。"
          >
            <Switch />
          </Form.Item>
            </>
          )}
          <Form.Item name="vendor_code" label="改走哪个代理" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select
              options={vendors.map((item) => ({
                value: item.code,
                label: `${item.name || item.code}  ${item.base_url || ''}`
              }))}
              onChange={() => routeForm.setFieldValue('api_key_id', undefined)}
            />
          </Form.Item>
          <Form.Item
            name="api_key_id"
            label="使用哪把 Key"
            extra="留空则用该供应商的默认 Key（或供应商兜底 Key）。先在供应商列表的「管理 Key」里录入多把 Key，换 Key 时只改这里，不用重建路由。"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="留空 = 用供应商默认 Key"
              options={keyOptionsFor(routeVendorCode)}
              notFoundContent="该供应商还没有命名 Key"
            />
          </Form.Item>
          <Form.Item
            name="user_ids"
            label="适用用户"
            extra="留空则所有用户都走这条规则。选中的用户使用该模型时会改走上面的厂商，扣费和价目页都按该厂商的价格计算；其他用户仍走默认供应商。"
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              filterOption={false}
              loading={routeUserSearching}
              placeholder="搜索手机号 / 邮箱 / 昵称 / ID"
              options={routeUserOptions.map((user) => ({
                value: user.user_id,
                label: routeUserLabel(user)
              }))}
              onSearch={searchRouteUsers}
              onDropdownVisibleChange={(open) => {
                if (open && routeUserOptions.length === 0) searchRouteUsers('')
              }}
            />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="覆盖 API Key"
            extra={
              editingRoute?.has_api_key
                ? `当前覆盖 ${editingRoute.api_key_hint || ''}。留空保持这把 Key；填写则换成新的。`
                : '留空则继续用该供应商已保存的 Key。填写后，只有命中这条规则的请求会改带这把 Key。'
            }
          >
            <Input.Password placeholder="sk-..." autoComplete="new-password" />
          </Form.Item>
          {editingRoute?.has_api_key ? (
            <Form.Item name="clear_api_key" label="清除覆盖，改回供应商 Key" valuePropName="checked">
              <Switch />
            </Form.Item>
          ) : null}
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="例如：teamrouter 上 luna 不稳定" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingRewrite ? `编辑改写 · ${editingRewrite.model}` : '新增模型改写'}
        open={rewriteOpen}
        onCancel={() => setRewriteOpen(false)}
        onOk={() => void saveRewrite()}
        confirmLoading={rewriteSaving}
        destroyOnClose
      >
        <Form form={rewriteForm} layout="vertical">
          <Form.Item
            name="model"
            label="请求里的旧模型"
            rules={[{ required: true, message: '请输入旧模型名' }]}
            extra={
              rewriteMatchPrefix
                ? '只填前缀本身，例如 claude-opus-4。保存后所有以它开头的模型都会改成下面的新模型。更长的前缀优先。'
                : '写 Agent 实际会请求的完整名字。若要一整类都换掉，打开下面的前缀匹配。'
            }
          >
            <Input placeholder={rewriteMatchPrefix ? 'claude-opus-4' : 'claude-opus-4-6'} />
          </Form.Item>
          <Form.Item
            name="match_prefix"
            label="前缀匹配"
            valuePropName="checked"
            extra="打开后，填写 claude-opus-4 即表示所有以 claude-opus-4 开头的模型。"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="target_model"
            label="改成这个模型"
            rules={[{ required: true, message: '请输入新模型名' }]}
            extra="转发、请求记录、扣费和计费说明都用这个名字。请填已经有价格的完整模型名。"
          >
            <Input placeholder="claude-sonnet-5" />
          </Form.Item>
          <Form.Item
            name="user_ids"
            label="适用用户"
            extra="留空则所有用户的这类请求都会改写。只想改某几个账号时再选择用户。"
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              filterOption={false}
              loading={rewriteUserSearching}
              placeholder="搜索手机号 / 邮箱 / 昵称 / ID"
              options={rewriteUserOptions.map((user) => ({
                value: user.user_id,
                label: routeUserLabel(user)
              }))}
              onSearch={searchRewriteUsers}
              onDropdownVisibleChange={(open) => {
                if (open && rewriteUserOptions.length === 0) searchRewriteUsers('')
              }}
            />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="例如：opus 4.6 又贵又不如 sonnet 5" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingProtocol ? `编辑协议 · ${editingProtocol.model}` : '新增模型协议'}
        open={protocolOpen}
        onCancel={() => setProtocolOpen(false)}
        onOk={() => void saveProtocol()}
        confirmLoading={protocolSaving}
        destroyOnClose
      >
        <Form form={protocolForm} layout="vertical">
          <Form.Item
            name="model"
            label="模型名或前缀"
            rules={[{ required: true, message: '请输入模型名' }]}
            extra={
              protocolMatchPrefix
                ? '只填前缀，例如 gemini 或 claude。所有以它开头的模型都用下面的协议。'
                : '写完整模型名则只对这一个模型生效。要覆盖一整类，打开前缀匹配。'
            }
          >
            <Input placeholder={protocolMatchPrefix ? 'gemini' : 'gpt-5.6-luna'} />
          </Form.Item>
          <Form.Item name="match_prefix" label="前缀匹配" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            name="protocol"
            label="协议"
            rules={[{ required: true, message: '请选择协议' }]}
            extra="网页对话会按这里自动选接口。Responses 在网页里仍用 OpenAI Chat 兼容格式；外部客户端以模型列表里的 protocol 为准。"
          >
            <Select options={PROTOCOL_OPTIONS} />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="例如：Gemini 必须走 OpenAI 兼容接口" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingAlias ? `编辑别名 · ${editingAlias.alias}` : '新增模型别名'}
        open={aliasOpen}
        onCancel={() => setAliasOpen(false)}
        onOk={() => void saveAlias()}
        confirmLoading={aliasSaving}
        destroyOnClose
      >
        <Form form={aliasForm} layout="vertical">
          <Form.Item
            name="alias"
            label="对外别名"
            rules={[{ required: true, message: '请输入别名' }]}
            extra="用户和 /v1/models 看到的名字，例如 gg-46"
          >
            <Input placeholder="gg-46" />
          </Form.Item>
          <Form.Item
            name="target_model"
            label="真实模型"
            rules={[{ required: true, message: '请输入真实模型名' }]}
            extra="转发和计价用的官方/上游模型名，例如 grok-4.6"
          >
            <Input placeholder="grok-4.6" />
          </Form.Item>
          <Form.Item
            name="protocol"
            label="调用协议"
            rules={[{ required: true, message: '请选择协议' }]}
            extra="自动：按真实模型名判断（Claude 走 Anthropic）。也可强制 OpenAI / Anthropic。"
          >
            <Select
              options={[
                { value: 'auto', label: '自动（按真实模型名）' },
                { value: 'openai', label: 'OpenAI（/v1/chat/completions）' },
                { value: 'anthropic', label: 'Anthropic（/v1/messages）' },
                { value: 'responses', label: 'OpenAI Responses' }
              ]}
            />
          </Form.Item>
          <Form.Item name="hide_target" label="模型列表只显示别名" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`管理 Key · ${keyDrawer.vendor?.name || keyDrawer.vendor?.code || ''}`}
        open={keyDrawer.open}
        width={720}
        onClose={() => {
          setKeyDrawer({ open: false, vendor: null })
          resetKeyForm()
        }}
      >
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message="一个供应商可以保存多把命名 Key"
          description="模型路由里直接选「用哪把 Key」，换 Key 时只在这里改，不用重建路由。Key 只显示掩码，想换只能重新输入。"
        />
        <Table
          rowKey="id"
          size="small"
          loading={keyLoading}
          pagination={false}
          dataSource={keyRows}
          locale={{ emptyText: '还没有命名 Key，下面新增一条' }}
          columns={[
            {
              title: '名称',
              dataIndex: 'name',
              render: (value: string, row: VendorKeyInfo) => (
                <Space size={6}>
                  <strong>{value || '(未命名)'}</strong>
                  {row.is_default ? <Tag color="green">默认</Tag> : null}
                  {!row.is_active ? <Tag>停用</Tag> : null}
                </Space>
              )
            },
            {
              title: 'Key',
              dataIndex: 'api_key_hint',
              render: (value: string) => <code className={styles.code}>{value || '—'}</code>
            },
            { title: '备注', dataIndex: 'note', render: (value?: string) => value || <span className={styles.muted}>—</span> },
            {
              title: '操作',
              key: 'actions',
              width: 240,
              render: (_: unknown, row: VendorKeyInfo) => (
                <Space size={4} wrap>
                  <Button size="small" onClick={() => startEditKey(row)}>
                    编辑
                  </Button>
                  <Button size="small" disabled={row.is_default} onClick={() => void setDefaultKey(row)}>
                    设为默认
                  </Button>
                  <Popconfirm
                    title={`删除 Key「${row.name || row.api_key_hint}」？`}
                    description="被模型路由引用的 Key 不能删，需要先改掉那些路由。"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => void removeKey(row)}
                  >
                    <Button size="small" danger>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
        />
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 8 }}>{editingKey ? `编辑「${editingKey.name}」` : '新增 Key'}</h3>
          <Form form={keyForm} layout="vertical">
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, message: '请输入名称，便于路由里选择' }]}
            >
              <Input placeholder="例如：主力、备用、测试额度" maxLength={128} />
            </Form.Item>
            <Form.Item
              name="api_key"
              label="API Key"
              rules={editingKey ? [] : [{ required: true, message: '请输入 API Key' }]}
              extra={editingKey ? '留空保持原 Key 不变；填写则替换。' : '保存后只显示掩码，明文不会再出站。'}
            >
              <Input.Password placeholder="sk-..." autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="note" label="备注">
              <Input placeholder="可选" maxLength={200} />
            </Form.Item>
            {editingKey ? (
              <Form.Item
                name="is_active"
                label="启用"
                valuePropName="checked"
                extra="被模型路由引用的 Key 不能停用，需要先改掉那些路由。"
              >
                <Switch />
              </Form.Item>
            ) : null}
            <Space>
              <Button type="primary" loading={keySaving} onClick={() => void saveKey()}>
                {editingKey ? '保存' : '新增'}
              </Button>
              {editingKey ? <Button onClick={resetKeyForm}>取消编辑</Button> : null}
            </Space>
          </Form>
        </div>
      </Drawer>

      <Modal
        title={editing ? `编辑供应商 · ${editing.code}` : '新增供应商'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={Boolean(actingCode)}
        destroyOnClose
        width={760}
      >
        <Form form={form} layout="vertical" onFinish={saveVendor}>
          <Form.Item
            name="pricing_mode"
            label="计价模式"
            rules={[{ required: true }]}
                extra="标准价×倍率：填倍率即可自动灌入官方短上下文成本价。有差价的模型会按实际输入 token 自动乘官方长上下文倍数，不必再填一组长上下文价"
          >
            <Radio.Group
              optionType="button"
              options={[
                { value: 'catalog_rate', label: '标准价 × 倍率' },
                { value: 'manual', label: '手工 / 远程价目' }
              ]}
            />
          </Form.Item>
          <Form.Item name="code" label="code" rules={[{ required: true, message: '请输入供应商 code' }]} extra="唯一标识；同 base_url 建议用 yunxin-02 / yunxin-03 区分倍率组">
            <Input disabled={Boolean(editing)} placeholder="如 yunxin-02" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="展示名称，如 号商 0.2x" />
          </Form.Item>
          <Form.Item
            name="base_url"
            label="base_url"
            rules={[{ required: true, message: '请输入上游 base_url' }]}
            extra="路由地址可重复；计价由 code + 倍率区分"
          >
            <Input placeholder="https://api.example.com" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="号商兜底 API Key"
            extra={
              editing?.has_api_key
                ? `已保存 ${editing.api_key_hint || ''}。留空保持不变；填写后，转发到这家号商的请求会带上这个 key。`
                : '留空则继续用服务全局密钥。这是兜底 Key：路由没指定命名 Key 时才会用它；需要多把 Key 请用列表里的「管理 Key」。'
            }
          >
            <Input.Password placeholder="sk-..." autoComplete="new-password" />
          </Form.Item>
          {editing?.has_api_key ? (
            <Form.Item name="clear_api_key" label="清除兜底 Key" valuePropName="checked">
              <Switch />
            </Form.Item>
          ) : null}
          {pricingMode === 'catalog_rate' ? (
            <>
              <Form.Item
                name="cost_rate"
                label="接入倍率 cost_rate"
                rules={[{ required: true, type: 'number', min: 0.0001, max: 100, message: '请输入大于 0 的倍率' }]}
                extra={
                  previewLoading
                    ? '正在预览目录…'
                    : previewCount != null
                      ? `当前会对外展示约 ${previewCount} 个模型。统一倍率作用于没单独设倍率的供应商。`
                      : '例如 0.2 表示短上下文标准价的 20%。长上下文按同一倍率再乘官方倍数。某一家供应商可以在下面单独改。'
                }
              >
                <InputNumber style={{ width: '100%' }} min={0.0001} max={100} step={0.05} placeholder="0.2" />
              </Form.Item>
              <div className={styles.typeBlock}>
                <div className={styles.typeTitle}>原始供应商</div>
                <p className={styles.typeHint}>
                  按模型所属的 OpenAI、Anthropic、Grok 等选择是否出现在价目页。关掉后不再展示；请求若仍调用，按这一行的倍率扣费。单独倍率留空则使用上面的统一倍率。
                </p>
                {PROVIDER_OPTIONS.map((item) => {
                  const spec = providerPolicies[item.id] || { enabled: true, cost_rate: null }
                  return (
                    <div key={item.id} className={styles.typeRow}>
                      <Switch
                        checked={spec.enabled}
                        onChange={(enabled) =>
                          setProviderPolicies((prev) => ({ ...prev, [item.id]: { ...spec, enabled } }))
                        }
                      />
                      <span>{item.label}</span>
                      <span className={styles.muted}>{typeCounts[item.id] ? `${typeCounts[item.id]} 个` : '—'}</span>
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0.0001}
                        max={100}
                        step={0.05}
                        placeholder="同统一倍率"
                        value={spec.cost_rate ?? null}
                        onChange={(value) =>
                          setProviderPolicies((prev) => ({
                            ...prev,
                            [item.id]: { ...spec, cost_rate: value == null ? null : Number(value) }
                          }))
                        }
                      />
                    </div>
                  )
                })}
              </div>
              {editing ? (
                <Form.Item
                  name="reapply_catalog"
                  label="保存时按最新标准目录重算"
                  valuePropName="checked"
                  extra="勾选后按统一倍率和各供应商单独倍率重写全部模型价。只改是否展示时不必勾选。"
                >
                  <Switch />
                </Form.Item>
              ) : (
                <Form.Item name="reapply_catalog" hidden initialValue={true}>
                  <Switch />
                </Form.Item>
              )}
            </>
          ) : (
            <Form.Item name="pricing_url" label="pricing_url" extra="可选。有公开价目地址时，服务会定时拉取并更新成本价">
              <Input placeholder="https://example.com/v1/models/pricing" />
            </Form.Item>
          )}
          <Form.Item
            name="profit_multiplier"
            label="加价系数"
            extra={`不填则用全局费率${globalMultiplier ? `（当前 ${globalMultiplier}）` : ''}。例如 1.8 只对这家供应商加价。`}
            rules={[
              {
                validator: async (_: unknown, value: number | null) => {
                  if (value == null || value === ('' as unknown as number)) return
                  if (Number(value) > 0 && Number(value) <= 100) return
                  throw new Error('请输入大于 0 且不超过 100 的加价系数')
                }
              }
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0.000001} max={100} step={0.1} placeholder="留空=用全局" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" rules={[{ type: 'number', min: 0, max: 9999 }]}>
            <InputNumber style={{ width: '100%' }} min={0} max={9999} />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_default" label="设为当前默认上游" valuePropName="checked" extra="保存后立即切换转发与计费使用的供应商">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={modelVendor ? `模型成本价 · ${modelVendor.name}` : '模型成本价'}
        open={modelOpen}
        onCancel={() => setModelOpen(false)}
        footer={null}
        width={1380}
        destroyOnClose
      >
        <Alert
          showIcon
          type="info"
          className={styles.alert}
          message={
            modelVendor?.pricing_mode === 'catalog_rate'
              ? `本供应商为标准价×${modelVendor.cost_rate ?? '—'}；「成本」为官方目录×倍率。原价需手工填写才会生效：按原价 1:1 美元转发，人民币只乘汇率（不加价、不叠用户倍率/折扣）。未填原价则走成本×加价×用户倍率×折扣。长上下文按官方倍数自动换算。`
              : '「成本」为上游美元成本价；「原价」可选，仅你手工设置的模型才生效。设置后按原价 1:1 美元转发，人民币扣费只乘汇率（不加价、不叠用户倍率/折扣）。'
          }
        />
        <div className={styles.modelToolbar}>
          <Input
            allowClear
            className={styles.modelSearch}
            prefix={<SearchOutlined />}
            value={modelQuery}
            placeholder="检索模型，如 opus、haiku"
            onChange={(event) => {
              setModelQuery(event.target.value)
              setModelPage(1)
            }}
          />
          {modelQuery.trim() ? (
            <span className={styles.code}>匹配 {filteredModelRows.length} 个</span>
          ) : null}
          <Button
            icon={<ReloadOutlined />}
            loading={modelLoading}
            onClick={() => modelVendor && void loadModels(modelVendor.code)}
          >
            刷新列表
          </Button>
          {modelVendor?.pricing_mode === 'catalog_rate' ? (
            <Button
              icon={<ThunderboltOutlined />}
              loading={actingCode === modelVendor.code}
              onClick={() => void onReapplyCatalog(modelVendor.code)}
            >
              重算标准价
            </Button>
          ) : null}
        </div>
        <Form form={modelForm} layout="inline" className={styles.modelForm} onFinish={createModel}>
          <Form.Item name="model" rules={[{ required: true, message: '模型名' }]}>
            <Input placeholder="model" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="service_tier" initialValue="standard">
            <Select
              style={{ width: 120 }}
              options={[
                { value: 'standard', label: 'standard' },
                { value: 'fast', label: 'fast' }
              ]}
            />
          </Form.Item>
          <Form.Item name="kind" initialValue="chat">
            <Input placeholder="kind" style={{ width: 90 }} />
          </Form.Item>
          <Form.Item name="input" rules={[{ required: true, type: 'number', min: 0 }]}>
            <InputNumber placeholder="成本输入" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="output" rules={[{ required: true, type: 'number', min: 0 }]}>
            <InputNumber placeholder="成本输出" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="original_input">
            <InputNumber placeholder="原价输入" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="original_output">
            <InputNumber placeholder="原价输出" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="cache_read" initialValue={0}>
            <InputNumber placeholder="cache_read" min={0} step={0.01} />
          </Form.Item>
          <Form.Item name="cache_write" initialValue={0}>
            <InputNumber placeholder="cache_write" min={0} step={0.01} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={Boolean(modelSavingKey) && !modelRows.some((r) => r._key === modelSavingKey)}>
              新增/覆盖
            </Button>
          </Form.Item>
        </Form>
        <HorizontalDrag watch={`${filteredModelRows.length}:${modelPage}:${modelQuery}`}>
        <Table
          size="small"
          loading={modelLoading}
          rowKey="_key"
          pagination={
            modelQuery.trim()
              ? false
              : { current: modelPage, pageSize: 10, showSizeChanger: false, onChange: setModelPage }
          }
          locale={{ emptyText: modelQuery.trim() ? '没有匹配的模型' : '暂无模型价' }}
          dataSource={filteredModelRows}
          columns={modelColumns}
          scroll={{ x: 1500 }}
        />
        </HorizontalDrag>
      </Modal>
    </div>
  )
}

export default AdminVendors
