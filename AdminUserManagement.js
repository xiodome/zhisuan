import axios from 'axios'
import { useUserStore } from '../store/user'

const api = axios.create({
  baseURL: 'http://114.116.220.203:8000',
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
      page_size: 1000
    }
    
    if (filters.username) params.username = filters.username
    if (filters.role) params.role = filters.role
    if (filters.status === 'enabled') params.status = 1
    if (filters.status === 'disabled') params.status = 0

    const response = await api.get('/api/admin/users', { params })
    
    // 【关键修复点】：axios把后端返回的JSON包在response.data里
    const responseData = response.data

    // 必须从 responseData.list 里取出数组才能进行 map 遍历！
    const formattedList = responseData.list.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email || '未填写',
      role: user.role,
      status: user.status === 1 ? 'enabled' : 'disabled',
      lastLogin: user.created_at ? user.created_at.split('T')[0] : '未知'
    }))

    return {
      list: formattedList,
      total: responseData.total
    }
  } catch (error) {
    throw new Error('获取用户列表失败，请检查网络或管理员权限')
  }
}

// 2. 修改真实用户角色
export async function updateUserRole({ userId, role }) {
  try {
    const response = await api.put(`/api/admin/users/${userId}/role`, { role: role })
    return response.data
  } catch (error) {
    throw new Error('角色修改失败')
  }
}

// 3. 修改真实用户状态
export async function updateUserStatus({ userId, status }) {
  try {
    const numericStatus = status === 'enabled' ? 1 : 0
    const response = await api.patch(`/api/admin/users/${userId}/status`, { status: numericStatus })
    return response.data
  } catch (error) {
    throw new Error('状态修改失败')
  }
}