import { isAdmin } from '@/utils/isAdmin'
import { RequestLoginParams, Register, Login } from '@/types'
import userStore from '../user/slice'
import chatStore from '../chat/slice'
import { postLogin, putUserPassword, postRegister } from '@/request/api'

export async function fetchLogin(params: Login) {
  const response:any = await postLogin(params);
  
  if (!response.code) {
    const userInfo = {
      ...response,
      role: isAdmin(response) ? 'administrator' : 'user'
    }
    userStore.getState().login({ token:response.data.token,user_info: userInfo })
  }
  return response
}

export async function fetchRegister(params: Register) {
  const response:any = await postRegister(params)
  if (!response.code) {
    userStore.getState().login({ ...response.data })
  }
  return response
}

export async function fetchUserInfo() {
  return null
}

export async function fetchUserPassword(params: RequestLoginParams) {
  const response = await putUserPassword(params)
  if (!response.code) {
    userStore.getState().logout()
	chatStore.getState().clearChats()
  }
  return response
}

export default {
  fetchUserInfo,
  fetchLogin,
  fetchUserPassword,
  fetchRegister
}
