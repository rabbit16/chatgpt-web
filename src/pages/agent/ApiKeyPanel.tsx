import { useCallback, useEffect, useState } from 'react'
import { CopyOutlined } from '@ant-design/icons'
import { Alert, Button, Input, Popconfirm, Tag, message } from 'antd'
import { userStore } from '@/store'
import { copyToClipboard } from '@/utils'
import {
  createUserApiKey,
  deleteUserApiKey,
  disableUserApiKey,
  enableUserApiKey,
  listUserApiKeys,
  type UserApiKeyItem
} from '@/request/api'
import {
  forgetStoredKey,
  readPhone,
  readUserId,
  rememberCreatedKey,
  selectStoredKey,
  storedSecret,
  syncCredential
} from '@/utils/llmCredential'
import styles from './index.module.less'

function CopyButton({ text, label = '复制' }: { text: string; label?: string }) {
  return (
    <Button
      size="small"
      icon={<CopyOutlined />}
      disabled={!text}
      onClick={() => {
        copyToClipboard(text).then(
          () => message.success('已复制'),
          () => message.error('复制失败，请手动选中复制')
        )
      }}
    >
      {label}
    </Button>
  )
}

function applyCredential(userInfo: any, allowPhoneKey: boolean, keys: UserApiKeyItem[]) {
  const nextKey = syncCredential(userInfo, allowPhoneKey, keys)
  userStore.getState().setLlmAccess({ llm_api_key: nextKey, allow_phone_key: allowPhoneKey })
  return nextKey
}

