import axios from 'axios'
import { API_BASE_URL } from '../config/api'

const agentApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
})

agentApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const unwrap = (response) => response.data?.data ?? response.data
const PARSE_ENDPOINTS = ['/api/agent/tasks/parse', '/api/agent/parse', '/api/tasks/parse']
const HITL_FALLBACK_KEYS = ['hitl_stages', 'review_stages', 'review_nodes', 'human_review_stages']

const handleAgentError = (error, fallback) => {
  const detail = error.response?.data?.detail || error.response?.data?.message
  const rawText = typeof error.response?.data === 'string' ? error.response.data : ''
  if (rawText.includes("doesn't exist") || rawText.includes('Table') || rawText.includes('Traceback')) {
    throw new Error('后端服务异常：请确认 Agent 数据库表已初始化')
  }
  if (Array.isArray(detail) && detail.length) {
    throw new Error(detail[0].msg || fallback)
  }
  if (typeof detail === 'string') {
    throw new Error(detail)
  }
  throw new Error(fallback)
}

const buildCreateTaskPayloadCandidates = (payload) => {
  const hitl = payload?.hitl
  if (!Array.isArray(hitl)) return [payload]
  const base = { ...payload }
  delete base.hitl
  const variants = [payload]
  HITL_FALLBACK_KEYS.forEach((key) => {
    variants.push({ ...base, [key]: hitl })
  })
  return variants
}

const shouldRetryCreateTaskPayload = (error) => {
  const status = error.response?.status
  if (![400, 422].includes(status)) return false
  const detail = error.response?.data?.detail
  const detailText = typeof detail === 'string' ? detail : JSON.stringify(detail || '')
  const text = detailText.toLowerCase()
  return text.includes('hitl') || text.includes('review') || text.includes('field required')
}

export const uploadAgentDataset = async (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  try {
    const response = await agentApi.post('/api/agent/datasets/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress) return
        const percent = event.total ? Math.round((event.loaded * 100) / event.total) : 0
        onProgress(percent, event)
      }
    })
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '数据集上传失败')
  }
}

export const parseAgentTaskDescription = async (taskDescription) => {
  const payload = {
    task_description: taskDescription,
    requirement_text: taskDescription,
    text: taskDescription
  }
  let lastError = null
  for (const endpoint of PARSE_ENDPOINTS) {
    try {
      const response = await agentApi.post(endpoint, payload)
      return unwrap(response)
    } catch (error) {
      lastError = error
      const status = error.response?.status
      if (status === 404 || status === 405) continue
      break
    }
  }
  throw lastError || new Error('需求解析接口暂不可用')
}

export const fetchDatasetPreview = async (datasetId) => {
  try {
    const response = await agentApi.get(`/api/agent/datasets/${datasetId}/preview`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '数据集预览加载失败')
  }
}

export const createAgentTask = async (payload) => {
  const candidates = buildCreateTaskPayloadCandidates(payload)
  let lastError = null
  for (let index = 0; index < candidates.length; index += 1) {
    try {
      const response = await agentApi.post('/api/agent/tasks', candidates[index])
      return unwrap(response)
    } catch (error) {
      lastError = error
      if (index < candidates.length - 1 && shouldRetryCreateTaskPayload(error)) continue
      break
    }
  }
  handleAgentError(lastError, 'Agent 任务创建失败')
}

export const fetchAgentTasks = async () => {
  try {
    const response = await agentApi.get('/api/agent/tasks')
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, 'Agent 任务列表加载失败')
  }
}

export const fetchAgentTask = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, 'Agent 任务详情加载失败')
  }
}

export const runAgentTask = async (taskId, payload = { offline: true }) => {
  try {
    const response = await agentApi.post(`/api/agent/tasks/${taskId}/run`, payload)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, 'Agent 任务启动失败')
  }
}

export const resumeAgentTask = async (taskId, payload = { offline: true }) => {
  try {
    const response = await agentApi.post(`/api/agent/tasks/${taskId}/resume`, payload)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, 'Agent 任务恢复失败')
  }
}

export const cancelAgentTask = async (taskId) => {
  try {
    const response = await agentApi.post(`/api/agent/tasks/${taskId}/cancel`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, 'Agent 任务取消失败')
  }
}

export const fetchAgentProgress = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}/progress`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, 'Agent 进度加载失败')
  }
}

export const fetchPendingReview = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}/pending-review`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '待审核内容加载失败')
  }
}

export const submitAgentReview = async (taskId, payload) => {
  try {
    const response = await agentApi.post(`/api/agent/tasks/${taskId}/reviews`, payload)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '人工审核提交失败')
  }
}

export const fetchAgentReviews = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}/reviews`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '审核历史加载失败')
  }
}

export const fetchAgentReport = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}/report`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '模型报告加载失败')
  }
}

export const fetchAgentCode = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}/code`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '生成代码加载失败')
  }
}

export const fetchAgentCodeFile = async (codePath) => {
  try {
    const normalizedPath = String(codePath || '').trim().replace(/^\/+/, '')
    if (!normalizedPath) throw new Error('代码路径为空')
    const response = await agentApi.get(`/${normalizedPath}`, { responseType: 'text' })
    return response.data
  } catch (error) {
    handleAgentError(error, '代码文件读取失败')
  }
}

export const downloadAgentTaskArtifacts = async (taskId) => {
  try {
    return await agentApi.get(`/api/agent/tasks/${taskId}/download`, {
      responseType: 'blob'
    })
  } catch (error) {
    handleAgentError(error, '任务产物下载失败')
  }
}

export const fetchAgentDemo = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}/demo`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '预测 Demo 加载失败')
  }
}

export const predictAgentTask = async (taskId, payload) => {
  try {
    const response = await agentApi.post(`/api/agent/tasks/${taskId}/predict`, payload)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '模型预测失败')
  }
}

export const shareAgentWorkflow = async (payload) => {
  try {
    const response = await agentApi.post('/api/agent/workflows/share', payload)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '工作流分享失败')
  }
}

export const forkAgentWorkflow = async (workflowId) => {
  try {
    const response = await agentApi.post(`/api/agent/workflows/${workflowId}/fork`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '工作流 Fork 失败')
  }
}

export const fetchAgentWorkflows = async () => {
  try {
    const response = await agentApi.get('/api/agent/workflows')
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '工作流列表加载失败')
  }
}
/* ==========================================
   管理员专属 Agent 接口 (仅 ADMIN 可访问)
   ========================================== */

// 1. 管理员查询全部 Agent 任务
export const fetchAdminAgentTasks = async () => {
  try {
    const response = await agentApi.get('/api/agent/admin/tasks')
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '管理员查询全部任务失败')
  }
}

// 2. 管理员查询 Agent 任务日志
export const fetchAdminAgentTaskLogs = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/admin/tasks/${taskId}/logs`)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '管理员查询任务日志失败')
  }
}

// 3. 管理员查询 Agent 资源摘要 (用于后台监控面板展示)
export const fetchAdminAgentResourceSummary = async () => {
  try {
    const response = await agentApi.get('/api/agent/admin/resource-summary')
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '资源监控摘要加载失败')
  }
}
