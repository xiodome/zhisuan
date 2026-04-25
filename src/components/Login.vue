<template>
  <div class="login-container">
    <section class="login-copy">
      <div class="brand-row">
        <div class="brand-mark">
          <el-icon><Connection /></el-icon>
        </div>
        <span>智算 AI4ML</span>
      </div>
      <h1>把机器学习流程交给 Agent，把判断权留给人。</h1>
      <p>
        面向自然语言建模、人工审核、代码沉淀和工作流复用的低代码机器学习社区平台。
      </p>
      <div class="login-points">
        <div><el-icon><Compass /></el-icon><span>自然语言创建建模任务</span></div>
        <div><el-icon><DocumentChecked /></el-icon><span>关键节点人工确认</span></div>
        <div><el-icon><DataAnalysis /></el-icon><span>报告、代码与模型产物沉淀</span></div>
      </div>
    </section>

    <el-card class="login-card" shadow="never">
      <template #header>
        <div>
          <h2 class="title">进入工作台</h2>
          <p class="subtitle">使用你的课程平台账号继续。</p>
        </div>
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
  min-height: 100vh;
  display: flex;
  gap: 64px;
  justify-content: center;
  align-items: center;
  padding: 32px;
  background:
    radial-gradient(circle at 18% 18%, rgba(15, 118, 110, 0.09), transparent 32%),
    var(--zs-bg);
}

.login-copy {
  width: min(520px, 100%);
}

.brand-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--zs-text);
  font-weight: 700;
}

.brand-mark {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--zs-border);
  border-radius: 10px;
  background: var(--zs-surface);
}

.login-copy h1 {
  margin: 34px 0 0;
  color: var(--zs-text);
  font-size: 48px;
  font-weight: 680;
  line-height: 1.08;
  letter-spacing: 0;
}

.login-copy p {
  margin: 22px 0 0;
  color: var(--zs-muted);
  font-size: 16px;
  line-height: 1.8;
}

.login-points {
  display: grid;
  gap: 12px;
  margin-top: 34px;
}

.login-points div {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--zs-text);
  font-size: 14px;
}

.login-points .el-icon {
  color: var(--zs-accent);
}

.login-card {
  width: 420px;
  flex: 0 0 420px;
}

.title {
  margin: 0;
  color: var(--zs-text);
  font-size: 22px;
  font-weight: 680;
}

.subtitle {
  margin: 7px 0 0;
  color: var(--zs-muted);
  font-size: 13px;
}

.mt-20 { margin-top: 20px; }
.full-width { width: 100%; }

@media (max-width: 920px) {
  .login-container {
    align-items: stretch;
    flex-direction: column;
    gap: 28px;
  }

  .login-copy h1 {
    font-size: 34px;
  }

  .login-card {
    width: 100%;
    flex: none;
  }
}
</style>
