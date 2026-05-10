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

        <section class="task-card task-desc-card">
          <div class="panel-head task-desc-head">
            <div>
              <div class="panel-title">任务描述</div>
              <div class="panel-subtitle task-desc-text">{{ currentTask?.task_description || '暂无描述' }}</div>
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
              <span class="overview-label">当前智能体</span>
              <strong class="overview-value">{{ currentStageTitle }}</strong>
            </div>
            <div class="progress-overview-item">
              <span class="overview-label">总体进度</span>
              <strong class="overview-value">{{ overallProgress }}%</strong>
            </div>
            <div class="progress-overview-item" :class="`status-${String(lifecycleStatus || '').toLowerCase()}`">
              <span class="overview-label">执行状态</span>
              <strong class="overview-value">{{ lifecycleStatus }}</strong>
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
              <div v-else class="modal-empty">
                {{ demoLoading ? '正在加载模型特征...' : '未检测到可用特征列，请先刷新报告或在批量测试中导入样例。' }}
              </div>
            </el-tab-pane>

            <el-tab-pane label="批量测试 (Batch)" name="batch">
              <div class="batch-head-actions">
                <el-button plain @click="openPredictionJsonDialog">JSON 导入</el-button>
                <el-button plain :disabled="!predictionRows.length" @click="addPredictionRow">新增行</el-button>
                <el-button plain :disabled="!predictionRows.length" @click="exportPredictionJson">导出 JSON</el-button>
              </div>

              <div v-if="predictionColumns.length" class="prediction-table-wrap">
                <el-table :data="pagedPredictionRows" :height="predictionTableHeight">
                  <el-table-column label="行号" width="88" align="center">
                    <template #header>
                      <div class="row-index-head">
                        <el-tooltip content="# 表示样本行号" placement="top">
                          <span class="row-index-head-mark">#</span>
                        </el-tooltip>
                        <span class="row-index-head-text">操作</span>
                      </div>
                    </template>
                    <template #default="{ row, $index }">
                      <div class="row-index-cell">
                        <span class="row-index">{{ (predictionPage - 1) * predictionPageSize + $index + 1 }}</span>
                        <button class="row-delete-button" title="删除此行" @click="removePredictionRow(row.id)">
                          <el-icon class="row-delete-icon"><Close /></el-icon>
                        </button>
                      </div>
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
            </div>
          </div>

          <div class="artifact-toolbar">
            <div class="artifact-view-switch">
              <button
                class="artifact-view-button"
                :class="{ active: artifactMode === 'report' }"
                :disabled="!currentTaskId"
                @click="switchArtifactMode('report')"
              >
                报告
              </button>
              <button
                class="artifact-view-button"
                :class="{ active: artifactMode === 'code' }"
                :disabled="!currentTaskId || !canReview"
                @click="switchArtifactMode('code')"
              >
                代码
              </button>
            </div>

            <el-dropdown trigger="click" @command="handleExportCommand">
              <el-button plain type="primary" :disabled="!currentTaskId">
                导出选项
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="package" :disabled="!currentTaskId || !canReview">下载产物包</el-dropdown-item>
                  <el-dropdown-item command="json" :disabled="!currentReport">导出 JSON</el-dropdown-item>
                  <el-dropdown-item command="pdf" :disabled="!currentReport">导出 PDF</el-dropdown-item>
                  <el-dropdown-item command="md" :disabled="!currentReport">导出 MD</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div v-if="artifactMode === 'report' && currentReport" class="report-visual" id="report-content">
            <div class="report-summary-grid">
              <div v-for="item in reportSummaryCards" :key="item.label" class="report-summary-card">
                <span class="summary-label">{{ item.label }}</span>
                <strong class="summary-value">{{ item.value }}</strong>
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

            <div v-if="reportFeatureImportance.length" class="report-section feature-importance-section">
              <span class="section-title">特征重要性</span>
              <v-chart class="chart" :option="featureImportanceChartOption" autoresize />
            </div>

            <div class="report-block">
              <div class="report-block-head">
                <div>
                  <strong>训练指标</strong>
                  <span>模型训练后的核心评估结果。</span>
                </div>
              </div>
              <div class="report-table-shell">
                <el-table :data="reportTrainingRows" class="report-table compact" border>
                  <el-table-column prop="label" label="指标" min-width="180" />
                  <el-table-column prop="value" label="当前值" min-width="220" />
                </el-table>
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
              <div class="report-table-shell">
                <el-table :data="reportDataRows" class="report-table compact" border>
                  <el-table-column prop="label" label="字段" min-width="180" />
                  <el-table-column prop="value" label="当前值" min-width="220" />
                </el-table>
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
            <div class="code-visual-head">
              <span>Operation Agent 生成代码</span>
              <small>默认显示约 50 行，可拖动右下角调整高度</small>
            </div>
            <div class="code-resize-shell" :style="{ height: `${artifactCodeEditorHeight}px` }">
              <vue-monaco-editor
                v-model:value="artifactText"
                theme="vs-dark"
                language="python"
                :options="{ readOnly: true, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false }"
                height="100%"
              />
            </div>
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
        <template v-if="resolvedReviewStage === 'parse_review'">
          <el-alert title="请核对 AI 解析结果并确认目标列和特征列。" type="info" show-icon :closable="false" />
          <div class="review-current-strip">
            <span>当前目标列：{{ parseReviewCurrentTarget || '-' }}</span>
            <span>当前特征列：{{ parseReviewCurrentFeaturesText }}</span>
          </div>
          <el-form label-position="left" label-width="100px" style="margin-top: 15px;">
            <el-form-item label="任务类型">
              <el-select v-model="editPayload.task_type">
                <el-option label="二分类 (Binary Classification)" value="classification" />
                <el-option label="回归 (Regression)" value="regression" />
              </el-select>
            </el-form-item>
            <el-form-item label="目标列">
              <el-select v-model="editPayload.target_column" filterable placeholder="请选择目标列">
                <el-option
                  v-for="column in parseReviewColumnOptions"
                  :key="column"
                  :label="column"
                  :value="column"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="特征列">
              <el-select
                v-model="editPayload.feature_columns"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="请选择特征列"
              >
                <el-option
                  v-for="column in parseReviewColumnOptions"
                  :key="column"
                  :label="column"
                  :value="column"
                  :disabled="column === editPayload.target_column"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <div v-if="parseReviewConflict" class="review-warning">特征列与目标列不能相同，请调整后再保存。</div>
        </template>

        <template v-else-if="resolvedReviewStage === 'feature_review'">
          <el-alert title="请确认数据预处理策略，必要时进行调整。" type="info" show-icon :closable="false" />
          <div class="strategy-current-grid">
            <div v-for="item in featureReviewCurrentCards" :key="item.label" class="strategy-current-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
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

        <template v-else-if="resolvedReviewStage === 'code_review'">
          <el-alert title="Agent 已生成执行代码，您可以在下方直接编辑并保存。" type="warning" show-icon :closable="false" />
          <div class="review-code-toolbar">
            <span>可直接编辑 Operation Agent 生成代码并保存到后端。</span>
            <el-button type="warning" plain :loading="reviewing" @click="submitReviewAndResume('edit_and_continue')">
              保存修改
            </el-button>
          </div>
          <div v-if="reviewCodeLoading" class="review-code-empty">正在加载 Operation Agent 代码...</div>
          <div v-else-if="!String(editPayload.code || '').trim()" class="review-code-empty warning">
            {{ reviewCodeLoadError || '当前未读取到代码内容，可能是后端该阶段尚未返回代码字段。' }}
          </div>
          <div class="review-code-shell">
            <div class="code-resize-shell review-code-resize-shell" :style="{ height: `${reviewCodeEditorHeight}px` }">
              <vue-monaco-editor
                v-model:value="editPayload.code"
                theme="vs-dark"
                language="python"
                :options="{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, scrollBeyondLastLine: false }"
                height="100%"
              />
            </div>
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
import { ElMessage } from 'element-plus'
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
  fetchAgentCodeFile,
  fetchAgentDemo,
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

