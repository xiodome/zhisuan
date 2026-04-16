<template>
  <div style="height: 100vh; display: flex; justify-content: center; align-items: center; background: #2d3a4b;">
    <el-card style="width: 400px; border-radius: 8px;" shadow="always">
      <template #header>
        <h2 style="text-align: center; margin: 0; color: #409EFF;">智算 AI4ML 社区</h2>
        <div style="text-align: center; color: #909399; font-size: 14px; margin-top: 5px;">请登录以继续</div>
      </template>
      <el-form :model="form" label-position="top">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="测试账号: admin / dev / user" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="统一密码: 123456" show-password @keyup.enter="doLogin" />
        </el-form-item>
        <el-button type="primary" style="width: 100%; margin-top: 10px;" @click="doLogin" :loading="loading">登录系统</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { loginApi } from '../api/auth'
import { useUserStore } from '../store/user'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const form = ref({ username: '', password: '123456' })
const loading = ref(false)

const doLogin = async () => {
  if (!form.value.username) {
    ElMessage.warning('请输入账号')
    return
  }
  loading.value = true
  try {
    const res = await loginApi(form.value.username, form.value.password)
    userStore.setInfo(res)
    ElMessage.success('欢迎回来，' + res.name)
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    loading.value = false
  }
}
</script>