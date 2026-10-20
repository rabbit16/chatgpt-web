import { AutoComplete, Button, Input, Modal, message, Switch, } from 'antd'
import styles from './index.module.less'
import { ClearOutlined, CloudDownloadOutlined, SyncOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { promptStore } from '@/store'
import useDocumentResize from '@/hooks/useDocumentResize'
import { htmlToImage } from '@/utils/htmlToImage'
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {  Upload } from 'antd';
import fileIcon from '../../../../assets/img/file.png';
type Props = {
  onSend: (value: string) => Promise<boolean>
  disabled?: boolean
  clearMessage?: () => void
  onStopFetch?: () => void
}
const propsUpload: UploadProps = {
  name: 'file',
  action: '',  //https://run.mocky.io/v3/435e224c-44fb-4773-9faf-380c5e6a2188
  headers: {
    authorization: 'authorization-text',
  },
  onChange(info) {
    if (info.file.status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    if (info.file.status === 'done') {
      message.success(`${info.file.name} file uploaded successfully`);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 对不起，功能正在开发中，后续加入文件问答！`);
    }
  },
};
function AllInput(props: Props) {
  const draftKey = 'chat_unsent_draft'
  const [prompt, setPrompt] = useState(() => localStorage.getItem(draftKey) || '')
  const promptRef = useRef(prompt)
  const { localPrompt } = promptStore()

  const updatePrompt = (value: string) => {
    promptRef.current = value
    setPrompt(value)
    if (value) localStorage.setItem(draftKey, value)
    else localStorage.removeItem(draftKey)
  }

  const send = async () => {
    const value = promptRef.current
    if (!value.trim()) return
    const sent = await props.onSend(value)
    if (sent && promptRef.current === value) updatePrompt('')
  }
  const [inputFile,setInputFile] = useState();
  const bodyResize = useDocumentResize()
  const [downloadModal, setDownloadModal] = useState({
    open: false,
    loading: false
  })
  const inputRef = useRef() as any
  const searchOptions = useMemo(() => {
    if (prompt.startsWith('/')) {
      return localPrompt
        .filter((item: { key: string }) =>
          item.key.toLowerCase().includes(prompt.substring(1).toLowerCase())
        )
        .map((obj) => {
          return {
            label: obj.key,
            value: obj.value
          }
        })
    } else {
      return []
    }
  }, [prompt])

  // 保存聊天记录到图片
  async function downloadChatRecords() {
    setDownloadModal((d) => ({ ...d, loading: true }))
    htmlToImage('image-wrapper')
      .then(() => {
        message.success('下载聊天记录成功')
        setDownloadModal((d) => ({ ...d, open: false, loading: false }))
      })
      .catch(() => {
        message.error('下载聊天记录失败')
      })
  }
  useEffect(() => {
    inputRef.current.resizableTextArea.textArea.style.fontSize = '16px'
  }, [])
  return (
    <div className={styles.allInput}>
  <Upload {...propsUpload} 
    maxCount={1}
    multiple
  >
  <div
          className={styles.allInput_icon}
       
        >
          <img src={fileIcon} alt="" style={{height:'24px',width:'24px'}} />
        </div>
  </Upload>
      {bodyResize.width > 800 && (
        <div
          className={styles.allInput_icon}
          onClick={() => {
            setDownloadModal((d) => ({ ...d, open: true }))
          }}
        >
          <CloudDownloadOutlined />
        </div>
      )}
      {/* <div
        className={styles.allInput_icon}
        onClick={() => {
          if (!props.disabled) {
            props?.clearMessage?.()
          } else {
            message.warning('请结束回答后在操作')
          }
        }}
      >
        <ClearOutlined />
      </div> */}
      <AutoComplete
        value={prompt}
        options={searchOptions}
        disabled={props.disabled}
        style={{
          width: '100%',
          maxWidth: 800
        }}
        onSelect={(value) => {
          if (props.disabled) return
          updatePrompt(value)
        }}
      >
        <Input.TextArea
          value={prompt}
          ref={inputRef}
          disabled={props.disabled}
          size="large"
          placeholder={props.disabled ? '正在回答，请等待或点停止…' : '问点什么吧...'}
          autoSize={{
            maxRows: 4
          }}
          onPressEnter={(e) => {
            if (e.key === 'Enter' && e.keyCode === 13 && e.shiftKey) {
              // === 无操作 ===
            } else if (e.key === 'Enter' && e.keyCode === 13 && bodyResize.width > 800) {
              if (!props.disabled) {
                void send()
              }
              e.preventDefault() //禁止回车的默认换行
            }
          }}
          onChange={(e) => {
            if (props.disabled) return
            updatePrompt(e.target.value)
          }}
        />
      </AutoComplete>
      {props.disabled ? (
        <Button
          className={styles.allInput_button}
          type="primary"
          size="large"
          ghost
          danger
          onClick={() => {
            props.onStopFetch?.()
          }}
        >
          <SyncOutlined spin /> 停止回答
        </Button>
      ) : (
        <Button
          className={styles.allInput_button}
          type="primary"
          size="large"
          disabled={!prompt || props.disabled}
          onClick={() => {
            void send()
          }}
        >
          发送
        </Button>
      )}

      <Modal
        title="保存当前对话记录"
        open={downloadModal.open}
        onOk={() => {
          downloadChatRecords()
        }}
        confirmLoading={downloadModal.loading}
        onCancel={() => {
          setDownloadModal({ open: false, loading: false })
        }}
      >
        <p>是否将当前对话记录保存为图片？</p>
      </Modal>
    </div>
  )
}

export default AllInput
