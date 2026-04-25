<template>
  <div class="agent-console">
    <aside class="task-rail">
      <div class="rail-head">
        <button class="new-task-button" @click="resetComposer">
          <el-icon><EditPen /></el-icon>
          <span>新建任务</span>
        </button>
        <button class="icon-button" :class="{ spinning: loadingTasks }" :disabled="loadingTasks" title="刷新任务" @click="loadTasks">
          <el-icon><Refresh /></el-icon>
        </button>
      </div>

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
      <section class="hero-line">
        <div>
          <p class="zs-eyebrow">AI4ML Agent</p>
          <h2 class="zs-title">你想让 Agent 建模什么？</h2>
          <p class="zs-subtitle">上传 CSV，描述目标。完成后的任务会出现在左侧列表，可随时切换查看报告和预测接口。</p>
        </div>
        <div class="run-mode">
          <span>Mode</span>
          <el-switch v-model="runOffline" inline-prompt active-text="离线" inactive-text="LLM" />
        </div>
      </section>

      <section class="status-strip">
        <div class="status-card">
          <span>当前任务</span>
          <strong>{{ currentTaskId || '未选择' }}</strong>
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

      <section class="composer-card">
        <div class="panel-head">
          <div>
            <div class="panel-title">创建或重新运行任务</div>
            <div class="panel-subtitle">输入任务目标并上传 CSV。选择历史任务后，这里也会显示该任务的原始描述。</div>
          </div>
        </div>
        <el-input
          v-model="taskDesc"
          type="textarea"
          :rows="4"
          maxlength="500"
          resize="none"
          show-word-limit
          placeholder="请描述你的建模目标，例如：根据客户年龄、收入和城市预测 bought 字段。"
        />
        <div class="composer-actions">
          <el-upload
            :show-file-list="false"
            :http-request="handleDatasetUpload"
            accept=".csv,text/csv"
          >
            <el-button plain>
              <el-icon><Paperclip /></el-icon>
              {{ datasetName || '上传 CSV' }}
            </el-button>
          </el-upload>

          <div class="composer-right">
            <el-checkbox v-model="enableHitl" :disabled="!canReview">
              {{ canReview ? 'HITL 审核' : '自动执行' }}
            </el-checkbox>

            <el-button type="primary" :loading="creating || running" @click="createAndRunTask">
              <el-icon><VideoPlay /></el-icon>
              运行
            </el-button>
          </div>
        </div>
      </section>

      <section class="workflow-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Agent 工作流</div>
            <div class="panel-subtitle">{{ statusText }}</div>
          </div>
          <div class="panel-actions">
            <el-button plain :disabled="!currentTaskId" :loading="loadingProgress" @click="loadProgress">
              <el-icon :class="{ spinning: loadingProgress }"><Refresh /></el-icon>
              刷新进度
            </el-button>
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

        <div class="stage-list">
          <div v-for="stage in stages" :key="stage.key" class="stage-item" :class="stage.status">
            <div class="stage-icon">
              <el-icon><component :is="stage.icon" /></el-icon>
            </div>
            <div>
              <div class="stage-title">{{ stage.title }}</div>
              <div class="stage-desc">{{ stage.desc }}</div>
            </div>
            <div class="stage-state">{{ stageLabelMap[stage.status] }}</div>
          </div>
        </div>
      </section>

      <section class="data-panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">数据预览</div>
            <div class="panel-subtitle">{{ previewRows.length ? '展示前几行样本' : '上传或选择任务后读取数据预览' }}</div>
          </div>
        </div>
        <el-table v-if="previewRows.length" :data="previewRows" height="250">
          <el-table-column
            v-for="column in previewColumns"
            :key="column"
            :prop="column"
            :label="column"
            min-width="120"
          />
        </el-table>
        <div v-else class="empty-panel">
          <el-icon><Grid /></el-icon>
          <span>暂无数据预览</span>
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
          <el-button plain :disabled="!currentReport" @click="fillPredictionSample">填入样例</el-button>
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
        <pre class="artifact-box">{{ artifactText || '选择已完成任务后查看产物。' }}</pre>
      </section>
    </main>
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
  predictAgentTask,
  resumeAgentTask,
  runAgentTask,
  submitAgentReview,
  uploadAgentDataset
} from '../api/agent'

