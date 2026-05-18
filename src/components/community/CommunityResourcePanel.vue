<template>
  <div class="community-resource-page">
    <el-card class="resource-toolbar" shadow="never">
      <div class="resource-title-row">
        <h2 class="resource-title">{{ pageTitle }}</h2>
        <p class="resource-subtitle">{{ pageSubtitle }}</p>
      </div>

      <div class="toolbar-row">
        <el-input
          v-model="searchKeyword"
          clearable
          class="search-input"
          placeholder="搜索标题或简介关键词"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" :loading="loading" @click="handleSearch">搜索</el-button>
        <el-button @click="resetAll">重置</el-button>
      </div>

      <div class="toolbar-row filters-row">
        <el-input v-model="filters.category" clearable placeholder="分类" style="width: 170px;" />
        <el-input v-model="filters.tag" clearable placeholder="标签" style="width: 170px;" />
        <el-input v-model="filters.creator" clearable placeholder="创建者" style="width: 170px;" />
        <el-select v-model="filters.sortBy" placeholder="排序" style="width: 180px;">
          <el-option label="最新发布" value="created_at" />
          <el-option label="热度优先" value="heat" />
          <el-option label="推荐优先" value="recommended" />
        </el-select>
      </div>

      <el-alert
        v-if="showLocalFilterHint"
        type="info"
        :closable="false"
        title="部分筛选条件为前端本地过滤（对应接口未提供同名查询参数）。"
      />
    </el-card>

    <el-alert v-if="errorMessage" type="error" :closable="false" :title="errorMessage" class="state-block" />

    <div v-loading="loading" class="cards-shell state-block">
      <template v-if="pagedCards.length">
        <article v-for="item in pagedCards" :key="`${item.type}-${item.id}`" class="community-card">
          <div class="card-head">
            <div class="card-title-wrap">
              <h3 class="card-title">{{ item.title || '未命名内容' }}</h3>
              <el-tag size="small">{{ resolveTypeLabel(item.type) }}</el-tag>
            </div>
            <el-tag type="success">已通过</el-tag>
          </div>

          <p class="card-desc">{{ item.description || '暂无简介' }}</p>

          <div class="card-meta">
            <span>创建者：{{ item.creator || '-' }}</span>
            <span>发布时间：{{ formatTime(item.createdAt) }}</span>
            <span>分类：{{ item.category || '-' }}</span>
          </div>

          <div class="card-tags" v-if="item.tags.length">
            <el-tag v-for="tag in item.tags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
          </div>

          <div class="card-stats">
            <span v-if="item.viewCount !== null">浏览 {{ item.viewCount }}</span>
            <span v-if="item.useCount !== null">使用 {{ item.useCount }}</span>
            <span v-if="item.favoriteCount !== null">收藏 {{ item.favoriteCount }}</span>
          </div>

          <div class="card-actions">
            <el-button type="primary" @click="goDetail(item)">查看详情</el-button>
          </div>
        </article>
      </template>

      <el-empty v-else-if="!loading" description="暂无社区内容" />
    </div>

    <div class="pagination-row" v-if="pagination.total > 0">
      <el-pagination
        background
        layout="prev, pager, next, jumper, total"
        :total="pagination.total"
        :page-size="pagination.pageSize"
        :current-page="pagination.page"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchCommunityResources } from '../../api/community'
import { fetchPublicDatasets } from '../../api/dataset'
import { fetchPublicModels } from '../../api/model'
import { fetchWorkflowList } from '../../api/workflow'

const props = defineProps({
  resourceType: {
    type: String,
    required: true
  }
})

const router = useRouter()

const normalizeTypeValue = (value) => {
  const raw = String(value || '').trim().toUpperCase()
  if (raw === 'MODEL') return 'MODEL'
  if (raw === 'WORKFLOW') return 'WORKFLOW'
  return 'DATASET'
}

const activeType = computed(() => normalizeTypeValue(props.resourceType))

const searchKeyword = ref('')
const appliedSearch = ref('')
const loading = ref(false)
const errorMessage = ref('')
const cards = ref([])

const filters = reactive({
  category: '',
  tag: '',
  creator: '',
  sortBy: 'created_at'
})

const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0
})

const pageTitle = computed(() => {
  if (activeType.value === 'MODEL') return '模型社区'
  if (activeType.value === 'WORKFLOW') return '工作流社区'
  return '数据集社区'
})

