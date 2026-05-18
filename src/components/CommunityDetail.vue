<template>
  <div class="community-detail-page" v-loading="loading">
    <div class="detail-head">
      <el-button plain @click="router.back()">返回</el-button>
      <el-tag>{{ typeLabel }}</el-tag>
    </div>

    <el-alert v-if="errorMessage" type="error" :closable="false" :title="errorMessage" />

    <el-card v-if="detail" class="detail-card" shadow="never">
      <div class="title-row">
        <h1 class="detail-title">{{ titleText }}</h1>
        <el-tag :type="statusTag">{{ statusLabel }}</el-tag>
      </div>

      <p class="detail-desc">{{ descriptionText }}</p>

      <div class="meta-grid">
        <div><span class="meta-key">创建者</span><span class="meta-value">{{ creatorText }}</span></div>
        <div><span class="meta-key">创建时间</span><span class="meta-value">{{ createdAtText }}</span></div>
        <div><span class="meta-key">分类</span><span class="meta-value">{{ categoryText }}</span></div>
      </div>

      <div class="tags-row" v-if="tags.length">
        <el-tag v-for="tag in tags" :key="tag" effect="plain">{{ tag }}</el-tag>
      </div>

      <section v-if="isDataset" class="section-block">
        <h3>数据集信息</h3>
        <div class="meta-grid compact">
          <div><span class="meta-key">文件大小</span><span class="meta-value">{{ fileSizeText }}</span></div>
          <div><span class="meta-key">样本行数</span><span class="meta-value">{{ rowCountText }}</span></div>
          <div><span class="meta-key">浏览量</span><span class="meta-value">{{ countText(datasetDetail?.view_count) }}</span></div>
          <div><span class="meta-key">公开状态</span><span class="meta-value">{{ datasetDetail?.is_public ? '公开' : '私有' }}</span></div>
        </div>

        <div class="preview-block">
          <div class="preview-head">
            <h4>数据样例预览</h4>
            <el-button size="small" :loading="datasetPreviewLoading" @click="loadDatasetPreview">刷新预览</el-button>
          </div>
          <el-alert
            v-if="datasetPreviewError"
            type="warning"
            :closable="false"
            :title="datasetPreviewError"
            class="preview-alert"
          />
          <el-table v-else-if="datasetPreviewRows.length" :data="datasetPreviewRows" border max-height="360">
            <el-table-column
              v-for="column in datasetPreviewColumns"
              :key="column"
              :prop="column"
              :label="column"
              min-width="140"
              show-overflow-tooltip
            />
          </el-table>
          <el-empty v-else description="暂无可预览样例" />
        </div>
      </section>

      <section v-if="isModel" class="section-block">
        <h3>模型信息</h3>
        <div class="meta-grid compact">
          <div><span class="meta-key">推荐状态</span><span class="meta-value">{{ modelDetail?.is_recommended ? '推荐' : '普通' }}</span></div>
          <div><span class="meta-key">浏览量</span><span class="meta-value">{{ countText(modelDetail?.view_count) }}</span></div>
          <div><span class="meta-key">公开状态</span><span class="meta-value">{{ modelDetail?.is_public ? '公开' : '私有' }}</span></div>
        </div>
      </section>

      <section v-if="isWorkflow" class="section-block">
        <h3>工作流摘要</h3>
        <div class="meta-grid compact">
          <div><span class="meta-key">节点数量</span><span class="meta-value">{{ workflowNodeCount }}</span></div>
          <div><span class="meta-key">适用任务类型</span><span class="meta-value">{{ workflowTaskTypeText }}</span></div>
          <div><span class="meta-key">Fork 来源</span><span class="meta-value">{{ workflowSourceText }}</span></div>
          <div><span class="meta-key">审核状态</span><span class="meta-value">{{ workflowAuditText }}</span></div>
        </div>
        <el-alert
          v-if="workflowDetail?.workflow_spec_json"
          type="info"
          :closable="false"
          title="已返回 workflow_spec_json，可用于后续可视化流程节点。"
        />
      </section>

      <div class="action-row">
        <el-button v-if="isDataset && datasetDetail?.file_url" @click="openExternal(datasetDetail.file_url)">查看文件</el-button>
        <el-button v-if="isDataset && datasetDetail?.file_url" type="primary" @click="downloadDatasetFile">下载数据集</el-button>
        <el-tooltip v-if="isDataset && !datasetDetail?.file_url" content="TODO: 当前接口未返回可下载文件地址" placement="top">
          <el-tag type="info">暂无下载地址</el-tag>
        </el-tooltip>

        <el-button v-if="isModel && modelDetail?.resource_url" @click="openExternal(modelDetail.resource_url)">查看模型资源</el-button>
        <el-button v-if="isModel && modelDetail?.resource_url" type="primary" @click="openExternal(modelDetail.resource_url)">使用模型</el-button>

        <el-button
          v-if="isWorkflow"
          type="primary"
          :disabled="forkApiMissing || !canFork || forkSubmitting"
          :loading="forkSubmitting"
          @click="handleForkWorkflow"
        >
          Fork 工作流
        </el-button>
        <el-tooltip v-if="isWorkflow && forkApiMissing" content="TODO: 当前环境未提供 fork 接口" placement="top">
          <el-tag>TODO</el-tag>
        </el-tooltip>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../store/user'
