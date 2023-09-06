import { delUserMessages, getUserMessages,addUserMessages,delGPTListMessage ,delGPTListAll} from '@/request/api'
import chatStore from './slice'
import userStore from '../user/slice'

async function fetchChatMessages() {
  // const res = await getUserMessages()
  // if (!res.code) {
  //   chatStore.getState().changeChatMessage(res.data)
  //   chatStore.getState().addChat()
  // }
  return null
}

async function fetchDelUserMessages(params: { id?: string | number; type: string }) {
  const res = await delUserMessages({ parent_message_id: params.id })
  if (!res.code) {
    if (params.type === 'clear' && params.id) {
      chatStore.getState().clearChatMessage(params.id)
    } else if (params.type === 'del' && params.id) {
      chatStore.getState().delChat(params.id)
    } else if (params.type === 'delAll') {
      chatStore.getState().clearChats()
    }
  }
  return res
}
// async function addChat (params:{userId:string}){
//  let res = await addUserMessages(params);
// }
async function fetchDelUserMessagesList(params:{id:string}) {
 let res:any = await delGPTListMessage({userId:userStore.getState().user_info?.data?.bodyMessage?.userId as number,chat_id:params.id})
  if(res?.data?.code === 0){
    userStore.getState().upDataGlobal()
  }  
}
async function fetchDelUserMessagesListAll() {
  let res:any = await delGPTListAll({userId:userStore.getState().user_info?.data?.bodyMessage?.userId as number})
   if(res?.data?.code === 0){
     userStore.getState().upDataGlobal()
   }  
 }

export default {
  fetchChatMessages,
  fetchDelUserMessages,
  fetchDelUserMessagesList,
  fetchDelUserMessagesListAll
}
