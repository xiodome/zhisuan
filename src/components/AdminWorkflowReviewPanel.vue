<template>
  <div class="workflow-review-panel">
    <el-row :gutter="16" class="summary-row">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover">
          <div class="summary-label">工作流总数</div>
          <div class="summary-value text-primary">{{ summary.total }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover">
          <div class="summary-label">待审核</div>
          <div class="summary-value text-warning">{{ summary.pending }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover">
          <div class="summary-label">已通过</div>
          <div class="summary-value text-success">{{ summary.approved }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover">
          <div class="summary-label">已驳回/下架</div>
          <div class="summary-value text-danger">{{ summary.rejectedOrOffline }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover" class="section-card">
      <template #header>
        <div class="header-row">
          <span class="section-title">工作流审核管理</span>
          <el-button size="small" :loading="loading" @click="loadWorkflows">刷新</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="标题 / 创建者 / 分类 / 标签"
            style="width: 280px;"
            @keyup.enter="handleFilter"
          />
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="filters.status" clearable placeholder="全部状态" style="width: 170px;" @change="handleFilter">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleFilter">筛选</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-alert v-if="errorMessage" type="error" :closable="false" class="state-alert" :title="errorMessage" />

      <el-table :data="pagedRows" border style="width: 100%" v-loading="loading">
        <el-table-column prop="title" label="工作流标题" min-width="220" show-overflow-tooltip />
        <el-table-column prop="creator" label="创建者" width="160" show-overflow-tooltip />
        <el-table-column prop="category" label="分类" width="140" show-overflow-tooltip />
        <el-table-column label="审核状态" width="130">
          <template #default="scope">
            <el-tag :type="resolveStatusTag(scope.row.reviewStatus)">{{ resolveStatusLabel(scope.row.reviewStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="公开状态" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.isPublic ? 'success' : 'info'">{{ scope.row.isPublic ? '公开' : '私有' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="180" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.tags.join('，') || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column prop="rejectionReason" label="驳回原因" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" link @click="openDetail(scope.row)">详情</el-button>
            <el-button size="small" type="success" link :disabled="scope.row.reviewStatus === 'APPROVED'" @click="approve(scope.row)">通过</el-button>
            <el-button size="small" type="danger" link @click="reject(scope.row)">驳回</el-button>
            <el-button size="small" type="warning" link @click="takeDown(scope.row)">下架</el-button>
            <el-button size="small" type="info" link @click="openEdit(scope.row)">修改</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && !filteredRows.length" description="暂无工作流审核数据" />

      <div class="pagination-wrapper" v-if="filteredRows.length > pageSize">
        <el-pagination
          background
          layout="prev, pager, next, total"
          :total="filteredRows.length"
          :page-size="pageSize"
          :current-page="page"
          @current-change="(value) => (page = value)"
        />
      </div>
    </el-card>

    <el-dialog v-model="editDialogVisible" title="修改工作流信息" width="640px" destroy-on-close>
      <el-form label-width="120px">
        <el-form-item label="工作流标题">
          <el-input v-model="editForm.title" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="editForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="editForm.category" />
        </el-form-item>
        <el-form-item label="适用任务类型">
          <el-input v-model="editForm.applicableTaskTypes" />
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="editForm.tags" multiple filterable allow-create default-first-option style="width: 100%;" />
        </el-form-item>
        <el-form-item label="公开状态">
          <el-switch v-model="editForm.isPublic" inline-prompt active-text="公开" inactive-text="私有" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import {
  auditWorkflow,
  fetchAdminWorkflows,
  takeDownWorkflow,
  updateWorkflowAdmin
} from '../api/workflow'

const router = useRouter()

const statusOptions = [
  { label: '审核中', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已下架', value: 'OFFLINE' }
]

const loading = ref(false)
const errorMessage = ref('')
const rows = ref([])
const page = ref(1)
const pageSize = 8

const filters = reactive({
  keyword: '',
  status: ''
})

const editDialogVisible = ref(false)
const editSubmitting = ref(false)
const editingRow = ref(null)
const editForm = reactive({
  title: '',
  description: '',
  category: '',
  applicableTaskTypes: '',
  tags: [],
  isPublic: false
})

const normalizeStatus = (value) => {
  if (value === null || value === undefined || value === '') return 'UNKNOWN'

  const numeric = Number(value)
  if (!Number.isNaN(numeric)) {
    if (numeric === 0) return 'PENDING'
    if (numeric === 1) return 'APPROVED'
    if (numeric === 2) return 'REJECTED'
    if (numeric === 3) return 'OFFLINE'
  }

  const normalized = String(value).trim().toUpperCase()
  if (['PENDING', 'TO_REVIEW', 'WAITING'].includes(normalized)) return 'PENDING'
  if (['APPROVED', 'SUCCESS', 'PASSED'].includes(normalized)) return 'APPROVED'
  if (['REJECTED', 'FAILED', 'REFUSED'].includes(normalized)) return 'REJECTED'
  if (['OFFLINE', 'TAKE_DOWN', 'TAKEN_DOWN'].includes(normalized)) return 'OFFLINE'
  return normalized || 'UNKNOWN'
}

const parseTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  const raw = String(value || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const formatTime = (value) => {
  if (!value) return '-'
  const text = String(value).replace('T', ' ')
  return text.length > 19 ? text.slice(0, 19) : text
}

const resolveCreatorName = (item) => {
  return (
    item?.creator ||
    item?.creator_name ||
    item?.username ||
    item?.user_name ||
    item?.owner_username ||
    item?.owner_name ||
    item?.share_username ||
    item?.shared_by_username ||
    '-'
  )
}

const normalizeRow = (item) => ({
  id: item?.id ?? item?.workflow_id,
  title: item?.title || item?.name || '未命名工作流',
  description: item?.description || '',
  category: item?.category || '-',
  creator: resolveCreatorName(item),
  reviewStatus: normalizeStatus(item?.audit_status ?? item?.status),
  tags: parseTags(item?.tags || item?.tag_list),
  createdAt: formatTime(item?.created_at || item?.create_time),
  rejectionReason: item?.rejection_reason || '-',
  isPublic: Boolean(item?.is_public),
  applicableTaskTypes: item?.applicable_task_types || item?.task_type || '',
  raw: item
})

const filteredRows = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase()
  return rows.value.filter((item) => {
    if (filters.status && item.reviewStatus !== filters.status) return false

    if (!keyword) return true

    return [item.title, item.category, item.creator, item.tags.join(',')]
      .some((field) => String(field || '').toLowerCase().includes(keyword))
  })
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredRows.value.slice(start, start + pageSize)
})

const summary = computed(() => ({
  total: rows.value.length,
  pending: rows.value.filter((item) => item.reviewStatus === 'PENDING').length,
  approved: rows.value.filter((item) => item.reviewStatus === 'APPROVED').length,
  rejectedOrOffline: rows.value.filter((item) => ['REJECTED', 'OFFLINE'].includes(item.reviewStatus)).length
}))

const resolveStatusLabel = (status) => {
  if (status === 'PENDING') return '审核中'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  if (status === 'OFFLINE') return '已下架'
  if (status === 'UNKNOWN') return '未知'
  return status
}

const resolveStatusTag = (status) => {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'PENDING') return 'warning'
  if (status === 'OFFLINE') return 'info'
  return 'info'
}

const resolveQueryStatus = () => {
  if (['PENDING', 'APPROVED', 'REJECTED', 'OFFLINE'].includes(filters.status)) {
    return filters.status
  }
  return ''
}

const loadWorkflows = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const list = await fetchAdminWorkflows(resolveQueryStatus())
    rows.value = (Array.isArray(list) ? list : []).map(normalizeRow).filter((item) => item.id !== undefined && item.id !== null)
    page.value = 1
  } catch (error) {
    rows.value = []
    errorMessage.value = error.message || '加载管理员工作流列表失败'
  } finally {
    loading.value = false
  }
}

const handleFilter = async () => {
  await loadWorkflows()
}

const resetFilters = async () => {
  filters.keyword = ''
  filters.status = ''
  await loadWorkflows()
}

const openDetail = (row) => {
  router.push(`/community/workflow/${row.id}`)
}

const approve = async (row) => {
  try {
    await ElMessageBox.confirm(`确认通过「${row.title}」吗？`, '工作流审核', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
    await auditWorkflow(row.id, {
      audit_status: 'APPROVED',
      rejection_reason: null
    })
    ElMessage.success('工作流审核通过')
    await loadWorkflows()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '审核通过失败')
    }
  }
}

const reject = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因（可选）', `驳回工作流：${row.title}`, {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：说明不完整'
    })

    await auditWorkflow(row.id, {
      audit_status: 'REJECTED',
      rejection_reason: String(value || '').trim() || null
    })
    ElMessage.success('工作流已驳回')
    await loadWorkflows()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '驳回失败')
    }
  }
}