export default function ApiKeyPanel({ onKeyChange }: { onKeyChange: (key: string) => void }) {
  const { token, user_info, setLoginModal, llm_api_key, allow_phone_key } = userStore()
  const userId = readUserId(user_info)
  const phone = readPhone(user_info)
  const [keys, setKeys] = useState<UserApiKeyItem[]>([])
  const [allowPhone, setAllowPhone] = useState<boolean>(allow_phone_key !== false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const applyList = useCallback(
    (payload: any) => {
      const list = (payload?.keys || []) as UserApiKeyItem[]
      const allow = Boolean(payload?.allow_phone_key)
      setKeys(list)
      setAllowPhone(allow)
      const next = applyCredential(user_info, allow, list)
      onKeyChange(next)
    },
    [onKeyChange, user_info]
  )

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res: any = await listUserApiKeys()
      const payload = res?.data || {}
      if (String(payload.code) !== '0') return
      applyList(payload)
    } finally {
      setLoading(false)
    }
  }, [applyList, token])

  useEffect(() => {
    void load()
  }, [load])

  async function onCreate() {
    setLoading(true)
    try {
      const res: any = await createUserApiKey(name.trim())
      const payload = res?.data || {}
      const created = payload.key as UserApiKeyItem | undefined
      if (String(payload.code) !== '0' || !created?.api_key) return
      rememberCreatedKey(userId, created.id, created.api_key)
      setName('')
      setAllowPhone(false)
      userStore.getState().setLlmAccess({ llm_api_key: created.api_key, allow_phone_key: false })
      onKeyChange(created.api_key)
      message.success('密钥已创建。点密钥旁边的「复制」即可，下次打开本页还能再复制')
      await load()
    } finally {
      setLoading(false)
    }
  }

  async function onToggle(item: UserApiKeyItem) {
    const res: any = item.is_active ? await disableUserApiKey(item.id) : await enableUserApiKey(item.id)
    const payload = res?.data || {}
    if (String(payload.code) !== '0') return
    if (item.is_active && llm_api_key && storedSecret(userId, item.id) === llm_api_key) {
      userStore.getState().setLlmAccess({ llm_api_key: '' })
      onKeyChange('')
    }
    message.success(item.is_active ? '已禁用' : '已启用')
    await load()
  }

  async function onDelete(item: UserApiKeyItem) {
    const wasCurrent = Boolean(llm_api_key && storedSecret(userId, item.id) === llm_api_key)
    const res: any = await deleteUserApiKey(item.id)
    const payload = res?.data || {}
    if (String(payload.code) !== '0') return
    forgetStoredKey(userId, item.id)
    if (wasCurrent) {
      userStore.getState().setLlmAccess({ llm_api_key: '', allow_phone_key: false })
      onKeyChange('')
    }
    message.success('密钥已删除')
    await load()
  }

  function keySecret(item: UserApiKeyItem) {
    return item.api_key || storedSecret(userId, item.id)
  }

  function selectApiKey(item: UserApiKeyItem) {
    const secret = keySecret(item)
    if (!secret) {
      message.warning('暂时读不到完整密钥，请刷新页面后再试')
      return
    }
    selectStoredKey(userId, item.id)
    userStore.getState().setLlmAccess({
      llm_api_key: secret,
      allow_phone_key: allowPhone && keys.length === 0
    })
    onKeyChange(secret)
    message.success('下面的表格已改用这把密钥')
  }

  const phoneUsable = allowPhone && keys.length === 0

  function usePhone() {
    if (!phoneUsable || !phone) return
    selectStoredKey(userId, 'phone')
    userStore.getState().setLlmAccess({ llm_api_key: phone, allow_phone_key: true })
    onKeyChange(phone)
  }

  return (
    <section className={styles.card}>
      <div className={styles.stepHead}>
        <span>第 1 步</span>
        <h2>创建并选择密钥</h2>
      </div>
      <p>软件里的 API Key 填 sk- 开头的密钥。每把密钥旁边都有复制按钮，下次打开本页还可以再复制。禁用后可以再启用；删除后这把密钥立即失效。</p>
      {!token ? (
        <p className={styles.hint}>
          还没账号？
          <Button type="link" onClick={() => setLoginModal(true)}>
            先登录 / 注册
          </Button>
        </p>
      ) : (
        <>
          {phoneUsable ? (
            <Alert
              showIcon
              type="info"
              style={{ marginBottom: 12 }}
              message="手机号暂时还能请求模型"
              description="这是 2026年10月1日前注册、且还没生成过 sk- 密钥的账号。一旦生成密钥，手机号就不能再请求模型，删掉密钥也不会恢复。价目、用量和其他功能一直可用。"
            />
          ) : (
            <Alert
              showIcon
              type="warning"
              style={{ marginBottom: 12 }}
              message="手机号不能再请求模型"
              description="请创建一把 sk- 密钥再调用模型。价目、用量、模型列表和账户功能仍可正常使用。已经生成过密钥的账号，删掉全部密钥后，手机号也不会重新用来请求模型。"
            />
          )}
          <div className={styles.phoneBox}>
            <Input
              size="large"
              value={name}
              maxLength={40}
              placeholder="备注，例如：家里的电脑"
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="primary" size="large" loading={loading} onClick={() => void onCreate()}>
              生成密钥
            </Button>
          </div>
          {phoneUsable && phone ? (
            <div className={llm_api_key === phone ? styles.keyRowActive : styles.keyRow}>
              <div>
                <Tag color="gold">旧密钥</Tag>
                <strong>手机号</strong>
                <div className={styles.keyLine}>
                  <code>{phone}</code>
                  <CopyButton text={phone} />
                </div>
              </div>
              <Button onClick={usePhone}>用这一个</Button>
            </div>
          ) : null}
          <div className={styles.keyList}>
            {keys.length === 0 ? <p className={styles.hint}>还没有 sk- 密钥。</p> : null}
            {keys.map((item) => {
              const secret = keySecret(item)
              const active = Boolean(item.is_active)
              const current = Boolean(secret && llm_api_key === secret)
              return (
                <div key={item.id} className={current ? styles.keyRowActive : styles.keyRow}>
                  <div>
                    <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '已禁用'}</Tag>
                    <strong>{item.name || '未命名'}</strong>
                    <em>{item.created_at}</em>
                    <div className={styles.keyLine}>
                      <code>{secret || item.key_mask}</code>
                      <CopyButton text={secret} />
                    </div>
                  </div>
                  <div className={styles.keyActions}>
                    {active ? (
                      <Button disabled={!secret} onClick={() => selectApiKey(item)}>
                        用这一个
                      </Button>
                    ) : (
                      <Button type="primary" onClick={() => void onToggle(item)}>
                        启用
                      </Button>
                    )}
                    {active ? (
                      <Button danger onClick={() => void onToggle(item)}>
                        禁用
                      </Button>
                    ) : null}
                    <Popconfirm
                      title={`删除 ${item.name || '这把密钥'}？`}
                      description="删除后无法恢复，正在使用它的软件会立刻无法调用。"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => void onDelete(item)}
                    >
                      <Button danger>删除</Button>
                    </Popconfirm>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