import { fetchCommunityResourceDetail } from '../api/community'
import { fetchDatasetDetail } from '../api/dataset'
import { fetchModelDetail } from '../api/model'
import { fetchWorkflowDetail, forkWorkflow } from '../api/workflow'
import { fetchDatasetPreview } from '../api/agent'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const errorMessage = ref('')
const detail = ref(null)
const datasetDetail = ref(null)
const modelDetail = ref(null)
const workflowDetail = ref(null)
const datasetPreviewRows = ref([])
const datasetPreviewLoading = ref(false)
const datasetPreviewError = ref('')

const forkSubmitting = ref(false)
const forkApiMissing = ref(false)

const normalizeType = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (raw === 'DATASET') return 'DATASET'
  if (raw === 'MODEL') return 'MODEL'
  if (raw === 'WORKFLOW') return 'WORKFLOW'
  if (raw === 'DATASETS') return 'DATASET'
  if (raw === 'MODELS') return 'MODEL'
  if (raw === 'WORKFLOWS') return 'WORKFLOW'
  return 'DATASET'
}

const typeValue = computed(() => normalizeType(route.params.type))
const resourceId = computed(() => Number(route.params.id))

const isDataset = computed(() => typeValue.value === 'DATASET')
const isModel = computed(() => typeValue.value === 'MODEL')
const isWorkflow = computed(() => typeValue.value === 'WORKFLOW')
const canFork = computed(() => Boolean(userStore.token))

const typeLabel = computed(() => {
  if (isModel.value) return '模型'
  if (isWorkflow.value) return '工作流'
  return '数据集'
})

const toTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  const text = String(value || '').trim()
  if (!text) return []
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const normalizeStatus = (value) => {
  if (value === null || value === undefined || value === '') return 'UNKNOWN'

  const num = Number(value)
  if (!Number.isNaN(num)) {
    if (num === 0) return 'PENDING'
    if (num === 1) return 'APPROVED'
    if (num === 2) return 'REJECTED'
    if (num === 3) return 'OFFLINE'
  }

  const normalized = String(value).trim().toUpperCase()
  if (['PENDING', 'WAITING', 'TO_REVIEW'].includes(normalized)) return 'PENDING'
  if (['APPROVED', 'SUCCESS', 'PASSED'].includes(normalized)) return 'APPROVED'
  if (['REJECTED', 'REFUSED', 'FAILED'].includes(normalized)) return 'REJECTED'
  if (['OFFLINE', 'TAKE_DOWN', 'TAKEN_DOWN'].includes(normalized)) return 'OFFLINE'
  return normalized
}

const formatTime = (value) => {
  if (!value) return '-'
  const text = String(value).replace('T', ' ')
  return text.length > 19 ? text.slice(0, 19) : text
}

const titleText = computed(() => {
  return (
    detail.value?.title ||
    detail.value?.name ||
    workflowDetail.value?.title ||
    datasetDetail.value?.name ||
    modelDetail.value?.name ||
    '未命名内容'
  )
})

const descriptionText = computed(() => {
  return (
    detail.value?.description ||
    workflowDetail.value?.description ||
    datasetDetail.value?.description ||
    modelDetail.value?.description ||
    '暂无简介'
  )
})

