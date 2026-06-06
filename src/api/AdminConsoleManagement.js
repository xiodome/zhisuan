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
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export const isUsingMockData = false

const unwrap = (response) => (response.data?.data !== undefined ? response.data.data : response.data)

const parseTags = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean)
  const raw = String(value || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const mapStatusToBackend = (statusStr) => {
  if (statusStr === 'APPROVED' || statusStr === 'SUCCESS') return 1
  if (statusStr === 'REJECTED' || statusStr === 'FAIL') return 2
  return 0
}

const toNormalizedList = (payload) => {
  if (Array.isArray(payload)) return payload
  return payload?.list || payload?.items || []
}

const normalizeQuotaUser = (item) => {
  const limit = Number(item.api_token_limit || 0)
  const used = Number(item.api_token_used || 0)
  const warningRaw = Number(item.api_token_warning_threshold || 0)

  let displayPercent = warningRaw
  if (warningRaw <= 1 && warningRaw >= 0) {
    displayPercent = warningRaw * 100
  } else if (limit > 0 && warningRaw > 1) {
    displayPercent = (warningRaw / limit) * 100
  }
  displayPercent = Math.max(0, Math.min(100, Math.round(displayPercent || 0)))

  return {
    id: item.id,
    userId: item.id,
    username: item.username,
    role: item.role,
    tokenQuota: limit,
    tokenLimit: limit,
    limit,
    tokenUsed: used,
    used,
    warningThreshold: displayPercent,
    status: Number(item.status) === 1 ? 'enabled' : 'disabled',
    updatedAt: item.created_at?.replace('T', ' ').substring(0, 19) || '-'
  }
}

const filterQuotaUsers = (list, filters = {}) => {
  const keyword = String(filters.username || '').trim().toLowerCase()
  const role = String(filters.role || '').trim().toUpperCase()
  const status = String(filters.status || '').trim().toLowerCase()

  return list.filter((item) => {
    if (keyword && !String(item.username || '').toLowerCase().includes(keyword)) {
      return false
    }

    if (role && String(item.role || '').toUpperCase() !== role) {
      return false
    }

    if (status && String(item.status || '').toLowerCase() !== status) {
      return false
    }

    return true
  })
}

const fetchAllQuotaUsers = async () => {
  // Swagger: /api/quota/admin/users page_size <= 100
  const pageSize = 100
  const maxPages = 20
  let page = 1
  let total = Number.POSITIVE_INFINITY
  const merged = []

  while (page <= maxPages && merged.length < total) {
    const response = await api.get('/api/quota/admin/users', { params: { page, page_size: pageSize } })
    const data = unwrap(response) || {}
    const batch = toNormalizedList(data)
    total = Number(data.total || merged.length + batch.length)

    if (!batch.length) break
    merged.push(...batch)

    if (batch.length < pageSize) break
    page += 1
  }

  return merged
}

export async function fetchQuotaUserList(filters = {}) {
  const rawList = await fetchAllQuotaUsers()
  const normalized = rawList.map(normalizeQuotaUser)
  const filtered = filterQuotaUsers(normalized, filters)
  return {
    list: filtered,
    total: filtered.length,
    unfilteredTotal: rawList.length
  }
}

export async function adjustUserQuota(payload) {
  const limit = Number(payload.tokenLimit || payload.tokenQuota || payload.limit || 0)
  const percent = Number(payload.warningThreshold || payload.percent || 0)
  const targetId = payload.userId || payload.id

  const body = {
    api_token_limit: limit,
    api_token_warning_threshold: Math.floor(limit * (percent / 100))
  }

  const response = await api.put(`/api/quota/admin/adjust/${targetId}`, body)
  return unwrap(response)
}

export async function fetchQuotaOverview() {
  const result = await fetchQuotaUserList()
  const list = result.list || []

  return {
    totalUsers: Number(list.length || 0),
    totalConsumedTokens: list.reduce((sum, item) => sum + Number(item.tokenUsed || 0), 0),
    warningUsers: list.filter((item) => {
      const quota = Number(item.tokenQuota || 0)
      if (!quota) return false
      return Number(item.tokenUsed || 0) / quota >= 0.8
    }).length,
    insufficientUsers: list.filter((item) => Number(item.tokenUsed || 0) >= Number(item.tokenQuota || 0)).length
  }
}

const agentQuotaActionLabels = {
  agent_llm_manager_parse: 'Agent LLM - 需求解析',
  agent_llm_data_analysis: 'Agent LLM - 数据分析',
  agent_llm_model_plan: 'Agent LLM - 模型规划',
  agent_llm_operation_report: 'Agent LLM - 报告生成',
  task_execution: '任务执行',
  file_upload: '文件上传'
}

const resolveQuotaActionLabel = (action) => agentQuotaActionLabels[action] || action || '-'

export async function fetchQuotaConsumptionRecords(filters = {}) { 
  const [logRes, userRes] = await Promise.all([
    api.get('/api/quota/admin/logs', { params: { page: 1, page_size: 100 } }),
    api.get('/api/quota/admin/users', { params: { page: 1, page_size: 100 } })
  ])
  const userData = unwrap(userRes) || {}
  const users = Array.isArray(userData) ? userData : (userData.list || userData.items || [])
  const userMap = new Map(users.map((item) => [Number(item.id), item]))
  const res = logRes
  const data = unwrap(res) || {}
  
  // 安全提取数组
  const list = Array.isArray(data) ? data : (data.list || data.items || [])
  const normalized = list.map((item) => {
    const user = userMap.get(Number(item.user_id)) || {}
    const action = item.action || ''
    return {
      id: item.id,
      userId: item.user_id,
      username: user.username || `用户 ${item.user_id}`,
      endpoint: resolveQuotaActionLabel(action),
      rawEndpoint: action,
      modelName: action.startsWith('agent_llm_') ? 'Agent 工作流 LLM' : '-',
      tokenConsumed: item.tokens_consumed,
      taskId: item.task_id,
      createdAt: item.created_at?.replace('T', ' ').substring(0, 19) || '-'
    }
  }).filter((item) => {
    const username = String(filters.username || '').trim().toLowerCase()
    const endpoint = String(filters.endpoint || '').trim()
    const usernameMatched = !username || item.username.toLowerCase().includes(username)
    const endpointMatched = !endpoint || item.rawEndpoint === endpoint || item.endpoint === endpoint
    return usernameMatched && endpointMatched
  })
  
  return { 
    list: normalized, 
    total: normalized.length,
    unfilteredTotal: list.length
  } 
}

export async function fetchDatasetList(filters = {}) {
  const params = {}
  if (filters.reviewStatus) params.status = mapStatusToBackend(filters.reviewStatus)

  const response = await api.get('/api/datasets/admin/all', { params })
  const data = unwrap(response) || {}
  const list = toNormalizedList(data)

  return {
    list: list.map((item) => ({
      ...item,
      owner:
        item.owner ||
        item.creator ||
        item.creator_name ||
        item.username ||
        item.user_name ||
        item.owner_username ||
        item.owner_name ||
        item.share_username ||
        item.shared_by_username ||
        '-',
      samples: Number(item.row_count || item.samples || 0),
      publishStatus: Number(item.status) === 3 ? 'OFFLINE' : (item.is_public ? 'PUBLIC' : 'PRIVATE'),
      category: item.category || '-',
      tags: parseTags(item.tags),
      reviewStatus: Number(item.status) === 1 ? 'APPROVED' : (Number(item.status) === 2 ? 'REJECTED' : 'PENDING'),
      submittedAt: item.created_at
    })),
    total: Number(data.total || list.length)
  }
}

export async function fetchModelList(filters = {}) {
  const params = {}
  if (filters.reviewStatus) params.status = mapStatusToBackend(filters.reviewStatus)

  const response = await api.get('/api/models/admin/all', { params })
  const data = unwrap(response) || {}
  const list = toNormalizedList(data)

  return {
    list: list.map((item) => ({
      ...item,
      owner:
        item.owner ||
        item.creator ||
        item.creator_name ||
        item.username ||
        item.user_name ||
        item.owner_username ||
        item.owner_name ||
        item.share_username ||
        item.shared_by_username ||
        '-',
      version: item.version || '-',
      framework: item.framework || item.model_type || '-',
      viewCount: Number(item.view_count || 0),
      isRecommended: Boolean(item.is_recommended),
      publishStatus: Number(item.status) === 3 ? 'OFFLINE' : (item.is_public ? 'PUBLIC' : 'PRIVATE'),
      category: item.category || '-',
      tags: parseTags(item.tags),
      reviewStatus: Number(item.status) === 1 ? 'APPROVED' : (Number(item.status) === 2 ? 'REJECTED' : 'PENDING'),
      createdAt: item.created_at
    })),
    total: Number(data.total || list.length)
  }
}

export async function updateDatasetReviewStatus(payload) {
  const response = await api.post(`/api/datasets/${payload.datasetId}/audit`, {
    status: mapStatusToBackend(payload.reviewStatus),
    rejection_reason: payload.reviewComment
  })
  return unwrap(response)
}

export async function updateModelReviewStatus(payload) {
  const response = await api.post(`/api/models/${payload.modelId}/audit`, {
    status: mapStatusToBackend(payload.reviewStatus),
    rejection_reason: payload.reviewComment
  })
  return unwrap(response)
}

export async function updateDatasetMeta(payload) {
  const response = await api.put(`/api/datasets/${payload.datasetId}`, {
    category: payload.category,
    tags: payload.tags
  })
  return unwrap(response)
}

export async function updateModelMeta(payload) {
  const response = await api.put(`/api/models/${payload.modelId}`, {
    category: payload.category,
    tags: payload.tags
  })
  return unwrap(response)
}

export async function updateDatasetPublishStatus(payload) {
  const action = payload.publishStatus === 'OFFLINE' ? 'take-down' : 'publish'
  const response = await api.post(`/api/datasets/${payload.datasetId}/${action}`)
  return unwrap(response)
}

export async function updateModelPublishStatus(payload) {
  const action = payload.publishStatus === 'OFFLINE' ? 'take-down' : 'publish'
  const response = await api.post(`/api/models/${payload.modelId}/${action}`)
  return unwrap(response)
}
