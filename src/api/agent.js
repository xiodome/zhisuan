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

export const uploadAgentDataset = async (file) => {
  const form = new FormData()
  form.append('file', file)
  try {
    const response = await agentApi.post('/api/agent/datasets/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '数据集上传失败')
  }
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
  try {
    const response = await agentApi.post('/api/agent/tasks', payload)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, 'Agent 任务创建失败')
  }
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

export const downloadAgentReportMarkdown = async (taskId) => {
  try {
    const response = await agentApi.get(`/api/agent/tasks/${taskId}/report.md`, {
      responseType: 'blob'
    })
    return response.data
  } catch (error) {
    handleAgentError(error, 'Markdown 报告下载失败')
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

export const updateAgentCode = async (taskId, payload) => {
  try {
    const response = await agentApi.put(`/api/agent/tasks/${taskId}/code`, payload)
    return unwrap(response)
  } catch (error) {
    handleAgentError(error, '代码保存失败')
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
