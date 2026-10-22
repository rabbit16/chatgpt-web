import MarkdownIt from 'markdown-it'
import mila from 'markdown-it-link-attributes'
import katex from 'katex'
import html2canvas from 'html2canvas'
import { normalizeMath } from './prepareMarkdown'

type MathItem = {
  tex: string
  block: boolean
}

const documentMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})
documentMarkdown.use(mila, { attrs: { target: '_blank', rel: 'noopener' } })

function escapeAttr(text: string) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formulaSpan(tex: string) {
  return `<span class="ql-formula" data-value="${escapeAttr(tex)}"></span>`
}

export function extractMathBlocks(text: string): { text: string; math: MathItem[] } {
  const math: MathItem[] = []
  const codes: string[] = []
  let value = normalizeMath(text || '')

  value = value.replace(/```[\s\S]*?```/g, (match) => {
    codes.push(match)
    return `@@CODE${codes.length - 1}@@`
  })
  value = value.replace(/`[^`\n]+`/g, (match) => {
    codes.push(match)
    return `@@CODE${codes.length - 1}@@`
  })

  value = value.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex: string) => {
    math.push({ tex: String(tex).trim(), block: true })
    return `\n\n@@MATH${math.length - 1}@@\n\n`
  })
  value = value.replace(/\$([^$\n]+)\$/g, (_, tex: string) => {
    math.push({ tex: String(tex).trim(), block: false })
    return `@@MATH${math.length - 1}@@`
  })

  value = value.replace(/@@CODE(\d+)@@/g, (_, index: string) => codes[Number(index)] || '')
  return { text: value, math }
}

export function markdownToQuillHtml(text: string) {
  if (!text) return ''
  const { text: stripped, math } = extractMathBlocks(text)
  let html = documentMarkdown.render(stripped)
  html = html.replace(/<p>\s*@@MATH(\d+)@@\s*<\/p>/g, (_, index: string) => {
    const item = math[Number(index)]
    if (!item) return ''
    return `<p class="ql-align-center">${formulaSpan(item.tex)}</p>`
  })
  html = html.replace(/@@MATH(\d+)@@/g, (_, index: string) => {
    const item = math[Number(index)]
    if (!item) return ''
    return item.block
      ? `</p><p class="ql-align-center">${formulaSpan(item.tex)}</p><p>`
      : formulaSpan(item.tex)
  })
  return html
}

export function isBlockFormula(node: HTMLElement) {
  const parent = node.parentElement
  if (!parent) return false
  if (parent.classList.contains('ql-align-center')) return true
  const extra = [...parent.childNodes].some((child) => {
    if (child === node) return false
    if (child.nodeType === Node.TEXT_NODE) return Boolean((child.textContent || '').trim())
    return true
  })
  return !extra && parent.tagName === 'P'
}

export function hydrateFormulas(root?: HTMLElement | null) {
  if (!root) return
  root.querySelectorAll<HTMLElement>('span.ql-formula').forEach((node) => {
    const tex = node.getAttribute('data-value')
    if (!tex) return
    const block = isBlockFormula(node)
    if (node.querySelector('.katex-display')) return
    if (!block && node.querySelector('.katex')) return
    node.innerHTML = ''
    try {
      katex.render(tex, node, {
        displayMode: block,
        throwOnError: false,
        errorColor: '#cc0000',
        strict: false
      })
    } catch {
      node.textContent = tex
    }
  })
}

export function opsToText(ops: any[] = []) {
  return ops
    .map((op) => {
      if (typeof op?.insert === 'string') return op.insert
      if (op?.insert?.formula) return `$${op.insert.formula}$`
      return ''
    })
    .join('')
}

export function editorToMarkdown(quill: any) {
  return opsToText(quill?.getContents?.()?.ops || []).trim()
}

export function editorHtmlToPandocHtml(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('span.ql-formula').forEach((node) => {
    const tex = node.getAttribute('data-value') || ''
    const block = isBlockFormula(node as HTMLElement)
    node.replaceWith(document.createTextNode(block ? `$$${tex}$$` : `$${tex}$`))
  })
  return clone.innerHTML
}

export function htmlWithRenderedKatex(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll('span.ql-formula').forEach((node) => {
    const tex = node.getAttribute('data-value') || ''
    const block = isBlockFormula(node as HTMLElement)
    try {
      const rendered = katex.renderToString(tex, {
        displayMode: block,
        throwOnError: false,
        strict: false
      })
      const wrap = document.createElement(block ? 'div' : 'span')
      wrap.innerHTML = rendered
      node.replaceWith(wrap)
    } catch {
      node.replaceWith(document.createTextNode(`$${tex}$`))
    }
  })
  return clone.innerHTML
}

async function latexToPngDataUrl(latex: string, displayMode = false) {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-99999px;top:0;padding:8px 10px;background:#fff;color:#111;font-size:18px;line-height:1.2;'
  document.body.appendChild(host)
  try {
    katex.render(latex, host, {
      displayMode,
      throwOnError: false,
      strict: false
    })
    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    })
    return canvas.toDataURL('image/png')
  } finally {
    document.body.removeChild(host)
  }
}

export async function htmlWithFormulaImages(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement
  const nodes = [...clone.querySelectorAll<HTMLElement>('span.ql-formula')]
  for (const node of nodes) {
    const tex = node.getAttribute('data-value') || ''
    const block = isBlockFormula(node)
    const img = document.createElement('img')
    try {
      img.src = await latexToPngDataUrl(tex, block)
      img.alt = tex
      img.className = block ? 'k-formula-block' : 'k-formula'
      if (block) {
        img.style.display = 'block'
        img.style.margin = '8px auto'
      } else {
        img.style.verticalAlign = 'middle'
      }
      node.replaceWith(img)
    } catch {
      node.replaceWith(document.createTextNode(`$${tex}$`))
    }
  }
  return clone.innerHTML
}

export function wrapWordHtml(body: string, title: string) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeAttr(
    title
  )}</title><style>body{font-family:'Times New Roman','Songti SC',SimSun,serif;font-size:12pt;line-height:1.8;color:#222}img.k-formula{vertical-align:middle}img.k-formula-block{display:block;margin:8px auto;max-width:100%}</style></head><body>${body}</body></html>`
}

export function wrapHtmlDocument(body: string, title: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeAttr(
    title
  )}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css"></head><body>${body}</body></html>`
}
