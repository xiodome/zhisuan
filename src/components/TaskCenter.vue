<template>
  <div class="agent-console">
    <aside class="task-rail">
      <button class="new-task-button" title="创建任务" @click="openCreateDialog">
        <span></span>
        <span></span>
      </button>

      <div class="rail-label">最近任务</div>
      <div class="task-list">
        <button
          v-for="task in taskList"
          :key="task.task_id"
          class="task-item"
          :class="{ active: task.task_id === currentTaskId }"
          @click="selectTask(task.task_id)"
        >
          <span class="task-title">{{ task.task_description || task.task_id }}</span>
          <span class="task-meta">
            <span :class="['status-dot', task.status]"></span>
            {{ task.status }}
          </span>
        </button>
        <div v-if="!taskList.length" class="rail-empty">暂无任务</div>
      </div>
    </aside>

    <main class="agent-main">
      <section v-if="!currentTaskId" class="empty-start">
        <h2>创建任务以开始使用</h2>
        <p>上传 CSV，描述目标列和建模需求，Agent 会生成工作流、报告和预测接口。</p>
      </section>

      <template v-else>
        <section class="hero-line">
          <div>
            <p class="zs-eyebrow">AI4ML Agent</p>
            <h2 class="zs-title">{{ currentTask?.task_description || '任务详情' }}</h2>
            <p class="zs-subtitle">查看当前任务状态，运行工作流，并在需要 HITL 的节点完成审核。</p>
          </div>
          <div class="run-mode">
            <span>Mode</span>
            <el-switch v-model="runOffline" inline-prompt active-text="离线" inactive-text="LLM" />
          </div>
        </section>

        <section class="status-strip">
          <div class="status-card">
            <span>当前任务</span>
            <strong>{{ currentTaskId }}</strong>
          </div>
          <div class="status-card">
            <span>状态</span>
            <strong>{{ lifecycleStatus }}</strong>
          </div>
          <div class="status-card">
            <span>目标列</span>
            <strong>{{ currentTask?.target_column || '-' }}</strong>
          </div>
          <div class="status-card">
            <span>任务类型</span>
            <strong>{{ currentTask?.task_type || '-' }}</strong>
          </div>
        </section>

        <section class="task-card">
          <div class="panel-head">
            <div>
              <div class="panel-title">任务描述</div>
              <div class="panel-subtitle">{{ currentTask?.task_description || '暂无描述' }}</div>
            </div>
            <div class="panel-actions">
              <el-button plain :disabled="!datasetId" @click="openPreviewDialog">
                <el-icon><Grid /></el-icon>
                预览数据
              </el-button>
              <el-button
                type="primary"
                :disabled="!canRunTask"
                :loading="running"
                @click="runSelectedTask"
              >
                <el-icon><VideoPlay /></el-icon>
                {{ runButtonText }}
              </el-button>
            </div>
          </div>
        </section>

        <section class="workflow-panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">工作执行情况</div>
              <div class="panel-subtitle">{{ statusText }}</div>
            </div>
            <el-button plain :disabled="!currentTaskId" :loading="loadingProgress" @click="loadProgress">
              <el-icon :class="{ spinning: loadingProgress }"><Refresh /></el-icon>
              刷新进度
            </el-button>
          </div>

          <div class="stage-list">
            <div v-for="stage in stages" :key="stage.key" class="stage-item" :class="stage.status">
              <div class="stage-icon">
                <el-icon><component :is="stage.icon" /></el-icon>
              </div>
              <div>
                <div class="stage-title">{{ stage.title }}</div>
                <div class="stage-desc">{{ stage.desc }}</div>
              </div>
              <div class="stage-tail">
                <el-button
                  v-if="stage.canReview"
                  size="small"
                  type="warning"
                  plain
                  :disabled="!canReview"
                  @click="openReviewDialog"
                >
                  审核
                </el-button>
                <span v-else class="stage-state">{{ stageLabelMap[stage.status] }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="inspector-card">
          <div class="panel-head compact">
            <div>
              <div class="panel-title">预测接口</div>
              <div class="panel-subtitle">任务完成后输入一条样本并调用 `/predict`。</div>
            </div>
          </div>

          <el-input
            v-model="predictionText"
            type="textarea"
            :rows="8"
            resize="none"
            placeholder='{"age": 30, "income": 6500, "city": "A"}'
          />

          <div class="predict-actions">
            <el-button plain :disabled="!currentReport && !previewRows.length" @click="fillPredictionSample">填入样例</el-button>
            <el-button
              type="primary"
              :disabled="lifecycleStatus !== 'COMPLETED'"
              :loading="predicting"
              @click="runPrediction"
            >
              <el-icon><Position /></el-icon>
              预测
            </el-button>
          </div>

          <pre v-if="predictionResult" class="result-box">{{ predictionResult }}</pre>
        </section>

        <section class="inspector-card">
          <div class="panel-head compact">
            <div>
              <div class="panel-title">任务产物</div>
              <div class="panel-subtitle">报告、代码和任务产物。</div>
            </div>
          </div>

          <div class="artifact-actions">
            <el-button plain :disabled="!currentTaskId" @click="loadReport">报告</el-button>
            <el-button plain :disabled="!currentTaskId || !canReview" @click="loadCode">代码</el-button>
          </div>
          <pre class="artifact-box">{{ artifactText || '任务完成后查看产物。' }}</pre>
        </section>
      </template>
    </main>

    <el-dialog v-model="createDialogVisible" title="创建任务" width="680px" class="agent-dialog">
      <el-form label-position="top">
        <el-form-item label="建模需求">
          <el-input
            v-model="draftTaskDesc"
            type="textarea"
            :rows="5"
            maxlength="500"
            resize="none"
            show-word-limit
            placeholder="例如：根据客户年龄、收入和城市预测 bought 字段。"
          />
        </el-form-item>

        <el-form-item label="CSV 数据">
          <div class="upload-row">
            <el-upload :show-file-list="false" :http-request="handleDatasetUpload" accept=".csv,text/csv">
              <el-button plain>
                <el-icon><Paperclip /></el-icon>
                {{ draftDatasetName || '上传 CSV' }}
              </el-button>
            </el-upload>
            <el-button plain :disabled="!draftDatasetId" @click="openPreviewDialog">
              <el-icon><Grid /></el-icon>
              预览
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="HITL 节点">
          <el-checkbox-group v-model="selectedHitlStages" :disabled="!canReview">
            <el-checkbox v-for="item in hitlOptions" :key="item.value" :label="item.value">
              {{ item.label }}
            </el-checkbox>
          </el-checkbox-group>
          <div class="form-hint">{{ canReview ? '勾选的节点会暂停等待人工审核。' : '零基础用户默认自动执行，不进入人工审核。' }}</div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button plain @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createTaskOnly">创建任务</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewDialogVisible" title="数据预览" width="860px" class="agent-dialog">
      <el-table v-if="previewRows.length" :data="previewRows" height="360">
        <el-table-column
          v-for="column in previewColumns"
          :key="column"
          :prop="column"
          :label="column"
          min-width="120"
        />
      </el-table>
      <div v-else class="modal-empty">暂无数据预览</div>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" title="HITL 审核" width="760px" class="agent-dialog">
      <div v-if="pendingReview" class="review-body">
        <div class="review-meta">
          <div>
            <span>审核节点</span>
            <strong>{{ reviewStageLabel }}</strong>
          </div>
          <div>
            <span>当前版本</span>
            <strong>{{ pendingReview.version || '-' }}</strong>
          </div>
        </div>
        <pre class="review-payload">{{ formattedReview }}</pre>

        <el-form label-position="top">
          <el-form-item label="动作">
            <el-segmented v-model="reviewAction" :options="reviewActionOptions" />
          </el-form-item>
          <el-form-item v-if="reviewAction === 'edit_and_continue'" label="补丁 JSON">
            <el-input
              v-model="patchText"
              type="textarea"
              :rows="5"
              placeholder='例如：{"target_column":"bought","model_type":"random_forest"}'
            />
          </el-form-item>
          <el-form-item label="审核意见">
            <el-input v-model="reviewComment" type="textarea" :rows="3" placeholder="记录本次人工判断。" />
          </el-form-item>
        </el-form>
      </div>
      <div v-else class="modal-empty">当前没有待审核内容</div>

      <template #footer>
        <el-button plain @click="reviewDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!pendingReview || !canReview"
          :loading="reviewing"
          @click="submitReviewAndResume"
        >
          提交并继续
        </el-button>
      </template>
    </el-dialog>
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
  predictAgentTask,
  resumeAgentTask,
  runAgentTask,
  submitAgentReview,
  uploadAgentDataset
} from '../api/agent'

