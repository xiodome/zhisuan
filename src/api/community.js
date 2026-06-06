import { buildApiError, createApiClient, unwrapResponse } from './http'

const api = createApiClient(15000)

const normalizeCollectionPayload = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.records)) return payload.records
  if (payload && typeof payload === 'object' && payload.id !== undefined && payload.id !== null) return [payload]
  return []
}

export async function fetchCommunityResources(params = {}) {
  const requestParams = {
    type: String(params?.type || '').trim().toUpperCase(),
    page: Number(params?.page || 1),
    page_size: Number(params?.page_size || params?.pageSize || 20)
  }

  if (params?.category) requestParams.category = String(params.category).trim()
  if (params?.sort_by) requestParams.sort_by = String(params.sort_by).trim()
  if (params?.search) requestParams.search = String(params.search).trim()

  try {
    const response = await api.get('/api/community/resources', { params: requestParams })
    const payload = unwrapResponse(response)
    const list = normalizeCollectionPayload(payload)
    return {
      total: Number(payload?.total ?? list.length ?? 0),
      page: Number(payload?.page ?? requestParams.page),
      page_size: Number(payload?.page_size ?? requestParams.page_size),
      items: list
    }
  } catch (error) {
    throw buildApiError(error, '加载社区内容失败')
  }
}

export async function fetchCommunityResourceDetail(type, resourceId) {
  try {
    const normalizedType = String(type || '').trim().toUpperCase()
    const response = await api.get(`/api/community/resources/${normalizedType}/${resourceId}`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载社区详情失败')
  }
}

export async function fetchCommunityDatasetPreview(datasetId) {
  try {
    const response = await api.get(`/api/community/datasets/${datasetId}/preview`)
    return unwrapResponse(response)
  } catch (error) {
    throw buildApiError(error, '加载公开数据集预览失败')
  }
}

export async function downloadCommunityDataset(datasetId) {
  try {
    const response = await api.get(`/api/community/datasets/${datasetId}/download`, { responseType: 'blob' })
    return response.data
  } catch (error) {
    throw buildApiError(error, '下载公开数据集失败')
  }
}

export async function fetchCommunityComments(type, resourceId) {
  try {
    const response = await api.get('/api/community/comments', {
      params: {
        type: String(type || '').trim().toUpperCase(),
        resource_id: Number(resourceId)
      }
    })
    const payload = unwrapResponse(response)
    if (Array.isArray(payload)) return payload
    return Array.isArray(payload?.items) ? payload.items : []
  } catch (error) {
    throw buildApiError(error, '加载评论失败')
  }
}
