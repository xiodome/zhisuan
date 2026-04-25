<template>
  <Login v-if="!userStore.token" />

  <div v-else class="app-shell">
    <aside class="app-sidebar">
      <div class="brand">
        <div class="brand-mark">
          <el-icon><Connection /></el-icon>
        </div>
        <div class="brand-copy">
          <div class="brand-name">智算</div>
          <div class="brand-sub">AI4ML Agent</div>
        </div>
      </div>

      <el-menu :default-active="activeIndex" class="app-menu" @select="(idx) => (activeIndex = idx)">
        <el-menu-item index="1" title="任务中心">
          <span class="nav-icon">
            <el-icon><EditPen /></el-icon>
          </span>
          <span class="nav-text">任务</span>
        </el-menu-item>

        <el-menu-item index="3" v-if="userStore.role === 'ADMIN'" title="管理控制台">
          <span class="nav-icon">
            <el-icon><Monitor /></el-icon>
          </span>
          <span class="nav-text">运营</span>
        </el-menu-item>

        <el-menu-item index="4" v-if="userStore.role === 'ADMIN'" title="用户管理">
          <span class="nav-icon">
            <el-icon><User /></el-icon>
          </span>
          <span class="nav-text">用户</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-section">
        <el-tooltip placement="right" :content="`${userStore.name} · ${roleLabel}`">
        <div class="identity-card">
          <div class="user-avatar">
            <el-icon><UserFilled /></el-icon>
          </div>
          <div class="identity-copy">
            <div class="identity-name">{{ userStore.name }}</div>
            <div class="identity-role">{{ roleLabel }}</div>
          </div>
        </div>
        </el-tooltip>
      </div>

      <button class="logout-button" title="退出登录" @click="userStore.logout">
        <el-icon><SwitchButton /></el-icon>
      </button>
    </aside>

    <main class="app-main">
      <header class="app-header">
        <div>
          <div class="header-kicker">{{ currentSection.kicker }}</div>
          <h1>{{ currentSection.title }}</h1>
        </div>
        <div class="header-actions">
          <el-tag effect="plain">{{ roleLabel }}</el-tag>
        </div>
      </header>

      <section class="content-surface">
        <TaskCenter v-if="activeIndex === '1'" />
        <AdminConsole v-if="activeIndex === '3'" />
        <AdminUserManagement v-if="activeIndex === '4'" />
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useUserStore } from './store/user'
import Login from './components/Login.vue'
import TaskCenter from './components/TaskCenter.vue'
import AdminConsole from './components/AdminConsole.vue'
import AdminUserManagement from './components/AdminUserManagement.vue'

const userStore = useUserStore()
const activeIndex = ref('1')

const roleMap = {
  ADMIN: '管理员',
  DEVELOPER: 'AI 开发者',
  ZERO_BASIS: '零基础用户'
}

const sectionMap = {
  1: { kicker: 'Agent 工作台', title: '和建模 Agent 开始一次任务' },
  3: { kicker: '运营管理', title: '平台控制台' },
  4: { kicker: '身份权限', title: '用户与角色管理' }
}

const roleLabel = computed(() => roleMap[userStore.role] || userStore.role || '用户')
const currentSection = computed(() => sectionMap[activeIndex.value] || sectionMap[1])

watch(
  () => userStore.role,
  (newRole) => {
    if (newRole !== 'ADMIN' && ['3', '4'].includes(activeIndex.value)) {
      activeIndex.value = '1'
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  background: var(--zs-bg);
  color: var(--zs-text);
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 10px;
  border-right: 1px solid #242424;
  background: var(--zs-sidebar);
  z-index: 10;
  overflow: hidden;
  width: 76px;
  transition:
    width 0.2s ease,
    box-shadow 0.2s ease;
}

.app-sidebar:hover {
  width: 220px;
  box-shadow: 18px 0 42px rgba(0, 0, 0, 0.3);
}

.brand {
  justify-content: flex-start;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0 12px;
}

.brand-mark,
.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--zs-text);
  border: 1px solid var(--zs-border);
  background: #101010;
}

.brand-mark {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  margin-left: 10px;
}

.brand-copy,
.identity-copy {
  min-width: 0;
  opacity: 0;
  transform: translateX(-6px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
  white-space: nowrap;
}

.app-sidebar:hover .brand-copy,
.app-sidebar:hover .identity-copy {
  opacity: 1;
  transform: translateX(0);
}

.brand-name,
.identity-name {
  color: #f4f4f4;
  font-size: 14px;
  font-weight: 760;
}

.brand-sub,
.identity-role {
  margin-top: 2px;
  color: #9f9f9f;
  font-size: 12px;
}

.app-menu {
  flex: 1;
  border-right: 0 !important;
  background: transparent !important;
}

.app-menu :deep(.el-menu-item) {
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 2px 0;
  padding: 0 !important;
  border-radius: 16px;
  color: #d7d7d7;
  font-size: 14px;
  font-weight: 620;
  position: relative;
  overflow: hidden;
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.app-menu :deep(.el-menu-item .el-icon) {
  margin-right: 0;
  font-size: 20px;
}

.nav-icon {
  flex: 0 0 54px;
  width: 54px;
  height: 54px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-icon .el-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-text {
  flex: 0 0 auto;
  margin-left: 0;
  color: #f4f4f4;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-6px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
  white-space: nowrap;
}

.app-sidebar:hover .app-menu :deep(.el-menu-item) {
  width: 100%;
  justify-content: flex-start;
  padding: 0 !important;
}

.app-sidebar:hover .nav-text {
  opacity: 1;
  transform: translateX(0);
}

.app-menu :deep(.el-menu-item:hover) {
  background: #242424;
  transform: translateY(-1px);
}

.app-menu :deep(.el-menu-item.is-active) {
  color: #ffffff;
  background: #303030;
}

.sidebar-section {
  padding: 0;
}

.identity-card {
  justify-content: flex-start;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 14px;
  background: #202020;
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.identity-card:hover {
  background: #303030;
  transform: translateY(-1px);
}

.user-avatar {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
}

.logout-button {
  width: 54px;
  height: 54px;
  justify-content: center;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  color: #d9d9d9;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.logout-button:hover {
  background: #242424;
  transform: translateY(-1px);
}

.app-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 0 26px 22px;
}

.app-header {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid #242424;
}

.header-kicker {
  color: var(--zs-muted);
  font-size: 13px;
  font-weight: 650;
}

.app-header h1 {
  margin: 4px 0 0;
  color: var(--zs-text);
  font-size: 22px;
  font-weight: 760;
  line-height: 1.25;
  letter-spacing: 0;
}

.content-surface {
  flex: 1;
  min-height: 0;
}

@media (max-width: 920px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    position: relative;
    height: auto;
  }

  .app-menu {
    display: flex;
    flex-direction: row;
    gap: 6px;
  }

  .app-main {
    padding: 0 14px 14px;
  }
}
</style>
