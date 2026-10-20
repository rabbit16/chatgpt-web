import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import 'katex/dist/katex.min.css'
import { Button, Dropdown, Empty, Input, Modal, Space, message } from 'antd'
import { DownloadOutlined, EditOutlined, HighlightOutlined } from '@ant-design/icons'
import {
  editorToMarkdown,
  htmlWithRenderedKatex,
  hydrateFormulas,
  markdownToQuillHtml,
  opsToText,
  wrapHtmlDocument,
  wrapWordHtml
} from '@/utils/documentMath'
import { prepareMarkdown } from '@/utils/prepareMarkdown'
import './formulaBlot'
import styles from './index.module.less'

export type DocumentPatch = {
  id: string
  text: string
  mode: 'append' | 'insert'
  streaming?: boolean
}

export type DocumentPaneHandle = {
  beginWrite: (mode: 'append' | 'insert', id: string) => void
  writeStream: (text: string) => void
  endWrite: (text: string) => void
  getCursorIndex: () => number
}

type Props = {
  chatId?: string | number
  initialText?: string
  disabled?: boolean
  onContinue: (prompt: string) => void
}

type StreamState = {
  id: string
  mode: 'append' | 'insert'
  start: number
  /** 当前流式片段在编辑器里占用的长度 */
  span: number
}

type CaretPos = {
  top: number
  left: number
  height: number
}

const Quill = ReactQuill.Quill

const DEFAULT_PROMPT =
  '请从光标处继续撰写，保持语气、风格和体裁一致。只输出续写内容，不要重复原文，不要解释。'

const DRAFT_PREFIX = 'chatgpt-doc-draft:'

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    [{ color: [] }, { background: [] }],
    ['blockquote', 'link'],
    ['clean']
  ]
}

const formats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'indent',
  'align',
  'color',
  'background',
  'blockquote',
  'link',
  'formula'
]

function draftKey(chatId?: string | number) {
  return `${DRAFT_PREFIX}${chatId ?? ''}`
}

function loadDraft(chatId?: string | number) {
  if (chatId == null || chatId === '') return ''
  try {
    return localStorage.getItem(draftKey(chatId)) || ''
  } catch {
    return ''
  }
}

function saveDraft(chatId: string | number | undefined, html: string) {
  if (chatId == null || chatId === '') return
  try {
    if (!html || !html.replace(/<(.|\n)*?>/g, '').trim()) {
      localStorage.removeItem(draftKey(chatId))
      return
    }
    localStorage.setItem(draftKey(chatId), html)
  } catch {
    // ignore
  }
}

function nearbyContext(instance: any, index: number) {
  const start = Math.max(0, index - 500)
  const before = opsToText(instance.getContents(start, index - start)?.ops || []).trim()
  const after = opsToText(instance.getContents(index, 240)?.ops || []).trim()
  return { before, after }
}

function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function stamp() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

function indexFromPoint(instance: any, clientX: number, clientY: number) {
  try {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    let node: Node | null = null
    let offset = 0
    if (typeof doc.caretPositionFromPoint === 'function') {
      const pos = doc.caretPositionFromPoint(clientX, clientY)
      if (pos) {
        node = pos.offsetNode
        offset = pos.offset
      }
    } else if (typeof doc.caretRangeFromPoint === 'function') {
      const range = doc.caretRangeFromPoint(clientX, clientY)
      if (range) {
        node = range.startContainer
        offset = range.startOffset
      }
    }
    if (!node || !instance.root.contains(node)) return null
    const blot = Quill.find(node, true)
    if (!blot) return null
    return instance.getIndex(blot) + offset
  } catch {
    return null
  }
}