const pageSubtitle = computed(() => {
  if (activeType.value === 'MODEL') return '展示已通过审核并公开的模型资源。'
  if (activeType.value === 'WORKFLOW') return '展示已通过审核并可见的工作流资源。'
  return '展示已通过审核并公开的数据集资源。'
})

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

const normalizeCount = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isNaN(numeric) ? null : numeric
}

const normalizeCreator = (item) => {
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

const mapDatasetCard = (item) => ({
  id: item?.id,
  type: 'DATASET',
  title: item?.name || item?.title || '未命名数据集',
  description: item?.description || '',
  creator: normalizeCreator(item),
  createdAt: item?.created_at || item?.create_time || '',
  status: normalizeStatus(item?.status ?? item?.audit_status),
  category: item?.category || '',
  tags: parseTags(item?.tags),
  viewCount: normalizeCount(item?.view_count),
  useCount: normalizeCount(item?.use_count ?? item?.usage_count),
  favoriteCount: normalizeCount(item?.favorite_count ?? item?.collect_count)
})

const mapModelCard = (item) => ({
  id: item?.id,
  type: 'MODEL',
  title: item?.name || item?.title || '未命名模型',
  description: item?.description || '',
  creator: normalizeCreator(item),
  createdAt: item?.created_at || item?.create_time || '',
  status: normalizeStatus(item?.status ?? item?.audit_status),
  category: item?.category || '',
  tags: parseTags(item?.tags),
  viewCount: normalizeCount(item?.view_count),
  useCount: normalizeCount(item?.use_count ?? item?.usage_count),
  favoriteCount: normalizeCount(item?.favorite_count ?? item?.collect_count)
})

const mapWorkflowCard = (item) => ({
  id: item?.id ?? item?.workflow_id,
  type: 'WORKFLOW',
  title: item?.title || item?.name || '未命名工作流',
  description: item?.description || '',
  creator: normalizeCreator(item),
  createdAt: item?.created_at || item?.create_time || '',
  status: normalizeStatus(item?.audit_status ?? item?.status),
  category: item?.category || '',
  tags: parseTags(item?.tags),
  viewCount: normalizeCount(item?.view_count),
  useCount: normalizeCount(item?.fork_count ?? item?.run_count ?? item?.use_count),
  favoriteCount: normalizeCount(item?.favorite_count ?? item?.collect_count)
})

const matchesLocalFilters = (item) => {
  const keyword = appliedSearch.value.trim().toLowerCase()
  if (keyword) {
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase()
    if (!text.includes(keyword)) return false
  }

  if (filters.category.trim()) {
    const categoryKeyword = filters.category.trim().toLowerCase()
    if (!String(item.category || '').toLowerCase().includes(categoryKeyword)) return false
  }

  if (filters.tag.trim()) {
    const tagKeyword = filters.tag.trim().toLowerCase()
    if (!item.tags.some((tag) => tag.toLowerCase().includes(tagKeyword))) return false
  }

  if (filters.creator.trim()) {
    const creatorKeyword = filters.creator.trim().toLowerCase()
    if (!String(item.creator || '').toLowerCase().includes(creatorKeyword)) return false
  }

  return true
}

const sortCards = (list) => {
  const sorted = [...list]
  if (filters.sortBy === 'heat') {
    return sorted.sort((a, b) => {
      const aHeat = Number(a.viewCount || 0) + Number(a.useCount || 0)
      const bHeat = Number(b.viewCount || 0) + Number(b.useCount || 0)
      return bHeat - aHeat
    })
  }

  if (filters.sortBy === 'recommended') {
    return sorted.sort((a, b) => Number(b.favoriteCount || 0) - Number(a.favoriteCount || 0))
  }

  return sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
}

const pagedCards = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return cards.value.slice(start, end)
})

const showLocalFilterHint = computed(() => {
  return Boolean(filters.tag || filters.creator || appliedSearch.value)
})

const resolveTypeLabel = (type) => {
  if (type === 'MODEL') return '模型'
  if (type === 'WORKFLOW') return '工作流'
  return '数据集'
}

const formatTime = (value) => {
  if (!value) return '-'
  const text = String(value).replace('T', ' ')
  return text.length > 19 ? text.slice(0, 19) : text
}

const loadDatasets = async () => {
  const list = await fetchPublicDatasets({
    category: filters.category.trim() || undefined
  })
  const normalized = (Array.isArray(list) ? list : [])
    .map(mapDatasetCard)
    .filter((item) => item.id !== undefined && item.id !== null)
    .filter((item) => item.status === 'APPROVED')
  const filtered = sortCards(normalized.filter(matchesLocalFilters))
  cards.value = filtered
  pagination.total = filtered.length
}