// Web Demo 与 HITL 新增状态
const predictMode = ref('single')
const singlePredictForm = ref({})
const singlePredictResult = ref(null)
const singlePredictError = ref('')
const editPayload = ref({})
const demoFeatureColumns = ref([])
const demoLoading = ref(false)
const reviewPayloadSnapshot = ref({})
const reviewCodeLoading = ref(false)
const reviewCodeLoadError = ref('')
const artifactCodeEditorHeight = ref(920)
const reviewCodeEditorHeight = ref(760)
const themeTick = ref(0)
let themeObserver = null

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
  { key: 'code_generation', review: 'code_review', title: 'Operation Agent', desc: '生成代码和预测接口', icon: 'TrendCharts' },
  { key: 'operation_report', review: null, title: 'Report Agent', desc: '输出报告、代码和可复用产物', icon: 'Document' }
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
const normalizeReviewStage = (stage) => {
  const value = String(stage || '')
  if (!value) return ''
  if (reviewStageTitleMap[value]) return value
  const mapped = stageDefinitions.find((item) => item.key === value)?.review
  return mapped || ''
}
const resolvedReviewStage = computed(() =>
  normalizeReviewStage(
    pendingReview.value?.review_stage ||
    pendingReview.value?.review_node ||
    pendingReview.value?.node ||
    currentStage.value
  )
)
const reviewStageLabel = computed(() => reviewStageTitleMap[resolvedReviewStage.value] || resolvedReviewStage.value || '-')
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
  demoFeatureColumns.value.forEach((column) => {
    if (column) columns.add(String(column))
  })
  reportFeatureColumns.value.forEach((column) => {
    if (column) columns.add(String(column))
  })
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

const parseReviewColumnOptions = computed(() => {
  const options = new Set()
  normalizeColumnList(readFirstByPaths(reviewPayloadSnapshot.value, [
    'all_columns',
    'columns',
    'candidate_columns',
    'schema.columns',
    'dataset_columns',
    'data.columns',
    'available_columns'
  ])).forEach((column) => options.add(column))
  normalizeColumnList(readFirstByPaths(reviewPayloadSnapshot.value, [
    'feature_columns',
    'features',
    'selected_features'
  ])).forEach((column) => options.add(column))
  previewColumns.value.forEach((column) => options.add(column))
  reportFeatureColumns.value.forEach((column) => options.add(column))
  reportNumericColumns.value.forEach((column) => options.add(column))
  if (editPayload.value.target_column) options.add(String(editPayload.value.target_column))
  normalizeColumnList(editPayload.value.feature_columns).forEach((column) => options.add(column))
  return Array.from(options)
})
const parseReviewCurrentTarget = computed(() => extractParseReviewInfo(reviewPayloadSnapshot.value).target_column || '-')
const parseReviewCurrentFeaturesText = computed(() => {
  const features = extractParseReviewInfo(reviewPayloadSnapshot.value).feature_columns
  return features.length ? features.join('、') : '-'
})
const parseReviewConflict = computed(() => {
  const target = String(editPayload.value?.target_column || '').trim()
  if (!target) return false
  return normalizeColumnList(editPayload.value?.feature_columns).includes(target)
})
const featureReviewCurrentCards = computed(() => {
  const current = extractFeatureReviewStrategies(reviewPayloadSnapshot.value, false)
  return [
    { label: '当前数值列缺失值策略', value: current.numeric_missing_strategy || '-' },
    { label: '当前类别列缺失值策略', value: current.categorical_missing_strategy || '-' },
    { label: '当前特征编码策略', value: current.categorical_encoding_strategy || '-' }
  ]
})

