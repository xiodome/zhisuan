import { buildApiError, createApiClient, unwrapResponse } from './http'

const api = createApiClient(15000)

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

const normalizeModelCollection = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.records)) return payload.records
  if (payload && typeof payload === 'object') {
    if (payload.id !== undefined && payload.id !== null) return [payload]
  }
  return []
}

export async function fetchPublicModels(params = {}) {
  try {
    const response = await api.get('/api/models/', {
      params: params.category ? { category: String(params.category).trim() } : {}
    })
    return normalizeModelCollection(unwrapResponse(response))
  } catch (error) {
    throw buildApiError(error, '加载模型列表失败')
  }
}

export async function fetchMyModels() {
  try {
    const response = await api.get('/api/models/my')
    return normalizeModelCollection(unwrapResponse(response))
  } catch (error) {
    throw buildApiError(error, '加载我的模型失败')
  }
}

export async function fetchModelDetail(modelId) {
  try {
    const response = await api.get(`/api/models/${modelId}`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载模型详情失败')
  }
}

export async function createModel(payload) {
  const requestPayload = {
    name: String(payload?.name || '').trim(),
    description: toOptionalString(payload?.description),
    category: toOptionalString(payload?.category),
    tags: toTagString(payload?.tags),
    is_public: Boolean(payload?.is_public),
    resource_url: toOptionalString(payload?.resource_url)
  }

  try {
    const response = await api.post('/api/models/', requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '发布模型失败')
  }
}

export async function updateModel(modelId, payload) {
  const requestPayload = {
    name: payload?.name === undefined ? undefined : toOptionalString(payload?.name),
    description: payload?.description === undefined ? undefined : toOptionalString(payload?.description),
    category: payload?.category === undefined ? undefined : toOptionalString(payload?.category),
    tags: payload?.tags === undefined ? undefined : toTagString(payload?.tags),
    is_public: payload?.is_public === undefined ? undefined : Boolean(payload?.is_public),
    resource_url: payload?.resource_url === undefined ? undefined : toOptionalString(payload?.resource_url)
  }

  Object.keys(requestPayload).forEach((key) => {
    if (requestPayload[key] === undefined) delete requestPayload[key]
  })

  try {
    const response = await api.put(`/api/models/${modelId}`, requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '更新模型失败')
  }
}

export async function updateModelAdmin(modelId, payload) {
  const requestPayload = {
    name: payload?.name === undefined ? undefined : toOptionalString(payload?.name),
    description: payload?.description === undefined ? undefined : toOptionalString(payload?.description),
    category: payload?.category === undefined ? undefined : toOptionalString(payload?.category),
    tags: payload?.tags === undefined ? undefined : toTagString(payload?.tags),
    is_public: payload?.is_public === undefined ? undefined : Boolean(payload?.is_public),
    resource_url: payload?.resource_url === undefined ? undefined : toOptionalString(payload?.resource_url)
  }

  Object.keys(requestPayload).forEach((key) => {
    if (requestPayload[key] === undefined) delete requestPayload[key]
  })

  try {
    const response = await api.put(`/api/models/${modelId}/admin`, requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '管理员更新模型失败')
  }
}

export async function fetchAdminModels(status) {
  try {
    const params = status === undefined || status === null || status === '' ? {} : { status: Number(status) }
    const response = await api.get('/api/models/admin/all', { params })
    const payload = unwrapResponse(response)
    return normalizeModelCollection(payload)
  } catch (error) {
    throw buildApiError(error, '加载管理员模型列表失败')
  }
}

export async function auditModel(modelId, payload) {
  const requestPayload = {
    status: Number(payload?.status),
    rejection_reason: payload?.rejection_reason === undefined ? null : toOptionalString(payload?.rejection_reason),
    category: payload?.category === undefined ? null : toOptionalString(payload?.category),
    tags: payload?.tags === undefined ? null : toTagString(payload?.tags),
    is_recommended: payload?.is_recommended === undefined ? null : Boolean(payload?.is_recommended)
  }

  try {
    const response = await api.post(`/api/models/${modelId}/audit`, requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '审核模型失败')
  }
}

export async function takeDownModel(modelId, reason) {
  try {
    const response = await api.post(`/api/models/${modelId}/take-down`, {
      reason: String(reason || '').trim()
    })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '下架模型失败')
  }
}

export async function publishModel(modelId) {
  try {
    const response = await api.post(`/api/models/${modelId}/publish`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '重新上架模型失败')
  }
}