const userStore = useUserStore()
const taskList = ref([])
const currentTask = ref(null)
const currentTaskId = ref('')
const datasetId = ref(null)
const previewRows = ref([])
const lifecycleStatus = ref('CREATED')
const currentStage = ref('')
const artifactText = ref('')
const predictionText = ref('')
const predictionResult = ref('')
const currentReport = ref(null)
const runOffline = ref(true)
const loadingTasks = ref(false)
const loadingProgress = ref(false)
const creating = ref(false)
const running = ref(false)
const reviewing = ref(false)
const predicting = ref(false)
const createDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const reviewDialogVisible = ref(false)
const draftTaskDesc = ref('')
const draftDatasetId = ref(null)
const draftDatasetName = ref('')
const selectedHitlStages = ref([])
const pendingReview = ref(null)
const reviewAction = ref('approve')
const reviewComment = ref('')
const patchText = ref('')
let runPollTimer = null
let listRefreshTimer = null

const canReview = computed(() => ['ADMIN', 'DEVELOPER'].includes(userStore.role))
const hitlOptions = [
  { value: 'parse_review', label: '需求解析后' },
  { value: 'feature_review', label: '数据分析后' },
  { value: 'model_plan_review', label: '模型规划后' },
  { value: 'code_review', label: '代码生成后' }
]
const reviewActionOptions = [
  { label: '通过', value: 'approve' },
  { label: '编辑后继续', value: 'edit_and_continue' },
  { label: '驳回', value: 'reject' }
]
const stageDefinitions = [
  { key: 'manager_parse', review: 'parse_review', title: 'Manager', desc: '解析自然语言需求与目标字段', icon: 'Connection' },
  { key: 'data_analysis', review: 'feature_review', title: 'Data Agent', desc: '检查数据质量、列类型和缺失值', icon: 'DataAnalysis' },
  { key: 'model_plan', review: 'model_plan_review', title: 'Model Agent', desc: '规划模型、指标和训练策略', icon: 'Aim' },
  { key: 'model_training', review: null, title: 'Training', desc: '训练轻量模型并计算指标', icon: 'Cpu' },
  { key: 'code_generation', review: 'code_review', title: 'Operation', desc: '生成代码和预测接口', icon: 'Document' },
  { key: 'operation_report', review: null, title: 'Report', desc: '输出报告、代码和可复用产物', icon: 'TrendCharts' }
]
const stageLabelMap = {
  pending: '等待',
  running: '进行中',
  done: '完成',
  failed: '失败',
  review: '待审核'
}
const reviewStageTitleMap = Object.fromEntries(hitlOptions.map((item) => [item.value, item.label]))

