<template>
  <div class="community-detail-page" v-loading="loading">
    <div class="detail-head">
      <el-button plain @click="router.back()">
        <el-icon><ArrowLeft /></el-icon> 返回上一页
      </el-button>
      <el-tag effect="dark">{{ typeLabel }}</el-tag>
    </div>

    <el-alert v-if="errorMessage" type="error" :closable="false" :title="errorMessage" class="error-alert" />

    <el-card v-if="detail" class="detail-card" shadow="never">
      <div class="title-row">
        <h1 class="detail-title">{{ titleText }}</h1>
        <el-tag :type="statusTag" effect="light">{{ statusLabel }}</el-tag>
      </div>

      <p class="detail-desc">{{ descriptionText }}</p>

      <div class="meta-grid">
        <div><span class="meta-key">创建者</span><span class="meta-value">{{ creatorText }}</span></div>
        <div><span class="meta-key">创建时间</span><span class="meta-value">{{ createdAtText }}</span></div>
        <div><span class="meta-key">分类</span><span class="meta-value">{{ categoryText }}</span></div>
      </div>

      <div class="tags-row" v-if="tags.length">
        <el-tag v-for="tag in tags" :key="tag" effect="plain" round>{{ tag }}</el-tag>
      </div>

      <section v-if="isDataset" class="section-block">
        <h3><el-icon><DataLine /></el-icon> 数据集信息</h3>
        <div class="meta-grid compact">
          <div><span class="meta-key">文件大小</span><span class="meta-value">{{ fileSizeText }}</span></div>
          <div><span class="meta-key">样本行数</span><span class="meta-value">{{ rowCountText }}</span></div>
          <div><span class="meta-key">浏览量</span><span class="meta-value">{{ countText(datasetDetail?.view_count) }}</span></div>
          <div><span class="meta-key">公开状态</span><span class="meta-value">{{ datasetDetail?.is_public ? '公开' : '私有' }}</span></div>
        </div>

        <div class="preview-block">
          <div class="preview-head">
            <h4>数据样例预览</h4>
            <el-button size="small" type="primary" plain :loading="datasetPreviewLoading" @click="loadDatasetPreview">
              <el-icon><Refresh /></el-icon> 刷新预览
            </el-button>
          </div>
          <el-alert
            v-if="datasetPreviewError"
            type="warning"
            :closable="false"
            :title="datasetPreviewError"
            class="preview-alert"
          />
          <el-table v-else-if="datasetPreviewRows.length" :data="datasetPreviewRows" border max-height="360" stripe>
            <el-table-column
              v-for="column in datasetPreviewColumns"
              :key="column"
              :prop="column"
              :label="column"
              min-width="140"
              show-overflow-tooltip
            />
          </el-table>
          <el-empty v-else description="暂无可预览的数据样例" :image-size="80" />
        </div>
      </section>

      <section v-if="isModel" class="section-block">
        <h3><el-icon><Cpu /></el-icon> 模型信息</h3>
        <div class="meta-grid compact">
          <div><span class="meta-key">推荐状态</span><span class="meta-value">{{ modelDetail?.is_recommended ? '强烈推荐' : '普通' }}</span></div>
          <div><span class="meta-key">浏览量</span><span class="meta-value">{{ countText(modelDetail?.view_count) }}</span></div>
          <div><span class="meta-key">公开状态</span><span class="meta-value">{{ modelDetail?.is_public ? '公开' : '私有' }}</span></div>
        </div>
      </section>

      <section v-if="isWorkflow" class="section-block">
        <h3><el-icon><Connection /></el-icon> 工作流摘要</h3>
        <div class="meta-grid compact">
          <div><span class="meta-key">节点数量</span><span class="meta-value">{{ workflowNodeCount }}</span></div>
          <div><span class="meta-key">适用任务类型</span><span class="meta-value">{{ workflowTaskTypeText }}</span></div>
          <div>
            <span class="meta-key">Fork 来源 ID</span>
            <span class="meta-value">
              <el-link v-if="workflowSourceId" type="primary" @click="goToWorkflow(workflowSourceId)">
                {{ workflowSourceId }}
              </el-link>
              <span v-else>-</span>
            </span>
          </div>
          <div><span class="meta-key">审核状态</span><span class="meta-value">{{ workflowAuditText }}</span></div>
        </div>

        <div class="preview-block" v-if="workflowCode || workflowSpecJsonText">
          <div class="preview-head">
            <h4>底层代码与结构预览</h4>
            <el-button 
              size="small" 
              type="success" 
              plain 
              @click="copyToClipboard(workflowPreviewTab === 'code' ? workflowCode : workflowSpecJsonText)"
            >
              <el-icon><DocumentCopy /></el-icon> 一键复制
            </el-button>
          </div>
          
          <el-tabs v-model="workflowPreviewTab" class="code-tabs">
            <el-tab-pane label="💻 Agent 生成代码 (Python)" name="code" v-if="workflowCode">
              <div class="mac-window">
                <div class="mac-header"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
                <pre class="code-preview-box"><code>{{ workflowCode }}</code></pre>
              </div>
            </el-tab-pane>
            <el-tab-pane label="⚙️ 工作流规范 (JSON)" name="spec" v-if="workflowSpecJsonText">
              <div class="mac-window">
                <div class="mac-header"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span></div>
                <pre class="code-preview-box"><code>{{ workflowSpecJsonText }}</code></pre>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </section>

      <div class="action-row">
        <el-button v-if="isDataset && datasetDetail?.file_url" @click="openExternal(datasetDetail.file_url)">
          <el-icon><View /></el-icon> 浏览器预览
        </el-button>
        <el-button v-if="isDataset && datasetDetail?.file_url" type="primary" @click="downloadDatasetFile">
          <el-icon><Download /></el-icon> 下载数据集
        </el-button>
        <el-tooltip v-if="isDataset && !datasetDetail?.file_url" content="当前资源未返回物理文件地址" placement="top">
          <el-button disabled>暂无下载地址</el-button>
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
          <el-icon><CopyDocument /></el-icon> Fork 到我的工作台
        </el-button>
        <el-tooltip v-if="isWorkflow && forkApiMissing" content="当前后端未提供此工作流的 Fork 接口" placement="top">
          <el-tag type="info">不可 Fork</el-tag>
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
// 确保这些图标已经在项目中全局引入了，如果没有引，可以去掉模板里的 <el-icon> 标签
import { ArrowLeft, Refresh, DocumentCopy, Download, View, DataLine, Cpu, Connection, CopyDocument } from '@element-plus/icons-vue'

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
const workflowPreviewTab = ref('code') // 默认优先展示代码

