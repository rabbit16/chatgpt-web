import { delGPTListMessage ,delGPTListAll} from '@/request/api'
import chatStore from './slice'
import userStore from '../user/slice'

async function fetchChatMessages() {
  return null
}

async function fetchDelUserMessages(params: { id?: string | number; type: string }) {
  if (params.type === 'clear' && params.id) {
    chatStore.getState().clearChatMessage(params.id)
  } else if (params.type === 'del' && params.id) {
    chatStore.getState().delChat(params.id)
  } else if (params.type === 'delAll') {
    chatStore.getState().clearChats()
  }
}

async function fetchDelUserMessagesList(params:{id:string}) {
 const res = await delGPTListMessage({userId:userStore.getState().user_info?.data?.bodyMessage?.userId as number,chat_id:params.id})
  
 if(res?.data?.code === '0'){
    userStore.getState().upDataGlobal()
  }  
}
async function fetchDelUserMessagesListAll() {
  const res = await delGPTListAll({userId:userStore.getState().user_info?.data?.bodyMessage?.userId as number})
  
  if(res?.data?.code === '0'){
     userStore.getState().upDataGlobal()
   }  
 }

export default {
  fetchChatMessages,
  fetchDelUserMessages,
  fetchDelUserMessagesList,
  fetchDelUserMessagesListAll
}