const creatorText = computed(() => {
  return (
    detail.value?.creator ||
    detail.value?.creator_name ||
    detail.value?.username ||
    detail.value?.user_name ||
    detail.value?.share_username ||
    detail.value?.shared_by_username ||
    workflowDetail.value?.creator ||
    workflowDetail.value?.creator_name ||
    workflowDetail.value?.username ||
    workflowDetail.value?.user_name ||
    workflowDetail.value?.share_username ||
    workflowDetail.value?.shared_by_username ||
    datasetDetail.value?.creator ||
    datasetDetail.value?.creator_name ||
    datasetDetail.value?.username ||
    datasetDetail.value?.user_name ||
    datasetDetail.value?.share_username ||
    datasetDetail.value?.shared_by_username ||
    modelDetail.value?.creator ||
    modelDetail.value?.creator_name ||
    modelDetail.value?.username ||
    modelDetail.value?.user_name ||
    modelDetail.value?.share_username ||
    modelDetail.value?.shared_by_username ||
    '-'
  )
})

const createdAtText = computed(() => {
  const value =
    detail.value?.created_at ||
    datasetDetail.value?.created_at ||
    modelDetail.value?.created_at ||
    workflowDetail.value?.created_at
  return formatTime(value)
})

const categoryText = computed(() => detail.value?.category || datasetDetail.value?.category || modelDetail.value?.category || workflowDetail.value?.category || '-')

const tags = computed(() => {
  return toTags(detail.value?.tags || datasetDetail.value?.tags || modelDetail.value?.tags || workflowDetail.value?.tags)
})

const statusValue = computed(() => {
  return normalizeStatus(detail.value?.audit_status ?? detail.value?.status ?? workflowDetail.value?.audit_status ?? workflowDetail.value?.status ?? datasetDetail.value?.status ?? modelDetail.value?.status)
})

const statusLabel = computed(() => {
  if (statusValue.value === 'PENDING') return '审核中'
  if (statusValue.value === 'APPROVED') return '已通过'
  if (statusValue.value === 'REJECTED') return '已驳回'
  if (statusValue.value === 'OFFLINE') return '已下架'
  if (statusValue.value === 'UNKNOWN') return '未知'
  return statusValue.value
})

const statusTag = computed(() => {
  if (statusValue.value === 'APPROVED') return 'success'
  if (statusValue.value === 'REJECTED') return 'danger'
  if (statusValue.value === 'PENDING') return 'warning'
  return 'info'
})

const fileSizeText = computed(() => {
  const size = Number(datasetDetail.value?.file_size)
  if (!size || Number.isNaN(size)) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
})

const rowCountText = computed(() => {
  const count = Number(datasetDetail.value?.row_count)
  return Number.isNaN(count) || count <= 0 ? '-' : count.toLocaleString()
})

const datasetPreviewColumns = computed(() => {
  if (!datasetPreviewRows.value.length) return []
  return Object.keys(datasetPreviewRows.value[0] || {})
})

const parseWorkflowSpec = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch (error) {
    return null
  }
}

const workflowSpec = computed(() => parseWorkflowSpec(workflowDetail.value?.workflow_spec_json))

const workflowNodeCount = computed(() => {
  const nodes = workflowSpec.value?.nodes
  if (Array.isArray(nodes)) return nodes.length

  const steps = workflowSpec.value?.steps
  if (Array.isArray(steps)) return steps.length

  return '-'
})

const workflowTaskTypeText = computed(() => {
  return workflowDetail.value?.applicable_task_types || workflowDetail.value?.task_type || '-'
})

const workflowSourceText = computed(() => {
  const value = workflowDetail.value?.source_workflow_id || workflowDetail.value?.fork_from_workflow_id
  return value ?? '-'
})

const workflowAuditText = computed(() => normalizeStatus(workflowDetail.value?.audit_status || workflowDetail.value?.status))

const countText = (value) => {
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString()
}

const openExternal = (url) => {
  const target = String(url || '').trim()
  if (!target) return
  window.open(target, '_blank', 'noopener,noreferrer')
}

const downloadDatasetFile = () => {
  const url = String(datasetDetail.value?.file_url || '').trim()
  if (!url) {
    ElMessage.warning('当前资源未返回可下载地址')
    return
  }
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.download = ''
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const normalizePreviewRows = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.rows)) return payload.rows
  if (Array.isArray(payload?.preview_data)) return payload.preview_data
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

