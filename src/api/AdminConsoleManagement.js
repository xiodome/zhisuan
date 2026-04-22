import axios from 'axios'
import { useUserStore } from '../store/user'

const api = axios.create({
  baseURL: 'http://114.116.220.203:8000',
  timeout: 5000
})

api.interceptors.request.use((config) => {
  const store = useUserStore()
  if (store.token) {
    config.headers.Authorization = `Bearer ${store.token}`
  }
  return config
})

// 假数据模式
const USE_MOCK_DATA = true

const wait = (duration = 220) =>
  new Promise((resolve) => {
    setTimeout(resolve, duration)
  })

const clone = (value) => JSON.parse(JSON.stringify(value))

// 用户额度信息 假数据
const mockQuotaUsers = [
  {
    id: 101,
    username: 'demo_admin',
    role: 'ADMIN',
    tokenQuota: 400000,
    tokenUsed: 112430,
    usageLimit: 380000,
    warningThreshold: 0.8,
    status: 'enabled',
    updatedAt: '2026-04-20 14:22:10'
  },
  {
    id: 102,
    username: 'ai_dev_lili',
    role: 'DEVELOPER',
    tokenQuota: 300000,
    tokenUsed: 266000,
    usageLimit: 285000,
    warningThreshold: 0.75,
    status: 'enabled',
    updatedAt: '2026-04-21 09:12:08'
  },
  {
    id: 103,
    username: 'zero_user_wang',
    role: 'ZERO_BASIS',
    tokenQuota: 120000,
    tokenUsed: 118000,
    usageLimit: 115000,
    warningThreshold: 0.85,
    status: 'enabled',
    updatedAt: '2026-04-21 18:03:11'
  },
  {
    id: 104,
    username: 'geo_team_zhang',
    role: 'DEVELOPER',
    tokenQuota: 500000,
    tokenUsed: 184000,
    usageLimit: 450000,
    warningThreshold: 0.8,
    status: 'enabled',
    updatedAt: '2026-04-19 16:30:12'
  },
  {
    id: 105,
    username: 'crop_lab_he',
    role: 'ZERO_BASIS',
    tokenQuota: 100000,
    tokenUsed: 26000,
    usageLimit: 90000,
    warningThreshold: 0.8,
    status: 'disabled',
    updatedAt: '2026-04-16 11:06:41'
  }
]

// 调用消耗记录 假数据
const mockConsumptionRecords = [
  {
    id: 6001,
    userId: 102,
    username: 'ai_dev_lili',
    endpoint: '/api/chat/completions',
    modelName: 'gpt-5.2',
    tokenConsumed: 3200,
    createdAt: '2026-04-22 09:33:12'
  },
  {
    id: 6002,
    userId: 104,
    username: 'geo_team_zhang',
    endpoint: '/api/embeddings',
    modelName: 'text-embedding-3-large',
    tokenConsumed: 840,
    createdAt: '2026-04-22 09:31:49'
  },
  {
    id: 6003,
    userId: 103,
    username: 'zero_user_wang',
    endpoint: '/api/chat/completions',
    modelName: 'gpt-5.2-mini',
    tokenConsumed: 4810,
    createdAt: '2026-04-22 09:28:40'
  },
  {
    id: 6004,
    userId: 101,
    username: 'demo_admin',
    endpoint: '/api/chat/completions',
    modelName: 'gpt-5.2',
    tokenConsumed: 2200,
    createdAt: '2026-04-22 09:17:06'
  },
  {
    id: 6005,
    userId: 102,
    username: 'ai_dev_lili',
    endpoint: '/api/images/generations',
    modelName: 'gpt-image-1',
    tokenConsumed: 1200,
    createdAt: '2026-04-21 17:58:29'
  },
  {
    id: 6006,
    userId: 105,
    username: 'crop_lab_he',
    endpoint: '/api/chat/completions',
    modelName: 'gpt-5.2-mini',
    tokenConsumed: 530,
    createdAt: '2026-04-21 15:23:59'
  }
]

