import { RequestLoginParams, WithdrawalRecordInfo, Register,Login } from '@/types'
import userStore from '../user/slice'
import chatStore from '../chat/slice'
import { getUserInfo, getUserRecords, postLogin, postUserWithdrawal, putUserPassword,postRegister } from '@/request/api'

// 登录
export async function fetchLogin(params: Login) {
  const response:any = await postLogin(params);
  console.log(response);
  
  if (!response.code) {
    userStore.getState().login({ token:response.data.token,user_info:response })
    // window.localStorage.setItem(token,)
  }
  return response
}
// 注册
export async function fetchRegister(params: Register) {
  const response:any = await postRegister(params)
  if (!response.code) {
    userStore.getState().login({ ...response.data })
  }
  return response
}

// 获取用户信息
export async function fetchUserInfo() {
  // const response = await getUserInfo()
  // if (!response.code) {
  //   userStore.getState().login({
  //     token: userStore.getState().token,
  //     user_info: response.data
  //   })
  // }
  return null
}

// 重置用户密码
export async function fetchUserPassword(params: RequestLoginParams) {
  const response = await putUserPassword(params)
  if (!response.code) {
    userStore.getState().logout()
	chatStore.getState().clearChats()
  }
  return response
}

// 用户数据
export async function fetchUserRecords(params: {
  page: number
  page_size: number
  type: string | number
}) {
  const response = await getUserRecords({ ...params })
  if (!response.code) {
    userStore.getState().changeRecords(response.data, params.type)
  }
  return response
}

export async function fetchUserWithdrawal(params: WithdrawalRecordInfo) {
  const response = await postUserWithdrawal({ ...params })
  if (!response.code) {
	userStore.getState().changeUserCurrentAmount()
  }
  return response
}

export default {
  fetchUserInfo,
  fetchLogin,
  fetchUserPassword,
  fetchRegister
}
