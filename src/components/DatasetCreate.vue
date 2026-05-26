<template>
  <div class="dataset-create-page">
    <div class="zs-page-head">
      <div>
        <p class="zs-eyebrow">Community Publish</p>
        <h1 class="zs-title">发布数据集</h1>
      </div>
      <el-button plain @click="router.push('/community')">返回社区</el-button>
    </div>

    <el-card shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="130px" class="create-form">
        <el-form-item label="数据集名称" prop="name">
          <el-input v-model="form.name" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="数据集简介" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="1000" show-word-limit />
        </el-form-item>

        <el-form-item label="分类">
          <el-input v-model="form.category" placeholder="可选" />
        </el-form-item>

        <el-form-item label="标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入后回车创建标签"
          />
        </el-form-item>

        <el-form-item label="资源来源" prop="sourceMode">
          <el-radio-group v-model="form.sourceMode">
            <el-radio-button label="upload">上传文件</el-radio-button>
            <el-radio-button label="existing">选择已有数据集</el-radio-button>
            <el-radio-button label="manual">手动填写文件地址</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.sourceMode === 'upload'" label="上传 CSV">
          <el-upload
            drag
            :show-file-list="false"
            :http-request="handleUpload"
            accept=".csv,text/csv"
            :disabled="uploading"
          >
            <el-icon size="30"><Upload /></el-icon>
            <div>将 CSV 文件拖到这里，或点击上传</div>
          </el-upload>
          <div class="source-preview" v-if="uploadResultText">{{ uploadResultText }}</div>
        </el-form-item>

        <el-form-item v-if="form.sourceMode === 'existing'" label="已有数据集" prop="selectedExistingId">
          <el-select v-model="form.selectedExistingId" filterable placeholder="选择我的已发布数据集" @change="syncFromExisting">
            <el-option v-for="item in myDatasets" :key="item.id" :label="`${item.name} (#${item.id})`" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="form.sourceMode === 'manual'" label="文件地址">
          <el-input v-model="form.file_url" placeholder="例如：https://example.com/data.csv" />
        </el-form-item>

        <el-form-item label="文件 URL">
          <el-input v-model="form.file_url" placeholder="可选" />
        </el-form-item>

        <el-form-item label="文件大小">
          <el-input-number v-model="form.file_size" :min="0" controls-position="right" />
        </el-form-item>

        <el-form-item label="样本行数">
          <el-input-number v-model="form.row_count" :min="0" controls-position="right" />
        </el-form-item>

        <el-form-item label="分享到社区">
          <el-switch v-model="form.is_public" inline-prompt active-text="是" inactive-text="否" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="submit">提交发布</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { uploadAgentDataset } from '../api/agent'
import { createDataset, fetchMyDatasets } from '../api/dataset'

const router = useRouter()
const formRef = ref()
const submitting = ref(false)
const uploading = ref(false)
const myDatasets = ref([])

const form = reactive({
  name: '',
  description: '',
  category: '',
  tags: [],
  sourceMode: 'upload',
  selectedExistingId: null,
  file_url: '',
  file_size: null,
  row_count: null,
  is_public: true,
  remark: ''
})

const rules = {
  name: [{ required: true, message: '请输入数据集名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入数据集简介', trigger: 'blur' }],
  sourceMode: [{ required: true, message: '请选择资源来源', trigger: 'change' }],
  selectedExistingId: [
    {
      validator: (_, value, callback) => {
        if (form.sourceMode !== 'existing') {
          callback()
          return
        }
        if (!value) {
          callback(new Error('请选择已有数据集'))
          return
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}

const uploadResultText = computed(() => {
  const parts = []
  if (form.file_url) parts.push(`file_url: ${form.file_url}`)
  if (form.file_size !== null && form.file_size !== undefined) parts.push(`file_size: ${form.file_size}`)
  if (form.row_count !== null && form.row_count !== undefined) parts.push(`row_count: ${form.row_count}`)
  return parts.join(' | ')
})

const readFirst = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

const handleUpload = async ({ file }) => {
  uploading.value = true
  try {
    const result = await uploadAgentDataset(file)
    form.file_url = String(readFirst(result, ['file_url', 'url', 'dataset_url']) || form.file_url || '')
    const fileSize = readFirst(result, ['file_size', 'size'])
    const rowCount = readFirst(result, ['row_count', 'rows', 'record_count'])
    form.file_size = fileSize !== null ? Number(fileSize) : form.file_size
    form.row_count = rowCount !== null ? Number(rowCount) : form.row_count
    if (!form.name.trim()) {
      form.name = String(file?.name || '').replace(/\.csv$/i, '')
    }
    ElMessage.success('上传成功，已尝试自动回填 file_url/file_size/row_count')
  } catch (error) {
    ElMessage.error(error.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const syncFromExisting = (id) => {
  const selected = myDatasets.value.find((item) => item.id === id)
  if (!selected) return

  if (!form.name.trim()) form.name = selected.name || ''
  if (!form.description.trim()) form.description = selected.description || ''

  form.category = selected.category || form.category
  form.tags = String(selected.tags || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  form.file_url = selected.file_url || form.file_url
  form.file_size = selected.file_size ?? form.file_size
  form.row_count = selected.row_count ?? form.row_count
}

const submit = async () => {
  await formRef.value?.validate()

  submitting.value = true
  try {
    const result = await createDataset({
      name: form.name,
      description: form.description,
      category: form.category || null,
      tags: form.tags,
      is_public: form.is_public,
      file_url: form.file_url || null,
      file_size: form.file_size,
      row_count: form.row_count
    })

    ElMessage.success('数据集发布成功')
    const targetId = result?.id || result?.dataset_id || result?.data?.id
    if (targetId) {
      router.push(`/community/dataset/${targetId}`)
      return
    }
    router.push('/community')
  } catch (error) {
    ElMessage.error(error.message || '数据集发布失败')
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.category = ''
  form.tags = []
  form.sourceMode = 'upload'
  form.selectedExistingId = null
  form.file_url = ''
  form.file_size = null
  form.row_count = null
  form.is_public = true
  form.remark = ''
}

const loadMyDatasets = async () => {
  try {
    myDatasets.value = await fetchMyDatasets()
  } catch (error) {
    myDatasets.value = []
  }
}

onMounted(() => {
  loadMyDatasets()
})
</script>

<style scoped>
.dataset-create-page {
  width: 100%;
  height: 100%;
  padding: 26px 0 20px;
  overflow: auto;
}

.create-form {
  max-width: 860px;
}

.upload-tip {
  margin-top: 6px;
  color: var(--zs-muted);
  font-size: 12px;
}

.source-preview {
  margin-top: 8px;
  color: var(--zs-muted);
  font-size: 12px;
  line-height: 1.6;
}
</style>