// 数据集列表 假数据
const mockDatasets = [
  {
    id: 7001,
    name: '华北小麦病虫害图像数据集',
    owner: 'crop_lab_he',
    samples: 13840,
    reviewStatus: 'PENDING',
    publishStatus: 'PRIVATE',
    category: '农业',
    tags: ['病虫害', '图像', '小麦'],
    submittedAt: '2026-04-20 10:20:00',
    updatedAt: '2026-04-20 10:20:00'
  },
  {
    id: 7002,
    name: '胸部CT辅助诊断标注集',
    owner: 'med_team_lin',
    samples: 2400,
    reviewStatus: 'APPROVED',
    publishStatus: 'PUBLIC',
    category: '医疗',
    tags: ['CT', '影像', '诊断'],
    submittedAt: '2026-04-18 12:08:23',
    updatedAt: '2026-04-21 09:18:02'
  },
  {
    id: 7003,
    name: '交通流量时序预测数据',
    owner: 'city_ai_group',
    samples: 520000,
    reviewStatus: 'REJECTED',
    publishStatus: 'OFFLINE',
    category: '交通',
    tags: ['时序', '预测'],
    submittedAt: '2026-04-17 16:35:40',
    updatedAt: '2026-04-19 15:50:17'
  },
  {
    id: 7004,
    name: '公开卫星遥感土地覆盖集',
    owner: 'geo_team_zhang',
    samples: 84000,
    reviewStatus: 'APPROVED',
    publishStatus: 'PUBLIC',
    category: '遥感',
    tags: ['遥感', '分割', '土地覆盖'],
    submittedAt: '2026-04-15 08:42:11',
    updatedAt: '2026-04-20 09:15:05'
  }
]

// 模型列表 假数据
const mockModels = [
  {
    id: 8001,
    name: 'AgriVision-Classifier',
    owner: 'ai_dev_lili',
    version: 'v1.4.2',
    framework: 'PyTorch',
    reviewStatus: 'PENDING',
    publishStatus: 'PRIVATE',
    category: '分类',
    tags: ['农业', '病虫害', '分类'],
    createdAt: '2026-04-20 13:11:10',
    updatedAt: '2026-04-20 13:11:10'
  },
  {
    id: 8002,
    name: 'CT-Lesion-Segmenter',
    owner: 'med_team_lin',
    version: 'v2.0.0',
    framework: 'TensorFlow',
    reviewStatus: 'APPROVED',
    publishStatus: 'PUBLIC',
    category: '分类',
    tags: ['医疗', 'CT', '分割'],
    createdAt: '2026-04-18 09:53:24',
    updatedAt: '2026-04-21 11:06:09'
  },
  {
    id: 8003,
    name: 'MetroFlowPredictor',
    owner: 'city_ai_group',
    version: 'v0.9.1',
    framework: 'XGBoost',
    reviewStatus: 'REJECTED',
    publishStatus: 'PRIVATE',
    category: '回归',
    tags: ['交通', '预测', '时序'],
    createdAt: '2026-04-17 17:03:42',
    updatedAt: '2026-04-19 10:22:16'
  },
  {
    id: 8004,
    name: 'RemoteSense-MultiTask',
    owner: 'geo_team_zhang',
    version: 'v3.2.5',
    framework: 'PaddlePaddle',
    reviewStatus: 'APPROVED',
    publishStatus: 'PUBLIC',
    category: '分类',
    tags: ['遥感', '检测', '分割'],
    createdAt: '2026-04-16 10:26:57',
    updatedAt: '2026-04-20 16:04:31'
  }
]


// 用户当前的额度状态(是否达到总 Token 额度、达到使用上限、达到预警阈值、额度不足)
const resolveQuotaState = (user) => {
  const quotaReached = user.tokenUsed >= user.tokenQuota
  const limitReached = user.tokenUsed >= user.usageLimit
  const warningReached = user.tokenUsed / user.tokenQuota >= user.warningThreshold
  return {
    quotaReached,
    limitReached,
    warningReached,
    insufficient: quotaReached || limitReached
  }
}

