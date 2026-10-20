import ReactQuill from 'react-quill'
import katex from 'katex'

const Quill: any = ReactQuill.Quill
const Embed: any = Quill.import('blots/embed')

class FormulaBlot extends Embed {
  static blotName = 'formula'
  static className = 'ql-formula'
  static tagName = 'SPAN'

  static create(value: string) {
    const node = super.create(value) as HTMLElement
    if (typeof value === 'string') {
      node.setAttribute('data-value', value)
      try {
        katex.render(value, node, {
          throwOnError: false,
          errorColor: '#cc0000',
          strict: false
        })
      } catch {
        node.textContent = value
      }
    }
    return node
  }

  static value(domNode: HTMLElement) {
    return domNode.getAttribute('data-value') || ''
  }
}

Quill.register(FormulaBlot, true)

export default FormulaBlot
