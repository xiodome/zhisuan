import axios from 'axios'
import { API_BASE_URL } from '../config/api'
import { useUserStore } from '../store/user'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000
})

api.interceptors.request.use((config) => {
  const store = useUserStore()
  if (store.token) {
    config.headers.Authorization = `Bearer ${store.token}`
  }
  return config
})

// 关闭假数据模式，启用真实接口
export const isUsingMockData = false
const USE_MOCK_DATA = false

// 通用的解包函数（适配 FastAPI 通常返回 { success: true, data: {...} } 的情况）
const unwrap = (response) => {
  if (response.data && response.data.data !== undefined) {
    return response.data.data
  }
  return response.data
}

// 统一的错误处理
const handleAdminError = (error, fallbackMsg) => {
  const detail = error.response?.data?.detail || error.response?.data?.message
  if (Array.isArray(detail) && detail.length) {
    throw new Error(detail[0].msg || fallbackMsg)
  }
  if (typeof detail === 'string') {
    throw new Error(detail)
  }
  throw new Error(fallbackMsg)
}


/*==========================================================API额度管理==========================================================*/

// 1. 获取API额度总览(管理用户数、累计消耗 Token、预警用户数、额度不足用户)
export async function fetchQuotaOverview() {
  try {
    // 后端没有专门的总览接口，通过获取所有用户列表并在前端计算总览数据
    const response = await api.get('/api/quota/admin/users', { params: { page: 1, page_size: 1000 } })
    const data = unwrap(response)
    const list = data.list || data || []
    
    const totalConsumedTokens = list.reduce((sum, item) => sum + (item.api_token_used || 0), 0)
    
    const warningUsers = list.filter((item) => {
      const quota = item.api_token_limit || 1
      const used = item.api_token_used || 0
      // 如果后端没传预警阈值，默认按 0.8 计算
      const threshold = item.api_token_warning_threshold || 0.8
      return (used / quota) >= threshold
    }).length

    const insufficientUsers = list.filter((item) => {
      const quota = item.api_token_limit || 0
      const used = item.api_token_used || 0
      return used >= quota
    }).length

    return {
      totalUsers: list.length,
      totalConsumedTokens,
      warningUsers,
      insufficientUsers
    }
  } catch (error) {
    console.error('获取额度总览失败', error)
    return { totalUsers: 0, totalConsumedTokens: 0, warningUsers: 0, insufficientUsers: 0 }
  }
}

// 2. 获取用户额度列表
export async function fetchQuotaUserList(filters = {}) {
  try {
    const params = {
      page: 1,
      page_size: 1000 // 假设后端未完全支持条件过滤，我们先全量拉取，然后在前端过滤分页
    }
    const response = await api.get('/api/quota/admin/users', { params })
    const data = unwrap(response)
    
    // 将后端的字段映射为前端表格需要的字段
    let list = (data.list || data || []).map(item => ({
      id: item.id,
      username: item.username,
      role: item.role,
      tokenQuota: item.api_token_limit,
      tokenUsed: item.api_token_used,
      usageLimit: item.api_token_limit, // 后端 Swagger 只有 limit，这里与 tokenQuota 保持一致
      warningThreshold: item.api_token_warning_threshold || 0.8,
      status: item.status === 1 ? 'enabled' : 'disabled',
      updatedAt: item.created_at ? item.created_at.replace('T', ' ').substring(0, 19) : '-'
    }))

    // 执行前端筛选逻辑
    if (filters.username) {
      const keyword = filters.username.trim().toLowerCase()
      list = list.filter(item => item.username && item.username.toLowerCase().includes(keyword))
    }
    if (filters.role) {
      list = list.filter(item => item.role === filters.role)
    }
    if (filters.status) {
      list = list.filter(item => item.status === filters.status)
    }

    return {
      list: list,
      total: list.length
    }
  } catch (error) {
    handleAdminError(error, '获取用户额度列表失败')
  }
}

// 3. 调整用户的额度 
export async function adjustUserQuota(payload) {
  try {
    // 将前端表单字段映射为后端 Swagger 要求的请求体字段
    const requestData = {
      api_token_limit: payload.tokenQuota,
      api_token_warning_threshold: payload.warningThreshold
    }
    const response = await api.put(`/api/quota/admin/adjust/${payload.userId}`, requestData)
    return unwrap(response)
  } catch (error) {
    handleAdminError(error, '调整额度失败')
  }
}