const toListResult = (list) => ({
  list,
  total: list.length
})

export const isUsingMockData = USE_MOCK_DATA


/*==========================================================API额度管理==========================================================*/
/*==========================================================API额度管理==========================================================*/

// 获取API额度总览(管理用户数、累计消耗 Token、预警用户数、额度不足用户)
export async function fetchQuotaOverview() {
  if (USE_MOCK_DATA) {
    await wait()
    const totalConsumedTokens = mockQuotaUsers.reduce((sum, item) => sum + item.tokenUsed, 0)
    const warningUsers = mockQuotaUsers.filter((item) => resolveQuotaState(item).warningReached).length
    const insufficientUsers = mockQuotaUsers.filter((item) => resolveQuotaState(item).insufficient).length
    return {
      totalUsers: mockQuotaUsers.length,
      totalConsumedTokens,
      warningUsers,
      insufficientUsers
    }
  }

  // TODO: 对接后端接口
}

// 获取用户额度列表，支持筛选(用户名、角色、账号状态)
export async function fetchQuotaUserList(filters = {}) {
  if (USE_MOCK_DATA) {
    await wait()
    const normalizedKeyword = (filters.username || '').trim().toLowerCase()
    const list = mockQuotaUsers.filter((item) => {
      const usernameMatch = !normalizedKeyword || item.username.toLowerCase().includes(normalizedKeyword)
      const roleMatch = !filters.role || item.role === filters.role
      const statusMatch = !filters.status || item.status === filters.status
      return usernameMatch && roleMatch && statusMatch
    })
    return toListResult(clone(list))
  }

  // TODO: 对接后端接口
}

// 调整用户的额度(Token 额度、使用上限和预警阈值)
export async function adjustUserQuota(payload) {
  if (USE_MOCK_DATA) {
    await wait()
    const target = mockQuotaUsers.find((item) => item.id === payload.userId)
    if (!target) {
      throw new Error('未找到对应用户，无法调整额度')
    }
    target.tokenQuota = Number(payload.tokenQuota)
    target.usageLimit = Number(payload.usageLimit)
    target.warningThreshold = Number(payload.warningThreshold)
    target.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { success: true }
  }

  // TODO: 对接后端接口
}

// 获取调用消耗记录列表，支持筛选(用户名、接口)
export async function fetchQuotaConsumptionRecords(filters = {}) {
  if (USE_MOCK_DATA) {
    await wait()
    const normalizedKeyword = (filters.username || '').trim().toLowerCase()
    const endpointFilter = filters.endpoint || ''
    const list = mockConsumptionRecords.filter((item) => {
      const usernameMatch = !normalizedKeyword || item.username.toLowerCase().includes(normalizedKeyword)
      const endpointMatch = !endpointFilter || item.endpoint === endpointFilter
      return usernameMatch && endpointMatch
    })
    return toListResult(clone(list))
  }

  // TODO: 对接后端接口
}
/*==========================================================END==========================================================*/
/*==========================================================END==========================================================*/





/*==========================================================数据中心审核与管理==========================================================*/
/*==========================================================数据中心审核与管理==========================================================*/

// 获取数据集列表，支持筛选(关键词、审核状态、公布状态、分类)
export async function fetchDatasetList(filters = {}) {
  if (USE_MOCK_DATA) {
    await wait()
    const normalizedKeyword = (filters.keyword || '').trim().toLowerCase()
    const list = mockDatasets.filter((item) => {
      const keywordMatch =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.owner.toLowerCase().includes(normalizedKeyword)
      const reviewMatch = !filters.reviewStatus || item.reviewStatus === filters.reviewStatus
      const publishMatch = !filters.publishStatus || item.publishStatus === filters.publishStatus
      const categoryMatch = !filters.category || item.category === filters.category
      return keywordMatch && reviewMatch && publishMatch && categoryMatch
    })
    return toListResult(clone(list))
  }

  // TODO: 对接后端接口
}

