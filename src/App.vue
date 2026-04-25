<template>
  <Login v-if="!userStore.token" />

  <div v-else class="app-shell">
    <aside class="app-sidebar">
      <div class="brand">
        <div class="brand-mark">
          <el-icon><Connection /></el-icon>
        </div>
        <div>
          <div class="brand-name">智算 AI4ML</div>
          <div class="brand-sub">Agent Studio</div>
        </div>
      </div>

      <el-menu
        :default-active="activeIndex"
        class="app-menu"
        @select="(idx) => (activeIndex = idx)"
      >
        <el-menu-item index="1">
          <el-icon><Compass /></el-icon>
          <span>智能建模</span>
        </el-menu-item>

        <el-menu-item index="2" v-if="['ADMIN', 'DEVELOPER'].includes(userStore.role)">
          <el-icon><DocumentChecked /></el-icon>
          <span>人工审核</span>
        </el-menu-item>

        <el-menu-item index="3" v-if="userStore.role === 'ADMIN'">
          <el-icon><Monitor /></el-icon>
          <span>管理控制台</span>
        </el-menu-item>

        <el-menu-item index="4" v-if="userStore.role === 'ADMIN'">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-foot">
        <div class="status-dot"></div>
        <div>
          <div class="foot-title">Backend</div>
          <div class="foot-text">127.0.0.1:8000</div>
        </div>
      </div>
    </aside>

    <main class="app-main">
      <header class="app-header">
        <div>
          <div class="header-kicker">{{ currentSection.kicker }}</div>
          <h1>{{ currentSection.title }}</h1>
        </div>
        <div class="user-strip">
          <div class="user-avatar">
            <el-icon><UserFilled /></el-icon>
          </div>
          <div class="user-meta">
            <div class="user-name">{{ userStore.name }}</div>
            <div class="user-role">{{ roleLabel }}</div>
          </div>
          <el-button plain size="small" @click="userStore.logout">
            <el-icon><SwitchButton /></el-icon>
            退出
          </el-button>
        </div>
      </header>

      <section class="content-surface">
        <TaskCenter v-if="activeIndex === '1'" />
        <DeveloperCollab v-if="activeIndex === '2'" />
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
import DeveloperCollab from './components/DeveloperCollab.vue'
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
  1: { kicker: 'Multi-Agent Modeling', title: '智能建模工作台' },
  2: { kicker: 'Human in the loop', title: '人工审核与协同优化' },
  3: { kicker: 'Operations', title: '平台运营控制台' },
  4: { kicker: 'Identity', title: '用户与权限管理' }
}

const roleLabel = computed(() => roleMap[userStore.role] || userStore.role || '用户')
const currentSection = computed(() => sectionMap[activeIndex.value] || sectionMap[1])

watch(
  () => userStore.role,
  (newRole) => {
    if (newRole === 'ADMIN') {
      activeIndex.value = '3'
    } else if (newRole === 'DEVELOPER') {
      activeIndex.value = '1'
    } else {
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
  grid-template-columns: 252px minmax(0, 1fr);
  background:
    radial-gradient(circle at 20% 0%, rgba(15, 118, 110, 0.08), transparent 28%),
    var(--zs-bg);
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 22px 16px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--zs-border);
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(22px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 22px;
}

.brand-mark,
.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--zs-text);
  border: 1px solid var(--zs-border);
  background: var(--zs-surface);
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: 10px;
}

.brand-name {
  color: var(--zs-text);
  font-size: 15px;
  font-weight: 700;
}

.brand-sub {
  margin-top: 2px;
  color: var(--zs-muted);
  font-size: 12px;
}

.app-menu {
  flex: 1;
  border-right: 0 !important;
  background: transparent !important;
}

.app-menu :deep(.el-menu-item) {
  height: 42px;
  margin: 4px 0;
  border-radius: 8px;
  color: var(--zs-muted);
  font-weight: 560;
}

.app-menu :deep(.el-menu-item.is-active) {
  color: var(--zs-text);
  background: var(--zs-surface);
  box-shadow: 0 1px 0 var(--zs-border);
}

.sidebar-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--zs-border);
  border-radius: var(--zs-radius);
  background: var(--zs-surface-soft);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--zs-accent);
  box-shadow: 0 0 0 4px var(--zs-accent-weak);
}

.foot-title {
  color: var(--zs-text);
  font-size: 12px;
  font-weight: 650;
}

.foot-text {
  margin-top: 2px;
  color: var(--zs-muted);
  font-size: 12px;
}

.app-main {
  min-width: 0;
  padding: 22px;
}

.app-header {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.header-kicker {
  color: var(--zs-muted);
  font-size: 13px;
  font-weight: 650;
}

.app-header h1 {
  margin: 5px 0 0;
  color: var(--zs-text);
  font-size: 24px;
  font-weight: 680;
  line-height: 1.2;
}

.user-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px;
  border: 1px solid var(--zs-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
}

.user-meta {
  min-width: 96px;
}

.user-name {
  color: var(--zs-text);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.2;
}

.user-role {
  margin-top: 2px;
  color: var(--zs-muted);
  font-size: 12px;
}

.content-surface {
  min-height: calc(100vh - 110px);
}

@media (max-width: 920px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .app-sidebar {
    position: relative;
    height: auto;
    padding: 14px;
  }

  .brand {
    padding-bottom: 10px;
  }

  .app-menu {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .app-menu :deep(.el-menu-item) {
    margin: 0;
  }

  .sidebar-foot {
    display: none;
  }

  .app-main {
    padding: 14px;
  }
}

@media (max-width: 640px) {
  .app-header,
  .user-strip {
    align-items: flex-start;
    flex-direction: column;
    border-radius: var(--zs-radius);
  }

  .user-strip {
    width: 100%;
  }

  .app-menu {
    grid-template-columns: 1fr;
  }
}
</style>
