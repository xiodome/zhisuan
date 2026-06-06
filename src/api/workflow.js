import { buildApiError, createApiClient, unwrapResponse } from './http'

const api = createApiClient(20000)

// 社区/普通用户工作流列表查询
export async function fetchWorkflowList(params = {}) {
  try {
    const response = await api.get('/api/agent/workflows', { params })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载工作流列表失败')
  }
}

// 工作流详情（使用社区通用资源详情接口，规避404）
export async function fetchWorkflowDetail(workflowId) {
  try {
    const response = await api.get(`/api/community/resources/WORKFLOW/${workflowId}`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载工作流详情失败')
  }
}

// Fork 工作流
export async function forkWorkflow(workflowId) {
  try {
    const response = await api.post(`/api/agent/workflows/${workflowId}/fork`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, 'Fork 工作流失败')
  }
}

// ==========================================
// 管理员专属工作流管理接口（完全匹配后端真实路径）
// ==========================================

// 管理员获取所有工作流列表 (包含 PENDING / APPROVED)
export async function fetchAdminWorkflows(params = {}) {
  try {
    const requestParams = typeof params === 'string' ? { status: params || undefined } : { ...params }
    Object.keys(requestParams).forEach((key) => {
      if (requestParams[key] === '' || requestParams[key] === null || requestParams[key] === undefined) delete requestParams[key]
    })
    const response = await api.get('/api/agent/admin/workflows', { params: requestParams })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载管理员工作流列表失败')
  }
}

// 管理员修改工作流信息（编辑、设为公开/私有）
export async function updateWorkflowAdmin(workflowId, payload) {
  try {
    const response = await api.put(`/api/agent/admin/workflows/${workflowId}`, payload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '更新工作流失败')
  }
}

// 管理员下架工作流（代替删除功能）
export async function takeDownWorkflow(workflowId, reason = '管理员主动下架') {
  try {
    const response = await api.post(`/api/agent/admin/workflows/${workflowId}/take-down`, { reason })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '下架工作流失败')
  }
}

// 管理员审核工作流
export async function auditWorkflow(workflowId, payload) {
  try {
    const response = await api.post(`/api/agent/admin/workflows/${workflowId}/audit`, payload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '审核工作流失败')
  }
}