const statusText = computed(() => {
  if (lifecycleStatus.value === 'WAITING_HUMAN') return '工作流已暂停，请在对应节点完成 HITL 审核。'
  if (lifecycleStatus.value === 'COMPLETED') return '任务已完成，可以查看产物并调用预测接口。'
  if (lifecycleStatus.value === 'FAILED') return '任务失败，请查看状态和后端日志。'
  if (lifecycleStatus.value === 'CREATED') return '任务已创建，点击运行开始工作流。'
  return '工作流正在运行。'
})
const previewColumns = computed(() => {
  const row = previewRows.value[0]
  return row ? Object.keys(row) : []
})
const canRunTask = computed(() => ['CREATED', 'READY_TO_RESUME'].includes(lifecycleStatus.value))
const runButtonText = computed(() => (lifecycleStatus.value === 'READY_TO_RESUME' ? '继续运行' : '运行'))
const formattedReview = computed(() => JSON.stringify(pendingReview.value?.payload || pendingReview.value, null, 2))
const reviewStageLabel = computed(() => reviewStageTitleMap[pendingReview.value?.review_stage] || pendingReview.value?.review_stage || '-')

const stages = computed(() => {
  const reviewStage = lifecycleStatus.value === 'WAITING_HUMAN' ? currentStage.value : ''
  const activeNode = reviewStage
    ? stageDefinitions.find((item) => item.review === reviewStage)?.key
    : currentStage.value
  const currentIndex = stageDefinitions.findIndex((item) => item.key === activeNode)
  return stageDefinitions.map((item, index) => {
    let status = 'pending'
    if (lifecycleStatus.value === 'COMPLETED') status = 'done'
    else if (lifecycleStatus.value === 'FAILED' && index === currentIndex) status = 'failed'
    else if (reviewStage && item.review === reviewStage) status = 'review'
    else if (currentIndex >= 0 && index < currentIndex) status = 'done'
    else if (currentIndex >= 0 && index === currentIndex) status = 'running'
    return { ...item, status, canReview: status === 'review' }
  })
})

