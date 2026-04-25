<template>
  <div class="zs-page agent-workbench">
    <div class="zs-page-head">
      <div>
        <p class="zs-eyebrow">Agent workflow</p>
        <h2 class="zs-title">从自然语言到可复用模型</h2>
        <p class="zs-subtitle">
          上传 CSV，描述目标，系统会按任务解析、数据分析、模型规划、训练、代码生成和报告产出推进。
        </p>
      </div>
      <div class="head-actions">
        <el-switch
          v-model="runOffline"
          inline-prompt
          active-text="离线"
          inactive-text="LLM"
        />
        <el-button plain :loading="loadingTasks" @click="loadTasks">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <section class="workbench-grid">
      <el-card class="task-card" shadow="never">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">任务输入</div>
              <div class="card-subtitle">保持描述清楚，Agent 会自动结构化建模意图。</div>
            </div>
            <el-icon><EditPen /></el-icon>
          </div>
        </template>

        <el-form label-position="top">
          <el-form-item label="建模需求">
            <el-input
              v-model="taskDesc"
              type="textarea"
              :rows="5"
              maxlength="500"
              show-word-limit
              placeholder="例如：请根据这份客户数据预测 bought 字段，并生成可解释的分类模型。"
            />
          </el-form-item>

          <el-form-item label="CSV 数据集">
            <el-upload
              drag
              :show-file-list="false"
              :http-request="handleDatasetUpload"
              accept=".csv,text/csv"
            >
              <el-icon class="upload-icon"><UploadFilled /></el-icon>
              <div class="el-upload__text">
                {{ datasetName || '拖入 CSV 文件，或点击上传' }}
              </div>
              <template #tip>
                <div class="upload-tip">
                  {{ datasetId ? `已绑定数据集 #${datasetId}` : '上传成功后会自动读取数据预览。' }}
                </div>
              </template>
            </el-upload>
          </el-form-item>

          <div class="hitl-row">
            <el-checkbox v-model="enableHitl" :disabled="!canReview">
              {{ canReview ? '启用人工审核节点' : '零基础用户默认自动执行' }}
            </el-checkbox>
            <el-tooltip content="离线模式适合课堂演示和无 Key 环境；LLM 模式会调用真实模型。">
              <el-icon><InfoFilled /></el-icon>
            </el-tooltip>
          </div>

          <el-button
            type="primary"
            class="full-button"
            :loading="creating || running"
            @click="createAndRunTask"
          >
            <el-icon><VideoPlay /></el-icon>
            创建并启动 Agent
          </el-button>
        </el-form>
      </el-card>

      <el-card class="workflow-card" shadow="never">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">Agent 状态流</div>
              <div class="card-subtitle">{{ statusText }}</div>
            </div>
            <el-tag :type="statusTag" effect="plain">{{ lifecycleStatus }}</el-tag>
          </div>
        </template>

        <div class="stage-list">
          <div
            v-for="stage in stages"
            :key="stage.key"
            class="stage-item"
            :class="stage.status"
          >
            <div class="stage-icon">
              <el-icon><component :is="stage.icon" /></el-icon>
            </div>
            <div class="stage-copy">
              <div class="stage-title">{{ stage.title }}</div>
              <div class="stage-desc">{{ stage.desc }}</div>
            </div>
            <div class="stage-state">{{ stageLabelMap[stage.status] }}</div>
          </div>
        </div>
      </el-card>

      <el-card class="side-card" shadow="never">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">当前任务</div>
              <div class="card-subtitle">任务状态、审核和产物入口。</div>
            </div>
            <el-icon><Files /></el-icon>
          </div>
        </template>

        <div v-if="!currentTaskId" class="empty-state">
          <el-icon><DocumentAdd /></el-icon>
          <span>尚未创建任务</span>
        </div>
        <div v-else class="task-summary">
          <div class="summary-line">
            <span>任务 ID</span>
            <strong>{{ currentTaskId }}</strong>
          </div>
          <div class="summary-line">
            <span>数据集</span>
            <strong>{{ datasetId || '-' }}</strong>
          </div>
          <div class="summary-line">
            <span>审核节点</span>
            <strong>{{ pendingReview?.review_node || pendingReview?.node || '无' }}</strong>
          </div>

          <el-alert
            v-if="lifecycleStatus === 'WAITING_HUMAN'"
            type="warning"
            :closable="false"
            show-icon
            title="任务正在等待人工审核"
            class="review-alert"
          />

          <div class="button-stack">
            <el-button plain :disabled="!currentTaskId" @click="loadProgress">查看进度</el-button>
            <el-button plain :disabled="!currentTaskId" @click="loadPendingReview">获取审核内容</el-button>
            <el-button
              v-if="canReview"
              type="success"
              plain
              :disabled="!currentTaskId || lifecycleStatus !== 'WAITING_HUMAN'"
              :loading="reviewing"
              @click="approveAndResume"
            >
              通过并继续
            </el-button>
          </div>
        </div>
      </el-card>
    </section>

    <section class="detail-grid">
      <el-card shadow="never">
        <template #header>
          <div class="card-title">数据预览</div>
        </template>
        <el-table v-if="previewRows.length" :data="previewRows" height="260">
          <el-table-column
            v-for="column in previewColumns"
            :key="column"
            :prop="column"
            :label="column"
            min-width="120"
          />
        </el-table>
        <div v-else class="empty-state compact">
          <el-icon><Grid /></el-icon>
          <span>上传数据集后显示前几行样本</span>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="card-head">
            <div class="card-title">任务产物</div>
            <div class="artifact-actions">
              <el-button text :disabled="!currentTaskId" @click="loadReport">报告</el-button>
              <el-button text :disabled="!currentTaskId" @click="loadCode">代码</el-button>
            </div>
          </div>
        </template>
        <div class="artifact-box">
          <pre v-if="artifactText">{{ artifactText }}</pre>
          <div v-else class="empty-state compact">
            <el-icon><Document /></el-icon>
            <span>任务完成后可读取报告或代码</span>
          </div>
        </div>
      </el-card>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../store/user'
