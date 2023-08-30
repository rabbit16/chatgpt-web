import { chatStore, configStore } from '@/store'
import { configAsync } from '@/store/async'
import { useEffect, useLayoutEffect } from 'react'
import LoginModal from '../LoginModal'
import ConfigModal from '../ConfigModal'
import { userStore } from '@/store'
import { notification } from 'antd'
import React from 'react'
import { getGPTListMessage } from '../../request/api'
type Props = {
  children: React.ReactElement
}

function Global(props: Props) {
  const { models, config, configModal, changeConfig, setConfigModal, notifications } = configStore()
  const { chats, addChat, changeSelectChatId,getAllChatList } = chatStore()
  const { token, loginModal, setLoginModal,upglobal } = userStore()

  const openNotification = ({
    key,
    title,
    content
  }: {
    key: string | number
    title: string
    content: string
  }) => {
    return notification.open({
      key,
      message: title,
      description: (
        <div
          dangerouslySetInnerHTML={{
            __html: content
          }}
        />
      ),
      onClick: () => {
        console.log('Notification Clicked!')
      }
    })
  }

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function onOpenNotifications() {
    for (const item of notifications) {
      await openNotification({
        key: item.id,
        title: item.title,
        content: item.content
      })
      await delay(500)
    }
  }

  useEffect(() => {
    async function init() {
      console.log(123)

      // await chatStore.getState().getAllChatList({userId:userStore.getState().user_info?.data?.bodyMessage?.userId })
      let data = await getGPTListMessage({
        userId: userStore.getState().user_info?.data?.bodyMessage?.userId
      })
      console.log(data, 123)
      // if(data.code ===0 && data?.data.code==='0' && data?.data?.context_dict.length>0){
      //   chatStore.getState().getAllChatList({data:data?.data?.context_dict,id:data?.data?.context_dict[0].id})
      // }
      //  if (data?.data?.context_dict.length <= 0 ) {
      //       addChat()
      // }
      let list = data?.data?.context_dict || []
      list.forEach((value:any)=>{
        let numList = value.data.filter((value:any)=>value.role==='user')
        numList =numList.length>0 ? numList[numList.length-1].text:'新的对话'
        value.path = value.id
        value.name = numList
      })
      console.log(list,111);
      
      if (list.length<=0) {
        addChat()
      } else {
        getAllChatList(list,list[0].id)
        // const id = list[0].id
        // changeSelectChatId(id)
      }
    }

    if (token) {
      init()
    }
    // configAsync.fetchConfig()
  }, [token,upglobal])

  useLayoutEffect(() => {
    onOpenNotifications()
  }, [notification])
  console.log(loginModal)

  return (
    <>
      {props.children}
      <LoginModal
        open={loginModal}
        onCancel={() => {
          setLoginModal(false)
        }}
      />
      <ConfigModal
        open={configModal}
        onCancel={() => {
          setConfigModal(false)
        }}
        models={models}
        onChange={changeConfig}
        data={config}
      />
    </>
  )
}
export default Global
