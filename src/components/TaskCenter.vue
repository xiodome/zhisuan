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
              <div class="run-mode">
                <span>Mode</span>
                <el-switch v-model="runOffline" inline-prompt active-text="离线" inactive-text="LLM" />
              </div>
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
              <div class="panel-subtitle">导入或手动编辑一组特征值，批量调用 `/predict`，预测值会显示在最右列。</div>
            </div>
            <div class="panel-actions">
              <el-button plain @click="openPredictionJsonDialog">JSON 导入</el-button>
              <el-button plain :disabled="!predictionRows.length" @click="addPredictionRow">新增行</el-button>
              <el-button plain :disabled="!predictionRows.length" @click="exportPredictionJson">导出 JSON</el-button>
            </div>
          </div>

          <div v-if="predictionColumns.length" class="prediction-table-wrap">
            <el-table :data="pagedPredictionRows" :height="predictionTableHeight">
              <el-table-column label="#" width="56">
                <template #default="{ row, $index }">
                  <button class="row-delete-button" title="删除此行" @click="removePredictionRow(row.id)">
                    <span class="row-index">{{ (predictionPage - 1) * predictionPageSize + $index + 1 }}</span>
                    <el-icon class="row-delete-icon"><Close /></el-icon>
                  </button>
                </template>
              </el-table-column>
              <el-table-column
                v-for="column in predictionColumns"
                :key="column"
                :label="column"
                min-width="150"
              >
                <template #default="{ row }">
                  <el-input v-model="row.features[column]" placeholder="-" />
                </template>
              </el-table-column>
              <el-table-column label="预测值" min-width="150" fixed="right">
                <template #default="{ row }">
                  <span class="prediction-value">{{ formatPredictionValue(row.prediction) }}</span>
                </template>
              </el-table-column>
            </el-table>
            <div class="prediction-footer">
              <el-pagination
                background
                layout="prev, pager, next, jumper, total"
                :total="predictionRows.length"
                :page-size="predictionPageSize"
                :current-page="predictionPage"
                @current-change="(page) => (predictionPage = page)"
              />
            </div>
          </div>
          <div v-else class="modal-empty">点击“JSON 导入”或“填入样例”开始批量预测。</div>

          <div class="predict-actions">
            <el-button plain :disabled="!currentReport && !previewRows.length" @click="fillPredictionSample">填入样例</el-button>
            <el-button
              type="primary"
              :disabled="lifecycleStatus !== 'COMPLETED' || !predictionRows.length"
              :loading="predicting"
              @click="runPrediction"
            >
              <el-icon><Position /></el-icon>
              预测
            </el-button>
          </div>
        </section>

        <section class="inspector-card">
          <div class="panel-head compact">
            <div>
              <div class="panel-title">任务产物</div>
              <div class="panel-subtitle">报告、代码和任务产物。</div>
            </div>
          </div>

          <div class="artifact-actions">
            <el-button plain :class="{ active: artifactMode === 'report' }" :disabled="!currentTaskId" @click="loadReport">报告</el-button>
            <el-button plain :class="{ active: artifactMode === 'code' }" :disabled="!currentTaskId || !canReview" @click="loadCode">代码</el-button>
            <el-button plain :disabled="!currentReport" @click="exportReportJson">导出报告 JSON</el-button>
          </div>

          <div v-if="artifactMode === 'report' && currentReport" class="report-visual">
            <div class="report-summary-grid">
              <div v-for="item in reportSummaryCards" :key="item.label" class="report-summary-card">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>

            <div v-if="currentReport.summary" class="report-section">
              <span>摘要</span>
              <p>{{ currentReport.summary }}</p>
            </div>

            <div v-if="reportRecommendations.length || reportRiskNotes.length" class="report-advice-grid">
              <div v-if="reportRecommendations.length" class="report-section">
                <span>使用建议</span>
                <ul>
                  <li v-for="item in reportRecommendations" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div v-if="reportRiskNotes.length" class="report-section">
                <span>风险提示</span>
                <ul>
                  <li v-for="item in reportRiskNotes" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>

            <div class="report-section">
              <span>特征列</span>
              <div v-if="reportFeatureColumns.length" class="report-tags">
                <span v-for="column in reportFeatureColumns" :key="column">{{ column }}</span>
              </div>
              <p v-else>暂无特征列信息。</p>
            </div>

            <div class="report-block">
              <div class="report-block-head">
                <div>
                  <strong>训练指标</strong>
                  <span>模型训练后的核心评估结果。</span>
                </div>
              </div>
              <div class="report-metric-grid">
                <div v-for="item in reportTrainingCards" :key="item.label" class="report-metric-card">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <el-table v-if="reportCandidateModels.length" :data="reportCandidateModels" class="report-table">
                <el-table-column prop="model_name" label="候选模型" min-width="180" />
                <el-table-column
                  v-for="metric in reportCandidateMetricColumns"
                  :key="metric"
                  :label="metric"
                  min-width="120"
                >
                  <template #default="{ row }">{{ formatReportValue(row.metrics?.[metric]) }}</template>
                </el-table-column>
              </el-table>
              <el-table v-if="reportFeatureImportance.length" :data="reportFeatureImportance" class="report-table">
                <el-table-column prop="feature" label="重要特征" min-width="160" />
                <el-table-column label="影响强度" min-width="120">
                  <template #default="{ row }">{{ formatReportValue(row.importance) }}</template>
                </el-table-column>
                <el-table-column label="方向" min-width="100">
                  <template #default="{ row }">{{ row.direction === 'positive' ? '正相关' : '负相关' }}</template>
                </el-table-column>
              </el-table>
            </div>

            <div class="report-block">
              <div class="report-block-head">
                <div>
                  <strong>数据分析</strong>
                  <span>数据规模、字段质量和 Agent 选列判断。</span>
                </div>
              </div>
              <div class="report-metric-grid">
                <div v-for="item in reportDataCards" :key="item.label" class="report-metric-card">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div v-if="reportSelectionReason" class="report-note">{{ reportSelectionReason }}</div>
              <div v-if="reportNumericColumns.length" class="report-section inline">
                <span>数值列</span>
                <div class="report-tags">
                  <span v-for="column in reportNumericColumns" :key="column">{{ column }}</span>
                </div>
              </div>
              <el-table v-if="reportMissingRows.length" :data="reportMissingRows" class="report-table">
                <el-table-column prop="column" label="字段" min-width="160" />
                <el-table-column prop="missing" label="缺失情况" min-width="120" />
              </el-table>
              <el-table v-if="reportSampleRows.length" :data="reportSampleRows" class="report-table" height="240">
                <el-table-column
                  v-for="column in reportSampleColumns"
                  :key="column"
                  :prop="column"
                  :label="column"
                  min-width="120"
                />
              </el-table>
            </div>

            <div class="report-block">
              <div class="report-block-head">
                <div>
                  <strong>模型规划</strong>
                  <span>模型选择、切分方式和预处理策略。</span>
                </div>
              </div>
              <div class="report-metric-grid">
                <div v-for="item in reportPlanCards" :key="item.label" class="report-metric-card">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div v-if="reportPreprocessText" class="report-note">{{ reportPreprocessText }}</div>
              <div v-if="reportPlannedCandidates.length" class="report-section inline">
                <span>候选模型</span>
                <div class="report-tags">
                  <span v-for="model in reportPlannedCandidates" :key="model">{{ model }}</span>
                </div>
              </div>
            </div>
          </div>

          <pre v-else class="artifact-box">{{ artifactText || '任务完成后查看产物。' }}</pre>
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

    <el-dialog v-model="predictionJsonDialogVisible" title="JSON 导入" width="720px" class="agent-dialog">
      <el-input
        v-model="predictionJsonText"
        type="textarea"
        :rows="12"
        resize="none"
        placeholder='[{"nitrogen": 56.4, "rainfall": 82.9, "temperature": 17.7}]'
      />
      <div class="form-hint">仅支持 JSON 对象数组；导入后会覆盖当前预测表格。</div>
      <template #footer>
        <el-button plain @click="predictionJsonDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPredictionJsonImport">确认导入</el-button>
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
const artifactMode = ref('empty')
const predictionRows = ref([])
const predictionPage = ref(1)
const predictionPageSize = 5
const predictionRowHeight = 50
const predictionTableHeaderHeight = 48
const predictionJsonDialogVisible = ref(false)
const predictionJsonText = ref('')
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
const predictionColumns = computed(() => {
  const columns = new Set()
  predictionRows.value.forEach((row) => {
    Object.keys(row.features || {}).forEach((column) => columns.add(column))
  })
  return Array.from(columns)
})
const pagedPredictionRows = computed(() => {
  const start = (predictionPage.value - 1) * predictionPageSize
  return predictionRows.value.slice(start, start + predictionPageSize)
})
const predictionTableHeight = computed(() => predictionTableHeaderHeight + predictionPageSize * predictionRowHeight)
const reportData = computed(() => currentReport.value?.data_analysis || currentReport.value?.data_result || {})
const reportModelTraining = computed(() => currentReport.value?.model_training || {})
const reportModelResult = computed(() =>
  currentReport.value?.model_result || {
    ...reportModelTraining.value,
    train_size: reportModelTraining.value?.metrics?.train_rows,
    test_size: reportModelTraining.value?.metrics?.test_rows,
  }
)
const reportModelPlan = computed(() => currentReport.value?.model_plan || reportModelResult.value?.model_plan || {})
const reportMetrics = computed(() => {
  const metrics = currentReport.value?.metrics
  if (metrics && Object.keys(metrics).length) return metrics
  return reportModelResult.value?.best_model?.metrics || reportModelResult.value?.metrics || {}
})
const reportFeatureColumns = computed(() => {
  const columns =
    currentReport.value?.feature_columns ||
    reportData.value?.feature_columns ||
    reportModelResult.value?.feature_columns
  return Array.isArray(columns) ? columns : []
})
const reportTargetColumn = computed(
  () =>
    currentReport.value?.target_column ||
    reportData.value?.target_column ||
    reportModelResult.value?.target_column ||
    currentTask.value?.target_column ||
    '-'
)
const reportTaskType = computed(
  () =>
    currentReport.value?.task_type ||
    reportModelResult.value?.task_type ||
    currentReport.value?.parsed_task?.task_type ||
    currentTask.value?.task_type ||
    '-'
)
const reportSummaryCards = computed(() => {
  const report = currentReport.value || {}
  return [
    { label: '任务 ID', value: report.task_id || currentTaskId.value || '-' },
    { label: '任务类型', value: reportTaskType.value },
    { label: '目标列', value: reportTargetColumn.value },
    { label: '评估指标', value: reportMetrics.value.metric || reportModelPlan.value.primary_metric || '-' },
    { label: '指标得分', value: formatReportValue(reportMetrics.value.score ?? reportMetrics.value[reportModelPlan.value.primary_metric]) },
    { label: '特征数量', value: String(reportFeatureColumns.value.length) }
  ]
})
const reportBestModelName = computed(
  () => reportModelResult.value?.best_model?.model_name || reportModelPlan.value?.model_name || '-'
)
const reportTrainingCards = computed(() => {
  const metrics = reportMetrics.value
  const cards = [
    { label: '最佳模型', value: reportBestModelName.value },
    { label: '主指标', value: metrics.metric || reportModelPlan.value.primary_metric || '-' },
    { label: '训练行数', value: formatReportValue(metrics.train_rows ?? reportModelResult.value?.train_size) },
    { label: '测试行数', value: formatReportValue(reportModelResult.value?.test_size) }
  ]
  Object.entries(metrics)
    .filter(([key]) => !['metric', 'train_rows'].includes(key))
    .forEach(([key, value]) => cards.push({ label: metricLabel(key), value: formatReportValue(value) }))
  return cards.filter((item) => item.value !== '-')
})
const reportCandidateModels = computed(() => {
  const candidates = reportModelResult.value?.candidate_models
  return Array.isArray(candidates) ? candidates : []
})
const reportCandidateMetricColumns = computed(() => {
  const columns = new Set()
  reportCandidateModels.value.forEach((model) => {
    Object.keys(model.metrics || {}).forEach((key) => columns.add(key))
  })
  return Array.from(columns)
})
const reportMissingRows = computed(() => {
  const missing = reportData.value?.missing_values || reportData.value?.missing_ratio || {}
  return Object.entries(missing).map(([column, value]) => ({
    column,
    missing: typeof value === 'number' && value > 0 && value < 1 ? `${(value * 100).toFixed(2)}%` : formatReportValue(value)
  }))
})
const reportMissingSummary = computed(() => {
  const raw = reportData.value?.missing_values || reportData.value?.missing_ratio || {}
  const values = Object.values(raw).filter((value) => Number(value) > 0)
  if (!Object.keys(raw).length) return '-'
  if (reportData.value?.missing_ratio) return `${values.length}/${Object.keys(raw).length} 列`
  return formatReportValue(values.reduce((total, value) => total + Number(value), 0))
})
const reportDataCards = computed(() => [
  { label: '数据行数', value: formatReportValue(reportData.value?.row_count) },
  { label: '字段数量', value: formatReportValue(reportData.value?.column_count || reportData.value?.columns?.length) },
  { label: '缺失情况', value: reportMissingSummary.value },
  { label: '目标均值', value: formatReportValue(reportData.value?.target_mean) },
  { label: '目标标准差', value: formatReportValue(reportData.value?.target_std) },
  { label: 'LLM 参与', value: reportData.value?.llm_used === undefined ? '-' : reportData.value.llm_used ? '是' : '否' }
].filter((item) => item.value !== '-'))
const reportSelectionReason = computed(
  () => reportData.value?.selection_reason || reportData.value?.llm_output?.selection_reason || ''
)
const reportNumericColumns = computed(() => {
  const columns = reportData.value?.numeric_columns
  return Array.isArray(columns) ? columns : []
})
const reportSampleRows = computed(() => {
  const rows = reportData.value?.sample_rows || reportData.value?.preview || []
  return Array.isArray(rows) ? rows : []
})
const reportSampleColumns = computed(() => {
  const columns = new Set()
  reportSampleRows.value.forEach((row) => Object.keys(row || {}).forEach((column) => columns.add(column)))
  return Array.from(columns)
})
const reportPlanCards = computed(() => [
  { label: '框架', value: reportModelPlan.value?.framework || 'sklearn' },
  { label: '模型', value: reportModelPlan.value?.model_name || reportBestModelName.value },
  { label: '评估指标', value: reportModelPlan.value?.metric || reportModelPlan.value?.primary_metric || '-' },
  { label: '测试集比例', value: formatReportValue(reportModelPlan.value?.train_test_split ?? reportModelPlan.value?.test_size) },
  { label: '随机种子', value: formatReportValue(reportModelPlan.value?.random_state) },
  { label: '分层抽样', value: reportModelPlan.value?.use_stratify === undefined ? '-' : reportModelPlan.value.use_stratify ? '是' : '否' }
].filter((item) => item.value !== '-'))
const reportPreprocessText = computed(
  () =>
    reportModelPlan.value?.preprocess ||
    [
      reportData.value?.numeric_missing_strategy ? `数值缺失：${reportData.value.numeric_missing_strategy}` : '',
      reportData.value?.categorical_missing_strategy ? `类别缺失：${reportData.value.categorical_missing_strategy}` : '',
      reportData.value?.categorical_encoding_strategy ? `类别编码：${reportData.value.categorical_encoding_strategy}` : ''
    ]
      .filter(Boolean)
      .join('；')
)
const reportPlannedCandidates = computed(() => {
  const candidates = reportModelPlan.value?.candidate_models
  return Array.isArray(candidates) ? candidates : []
})
const reportRecommendations = computed(() => {
  const items = currentReport.value?.recommendations || []
  return Array.isArray(items) ? items : []
})
const reportRiskNotes = computed(() => {
  const items = currentReport.value?.risk_notes || []
  return Array.isArray(items) ? items : []
})
const reportFeatureImportance = computed(() => {
  const items = reportModelTraining.value?.feature_importance || currentReport.value?.feature_importance || []
  return Array.isArray(items) ? items : []
})

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
const mergeDefined = (base, patch) => {
  const cleaned = Object.fromEntries(
    Object.entries(patch || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
  )
  return { ...(base || {}), ...cleaned }
}
const normalizePredictionRows = (value) => {
  if (!Array.isArray(value)) throw new Error('JSON 必须是样本对象数组')
  const rows = value
  if (!rows.length) throw new Error('JSON 至少需要包含一条样本')
  return rows.map((row, index) => {
    if (!row || Array.isArray(row) || typeof row !== 'object') {
      throw new Error(`第 ${index + 1} 行必须是 JSON 对象`)
    }
    const features = {}
    Object.entries(row).forEach(([key, item]) => {
      if (key !== 'prediction' && key !== '__prediction') features[key] = item
    })
    if (!Object.keys(features).length) throw new Error(`第 ${index + 1} 行没有可预测特征`)
    return { id: `${Date.now()}_${index}_${Math.random().toString(16).slice(2)}`, features, prediction: row.prediction ?? row.__prediction ?? '' }
  })
}
const formatPredictionValue = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
const metricLabel = (key) =>
  ({
    score: '指标得分',
    accuracy: '准确率',
    r2: 'R2',
    r2_score: 'R2',
    mae: 'MAE',
    rmse: 'RMSE'
  })[key] || key
const formatReportValue = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
const downloadJson = (value, filename) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const syncTaskState = (task) => {
  if (!task) return
  const nextTaskId = String(normalizeTaskId(task) || currentTaskId.value || '')
  currentTask.value = mergeDefined(currentTask.value, { ...task, task_id: nextTaskId })
  currentTaskId.value = nextTaskId
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
    artifactMode.value = 'empty'
    predictionRows.value = []
    predictionPage.value = 1
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
  artifactMode.value = 'empty'
  predictionRows.value = predictionRows.value.map((row) => ({ ...row, prediction: '' }))
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
    artifactMode.value = 'empty'
    predictionRows.value = []
    predictionPage.value = 1
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
    artifactMode.value = 'report'
    if (!predictionRows.value.length) fillPredictionSample()
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
    artifactMode.value = 'code'
  } catch (error) {
    ElMessage.error(error.message || '代码加载失败')
  }
}

