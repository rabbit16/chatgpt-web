import { getConfig,getModelList } from '@/request/api'
import configStore from './slice'

async function fetchConfig() {
  const res = await getConfig()
  if (!res.code) {
	configStore.getState().replaceData(res.data)
  }
  return res
}
async function fetchGetModelList() {
  const res = await getModelList();
  console.log(res);
  
  let data = res?.data?.modeList?.map((value:any)=>({value:value.mode,label:value.mode}))
  if(data.length>0){
    configStore.getState().upModelsData(data);
    configStore.getState().changeConfig({model:data[0].value})
  }

}

export default {
  fetchConfig,
  fetchGetModelList
}
