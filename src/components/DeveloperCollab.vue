<template>
  <div class="zs-page review-workbench">
    <div class="zs-page-head">
      <div>
        <p class="zs-eyebrow">Human review</p>
        <h2 class="zs-title">在关键节点保留开发者控制权</h2>
        <p class="zs-subtitle">
          对需求解析、特征工程、模型规划和代码生成进行确认、修改或驳回，避免 Agent 一次性跑完后无法介入。
        </p>
      </div>
      <div class="head-actions">
        <el-select v-model="selectedTaskId" placeholder="选择任务" style="width: 220px;" @change="loadReview">
          <el-option
            v-for="task in taskOptions"
            :key="task.id"
            :label="task.label"
            :value="task.id"
          />
        </el-select>
        <el-button plain :loading="loadingTasks" @click="loadTasks">
          <el-icon><Refresh /></el-icon>
          刷新任务
        </el-button>
      </div>
    </div>

    <section class="review-grid">
      <el-card shadow="never" class="review-card">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">待审核内容</div>
              <div class="card-subtitle">{{ reviewNodeText }}</div>
            </div>
            <el-tag :type="pendingReview ? 'warning' : 'info'" effect="plain">
              {{ pendingReview ? '等待确认' : '暂无审核' }}
            </el-tag>
          </div>
        </template>

        <div v-if="pendingReview" class="review-payload">
          <div class="review-meta">
            <div>
              <span>审核节点</span>
              <strong>{{ pendingReview.review_node || pendingReview.node || '-' }}</strong>
            </div>
            <div>
              <span>任务状态</span>
              <strong>{{ pendingReview.status || 'WAITING_HUMAN' }}</strong>
            </div>
          </div>
          <pre>{{ formattedReview }}</pre>
        </div>

        <div v-else class="empty-state">
          <el-icon><DocumentChecked /></el-icon>
          <span>选择处于 WAITING_HUMAN 的任务后，待审核内容会显示在这里。</span>
        </div>
      </el-card>

      <el-card shadow="never" class="action-card">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">审核动作</div>
              <div class="card-subtitle">支持确认、编辑后继续或驳回。</div>
            </div>
            <el-icon><Checked /></el-icon>
          </div>
        </template>

        <el-form label-position="top">
          <el-form-item label="动作">
            <el-segmented v-model="reviewAction" :options="actionOptions" />
          </el-form-item>

          <el-form-item v-if="reviewAction === 'edit_and_continue'" label="补丁 JSON">
            <el-input
              v-model="patchText"
              type="textarea"
              :rows="10"
              class="patch-editor"
              placeholder='例如：{"target_column":"bought","model_type":"random_forest"}'
            />
          </el-form-item>

          <el-form-item label="审核意见">
            <el-input
              v-model="reviewComment"
              type="textarea"
              :rows="4"
              placeholder="记录本次人工判断，便于后续审计。"
            />
          </el-form-item>

          <el-checkbox v-model="autoResume">提交后自动恢复执行</el-checkbox>
          <el-checkbox v-model="runOffline">恢复时使用离线规则</el-checkbox>

          <el-button
            type="primary"
            class="full-button"
            :disabled="!selectedTaskId"
            :loading="submitting"
            @click="submitReview"
          >
            <el-icon><Promotion /></el-icon>
            提交审核
          </el-button>
        </el-form>
      </el-card>
    </section>

    <section class="code-panel">
      <el-card shadow="never">
        <template #header>
          <div class="card-head">
            <div>
              <div class="card-title">生成代码审查</div>
              <div class="card-subtitle">任务完成后可读取 Operation Agent 生成的 Python 代码。</div>
            </div>
            <el-button plain :disabled="!selectedTaskId" @click="loadCode">
              <el-icon><Document /></el-icon>
              读取代码
            </el-button>
          </div>
        </template>
        <pre class="code-view">{{ pythonCode || '暂无代码。请先选择任务并读取生成代码。' }}</pre>
      </el-card>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchAgentCode,
  fetchAgentTasks,
  fetchPendingReview,
  resumeAgentTask,
  submitAgentReview
} from '../api/agent'

const taskOptions = ref([])
const selectedTaskId = ref('')
const pendingReview = ref(null)
const loadingTasks = ref(false)
const submitting = ref(false)
const reviewAction = ref('approve')
const reviewComment = ref('')
const patchText = ref('')
const autoResume = ref(true)
const runOffline = ref(true)
const pythonCode = ref('')

