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
        <el-input v-model="filters.category" clearable placeholder="分类 (可输入中英文)" style="width: 170px;" />
        <el-input v-model="filters.tag" clearable placeholder="标签" style="width: 170px;" />
        <el-select v-model="filters.sortBy" placeholder="排序" style="width: 180px;">
          <el-option label="最新发布" value="created_at" />
          <el-option label="热度优先" value="heat" />
          <el-option label="推荐优先" value="recommended" />
        </el-select>
      </div>
    </el-card>

    <el-alert v-if="errorMessage" type="error" :closable="false" :title="errorMessage" class="state-block" />

    <div v-loading="loading" class="cards-shell state-block">
      <template v-if="Array.isArray(cards) && cards.length > 0">
        <article v-for="item in cards" :key="`${item.type}-${item.id}`" class="community-card">
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

      <el-empty v-else-if="!loading" description="暂无符合条件的社区内容" />
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
  sortBy: 'created_at'
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

const pageTitle = computed(() => {
  if (activeType.value === 'MODEL') return '模型社区'
  if (activeType.value === 'WORKFLOW') return '工作流社区'
  return '数据集社区'
})

const pageSubtitle = computed(() => {
  if (activeType.value === 'MODEL') return '展示已通过审核并公开的模型资源。'
  if (activeType.value === 'WORKFLOW') return '展示已通过审核并公开的工作流资源。'
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

const normalizeCount = (value) => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isNaN(numeric) ? null : numeric
}

const mapCardData = (item) => ({
  id: item?.id,
  type: activeType.value,
  title: item?.name || item?.title || '未命名内容',
  description: item?.description || '',
  creator: item?.creator || item?.username || item?.owner_name || '-',
  createdAt: item?.created_at || item?.create_time || '',
  category: item?.category || '',
  tags: parseTags(item?.tags),
  viewCount: normalizeCount(item?.view_count),
  useCount: normalizeCount(item?.use_count ?? item?.fork_count ?? item?.usage_count),
  favoriteCount: normalizeCount(item?.favorite_count ?? item?.collect_count)
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

const loadList = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    // 1. 将筛选参数正式传递给后端
    const params = {
      type: activeType.value,
      page: pagination.page,
      page_size: pagination.pageSize,
      search: appliedSearch.value || undefined,
      category: filters.category.trim() || undefined,
      sort_by: filters.sortBy || undefined
    }

    const result = await fetchCommunityResources(params)

    const rawItems = result?.items || result?.list || result?.data?.items || []
    let dataList = Array.isArray(rawItems) ? rawItems.map(mapCardData) : []

    // 2. 核心：前端本地兜底容错过滤
    // 如果后端没实现筛选，或者中英文没对齐，前端帮你二次保障能搜出来！
    if (filters.category.trim()) {
      const catKeyword = filters.category.trim().toLowerCase()
      dataList = dataList.filter(item => {
        const catStr = String(item.category || '').toLowerCase()
        // 容错魔法：如果用户输入中文“分类”，即使数据库存的是“classification”，也能帮你搜出来
        if (catKeyword === '分类' && catStr.includes('classification')) return true
        return catStr.includes(catKeyword)
      })
    }

    if (filters.tag.trim()) {
      const tagKeyword = filters.tag.trim().toLowerCase()
      dataList = dataList.filter(item => 
        item.tags.some(t => t.toLowerCase().includes(tagKeyword))
      )
    }

    cards.value = dataList

    // 3. 动态修正分页数
    if (filters.category.trim() || filters.tag.trim()) {
      pagination.total = dataList.length
    } else {
      pagination.total = Number(result?.total ?? result?.data?.total ?? dataList.length)
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
  filters.sortBy = 'created_at'
  pagination.page = 1
  await loadList()
}

const handlePageChange = (page) => {
  pagination.page = page
  loadList()
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

// 监听分类、标签和排序框的实时变化，自动触发查询
watch(
  () => [filters.category, filters.tag, filters.sortBy],
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