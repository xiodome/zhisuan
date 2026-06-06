<template>
  <div class="community-page">
    <div class="zs-page-head">
      <div>
        <h1 class="zs-title">社区</h1>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="数据集" name="datasets" lazy>
        <div class="pane-actions" v-if="canPublish">
          <el-button type="primary" @click="goCreateDataset">发布数据集</el-button>
        </div>
        <CommunityDatasets />
      </el-tab-pane>

      <el-tab-pane label="模型" name="models" lazy>
        <div class="pane-actions" v-if="canPublish">
          <el-button type="primary" @click="goCreateModel">发布模型</el-button>
        </div>
        <CommunityModels />
      </el-tab-pane>

      <el-tab-pane label="工作流" name="workflows" lazy>
        <CommunityWorkflows />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../store/user'
import CommunityDatasets from './community/CommunityDatasets.vue'
import CommunityModels from './community/CommunityModels.vue'
import CommunityWorkflows from './community/CommunityWorkflows.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const activeTab = ref('datasets')
const canPublish = computed(() => ['DEVELOPER', 'ADMIN'].includes(String(userStore.role || '').toUpperCase()))

const resolveTabFromPath = (path) => {
  if (String(path || '').startsWith('/community/models')) return 'models'
  if (String(path || '').startsWith('/community/workflows')) return 'workflows'
  return 'datasets'
}

const handleTabChange = (name) => {
  const target = String(name || '')
  if (!target) return
  const nextPath = `/community/${target}`
  if (route.path !== nextPath) {
    router.push(nextPath)
  }
}

watch(
  () => route.path,
  (path) => {
    activeTab.value = resolveTabFromPath(path)
  },
  { immediate: true }
)

const goCreateDataset = () => {
  router.push('/community/datasets/create')
}

const goCreateModel = () => {
  router.push('/community/models/create')
}
</script>

<style scoped>
.community-page {
  width: 100%;
  height: 100%;
  padding: 26px 0 18px;
  overflow: auto;
}

.pane-actions {
  margin: 0 0 12px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-tabs__header) {
  margin-bottom: 16px;
}

@media (max-width: 900px) {
  .pane-actions {
    justify-content: flex-start;
  }
}
</style>
