import axios from 'axios'
import { API_BASE_URL } from '../config/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000
})

export async function loginApi(username, password) {
  try {
    const response = await api.post('/api/auth/login', { username, password })
    
    // 兼容后端可能存在的数据包裹层
    const coreData = response.data?.data !== undefined ? response.data.data : response.data
    
    return {
      token: coreData.access_token,
      // 【修改点1】：提取 refresh_token，以备后续刷新 Token 使用
      refreshToken: coreData.refresh_token,
      
      // 【修改点2】：安全兜底。优先从 user 对象拿，如果全都没拿到，默认降级为普通用户 ZERO_BASIS，而不是 ADMIN
      role: (coreData.user?.role || coreData.role || 'ZERO_BASIS').toUpperCase(),
      
      name: coreData.user?.username || coreData.username || username,
      
      // 可以顺便把用户 ID 存下来，后续很多接口（比如调整额度）可能需要用到当前用户的 ID
      userId: coreData.user?.id || coreData.id || null 
    }
  } catch (error) {
    // 可以在这里统一处理登录失败的错误提示
    console.error("Login API Error:", error)
    throw error
  }
}

export async function registerApi(regData) {
  return await api.post('/api/auth/register', regData)
}