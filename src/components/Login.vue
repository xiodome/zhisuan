<template>
  <div class="login-page">
    <div class="platform-mark">智算 AI4ML Platform</div>

    <main class="login-main">
      <h1>登录 AI4ML Agent 平台</h1>
      <p>使用课程平台账号进入工作台，创建机器学习建模任务并沉淀可复用工作流。</p>

      <el-card class="login-card" shadow="never">
        <el-tabs v-model="activeTab" stretch>
          <el-tab-pane label="账号登录" name="login">
            <el-form :model="loginForm" label-position="top" class="auth-form">
              <el-form-item label="账号">
                <el-input v-model="loginForm.username" placeholder="Username" />
              </el-form-item>
              <el-form-item label="密码">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  show-password
                  placeholder="Password"
                  @keyup.enter="handleLogin"
                />
              </el-form-item>
              <el-button type="primary" class="full-width" :loading="loading" @click="handleLogin">
                继续
              </el-button>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="新用户注册" name="register">
            <el-form :model="regForm" label-position="top" class="auth-form">
              <el-form-item label="设置账号">
                <el-input v-model="regForm.username" placeholder="Username" />
              </el-form-item>
              <el-form-item label="设置密码">
                <el-input v-model="regForm.password" type="password" show-password placeholder="Password" />
              </el-form-item>
              <el-form-item label="确认密码">
                <el-input v-model="regForm.rePassword" type="password" show-password placeholder="Repeat password" />
              </el-form-item>
              <el-button type="primary" class="full-width" :loading="loading" @click="handleRegister">
                创建账号
              </el-button>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </main>
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

const loginForm = ref({ username: '', password: '' })
const regForm = ref({ username: '', password: '', rePassword: '' })

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    return ElMessage.warning('请填写完整登录信息')
  }
  loading.value = true
  try {
    const res = await loginApi(loginForm.value.username, loginForm.value.password)
    userStore.setInfo(res)
    ElMessage.success(`欢迎回来，${res.name}`)
  } catch (err) {
    ElMessage.error(err.message)
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  const { username, password, rePassword } = regForm.value
  if (!username || !password) return ElMessage.warning('请填写必填项')
  if (password !== rePassword) return ElMessage.error('两次输入的密码不一致')

  loading.value = true
  try {
    await registerApi({ username, password })
    ElMessage.success('注册成功，请登录')
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
.login-page {
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 72px 24px;
  background: #222a37;
  color: #f4f4f4;
  --zs-bg: #1a1f29;
  --zs-sidebar: #222a37;
  --zs-panel: #2b3546;
  --zs-panel-soft: #344157;
  --zs-elevated: #41506a;
  --zs-text: #f2f5fb;
  --zs-muted: #aab3c5;
  --zs-subtle: #828ca1;
  --zs-border: #4c5a73;
  --zs-border-strong: #647390;
  --zs-shadow: 0 20px 72px rgba(0, 0, 0, 0.28);
}

.platform-mark {
  position: absolute;
  top: 28px;
  left: 32px;
  color: #f4f4f4;
  font-size: 24px;
  font-weight: 780;
  letter-spacing: 0;
}

.login-main {
  width: min(620px, 100%);
  text-align: center;
}

.login-main h1 {
  max-width: 620px;
  margin: 0 auto;
  color: #f4f4f4;
  font-size: 42px;
  font-weight: 760;
  line-height: 1.12;
  letter-spacing: 0;
}

.login-main p {
  max-width: 560px;
  margin: 22px auto 44px;
  color: #b4b4b4;
  font-size: 18px;
  line-height: 1.65;
}

.login-card {
  width: min(430px, 100%);
  margin: 0 auto;
  border: 0 !important;
  background: transparent !important;
}

.auth-form {
  margin-top: 18px;
  text-align: left;
}

.full-width {
  width: 100%;
  height: 48px;
  margin-top: 8px;
}

@media (max-width: 720px) {
  .platform-mark {
    left: 20px;
    font-size: 20px;
  }

  .login-main h1 {
    font-size: 32px;
  }
}
</style>
