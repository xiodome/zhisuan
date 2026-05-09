<template>
  <div class="agent-console">
    <aside class="task-rail">
      <el-button type="primary" class="new-task-button-v2" @click="openCreateDialog">
        <el-icon style="margin-right: 4px;"><Plus /></el-icon>
        创建任务
      </el-button>

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
              <el-button
                v-if="['RUNNING', 'READY_TO_RESUME', 'WAITING_HUMAN'].includes(lifecycleStatus)"
                type="danger"
                plain
                :loading="cancelling"
                @click="cancelSelectedTask"
              >
                <el-icon><CircleCloseFilled /></el-icon>
                取消
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

          <div class="progress-overview">
            <div class="progress-overview-item">
              <span>当前智能体</span>
              <strong>{{ currentStageTitle }}</strong>
            </div>
            <div class="progress-overview-item">
              <span>总体进度</span>
              <strong>{{ overallProgress }}%</strong>
            </div>
            <div class="progress-overview-item">
              <span>执行状态</span>
              <strong>{{ lifecycleStatus }}</strong>
            </div>
          </div>

          <el-progress class="main-progress" :percentage="overallProgress" :status="progressBarStatus" />
          <el-alert
            v-if="lifecycleStatus === 'FAILED'"
            type="error"
            :closable="false"
            show-icon
            :title="`任务执行失败：${failedStageTitle}`"
            class="failed-stage-alert"
          />

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

        <section v-if="lifecycleStatus === 'COMPLETED'" class="inspector-card">
          <div class="panel-head compact">
            <div>
              <div class="panel-title">预测接口 (Web Demo)</div>
              <div class="panel-subtitle">手动输入特征值进行实时预测，或使用批量表格预测。</div>
            </div>
          </div>

          <el-tabs v-model="predictMode" class="demo-tabs">
            <el-tab-pane label="实时 Web Demo" name="single">
              <div v-if="predictionColumns.length" class="web-demo-form">
                <el-form label-position="top" class="demo-grid">
                  <el-form-item v-for="column in predictionColumns" :key="column" :label="column">
                    <el-input v-model="singlePredictForm[column]" placeholder="请输入..." />
                  </el-form-item>
                </el-form>
                <div class="demo-actions">
                  <el-button plain @click="fillSinglePredictSample">填入样例</el-button>
                  <el-button 
                    type="primary" 
                    :loading="predicting" 
                    @click="runSinglePrediction"
                  >
                    <el-icon><Position /></el-icon> 发送预测请求
                  </el-button>
                </div>
                <div v-if="singlePredictResult !== null" class="demo-result success">
                  <strong>预测结果：</strong> <span>{{ formatPredictionValue(singlePredictResult) }}</span>
                </div>
                <div v-if="singlePredictError" class="demo-result error">
                  <el-icon><WarningFilled /></el-icon> {{ singlePredictError }}
                </div>
              </div>
              <div v-else class="modal-empty">正在加载模型特征...</div>
            </el-tab-pane>

            <el-tab-pane label="批量测试 (Batch)" name="batch">
              <div class="panel-actions" style="margin-bottom: 12px; justify-content: flex-end;">
                <el-button plain @click="openPredictionJsonDialog">JSON 导入</el-button>
                <el-button plain :disabled="!predictionRows.length" @click="addPredictionRow">新增行</el-button>
                <el-button plain :disabled="!predictionRows.length" @click="exportPredictionJson">导出 JSON</el-button>
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
                <el-button plain :disabled="!currentReport && !previewRows.length" @click="fillPredictionSample">填入批量样例</el-button>
                <el-button
                  type="primary"
                  :disabled="lifecycleStatus !== 'COMPLETED' || !predictionRows.length"
                  :loading="predicting"
                  @click="runPrediction"
                >
                  <el-icon><Position /></el-icon>
                  批量预测
                </el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </section>

        <section v-if="lifecycleStatus === 'COMPLETED'" class="inspector-card">
          <div class="panel-head compact">
            <div>
              <div class="panel-title">任务产物</div>
              <div class="panel-subtitle">报告、代码和任务产物。</div>
            </div>
          </div>

          <div class="artifact-actions">
            <el-button plain :class="{ active: artifactMode === 'report' }" :disabled="!currentTaskId" @click="loadReport">报告</el-button>
            <el-button plain :class="{ active: artifactMode === 'code' }" :disabled="!currentTaskId || !canReview" @click="loadCode">代码</el-button>
            <el-button plain :disabled="!currentTaskId || !canReview" @click="downloadTaskArtifacts">下载产物包</el-button>
            <el-button plain :disabled="!currentReport" @click="exportReportJson">导出 JSON</el-button>
            <el-button type="primary" plain :disabled="!currentReport" @click="downloadReportPDF">导出 PDF</el-button>
            <el-button type="info" plain :disabled="!currentReport" @click="downloadReportMD">导出 MD</el-button>
          </div>

          <div v-if="artifactMode === 'report' && currentReport" class="report-visual" id="report-content">
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

            <div v-if="reportFeatureImportance.length" class="report-section" style="height: 350px;">
              <span style="margin-bottom: 10px; display: block;">特征重要性 (Feature Importance)</span>
              <v-chart class="chart" :option="featureImportanceChartOption" autoresize />
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
            </div>
          </div>

          <div v-else-if="artifactMode === 'code'" class="code-visual">
             <vue-monaco-editor
                v-model:value="artifactText"
                theme="vs-dark"
                language="python"
                :options="{ readOnly: true, minimap: { enabled: false } }"
                height="500px"
              />
          </div>

          <pre v-else class="artifact-box">{{ artifactText || '任务完成后查看产物。' }}</pre>
        </section>
      </template>
    </main>

    <el-dialog v-model="createDialogVisible" title="创建任务" width="980px" top="4vh" class="agent-dialog create-task-dialog">
      <div class="create-shell">
        <section class="create-section">
          <div class="create-section-head">
            <div>
              <div class="panel-title">1. 需求输入与解析</div>
              <div class="panel-subtitle">提交文本给后端解析，并确认解析结果后再创建任务。</div>
            </div>
            <div class="panel-actions">
              <el-button plain :loading="parsingRequirement" @click="parseRequirementText">
                <el-icon><MagicStick /></el-icon>
                提交解析
              </el-button>
              <el-button type="primary" plain :disabled="!parsedResultRaw" @click="confirmParsedRequirement">
                确认解析
              </el-button>
            </div>
          </div>

          <el-form label-position="top">
            <el-form-item label="建模需求">
              <el-input
                v-model="draftTaskDesc"
                type="textarea"
                :rows="5"
                maxlength="800"
                resize="none"
                show-word-limit
                placeholder="例如：根据客户年龄、收入和城市预测 bought 字段。"
              />
            </el-form-item>
          </el-form>

          <el-alert
            v-if="parseResultNotice"
            class="section-alert"
            :title="parseResultNotice"
            :type="parseSource === 'mock' ? 'warning' : 'success'"
            :closable="false"
            show-icon
          />

          <div v-if="parsedResultRaw" class="parse-panel">
            <el-descriptions border :column="2">
              <el-descriptions-item label="任务类型">{{ parsedTaskType || '-' }}</el-descriptions-item>
              <el-descriptions-item label="目标列">{{ parsedTargetColumn || '-' }}</el-descriptions-item>
              <el-descriptions-item label="确认状态">{{ parsedConfirmed ? '已确认' : '待确认' }}</el-descriptions-item>
              <el-descriptions-item label="解析来源">{{ parseSource === 'mock' ? '前端回退' : '后端接口' }}</el-descriptions-item>
            </el-descriptions>
          </div>
        </section>

        <section class="create-section">
          <div class="create-section-head">
            <div>
              <div class="panel-title">2. 数据集上传</div>
            </div>
          </div>
          <el-upload
            class="upload-dropzone"
            drag
            :show-file-list="false"
            accept=".csv,text/csv"
            :before-upload="beforeCsvUpload"
            :http-request="handleDatasetUpload"
          >
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖拽 CSV 到这里，或 <em>点击上传</em></div>
          </el-upload>
          <el-progress v-if="uploadingDataset || uploadProgress > 0" class="upload-progress" :percentage="uploadProgress" />
        </section>

        <section class="create-section">
          <div class="create-section-head">
            <div>
              <div class="panel-title">3. 运行模式</div>
            </div>
          </div>
          <div class="run-mode">
            <span>Mode</span>
            <el-switch v-model="draftRunOffline" inline-prompt active-text="离线" inactive-text="LLM" />
          </div>
        </section>

        <section v-if="canReview" class="create-section">
          <div class="create-section-head">
            <div>
              <div class="panel-title">4. 中间审核设置（HITL）</div>
            </div>
          </div>
          <el-checkbox-group v-model="selectedHitlStages">
            <el-checkbox v-for="item in hitlOptions" :key="item.value" :label="item.value">
              {{ item.label }}
            </el-checkbox>
          </el-checkbox-group>
        </section>
      </div>

      <template #footer>
        <el-button plain @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createAndRunTask">确认并开始运行</el-button>
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
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" :title="`人工审核确认 - ${reviewStageLabel}`" width="850px" class="agent-dialog">
      <div v-if="pendingReview" class="review-body">
        <template v-if="pendingReview.review_stage === 'parse_review'">
          <el-alert title="请核对 AI 解析出的任务类型与目标列，可直接修改。" type="info" show-icon :closable="false" />
          <el-form label-position="left" label-width="100px" style="margin-top: 15px;">
            <el-form-item label="任务类型">
              <el-select v-model="editPayload.task_type">
                <el-option label="二分类 (Binary Classification)" value="classification" />
                <el-option label="回归 (Regression)" value="regression" />
              </el-select>
            </el-form-item>
            <el-form-item label="目标列">
              <el-input v-model="editPayload.target_column" />
            </el-form-item>
          </el-form>
        </template>

        <template v-else-if="pendingReview.review_stage === 'feature_review'">
          <el-alert title="请确认数据预处理策略，必要时进行调整。" type="info" show-icon :closable="false" />
          <el-form label-position="top" style="margin-top: 15px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <el-form-item label="数值列缺失值填充">
                <el-select v-model="editPayload.numeric_missing_strategy">
                  <el-option label="均值填充 (mean)" value="mean" />
                  <el-option label="中位数填充 (median)" value="median" />
                  <el-option label="填 0 (constant_0)" value="constant_0" />
                </el-select>
              </el-form-item>
              <el-form-item label="类别列缺失值填充">
                <el-select v-model="editPayload.categorical_missing_strategy">
                  <el-option label="众数填充 (mode)" value="mode" />
                  <el-option label="视为单独类 (unknown)" value="unknown" />
                </el-select>
              </el-form-item>
              <el-form-item label="特征编码方法">
                <el-select v-model="editPayload.categorical_encoding_strategy">
                  <el-option label="独热编码 (One-Hot)" value="onehot" />
                  <el-option label="标签编码 (Label)" value="label" />
                </el-select>
              </el-form-item>
            </div>
          </el-form>
        </template>

        <template v-else-if="pendingReview.review_stage === 'code_review'">
          <el-alert title="Agent 已生成执行代码，您可以在下方直接编辑并保存。" type="warning" show-icon :closable="false" />
          <div style="margin-top: 10px; border: 1px solid var(--zs-border); border-radius: 8px; overflow: hidden;">
            <vue-monaco-editor
              v-model:value="editPayload.code"
              theme="vs-dark"
              language="python"
              :options="{ minimap: { enabled: false }, fontSize: 13 }"
              height="400px"
            />
          </div>
        </template>

        <template v-else>
          <pre class="review-payload">{{ formattedReview }}</pre>
          <el-form-item label="补丁 JSON">
            <el-input v-model="patchText" type="textarea" :rows="4" />
          </el-form-item>
        </template>

        <el-form label-position="top" style="margin-top: 15px;">
          <el-form-item label="审核意见 (可选)">
            <el-input v-model="reviewComment" type="textarea" :rows="2" placeholder="记录本次人工判断。" />
          </el-form-item>
        </el-form>
      </div>
      <div v-else class="modal-empty">当前没有待审核内容</div>

      <template #footer>
        <el-button plain @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="warning" plain @click="submitReviewAndResume('edit_and_continue')">
          保存修改
        </el-button>
        <el-button
          type="primary"
          :disabled="!pendingReview || !canReview"
          :loading="reviewing"
          @click="submitReviewAndResume('approve')"
        >
          确认继续
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="predictionJsonDialogVisible" title="JSON 导入" width="720px" class="agent-dialog">
      <el-input v-model="predictionJsonText" type="textarea" :rows="12" resize="none" placeholder='[{"feature1": 1.0}]' />
      <template #footer>
        <el-button plain @click="predictionJsonDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmPredictionJsonImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/user'