const fillPredictionSample = () => {
  const rows = previewRows.value.length ? previewRows.value.slice(0, 8) : [{}]
  const target = currentReport.value?.target_column || currentTask.value?.target_column
  const fallbackColumns = Object.keys(rows[0] || {}).filter((key) => key !== target)
  const featureColumns = currentReport.value?.feature_columns || fallbackColumns
  predictionRows.value = rows.map((row, index) => {
    const features = {}
    featureColumns.forEach((column) => {
      features[column] = row[column] ?? ''
    })
    return { id: `sample_${Date.now()}_${index}`, features, prediction: '' }
  })
  predictionPage.value = 1
}

const openPredictionJsonDialog = () => {
  const rows = predictionRows.value.map((row) => ({ ...row.features, prediction: row.prediction || undefined }))
  predictionJsonText.value = rows.length ? JSON.stringify(rows, null, 2) : ''
  predictionJsonDialogVisible.value = true
}

const confirmPredictionJsonImport = () => {
  let parsed
  try {
    parsed = JSON.parse(predictionJsonText.value)
    predictionRows.value = normalizePredictionRows(parsed)
    predictionPage.value = 1
    predictionJsonDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error.message || 'JSON 格式不正确')
  }
}

const addPredictionRow = () => {
  const features = {}
  predictionColumns.value.forEach((column) => {
    features[column] = ''
  })
  predictionRows.value.push({ id: `manual_${Date.now()}`, features, prediction: '' })
  predictionPage.value = Math.ceil(predictionRows.value.length / predictionPageSize)
}