import {
  createAgentTask,
  fetchAgentCode,
  fetchAgentProgress,
  fetchAgentReport,
  fetchAgentTask,
  fetchAgentTasks,
  fetchDatasetPreview,
  fetchPendingReview,
  resumeAgentTask,
  runAgentTask,
  submitAgentReview,
  uploadAgentDataset
} from '../api/agent'

const taskDesc = ref('')
const userStore = useUserStore()
const datasetId = ref(null)
const datasetName = ref('')
const previewRows = ref([])
const currentTaskId = ref('')
const lifecycleStatus = ref('CREATED')
const currentStage = ref('')
const pendingReview = ref(null)
const artifactText = ref('')
const runOffline = ref(true)
const canReview = computed(() => ['ADMIN', 'DEVELOPER'].includes(userStore.role))
const enableHitl = ref(canReview.value)
const loadingTasks = ref(false)
const creating = ref(false)
const running = ref(false)
const reviewing = ref(false)
let pollTimer = null

const stageDefinitions = [
  { key: 'manager_parse', title: 'Manager', desc: '解析自然语言需求与目标字段', icon: 'Connection' },
  { key: 'data_analysis', title: 'Data Agent', desc: '分析数据质量、缺失值和字段类型', icon: 'DataAnalysis' },
  { key: 'model_plan', title: 'Model Agent', desc: '规划任务类型、模型与评估指标', icon: 'Aim' },
  { key: 'model_training', title: 'Training', desc: '训练轻量级分类或回归模型', icon: 'Cpu' },
  { key: 'code_generation', title: 'Operation', desc: '生成 Python 代码与预测接口', icon: 'Document' },
  { key: 'operation_report', title: 'Report', desc: '沉淀报告、代码和可下载产物', icon: 'TrendCharts' }
]

const stageLabelMap = {
  pending: '等待',
  running: '进行中',
  done: '完成',
  failed: '失败'
}

const statusTag = computed(() => {
  if (lifecycleStatus.value === 'COMPLETED') return 'success'
  if (lifecycleStatus.value === 'FAILED') return 'danger'
  if (lifecycleStatus.value === 'WAITING_HUMAN') return 'warning'
  return 'info'
})

const statusText = computed(() => {
  if (!currentTaskId.value) return '创建任务后会在这里显示真实阶段状态。'
  if (lifecycleStatus.value === 'WAITING_HUMAN') return '工作流已暂停，等待开发者确认后继续。'
  if (lifecycleStatus.value === 'COMPLETED') return '任务已完成，可以查看报告与代码。'
  return '工作流正在推进，页面会自动轮询状态。'
})

const previewColumns = computed(() => {
  const row = previewRows.value[0]
  return row ? Object.keys(row) : []
})

