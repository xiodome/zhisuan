import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useUserStore } from '../store/user'

export const createApiClient = (timeout = 15000) => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout
  })

  client.interceptors.request.use((config) => {
    const withAuth = config
    try {
      const store = useUserStore()
      const token = store.token || localStorage.getItem('token')
      if (token) withAuth.headers.Authorization = `Bearer ${token}`
    } catch (error) {
      const token = localStorage.getItem('token')
      if (token) withAuth.headers.Authorization = `Bearer ${token}`
    }
    return withAuth
  })

  return client
}

export const unwrapResponse = (response) => (response?.data?.data !== undefined ? response.data.data : response?.data)

const parseDetailMessage = (detail) => {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    if (typeof first === 'string') return first
    if (first?.msg) return first.msg
    if (first?.message) return first.message
  }
  return ''
}

const looksLikeMojibake = (text) => {
  const value = String(text || '')
  if (!value) return false
  if (value.includes('�')) return true
  // 常见 UTF-8 被错误按 Latin-1 解码后的特征
  return /[ÃÂâæçåéøð][^\s]*[ÃÂâæçåéøð]/.test(value)
}

export const extractErrorMessage = (error, fallback) => {
  const data = error?.response?.data
  if (typeof data === 'string' && data.trim() && !looksLikeMojibake(data)) return data

  const detailMessage = parseDetailMessage(data?.detail)
  if (detailMessage && !looksLikeMojibake(detailMessage)) return detailMessage

  const message = data?.message || data?.msg
  if (typeof message === 'string' && message.trim() && !looksLikeMojibake(message)) return message

  return fallback
}

export const buildApiError = (error, fallback) => {
  const apiError = new Error(extractErrorMessage(error, fallback))
  apiError.status = Number(error?.response?.status || 0)
  apiError.isApiMissing = apiError.status === 404 || apiError.status === 405
  return apiError
}
