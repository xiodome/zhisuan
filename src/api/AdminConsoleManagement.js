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
  } catch (e) { }
  return config
})

// 组件需要的导出变量
export const isUsingMockData = false

const unwrap = (response) => (response.data?.data !== undefined ? response.data.data : response.data)

/**
 * 状态映射：前端字符串 (PENDING/APPROVED/REJECTED) -> 后端 Integer (0/1/2)
 */
const mapStatusToBackend = (statusStr) => {
  if (statusStr === 'APPROVED' || statusStr === 'SUCCESS') return 1
  if (statusStr === 'REJECTED' || statusStr === 'FAIL') return 2
  return 0 // PENDING
}

/* ========================== 1. API 额度管理 ========================== */

export async function fetchQuotaUserList() {
  try {
    const response = await api.get('/api/quota/admin/users', { params: { page: 1, page_size: 100 } })
    const data = unwrap(response) || {}
    
    // 安全提取数组，兼容后端返回纯数组或分页对象
    const list = Array.isArray(data) ? data : (data.list || data.items || [])
    
    return {
      list: list.map(item => {
        const limit = item.api_token_limit || 1
        const threshold = item.api_token_warning_threshold || 0
        
        let displayPercent = threshold > 1 ? (threshold / limit) * 100 : threshold * 100
        if (displayPercent > 100) displayPercent = 100

        // 【终极修复】：为 UI 组件提供全套字段别名，防止数据丢失和逻辑误判
        return {
          id: item.id,                      // 兼容部分组件需要的 id
          userId: item.id,                  // 兼容部分组件需要的 userId
          username: item.username,
          role: item.role,
          tokenQuota: item.api_token_limit, // 对应 "Token 额度"
          tokenLimit: item.api_token_limit, // 修复 "使用上限" 为 0 的问题
          limit: item.api_token_limit,      // 备用上限字段
          tokenUsed: item.api_token_used,   // 对应 "已用 Token"
          used: item.api_token_used,        // 备用已用字段
          warningThreshold: Math.round(displayPercent),
          status: item.status === 1 ? 'enabled' : 'disabled',
          updatedAt: item.created_at?.replace('T', ' ').substring(0, 19) || '-'
        }
      }),
      // 安全提取总条数
      total: data.total || list.length
    }
  } catch (error) { throw error }
}

export async function adjustUserQuota(payload) {
  // 兼容 UI 弹窗表单传回来的各种可能的字段名
  const limit = Number(payload.tokenLimit || payload.tokenQuota || payload.limit || 0)
  const percent = Number(payload.warningThreshold || payload.percent || 0)
  
  // 防止 URL 出现 /undefined 的 404 错误
  const targetId = payload.userId || payload.id 
  
  const body = {
    api_token_limit: limit,
    api_token_warning_threshold: Math.floor(limit * (percent / 100))
  }

  const response = await api.put(`/api/quota/admin/adjust/${targetId}`, body)
  return unwrap(response)
}

export async function fetchQuotaOverview() {
  const res = await api.get('/api/quota/admin/users', { params: { page: 1, page_size: 100 } })
  const data = unwrap(res) || {}
  
  // 安全提取数组
  const list = Array.isArray(data) ? data : (data.list || data.items || [])
  
  return {
    totalUsers: data.total || list.length,
    totalConsumedTokens: list.reduce((s, i) => s + (i.api_token_used || 0), 0),
    warningUsers: list.filter(i => {
      const limit = i.api_token_limit || 1;
      return (i.api_token_used / limit) >= 0.8;
    }).length,
    insufficientUsers: list.filter(i => i.api_token_used >= (i.api_token_limit || 0)).length
  }
}

export async function fetchQuotaConsumptionRecords() { 
  const res = await api.get('/api/quota/admin/logs', { params: { page: 1, page_size: 20 } })
  const data = unwrap(res) || {}
  
  // 安全提取数组
  const list = Array.isArray(data) ? data : (data.list || data.items || [])
  
  return { 
    list: list, 
    total: data.total || list.length 
  } 
}

/* ========================== 2. 数据中心 & 模型广场管理 ========================== */

export async function fetchDatasetList(filters = {}) {
  const params = {}
  if (filters.reviewStatus) params.status = mapStatusToBackend(filters.reviewStatus)

  const response = await api.get('/api/datasets/admin/all', { params })
  const data = unwrap(response) || {}
  
  // 安全提取数组
  const list = Array.isArray(data) ? data : (data.list || data.items || [])
  
  return {
    list: list.map(i => ({
      ...i,
      reviewStatus: i.status === 1 ? 'APPROVED' : (i.status === 2 ? 'REJECTED' : 'PENDING'),
      submittedAt: i.created_at
    })),
    total: data.total || list.length
  }
}

export async function fetchModelList(filters = {}) {
  const params = {}
  if (filters.reviewStatus) params.status = mapStatusToBackend(filters.reviewStatus)

  const response = await api.get('/api/models/admin/all', { params })
  const data = unwrap(response) || {}
  
  // 安全提取数组
  const list = Array.isArray(data) ? data : (data.list || data.items || [])
  
  return {
    list: list.map(i => ({
      ...i,
      reviewStatus: i.status === 1 ? 'APPROVED' : (i.status === 2 ? 'REJECTED' : 'PENDING'),
      createdAt: i.created_at
    })),
    total: data.total || list.length
  }
}

export async function updateDatasetReviewStatus(p) { 
  return api.post(`/api/datasets/${p.datasetId}/audit`, { 
    status: mapStatusToBackend(p.reviewStatus), 
    rejection_reason: p.reviewComment 
  }) 
}

export async function updateModelReviewStatus(p) { 
  return api.post(`/api/models/${p.modelId}/audit`, { 
    status: mapStatusToBackend(p.reviewStatus), 
    rejection_reason: p.reviewComment 
  }) 
}

export async function updateDatasetMeta(p) { 
  return api.put(`/api/datasets/${p.datasetId}`, { category: p.category, tags: p.tags }) 
}

export async function updateModelMeta(p) { 
  return api.put(`/api/models/${p.modelId}`, { category: p.category, tags: p.tags }) 
}

export async function updateDatasetPublishStatus(p) { 
  return api.post(`/api/datasets/${p.datasetId}/${p.publishStatus === 'OFFLINE' ? 'take-down' : 'publish'}`) 
}

export async function updateModelPublishStatus(p) { 
  return api.post(`/api/models/${p.modelId}/${p.publishStatus === 'OFFLINE' ? 'take-down' : 'publish'}`) 
}