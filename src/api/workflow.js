import { buildApiError, createApiClient, unwrapResponse } from './http'

const api = createApiClient(20000)

const toTagString = (tags) => {
  if (Array.isArray(tags)) {
    const values = tags.map((item) => String(item || '').trim()).filter(Boolean)
    return values.length ? values.join(',') : null
  }
  const raw = String(tags || '').trim()
  return raw || null
}

const toOptionalString = (value) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

const normalizeListPayload = (payload, fallbackPage = 1, fallbackSize = 20) => {
  if (Array.isArray(payload)) {
    return {
      total: payload.length,
      page: fallbackPage,
      page_size: fallbackSize,
      items: payload
    }
  }

  const list = payload?.items || payload?.list || payload?.records || payload?.data || []
  const items = Array.isArray(list) ? list : []
  return {
    total: Number(payload?.total ?? payload?.count ?? items.length ?? 0),
    page: Number(payload?.page ?? fallbackPage),
    page_size: Number(payload?.page_size ?? payload?.pageSize ?? fallbackSize),
    items
  }
}

export async function fetchWorkflowList(params = {}) {
  const requestParams = {
    page: Number(params?.page || 1),
    page_size: Number(params?.page_size || params?.pageSize || 20)
  }

  if (params?.category) requestParams.category = String(params.category).trim()
  if (params?.task_type) requestParams.task_type = String(params.task_type).trim()
  if (params?.tag) requestParams.tag = String(params.tag).trim()
  if (params?.status) requestParams.status = String(params.status).trim()
  if (params?.scope) requestParams.scope = String(params.scope).trim()
  if (params?.sort) requestParams.sort = String(params.sort).trim()

  try {
    const response = await api.get('/api/agent/workflows', { params: requestParams })
    return normalizeListPayload(unwrapResponse(response), requestParams.page, requestParams.page_size)
  } catch (error) {
    throw buildApiError(error, '加载工作流列表失败')
  }
}

export async function fetchWorkflowDetail(workflowId) {
  try {
    const response = await api.get(`/api/agent/workflows/${workflowId}`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载工作流详情失败')
  }
}

export async function forkWorkflow(workflowId) {
  try {
    const response = await api.post(`/api/agent/workflows/${workflowId}/fork`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, 'Fork 工作流失败')
  }
}

export async function fetchAdminWorkflows(status) {
  const normalizedStatus = status !== undefined && status !== null ? String(status).trim().toUpperCase() : ''
  const statusMap = {
    PENDING: '0',
    APPROVED: '1',
    REJECTED: '2',
    OFFLINE: '3'
  }

  const requestWithStatus = async (value) => {
    const response = await api.get('/api/agent/admin/workflows', { params: { status: value } })
    return normalizeListPayload(unwrapResponse(response)).items
  }

  // 后端当前对“无 status / status=PENDING”存在 500，前端改为显式查询并合并，避免页面报错。
  if (!normalizedStatus) {
    const allStatusValues = ['0', '1', '2', '3']
    try {
      const groups = await Promise.all(allStatusValues.map((value) => requestWithStatus(value)))
      const merged = new Map()
      groups.flat().forEach((item) => {
        const key = item?.id ?? item?.workflow_id
        if (key !== undefined && key !== null && !merged.has(key)) merged.set(key, item)
      })
      return [...merged.values()]
    } catch (error) {
      throw buildApiError(error, '加载管理员工作流列表失败')
    }
  }

  const backendStatus = statusMap[normalizedStatus] || normalizedStatus
  try {
    return await requestWithStatus(backendStatus)
  } catch (error) {
    const apiError = buildApiError(error, '加载管理员工作流列表失败')
    if (normalizedStatus === 'PENDING' && backendStatus !== '0') {
      try {
        return await requestWithStatus('0')
      } catch (retryError) {
        throw buildApiError(retryError, '加载管理员工作流列表失败')
      }
    }
    throw apiError
  }
}

export async function auditWorkflow(workflowId, payload) {
  const requestPayload = {
    audit_status: String(payload?.audit_status || '').trim(),
    rejection_reason: payload?.rejection_reason === undefined ? null : toOptionalString(payload?.rejection_reason),
    category: payload?.category === undefined ? null : toOptionalString(payload?.category),
    tags: payload?.tags === undefined ? null : toTagString(payload?.tags),
    is_recommended:
      payload?.is_recommended === undefined || payload?.is_recommended === null
        ? null
        : Number(payload.is_recommended)
  }

  try {
    const response = await api.post(`/api/agent/admin/workflows/${workflowId}/audit`, requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '审核工作流失败')
  }
}

export async function takeDownWorkflow(workflowId, reason) {
  try {
    const response = await api.post(`/api/agent/admin/workflows/${workflowId}/take-down`, {
      reason: String(reason || '').trim()
    })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '下架工作流失败')
  }
}

export async function updateWorkflowAdmin(workflowId, payload) {
  const requestPayload = {
    title: payload?.title === undefined ? undefined : toOptionalString(payload?.title),
    description: payload?.description === undefined ? undefined : toOptionalString(payload?.description),
    category: payload?.category === undefined ? undefined : toOptionalString(payload?.category),
    applicable_task_types:
      payload?.applicable_task_types === undefined ? undefined : toOptionalString(payload?.applicable_task_types),
    tags: payload?.tags === undefined ? undefined : toTagString(payload?.tags),
    is_public:
      payload?.is_public === undefined
        ? undefined
        : payload?.is_public === null
          ? null
          : Number(payload?.is_public)
  }

  Object.keys(requestPayload).forEach((key) => {
    if (requestPayload[key] === undefined) delete requestPayload[key]
  })

  try {
    const response = await api.put(`/api/agent/admin/workflows/${workflowId}`, requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '更新工作流失败')
  }
}
