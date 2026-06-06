import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useUserStore } from '../store/user'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
})

api.interceptors.request.use((config) => {
  try {
    const store = useUserStore()
    if (store.token) {
      config.headers.Authorization = `Bearer ${store.token}`
    }
  } catch (error) {
    // Ignore store errors to avoid blocking requests.
  }
  if (!config.headers.Authorization) {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
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

const buildApiError = (error, fallback) => {
  const apiError = new Error(extractErrorMessage(error, fallback))
  apiError.status = error?.response?.status
  apiError.isApiMissing = apiError.status === 404 || apiError.status === 405
  return apiError
}

const normalizeStatusKey = (value) => {
  if (value === null || value === undefined || value === '') return 'none'

  const numericValue = Number(value)
  if (!Number.isNaN(numericValue)) {
    if (numericValue === 0) return 'pending'
    if (numericValue === 1) return 'approved'
    if (numericValue === 2) return 'rejected'
  }

  const key = String(value).trim().toUpperCase()
  if (['PENDING', 'WAITING', 'TO_REVIEW'].includes(key)) return 'pending'
  if (['APPROVED', 'PASSED', 'SUCCESS'].includes(key)) return 'approved'
  if (['REJECTED', 'REFUSED', 'FAILED'].includes(key)) return 'rejected'
  return 'none'
}

const normalizeTime = (value) => {
  if (!value) return ''
  const normalized = String(value).replace('T', ' ')
  return normalized.length >= 19 ? normalized.slice(0, 19) : normalized
}

const pickApplicationRecord = (payload) => {
  if (!payload) return null
  if (Array.isArray(payload)) return payload[0] || null
  if (payload.application && typeof payload.application === 'object') return payload.application
  if (payload.latest && typeof payload.latest === 'object') return payload.latest
  if (payload.record && typeof payload.record === 'object') return payload.record
  if (payload.data && typeof payload.data === 'object') return payload.data
  if (payload.id || payload.status || payload.user_id) return payload
  return null
}

export const normalizeDeveloperApplication = (rawApplication) => {
  if (!rawApplication) return null

  return {
    id: rawApplication.id ?? null,
    userId: rawApplication.user_id ?? rawApplication.userId ?? null,
    reason: rawApplication.reason || '',
    status: normalizeStatusKey(rawApplication.status),
    statusRaw: rawApplication.status ?? null,
    reviewComment: rawApplication.review_comment || rawApplication.reviewComment || '',
    reviewedBy: rawApplication.reviewed_by ?? rawApplication.reviewedBy ?? null,
    createdAt: normalizeTime(rawApplication.created_at || rawApplication.createdAt),
    updatedAt: normalizeTime(rawApplication.updated_at || rawApplication.updatedAt)
  }
}

export async function fetchCurrentUserInfo() {
  try {
    const response = await api.get('/api/auth/me')
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '获取当前用户信息失败')
  }
}

export async function fetchMyDeveloperApplication() {
  try {
    const response = await api.get('/api/developer/application/me')
    const rawRecord = pickApplicationRecord(unwrapResponse(response))
    return {
      apiMissing: false,
      application: normalizeDeveloperApplication(rawRecord)
    }
  } catch (error) {
    const status = error?.response?.status
    if (status === 404 || status === 405) {
      return {
        apiMissing: true,
        application: null
      }
    }
    throw buildApiError(error, '获取开发者申请状态失败')
  }
}

export async function submitDeveloperApplication(payload) {
  const reason = String(payload?.reason || '').trim()
  try {
    const response = await api.post('/api/developer/apply', {
      reason: reason || null
    })
    const normalized = normalizeDeveloperApplication(unwrapResponse(response))
    if (normalized) return normalized

    return {
      id: null,
      userId: null,
      reason,
      status: 'pending',
      statusRaw: 'PENDING',
      reviewComment: '',
      reviewedBy: null,
      createdAt: '',
      updatedAt: ''
    }
  } catch (error) {
    throw buildApiError(error, '提交开发者申请失败')
  }
}

export { normalizeStatusKey as normalizeDeveloperApplicationStatus }