// [保留你原本的所有计算属性和格式化函数，一字未改...]
const normalizeType = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (['DATASET', 'DATASETS'].includes(raw)) return 'DATASET'
  if (['MODEL', 'MODELS'].includes(raw)) return 'MODEL'
  if (['WORKFLOW', 'WORKFLOWS'].includes(raw)) return 'WORKFLOW'
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
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  const text = String(value || '').trim()
  return text ? text.split(',').map((item) => item.trim()).filter(Boolean) : []
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

const titleText = computed(() => detail.value?.title || detail.value?.name || workflowDetail.value?.title || datasetDetail.value?.name || modelDetail.value?.name || '未命名内容')
const descriptionText = computed(() => detail.value?.description || workflowDetail.value?.description || datasetDetail.value?.description || modelDetail.value?.description || '暂无简介')

const creatorText = computed(() => {
  return detail.value?.creator || detail.value?.username || workflowDetail.value?.creator || datasetDetail.value?.creator || modelDetail.value?.creator || '-'
})

const createdAtText = computed(() => formatTime(detail.value?.created_at || datasetDetail.value?.created_at || modelDetail.value?.created_at || workflowDetail.value?.created_at))
const categoryText = computed(() => detail.value?.category || datasetDetail.value?.category || modelDetail.value?.category || workflowDetail.value?.category || '-')
const tags = computed(() => toTags(detail.value?.tags || datasetDetail.value?.tags || modelDetail.value?.tags || workflowDetail.value?.tags))

const statusValue = computed(() => normalizeStatus(detail.value?.audit_status ?? detail.value?.status ?? workflowDetail.value?.audit_status ?? datasetDetail.value?.status ?? modelDetail.value?.status))

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
  try { return JSON.parse(value) } catch { return null }
}

const workflowSpec = computed(() => parseWorkflowSpec(workflowDetail.value?.workflow_spec_json))

const workflowNodeCount = computed(() => {
  if (Array.isArray(workflowSpec.value?.nodes)) return workflowSpec.value.nodes.length
  if (Array.isArray(workflowSpec.value?.steps)) return workflowSpec.value.steps.length
  return '-'
})

const workflowTaskTypeText = computed(() => workflowDetail.value?.applicable_task_types || workflowDetail.value?.task_type || '-')
const workflowSourceId = computed(() => workflowDetail.value?.source_workflow_id || workflowDetail.value?.fork_from_workflow_id || null)

const goToWorkflow = (id) => {
  router.push(`/community/workflow/${id}`)
}

const workflowCode = computed(() => workflowDetail.value?.code || workflowDetail.value?.python_code || '')
const workflowSpecJsonText = computed(() => {
  const spec = workflowDetail.value?.workflow_spec_json
  if (!spec) return ''
  return typeof spec === 'string' ? spec : JSON.stringify(spec, null, 2)
})

const workflowAuditText = computed(() => normalizeStatus(workflowDetail.value?.audit_status || workflowDetail.value?.status))

const countText = (value) => {
  const num = Number(value)
  return Number.isNaN(num) ? '-' : num.toLocaleString()
}