const removePredictionRow = (rowId) => {
  predictionRows.value = predictionRows.value.filter((row) => row.id !== rowId)
  const maxPage = Math.max(1, Math.ceil(predictionRows.value.length / predictionPageSize))
  if (predictionPage.value > maxPage) predictionPage.value = maxPage
}

const exportPredictionJson = () => {
  const rows = predictionRows.value.map((row) => ({ ...row.features, prediction: row.prediction }))
  downloadJson(rows, `${currentTaskId.value || 'prediction'}_results.json`)
}

const exportReportJson = () => {
  if (!currentReport.value) return ElMessage.warning('请先加载报告')
  downloadJson(currentReport.value, `${currentTaskId.value || 'task'}_report.json`)
}

const runPrediction = async () => {
  if (!currentTaskId.value) return ElMessage.warning('请先选择任务')
  if (lifecycleStatus.value !== 'COMPLETED') return ElMessage.warning('任务完成后才能预测')
  const rows = predictionRows.value.map((row) => row.features)
  if (!rows.length) return ElMessage.warning('请先导入或填写预测特征')
  if (rows.some((row) => !row || !Object.keys(row).length)) {
    return ElMessage.error('每一行都必须包含至少一个特征')
  }
  predicting.value = true
  try {
    const result = await predictAgentTask(currentTaskId.value, { features: rows })
    const records = Array.isArray(result?.predictions) ? result.predictions : []
    predictionRows.value = predictionRows.value.map((row, index) => ({
      ...row,
      prediction: records[index]?.prediction ?? (Array.isArray(result?.prediction) ? result.prediction[index] : result?.prediction)
    }))
    ElMessage.success(`已完成 ${predictionRows.value.length} 条预测`)
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
  height: 100vh;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
}

.task-rail {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  height: 37px;
  position: relative;
  margin-bottom: 18px;
  border-radius: 16px;
  background: #2f2f2f;
  transition:
    transform 0.16s ease,
    background-color 0.16s ease;
}

.new-task-button span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22px;
  height: 2px;
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
  flex: 1;
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 6px;
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
  min-height: 0;
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

.artifact-actions .active {
  color: #101010 !important;
  border-color: #f4f4f4 !important;
  background: #f4f4f4 !important;
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

.prediction-table-wrap {
  border: 1px solid #343434;
  border-radius: 16px;
  overflow: hidden;
  background: #151515;
}

.prediction-table-wrap :deep(.el-input__wrapper) {
  min-height: 32px;
  border-radius: 10px !important;
  background: #101010 !important;
}

.prediction-table-wrap :deep(.el-table__cell) {
  height: 50px;
  padding: 8px 0;
}

.prediction-value {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  color: #f4f4f4;
  font-weight: 650;
}

.row-delete-button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  color: #a8a8a8;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.row-delete-button:hover {
  color: #f4f4f4;
  background: #303030;
  transform: translateY(-1px);
}

.row-delete-icon {
  display: none;
  font-size: 16px;
}

.prediction-table-wrap :deep(.el-table__row:hover) .row-index {
  display: none;
}

.prediction-table-wrap :deep(.el-table__row:hover) .row-delete-icon {
  display: inline-flex;
}

.prediction-footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px 12px;
  border-top: 1px solid #343434;
}

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