const userStore = useUserStore()
const taskList = ref([])
const currentTask = ref(null)
const taskDesc = ref('')
const datasetId = ref(null)
const datasetName = ref('')
const previewRows = ref([])
const currentTaskId = ref('')
const lifecycleStatus = ref('CREATED')
const currentStage = ref('')
const artifactText = ref('')
const predictionText = ref('')
const predictionResult = ref('')
const currentReport = ref(null)
const runOffline = ref(true)
const canReview = computed(() => ['ADMIN', 'DEVELOPER'].includes(userStore.role))
const enableHitl = ref(canReview.value)
const loadingTasks = ref(false)
const loadingProgress = ref(false)
const minSpin = (startedAt) => {
  const elapsed = Date.now() - startedAt
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, 850 - elapsed)))
}
const creating = ref(false)
const running = ref(false)
const reviewing = ref(false)
const predicting = ref(false)
let pollTimer = null

const stageDefinitions = [
  { key: 'manager_parse', title: 'Manager', desc: '解析自然语言需求与目标字段', icon: 'Connection' },
  { key: 'data_analysis', title: 'Data Agent', desc: '检查数据质量、列类型和缺失值', icon: 'DataAnalysis' },
  { key: 'model_plan', title: 'Model Agent', desc: '规划模型、指标和训练策略', icon: 'Aim' },
  { key: 'model_training', title: 'Training', desc: '训练轻量模型并计算指标', icon: 'Cpu' },
  { key: 'code_generation', title: 'Operation', desc: '生成代码和预测接口', icon: 'Document' },
  { key: 'operation_report', title: 'Report', desc: '输出报告、代码和可复用产物', icon: 'TrendCharts' }
]

const stageLabelMap = {
  pending: '等待',
  running: '进行中',
  done: '完成',
  failed: '失败'
}