const minSpin = (startedAt) => {
  const elapsed = Date.now() - startedAt
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, 850 - elapsed)))
}
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
  currentTask.value = task
  currentTaskId.value = String(normalizeTaskId(task) || currentTaskId.value || '')
  datasetId.value = task.dataset_id || datasetId.value
  lifecycleStatus.value = task.status || task.lifecycle_status || task.task_status || lifecycleStatus.value
  currentStage.value = task.current_stage || task.stage || task.current_node || task.progress?.current_stage || currentStage.value
}

const openCreateDialog = () => {
  draftTaskDesc.value = ''
  draftDatasetId.value = null
  draftDatasetName.value = ''
  previewRows.value = []
  selectedHitlStages.value = canReview.value ? [] : []
  createDialogVisible.value = true
}

const openPreviewDialog = async () => {
  const id = draftDatasetId.value || datasetId.value
  if (!id) return ElMessage.warning('请先上传或选择数据集')
  try {
    const preview = await fetchDatasetPreview(id)
    previewRows.value = normalizeRows(preview).slice(0, 20)
    previewDialogVisible.value = true
  } catch (error) {
    ElMessage.error(error.message || '数据预览加载失败')
  }
}

const handleDatasetUpload = async ({ file, onSuccess, onError }) => {
  try {
    const isCsv =
      file.type === 'text/csv' ||
      file.name.toLowerCase().endsWith('.csv') ||
      file.type === 'application/vnd.ms-excel'
    if (!isCsv) throw new Error('仅支持上传 CSV 文件')
    if (file.size > 100 * 1024 * 1024) throw new Error('CSV 文件不能超过 100MB')
    const result = await uploadAgentDataset(file)
    draftDatasetId.value = normalizeDatasetId(result)
    draftDatasetName.value = file.name
    if (!draftDatasetId.value) throw new Error('上传成功，但响应中没有 dataset_id')
    const preview = await fetchDatasetPreview(draftDatasetId.value)
    previewRows.value = normalizeRows(preview).slice(0, 20)
    ElMessage.success('数据集上传成功')
    onSuccess?.(result)
  } catch (error) {
    ElMessage.error(error.message || '数据集上传失败')
    onError?.(error)
  }
}

const createTaskOnly = async () => {
  if (creating.value) return
  if (!draftTaskDesc.value.trim()) return ElMessage.warning('请先填写建模需求')
  if (draftTaskDesc.value.trim().length < 3) return ElMessage.warning('建模需求至少需要 3 个字符')
  if (!draftDatasetId.value) return ElMessage.warning('请先上传 CSV 数据集')
  creating.value = true
  try {
    const task = await createAgentTask({
      dataset_id: Number(draftDatasetId.value),
      task_description: draftTaskDesc.value.trim(),
      hitl: canReview.value ? selectedHitlStages.value : []
    })
    syncTaskState(task)
    datasetId.value = draftDatasetId.value
    createDialogVisible.value = false
    artifactText.value = ''
    predictionText.value = ''
    predictionResult.value = ''
    currentReport.value = null
    await loadTasks(false, true)
    ElMessage.success('任务已创建')
  } catch (error) {
    ElMessage.error(error.message || '任务创建失败')
  } finally {
    creating.value = false
  }
}

const runSelectedTask = async () => {
  if (!currentTaskId.value || running.value) return
  running.value = true
  artifactText.value = ''
  predictionResult.value = ''
  currentReport.value = null
  try {
    const result =
      lifecycleStatus.value === 'READY_TO_RESUME'
        ? await resumeAgentTask(currentTaskId.value, { offline: runOffline.value })
        : await runAgentTask(currentTaskId.value, { offline: runOffline.value })
    syncTaskState(result)
    await loadTasks(false, true)
    if (result?.status === 'COMPLETED') await loadReport()
    startRunPolling()
  } catch (error) {
    ElMessage.error(error.message || '任务启动失败')
  } finally {
    running.value = false
  }
}