// ECharts 特征重要性配置
const featureImportanceChartOption = computed(() => {
  const _themeSignal = themeTick.value
  const data = [...reportFeatureImportance.value]
    .map((item) => ({
      feature: String(item.feature || item.name || item.column || '-'),
      importance: Number(item.importance ?? item.value ?? 0)
    }))
    .sort((a, b) => a.importance - b.importance)
  const textColor = getThemeCssVar('--zs-text', '#1f2430')
  const mutedColor = getThemeCssVar('--zs-muted', '#667085')
  const borderColor = getThemeCssVar('--zs-border', '#d0d7e2')
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 28, top: 18, bottom: 14, containLabel: false },
    xAxis: {
      type: 'value',
      boundaryGap: [0, 0.01],
      axisLabel: { color: mutedColor },
      axisLine: { lineStyle: { color: borderColor } },
      splitLine: { lineStyle: { color: borderColor, opacity: 0.4 } }
    },
    yAxis: {
      type: 'category',
      data: data.map((item) => item.feature),
      axisLabel: {
        color: textColor,
        width: 160,
        overflow: 'truncate'
      },
      axisLine: { lineStyle: { color: borderColor } }
    },
    series: [
      {
        type: 'bar',
        data: data.map((item) => item.importance),
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
  return normalizeColumnList(columns)
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
const reportTrainingRows = computed(() => {
  const metrics = reportMetrics.value
  const rows = [
    { label: '最佳模型', value: reportBestModelName.value },
    { label: '主指标', value: metrics.metric || reportModelPlan.value.primary_metric || '-' },
    { label: '主指标得分', value: formatReportValue(metrics.score ?? metrics[reportModelPlan.value.primary_metric]) },
    { label: '训练行数', value: formatReportValue(metrics.train_rows ?? reportModelResult.value?.train_size) },
    { label: '测试行数', value: formatReportValue(metrics.test_rows ?? reportModelResult.value?.test_size) }
  ]
  Object.entries(metrics || {}).forEach(([key, value]) => {
    if (['metric', 'score', 'train_rows', 'test_rows'].includes(key)) return
    rows.push({ label: key, value: formatReportValue(value) })
  })
  return rows.filter((item) => item.value !== '-')
})
const reportCandidateModels = computed(() => Array.isArray(reportModelResult.value?.candidate_models) ? reportModelResult.value.candidate_models : [])
const reportCandidateMetricColumns = computed(() => {
  const columns = new Set()
  reportCandidateModels.value.forEach((model) => Object.keys(model.metrics || {}).forEach((key) => columns.add(key)))
  return Array.from(columns)
})
const reportDataRows = computed(() => {
  const rows = [
    { label: '数据行数', value: formatReportValue(reportData.value?.row_count) },
    { label: '字段数量', value: formatReportValue(reportData.value?.column_count || reportData.value?.columns?.length) },
    { label: '目标均值', value: formatReportValue(reportData.value?.target_mean) }
  ]
  Object.entries(reportData.value?.missing_summary || {}).forEach(([key, value]) => {
    rows.push({ label: `缺失率(${key})`, value: formatReportValue(value) })
  })
  return rows.filter((item) => item.value !== '-')
})
const reportSelectionReason = computed(() => reportData.value?.selection_reason || reportData.value?.llm_output?.selection_reason || '')
const reportNumericColumns = computed(() => normalizeColumnList(reportData.value?.numeric_columns))
const reportRecommendations = computed(() => Array.isArray(currentReport.value?.recommendations) ? currentReport.value.recommendations : [])
const reportRiskNotes = computed(() => Array.isArray(currentReport.value?.risk_notes) ? currentReport.value.risk_notes : [])
const reportFeatureImportance = computed(() => normalizeFeatureImportance(reportModelTraining.value?.feature_importance || currentReport.value?.feature_importance))

const stages = computed(() => {
  const reviewStage = lifecycleStatus.value === 'WAITING_HUMAN' ? resolvedReviewStage.value : ''
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
const normalizeStringArray = (list) => Array.from(new Set((Array.isArray(list) ? list : []).map((item) => String(item || '').trim()).filter(Boolean)))
const normalizeColumnList = (value) => {
  if (Array.isArray(value)) return normalizeStringArray(value)
  if (typeof value === 'string') return normalizeStringArray(value.split(/[,;，、|\n\r\t]+/))
  if (value && typeof value === 'object') return normalizeStringArray(Object.keys(value))
  return []
}
const getByPath = (obj, path) => path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
const readFirstByPaths = (source, paths = []) => {
  for (const path of paths) {
    const value = getByPath(source, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}
const getThemeCssVar = (name, fallback) => {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
const extractParseReviewInfo = (payload) => {
  const source = payload || {}
  return {
    task_type: String(readFirstByPaths(source, ['task_type', 'type', 'model_type', 'problem_type']) || '').trim(),
    target_column: String(readFirstByPaths(source, ['target_column', 'target', 'label_column', 'target_col', 'label']) || '').trim(),
    feature_columns: normalizeColumnList(readFirstByPaths(source, [
      'feature_columns',
      'features',
      'selected_features',
      'feature_cols',
      'input_features'
    ]))
  }
}
const extractFeatureReviewStrategies = (payload, useFallback = true) => {
  const source = payload || {}
  return {
    numeric_missing_strategy: String(readFirstByPaths(source, [
      'numeric_missing_strategy',
      'numeric_missing_fill_strategy',
      'numeric_imputation_strategy',
      'numeric_fillna_strategy'
    ]) || (useFallback ? 'mean' : '-')).trim(),
    categorical_missing_strategy: String(readFirstByPaths(source, [
      'categorical_missing_strategy',
      'categorical_missing_fill_strategy',
      'categorical_imputation_strategy',
      'categorical_fillna_strategy'
    ]) || (useFallback ? 'mode' : '-')).trim(),
    categorical_encoding_strategy: String(readFirstByPaths(source, [
      'categorical_encoding_strategy',
      'encoding_strategy',
      'feature_encoding_strategy',
      'categorical_encoder'
    ]) || (useFallback ? 'onehot' : '-')).trim()
  }
}
const extractCodePath = (payload) => {
  const source = payload || {}
  const direct = readFirstByPaths(source, [
    'code_path',
    'python_code_path',
    'generated_code_path',
    'file_path',
    'path',
    'artifact_path'
  ])
  if (typeof direct === 'string') return direct
  const nestedCandidates = [
    source?.code_result,
    source?.operation_result,
    source?.operation_agent,
    source?.data,
    source?.result
  ]
  for (const candidate of nestedCandidates) {
    const nestedPath = extractCodePath(candidate)
    if (nestedPath) return nestedPath
  }
  return ''
}
const extractCodeText = (payload) => {
  const source = payload || {}
  const direct = readFirstByPaths(source, [
    'code',
    'python_code',
    'generated_code',
    'source_code',
    'content',
    'script'
  ])
  if (typeof direct === 'string') return direct
  const nestedCandidates = [
    source?.code_result,
    source?.operation_result,
    source?.operation_agent,
    source?.data,
    source?.result
  ]
  for (const candidate of nestedCandidates) {
    const nestedCode = extractCodeText(candidate)
    if (nestedCode) return nestedCode
  }
  return ''
}
const looksLikeCodePath = (value) => {
  const text = String(value || '').trim()
  if (!text || text.includes('\n')) return false
  if (!/[\\/]/.test(text) && !text.startsWith('uploads/')) return false
  return /\.(py|ipynb|txt|json|yaml|yml|sql)$/i.test(text)
}
const looksLikeCodeContent = (value) => {
  const text = String(value || '').trim()
  if (!text) return false
  if (text.includes('\n')) return true
  return /(def\s+\w+\(|class\s+\w+|import\s+\w+|from\s+\w+\s+import|if __name__ == ['"]__main__['"])/.test(text)
}
const resolveCodePayloadText = async (payload) => {
  const directCode = String(extractCodeText(payload) || '').trim()
  const pathFromPayload = String(extractCodePath(payload) || '').trim()
  const fallbackPath = looksLikeCodePath(directCode) ? directCode : ''
  const codePath = pathFromPayload || fallbackPath

  if (directCode && looksLikeCodeContent(directCode) && !looksLikeCodePath(directCode)) {
    return { code: directCode, codePath: '', error: '' }
  }

  if (codePath) {
    try {
      const fileText = await fetchAgentCodeFile(codePath)
      const content = typeof fileText === 'string' ? fileText : JSON.stringify(fileText ?? '', null, 2)
      if (String(content || '').trim()) {
        return { code: content, codePath, error: '' }
      }
      return { code: '', codePath, error: `后端返回了代码路径（${codePath}），但该路径读取到空内容。` }
    } catch (error) {
      return { code: '', codePath, error: `后端返回了代码路径（${codePath}），但前端无法读取该路径内容。` }
    }
  }

  if (directCode) return { code: directCode, codePath: '', error: '' }
  return { code: '', codePath: '', error: '' }
}
const normalizeFeatureImportance = (input) => {
  if (Array.isArray(input)) {
    return input
      .map((item) => ({
        feature: String(item?.feature || item?.name || item?.column || ''),
        importance: Number(item?.importance ?? item?.value ?? 0)
      }))
      .filter((item) => item.feature)
  }
  if (input && typeof input === 'object') {
    return Object.entries(input).map(([feature, importance]) => ({
      feature: String(feature),
      importance: Number(importance ?? 0)
    }))
  }
  return []
}
const normalizeReviewPayload = (review, reviewStage) => {
  const payload = review?.payload || review?.review_payload || review?.data || {}
  if (reviewStage === 'parse_review') {
    const parseInfo = extractParseReviewInfo(payload)
    return {
      ...payload,
      task_type: parseInfo.task_type || 'classification',
      target_column: parseInfo.target_column,
      feature_columns: parseInfo.feature_columns
    }
  }
  if (reviewStage === 'feature_review') {
    return {
      ...payload,
      ...extractFeatureReviewStrategies(payload)
    }
  }
  if (reviewStage === 'code_review') {
    return {
      ...payload,
      code: extractCodeText(payload)
    }
  }
  return JSON.parse(JSON.stringify(payload))
}
const resolvePendingReviewRecord = (raw) => {
  if (!raw || typeof raw !== 'object') return raw
  const directStage = normalizeReviewStage(raw?.review_stage || raw?.review_node || raw?.node)
  if (directStage) return raw
  const candidateKeys = ['pending_review', 'review', 'current_review', 'waiting_review', 'data']
  for (const key of candidateKeys) {
    const candidate = raw?.[key]
    if (!candidate || typeof candidate !== 'object') continue
    const candidateStage = normalizeReviewStage(candidate?.review_stage || candidate?.review_node || candidate?.node)
    if (candidateStage) return candidate
  }
  if (raw?.pending_review && typeof raw.pending_review === 'object') return raw.pending_review
  return raw
}
const extractDemoFeatureColumns = (demo) => {
  const candidates = [
    demo?.feature_columns,
    demo?.features,
    demo?.columns,
    demo?.input_features,
    demo?.schema?.feature_columns,
    demo?.schema?.features,
    demo?.schema?.columns,
    demo?.model?.feature_columns,
    demo?.model_features,
    demo?.inputs,
    demo?.data?.feature_columns
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      if (typeof candidate[0] === 'string') return normalizeStringArray(candidate)
      if (typeof candidate[0] === 'object' && candidate[0] !== null) {
        return normalizeStringArray(candidate.map((item) => item.name || item.column || item.field || item.key))
      }
    }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return normalizeStringArray(Object.keys(candidate))
    }
  }
  return []
}
const buildEmptyFeatureRecord = () => {
  const features = {}
  predictionColumns.value.forEach((column) => {
    features[column] = ''
  })
  return features
}
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
  parsedResultRaw.value = null
  parsedConfirmed.value = false
  parseSource.value = ''
  parseResultNotice.value = ''
  uploadProgress.value = 0
  selectedHitlStages.value = []
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
    const hitlStages = canReview.value ? [...selectedHitlStages.value] : []
    const task = await createAgentTask({ dataset_id: Number(draftDatasetId.value), task_description: draftTaskDesc.value.trim(), hitl: hitlStages })
    syncTaskState(task)
    const nextTaskId = String(normalizeTaskId(task))
    if (nextTaskId) taskRunModeMap.value[nextTaskId] = draftRunOffline.value
    runOffline.value = draftRunOffline.value
    createDialogVisible.value = false
    const runResult = await runAgentTask(currentTaskId.value, { offline: runOffline.value })
    syncTaskState(runResult)
    await loadTasks(false, true)
    if (lifecycleStatus.value === 'WAITING_HUMAN') {
      await loadPendingReview(true)
    } else if (lifecycleStatus.value === 'COMPLETED') {
      await loadReport()
    } else {
      startRunPolling()
    }
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
    reviewCodeLoadError.value = ''
    reviewCodeLoading.value = false

    const reviewResponse = await fetchPendingReview(currentTaskId.value)
    const review = resolvePendingReviewRecord(reviewResponse)
    pendingReview.value = review || null
    const reviewStage = normalizeReviewStage(review?.review_stage || review?.review_node || review?.node)
    if (reviewStage) currentStage.value = reviewStage
    reviewPayloadSnapshot.value = JSON.parse(JSON.stringify(pendingReview.value?.payload || pendingReview.value?.review_payload || pendingReview.value?.data || {}))
    editPayload.value = normalizeReviewPayload(pendingReview.value, reviewStage)
    if (reviewStage === 'code_review') {
      reviewCodeLoading.value = true
      try {
        const localResolved = await resolveCodePayloadText(editPayload.value)
        if (localResolved.code) {
          editPayload.value.code = localResolved.code
        }

        const needFetchTaskCode =
          !String(editPayload.value?.code || '').trim() || looksLikeCodePath(editPayload.value?.code)
        if (needFetchTaskCode) {
          const codePayload = await fetchAgentCode(currentTaskId.value)
          const remoteResolved = await resolveCodePayloadText(codePayload)
          if (remoteResolved.code) {
            editPayload.value.code = remoteResolved.code
          }
          if (remoteResolved.error && !String(editPayload.value?.code || '').trim()) {
            reviewCodeLoadError.value = remoteResolved.error
          }
        }

        if (!String(editPayload.value?.code || '').trim()) {
          reviewCodeLoadError.value =
            reviewCodeLoadError.value || '后端接口已响应，但未返回可识别的代码字段（code / python_code / generated_code / code_path）。'
        }
      } catch (error) {
        reviewCodeLoadError.value = error?.message || '代码接口调用失败，可能是后端该阶段尚未产出代码。'
      } finally {
        reviewCodeLoading.value = false
      }
    }
  } catch (error) {
    pendingReview.value = null
    reviewCodeLoading.value = false
    reviewCodeLoadError.value = ''
    if (!silent) ElMessage.warning('没有待审核内容')
  }
}

const openReviewDialog = async () => {
  await loadPendingReview(false)
  reviewComment.value = ''
  patchText.value = ''
  reviewDialogVisible.value = true
}

const buildReviewPatch = (reviewStage) => {
  if (reviewStage === 'parse_review') {
    const taskType = String(editPayload.value?.task_type || '').trim() || 'classification'
    const targetColumn = String(editPayload.value?.target_column || '').trim()
    const featureColumns = normalizeColumnList(editPayload.value?.feature_columns)
    if (targetColumn && featureColumns.includes(targetColumn)) {
      throw new Error('特征列与目标列不能相同')
    }
    return {
      ...editPayload.value,
      task_type: taskType,
      target_column: targetColumn,
      target: targetColumn,
      feature_columns: featureColumns,
      input_features: featureColumns
    }
  }
  if (reviewStage === 'feature_review') {
    const strategies = extractFeatureReviewStrategies(editPayload.value || {})
    return {
      ...editPayload.value,
      ...strategies
    }
  }
  if (reviewStage === 'code_review') {
    const code = String(editPayload.value?.code || '').trimEnd()
    if (!code.trim()) throw new Error('代码内容为空，请填写后再保存')
    return {
      ...editPayload.value,
      code,
      python_code: code,
      generated_code: code
    }
  }
  return editPayload.value
}

const submitReviewAndResume = async (actionType) => {
  reviewing.value = true
  try {
    const isEdit = actionType === 'edit_and_continue'
    const resolvedPatch = (() => {
      if (!isEdit) return null
      if (patchText.value.trim()) {
        try {
          return JSON.parse(patchText.value)
        } catch {
          throw new Error('补丁 JSON 格式不正确')
        }
      }
      return buildReviewPatch(resolvedReviewStage.value)
    })()
    await submitAgentReview(currentTaskId.value, {
      action: actionType,
      patch: resolvedPatch,
      comment: reviewComment.value.trim(),
      auto_resume: false,
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
      await loadPendingReview(true)
    }
  } catch (error) { ElMessage.error(error.message || '审核提交失败') } finally { reviewing.value = false }
}

// ================= 报告与代码 =================
const loadReport = async () => {
  try {
    currentReport.value = await fetchAgentReport(currentTaskId.value)
    artifactMode.value = 'report'
    await preparePredictionDemo()
    if (!predictionRows.value.length) fillPredictionSample()
  } catch (error) { ElMessage.error('报告加载失败') }
}

const ensurePreviewRows = async () => {
  if (previewRows.value.length || !datasetId.value) return
  try {
    previewRows.value = normalizeRows(await fetchDatasetPreview(datasetId.value)).slice(0, 20)
  } catch {
    // ignore preview loading errors for demo initialization
  }
}

const preparePredictionDemo = async () => {
  demoLoading.value = true
  try {
    await ensurePreviewRows()
    let columns = []
    try {
      const demo = await fetchAgentDemo(currentTaskId.value)
      columns = extractDemoFeatureColumns(demo)
    } catch {
      columns = []
    }
    if (!columns.length) {
      const taskColumns = normalizeColumnList(currentTask.value?.feature_columns || currentTask.value?.features || currentTask.value?.input_features)
      columns = normalizeStringArray(taskColumns)
    }
    if (!columns.length) columns = normalizeStringArray(reportFeatureColumns.value)
    if (!columns.length && previewRows.value[0]) {
      const targetColumn = reportTargetColumn.value
      columns = normalizeStringArray(Object.keys(previewRows.value[0]).filter((column) => column !== targetColumn))
    }
    demoFeatureColumns.value = columns
    if (!predictionRows.value.length && columns.length) fillPredictionSample()
  } finally {
    demoLoading.value = false
  }
}

const loadCode = async () => {
  try {
    const codePayload = await fetchAgentCode(currentTaskId.value)
    const resolved = await resolveCodePayloadText(codePayload)
    artifactText.value = resolved.code || (typeof codePayload === 'string' ? codePayload : JSON.stringify(codePayload, null, 2))
    if (resolved.error) ElMessage.warning(resolved.error)
    artifactMode.value = 'code'
  } catch (error) { ElMessage.error('代码加载失败') }
}

const switchArtifactMode = async (nextMode) => {
  if (nextMode === 'report') {
    if (!currentReport.value) await loadReport()
    else artifactMode.value = 'report'
    return
  }
  if (nextMode === 'code') {
    await loadCode()
  }
}

// ================= 预测 Web Demo =================
const fillPredictionSample = () => {
  if (previewRows.value.length) {
    predictionRows.value = (previewRows.value.slice(0, 5)).map((row, index) => {
      const features = {}
      predictionColumns.value.forEach((col) => {
        features[col] = row[col] ?? ''
      })
      return { id: `sample_${Date.now()}_${index}`, features, prediction: '' }
    })
    return
  }
  if (!predictionColumns.value.length) return
  predictionRows.value = Array.from({ length: 3 }, (_, index) => ({
    id: `sample_${Date.now()}_${index}`,
    features: buildEmptyFeatureRecord(),
    prediction: ''
  }))
}

const fillSinglePredictSample = () => {
  if (previewRows.value.length > 0) {
    predictionColumns.value.forEach(col => singlePredictForm.value[col] = previewRows.value[0][col] ?? '')
  } else if (predictionColumns.value.length) {
    predictionColumns.value.forEach((col) => {
      singlePredictForm.value[col] = singlePredictForm.value[col] ?? ''
    })
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
const handleExportCommand = async (command) => {
  if (command === 'package') {
    await downloadTaskArtifacts()
    return
  }
  if (command === 'json') {
    exportReportJson()
    return
  }
  if (command === 'pdf') {
    downloadReportPDF()
    return
  }
  if (command === 'md') {
    downloadReportMD()
  }
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

watch(
  predictionColumns,
  (columns) => {
    const nextForm = {}
    columns.forEach((column) => {
      nextForm[column] = singlePredictForm.value[column] ?? ''
    })
    singlePredictForm.value = nextForm
  },
  { immediate: true }
)

watch(
  () => editPayload.value?.target_column,
  (target) => {
    if (!target) return
    const features = normalizeColumnList(editPayload.value?.feature_columns)
    if (!features.includes(target)) return
    editPayload.value = {
      ...editPayload.value,
      feature_columns: features.filter((item) => item !== target)
    }
  }
)

watch(
  predictionRows,
  (rows) => {
    const maxPage = Math.max(1, Math.ceil(rows.length / predictionPageSize))
    if (predictionPage.value > maxPage) predictionPage.value = maxPage
  },
  { deep: true }
)

watch(currentTaskId, (nextId, prevId) => {
  if (!nextId || nextId === prevId) return
  predictionRows.value = []
  predictionPage.value = 1
  singlePredictForm.value = {}
  singlePredictResult.value = null
  singlePredictError.value = ''
  demoFeatureColumns.value = []
  artifactText.value = ''
  artifactMode.value = 'empty'
})

onMounted(() => {
  loadTasks(false, true)
  if (typeof window !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      themeTick.value += 1
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] })
  }
})
onBeforeUnmount(() => {
  clearInterval(runPollTimer)
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
})
</script>

<style scoped>
.agent-console {
  height: 100vh;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  line-height: 1.68;
}
.task-rail {
  border-right: 1px solid var(--zs-border);
  padding: 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--zs-sidebar);
}
.rail-label {
  color: var(--zs-muted);
  font-size: 13px;
  font-weight: 640;
  letter-spacing: 0.06em;
}
.task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.agent-main { padding: 34px 46px; overflow: auto; }
.task-item {
  width: 100%;
  text-align: left;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  background: var(--zs-panel-soft);
  color: var(--zs-text);
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.task-item:hover, .task-item.active {
  background: var(--zs-elevated);
  border-color: var(--zs-border-strong);
  transform: translateY(-1px);
}
.task-title {
  display: block;
  color: var(--zs-text);
  font-size: 14px;
  font-weight: 560;
  line-height: 1.62;
  word-break: break-word;
}
.task-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  color: var(--zs-muted);
  font-size: 12px;
}

.new-task-button-v2 {
  width: 100%;
  height: 42px;
  margin-bottom: 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-card, .workflow-panel, .inspector-card {
  max-width: 1080px;
  margin: 0 auto 20px;
  padding: 22px;
  border: 1px solid var(--zs-border);
  border-radius: 24px;
  background: var(--zs-panel);
}
.status-strip { max-width: 1080px; margin: 0 auto 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.status-card { padding: 14px; border: 1px solid var(--zs-border); border-radius: 16px; background: var(--zs-panel-soft); }
.status-card span { color: var(--zs-muted); font-size: 13px; }
.status-card strong { display: block; margin-top: 7px; font-size: 15px; color: var(--zs-text); }
.panel-head { display: flex; justify-content: space-between; margin-bottom: 16px; gap: 14px; }
.panel-title { color: var(--zs-text); font-size: 16px; font-weight: 660; }
.panel-subtitle { margin-top: 5px; color: var(--zs-muted); font-size: 13px; line-height: 1.68; }
.panel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.stage-item { display: grid; grid-template-columns: 38px 1fr auto; gap: 14px; padding: 15px; border: 1px solid var(--zs-border); border-radius: 16px; margin-bottom: 10px; }
.stage-title { color: var(--zs-text); font-size: 14px; font-weight: 620; }
.stage-desc { margin-top: 5px; color: var(--zs-muted); font-size: 13px; line-height: 1.64; }
.task-desc-card {
  padding-bottom: 14px;
}
.task-desc-head {
  margin-bottom: 4px;
}
.task-desc-text {
  margin-top: 8px;
  color: var(--zs-text);
  font-size: 15px;
  line-height: 1.78;
  max-width: 760px;
}

.progress-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.progress-overview-item {
  padding: 12px 14px;
  border: 1px solid var(--zs-border);
  border-radius: 14px;
  background: linear-gradient(140deg, var(--zs-panel-soft), var(--zs-panel));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}
.overview-label {
  display: block;
  color: var(--zs-muted);
  font-size: 12px;
}
.overview-value {
  display: block;
  margin-top: 6px;
  color: var(--zs-text);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-word;
}
.progress-overview-item.status-running .overview-value {
  color: #54c0ff;
}
.progress-overview-item.status-waiting_human .overview-value {
  color: #f1c15b;
}
.progress-overview-item.status-completed .overview-value {
  color: #52c37f;
}
.progress-overview-item.status-failed .overview-value {
  color: #ef6a6a;
}
.main-progress {
  margin-bottom: 14px;
}
.stage-list {
  margin-top: 8px;
}

.artifact-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.artifact-view-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--zs-border);
  border-radius: 999px;
  background: var(--zs-panel-soft);
}
.artifact-view-button {
  border: 0;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--zs-muted);
  background: transparent;
  cursor: pointer;
  transition: all 0.18s ease;
}
.artifact-view-button.active {
  color: var(--zs-text);
  background: var(--zs-elevated);
}
.artifact-view-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.report-visual {
  margin-top: 6px;
}
.report-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.report-summary-card {
  padding: 12px 14px;
  border: 1px solid var(--zs-border);
  border-radius: 16px;
  background: var(--zs-panel-soft);
}
.summary-label {
  display: block;
  margin-bottom: 7px;
  color: var(--zs-muted);
  font-size: 12px;
}
.summary-value {
  display: block;
  color: var(--zs-text);
  font-size: 15px;
  line-height: 1.45;
}
.report-section {
  padding: 12px 14px;
  border: 1px solid var(--zs-border);
  border-radius: 16px;
  margin-bottom: 12px;
}
.report-section > span {
  display: block;
  margin-bottom: 8px;
  color: var(--zs-muted);
  font-size: 13px;
  font-weight: 620;
}
.report-section p {
  margin: 0;
  color: var(--zs-text);
  line-height: 1.7;
}
.report-section ul {
  margin: 0;
  padding-left: 18px;
}
.report-section li {
  margin: 4px 0;
  color: var(--zs-text);
  line-height: 1.66;
}
.report-advice-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  align-items: start;
}
.report-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.report-tags span {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--zs-border);
  background: var(--zs-panel-soft);
  color: var(--zs-text);
  font-size: 12px;
  line-height: 1.2;
}
.feature-importance-section {
  height: 350px;
  overflow: hidden;
}
.section-title {
  margin-bottom: 8px;
}
.chart { width: 100%; height: 100%; min-height: 300px; }
.report-block {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--zs-border);
  border-radius: 16px;
}
.report-block-head strong {
  color: var(--zs-text);
  font-size: 15px;
}
.report-block-head span {
  display: block;
  margin-top: 4px;
  color: var(--zs-muted);
  font-size: 12px;
}
.report-table-shell {
  margin-top: 12px;
}
.report-table {
  margin-top: 12px;
}
.report-note {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--zs-border);
  border-radius: 12px;
  color: var(--zs-muted);
  font-size: 13px;
  line-height: 1.64;
}

.demo-tabs { margin-top: 10px; }
.web-demo-form { padding: 18px; border: 1px solid var(--zs-border); border-radius: 12px; background: var(--zs-panel-soft); }
.demo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
.demo-actions { margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end; }
.demo-result { margin-top: 16px; padding: 12px 16px; border-radius: 8px; font-size: 14px; }
.demo-result.success { background: rgba(125, 211, 167, 0.15); border: 1px solid #36b37e; color: var(--zs-text); }
.demo-result.error { background: rgba(255, 138, 138, 0.15); border: 1px solid #ef6a6a; color: #ef6a6a; }
.batch-head-actions {
  margin-bottom: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.prediction-table-wrap {
  border: 1px solid var(--zs-border);
  border-radius: 16px;
  overflow: hidden;
  background: var(--zs-panel);
}
.row-index-hint {
  padding: 8px 12px;
  border-bottom: 1px dashed var(--zs-border);
  color: var(--zs-muted);
  font-size: 12px;
}
.row-index-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.row-index-head-mark {
  color: var(--zs-text);
  font-weight: 700;
}
.row-index-head-text {
  color: var(--zs-muted);
  font-size: 12px;
}
.row-index-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.row-index {
  color: var(--zs-text);
  font-size: 12px;
  min-width: 14px;
}
.row-delete-button {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--zs-border);
  background: var(--zs-panel-soft);
  color: var(--zs-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.16s ease;
}
.row-delete-button:hover {
  border-color: #e35d6a;
  color: #e35d6a;
  background: rgba(227, 93, 106, 0.1);
}
.prediction-footer {
  padding: 10px 12px 12px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--zs-border);
}
.predict-actions {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed var(--zs-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.code-visual {
  border: 1px solid var(--zs-border);
  border-radius: 10px;
  overflow: hidden;
}
.code-visual-head {
  padding: 10px 12px;
  border-bottom: 1px solid var(--zs-border);
  background: var(--zs-panel-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.code-visual-head span {
  color: var(--zs-text);
  font-size: 13px;
  font-weight: 640;
}
.code-visual-head small {
  color: var(--zs-muted);
  font-size: 12px;
}
.code-resize-shell {
  width: 100%;
  min-height: 420px;
  max-height: 1200px;
  resize: vertical;
  overflow: auto;
}
.review-code-resize-shell {
  min-height: 420px;
}

.review-current-strip {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--zs-border);
  border-radius: 12px;
  background: var(--zs-panel-soft);
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--zs-muted);
  font-size: 12px;
}
.review-warning {
  margin-top: 8px;
  color: #e5812b;
  font-size: 12px;
}
.strategy-current-grid {
  margin-top: 12px;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}
.strategy-current-card {
  border: 1px solid var(--zs-border);
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--zs-panel-soft);
}
.strategy-current-card span {
  display: block;
  color: var(--zs-muted);
  font-size: 12px;
  margin-bottom: 5px;
}
.strategy-current-card strong {
  color: var(--zs-text);
  font-size: 14px;
}
.review-code-toolbar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--zs-muted);
  font-size: 12px;
}
.review-code-shell {
  margin-top: 10px;
  border: 1px solid var(--zs-border);
  border-radius: 8px;
  overflow: hidden;
}
.review-code-empty {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px dashed var(--zs-border);
  border-radius: 10px;
  background: var(--zs-panel-soft);
  color: var(--zs-muted);
  font-size: 12px;
  line-height: 1.65;
}
.review-code-empty.warning {
  border-color: #e0a75e;
  color: #d79545;
}

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
.modal-empty { padding: 18px 8px; color: var(--zs-muted); font-size: 13px; line-height: 1.6; }

:deep(.report-table.compact .el-table__cell) {
  padding-top: 8px;
  padding-bottom: 8px;
}
:deep(.prediction-table-wrap .el-table) {
  --el-table-header-bg-color: var(--zs-panel-soft);
  --el-table-bg-color: var(--zs-panel);
  --el-table-tr-bg-color: var(--zs-panel);
  --el-table-text-color: var(--zs-text);
  --el-table-header-text-color: var(--zs-text);
  --el-table-border-color: var(--zs-border);
}
:deep(.prediction-footer .el-pagination) {
  --el-pagination-text-color: var(--zs-text);
  --el-pagination-button-color: var(--zs-text);
  --el-pagination-button-bg-color: var(--zs-elevated);
  --el-pagination-button-disabled-color: var(--zs-subtle);
  --el-pagination-button-disabled-bg-color: var(--zs-panel-soft);
  --el-pagination-hover-color: #6fb0ff;
}
:deep(.prediction-footer .el-pagination.is-background .el-pager li) {
  background: var(--zs-elevated) !important;
  color: var(--zs-text) !important;
  border: 1px solid var(--zs-border) !important;
  opacity: 1 !important;
}
:deep(.prediction-footer .el-pagination.is-background .btn-prev),
:deep(.prediction-footer .el-pagination.is-background .btn-next) {
  background: var(--zs-elevated) !important;
  color: var(--zs-text) !important;
  border: 1px solid var(--zs-border) !important;
}
:deep(.prediction-footer .el-pagination.is-background .el-pager li.is-active) {
  background: #3f8ef4 !important;
  border-color: #3f8ef4 !important;
  color: #ffffff !important;
}
:deep(.prediction-footer .el-pagination.is-background .btn-prev:disabled),
:deep(.prediction-footer .el-pagination.is-background .btn-next:disabled) {
  background: var(--zs-panel-soft) !important;
  color: var(--zs-subtle) !important;
  border-color: var(--zs-border) !important;
}

@media (max-width: 1200px) {
  .agent-console {
    grid-template-columns: 260px minmax(0, 1fr);
  }
  .agent-main {
    padding: 24px 20px;
  }
  .status-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .report-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .progress-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .agent-console {
    display: block;
  }
  .task-rail {
    border-right: 0;
    border-bottom: 1px solid var(--zs-border);
  }
  .status-strip {
    grid-template-columns: 1fr;
  }
  .report-summary-grid {
    grid-template-columns: 1fr;
  }
  .artifact-toolbar,
  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }
  .progress-overview {
    grid-template-columns: 1fr;
  }
}
</style>