const stages = computed(() => {
  const currentIndex = stageDefinitions.findIndex((item) => item.key === currentStage.value)
  return stageDefinitions.map((item, index) => {
    let status = 'pending'
    if (lifecycleStatus.value === 'COMPLETED') status = 'done'
    else if (lifecycleStatus.value === 'FAILED' && index === currentIndex) status = 'failed'
    else if (currentIndex >= 0 && index < currentIndex) status = 'done'
    else if (currentIndex >= 0 && index === currentIndex) status = 'running'
    return { ...item, status }
  })
})

const normalizeDatasetId = (result) =>
  result?.dataset_id || result?.id || result?.dataset?.id || result?.data?.dataset_id

const normalizeRows = (preview) => {
  if (Array.isArray(preview)) return preview
  if (Array.isArray(preview?.rows)) return preview.rows
  if (Array.isArray(preview?.preview)) return preview.preview
  if (Array.isArray(preview?.preview_json)) return preview.preview_json
  return []
}

const normalizeTaskId = (task) => task?.task_id || task?.id || task?.task?.task_id || task?.task?.id

const syncTaskState = (task) => {
  if (!task) return
  currentTaskId.value = String(normalizeTaskId(task) || currentTaskId.value || '')
  lifecycleStatus.value = task.status || task.lifecycle_status || task.task_status || lifecycleStatus.value
  currentStage.value =
    task.current_stage ||
    task.stage ||
    task.current_node ||
    task.progress?.current_stage ||
    currentStage.value
}

const handleDatasetUpload = async ({ file, onSuccess, onError }) => {
  try {
    const isCsv =
      file.type === 'text/csv' ||
      file.name.toLowerCase().endsWith('.csv') ||
      file.type === 'application/vnd.ms-excel'
    const maxSize = 100 * 1024 * 1024
    if (!isCsv) {
      throw new Error('仅支持上传 CSV 文件')
    }
    if (file.size > maxSize) {
      throw new Error('CSV 文件不能超过 100MB')
    }
    const result = await uploadAgentDataset(file)
    datasetId.value = normalizeDatasetId(result)
    datasetName.value = file.name
    if (!datasetId.value) {
      throw new Error('上传成功，但响应中没有 dataset_id')
    }
    const preview = await fetchDatasetPreview(datasetId.value)
    previewRows.value = normalizeRows(preview).slice(0, 8)
    ElMessage.success('数据集上传成功')
    onSuccess?.(result)
  } catch (error) {
    ElMessage.error(error.message || '数据集上传失败')
    onError?.(error)
  }
}

const createAndRunTask = async () => {
  if (creating.value || running.value) {
    return
  }
  if (!taskDesc.value.trim()) {
    ElMessage.warning('请先填写建模需求')
    return
  }
  if (!datasetId.value) {
    ElMessage.warning('请先上传 CSV 数据集')
    return
  }
  if (taskDesc.value.trim().length < 3) {
    ElMessage.warning('建模需求至少需要 3 个字符')
    return
  }

  creating.value = true
  try {
    const task = await createAgentTask({
      dataset_id: Number(datasetId.value),
      task_description: taskDesc.value.trim(),
      hitl: enableHitl.value ? ['all'] : []
    })
    syncTaskState(task)
    ElMessage.success('Agent 任务已创建')
  } catch (error) {
    ElMessage.error(error.message || '任务创建失败')
    return
  } finally {
    creating.value = false
  }

  if (!currentTaskId.value) {
    ElMessage.error('任务创建成功，但未返回任务 ID')
    return
  }

  running.value = true
  try {
    const result = await runAgentTask(currentTaskId.value, { offline: runOffline.value })
    syncTaskState(result)
    startPolling()
  } catch (error) {
    ElMessage.error(error.message || '任务启动失败')
  } finally {
    running.value = false
  }
}

const loadTasks = async () => {
  loadingTasks.value = true
  try {
    const result = await fetchAgentTasks()
    const list = Array.isArray(result) ? result : result?.list || result?.items || []
    if (list.length) {
      syncTaskState(list[0])
    }
  } catch (error) {
    ElMessage.error(error.message || '任务列表加载失败')
  } finally {
    loadingTasks.value = false
  }
}

const loadProgress = async () => {
  if (!currentTaskId.value) return
  try {
    const progress = await fetchAgentProgress(currentTaskId.value)
    syncTaskState(progress)
  } catch (error) {
    ElMessage.error(error.message || '进度加载失败')
  }
}