// [引入 ECharts, Monaco, Html2Pdf]
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, TitleComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import VueMonacoEditor from '@guolao/vue-monaco-editor'
import html2pdf from 'html2pdf.js'

use([TooltipComponent, GridComponent, TitleComponent, BarChart, CanvasRenderer])

import {
  cancelAgentTask,
  createAgentTask,
  downloadAgentTaskArtifacts,
  fetchAgentCode,
  fetchAgentProgress,
  fetchAgentReport,
  fetchAgentTask,
  fetchAgentTasks,
  fetchDatasetPreview,
  fetchPendingReview,
  parseAgentTaskDescription,
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
const taskRunModeMap = ref({})
const loadingTasks = ref(false)
const loadingProgress = ref(false)
const creating = ref(false)
const running = ref(false)
const reviewing = ref(false)
const predicting = ref(false)
const cancelling = ref(false)
const createDialogVisible = ref(false)
const previewDialogVisible = ref(false)
const reviewDialogVisible = ref(false)
const draftTaskDesc = ref('')
const draftDatasetId = ref(null)
const draftDatasetName = ref('')
const draftPreviewRows = ref([])
const draftRunOffline = ref(true)
const parsingRequirement = ref(false)
const parsedResultRaw = ref(null)
const parsedConfirmed = ref(false)
const parseSource = ref('')
const parseResultNotice = ref('')
const uploadingDataset = ref(false)
const uploadProgress = ref(0)
const selectedHitlStages = ref([])
const pendingReview = ref(null)
const reviewComment = ref('')
const patchText = ref('')
let runPollTimer = null
let listRefreshTimer = null

// Web Demo 与 HITL 新增状态
const predictMode = ref('single')
const singlePredictForm = ref({})
const singlePredictResult = ref(null)
const singlePredictError = ref('')
const editPayload = ref({})

const canReview = computed(() => ['ADMIN', 'DEVELOPER'].includes(userStore.role))
const hitlOptions = [
  { value: 'parse_review', label: '需求解析后' },
  { value: 'feature_review', label: '数据分析后' },
  { value: 'model_plan_review', label: '模型规划后' },
  { value: 'code_review', label: '代码生成后' }
]
const stageDefinitions = [
  { key: 'manager_parse', review: 'parse_review', title: 'Agent Manager', desc: '解析自然语言需求与目标字段', icon: 'Connection' },
  { key: 'data_analysis', review: 'feature_review', title: 'Data Agent', desc: '检查数据质量、列类型和缺失值', icon: 'DataAnalysis' },
  { key: 'model_plan', review: 'model_plan_review', title: 'Model Agent', desc: '规划模型、指标和训练策略', icon: 'Aim' },
  { key: 'model_training', review: null, title: 'Training Agent', desc: '训练轻量模型并计算指标', icon: 'Cpu' },
  { key: 'code_generation', review: 'code_review', title: 'Operation Agent', desc: '生成代码和预测接口', icon: 'Document' },
  { key: 'operation_report', review: null, title: 'Report Agent', desc: '输出报告、代码和可复用产物', icon: 'TrendCharts' }
]
const stageLabelMap = { pending: '等待', running: '进行中', done: '完成', failed: '失败', review: '待审核' }
const reviewStageTitleMap = Object.fromEntries(hitlOptions.map((item) => [item.value, item.label]))

const statusText = computed(() => {
  if (lifecycleStatus.value === 'WAITING_HUMAN') return '工作流已暂停，请在对应节点完成 HITL 审核。'
  if (lifecycleStatus.value === 'COMPLETED') return '任务已完成，可以查看产物并调用预测接口。'
  if (lifecycleStatus.value === 'FAILED') return `任务失败。`
  if (lifecycleStatus.value === 'CREATED') return '任务已创建，点击运行开始工作流。'
  return '工作流正在运行。'
})
const previewColumns = computed(() => previewRows.value[0] ? Object.keys(previewRows.value[0]) : [])
const draftPreviewColumns = computed(() => draftPreviewRows.value[0] ? Object.keys(draftPreviewRows.value[0]) : [])
const canRunTask = computed(() => ['CREATED', 'READY_TO_RESUME'].includes(lifecycleStatus.value))
const runButtonText = computed(() => (lifecycleStatus.value === 'READY_TO_RESUME' ? '继续运行' : '运行'))
const formattedReview = computed(() => JSON.stringify(pendingReview.value?.payload || pendingReview.value, null, 2))
const reviewStageLabel = computed(() => reviewStageTitleMap[pendingReview.value?.review_stage] || pendingReview.value?.review_stage || '-')
const parsedTaskType = computed(() => parsedResultRaw.value?.task_type || parsedResultRaw.value?.type || parsedResultRaw.value?.model_type || '')
const parsedTargetColumn = computed(() => parsedResultRaw.value?.target_column || parsedResultRaw.value?.target || parsedResultRaw.value?.label_column || '')

const activeStageKey = computed(() => {
  if (!currentStage.value) return ''
  const reviewMapped = stageDefinitions.find((item) => item.review === currentStage.value)?.key
  return reviewMapped || currentStage.value
})
const activeStageIndex = computed(() => stageDefinitions.findIndex((item) => item.key === activeStageKey.value))
const currentStageTitle = computed(() => {
  if (lifecycleStatus.value === 'COMPLETED') return 'Report'
  if (activeStageIndex.value < 0) return '-'
  return stageDefinitions[activeStageIndex.value].title
})
const failedStageTitle = computed(() => {
  if (lifecycleStatus.value !== 'FAILED') return ''
  if (activeStageIndex.value >= 0) return stageDefinitions[activeStageIndex.value].title
  return currentStage.value || '未知阶段'
})
const overallProgress = computed(() => {
  if (lifecycleStatus.value === 'COMPLETED') return 100
  if (activeStageIndex.value < 0) return lifecycleStatus.value === 'CREATED' ? 0 : 5
  const step = Math.round(100 / stageDefinitions.length)
  const base = activeStageIndex.value * step
  if (lifecycleStatus.value === 'FAILED') return Math.min(99, base + step)
  if (lifecycleStatus.value === 'WAITING_HUMAN') return Math.min(99, base + Math.round(step * 0.75))
  if (lifecycleStatus.value === 'RUNNING') return Math.min(99, base + Math.round(step * 0.5))
  return Math.min(99, base)
})
const progressBarStatus = computed(() => {
  if (lifecycleStatus.value === 'FAILED') return 'exception'
  if (lifecycleStatus.value === 'COMPLETED') return 'success'
  return undefined
})
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

// ECharts 特征重要性配置
const featureImportanceChartOption = computed(() => {
  const data = [...reportFeatureImportance.value].sort((a, b) => a.importance - b.importance);
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', boundaryGap: [0, 0.01] },
    yAxis: { type: 'category', data: data.map(item => item.feature) },
    series: [
      {
        type: 'bar',
        data: data.map(item => item.importance),
        itemStyle: { color: '#5470C6', borderRadius: [0, 4, 4, 0] }
      }
    ]
  }
})

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
  const columns = currentReport.value?.feature_columns || reportData.value?.feature_columns || reportModelResult.value?.feature_columns
  return Array.isArray(columns) ? columns : []
})
const reportTargetColumn = computed(() => currentReport.value?.target_column || currentTask.value?.target_column || '-')
const reportTaskType = computed(() => currentReport.value?.task_type || currentTask.value?.task_type || '-')

