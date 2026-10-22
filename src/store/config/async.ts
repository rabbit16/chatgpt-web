import { getConfig, getModelList } from '@/request/api'
import { rememberModelProtocols } from '@/utils/llmProtocol'
import configStore from './slice'

const isImageOrVideoModel = (modelId: string) =>
  /(?:image|dall[-_]?e|diffusion|stable[-_]?diffusion|flux|midjourney|sora|video)/i.test(modelId)

async function fetchConfig() {
  const res = await getConfig()
  if (!res.code) {
    configStore.getState().replaceData(res.data)
  }
  return res
}

async function fetchGetModelList() {
  // Always use the live OpenAI-compatible model list from the local proxy.
  // Only image/video models are excluded from the chat selector.
  try {
    const response = await getModelList()
    const live = (response.data || []).filter((model) => model?.id && !isImageOrVideoModel(model.id))
    rememberModelProtocols(live, response.protocol_routes || [])
    const data = live.map((model) => ({ value: model.id, label: model.id }))

    if (!data.length) {
      console.warn('本地代理未返回可用文本模型，保留当前模型列表')
      return
    }

    const state = configStore.getState()
    state.upModelsData(data)
    if (!data.some((model) => model.value === state.config.model)) {
      state.changeConfig({ ...state.config, model: data[0].value })
    }
  } catch (error) {
    // Do not replace a live list with stale static data when the proxy is unavailable.
    console.warn('获取本地代理实时模型列表失败，保留当前模型列表', error)
  }
}

export default { fetchConfig, fetchGetModelList }