const loadTasks = async (selectLatest = false, silent = false) => {
  if (loadingTasks.value) return
  const startedAt = Date.now()
  loadingTasks.value = true
  try {
    const result = await fetchAgentTasks()
    const list = Array.isArray(result) ? result : result?.list || result?.items || []
    taskList.value = list
      .map((task) => ({ ...task, task_id: String(normalizeTaskId(task) || '') }))
      .filter((task) => task.task_id)
    if (selectLatest && list.length && !currentTaskId.value) {
      await selectTask(normalizeTaskId(list[0]))
    }
  } catch (error) {
    if (!silent) ElMessage.error(error.message || '任务列表加载失败')
  } finally {
    await minSpin(startedAt)
    loadingTasks.value = false
  }
}

const selectTask = async (taskId) => {
  if (!taskId) return
  try {
    const task = await fetchAgentTask(taskId)
    syncTaskState(task)
    artifactText.value = ''
    predictionResult.value = ''
    currentReport.value = null
    pendingReview.value = null
    if (task.dataset_id) {
      const preview = await fetchDatasetPreview(task.dataset_id)
      previewRows.value = normalizeRows(preview).slice(0, 20)
    }
    if (task.status === 'WAITING_HUMAN') await loadPendingReview(false)
    if (task.status === 'COMPLETED') await loadReport()
  } catch (error) {
    ElMessage.error(error.message || '任务详情加载失败')
  }
}

const loadProgress = async (silent = false) => {
  if (!currentTaskId.value) return
  const startedAt = Date.now()
  loadingProgress.value = true
  try {
    const progress = await fetchAgentProgress(currentTaskId.value)
    syncTaskState(progress)
    if (lifecycleStatus.value === 'WAITING_HUMAN') await loadPendingReview(true)
    await loadTasks(false, true)
  } catch (error) {
    if (!silent) ElMessage.error(error.message || '进度加载失败')
  } finally {
    await minSpin(startedAt)
    loadingProgress.value = false
  }
}

const loadPendingReview = async (silent = false) => {
  if (!currentTaskId.value) return
  try {
    pendingReview.value = await fetchPendingReview(currentTaskId.value)
  } catch (error) {
    pendingReview.value = null
    if (!silent) ElMessage.warning(error.message || '当前任务没有待审核内容')
  }
}

const openReviewDialog = async () => {
  if (!canReview.value) return ElMessage.warning('当前身份没有审核权限')
  await loadPendingReview(false)
  reviewAction.value = 'approve'
  reviewComment.value = ''
  patchText.value = ''
  reviewDialogVisible.value = true
}

const parsePatch = () => {
  if (reviewAction.value !== 'edit_and_continue') return null
  if (!patchText.value.trim()) return {}
  try {
    return JSON.parse(patchText.value)
  } catch {
    throw new Error('补丁 JSON 格式不正确')
  }
}

const submitReviewAndResume = async () => {
  if (!currentTaskId.value || !pendingReview.value) return
  reviewing.value = true
  try {
    await submitAgentReview(currentTaskId.value, {
      action: reviewAction.value,
      patch: parsePatch(),
      comment: reviewComment.value.trim(),
      auto_resume: false,
      offline: runOffline.value
    })
    reviewDialogVisible.value = false
    pendingReview.value = null
    if (reviewAction.value !== 'reject') {
      const result = await resumeAgentTask(currentTaskId.value, { offline: runOffline.value })
      syncTaskState(result)
      startRunPolling()
    } else {
      await loadProgress(true)
    }
    await loadTasks(false, true)
    ElMessage.success('审核已提交')
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
    currentReport.value = report
    artifactText.value = JSON.stringify(report, null, 2)
    if (!predictionText.value.trim()) fillPredictionSample()
  } catch (error) {
    ElMessage.error(error.message || '报告加载失败')
  }
}

const loadCode = async () => {
  if (!currentTaskId.value) return
  try {
    const code = await fetchAgentCode(currentTaskId.value)
    artifactText.value =
      typeof code === 'string' ? code : code?.python_code || code?.code || JSON.stringify(code, null, 2)
  } catch (error) {
    ElMessage.error(error.message || '代码加载失败')
  }
}