const loadModels = async () => {
  const list = await fetchPublicModels({
    category: filters.category.trim() || undefined
  })
  const normalized = (Array.isArray(list) ? list : [])
    .map(mapModelCard)
    .filter((item) => item.id !== undefined && item.id !== null)
    .filter((item) => item.status === 'APPROVED')
  const filtered = sortCards(normalized.filter(matchesLocalFilters))
  cards.value = filtered
  pagination.total = filtered.length
}

const loadWorkflows = async () => {
  try {
    const result = await fetchWorkflowList({
      page: 1,
      page_size: 100,
      category: filters.category.trim() || undefined,
      status: '1',
      scope: 'visible'
    })

    const list = Array.isArray(result?.items) ? result.items : []
    const normalized = list
      .map(mapWorkflowCard)
      .filter((item) => item.id !== undefined && item.id !== null)
      .filter((item) => item.status === 'APPROVED')
    const filtered = sortCards(normalized.filter(matchesLocalFilters))
    cards.value = filtered
    pagination.total = filtered.length
  } catch (error) {
    if (![401, 403].includes(Number(error?.status || 0))) {
      throw error
    }

    const fallback = await fetchCommunityResources({
      type: 'WORKFLOW',
      page: 1,
      page_size: 100,
      category: filters.category.trim() || undefined,
      search: appliedSearch.value || undefined,
      sort_by: filters.sortBy || undefined
    })
    const fallbackList = Array.isArray(fallback?.items) ? fallback.items : []
    const normalized = fallbackList
      .map(mapWorkflowCard)
      .filter((item) => item.id !== undefined && item.id !== null)
      .filter((item) => item.status === 'APPROVED')
    const filtered = sortCards(normalized.filter(matchesLocalFilters))
    cards.value = filtered
    pagination.total = filtered.length
  }
}

const loadList = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    if (activeType.value === 'DATASET') {
      await loadDatasets()
    } else if (activeType.value === 'MODEL') {
      await loadModels()
    } else {
      await loadWorkflows()
    }
  } catch (error) {
    cards.value = []
    pagination.total = 0
    errorMessage.value = error.message || '加载社区内容失败'
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  appliedSearch.value = searchKeyword.value.trim()
  pagination.page = 1
  await loadList()
}

const resetAll = async () => {
  searchKeyword.value = ''
  appliedSearch.value = ''
  filters.category = ''
  filters.tag = ''
  filters.creator = ''
  filters.sortBy = 'created_at'
  pagination.page = 1
  await loadList()
}

const handlePageChange = (page) => {
  pagination.page = page
}

const goDetail = (item) => {
  router.push(`/community/${String(item.type || '').toLowerCase()}/${item.id}`)
}

watch(
  () => props.resourceType,
  async () => {
    pagination.page = 1
    await loadList()
  },
  { immediate: true }
)

watch(
  () => [filters.category, filters.sortBy],
  async () => {
    pagination.page = 1
    await loadList()
  }
)
</script>

<style scoped>
.community-resource-page {
  width: 100%;
}

.resource-toolbar {
  margin-bottom: 16px;
}

.resource-title-row {
  margin-bottom: 10px;
}

.resource-title {
  margin: 0;
  font-size: 18px;
  color: var(--zs-text);
}

.resource-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--zs-muted);
}

.toolbar-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-row + .toolbar-row {
  margin-top: 12px;
}

.search-input {
  width: min(520px, 100%);
}

.filters-row {
  align-items: flex-end;
}

.state-block {
  margin-top: 12px;
}

.cards-shell {
  min-height: 280px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.community-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--zs-border);
  background: linear-gradient(160deg, var(--zs-panel), var(--zs-panel-soft));
  display: grid;
  gap: 10px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  color: var(--zs-text);
  line-height: 1.5;
  word-break: break-word;
}

.card-desc {
  margin: 0;
  color: var(--zs-muted);
  font-size: 13px;
  line-height: 1.65;
  min-height: 42px;
}

.card-meta {
  display: grid;
  gap: 5px;
  color: var(--zs-muted);
  font-size: 12px;
}

.card-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.card-stats {
  display: flex;
  gap: 12px;
  color: var(--zs-subtle);
  font-size: 12px;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
}

.pagination-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .cards-shell {
    grid-template-columns: 1fr;
  }
}
</style>