const statusText = computed(() => {
  if (!currentTaskId.value) return '新建任务，或从左侧选择一个历史任务。'
  if (lifecycleStatus.value === 'WAITING_HUMAN') return '工作流已暂停，等待开发者审核。'
  if (lifecycleStatus.value === 'COMPLETED') return '任务已完成，可以调用预测接口。'
  if (lifecycleStatus.value === 'FAILED') return '任务失败，请查看状态和后端日志。'
  return '工作流正在运行或等待启动。'
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
  currentTask.value = task
  currentTaskId.value = String(normalizeTaskId(task) || currentTaskId.value || '')
  datasetId.value = task.dataset_id || datasetId.value
  lifecycleStatus.value = task.status || task.lifecycle_status || task.task_status || lifecycleStatus.value
  currentStage.value =
    task.current_stage ||
    task.stage ||
    task.current_node ||
    task.progress?.current_stage ||
    currentStage.value
}

const resetComposer = () => {
  taskDesc.value = ''
  datasetName.value = ''
  datasetId.value = null
  currentTaskId.value = ''
  currentTask.value = null
  lifecycleStatus.value = 'CREATED'
  currentStage.value = ''
  previewRows.value = []
  artifactText.value = ''
  predictionText.value = ''
  predictionResult.value = ''
  currentReport.value = null
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
    datasetId.value = normalizeDatasetId(result)
    datasetName.value = file.name
    if (!datasetId.value) throw new Error('上传成功，但响应中没有 dataset_id')
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
  if (creating.value || running.value) return
  if (!taskDesc.value.trim()) return ElMessage.warning('请先填写建模需求')
  if (!datasetId.value) return ElMessage.warning('请先上传 CSV 数据集')
  if (taskDesc.value.trim().length < 3) return ElMessage.warning('建模需求至少需要 3 个字符')

  artifactText.value = ''
  predictionResult.value = ''
  currentReport.value = null
  creating.value = true
  try {
    const task = await createAgentTask({
      dataset_id: Number(datasetId.value),
      task_description: taskDesc.value.trim(),
      hitl: enableHitl.value ? ['all'] : []
    })
    syncTaskState(task)
    await loadTasks(false)
    ElMessage.success('Agent 任务已创建')
  } catch (error) {
    ElMessage.error(error.message || '任务创建失败')
    return
  } finally {
    creating.value = false
  }

  running.value = true
  try {
    const result = await runAgentTask(currentTaskId.value, { offline: runOffline.value })
    syncTaskState(result)
    await loadTasks(false)
    if (result?.status === 'COMPLETED') {
      await loadReport()
    }
    startPolling()
  } catch (error) {
    ElMessage.error(error.message || '任务启动失败')
  } finally {
    running.value = false
  }
}

const loadTasks = async (selectLatest = true) => {
  const startedAt = Date.now()
  loadingTasks.value = true
  try {
    const result = await fetchAgentTasks()
    const list = Array.isArray(result) ? result : result?.list || result?.items || []
    taskList.value = list
    if (selectLatest && list.length && !currentTaskId.value) {
      await selectTask(normalizeTaskId(list[0]))
    }
  } catch (error) {
    ElMessage.error(error.message || '任务列表加载失败')
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
    taskDesc.value = task.task_description || ''
    artifactText.value = ''
    predictionResult.value = ''
    currentReport.value = null
    if (task.dataset_id) {
      const preview = await fetchDatasetPreview(task.dataset_id)
      previewRows.value = normalizeRows(preview).slice(0, 8)
    }
    if (task.status === 'COMPLETED') {
      await loadReport()
    }
  } catch (error) {
    ElMessage.error(error.message || '任务详情加载失败')
  }
}

const loadProgress = async () => {
  if (!currentTaskId.value) return
  const startedAt = Date.now()
  loadingProgress.value = true
  try {
    const progress = await fetchAgentProgress(currentTaskId.value)
    syncTaskState(progress)
    await loadTasks(false)
  } catch (error) {
    ElMessage.error(error.message || '进度加载失败')
  } finally {
    await minSpin(startedAt)
    loadingProgress.value = false
  }
}

const approveAndResume = async () => {
  if (!currentTaskId.value) return
  if (lifecycleStatus.value !== 'WAITING_HUMAN') return ElMessage.warning('当前任务没有处于待审核状态')
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

const startPolling = () => {
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!currentTaskId.value || ['COMPLETED', 'FAILED', 'CANCELLED', 'WAITING_HUMAN'].includes(lifecycleStatus.value)) {
      clearInterval(pollTimer)
      if (lifecycleStatus.value === 'COMPLETED') await loadReport()
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
.agent-console {
  height: calc(100vh - 76px);
  min-height: 720px;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 0;
}

.task-rail {
  min-width: 0;
  padding: 18px 16px 18px 0;
  border-right: 1px solid #242424;
}

.rail-head {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.new-task-button,
.icon-button,
.task-item {
  border: 0;
  color: #f4f4f4;
  background: transparent;
  cursor: pointer;
}

.new-task-button {
  flex: 1;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 13px;
  background: #2f2f2f;
  font-weight: 650;
}

.new-task-button:hover,
.icon-button:hover,
.task-item:hover {
  background: #333333;
  transform: translateY(-1px);
}

.icon-button {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: #242424;
  transition:
    transform 0.16s ease,
    background-color 0.16s ease;
}

.spinning :deep(svg),
.spinning svg {
  animation: spin 0.85s linear infinite;
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

.rail-empty {
  padding: 18px 8px;
  color: #8a8a8a;
  font-size: 13px;
}

.agent-main {
  min-width: 0;
  padding: 30px 42px;
  overflow: auto;
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

.composer-card,
.workflow-panel,
.data-panel,
.inspector-card {
  border: 1px solid #343434;
  border-radius: 24px;
  background: #1f1f1f;
}

.composer-card,
.workflow-panel,
.data-panel,
.inspector-card,
.status-card,
.task-item {
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    transform 0.16s ease;
}

.composer-card:hover,
.workflow-panel:hover,
.data-panel:hover,
.inspector-card:hover,
.status-card:hover {
  border-color: #4a4a4a;
}

.composer-card {
  max-width: 1080px;
  margin: 0 auto 18px;
  padding: 18px;
  box-shadow: var(--zs-shadow);
}

.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.composer-right {
  display: flex;
  align-items: center;
  gap: 12px;
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

.workflow-panel,
.data-panel {
  max-width: 1080px;
  margin: 0 auto 18px;
  padding: 18px;
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
}

.panel-actions,
.artifact-actions,
.predict-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stage-list {
  display: grid;
  gap: 8px;
}

.stage-item {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
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

.stage-state {
  min-width: 58px;
  text-align: right;
}

.empty-panel {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #8f8f8f;
}

.inspector-card {
  max-width: 1080px;
  margin: 0 auto 18px;
  padding: 16px;
}

.predict-actions {
  justify-content: space-between;
  margin-top: 12px;
}

.result-box,
.artifact-box {
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

@media (max-width: 1180px) {
  .agent-console {
    height: auto;
    grid-template-columns: 1fr;
  }

  .task-rail,
  .inspector {
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
  .composer-actions,
  .panel-head {
    flex-direction: column;
  }

  .status-strip {
    grid-template-columns: 1fr 1fr;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
