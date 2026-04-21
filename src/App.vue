<template>
  <Login v-if="!userStore.token" />

  <el-container v-else style="height: 100vh;">
    <el-aside width="200px" style="background-color: #304156;">
      <div style="color: white; text-align: center; padding: 20px; font-size: 18px; font-weight: bold;">
        智算 AI4ML 社区
      </div>
      <el-menu
        :default-active="activeIndex"
        active-text-color="#409EFF"
        background-color="#304156"
        text-color="#bfcbd9"
        @select="(idx) => activeIndex = idx"
      >
        <el-menu-item index="1">
          <el-icon><Menu /></el-icon>
          <span>零基础建模中心</span>
        </el-menu-item>
        
        <el-menu-item index="2" v-if="['ADMIN', 'DEVELOPER'].includes(userStore.role)">
          <el-icon><Edit /></el-icon>
          <span>AI 开发者协同</span>
        </el-menu-item>
        
        <el-menu-item index="3" v-if="userStore.role === 'ADMIN'">
          <el-icon><Setting /></el-icon>
          <span>管理员控制台</span>
        </el-menu-item>
        
        <el-menu-item index="4" v-if="userStore.role === 'ADMIN'">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header style="border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: flex-end; background-color: white;">
        <el-avatar size="small" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
        <span style="margin: 0 15px 0 10px; font-size: 14px;">
          {{ userStore.name }} ({{ userStore.role }})
        </span>
        <el-button type="danger" size="small" plain @click="userStore.logout">退出登录</el-button>
      </el-header>
      
      <el-main style="background-color: #f0f2f5;">
        <TaskCenter v-if="activeIndex === '1'" />
        <DeveloperCollab v-if="activeIndex === '2'" />
        <AdminConsole v-if="activeIndex === '3'" />
        <AdminUserManagement v-if="activeIndex === '4'" />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useUserStore } from './store/user'
import Login from './components/Login.vue'
import TaskCenter from './components/TaskCenter.vue'
import DeveloperCollab from './components/DeveloperCollab.vue'
import AdminConsole from './components/AdminConsole.vue'
import AdminUserManagement from './components/AdminUserManagement.vue'

const userStore = useUserStore()
const activeIndex = ref('1')

// 修改点：监听角色变化时的暗号全部更新为大写
watch(() => userStore.role, (newRole) => {
  if (newRole === 'ADMIN') {
    activeIndex.value = '4' // 管理员默认跳到“用户管理”
  } else if (newRole === 'DEVELOPER') {
    activeIndex.value = '2' // 开发者默认跳到“协同页”
  } else {
    activeIndex.value = '1' // 普通用户默认跳到“建模页”
  }
}, { immediate: true })
</script>

<style>
body { margin: 0; padding: 0; }
</style>