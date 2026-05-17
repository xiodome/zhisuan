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
      page_size: 100
    }
    
    if (filters.username) params.username = filters.username
    if (filters.role) params.role = filters.role
    if (filters.status === 'enabled') params.status = 1
    if (filters.status === 'disabled') params.status = 0

    const response = await api.get('/api/admin/users', { params })
    
    const responseData = response.data?.data !== undefined ? response.data.data : response.data
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

// ================= 新增：权限申请审核相关 API =================

// 4. 获取开发者角色申请列表
export async function fetchRoleApplications() {
  try {
    const response = await api.get('/api/admin/role-applications')
    return response.data?.data !== undefined ? response.data.data : response.data
  } catch (error) {
    // 兼容后端未开发此接口的情况，返回测试模拟数据以便前端调试
    console.warn("未连接到真实的申请列表接口，使用模拟数据展示。")
    return [
      { id: 101, username: 'test_user_01', reason: '科研需要，申请使用多智能体控制面板、可视化过程以及完整论文级PDF导出功能。', status: 'pending', created_at: '2026-05-17 10:00:00' },
      { id: 102, username: 'student_li', reason: '需要使用 Operation Agent 生成代码的保存功能完成课程大作业。', status: 'pending', created_at: '2026-05-17 11:30:00' }
    ]
  }
}

// 5. 审批通过
export async function approveRoleApplication(applicationId) {
  try {
    const response = await api.post(`/api/admin/role-applications/${applicationId}/approve`)
    return response.data?.data !== undefined ? response.data.data : response.data
  } catch (error) {
    // 如果无真实后端，模拟成功
    console.warn("未连接到真实审批通过接口，模拟通过。")
    return true
  }
}

// 6. 审批驳回
export async function rejectRoleApplication(applicationId) {
  try {
    const response = await api.post(`/api/admin/role-applications/${applicationId}/reject`)
    return response.data?.data !== undefined ? response.data.data : response.data
  } catch (error) {
    // 如果无真实后端，模拟成功
    console.warn("未连接到真实审批驳回接口，模拟驳回。")
    return true
  }
}