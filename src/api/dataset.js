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

const normalizeDatasetCollection = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.records)) return payload.records
  if (payload && typeof payload === 'object') {
    if (payload.id !== undefined && payload.id !== null) return [payload]
  }
  return []
}

export async function fetchPublicDatasets(params = {}) {
  try {
    const response = await api.get('/api/datasets/', {
      params: params.category ? { category: String(params.category).trim() } : {}
    })
    return normalizeDatasetCollection(unwrapResponse(response))
  } catch (error) {
    throw buildApiError(error, '加载数据集列表失败')
  }
}

export async function fetchMyDatasets() {
  try {
    const response = await api.get('/api/datasets/my')
    return normalizeDatasetCollection(unwrapResponse(response))
  } catch (error) {
    throw buildApiError(error, '加载我的数据集失败')
  }
}

export async function fetchDatasetDetail(datasetId) {
  try {
    const response = await api.get(`/api/datasets/${datasetId}`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载数据集详情失败')
  }
}

export async function createDataset(payload) {
  const requestPayload = {
    name: String(payload?.name || '').trim(),
    description: toOptionalString(payload?.description),
    category: toOptionalString(payload?.category),
    tags: toTagString(payload?.tags),
    is_public: Boolean(payload?.is_public),
    file_url: toOptionalString(payload?.file_url),
    file_size: payload?.file_size !== undefined && payload?.file_size !== null ? Number(payload.file_size) : null,
    row_count: payload?.row_count !== undefined && payload?.row_count !== null ? Number(payload.row_count) : null
  }

  try {
    const response = await api.post('/api/datasets/', requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '发布数据集失败')
  }
}

export async function updateDataset(datasetId, payload) {
  const requestPayload = {
    name: payload?.name === undefined ? undefined : toOptionalString(payload?.name),
    description: payload?.description === undefined ? undefined : toOptionalString(payload?.description),
    category: payload?.category === undefined ? undefined : toOptionalString(payload?.category),
    tags: payload?.tags === undefined ? undefined : toTagString(payload?.tags),
    is_public: payload?.is_public === undefined ? undefined : Boolean(payload?.is_public),
    file_url: payload?.file_url === undefined ? undefined : toOptionalString(payload?.file_url)
  }

  Object.keys(requestPayload).forEach((key) => {
    if (requestPayload[key] === undefined) delete requestPayload[key]
  })

  try {
    const response = await api.put(`/api/datasets/${datasetId}`, requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '更新数据集失败')
  }
}

export async function fetchAdminDatasets(status) {
  try {
    const params = status === undefined || status === null || status === '' ? {} : { status: Number(status) }
    const response = await api.get('/api/datasets/admin/all', { params })
    const payload = unwrapResponse(response)
    return normalizeDatasetCollection(payload)
  } catch (error) {
    throw buildApiError(error, '加载管理员数据集列表失败')
  }
}

export async function auditDataset(datasetId, payload) {
  const requestPayload = {
    status: Number(payload?.status),
    rejection_reason: payload?.rejection_reason === undefined ? null : toOptionalString(payload?.rejection_reason),
    category: payload?.category === undefined ? null : toOptionalString(payload?.category),
    tags: payload?.tags === undefined ? null : toTagString(payload?.tags)
  }

  try {
    const response = await api.post(`/api/datasets/${datasetId}/audit`, requestPayload)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '审核数据集失败')
  }
}

export async function takeDownDataset(datasetId, reason) {
  try {
    const response = await api.post(`/api/datasets/${datasetId}/take-down`, {
      reason: String(reason || '').trim()
    })
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '下架数据集失败')
  }
}