// 4. 获取调用消耗记录列表 
export async function fetchQuotaConsumptionRecords(filters = {}) {
  try {
    const params = {
      page: 1,
      page_size: 1000
    }
    const response = await api.get('/api/quota/admin/logs', { params })
    const data = unwrap(response)
    
    // 适配后端日志字段到前端
    let list = (data.list || data || []).map(item => ({
      ...item,
      username: item.username || `User_${item.user_id}`,
      endpoint: item.endpoint || item.api_endpoint || '-',
      modelName: item.modelName || item.model_name || '-',
      tokenConsumed: item.tokenConsumed || item.token_consumed || item.tokens || 0,
      createdAt: item.createdAt || item.created_at ? item.created_at.replace('T', ' ').substring(0, 19) : '-'
    }))

    // 执行前端筛选逻辑
    if (filters.username) {
      const keyword = filters.username.trim().toLowerCase()
      list = list.filter(item => item.username && item.username.toLowerCase().includes(keyword))
    }
    if (filters.endpoint) {
      list = list.filter(item => item.endpoint === filters.endpoint)
    }

    return {
      list: list,
      total: list.length
    }
  } catch (error) {
    handleAdminError(error, '获取消耗记录失败')
  }
}


/*==========================================================数据中心审核与管理==========================================================*/

// 1. 获取数据集列表
export async function fetchDatasetList(filters = {}) {
  try {
    const params = {
      keyword: filters.keyword || '',
      review_status: filters.reviewStatus || '',
      publish_status: filters.publishStatus || '',
      category: filters.category || ''
    }
    const response = await api.get('/api/datasets/admin/all', { params })
    const data = unwrap(response)
    
    const list = (data.list || data || []).map(item => ({
      ...item,
      reviewStatus: item.review_status || item.reviewStatus,
      publishStatus: item.publish_status || item.publishStatus,
      submittedAt: item.created_at || item.submittedAt
    }))
    
    return { list: list, total: data.total || list.length }
  } catch (error) {
    handleAdminError(error, '获取数据集列表失败')
  }
}

// 2. 更新数据集审核状态 
export async function updateDatasetReviewStatus(payload) {
  try {
    const response = await api.post(`/api/datasets/${payload.datasetId}/audit`, {
      action: payload.reviewStatus, 
      comment: payload.reviewComment
    })
    return unwrap(response)
  } catch (error) {
    handleAdminError(error, '更新审核状态失败')
  }
}

// 3. 更新数据集的公开状态 
export async function updateDatasetPublishStatus(payload) {
  try {
    if (payload.publishStatus === 'OFFLINE' || payload.publishStatus === 'PRIVATE') {
      const response = await api.post(`/api/datasets/${payload.datasetId}/take-down`)
      return unwrap(response)
    } else {
      // 占位，待后端提供重新上架接口
      const response = await api.post(`/api/datasets/${payload.datasetId}/publish`)
      return unwrap(response)
    }
  } catch (error) {
    handleAdminError(error, '更新公开状态失败')
  }
}

// 4. 更新数据集的分类和标签
export async function updateDatasetMeta(payload) {
  try {
    // 占位，待后端提供修改标签接口
    const response = await api.put(`/api/datasets/${payload.datasetId}/meta`, {
      category: payload.category,
      tags: payload.tags
    })
    return unwrap(response)
  } catch (error) {
    handleAdminError(error, '更新分类与标签失败')
  }
}


/*==========================================================模型广场审核与管理==========================================================*/

// 1. 获取模型列表
export async function fetchModelList(filters = {}) {
  try {
    const params = {
      keyword: filters.keyword || '',
      review_status: filters.reviewStatus || '',
      publish_status: filters.publishStatus || '',
      category: filters.category || ''
    }
    const response = await api.get('/api/models/admin/all', { params })
    const data = unwrap(response)
    
    const list = (data.list || data || []).map(item => ({
      ...item,
      reviewStatus: item.review_status || item.reviewStatus,
      publishStatus: item.publish_status || item.publishStatus,
      createdAt: item.created_at || item.createdAt
    }))

    return { list: list, total: data.total || list.length }
  } catch (error) {
    handleAdminError(error, '获取模型列表失败')
  }
}

// 2. 更新模型审核状态 
export async function updateModelReviewStatus(payload) {
  try {
    const response = await api.post(`/api/models/${payload.modelId}/audit`, {
      action: payload.reviewStatus,
      comment: payload.reviewComment
    })
    return unwrap(response)
  } catch (error) {
    handleAdminError(error, '更新审核状态失败')
  }
}

// 3. 更新模型公开状态 
export async function updateModelPublishStatus(payload) {
  try {
     if (payload.publishStatus === 'OFFLINE' || payload.publishStatus === 'PRIVATE') {
      const response = await api.post(`/api/models/${payload.modelId}/take-down`)
      return unwrap(response)
    } else {
      // 占位，待后端提供重新上架接口
      const response = await api.post(`/api/models/${payload.modelId}/publish`)
      return unwrap(response)
    }
  } catch (error) {
    handleAdminError(error, '更新公开状态失败')
  }
}

// 4. 更新模型分类和标签 
export async function updateModelMeta(payload) {
  try {
    // 占位，待后端提供修改标签接口
    const response = await api.put(`/api/models/${payload.modelId}/meta`, {
      category: payload.category,
      tags: payload.tags
    })
    return unwrap(response)
  } catch (error) {
    handleAdminError(error, '更新分类与标签失败')
  }
}