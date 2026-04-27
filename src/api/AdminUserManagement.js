import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useUserStore } from '../store/user'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000
})

api.interceptors.request.use(config => {
  const store = useUserStore()
  if (store.token) {
    config.headers.Authorization = `Bearer ${store.token}`
  }
  return config
})

// 1. 获取真实用户列表
export async function fetchUserList(filters) {
  try {
    const params = {
      page: 1,
      page_size: 100 // 【关键修改】：将 1000 改为 100，避免触发后端 422 验证错误
    }
    
    if (filters.username) params.username = filters.username
    if (filters.role) params.role = filters.role
    if (filters.status === 'enabled') params.status = 1
    if (filters.status === 'disabled') params.status = 0

    const response = await api.get('/api/admin/users', { params })
    
    // 【优化提取逻辑】：兼容可能存在的 data 包裹层
    const responseData = response.data?.data !== undefined ? response.data.data : response.data

    // 【关键修改】：增加 || [] 防止 responseData.list 为空时 map 报错白屏
    const rawList = responseData.list || responseData || []
    
    const formattedList = rawList.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email || '未填写',
      role: user.role,
      status: user.status === 1 ? 'enabled' : 'disabled',
      lastLogin: user.created_at ? user.created_at.split('T')[0] : '未知'
    }))

    return {
      list: formattedList,
      total: responseData.total || rawList.length
    }
  } catch (error) {
    console.error("Fetch User List Error:", error)
    throw new Error('获取用户列表失败，请检查网络或管理员权限')
  }
}

// 2. 修改真实用户角色
export async function updateUserRole({ userId, role }) {
  try {
    const response = await api.put(`/api/admin/users/${userId}/role`, { role: role })
    return response.data?.data !== undefined ? response.data.data : response.data
  } catch (error) {
    throw new Error('角色修改失败')
  }
}

// 3. 修改真实用户状态
export async function updateUserStatus({ userId, status }) {
  try {
    const numericStatus = status === 'enabled' ? 1 : 0
    const response = await api.patch(`/api/admin/users/${userId}/status`, { status: numericStatus })
    return response.data?.data !== undefined ? response.data.data : response.data
  } catch (error) {
    throw new Error('状态修改失败')
  }
}