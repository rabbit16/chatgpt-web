/**
 * 站点对外开放的接入地址
 * ------------------------------------------------------------
 * 接入指南、各种"填这里"的提示都从这里取，避免每页各写一份。
 * RELAY_HOST 是不带 /v1 的根地址（Anthropic 原生格式用），
 * RELAY_URL 是 OpenAI 兼容格式用的 /v1 地址。
 */
export const RELAY_HOST = (import.meta.env.VITE_APP_REQUEST_HOST || '').replace(/\/apiAI\/?$/, '')
export const RELAY_URL = `${RELAY_HOST}/v1`

/** 推荐客户端 Claude-haha 的发布页（GitHub 直链，网盘失效时的备用） */
export const CC_HAHA_RELEASES = 'https://github.com/NanmiCoder/cc-haha/releases'
