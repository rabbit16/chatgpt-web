import MarkdownIt from 'markdown-it'
import mdKatex from '@traptitech/markdown-it-katex'
import mila from 'markdown-it-link-attributes'
import hljs from 'highlight.js/lib/common'
import { prepareMarkdown } from './prepareMarkdown'

function highlightBlock(str: string, lang: string, withHeader = true) {
  if (!withHeader) {
    return `<pre class="code-block-wrapper"><code class="hljs code-block-body ${lang}">${str}</code></pre>`
  }
  return `<pre class="code-block-wrapper"><div class="code-block-header"><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">复制代码</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`
}

function createMarkdown(withCodeHeader = true) {
  const mdi = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    highlight(code, language) {
      const validLang = !!(language && hljs.getLanguage(language))
      if (validLang) {
        const lang = language ?? ''
        return highlightBlock(hljs.highlight(code, { language: lang }).value, lang, withCodeHeader)
      }
      return highlightBlock(hljs.highlightAuto(code).value, '', withCodeHeader)
    }
  })

  mdi.use(mila, { attrs: { target: '_blank', rel: 'noopener' } })
  mdi.use(mdKatex, {
    blockClass: 'katex-block',
    errorColor: '#cc0000',
    throwOnError: false
  })
  return mdi
}

const mdi = createMarkdown(true)
const mdiPlain = createMarkdown(false)

export function renderMarkdown(text: string, streaming = false, options?: { codeHeader?: boolean }) {
  const parser = options?.codeHeader === false ? mdiPlain : mdi
  return parser.render(prepareMarkdown(text || '', streaming))
}