const loadPendingReview = async () => {
  if (!currentTaskId.value) return
  try {
    pendingReview.value = await fetchPendingReview(currentTaskId.value)
    if (pendingReview.value) {
      lifecycleStatus.value = 'WAITING_HUMAN'
    }
  } catch (error) {
    ElMessage.error(error.message || '待审核内容加载失败')
  }
}

const approveAndResume = async () => {
  if (!currentTaskId.value) return
  if (lifecycleStatus.value !== 'WAITING_HUMAN') {
    ElMessage.warning('当前任务没有处于待审核状态')
    return
  }
  reviewing.value = true
  try {
    await submitAgentReview(currentTaskId.value, {
      action: 'approve',
      comment: '前端工作台确认通过',
      auto_resume: false,
      offline: runOffline.value
    })
    const result = await resumeAgentTask(currentTaskId.value, { offline: runOffline.value })
    syncTaskState(result)
    pendingReview.value = null
    startPolling()
    ElMessage.success('已通过审核并恢复执行')
  } catch (error) {
    ElMessage.error(error.message || '审核提交失败')
  } finally {
    reviewing.value = false
  }
}

const loadReport = async () => {
  if (!currentTaskId.value) return
  try {
    const report = await fetchAgentReport(currentTaskId.value)
    artifactText.value = typeof report === 'string' ? report : JSON.stringify(report, null, 2)
  } catch (error) {
    ElMessage.error(error.message || '报告加载失败')
  }
}

const loadCode = async () => {
  if (!currentTaskId.value) return
  try {
    const code = await fetchAgentCode(currentTaskId.value)
    artifactText.value = typeof code === 'string' ? code : code?.code || JSON.stringify(code, null, 2)
  } catch (error) {
    ElMessage.error(error.message || '代码加载失败')
  }
}

const startPolling = () => {
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!currentTaskId.value || ['COMPLETED', 'FAILED', 'CANCELLED', 'WAITING_HUMAN'].includes(lifecycleStatus.value)) {
      clearInterval(pollTimer)
      return
    }
    await loadProgress()
  }, 2500)
}

onMounted(() => {
  loadTasks()
})

onBeforeUnmount(() => {
  clearInterval(pollTimer)
})
</script>

<style scoped>
.agent-workbench {
  gap: 18px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.workbench-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) minmax(360px, 1.35fr) minmax(260px, 0.8fr);
  gap: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  color: var(--zs-text);
  font-size: 15px;
  font-weight: 680;
}

.card-subtitle {
  margin-top: 4px;
  color: var(--zs-muted);
  font-size: 12px;
  line-height: 1.5;
}

.upload-icon {
  color: var(--zs-muted);
  font-size: 28px;
}

.upload-tip {
  color: var(--zs-muted);
  font-size: 12px;
}

.hitl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 16px;
  color: var(--zs-muted);
}

.full-button {
  width: 100%;
}

.stage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stage-item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 58px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--zs-border);
  border-radius: var(--zs-radius);
  background: var(--zs-surface-soft);
}

.stage-item.done {
  border-color: rgba(21, 128, 61, 0.22);
  background: rgba(21, 128, 61, 0.045);
}

.stage-item.running {
  border-color: rgba(15, 118, 110, 0.32);
  background: var(--zs-accent-weak);
}

.stage-item.failed {
  border-color: rgba(185, 28, 28, 0.26);
  background: rgba(185, 28, 28, 0.045);
}

.stage-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--zs-text);
  background: var(--zs-surface);
  border: 1px solid var(--zs-border);
}

.stage-title {
  color: var(--zs-text);
  font-weight: 650;
}

.stage-desc {
  margin-top: 3px;
  color: var(--zs-muted);
  font-size: 12px;
  line-height: 1.45;
}

.stage-state {
  color: var(--zs-muted);
  font-size: 12px;
  text-align: right;
}

.empty-state {
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--zs-muted);
  text-align: center;
}

.empty-state :deep(.el-icon) {
  font-size: 24px;
}

.empty-state.compact {
  min-height: 180px;
}

.task-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--zs-muted);
  font-size: 13px;
}

.summary-line strong {
  color: var(--zs-text);
  font-weight: 650;
}

.review-alert {
  margin: 4px 0;
}

.button-stack {
  display: grid;
  gap: 9px;
}

.artifact-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.artifact-box {
  min-height: 260px;
}

.artifact-box pre {
  height: 260px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  border-radius: var(--zs-radius);
  background: var(--zs-code);
  color: #f5f5f4;
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .workbench-grid {
    grid-template-columns: 1fr 1fr;
  }

  .side-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .workbench-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