const loadDatasetPreview = async () => {
  if (!isDataset.value || !resourceId.value) return

  datasetPreviewLoading.value = true
  datasetPreviewError.value = ''
  try {
    const payload = await fetchDatasetPreview(resourceId.value)
    datasetPreviewRows.value = normalizePreviewRows(payload).slice(0, 20)
    if (!datasetPreviewRows.value.length) {
      datasetPreviewError.value = '当前接口未返回可展示的预览数据'
    }
  } catch (error) {
    const status = Number(error?.status || 0)
    if (status === 401 || status === 403) {
      datasetPreviewError.value = '数据预览接口需要登录授权（/api/agent/datasets/{id}/preview）'
    } else {
      datasetPreviewError.value = error.message || '数据预览加载失败'
    }
    datasetPreviewRows.value = []
  } finally {
    datasetPreviewLoading.value = false
  }
}

const loadDetail = async () => {
  if (!resourceId.value) {
    errorMessage.value = '无效的资源 ID'
    return
  }

  loading.value = true
  errorMessage.value = ''
  detail.value = null
  datasetDetail.value = null
  modelDetail.value = null
  workflowDetail.value = null
  datasetPreviewRows.value = []
  datasetPreviewError.value = ''

  try {
    try {
      detail.value = await fetchCommunityResourceDetail(typeValue.value, resourceId.value)
    } catch (error) {
      if (!error?.isApiMissing) {
        // 社区详情失败时继续走类型详情降级
      }
    }

    if (isDataset.value) {
      datasetDetail.value = await fetchDatasetDetail(resourceId.value)
      detail.value = detail.value || datasetDetail.value
      await loadDatasetPreview()
    } else if (isModel.value) {
      modelDetail.value = await fetchModelDetail(resourceId.value)
      detail.value = detail.value || modelDetail.value
    } else if (isWorkflow.value) {
      workflowDetail.value = await fetchWorkflowDetail(resourceId.value)
      detail.value = detail.value || workflowDetail.value
    }

    if (!detail.value) {
      errorMessage.value = '未获取到资源详情数据'
    }
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      errorMessage.value = '无权限查看该资源详情'
    } else {
      errorMessage.value = error.message || '详情加载失败'
    }
  } finally {
    loading.value = false
  }
}

const resolveForkTargetId = (payload) => {
  return payload?.workflow_id || payload?.id || payload?.new_workflow_id || payload?.workflow?.id || null
}

const handleForkWorkflow = async () => {
  if (!canFork.value) {
    ElMessage.warning('请先登录后再 Fork 工作流')
    return
  }

  forkSubmitting.value = true
  try {
    const result = await forkWorkflow(resourceId.value)
    const targetId = resolveForkTargetId(result)
    ElMessage.success('Fork 工作流成功')
    if (targetId) {
      router.push(`/community/workflow/${targetId}`)
    }
  } catch (error) {
    if (error.isApiMissing) {
      forkApiMissing.value = true
      ElMessage.warning('TODO: 当前后端未提供 Fork 接口')
      return
    }
    ElMessage.error(error.message || 'Fork 工作流失败')
  } finally {
    forkSubmitting.value = false
  }
}

watch(
  () => [route.params.type, route.params.id],
  () => {
    loadDetail()
  }
)

onMounted(() => {
  loadDetail()
})
</script>

<style scoped>
.community-detail-page {
  width: 100%;
  min-height: 0;
  padding: 14px 0 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.detail-card {
  border-radius: 18px;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.detail-title {
  margin: 0;
  color: var(--zs-text);
  font-size: 24px;
  line-height: 1.32;
}

.detail-desc {
  margin: 12px 0 0;
  color: var(--zs-muted);
  line-height: 1.72;
}

.meta-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.meta-grid > div {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--zs-border);
  background: var(--zs-panel-soft);
  display: grid;
  gap: 4px;
}

.meta-key {
  color: var(--zs-muted);
  font-size: 12px;
}

.meta-value {
  color: var(--zs-text);
  font-size: 14px;
  line-height: 1.5;
}

.tags-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.section-block {
  margin-top: 14px;
  border: 1px solid var(--zs-border);
  border-radius: 14px;
  padding: 12px;
  background: var(--zs-panel-soft);
  display: grid;
  gap: 10px;
}

.section-block h3 {
  margin: 0;
  color: var(--zs-text);
  font-size: 15px;
}

.meta-grid.compact {
  margin-top: 0;
}

.action-row {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.preview-block {
  margin-top: 8px;
  border: 1px solid var(--zs-border);
  border-radius: 12px;
  background: var(--zs-panel);
  padding: 10px;
}

.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.preview-head h4 {
  margin: 0;
  font-size: 14px;
  color: var(--zs-text);
}

.preview-alert {
  margin-bottom: 10px;
}

@media (max-width: 800px) {
  .title-row {
    flex-direction: column;
  }
}
</style>