const fillPredictionSample = () => {
  const row = previewRows.value[0] || {}
  const target = currentReport.value?.target_column || currentTask.value?.target_column
  const featureColumns = currentReport.value?.feature_columns || Object.keys(row).filter((key) => key !== target)
  const sample = {}
  featureColumns.forEach((column) => {
    if (row[column] !== undefined) sample[column] = row[column]
  })
  predictionText.value = JSON.stringify(sample, null, 2)
}

const runPrediction = async () => {
  if (!currentTaskId.value) return ElMessage.warning('请先选择任务')
  if (lifecycleStatus.value !== 'COMPLETED') return ElMessage.warning('任务完成后才能预测')
  let features
  try {
    features = JSON.parse(predictionText.value)
  } catch {
    return ElMessage.error('预测输入必须是合法 JSON')
  }
  if (!features || Array.isArray(features) || typeof features !== 'object') {
    return ElMessage.error('预测输入必须是单条样本对象')
  }
  predicting.value = true
  try {
    const result = await predictAgentTask(currentTaskId.value, { features })
    predictionResult.value = JSON.stringify(result, null, 2)
  } catch (error) {
    ElMessage.error(error.message || '预测失败')
  } finally {
    predicting.value = false
  }
}

const startRunPolling = () => {
  clearInterval(runPollTimer)
  runPollTimer = setInterval(async () => {
    if (!currentTaskId.value || ['COMPLETED', 'FAILED', 'CANCELLED', 'WAITING_HUMAN'].includes(lifecycleStatus.value)) {
      clearInterval(runPollTimer)
      if (lifecycleStatus.value === 'WAITING_HUMAN') await loadPendingReview(true)
      if (lifecycleStatus.value === 'COMPLETED') await loadReport()
      return
    }
    await loadProgress(true)
  }, 2500)
}

const startListAutoRefresh = () => {
  clearInterval(listRefreshTimer)
  listRefreshTimer = setInterval(() => {
    if (creating.value || running.value || reviewing.value || loadingProgress.value || loadingTasks.value) return
    loadTasks(false, true)
  }, 30000)
}

onMounted(() => {
  loadTasks(false, true)
  startListAutoRefresh()
})

onBeforeUnmount(() => {
  clearInterval(runPollTimer)
  clearInterval(listRefreshTimer)
})
</script>

<style scoped>
.agent-console {
  height: calc(100vh - 76px);
  min-height: 720px;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
}

.task-rail {
  min-width: 0;
  padding: 18px 16px 18px 0;
  border-right: 1px solid #242424;
}

.new-task-button,
.task-item {
  border: 0;
  color: #f4f4f4;
  background: transparent;
  cursor: pointer;
}

.new-task-button {
  width: 100%;
  height: 62px;
  position: relative;
  margin-bottom: 24px;
  border-radius: 24px;
  background: #2f2f2f;
  transition:
    transform 0.16s ease,
    background-color 0.16s ease;
}

.new-task-button span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 30px;
  height: 3px;
  border-radius: 999px;
  background: #f4f4f4;
  transform: translate(-50%, -50%);
}

.new-task-button span:last-child {
  transform: translate(-50%, -50%) rotate(90deg);
}

.new-task-button:hover,
.task-item:hover {
  background: #383838;
  transform: translateY(-1px);
}

.rail-label {
  margin: 0 0 10px 4px;
  color: #8c8c8c;
  font-size: 12px;
  font-weight: 680;
}

.task-list {
  display: grid;
  gap: 6px;
  max-height: calc(100vh - 210px);
  overflow: auto;
}

.task-item {
  width: 100%;
  min-height: 62px;
  padding: 10px 12px;
  border-radius: 13px;
  text-align: left;
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.task-item.active {
  background: #343434;
}

.task-title {
  display: -webkit-box;
  color: #f4f4f4;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.35;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  color: #a8a8a8;
  font-size: 12px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #777777;
}

.status-dot.COMPLETED {
  background: var(--zs-success);
}

.status-dot.WAITING_HUMAN {
  background: var(--zs-warning);
}

.status-dot.FAILED {
  background: var(--zs-danger);
}

.rail-empty,
.modal-empty {
  padding: 18px 8px;
  color: #8a8a8a;
  font-size: 13px;
}

.agent-main {
  min-width: 0;
  padding: 30px 42px;
  overflow: auto;
}

.empty-start {
  min-height: calc(100vh - 150px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: #f4f4f4;
}

.empty-start h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 760;
  letter-spacing: 0;
}

.empty-start p {
  max-width: 520px;
  margin: 14px 0 0;
  color: #a8a8a8;
  font-size: 14px;
  line-height: 1.7;
}

.agent-main :deep(.el-textarea .el-input__count) {
  background: transparent;
  color: #9a9a9a;
}

.hero-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin: 10px auto 24px;
  max-width: 1080px;
}

