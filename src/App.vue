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
        <el-popover placement="right" trigger="click" width="260">
          <template #reference>
            <button class="theme-button" title="主题设置">
              <el-icon><Brush /></el-icon>
            </button>
          </template>
          <div class="theme-panel">
            <div class="theme-panel-title">主题模式</div>
            <el-segmented v-model="themeMode" :options="themeOptions" block />
            <div class="theme-panel-title" v-if="themeMode === 'dark'">暗色暗度</div>
            <el-slider v-if="themeMode === 'dark'" v-model="darkTone" :min="0" :max="100" :step="1" show-input />
          </div>
        </el-popover>
      </div>

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
      <section class="content-surface">
        <TaskCenter v-if="activeIndex === '1'" />
        <AdminConsole v-if="activeIndex === '3'" />
        <AdminUserManagement v-if="activeIndex === '4'" />
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useUserStore } from './store/user'
import Login from './components/Login.vue'
import TaskCenter from './components/TaskCenter.vue'
import AdminConsole from './components/AdminConsole.vue'
import AdminUserManagement from './components/AdminUserManagement.vue'

const userStore = useUserStore()
const activeIndex = ref('1')
const themeOptions = [
  { label: '暗色', value: 'dark' },
  { label: '明亮', value: 'light' }
]
const themeMode = ref(localStorage.getItem('zs.theme.mode') || 'dark')
const darkTone = ref(Number(localStorage.getItem('zs.theme.darkTone') || '50'))

const roleMap = {
  ADMIN: '管理员',
  DEVELOPER: 'AI 开发者',
  ZERO_BASIS: '零基础用户'
}

const roleLabel = computed(() => roleMap[userStore.role] || userStore.role || '用户')

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value)))
const hexToRgb = (hex) => {
  const normalized = `${hex || ''}`.replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map((char) => `${char}${char}`).join('') : normalized
  const value = parseInt(full, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  }
}
const rgbToHex = ({ r, g, b }) => {
  const toHex = (channel) => Math.round(channel).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
const mixHex = (a, b, ratio) => {
  const safeRatio = Math.min(1, Math.max(0, ratio))
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return rgbToHex({
    r: x.r + (y.r - x.r) * safeRatio,
    g: x.g + (y.g - x.g) * safeRatio,
    b: x.b + (y.b - x.b) * safeRatio
  })
}

const applyTheme = () => {
  const root = document.documentElement
  const toneRatio = clamp(darkTone.value) / 100
  if (themeMode.value === 'light') {
    root.setAttribute('data-theme', 'light')
    root.style.setProperty('--zs-bg', '#eef1f5')
    root.style.setProperty('--zs-sidebar', '#ffffff')
    root.style.setProperty('--zs-panel', '#ffffff')
    root.style.setProperty('--zs-panel-soft', '#f4f6fb')
    root.style.setProperty('--zs-elevated', '#ebeff7')
    root.style.setProperty('--zs-text', '#1f2430')
    root.style.setProperty('--zs-muted', '#5f6778')
    root.style.setProperty('--zs-subtle', '#7f8798')
    root.style.setProperty('--zs-border', '#d7dce8')
    root.style.setProperty('--zs-border-strong', '#bcc4d6')
    root.style.setProperty('--zs-shadow', '0 18px 60px rgba(34, 42, 62, 0.12)')
    return
  }

  root.setAttribute('data-theme', 'dark')
  root.style.setProperty('--zs-bg', mixHex('#222a37', '#0f131b', toneRatio))
  root.style.setProperty('--zs-sidebar', mixHex('#2a3445', '#141b24', toneRatio))
  root.style.setProperty('--zs-panel', mixHex('#313c4f', '#1d2530', toneRatio))
  root.style.setProperty('--zs-panel-soft', mixHex('#394558', '#252f3d', toneRatio))
  root.style.setProperty('--zs-elevated', mixHex('#445167', '#303a49', toneRatio))
  root.style.setProperty('--zs-text', '#f2f5fb')
  root.style.setProperty('--zs-muted', mixHex('#b8bfd0', '#9fa8bb', toneRatio))
  root.style.setProperty('--zs-subtle', mixHex('#8f97ac', '#7b859a', toneRatio))
  root.style.setProperty('--zs-border', mixHex('#5d6a81', '#414d63', toneRatio))
  root.style.setProperty('--zs-border-strong', mixHex('#73819a', '#55627a', toneRatio))
  root.style.setProperty('--zs-shadow', '0 20px 72px rgba(0, 0, 0, 0.28)')
}

watch(
  () => userStore.role,
  (newRole) => {
    if (newRole !== 'ADMIN' && ['3', '4'].includes(activeIndex.value)) {
      activeIndex.value = '1'
    }
  },
  { immediate: true }
)

watch(
  [themeMode, darkTone],
  () => {
    darkTone.value = clamp(darkTone.value)
    localStorage.setItem('zs.theme.mode', themeMode.value)
    localStorage.setItem('zs.theme.darkTone', String(darkTone.value))
    applyTheme()
  },
  { immediate: true }
)

onMounted(() => {
  applyTheme()
})
</script>

<style scoped>
.app-shell {
  height: 100vh;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  background: var(--zs-bg);
  color: var(--zs-text);
  overflow: hidden;
}

.app-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 10px;
  border-right: 1px solid var(--zs-border);
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
  box-shadow: 18px 0 42px rgba(0, 0, 0, 0.2);
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
  background: var(--zs-panel-soft);
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
  color: var(--zs-text);
  font-size: 14px;
  font-weight: 760;
}

.brand-sub,
.identity-role {
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
  width: 54px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 2px 0;
  padding: 0 !important;
  border-radius: 16px;
  color: var(--zs-text);
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
  color: var(--zs-text);
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
  background: var(--zs-panel-soft);
  transform: translateY(-1px);
}

.app-menu :deep(.el-menu-item.is-active) {
  color: var(--zs-text);
  background: var(--zs-elevated);
}

.sidebar-section {
  padding: 0;
}

.theme-button {
  width: 54px;
  height: 54px;
  border: 0;
  border-radius: 12px;
  color: var(--zs-text);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.theme-button:hover {
  background: var(--zs-panel-soft);
  transform: translateY(-1px);
}

.theme-panel {
  display: grid;
  gap: 12px;
}

.theme-panel-title {
  color: var(--zs-text);
  font-size: 12px;
  font-weight: 660;
}

.identity-card {
  justify-content: flex-start;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 14px;
  background: var(--zs-panel-soft);
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.identity-card:hover {
  background: var(--zs-elevated);
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
  color: var(--zs-text);
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    transform 0.16s ease;
}

.logout-button:hover {
  background: var(--zs-panel-soft);
  transform: translateY(-1px);
}

.app-main {
  min-width: 0;
  min-height: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0 26px;
  overflow: hidden;
}

.content-surface {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

.content-surface > * {
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