const takeDown = async (row) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入下架原因', `下架工作流：${row.title}`, {
      confirmButtonText: '确认下架',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：内容违规'
    })
    const reason = String(value || '').trim()
    if (!reason) {
      ElMessage.warning('下架原因不能为空')
      return
    }

    await takeDownWorkflow(row.id, reason)
    ElMessage.success('工作流已下架')
    await loadWorkflows()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '下架失败')
    }
  }
}

const openEdit = (row) => {
  editingRow.value = row
  editForm.title = row.title || ''
  editForm.description = row.description || ''
  editForm.category = row.category === '-' ? '' : row.category
  editForm.applicableTaskTypes = row.applicableTaskTypes || ''
  editForm.tags = [...row.tags]
  editForm.isPublic = Boolean(row.isPublic)
  editDialogVisible.value = true
}

const submitEdit = async () => {
  if (!editingRow.value) return
  if (!String(editForm.title || '').trim()) {
    ElMessage.warning('请先填写工作流标题')
    return
  }

  editSubmitting.value = true
  try {
    await updateWorkflowAdmin(editingRow.value.id, {
      title: String(editForm.title || '').trim(),
      description: String(editForm.description || '').trim() || null,
      category: String(editForm.category || '').trim() || null,
      applicable_task_types: String(editForm.applicableTaskTypes || '').trim() || null,
      tags: editForm.tags,
      is_public: editForm.isPublic ? 1 : 0
    })
    ElMessage.success('工作流信息已更新')
    editDialogVisible.value = false
    await loadWorkflows()
  } catch (error) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    editSubmitting.value = false
  }
}

onMounted(() => {
  loadWorkflows()
})
</script>

<style scoped>
.workflow-review-panel {
  width: 100%;
}

.summary-row {
  margin-bottom: 16px;
}

.summary-label {
  color: var(--zs-muted);
  font-size: 13px;
}

.summary-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
}

.text-primary {
  color: var(--zs-text);
}

.text-success {
  color: var(--zs-success);
}

.text-warning {
  color: var(--zs-warning);
}

.text-danger {
  color: var(--zs-danger);
}

.section-card {
  margin-bottom: 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-weight: 600;
  color: var(--zs-text);
}

.filter-form {
  margin-bottom: 14px;
}

.state-alert {
  margin-bottom: 12px;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