const reportSummaryCards = computed(() => [
  { label: '任务 ID', value: currentReport.value?.task_id || currentTaskId.value || '-' },
  { label: '任务类型', value: reportTaskType.value },
  { label: '目标列', value: reportTargetColumn.value },
  { label: '评估指标', value: reportMetrics.value.metric || reportModelPlan.value.primary_metric || '-' },
  { label: '指标得分', value: formatReportValue(reportMetrics.value.score ?? reportMetrics.value[reportModelPlan.value.primary_metric]) },
  { label: '特征数量', value: String(reportFeatureColumns.value.length) }
])
const reportBestModelName = computed(() => reportModelResult.value?.best_model?.model_name || reportModelPlan.value?.model_name || '-')
const reportTrainingCards = computed(() => {
  const metrics = reportMetrics.value
  const cards = [
    { label: '最佳模型', value: reportBestModelName.value },
    { label: '主指标', value: metrics.metric || reportModelPlan.value.primary_metric || '-' },
    { label: '训练行数', value: formatReportValue(metrics.train_rows ?? reportModelResult.value?.train_size) },
    { label: '测试行数', value: formatReportValue(reportModelResult.value?.test_size) }
  ]
  return cards
})
const reportCandidateModels = computed(() => Array.isArray(reportModelResult.value?.candidate_models) ? reportModelResult.value.candidate_models : [])
const reportCandidateMetricColumns = computed(() => {
  const columns = new Set()
  reportCandidateModels.value.forEach((model) => Object.keys(model.metrics || {}).forEach((key) => columns.add(key)))
  return Array.from(columns)
})
const reportDataCards = computed(() => [
  { label: '数据行数', value: formatReportValue(reportData.value?.row_count) },
  { label: '字段数量', value: formatReportValue(reportData.value?.column_count || reportData.value?.columns?.length) },
  { label: '目标均值', value: formatReportValue(reportData.value?.target_mean) }
].filter((item) => item.value !== '-'))
const reportSelectionReason = computed(() => reportData.value?.selection_reason || reportData.value?.llm_output?.selection_reason || '')
const reportNumericColumns = computed(() => Array.isArray(reportData.value?.numeric_columns) ? reportData.value.numeric_columns : [])
const reportRecommendations = computed(() => Array.isArray(currentReport.value?.recommendations) ? currentReport.value.recommendations : [])
const reportRiskNotes = computed(() => Array.isArray(currentReport.value?.risk_notes) ? currentReport.value.risk_notes : [])
const reportFeatureImportance = computed(() => Array.isArray(reportModelTraining.value?.feature_importance || currentReport.value?.feature_importance) ? (reportModelTraining.value?.feature_importance || currentReport.value?.feature_importance) : [])