.artifact-box {
  height: 360px;
}

.report-visual {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.report-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.report-summary-card,
.report-section,
.report-block {
  border: 1px solid #343434;
  border-radius: 16px;
  background: #101010;
}

.report-summary-card {
  min-width: 0;
  padding: 12px;
}

.report-summary-card span,
.report-section > span,
.report-metric-card span,
.report-block-head span {
  display: block;
  color: #9a9a9a;
  font-size: 12px;
}

.report-summary-card strong {
  display: block;
  margin-top: 7px;
  color: #f4f4f4;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.report-section {
  padding: 14px;
}

.report-section.inline {
  padding: 0;
  border: 0;
  background: transparent;
}

.report-section p {
  margin: 8px 0 0;
  color: #e8e8e8;
  line-height: 1.7;
}

.report-section ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #e8e8e8;
  line-height: 1.7;
}

.report-advice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.report-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.report-tags span {
  max-width: 100%;
  padding: 6px 10px;
  border: 1px solid #343434;
  border-radius: 999px;
  color: #e8e8e8;
  background: #181818;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.report-block {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.report-block-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.report-block-head strong {
  display: block;
  color: #f4f4f4;
  font-size: 15px;
}

.report-block-head span {
  margin-top: 4px;
}

.report-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.report-metric-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid #343434;
  border-radius: 14px;
  background: #181818;
}

.report-metric-card strong {
  display: block;
  margin-top: 7px;
  color: #e8e8e8;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.report-note {
  padding: 12px;
  border: 1px solid #343434;
  border-radius: 14px;
  color: #e8e8e8;
  background: #181818;
  font-size: 13px;
  line-height: 1.6;
}

.report-table {
  overflow: hidden;
  border: 1px solid #343434;
  border-radius: 14px;
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
    min-height: 0;
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

  .panel-head {
    flex-direction: column;
  }

  .status-strip,
  .review-meta,
  .report-summary-grid,
  .report-advice-grid,
  .report-metric-grid {
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