const actionOptions = [
  { label: '通过', value: 'approve' },
  { label: '编辑后继续', value: 'edit_and_continue' },
  { label: '驳回', value: 'reject' }
]

const reviewNodeText = computed(() => {
  if (!pendingReview.value) return '当前没有加载待审核节点。'
  return pendingReview.value.review_node || pendingReview.value.node || '待确认节点'
})

const formattedReview = computed(() => JSON.stringify(pendingReview.value, null, 2))

const normalizeTaskId = (task) => task?.task_id || task?.id || task?.task?.id || task?.task?.task_id

const loadTasks = async () => {
  loadingTasks.value = true
  try {
    const result = await fetchAgentTasks()
    const list = Array.isArray(result) ? result : result?.list || result?.items || []
    taskOptions.value = list
      .map((task) => {
        const id = normalizeTaskId(task)
        return {
          id: String(id),
          label: `${id} · ${task.status || task.lifecycle_status || 'UNKNOWN'}`
        }
      })
      .filter((item) => item.id)
    if (!selectedTaskId.value && taskOptions.value.length) {
      selectedTaskId.value = taskOptions.value[0].id
      await loadReview()
    }
  } catch (error) {
    ElMessage.error(error.message || '任务列表加载失败')
  } finally {
    loadingTasks.value = false
  }
}

const loadReview = async () => {
  if (!selectedTaskId.value) return
  try {
    pendingReview.value = await fetchPendingReview(selectedTaskId.value)
  } catch (error) {
    pendingReview.value = null
    ElMessage.warning(error.message || '当前任务没有待审核内容')
  }
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

const submitReview = async () => {
  if (!selectedTaskId.value) {
    ElMessage.warning('请先选择任务')
    return
  }
  if (!pendingReview.value && reviewAction.value !== 'reject') {
    ElMessage.warning('当前没有加载待审核内容，请先刷新任务或获取审核节点')
    return
  }
  submitting.value = true
  try {
    await submitAgentReview(selectedTaskId.value, {
      action: reviewAction.value,
      patch: parsePatch(),
      comment: reviewComment.value.trim(),
      auto_resume: false,
      offline: runOffline.value
    })
    if (autoResume.value && reviewAction.value !== 'reject') {
      await resumeAgentTask(selectedTaskId.value, { offline: runOffline.value })
    }
    ElMessage.success('审核已提交')
    pendingReview.value = null
    await loadTasks()
  } catch (error) {
    ElMessage.error(error.message || '审核提交失败')
  } finally {
    submitting.value = false
  }
}

const loadCode = async () => {
  if (!selectedTaskId.value) return
  try {
    const result = await fetchAgentCode(selectedTaskId.value)
    pythonCode.value = typeof result === 'string' ? result : result?.code || JSON.stringify(result, null, 2)
  } catch (error) {
    ElMessage.error(error.message || '代码读取失败')
  }
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
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
}

.review-payload {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.review-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.review-meta div {
  padding: 12px;
  border: 1px solid var(--zs-border);
  border-radius: var(--zs-radius);
  background: var(--zs-surface-soft);
}

.review-meta span {
  display: block;
  color: var(--zs-muted);
  font-size: 12px;
}

.review-meta strong {
  display: block;
  margin-top: 5px;
  color: var(--zs-text);
}

.review-payload pre,
.code-view {
  margin: 0;
  padding: 14px;
  overflow: auto;
  border-radius: var(--zs-radius);
  background: var(--zs-code);
  color: #f5f5f4;
  font-size: 12px;
  line-height: 1.6;
}

.review-payload pre {
  min-height: 360px;
}

.code-view {
  min-height: 260px;
}

.empty-state {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: var(--zs-muted);
  text-align: center;
}

.empty-state :deep(.el-icon) {
  font-size: 24px;
}

.patch-editor :deep(.el-textarea__inner) {
  background: #fafaf7;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
}

.full-button {
  width: 100%;
  margin-top: 16px;
}

.code-panel {
  margin-top: 16px;
}

@media (max-width: 900px) {
  .review-grid {
    grid-template-columns: 1fr;
  }

  .head-actions {
    width: 100%;
    align-items: stretch;
    flex-direction: column;
  }

  .head-actions .el-select {
    width: 100% !important;
  }
}
</style>
