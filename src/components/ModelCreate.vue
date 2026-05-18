<template>
  <div class="model-create-page">
    <div class="zs-page-head">
      <div>
        <p class="zs-eyebrow">Community Publish</p>
        <h1 class="zs-title">发布模型</h1>
        <p class="zs-subtitle">字段完全对齐 Swagger `ModelCreate`，不支持的字段已做 TODO 标注并前端降级。</p>
      </div>
      <el-button plain @click="router.push('/community')">返回社区</el-button>
    </div>

    <el-card shadow="never">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="130px" class="create-form">
        <el-form-item label="模型名称" prop="name">
          <el-input v-model="form.name" maxlength="100" show-word-limit />
        </el-form-item>

        <el-form-item label="模型简介" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="1000" show-word-limit />
        </el-form-item>

        <el-form-item label="模型类型">
          <el-input v-model="form.model_type" placeholder="TODO: Swagger ModelCreate 无 model_type 字段，仅本地展示" />
        </el-form-item>

        <el-form-item label="适用场景">
          <el-input v-model="form.applicable_scenario" placeholder="TODO: Swagger ModelCreate 无适用场景字段，仅本地展示" />
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
            <el-radio-button label="upload">上传模型文件</el-radio-button>
            <el-radio-button label="existing">选择已有模型</el-radio-button>
            <el-radio-button label="manual">手动填写资源地址</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="form.sourceMode === 'upload'" label="上传模型文件">
          <el-upload drag :show-file-list="false" disabled>
            <el-icon size="30"><Upload /></el-icon>
            <div>TODO: Swagger 当前缺少模型文件上传接口，暂不可直接上传</div>
          </el-upload>
        </el-form-item>

        <el-form-item v-if="form.sourceMode === 'existing'" label="已有模型" prop="selectedExistingId">
          <el-select v-model="form.selectedExistingId" filterable placeholder="选择我的已发布模型" @change="syncFromExisting">
            <el-option v-for="item in myModels" :key="item.id" :label="`${item.name} (#${item.id})`" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="模型资源地址 (resource_url)">
          <el-input v-model="form.resource_url" placeholder="例如：https://example.com/model.onnx" />
        </el-form-item>

        <el-form-item label="分享到社区">
          <el-switch v-model="form.is_public" inline-prompt active-text="是" inactive-text="否" />
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            placeholder="TODO: Swagger ModelCreate 无 remark 字段，此备注仅前端展示不提交"
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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { createModel, fetchMyModels } from '../api/model'

const router = useRouter()
const formRef = ref()
const submitting = ref(false)
const myModels = ref([])

const form = reactive({
  name: '',
  description: '',
  model_type: '',
  applicable_scenario: '',
  category: '',
  tags: [],
  sourceMode: 'manual',
  selectedExistingId: null,
  resource_url: '',
  is_public: true,
  remark: ''
})

const rules = {
  name: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入模型简介', trigger: 'blur' }],
  sourceMode: [{ required: true, message: '请选择资源来源', trigger: 'change' }],
  selectedExistingId: [
    {
      validator: (_, value, callback) => {
        if (form.sourceMode !== 'existing') {
          callback()
          return
        }
        if (!value) {
          callback(new Error('请选择已有模型'))
          return
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}

const syncFromExisting = (id) => {
  const selected = myModels.value.find((item) => item.id === id)
  if (!selected) return

  if (!form.name.trim()) form.name = selected.name || ''
  if (!form.description.trim()) form.description = selected.description || ''

  form.category = selected.category || form.category
  form.tags = String(selected.tags || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  form.resource_url = selected.resource_url || form.resource_url
}

const submit = async () => {
  await formRef.value?.validate()

  submitting.value = true
  try {
    const result = await createModel({
      name: form.name,
      description: form.description,
      category: form.category || null,
      tags: form.tags,
      is_public: form.is_public,
      resource_url: form.resource_url || null
    })

    ElMessage.success('模型发布成功')
    const targetId = result?.id || result?.model_id || result?.data?.id
    if (targetId) {
      router.push(`/community/model/${targetId}`)
      return
    }
    router.push('/community')
  } catch (error) {
    ElMessage.error(error.message || '模型发布失败')
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  form.name = ''
  form.description = ''
  form.model_type = ''
  form.applicable_scenario = ''
  form.category = ''
  form.tags = []
  form.sourceMode = 'manual'
  form.selectedExistingId = null
  form.resource_url = ''
  form.is_public = true
  form.remark = ''
}

const loadMyModels = async () => {
  try {
    myModels.value = await fetchMyModels()
  } catch (error) {
    myModels.value = []
  }
}

onMounted(() => {
  loadMyModels()
})
</script>

<style scoped>
.model-create-page {
  width: 100%;
  height: 100%;
  padding: 26px 0 20px;
  overflow: auto;
}

.create-form {
  max-width: 860px;
}
</style>
