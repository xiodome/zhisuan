<template>
  <div class="login-container">
    <el-card class="login-card" shadow="always">
      <template #header>
        <h2 class="title">智算 AI4ML 社区</h2>
      </template>

      <el-tabs v-model="activeTab" stretch>
        <el-tab-pane label="账号登录" name="login">
          <el-form :model="loginForm" label-position="top" class="mt-20">
            <el-form-item label="账号">
              <el-input v-model="loginForm.username" placeholder="请输入账号" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="loginForm.password" type="password" show-password @keyup.enter="handleLogin" />
            </el-form-item>
            <el-button type="primary" class="full-width" :loading="loading" @click="handleLogin">立即登录</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="新用户注册" name="register">
          <el-form :model="regForm" label-position="top" class="mt-20">
            <el-form-item label="设置账号">
              <el-input v-model="regForm.username" placeholder="建议使用字母或数字" />
            </el-form-item>
            <el-form-item label="设置密码">
              <el-input v-model="regForm.password" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="regForm.rePassword" type="password" show-password />
            </el-form-item>
            <el-button type="success" class="full-width" :loading="loading" @click="handleRegister">提交注册</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { loginApi, registerApi } from '../api/auth'
import { useUserStore } from '../store/user'

const userStore = useUserStore()
const activeTab = ref('login')
const loading = ref(false)

// 表单数据
const loginForm = ref({ username: '', password: '' })
const regForm = ref({ username: '', password: '', rePassword: '' })

// 登录逻辑
const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    return ElMessage.warning('请填写完整登录信息')
  }
  loading.value = true
  try {
    const res = await loginApi(loginForm.value.username, loginForm.value.password)
    userStore.setInfo(res)
    ElMessage.success(`欢迎回来，${res.name}`)
    // 【修改点】：直接删除了 router.push('/')，因为外部的 App.vue 会自动通过 v-if 切换页面
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    loading.value = false
  }
}

// 注册逻辑
const handleRegister = async () => {
  const { username, password, rePassword } = regForm.value
  if (!username || !password) return ElMessage.warning('请填写必填项')
  if (password !== rePassword) return ElMessage.error('两次输入的密码不一致')
  
  loading.value = true
  try {
    await registerApi({ username, password })
    ElMessage.success('注册成功！请直接登录系统')
    
    loginForm.value.username = username
    loginForm.value.password = password
    activeTab.value = 'login' 
    
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #2d3a4b;
}
.login-card {
  width: 420px;
  border-radius: 12px;
}
.title {
  text-align: center;
  margin: 0;
  color: #409EFF;
}
.mt-20 { margin-top: 20px; }
.full-width { width: 100%; }
</style>