.run-mode {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #b4b4b4;
  font-size: 13px;
}

.task-card,
.workflow-panel,
.inspector-card {
  max-width: 1080px;
  margin: 0 auto 18px;
  padding: 18px;
  border: 1px solid #343434;
  border-radius: 24px;
  background: #1f1f1f;
  box-shadow: var(--zs-shadow);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;
}

.task-card:hover,
.workflow-panel:hover,
.inspector-card:hover,
.status-card:hover {
  border-color: #4a4a4a;
}

.status-strip {
  max-width: 1080px;
  margin: 0 auto 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.status-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid #343434;
  border-radius: 16px;
  background: #181818;
  transition: border-color 0.16s ease;
}

.status-card span {
  display: block;
  color: #9a9a9a;
  font-size: 12px;
}

.status-card strong {
  display: block;
  margin-top: 7px;
  color: #f4f4f4;
  overflow-wrap: anywhere;
  font-size: 14px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-head.compact {
  margin-bottom: 12px;
}

.panel-title {
  color: #f4f4f4;
  font-size: 15px;
  font-weight: 760;
}

.panel-subtitle {
  margin-top: 4px;
  color: #a8a8a8;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.panel-actions,
.artifact-actions,
.predict-actions,
.upload-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stage-list {
  display: grid;
  gap: 8px;
}

.stage-item {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 82px;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #343434;
  border-radius: 16px;
  background: #171717;
}

.stage-item.done {
  border-color: rgba(125, 211, 167, 0.32);
}

.stage-item.running {
  border-color: #777777;
  background: #242424;
}

.stage-item.review {
  border-color: rgba(242, 200, 120, 0.55);
  background: #252116;
}

.stage-item.failed {
  border-color: rgba(255, 138, 138, 0.5);
}

.stage-icon {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: #f4f4f4;
  background: #2b2b2b;
}

.stage-title {
  color: #f4f4f4;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.stage-desc,
.stage-state {
  color: #a8a8a8;
  font-size: 12px;
}

.stage-tail {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.stage-state {
  text-align: right;
}

.predict-actions {
  justify-content: space-between;
  margin-top: 12px;
}

.result-box,
.artifact-box,
.review-payload {
  width: 100%;
  margin: 12px 0 0;
  padding: 14px;
  overflow: auto;
  border: 1px solid #343434;
  border-radius: 16px;
  color: #e8e8e8;
  background: #101010;
  font-size: 12px;
  line-height: 1.6;
}

.result-box {
  max-height: 220px;
}

.artifact-box {
  height: 360px;
}

.review-body {
  display: grid;
  gap: 14px;
}

.review-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.review-meta div {
  padding: 12px;
  border: 1px solid #343434;
  border-radius: 16px;
  background: #181818;
}

.review-meta span {
  display: block;
  color: #9a9a9a;
  font-size: 12px;
}

.review-meta strong {
  display: block;
  margin-top: 6px;
  color: #f4f4f4;
}

.form-hint {
  margin-top: 8px;
  color: #909090;
  font-size: 12px;
}

.spinning :deep(svg),
.spinning svg {
  animation: spin 0.85s linear infinite;
}

@media (max-width: 1180px) {
  .agent-console {
    height: auto;
    grid-template-columns: 1fr;
  }

  .task-rail {
    border: 0;
    padding: 18px 0;
  }

  .task-list {
    max-height: 260px;
  }
}

@media (max-width: 720px) {
  .agent-main {
    padding: 22px 0;
  }

  .hero-line,
  .panel-head {
    flex-direction: column;
  }

  .status-strip,
  .review-meta {
    grid-template-columns: 1fr;
  }

  .stage-item {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .stage-tail {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
