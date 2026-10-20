export function handleChatData(text: string) {
  const lines = text.split('\n\n')
  const data = []
  const parseErrors = []

  const isValidData = (data: any) => {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.dateTime === 'string' &&
      data.dateTime.trim() !== ''
    )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line !== '') {
      try {
        const parsedData = JSON.parse(line)

        if (isValidData(parsedData)) {
          const { dateTime, ...otherProps } = parsedData
          data.push({ dateTime, ...otherProps })
        } else {
          parseErrors.push(line)
        }
      } catch (error) {
        parseErrors.push(line)
      }
    }
  }

  return data
}
export function analyzeChatData(text:string){
  const chunks: any[] = []
  for (const value of text?.split('$_$').slice(0, -1) || []) {
    if (!value) continue
    try {
      chunks.push(JSON.parse(value))
    } catch (error) {
      console.warn('解析对话流失败', error)
    }
  }
  return chunks
}