// 更新数据集审核状态(待审核、已通过、已驳回)
export async function updateDatasetReviewStatus(payload) {
  if (USE_MOCK_DATA) {
    await wait()
    const target = mockDatasets.find((item) => item.id === payload.datasetId)
    if (!target) {
      throw new Error('未找到数据集，无法更新审核状态')
    }
    target.reviewStatus = payload.reviewStatus
    target.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { success: true }
  }

  // TODO: 对接后端接口
}

// 更新数据集的公开状态(公开、下架)
export async function updateDatasetPublishStatus(payload) {
  if (USE_MOCK_DATA) {
    await wait()
    const target = mockDatasets.find((item) => item.id === payload.datasetId)
    if (!target) {
      throw new Error('未找到数据集，无法更新公开状态')
    }
    target.publishStatus = payload.publishStatus
    target.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { success: true }
  }

  // TODO: 对接后端接口
}

// 更新数据集的分类和标签
export async function updateDatasetMeta(payload) {
  if (USE_MOCK_DATA) {
    await wait()
    const target = mockDatasets.find((item) => item.id === payload.datasetId)
    if (!target) {
      throw new Error('未找到数据集，无法更新分类与标签')
    }
    target.category = payload.category
    target.tags = payload.tags
    target.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { success: true }
  }

  // TODO: 对接后端接口
}

/*==========================================================END==========================================================*/
/*==========================================================END==========================================================*/



/*==========================================================模型广场审核与管理==========================================================*/
/*==========================================================模型广场审核与管理==========================================================*/

//获取模型列表，支持筛选(关键字、审核状态、公开状态)
export async function fetchModelList(filters = {}) {
  if (USE_MOCK_DATA) {
    await wait()
    const normalizedKeyword = (filters.keyword || '').trim().toLowerCase()
    const list = mockModels.filter((item) => {
      const keywordMatch =
        !normalizedKeyword ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.owner.toLowerCase().includes(normalizedKeyword)
      const reviewMatch = !filters.reviewStatus || item.reviewStatus === filters.reviewStatus
      const publishMatch = !filters.publishStatus || item.publishStatus === filters.publishStatus
      const categoryMatch = !filters.category || item.category === filters.category
      return keywordMatch && reviewMatch && publishMatch && categoryMatch
    })
    return toListResult(clone(list))
  }

  // TODO: 对接后端接口
}

// 更新模型审核状态(通过、驳回)
export async function updateModelReviewStatus(payload) {
  if (USE_MOCK_DATA) {
    await wait()
    const target = mockModels.find((item) => item.id === payload.modelId)
    if (!target) {
      throw new Error('未找到模型，无法更新审核状态')
    }
    target.reviewStatus = payload.reviewStatus
    target.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { success: true }
  }

  // TODO: 对接后端接口
}

// 更新模型公开状态(公开、未公开)
export async function updateModelPublishStatus(payload) {
  if (USE_MOCK_DATA) {
    await wait()
    const target = mockModels.find((item) => item.id === payload.modelId)
    if (!target) {
      throw new Error('未找到模型，无法更新公开状态')
    }
    target.publishStatus = payload.publishStatus
    target.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { success: true }
  }

  // TODO: 对接后端接口
}

// 更新模型分类和标签
export async function updateModelMeta(payload) {
  if (USE_MOCK_DATA) {
    await wait()
    const target = mockModels.find((item) => item.id === payload.modelId)
    if (!target) {
      throw new Error('未找到模型，无法更新分类与标签')
    }
    target.category = payload.category
    target.tags = payload.tags
    target.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    return { success: true }
  }

  // TODO: 对接后端接口
}

/*==========================================================END==========================================================*/
/*==========================================================END==========================================================*/