const stages = computed(() => {
  const reviewStage = lifecycleStatus.value === 'WAITING_HUMAN' ? currentStage.value : ''
  const activeNode = reviewStage ? stageDefinitions.find((item) => item.review === reviewStage)?.key : currentStage.value
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

const normalizeDatasetId = (result) => result?.dataset_id || result?.id || result?.dataset?.id
const normalizeRows = (preview) => Array.isArray(preview) ? preview : Array.isArray(preview?.rows) ? preview.rows : []
const normalizeTaskId = (task) => task?.task_id || task?.id
const guessTaskType = (text) => /(分类|是否|欺诈)/.test(`${text}`.toLowerCase()) ? 'classification' : 'regression'
const guessTargetColumn = (text) => {
  const matched = `${text}`.match(/预测\s*([a-zA-Z_][\w]*)/i)
  return matched?.[1] || ''
}
const formatPredictionValue = (value) => value === undefined || value === null || value === '' ? '-' : typeof value === 'object' ? JSON.stringify(value) : String(value)
const formatReportValue = (value) => value === undefined || value === null || value === '' ? '-' : typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(4) : String(value)
const downloadJson = (value, filename) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
}

const syncTaskState = (task) => {
  if (!task) return
  const nextTaskId = String(normalizeTaskId(task) || currentTaskId.value || '')
  currentTask.value = { ...(currentTask.value || {}), ...task, task_id: nextTaskId }
  currentTaskId.value = nextTaskId
  datasetId.value = task.dataset_id || datasetId.value
  lifecycleStatus.value = task.status || task.lifecycle_status || lifecycleStatus.value
  currentStage.value = task.current_stage || task.stage || currentStage.value
  if (nextTaskId && taskRunModeMap.value[nextTaskId] !== undefined) runOffline.value = taskRunModeMap.value[nextTaskId]
}

const openCreateDialog = () => {
  draftTaskDesc.value = ''
  draftDatasetId.value = null
  createDialogVisible.value = true
}

const openPreviewDialog = async () => {
  const id = draftDatasetId.value || datasetId.value
  if (!id) return ElMessage.warning('请先上传数据集')
  try {
    previewRows.value = normalizeRows(await fetchDatasetPreview(id)).slice(0, 20)
    previewDialogVisible.value = true
  } catch (error) { ElMessage.error('预览失败') }
}

const parseRequirementText = async () => {
  parsingRequirement.value = true
  try {
    const text = draftTaskDesc.value.trim()
    const result = await parseAgentTaskDescription(text)
    const parsed = result?.data?.parsed_result || result || {}
    parsedResultRaw.value = { task_type: parsed.task_type || guessTaskType(text), target_column: parsed.target_column || guessTargetColumn(text) }
    parseSource.value = 'remote'
    parseResultNotice.value = '解析成功，请确认。'
  } catch {
    parsedResultRaw.value = { task_type: guessTaskType(draftTaskDesc.value), target_column: guessTargetColumn(draftTaskDesc.value) }
    parseSource.value = 'mock'
    parseResultNotice.value = '已切换到前端模拟解析结果。'
  } finally { parsingRequirement.value = false }
}

const confirmParsedRequirement = () => { parsedConfirmed.value = true; ElMessage.success('解析结果已确认') }

const beforeCsvUpload = (file) => {
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') return ElMessage.error('仅支持 CSV 文件') && false
  return true
}

const handleDatasetUpload = async ({ file, onSuccess, onError }) => {
  uploadingDataset.value = true
  try {
    const result = await uploadAgentDataset(file, (p) => uploadProgress.value = Number(p))
    draftDatasetId.value = normalizeDatasetId(result)
    ElMessage.success('上传成功')
    onSuccess?.(result)
  } catch (error) { ElMessage.error('上传失败'); onError?.(error) } finally { uploadingDataset.value = false }
}

const createAndRunTask = async () => {
  if (!parsedConfirmed.value || !draftTaskDesc.value.trim() || !draftDatasetId.value) return ElMessage.warning('请完善表单并确认解析')
  creating.value = true
  try {
    const task = await createAgentTask({ dataset_id: Number(draftDatasetId.value), task_description: draftTaskDesc.value.trim(), hitl: canReview.value ? selectedHitlStages.value : [] })
    syncTaskState(task)
    const nextTaskId = String(normalizeTaskId(task))
    if (nextTaskId) taskRunModeMap.value[nextTaskId] = draftRunOffline.value
    runOffline.value = draftRunOffline.value
    createDialogVisible.value = false
    await runAgentTask(currentTaskId.value, { offline: runOffline.value })
    await loadTasks(false, true)
    startRunPolling()
  } catch (error) { ElMessage.error('创建启动失败') } finally { creating.value = false }
}

const runSelectedTask = async () => {
  running.value = true
  try {
    const fn = lifecycleStatus.value === 'READY_TO_RESUME' ? resumeAgentTask : runAgentTask
    const result = await fn(currentTaskId.value, { offline: runOffline.value })
    syncTaskState(result)
    startRunPolling()
  } catch (error) { ElMessage.error('启动失败') } finally { running.value = false }
}

const cancelSelectedTask = async () => {
  cancelling.value = true
  try {
    await cancelAgentTask(currentTaskId.value)
    lifecycleStatus.value = 'CANCELLED'
  } catch (error) { ElMessage.error('取消失败') } finally { cancelling.value = false }
}

const loadTasks = async (selectLatest = false, silent = false) => {
  loadingTasks.value = true
  try {
    const result = await fetchAgentTasks()
    taskList.value = (Array.isArray(result) ? result : result?.list || []).map(t => ({ ...t, task_id: String(normalizeTaskId(t)) }))
    if (selectLatest && taskList.value.length && !currentTaskId.value) selectTask(taskList.value[0].task_id)
  } catch (error) { if (!silent) ElMessage.error('列表加载失败') } finally { loadingTasks.value = false }
}

const selectTask = async (taskId) => {
  if (!taskId) return
  try {
    const task = await fetchAgentTask(taskId)
    syncTaskState(task)
    if (task.status === 'WAITING_HUMAN') await loadPendingReview(false)
    if (task.status === 'COMPLETED') await loadReport()
    if (['RUNNING', 'READY_TO_RESUME', 'CREATED'].includes(task.status)) startRunPolling()
    else clearInterval(runPollTimer)
  } catch (error) { ElMessage.error('加载详情失败') }
}

const loadProgress = async (silent = false) => {
  loadingProgress.value = true
  try {
    const progress = await fetchAgentProgress(currentTaskId.value)
    syncTaskState(progress)
    if (lifecycleStatus.value === 'WAITING_HUMAN') await loadPendingReview(true)
  } catch (error) { if (!silent) ElMessage.error('进度加载失败') } finally { loadingProgress.value = false }
}

// ================= HITL 逻辑 =================
const loadPendingReview = async (silent = false) => {
  try {
    pendingReview.value = await fetchPendingReview(currentTaskId.value)
    editPayload.value = JSON.parse(JSON.stringify(pendingReview.value?.payload || {}))
  } catch (error) { pendingReview.value = null; if (!silent) ElMessage.warning('没有待审核内容') }
}

const openReviewDialog = async () => {
  await loadPendingReview(false)
  reviewComment.value = ''
  reviewDialogVisible.value = true
}

const submitReviewAndResume = async (actionType) => {
  reviewing.value = true
  try {
    const isEdit = actionType === 'edit_and_continue'
    await submitAgentReview(currentTaskId.value, {
      action: actionType,
      patch: isEdit ? editPayload.value : null,
      comment: reviewComment.value.trim(),
      auto_resume: !isEdit,
      offline: runOffline.value
    })
    if (actionType === 'approve') {
      reviewDialogVisible.value = false
      pendingReview.value = null
      const result = await resumeAgentTask(currentTaskId.value, { offline: runOffline.value })
      syncTaskState(result)
      startRunPolling()
    } else {
      ElMessage.success('修改已临时保存到后端')
    }
  } catch (error) { ElMessage.error('审核提交失败') } finally { reviewing.value = false }
}

// ================= 报告与代码 =================
const loadReport = async () => {
  try {
    currentReport.value = await fetchAgentReport(currentTaskId.value)
    artifactMode.value = 'report'
    if (!predictionRows.value.length) fillPredictionSample()
  } catch (error) { ElMessage.error('报告加载失败') }
}

const loadCode = async () => {
  try {
    const code = await fetchAgentCode(currentTaskId.value)
    artifactText.value = typeof code === 'string' ? code : code?.python_code || JSON.stringify(code, null, 2)
    artifactMode.value = 'code'
  } catch (error) { ElMessage.error('代码加载失败') }
}

// ================= 预测 Web Demo =================
const fillPredictionSample = () => {
  predictionRows.value = (previewRows.value.slice(0, 5)).map((row, index) => {
    const features = {}; predictionColumns.value.forEach(col => features[col] = row[col] ?? '')
    return { id: `sample_${Date.now()}_${index}`, features, prediction: '' }
  })
}

const fillSinglePredictSample = () => {
  if (previewRows.value.length > 0) {
    predictionColumns.value.forEach(col => singlePredictForm.value[col] = previewRows.value[0][col] ?? '')
  } else { ElMessage.warning('暂无数据可以提取样例') }
}

const runSinglePrediction = async () => {
  singlePredictError.value = ''; singlePredictResult.value = null; predicting.value = true
  try {
    const result = await predictAgentTask(currentTaskId.value, { features: [{ ...singlePredictForm.value }] })
    const records = Array.isArray(result?.predictions) ? result.predictions : []
    singlePredictResult.value = records[0]?.prediction ?? (Array.isArray(result?.prediction) ? result.prediction[0] : result?.prediction)
  } catch (error) { singlePredictError.value = error.message || 'API 调用失败或模型尚未就绪' } finally { predicting.value = false }
}

const runPrediction = async () => {
  predicting.value = true
  try {
    const rows = predictionRows.value.map(r => r.features)
    const result = await predictAgentTask(currentTaskId.value, { features: rows })
    const records = Array.isArray(result?.predictions) ? result.predictions : []
    predictionRows.value = predictionRows.value.map((r, i) => ({ ...r, prediction: records[i]?.prediction ?? (Array.isArray(result?.prediction) ? result.prediction[i] : result?.prediction) }))
  } catch (error) { ElMessage.error('批量预测失败') } finally { predicting.value = false }
}

// 其他弹窗功能（保持原有精简）
const openPredictionJsonDialog = () => { predictionJsonDialogVisible.value = true }
const confirmPredictionJsonImport = () => {
  try { predictionRows.value = JSON.parse(predictionJsonText.value).map((r, i) => ({ id: `json_${i}`, features: r, prediction: '' })); predictionJsonDialogVisible.value = false }
  catch { ElMessage.error('JSON 格式不正确') }
}
const addPredictionRow = () => {
  const features = {}; predictionColumns.value.forEach(c => features[c] = '')
  predictionRows.value.push({ id: `manual_${Date.now()}`, features, prediction: '' })
}
const removePredictionRow = (id) => { predictionRows.value = predictionRows.value.filter(r => r.id !== id) }
const exportPredictionJson = () => downloadJson(predictionRows.value.map(r => ({ ...r.features, prediction: r.prediction })), 'predictions.json')
const exportReportJson = () => downloadJson(currentReport.value, 'report.json')
const downloadTaskArtifacts = async () => {
  try { const response = await downloadAgentTaskArtifacts(currentTaskId.value); const blob = new Blob([response.data], { type: 'application/zip' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'artifacts.zip'; document.body.appendChild(link); link.click(); URL.revokeObjectURL(url) }
  catch (error) { ElMessage.error('下载失败') }
}

// ================= PDF & MD 导出 =================
const downloadReportPDF = () => {
  const element = document.getElementById('report-content')
  if (!element) return ElMessage.error('找不到报告 DOM')
  html2pdf().from(element).set({
    margin: [10, 10, 10, 10],
    filename: `Report_${currentTaskId.value}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).save()
}
const downloadReportMD = () => {
  const mdContent = `
# 智算模型执行报告
**任务 ID**: ${currentTaskId.value}
**任务类型**: ${reportTaskType.value}
**目标列**: ${reportTargetColumn.value}

## 1. 摘要
${currentReport.value?.summary || '暂无摘要'}

## 2. 评估指标
- 最佳模型: ${reportBestModelName.value}
- ${reportMetrics.value.metric || '主指标'}: ${reportMetrics.value.score ?? '-'}

## 3. 使用建议
${reportRecommendations.value.map(r => '- ' + r).join('\n')}
  `
  const blob = new Blob([mdContent.trim()], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Report_${currentTaskId.value}.md`
  document.body.appendChild(link); link.click(); URL.revokeObjectURL(url)
}

const startRunPolling = () => {
  clearInterval(runPollTimer)
  runPollTimer = setInterval(async () => {
    if (['COMPLETED', 'FAILED', 'CANCELLED', 'WAITING_HUMAN'].includes(lifecycleStatus.value)) {
      clearInterval(runPollTimer)
      if (lifecycleStatus.value === 'WAITING_HUMAN') await loadPendingReview(true)
      if (lifecycleStatus.value === 'COMPLETED') await loadReport()
      return
    }
    await loadProgress(true)
  }, 2500)
}

onMounted(() => { loadTasks(false, true) })
onBeforeUnmount(() => { clearInterval(runPollTimer) })
</script>

<style scoped>
/* 保持你原本绝大多数 CSS 不变，追加下面这些新样式 */
.agent-console { height: 100vh; display: grid; grid-template-columns: 300px minmax(0, 1fr); }
.task-rail { border-right: 1px solid var(--zs-border); padding: 18px 16px; display: flex; flex-direction: column; }
.agent-main { padding: 30px 42px; overflow: auto; }
.task-item { width: 100%; text-align: left; padding: 10px; margin-bottom: 5px; border-radius: 8px; border:none; cursor: pointer; background: transparent;}
.task-item:hover, .task-item.active { background: var(--zs-panel-soft); }

/* =========== 新版直观的“创建任务”按钮样式 =========== */
.new-task-button-v2 {
  width: 100%;
  height: 40px;
  margin-bottom: 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* =================================================== */

.task-card, .workflow-panel, .inspector-card {
  max-width: 1080px; margin: 0 auto 18px; padding: 18px;
  border: 1px solid var(--zs-border); border-radius: 24px; background: var(--zs-panel);
}
.status-strip { max-width: 1080px; margin: 0 auto 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.status-card { padding: 14px; border: 1px solid var(--zs-border); border-radius: 16px; background: var(--zs-panel-soft); }
.panel-head { display: flex; justify-content: space-between; margin-bottom: 14px; }
.panel-actions, .artifact-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.stage-item { display: grid; grid-template-columns: 38px 1fr auto; gap: 12px; padding: 12px; border: 1px solid var(--zs-border); border-radius: 16px; margin-bottom: 8px; }

/* 报告与图表 */
.report-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;}
.report-summary-card { padding: 12px; border: 1px solid var(--zs-border); border-radius: 16px; }
.report-section { padding: 14px; border: 1px solid var(--zs-border); border-radius: 16px; margin-bottom: 12px; }
.chart { width: 100%; height: 100%; min-height: 300px; }

/* Web Demo 专属样式 */
.demo-tabs { margin-top: 10px; }
.web-demo-form { padding: 18px; border: 1px solid var(--zs-border); border-radius: 12px; background: var(--zs-panel-soft); }
.demo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
.demo-actions { margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; }
.demo-result { margin-top: 16px; padding: 12px 16px; border-radius: 8px; font-size: 14px; }
.demo-result.success { background: rgba(125, 211, 167, 0.15); border: 1px solid var(--zs-success); color: var(--zs-text); }
.demo-result.error { background: rgba(255, 138, 138, 0.15); border: 1px solid var(--zs-danger); color: var(--zs-danger); }
.prediction-table-wrap { border: 1px solid var(--zs-border); border-radius: 16px; overflow: hidden; }

/* Monaco 样式修复 */
.code-visual { border: 1px solid var(--zs-border); border-radius: 8px; overflow: hidden; }

/* ================= 补回丢失的弹窗排版样式 ================= */
.create-task-dialog :deep(.el-dialog__body) { max-height: calc(100vh - 220px); overflow: auto; }
.create-shell { display: grid; gap: 14px; }
.create-section { padding: 14px; border: 1px solid var(--zs-border); border-radius: 16px; background: var(--zs-panel-soft); }
.create-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.run-mode { display: flex; align-items: center; gap: 10px; color: var(--zs-muted); font-size: 13px; }
.upload-dropzone :deep(.el-upload-dragger) { width: 100%; }
.upload-icon { margin-bottom: 4px; }
.upload-progress { margin-top: 10px; }
.section-alert { margin-bottom: 10px; }
.parse-panel { margin-top: 12px; }
.modal-empty { padding: 18px 8px; color: var(--zs-muted); font-size: 13px; }
</style>