const DocumentPane = forwardRef<DocumentPaneHandle, Props>(function DocumentPane(
  { chatId, initialText, disabled, onContinue },
  ref
) {
  const quillRef = useRef<ReactQuill | null>(null)
  const streamState = useRef<StreamState | null>(null)
  const insertIndex = useRef<number | null>(null)
  const saveTimer = useRef<number | null>(null)
  const streamTimer = useRef<number | null>(null)
  const pendingStreamText = useRef('')
  const suppressChange = useRef(false)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [userPrompt, setUserPrompt] = useState(DEFAULT_PROMPT)
  const [contextPreview, setContextPreview] = useState({ before: '', after: '' })
  const [downloading, setDownloading] = useState(false)
  const [draftHint, setDraftHint] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamMode, setStreamMode] = useState<'append' | 'insert' | null>(null)
  const [caretPos, setCaretPos] = useState<CaretPos | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const editor = () => quillRef.current?.getEditor()

  function syncValueFromEditor() {
    const instance = editor()
    if (!instance) return
    const html = instance.root.innerHTML
    suppressChange.current = true
    setValue(html)
    saveDraft(chatId, html)
    queueMicrotask(() => {
      suppressChange.current = false
    })
  }

  function updateCaretMarker(index: number) {
    const instance = editor()
    const paper = paperRef.current
    if (!instance || !paper) {
      setCaretPos(null)
      return
    }
    try {
      const bounds = instance.getBounds(Math.max(index, 0))
      const container = instance.container as HTMLElement
      const paperRect = paper.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setCaretPos({
        top: containerRect.top - paperRect.top + bounds.top,
        left: containerRect.left - paperRect.left + bounds.left,
        height: Math.max(bounds.height || 22, 18)
      })
      const caretBottom = bounds.top + bounds.height
      if (bounds.top < 24) {
        container.scrollTop = Math.max(container.scrollTop + bounds.top - 40, 0)
      } else if (caretBottom > container.clientHeight - 24) {
        container.scrollTop += caretBottom - container.clientHeight + 60
      }
    } catch {
      setCaretPos(null)
    }
  }

  function rememberCursor(forceIndex?: number) {
    const instance = editor()
    if (!instance) return 0
    if (typeof forceIndex === 'number') {
      insertIndex.current = Math.max(0, Math.min(forceIndex, instance.getLength() - 1))
      instance.setSelection(insertIndex.current, 0, 'silent')
      return insertIndex.current
    }
    const range = instance.getSelection()
    const index = range ? range.index : Math.max(instance.getLength() - 1, 0)
    insertIndex.current = index
    return index
  }

  function replaceStreamRegion(markdown: string, finalize: boolean) {
    const instance = editor()
    const state = streamState.current
    if (!instance || !state) return

    const source = finalize ? markdown.trim() : prepareMarkdown(markdown, true)
    suppressChange.current = true
    if (state.span > 0) {
      const maxDelete = Math.max(instance.getLength() - 1 - state.start, 0)
      instance.deleteText(state.start, Math.min(state.span, maxDelete), 'silent')
    }

    const before = instance.getLength()
    const html = markdownToQuillHtml(source)
    if (html) {
      instance.clipboard.dangerouslyPasteHTML(state.start, html)
    } else if (source) {
      instance.insertText(state.start, source, 'silent')
    }
    const inserted = Math.max(instance.getLength() - before, 0)
    state.span = inserted
    const caret = Math.min(state.start + Math.max(inserted - 1, 0), instance.getLength() - 1)
    insertIndex.current = caret
    instance.setSelection(caret, 0, 'silent')
    if (finalize) {
      hydrateFormulas(instance.root)
    }
    syncValueFromEditor()
    updateCaretMarker(caret)
  }

  function beginWrite(mode: 'append' | 'insert', id: string) {
    const instance = editor()
    if (!instance) return
    if (streamTimer.current) {
      window.clearTimeout(streamTimer.current)
      streamTimer.current = null
    }
    pendingStreamText.current = ''

    let insertAt = Math.max(instance.getLength() - 1, 0)
    if (mode === 'insert') {
      insertAt = insertIndex.current != null ? insertIndex.current : insertAt
    } else {
      const hasContent = opsToText(instance.getContents()?.ops || []).trim()
      if (hasContent) {
        suppressChange.current = true
        instance.insertText(insertAt, '\n\n', 'silent')
        suppressChange.current = false
        insertAt += 2
        syncValueFromEditor()
      }
    }
    streamState.current = { id, mode, start: insertAt, span: 0 }
    setStreamMode(mode)
    setStreaming(true)
    instance.focus()
    instance.setSelection(insertAt, 0, 'silent')
    updateCaretMarker(insertAt)
  }

  function writeStream(text: string) {
    if (!streamState.current) return
    pendingStreamText.current = text || ''
    if (streamTimer.current) return
    streamTimer.current = window.setTimeout(() => {
      streamTimer.current = null
      if (!streamState.current) return
      replaceStreamRegion(pendingStreamText.current, false)
    }, 60)
  }

  function endWrite(text: string) {
    if (streamTimer.current) {
      window.clearTimeout(streamTimer.current)
      streamTimer.current = null
    }
    const instance = editor()
    const state = streamState.current
    if (!instance || !state) {
      setStreaming(false)
      setStreamMode(null)
      setCaretPos(null)
      return
    }
    const finalText = (text || pendingStreamText.current || '').trim()
    if (!finalText) {
      // 中止：保留当前已渲染内容
      streamState.current = null
      pendingStreamText.current = ''
      setStreaming(false)
      setStreamMode(null)
      setCaretPos(null)
      syncValueFromEditor()
      setDraftHint('已暂存')
      return
    }
    replaceStreamRegion(finalText, true)
    streamState.current = null
    pendingStreamText.current = ''
    setStreaming(false)
    setStreamMode(null)
    setCaretPos(null)
    setDraftHint('已暂存')
  }

  useImperativeHandle(ref, () => ({
    beginWrite,
    writeStream,
    endWrite,
    getCursorIndex: () => rememberCursor()
  }))

  useEffect(() => {
    streamState.current = null
    insertIndex.current = null
    pendingStreamText.current = ''
    if (streamTimer.current) {
      window.clearTimeout(streamTimer.current)
      streamTimer.current = null
    }
    setPromptOpen(false)
    setCtxMenu(null)
    setStreaming(false)
    setStreamMode(null)
    setCaretPos(null)
    setUserPrompt(DEFAULT_PROMPT)
    const draft = loadDraft(chatId)
    if (draft) {
      setValue(draft)
      setDraftHint('已恢复暂存')
    } else {
      setValue(markdownToQuillHtml(initialText || ''))
      setDraftHint('')
    }
  }, [chatId])

  useEffect(() => {
    hydrateFormulas(editor()?.root)
  }, [value, chatId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (streamTimer.current) window.clearTimeout(streamTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [ctxMenu])

  useEffect(() => {
    const root = editor()?.root as HTMLElement | undefined
    if (!root || !chatId) return
    const onMenu = (e: MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      const instance = editor()
      if (!instance) return
      const fromPoint = indexFromPoint(instance, e.clientX, e.clientY)
      const index = rememberCursor(fromPoint ?? undefined)
      instance.setSelection(index, 0)
      setCtxMenu({ x: e.clientX, y: e.clientY })
    }
    root.addEventListener('contextmenu', onMenu)
    return () => root.removeEventListener('contextmenu', onMenu)
  }, [chatId, value, disabled])

  function openContinueModal(atIndex?: number) {
    if (disabled) return
    setCtxMenu(null)
    const instance = editor()
    const index = rememberCursor(atIndex)
    if (instance) {
      setContextPreview(nearbyContext(instance, index))
    } else {
      setContextPreview({ before: '', after: '' })
    }
    setUserPrompt(DEFAULT_PROMPT)
    setPromptOpen(true)
  }

  function submitContinue() {
    const prompt = userPrompt.trim()
    if (!prompt) {
      message.warning('请先输入续写提示词')
      return
    }
    const { before, after } = contextPreview
    const context = [before && `前文：\n${before}`, after && `后文：\n${after}`]
      .filter(Boolean)
      .join('\n\n')
    const fullPrompt = context
      ? `${prompt}\n\n【光标附近原文】\n${context}\n\n请只输出续写内容，不要重复原文。`
      : prompt
    setPromptOpen(false)
    onContinue(fullPrompt)
  }

  function currentHtml() {
    return editor()?.root.innerHTML || value || ''
  }

  function currentText() {
    const instance = editor()
    if (instance) return editorToMarkdown(instance)
    return (value || '').replace(/<(.|\n)*?>/g, ' ').trim()
  }

  async function download(kind: 'docx' | 'md' | 'html') {
    const instance = editor()
    const html = currentHtml()
    const text = currentText()
    if (!html.replace(/<(.|\n)*?>/g, '').trim() && !text) {
      message.warning('文稿是空的，没有可下载的内容')
      return
    }
    const name = `文稿-${stamp()}`
    if (kind === 'md') {
      downloadBlob(text, `${name}.md`, 'text/markdown;charset=utf-8')
      message.success('已开始下载')
      return
    }
    if (kind === 'html') {
      const body = instance?.root ? htmlWithRenderedKatex(instance.root) : html
      downloadBlob(wrapHtmlDocument(body, name), `${name}.html`, 'text/html;charset=utf-8')
      message.success('已开始下载')
      return
    }

    // Word：本地即时导出，避免等后端 / 公式截图转圈
    setDownloading(true)
    try {
      const body = instance?.root ? htmlWithRenderedKatex(instance.root) : html
      downloadBlob(wrapWordHtml(body, name), `${name}.doc`, 'application/msword')
      message.success('已开始下载')
    } catch {
      message.error('导出失败，请稍后重试')
    } finally {
      setDownloading(false)
    }
  }

  const placeholder = useMemo(
    () => '右键点击光标处可续写；普通对话会自动追加到文末。',
    []
  )

  return (
    <div className={styles.documentPane}>
      <div className={styles.documentPane_header}>
        <div className={styles.documentPane_title}>
          <EditOutlined />
          <span>文稿</span>
          {!streaming && draftHint ? <em className={styles.documentPane_draft}>{draftHint}</em> : null}
        </div>
        <Space size={8} wrap>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'docx', label: 'Word (.doc)' },
                { key: 'md', label: 'Markdown (.md)' },
                { key: 'html', label: '网页 (.html)' }
              ],
              onClick: ({ key }) => download(key as 'docx' | 'md' | 'html')
            }}
          >
            <Button size="small" icon={<DownloadOutlined />} disabled={!chatId || downloading || streaming} loading={downloading}>
              下载文档
            </Button>
          </Dropdown>
          <Button
            type="primary"
            size="small"
            icon={<HighlightOutlined />}
            disabled={disabled || !chatId || streaming}
            onClick={() => openContinueModal()}
          >
            续写
          </Button>
        </Space>
      </div>

      {streaming ? (
        <div className={styles.documentPane_status} role="status">
          <span className={styles.documentPane_statusDot} />
          <strong>{streamMode === 'insert' ? '正在从光标处续写' : '正在写入文稿末尾'}</strong>
          <span>请稍候，内容会边生成边排版显示</span>
        </div>
      ) : (
        <div className={styles.documentPane_hint}>
          在文稿里右键可续写；对话内容会按格式追加到文末。
        </div>
      )}

      <div className={styles.documentPane_paper} ref={paperRef}>
        {chatId ? (
          <>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              value={value}
              onChange={(html) => {
                if (suppressChange.current || streaming) return
                setValue(html)
                if (saveTimer.current) window.clearTimeout(saveTimer.current)
                saveTimer.current = window.setTimeout(() => {
                  saveDraft(chatId, html)
                  setDraftHint('已暂存')
                }, 400)
              }}
              onChangeSelection={(range) => {
                if (range && !streaming) insertIndex.current = range.index
              }}
              modules={modules}
              formats={formats}
              placeholder={placeholder}
              readOnly={streaming}
            />
            {streaming && caretPos ? (
              <div
                className={styles.documentPane_liveCaret}
                style={{
                  top: caretPos.top,
                  left: caretPos.left,
                  height: caretPos.height
                }}
              >
                <i />
                <em>{streamMode === 'insert' ? '续写中' : '写入中'}</em>
              </div>
            ) : null}
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先选择一个对话" />
        )}
      </div>

      {ctxMenu ? (
        <div
          className={styles.documentPane_ctx}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => openContinueModal(insertIndex.current ?? undefined)}
          >
            <HighlightOutlined /> 从此处续写
          </button>
        </div>
      ) : null}

      <Modal
        title="输入续写提示词"
        open={promptOpen}
        okText="开始续写"
        cancelText="取消"
        confirmLoading={disabled}
        onCancel={() => setPromptOpen(false)}
        onOk={submitContinue}
        destroyOnClose
      >
        {(contextPreview.before || contextPreview.after) && (
          <div className={styles.documentPane_context}>
            <div className={styles.documentPane_context_label}>光标附近原文（会一并发给 AI）</div>
            {contextPreview.before && <pre>{contextPreview.before}</pre>}
            <div className={styles.documentPane_context_caret}>▾ 光标在这里</div>
            {contextPreview.after && <pre>{contextPreview.after}</pre>}
          </div>
        )}
        <div className={styles.documentPane_promptLabel}>你的提示词</div>
        <Input.TextArea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          autoSize={{ minRows: 4, maxRows: 8 }}
          placeholder="例如：把这一段改成更正式的口吻，并补一段结论"
          maxLength={2000}
          showCount
        />
      </Modal>
    </div>
  )
})

export default DocumentPane