const openExternal = (url) => {
  const target = String(url || '').trim()
  if (target) window.open(target, '_blank', 'noopener,noreferrer')
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
  link.download = ''
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// === 新增：一键复制代码到剪贴板 ===
const copyToClipboard = async (text) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('复制成功！可以直接粘贴了。')
  } catch (err) {
    // 降级兼容老浏览器
    const input = document.createElement('textarea')
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success('复制成功！可以直接粘贴了。')
  }
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
    if (!datasetPreviewRows.value.length) datasetPreviewError.value = '当前接口未返回可展示的预览数据'
  } catch (error) {
    const status = Number(error?.status || 0)
    if (status === 401 || status === 403) {
      datasetPreviewError.value = '数据预览需登录授权'
    } else {
      datasetPreviewError.value = error.message || '数据预览加载失败'
    }
  } finally {
    datasetPreviewLoading.value = false
  }
}

const loadDetail = async () => {
  if (!resourceId.value) { errorMessage.value = '无效的资源 ID'; return }
  loading.value = true
  errorMessage.value = ''
  try {
    try {
      detail.value = await fetchCommunityResourceDetail(typeValue.value, resourceId.value)
    } catch (e) { /* fallback */ }

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
      if (workflowCode.value) workflowPreviewTab.value = 'code'
      else if (workflowSpecJsonText.value) workflowPreviewTab.value = 'spec'
    }
  } catch (error) {
    errorMessage.value = [401, 403].includes(error.status) ? '无权限查看该资源详情' : (error.message || '详情加载失败')
  } finally {
    loading.value = false
  }
}

const resolveForkTargetId = (payload) => payload?.workflow_id || payload?.id || payload?.new_workflow_id || null

const handleForkWorkflow = async () => {
  if (!canFork.value) {
    ElMessage.warning('请先登录后再 Fork 工作流')
    return
  }

  forkSubmitting.value = true
  try {
    const result = await forkWorkflow(resourceId.value)
    const targetId = resolveForkTargetId(result)
    
    // === 核心修改：Fork 出的工作流是私有的，必须跳转到个人中心，而非社区！===
    ElMessage({
      message: '🎉 Fork 成功！新工作流已保存至您的个人中心。',
      type: 'success',
      duration: 3000
    })
    
    // 如果你的个人中心路由不叫 /user，请把这里改成对应的路由名称（如 /user-center）
    router.push('/user') 
    
  } catch (error) {
    if (error.isApiMissing) {
      forkApiMissing.value = true
      ElMessage.warning('当前后端未提供 Fork 接口')
    } else {
      ElMessage.error(error.message || 'Fork 工作流失败')
    }
  } finally {
    forkSubmitting.value = false
  }
}

watch(() => [route.params.type, route.params.id], () => loadDetail())
onMounted(() => loadDetail())
</script>

<style scoped>
.community-detail-page {
  width: 100%;
  min-height: 0;
  padding: 14px 0 20px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-alert {
  margin-bottom: 10px;
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
  font-weight: bold;
}

.detail-desc {
  margin: 12px 0 0;
  color: var(--zs-muted);
  line-height: 1.72;
  background: var(--zs-panel-soft);
  padding: 14px;
  border-radius: 12px;
}

.meta-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.meta-grid > div {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid var(--zs-border);
  background: var(--zs-panel-soft);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-key {
  color: var(--zs-muted);
  font-size: 13px;
}

.meta-value {
  color: var(--zs-text);
  font-size: 15px;
  font-weight: 500;
}

.tags-row {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.section-block {
  margin-top: 24px;
  border: 1px solid var(--zs-border);
  border-radius: 16px;
  padding: 20px;
  background: var(--zs-panel-soft);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-block h3 {
  margin: 0;
  color: var(--zs-text);
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-row {
  margin-top: 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--zs-border);
}

/* 预览区域美化 */
.preview-block {
  margin-top: 8px;
  border: 1px solid var(--zs-border);
  border-radius: 14px;
  background: var(--zs-panel);
  padding: 16px;
}

.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-head h4 {
  margin: 0;
  font-size: 15px;
  color: var(--zs-text);
  font-weight: bold;
}

.code-tabs :deep(.el-tabs__item) {
  font-size: 14px;
}

/* Mac 风格代码框 */
.mac-window {
  margin-top: 10px;
  background: #1e1e1e;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.mac-header {
  height: 32px;
  background: #2d2d2d;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
}

.mac-header .dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red { background: #ff5f56; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #27c93f; }

.code-preview-box {
  margin: 0;
  padding: 16px;
  color: #a9b7c6;
  font-family: 'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
  overflow: auto;
  max-height: 500px;
}

.code-preview-box::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.code-preview-box::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 4px;
}

.code-preview-box::-webkit-scrollbar-track {
  background: #1e1e1e;
}

@media (max-width: 800px) {
  .title-row { flex-direction: column; }
  .meta-grid { grid-template-columns: 1fr; }
}
</style>