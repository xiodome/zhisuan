<template>
  <div class="user-center zs-page">
    <div class="zs-page-head">
      <div>
        <h2 class="zs-title">个人中心</h2>
      </div>
      <div class="head-actions">
        <el-button plain :loading="loadingUser || loadingApplication" @click="refreshAll">
          <el-icon><Refresh /></el-icon>
          刷新数据
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="loadError"
      class="page-alert"
      type="error"
      show-icon
      :closable="false"
      :title="loadError"
    />

    <el-row :gutter="16" class="top-grid">
      <el-col :xs="24" :lg="10">
        <el-card shadow="hover" class="panel-card" v-loading="loadingUser">
          <template #header>
            <div class="card-head">
              <span class="card-title">基础信息</span>
              <el-tag type="info" effect="light">{{ roleLabel }}</el-tag>
            </div>
          </template>

          <div class="basic-info-list">
            <div class="basic-info-item">
              <span class="basic-info-label">用户名</span>
              <span class="basic-info-value">{{ displayUserName }}</span>
            </div>
            <div class="basic-info-item">
              <span class="basic-info-label">当前身份</span>
              <span class="basic-info-value">
                <el-tag :type="resolveRoleTag(currentRole)" effect="light">{{ roleLabel }}</el-tag>
              </span>
            </div>
            <div class="basic-info-item">
              <span class="basic-info-label">账号状态</span>
              <span class="basic-info-value">
                <el-tag :type="accountStatus.type" effect="light">{{ accountStatus.label }}</el-tag>
              </span>
            </div>
            <div class="basic-info-item">
              <span class="basic-info-label">注册时间</span>
              <span class="basic-info-value">{{ formatTime(userInfo?.created_at) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :lg="14">
        <el-card shadow="hover" class="panel-card" v-loading="loadingApplication">
          <template #header>
            <div class="card-head">
              <span class="card-title">申请成为 AI 开发者</span>
              <el-tag :type="applyCardTag.type" effect="light">{{ applyCardTag.label }}</el-tag>
            </div>
          </template>

          <div class="apply-body">
            <template v-if="isZeroBasisRole">
              <p class="apply-intro">成为 AI 开发者后，你可以参与模型、数据集、智能应用等能力建设。</p>
              <p class="apply-intro muted">提交申请后，管理员会进行审核，请耐心等待。</p>

              <el-alert
                v-if="applicationApiMissing"
                type="warning"
                show-icon
                :closable="false"
                title="后端暂未提供申请状态接口，当前页面已启用降级展示。"
                class="state-alert"
              />

              <div v-if="applicationStatus === 'pending'" class="state-box warning">
                <h4>待审核</h4>
                <p>申请已提交，请等待管理员审核结果。</p>
                <p>提交时间：{{ formatTime(applicationInfo?.createdAt) }}</p>
                <div class="state-actions">
                  <el-button type="primary" disabled>已提交</el-button>
                </div>
              </div>

              <div v-else-if="applicationStatus === 'rejected'" class="state-box danger">
                <h4>已驳回</h4>
                <p v-if="applicationInfo?.reviewComment">驳回原因：{{ applicationInfo.reviewComment }}</p>
                <p v-else>管理员已驳回本次申请。</p>
                <div class="state-actions">
                  <el-button type="primary" :disabled="!canSubmitApplication" @click="openApplyDialog">
                    重新申请
                  </el-button>
                </div>
              </div>

              <div v-else class="state-box">
                <h4>未申请</h4>
                <p>当前角色为零基础用户，可提交申请升级为 AI 开发者。</p>
                <div class="state-actions">
                  <el-button type="primary" :disabled="!canSubmitApplication" @click="openApplyDialog">
                    立即申请
                  </el-button>
                </div>
              </div>
            </template>

            <div v-else class="state-box success">
              <h4>权限已开通</h4>
              <p>当前角色已具备开发者/管理能力，无需重复申请。</p>
              <div class="state-actions">
                <el-button type="primary" @click="openDeveloperWorkbench">进入任务中心</el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="isAdminRole" shadow="hover" class="panel-card workflow-card" v-loading="loadingWorkflows">
      <template #header>
        <div class="card-head">
          <span class="card-title">全平台工作流统管中心 (管理员模式)</span>
          <el-button type="primary" size="small" @click="openDeveloperWorkbench">
            <el-icon><Plus /></el-icon> 自建工作流
          </el-button>
        </div>
      </template>

      <el-table :data="myWorkflows" style="width: 100%" v-if="myWorkflows.length">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="150" show-overflow-tooltip />
        <el-table-column label="公开状态" width="100">
          <template #default="{ row }">
             <el-tag size="small" :type="row.is_public ? 'success' : 'info'">{{ row.is_public ? '公开' : '私有' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核状态" width="120">
          <template #default="{ row }">
             <el-tag size="small" :type="row.audit_status === 'APPROVED' ? 'success' : 'warning'">{{ row.audit_status || 'PENDING' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Fork来源" width="120">
          <template #default="{ row }">
             {{ row.source_workflow_id || row.fork_from_workflow_id || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="管理操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.audit_status !== 'APPROVED'" 
              link 
              type="success" 
              @click="handleAuditApprove(row)"
            >
              通过
            </el-button>
            <el-button link type="primary" @click="editWorkflowConfig(row)">编辑</el-button>
            <el-button link type="primary" @click="toggleWorkflowPublic(row)">
              {{ row.is_public ? '设为私有' : '设为公开' }}
            </el-button>
            <el-button link type="danger" @click="handleTakeDown(row)">下架</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无工作流数据，可前往任务中心创建" />
    </el-card>

    <el-card shadow="hover" class="panel-card quota-card" v-loading="loadingUser">
      <template #header>
        <div class="card-head">
          <span class="card-title">我的 API 额度</span>
          <el-tag :type="quotaStatus.type" effect="light">{{ quotaStatus.label }}</el-tag>
        </div>
      </template>

      <template v-if="hasQuotaData">
        <div class="quota-grid">
          <div class="quota-item">
            <div class="quota-label">Token 额度</div>
            <div class="quota-value">{{ formatNumber(quotaInfo.tokenQuota) }}</div>
          </div>
          <div class="quota-item">
            <div class="quota-label">使用上限</div>
            <div class="quota-value">{{ formatNumber(quotaInfo.tokenLimit) }}</div>
          </div>
          <div class="quota-item">
            <div class="quota-label">预警阈值</div>
            <div class="quota-value">{{ quotaWarningText }}</div>
          </div>
          <div class="quota-item">
            <div class="quota-label">已用 Token</div>
            <div class="quota-value">{{ formatNumber(quotaInfo.tokenUsed) }}</div>
          </div>
          <div class="quota-item">
            <div class="quota-label">使用占比</div>
            <div class="quota-value">{{ formatPercent(quotaUsagePercent) }}</div>
          </div>
        </div>

        <div class="quota-progress">
          <el-progress
            :percentage="Math.round(quotaUsagePercent)"
            :color="quotaProgressColor"
            :stroke-width="12"
          />
        </div>
      </template>

      <el-empty
        v-else
        :image-size="64"
        description="当前账号暂无可展示的额度信息，请联系系统配置 API 额度。"
      />
    </el-card>

    <el-dialog
      v-if="isZeroBasisRole"
      v-model="applyDialogVisible"
      title="申请成为 AI 开发者"
      width="680px"
      destroy-on-close
    >
      <el-form ref="applyFormRef" :model="applyForm" :rules="applyRules" label-position="top">
        <el-form-item label="申请理由" prop="reason">
          <el-input
            v-model="applyForm.reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请说明你申请成为 AI 开发者的原因"
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="applyForm.remark"
            type="textarea"
            :rows="2"
            maxlength="120"
            show-word-limit
            placeholder="可选填写"
          />
        </el-form-item>
      </el-form>
      <div class="reason-counter">提交内容长度：{{ submitReasonLength }}/500</div>
      <template #footer>
        <el-button @click="applyDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitApplication">提交申请</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editWorkflowVisible" title="修改工作流配置信息" width="600px">
      <el-form label-width="100px">
        <el-form-item label="标题">
          <el-input v-model="editWorkflowForm.title" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="editWorkflowForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="editWorkflowForm.category" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editWorkflowVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingWorkflow" @click="saveWorkflowEdit">保存修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../store/user'
import {
  fetchCurrentUserInfo,
  fetchMyDeveloperApplication,
  submitDeveloperApplication
} from '../api/developer'
// 核心：额外引入后端配合支持的 auditWorkflow 接口
import { fetchAdminWorkflows, updateWorkflowAdmin, takeDownWorkflow, auditWorkflow } from '../api/workflow'

const emit = defineEmits(['open-task-center'])
const userStore = useUserStore()

const loadingUser = ref(false)
const loadingApplication = ref(false)
const loadError = ref('')

const userInfo = ref(null)
const applicationInfo = ref(null)
const applicationApiMissing = ref(false)

const applyDialogVisible = ref(false)
const applyFormRef = ref(null)
const submitting = ref(false)
const applyForm = reactive({ reason: '', remark: '' })

// 工作流相关状态
const myWorkflows = ref([])
const loadingWorkflows = ref(false)
const editWorkflowVisible = ref(false)
const savingWorkflow = ref(false)
const editWorkflowForm = ref({ id: '', title: '', description: '', category: '', is_public: 0 })

const applyRules = {
  reason: [
    { required: true, message: '请填写申请理由', trigger: 'blur' },
    { min: 5, max: 200, message: '申请理由长度需在 5-200 字之间', trigger: 'blur' }
  ],
  remark: [{ max: 120, message: '备注不能超过 120 字', trigger: 'blur' }]
}

// 辅助函数
const clampPercent = (value) => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 0
  if (numeric < 0) return 0
  if (numeric > 100) return 100
  return numeric
}

const normalizeWarningPercent = (rawThreshold, quotaBase) => {
  if (rawThreshold === null || rawThreshold === undefined) return null
  const numeric = Number(rawThreshold)
  if (!Number.isFinite(numeric)) return null

  if (numeric >= 0 && numeric <= 1) return clampPercent(numeric * 100)
  if (quotaBase > 0 && numeric > 1) return clampPercent((numeric / quotaBase) * 100)
  return clampPercent(numeric)
}

const getByPath = (source, path) =>
  path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), source)

const readFirstNumeric = (source, paths = []) => {
  for (const path of paths) {
    const value = getByPath(source, path)
    if (value === null || value === undefined || value === '') continue
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

const formatNumber = (value) => Number(value || 0).toLocaleString()
const formatPercent = (value) => `${Math.round(Number(value || 0))}%`

const roleMap = { ADMIN: '管理员', DEVELOPER: 'AI 开发者', ZERO_BASIS: '零基础用户' }
const statusLabelMap = { none: '未申请', pending: '待审核', approved: '已通过', rejected: '已驳回' }
const statusTagMap = { none: 'info', pending: 'warning', approved: 'success', rejected: 'danger' }

const currentRole = computed(() => String(userInfo.value?.role || userStore.role || '').toUpperCase())
const roleLabel = computed(() => roleMap[currentRole.value] || currentRole.value || '用户')
const displayUserName = computed(() => userInfo.value?.username || userStore.name || '-')
const isAdminRole = computed(() => currentRole.value === 'ADMIN')
const isZeroBasisRole = computed(() => currentRole.value === 'ZERO_BASIS')

const accountStatus = computed(() => {
  const rawStatus = userInfo.value?.status
  if (rawStatus === 1 || rawStatus === '1' || rawStatus === 'enabled') return { label: '启用', type: 'success' }
  if (rawStatus === 0 || rawStatus === '0' || rawStatus === 'disabled') return { label: '禁用', type: 'danger' }
  return { label: '-', type: 'info' }
})

// Quota 逻辑
const quotaInfo = computed(() => {
  const source = userInfo.value || {}
  const tokenQuota = readFirstNumeric(source, [
    'tokenQuota',
    'token_quota',
    'api_token_limit',
    'quota.tokenQuota',
    'quota.token_quota',
    'quota.api_token_limit'
  ])
  const tokenLimit = readFirstNumeric(source, [
    'tokenLimit',
    'token_limit',
    'api_token_limit',
    'quota.tokenLimit',
    'quota.token_limit',
    'quota.api_token_limit'
  ])
  const tokenUsed = readFirstNumeric(source, [
    'tokenUsed',
    'token_used',
    'api_token_used',
    'quota.tokenUsed',
    'quota.token_used',
    'quota.api_token_used'
  ])
  const warningRaw = readFirstNumeric(source, [
    'warningThreshold',
    'warning_threshold',
    'api_token_warning_threshold',
    'quota.warningThreshold',
    'quota.warning_threshold',
    'quota.api_token_warning_threshold'
  ])
  const resolvedQuota = Number(tokenQuota || 0)

  return {
    tokenQuota: resolvedQuota,
    tokenLimit: Number(tokenLimit || tokenQuota || 0),
    tokenUsed: Number(tokenUsed || 0),
    warningThreshold: normalizeWarningPercent(warningRaw, resolvedQuota)
  }
})

const hasQuotaData = computed(() => {
  const { tokenQuota, tokenLimit, tokenUsed, warningThreshold } = quotaInfo.value
  return tokenQuota > 0 || tokenLimit > 0 || tokenUsed > 0 || warningThreshold !== null
})

const quotaUsagePercent = computed(() => {
  const quotaBase = Number(quotaInfo.value.tokenQuota || 0)
  if (quotaBase <= 0) return 0
  return clampPercent((Number(quotaInfo.value.tokenUsed || 0) / quotaBase) * 100)
})

const quotaWarningText = computed(() => quotaInfo.value.warningThreshold === null ? '-' : formatPercent(quotaInfo.value.warningThreshold))
const isQuotaInsufficient = computed(() => {
  const used = Number(quotaInfo.value.tokenUsed || 0), quota = Number(quotaInfo.value.tokenQuota || 0)
  return quota > 0 && used >= quota
})
const isQuotaWarning = computed(() => quotaInfo.value.warningThreshold !== null && quotaUsagePercent.value >= Number(quotaInfo.value.warningThreshold || 0))

const quotaStatus = computed(() => {
  if (!hasQuotaData.value) return { label: '暂无额度数据', type: 'info' }
  if (isQuotaInsufficient.value) return { label: '额度不足', type: 'danger' }
  if (isQuotaWarning.value) return { label: '预警', type: 'warning' }
  return { label: '正常', type: 'success' }
})

const quotaProgressColor = computed(() => {
  if (isQuotaInsufficient.value) return '#F56C6C'
  if (isQuotaWarning.value) return '#E6A23C'
  return '#67C23A'
})

// 申请逻辑
const applicationStatus = computed(() => applicationInfo.value?.status || 'none')
const canSubmitApplication = computed(() => isZeroBasisRole.value && !applicationApiMissing.value && applicationStatus.value !== 'pending')
const applyCardTag = computed(() => {
  if (!isZeroBasisRole.value) return { label: '无需申请', type: 'success' }
  return { label: statusLabelMap[applicationStatus.value] || '未申请', type: statusTagMap[applicationStatus.value] || 'info' }
})
const submitReasonText = computed(() => `${String(applyForm.reason || '').trim()}${applyForm.remark ? `\n备注：${applyForm.remark}` : ''}`)
const submitReasonLength = computed(() => submitReasonText.value.length)

const resolveRoleTag = (role) => role === 'ADMIN' ? 'danger' : role === 'DEVELOPER' ? 'success' : 'info'

const normalizeApplicationStatus = (value) => {
  const num = Number(value)
  if (num === 0) return 'pending'
  if (num === 1) return 'approved'
  if (num === 2) return 'rejected'
  const key = String(value || '').trim().toUpperCase()
  return ['PENDING', 'WAITING'].includes(key) ? 'pending' : ['APPROVED', 'SUCCESS'].includes(key) ? 'approved' : ['REJECTED', 'FAILED'].includes(key) ? 'rejected' : 'none'
}

const normalizeApplicationRecord = (record) => {
  if (!record) return null
  return {
    id: record.id ?? null,
    reason: record.reason || '',
    status: normalizeApplicationStatus(record.status),
    reviewComment: record.review_comment || record.reviewComment || '',
    createdAt: record.created_at || record.createdAt || ''
  }
}

const formatTime = (value) => {
  if (!value) return '-'
  const formatted = String(value).replace('T', ' ')
  return formatted.length >= 19 ? formatted.slice(0, 19) : formatted
}

const resetApplyForm = () => {
  applyForm.reason = ''
  applyForm.remark = ''
  applyFormRef.value?.clearValidate?.()
}

// 加载逻辑
const loadUser = async () => {
  loadingUser.value = true
  try { userInfo.value = await fetchCurrentUserInfo() } finally { loadingUser.value = false }
}

const loadApplication = async () => {
  if (!isZeroBasisRole.value) { applicationApiMissing.value = false; applicationInfo.value = null; return }
  loadingApplication.value = true
  try {
    const result = await fetchMyDeveloperApplication()
    applicationApiMissing.value = result.apiMissing
    applicationInfo.value = normalizeApplicationRecord(result.application)
  } finally { loadingApplication.value = false }
}

// 管理员获取全量工作流
const loadMyWorkflows = async () => {
  if (!isAdminRole.value) {
    myWorkflows.value = []
    return
  }
  loadingWorkflows.value = true
  try {
    const result = await fetchAdminWorkflows({ page: 1, page_size: 50 })
    const list = result?.items || result?.list || result?.data?.list || result?.data?.items || []
    myWorkflows.value = Array.isArray(list) ? list : []
  } catch (error) {
    console.error('加载管理员工作流列表失败', error)
  } finally {
    loadingWorkflows.value = false
  }
}

const refreshAll = async () => {
  loadError.value = ''
  try {
    await loadUser()
    await loadApplication()
    await loadMyWorkflows()
  } catch (error) {
    loadError.value = error.message || '页面数据加载失败，请稍后重试'
  }
}

const openApplyDialog = () => {
  if (!canSubmitApplication.value) return
  applyDialogVisible.value = true
}

const submitApplication = async () => {
  if (!applyFormRef.value || !isZeroBasisRole.value) return
  const valid = await applyFormRef.value.validate().catch(() => false)
  if (!valid) return

  const reason = submitReasonText.value
  if (!reason || reason.length > 500) {
    ElMessage.warning('申请内容需在 1-500 字以内')
    return
  }

  submitting.value = true
  try {
    const response = await submitDeveloperApplication({ reason })
    applicationInfo.value = normalizeApplicationRecord(response) || { id: null, reason, status: 'pending', reviewComment: '', createdAt: '' }
    applyDialogVisible.value = false
    resetApplyForm()
    ElMessage.success('申请提交成功')
    await loadApplication()
  } catch (error) {
    ElMessage.error(error.message || '申请提交失败')
  } finally {
    submitting.value = false
  }
}

// ===== 管理员工作流操作 =====

// 新增：管理员一键审核通过的核心处理逻辑
const handleAuditApprove = async (row) => {
  try {
    await ElMessageBox.confirm('确定要通过此工作流的审核吗？通过后，若该工作流设置为公开，则会自动呈现在社区大厅中。', '提示', {
      type: 'success',
      confirmButtonText: '审核通过',
      cancelButtonText: '取消'
    })
    const id = row.id || row.workflow_id
    // 调用 POST /api/agent/admin/workflows/{id}/audit 接口
    await auditWorkflow(id, {
      audit_status: 'APPROVED',
      category: row.category || undefined
    })
    ElMessage.success('该工作流已成功通过审核！')
    await loadMyWorkflows() // 重新拉取列表，实时刷新状态
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '审核处理失败')
    }
  }
}

const editWorkflowConfig = (row) => {
  editWorkflowForm.value = {
    id: row.id || row.workflow_id,
    title: row.title || row.name || '',
    description: row.description || '',
    category: row.category || '',
    is_public: row.is_public ? 1 : 0
  }
  editWorkflowVisible.value = true
}

const saveWorkflowEdit = async () => {
  savingWorkflow.value = true
  try {
    await updateWorkflowAdmin(editWorkflowForm.value.id, {
      title: editWorkflowForm.value.title,
      description: editWorkflowForm.value.description,
      category: editWorkflowForm.value.category,
      is_public: editWorkflowForm.value.is_public
    })
    ElMessage.success('配置保存成功')
    editWorkflowVisible.value = false
    await loadMyWorkflows()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingWorkflow.value = false
  }
}

const toggleWorkflowPublic = async (row) => {
  try {
    const id = row.id || row.workflow_id
    await updateWorkflowAdmin(id, { is_public: row.is_public ? 0 : 1 })
    ElMessage.success(row.is_public ? '已设为私有' : '已公开')
    await loadMyWorkflows()
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
  }
}

const handleTakeDown = async (row) => {
  try {
    await ElMessageBox.confirm('确定要下架这个工作流吗？', '提示', { type: 'warning' })
    const id = row.id || row.workflow_id
    await takeDownWorkflow(id)
    ElMessage.success('下架成功')
    await loadMyWorkflows()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '下架失败')
    }
  }
}

const openDeveloperWorkbench = () => {
  emit('open-task-center')
}

onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
.user-center { width: 100%; height: 100%; padding: 24px 0 32px; overflow: auto; }
.head-actions { display: flex; align-items: center; gap: 10px; }
.page-alert { margin-bottom: 16px; }
.top-grid { margin-bottom: 16px; }
.panel-card { min-height: 320px; }
.workflow-card { margin-bottom: 16px; min-height: auto; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.card-title { font-weight: 680; color: var(--zs-text); }
.basic-info-list { display: grid; gap: 10px; }
.basic-info-item { border: 1px solid var(--zs-border); border-radius: 12px; background: var(--zs-panel-soft); padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.basic-info-label { color: var(--zs-muted); font-size: 13px; }
.basic-info-value { color: var(--zs-text); font-size: 14px; text-align: right; }
.apply-body { display: flex; flex-direction: column; gap: 12px; }
.apply-intro { margin: 0; color: var(--zs-text); line-height: 1.7; }
.apply-intro.muted { color: var(--zs-muted); }
.state-alert { margin-bottom: 2px; }
.state-box { border: 1px solid var(--zs-border); background: var(--zs-panel-soft); border-radius: 14px; padding: 14px 16px; }
.state-box h4 { margin: 0; font-size: 16px; color: var(--zs-text); }
.state-box p { margin: 8px 0 0; color: var(--zs-muted); line-height: 1.65; }
.state-box.success { border-color: rgba(125, 211, 167, 0.5); }
.state-box.warning { border-color: rgba(240, 195, 106, 0.6); }
.state-box.danger { border-color: rgba(255, 138, 138, 0.55); }
.state-actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.quota-card { margin-bottom: 16px; min-height: auto; }
.quota-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
.quota-item { border: 1px solid var(--zs-border); border-radius: 12px; background: var(--zs-panel-soft); padding: 12px 14px; }
.quota-label { color: var(--zs-muted); font-size: 13px; }
.quota-value { margin-top: 7px; color: var(--zs-text); font-size: 16px; font-weight: 650; line-height: 1.4; }
.quota-progress { margin-top: 14px; }
.reason-counter { color: var(--zs-muted); font-size: 13px; margin-top: 5px; }

@media (max-width: 960px) {
  .panel-card { min-height: auto; }
  .basic-info-item { align-items: flex-start; flex-direction: column; }
  .basic-info-value { text-align: left; }
}
</style>
