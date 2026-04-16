<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="8">
        <el-card shadow="hover">
          <div style="color: #999; font-size: 14px;">用户总数</div>
          <div style="font-size: 28px; font-weight: bold; color: #409EFF; margin-top: 10px;">
            {{ totalCount }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div style="color: #999; font-size: 14px;">启用账号</div>
          <div style="font-size: 28px; font-weight: bold; color: #67C23A; margin-top: 10px;">
            {{ enabledCount }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div style="color: #999; font-size: 14px;">禁用账号</div>
          <div style="font-size: 28px; font-weight: bold; color: #F56C6C; margin-top: 10px;">
            {{ disabledCount }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header>
        <div class="header-row">
          <span style="font-weight: bold;">后台用户管理</span>
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button label="table">表格视图</el-radio-button>
            <el-radio-button label="card">卡片视图</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="用户名">
          <el-input
            v-model="filters.username"
            clearable
            placeholder="请输入用户名"
            style="width: 220px;"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="filters.role" placeholder="全部角色" style="width: 180px;">
            <el-option label="全部角色" value="" />
            <el-option
              v-for="role in roleOptions"
              :key="role.value"
              :label="role.label"
              :value="role.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" style="width: 160px;">
            <el-option label="全部状态" value="" />
            <el-option label="启用" value="enabled" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSearch">筛选</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table
        v-if="viewMode === 'table'"
        :data="pagedUsers"
        style="width: 100%"
        border
        v-loading="loading"
      >
        <el-table-column prop="username" label="用户名" min-width="160" />
        <el-table-column label="角色" width="140">
          <template #default="scope">
            <el-tag :type="resolveRoleTag(scope.row.role)" effect="light">
              {{ resolveRoleLabel(scope.row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="220" />
        <el-table-column label="账号状态" width="220">
          <template #default="scope">
            <div class="status-cell">
              <el-tag :type="resolveStatusTag(scope.row.status)" effect="light">
                {{ resolveStatusLabel(scope.row.status) }}
              </el-tag>
              <el-switch
                :model-value="scope.row.status === 'enabled'"
                inline-prompt
                active-text="启用"
                inactive-text="禁用"
                @change="(checked) => handleStatusSwitch(scope.row, checked)"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="lastLogin" label="最近登录" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" link @click="openRoleDialog(scope.row)">
              修改角色
            </el-button>
            <el-button
              size="small"
              :type="scope.row.status === 'enabled' ? 'danger' : 'success'"
              link
              @click="toggleStatus(scope.row)"
            >
              {{ scope.row.status === 'enabled' ? '禁用账号' : '启用账号' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-row v-else :gutter="16" v-loading="loading">
        <el-col
          v-for="user in pagedUsers"
          :key="user.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="8"
          style="margin-bottom: 16px;"
        >
          <el-card shadow="hover" class="user-card">
            <div class="user-card-header">
              <el-avatar :size="36">
                <el-icon><UserFilled /></el-icon>
              </el-avatar>
              <div>
                <div class="username">{{ user.username }}</div>
              </div>
            </div>
            <div class="user-card-meta">
              <el-tag :type="resolveRoleTag(user.role)" effect="plain">
                {{ resolveRoleLabel(user.role) }}
              </el-tag>
              <el-tag :type="resolveStatusTag(user.status)" effect="light">
                {{ resolveStatusLabel(user.status) }}
              </el-tag>
            </div>
            <div class="meta-text">邮箱：{{ user.email }}</div>
            <div class="meta-text">最近登录：{{ user.lastLogin }}</div>
            <div class="card-actions">
              <el-switch
                :model-value="user.status === 'enabled'"
                inline-prompt
                active-text="启用"
                inactive-text="禁用"
                @change="(checked) => handleStatusSwitch(user, checked)"
              />
              <el-button type="primary" plain size="small" @click="openRoleDialog(user)">
                修改角色
              </el-button>
              <el-button
                :type="user.status === 'enabled' ? 'danger' : 'success'"
                plain
                size="small"
                @click="toggleStatus(user)"
              >
                {{ user.status === 'enabled' ? '禁用' : '启用' }}
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <div class="pagination-wrapper" v-if="totalCount > pageSize">
        <el-pagination
          background
          layout="prev, pager, next, total"
          :total="totalCount"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="roleDialogVisible" title="修改用户角色" width="420px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="用户名">
          <el-text>{{ editingUser?.username || '-' }}</el-text>
        </el-form-item>
        <el-form-item label="当前角色">
          <el-text>{{ editingUser ? resolveRoleLabel(editingUser.role) : '-' }}</el-text>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="pendingRole" placeholder="请选择新角色" style="width: 100%;">
            <el-option
              v-for="role in roleOptions"
              :key="role.value"
              :label="role.label"
              :value="role.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roleSubmitting" @click="submitRoleChange">
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
// 导入接口api
import { fetchUserList, updateUserRole, updateUserStatus } from '../api/AdminUserManagement'

const filters = ref({
  username: '',
  role: '',
  status: ''
})

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: 'AI开发者', value: 'AIdeveloper' },
  { label: '零基础用户', value: 'user' }
]

const roleTagMap = {
  admin: 'danger',
  AIdeveloper: 'success',
  user: 'info'
}

const statusTagMap = {
  enabled: 'success',
  disabled: 'info'
}

const users = ref([])
const totalCount = ref(0)
const loading = ref(false)
const viewMode = ref('table')

const currentPage = ref(1)
const pageSize = 6

const pagedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return users.value.slice(start, end)
})

const enabledCount = computed(
  () => users.value.filter((user) => user.status === 'enabled').length
)

const disabledCount = computed(
  () => users.value.filter((user) => user.status === 'disabled').length
)

const roleDialogVisible = ref(false)
const roleSubmitting = ref(false)
const editingUser = ref(null)
const pendingRole = ref('')

const resolveRoleLabel = (value) => {
  const target = roleOptions.find((item) => item.value === value)
  return target ? target.label : value
}

const resolveRoleTag = (value) => roleTagMap[value] || 'info'
const resolveStatusLabel = (value) => (value === 'enabled' ? '启用' : '禁用')
const resolveStatusTag = (value) => statusTagMap[value] || 'info'

const buildQueryParams = () => ({
  username: filters.value.username.trim(),
  role: filters.value.role,
  status: filters.value.status
})

const loadUsers = async () => {
  loading.value = true
  try {
    const result = await fetchUserList(buildQueryParams())
    users.value = Array.isArray(result.list) ? result.list : []
    totalCount.value = Number(result.total || 0)
    currentPage.value = 1
  } catch (error) {
    ElMessage.error(error.message || '用户列表加载失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  loadUsers()
}

const handleReset = () => {
  filters.value = {
    username: '',
    role: '',
    status: ''
  }
  loadUsers()
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const openRoleDialog = (user) => {
  editingUser.value = user
  pendingRole.value = user.role
  roleDialogVisible.value = true
}

const updateLocalUser = (userId, patch) => {
  const target = users.value.find((user) => user.id === userId)
  if (target) {
    Object.assign(target, patch)
  }
}

const submitRoleChange = async () => {
  if (!editingUser.value || !pendingRole.value) {
    ElMessage.warning('请选择新角色')
    return
  }

  if (editingUser.value.role === pendingRole.value) {
    roleDialogVisible.value = false
    return
  }

  roleSubmitting.value = true
  try {
    await updateUserRole({
      userId: editingUser.value.id,
      role: pendingRole.value
    })
    updateLocalUser(editingUser.value.id, { role: pendingRole.value })
    ElMessage.success('角色修改成功')
    roleDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error.message || '角色修改失败')
  } finally {
    roleSubmitting.value = false
  }
}

const commitStatusChange = async (user, nextStatus) => {
  await updateUserStatus({
    userId: user.id,
    status: nextStatus
  })
  updateLocalUser(user.id, { status: nextStatus })
  ElMessage.success(`账号已${nextStatus === 'enabled' ? '启用' : '禁用'}`)
}

const toggleStatus = async (user) => {
  const nextStatus = user.status === 'enabled' ? 'disabled' : 'enabled'
  const actionText = nextStatus === 'enabled' ? '启用' : '禁用'

  try {
    await ElMessageBox.confirm(
      `确认${actionText}用户「${user.username}」吗？`,
      `${actionText}账号`,
      {
        type: 'warning',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
      }
    )
    await commitStatusChange(user, nextStatus)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || `${actionText}失败`)
    }
  }
}

const handleStatusSwitch = async (user, checked) => {
  const nextStatus = checked ? 'enabled' : 'disabled'
  if (nextStatus === user.status) {
    return
  }
  await toggleStatus(user)
}

onMounted(() => {
  loadUsers()
})

</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.filter-form {
  margin-bottom: 16px;
}

.status-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.user-card {
  min-height: 230px;
}

.user-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.username {
  font-weight: 600;
  color: #303133;
}

.display-name {
  color: #909399;
  font-size: 13px;
  margin-top: 2px;
}

.user-card-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.meta-text {
  color: #606266;
  font-size: 13px;
  margin-bottom: 6px;
  word-break: break-word;
}

.card-actions {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
