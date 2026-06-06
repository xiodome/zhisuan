import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useUserStore } from '../store/user'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000
})

api.interceptors.request.use((config) => {
  try {
    const store = useUserStore()
    if (store.token) {
      config.headers.Authorization = `Bearer ${store.token}`
    }
  } catch (error) {
    // Ignore store read errors.
  }
  return config
})

const unwrapResponse = (response) => (response.data?.data !== undefined ? response.data.data : response.data)

const extractErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    if (typeof first === 'string' && first.trim()) return first
    if (first?.msg) return first.msg
  }

  const message = error?.response?.data?.message
  if (typeof message === 'string' && message.trim()) return message
  return fallback
}

const buildApiError = (error, fallback) => new Error(extractErrorMessage(error, fallback))

const normalizeApplicationStatus = (value) => {
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) {
    if (numeric === 0) return 'pending'
    if (numeric === 1) return 'approved'
    if (numeric === 2) return 'rejected'
  }

  const key = String(value || '').trim().toUpperCase()
  if (['PENDING', 'WAITING', 'TO_REVIEW'].includes(key)) return 'pending'
  if (['APPROVED', 'PASSED', 'SUCCESS'].includes(key)) return 'approved'
  if (['REJECTED', 'REFUSED', 'FAILED'].includes(key)) return 'rejected'
  return 'pending'
}

const normalizeDateTime = (value) => {
  if (!value) return '-'
  const formatted = String(value).replace('T', ' ')
  return formatted.length >= 19 ? formatted.slice(0, 19) : formatted
}

export async function fetchUserList(filters) {
  try {
    const params = { page: 1, page_size: 100 }
    if (filters.username) params.username = filters.username
    if (filters.role) params.role = filters.role
    if (filters.status === 'enabled') params.status = 1
    if (filters.status === 'disabled') params.status = 0

    const response = await api.get('/api/admin/users', { params })
    const responseData = unwrapResponse(response)
    const rawList = Array.isArray(responseData) ? responseData : responseData?.list || responseData?.items || []

    const formattedList = rawList.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email || '未填写',
      role: user.role,
      status: user.status === 1 ? 'enabled' : 'disabled',
      lastLogin: user.updated_at ? normalizeDateTime(user.updated_at) : normalizeDateTime(user.created_at)
    }))

    return {
      list: formattedList,
      total: responseData?.total || rawList.length
    }
  } catch (error) {
    throw buildApiError(error, '获取用户列表失败，请检查网络或管理员权限')
  }
}

export async function updateUserRole({ userId, role }) {
  try {
    const response = await api.put(`/api/admin/users/${userId}/role`, { role })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '角色修改失败')
  }
}

export async function updateUserStatus({ userId, status }) {
  try {
    const numericStatus = status === 'enabled' ? 1 : 0
    const response = await api.patch(`/api/admin/users/${userId}/status`, { status: numericStatus })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '状态修改失败')
  }
}

export async function fetchRoleApplications() {
  try {
    const response = await api.get('/api/admin/developer/applications', {
      params: { page: 1, page_size: 100 }
    })
    const responseData = unwrapResponse(response)
    const rawList = Array.isArray(responseData)
      ? responseData
      : responseData?.list || responseData?.items || responseData?.records || []

    return rawList.map((item) => ({
      id: item.id,
      user_id: item.user_id ?? null,
      username: item.username || item.user_name || (item.user_id ? `用户 #${item.user_id}` : '-'),
      reason: item.reason || '-',
      status: normalizeApplicationStatus(item.status),
      created_at: normalizeDateTime(item.created_at),
      review_comment: item.review_comment || ''
    }))
  } catch (error) {
    throw buildApiError(error, '获取开发者申请记录失败')
  }
}

export async function approveRoleApplication(applicationId) {
  try {
    const response = await api.put(`/api/admin/developer/applications/${applicationId}/review`, {
      action: 'APPROVED',
      review_comment: null
    })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '审批通过失败')
  }
}

export async function rejectRoleApplication(applicationId) {
  try {
    const response = await api.put(`/api/admin/developer/applications/${applicationId}/review`, {
      action: 'REJECTED',
      review_comment: null
    })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '驳回申请失败')
  }
}
