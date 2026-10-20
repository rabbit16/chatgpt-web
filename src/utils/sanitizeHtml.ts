const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DD', 'DEL', 'DIV', 'DL', 'DT', 'EM',
  'H1', 'H2', 'H3', 'H4', 'HR', 'I', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN',
  'STRONG', 'SUB', 'SUP', 'U', 'UL'
])

const ALLOWED_ATTRIBUTES = new Set(['href', 'title', 'target', 'rel'])

function isSafeUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return false
  }
}

export function sanitizeHtml(input: string): string {
  const template = document.createElement('template')
  template.innerHTML = input

  const cleanNode = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element
        if (!ALLOWED_TAGS.has(element.tagName)) {
          const children = Array.from(element.childNodes)
          if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(element.tagName)) {
            element.remove()
          } else {
            element.replaceWith(...children)
            children.forEach((grandchild) => {
              if (grandchild.nodeType === Node.ELEMENT_NODE) cleanNode(grandchild)
            })
          }
          return
        }
        Array.from(element.attributes).forEach((attribute) => {
          const name = attribute.name.toLowerCase()
          if (!ALLOWED_ATTRIBUTES.has(name) || (name === 'href' && !isSafeUrl(attribute.value))) {
            element.removeAttribute(attribute.name)
          }
        })
        if (element.tagName === 'A') {
          element.setAttribute('rel', 'noopener noreferrer')
          if (element.getAttribute('target') === '_blank') element.setAttribute('target', '_blank')
        }
        cleanNode(element)
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove()
      }
    })
  }

  cleanNode(template.content)
  return template.innerHTML
}
