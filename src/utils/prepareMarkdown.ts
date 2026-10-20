/** 流式输出时未闭合的公式会把后续 markdown 吃掉，先裁掉不完整片段 */
export function prepareMarkdown(text: string, streaming = false) {
  if (!text) return ''
  let value = text
  if (!streaming) {
    return normalizeMath(value)
  }

  const blockMarks = value.split('$$').length - 1
  if (blockMarks % 2 === 1) {
    value = value.slice(0, value.lastIndexOf('$$'))
  }

  const withoutBlocks = value.replace(/\$\$[\s\S]*?\$\$/g, '')
  const inlineMarks = withoutBlocks.split('$').length - 1
  if (inlineMarks % 2 === 1) {
    value = value.slice(0, value.lastIndexOf('$'))
  }

  const parenBlocks = value.split('\\[').length - 1
  const parenCloses = value.split('\\]').length - 1
  if (parenBlocks > parenCloses) {
    value = value.slice(0, value.lastIndexOf('\\['))
  }

  const inlineOpens = value.split('\\(').length - 1
  const inlineCloses = value.split('\\)').length - 1
  if (inlineOpens > inlineCloses) {
    value = value.slice(0, value.lastIndexOf('\\('))
  }

  return normalizeMath(value)
}

const MATH_ENV =
  /\\begin\{(equation\*?|align\*?|aligned\*?|gather\*?|eqnarray\*?)\}([\s\S]*?)\\end\{\1\}/g

function wrapBareMathEnvironments(text: string) {
  return text
    .split(/(\$\$[\s\S]*?\$\$)/g)
    .map((part) => {
      if (part.startsWith('$$')) return part
      return part.replace(MATH_ENV, (match) => `$$\n${match}\n$$`)
    })
    .join('')
}

export function normalizeMath(text: string) {
  let value = text || ''
  value = value.replace(/```(?:math|latex)\s*\n([\s\S]*?)```/gi, (_, expr: string) => {
    return `$$\n${String(expr).trim()}\n$$`
  })
  value = value.replace(/\\\\\[([\s\S]*?)\\\\\]/g, (_, expr: string) => `$$\n${expr.trim()}\n$$`)
  value = value.replace(/\\\\\(([\s\S]*?)\\\\\)/g, (_, expr: string) => `$${expr.trim()}$`)
  value = value.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr: string) => `$$\n${expr.trim()}\n$$`)
  value = value.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr: string) => `$${expr.trim()}$`)
  return wrapBareMathEnvironments(value)
}

export function splitDocumentBlocks(text: string) {
  const source = (text || '').trim()
  if (!source) return []
  const byParagraph = source.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  if (byParagraph.length > 1) return byParagraph
  return source.split('\n').map((item) => item.trim()).filter(Boolean)
}

export function sameChatId(a?: string | number | null, b?: string | number | null) {
  return String(a ?? '') === String(b ?? '')
}
