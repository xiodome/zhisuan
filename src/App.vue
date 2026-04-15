<template>
  <el-container style="height: 100vh;">
    <el-aside width="200px" style="background-color: #304156;">
      <div style="color: white; text-align: center; padding: 20px; font-size: 18px; font-weight: bold;">
        智算 AI4ML 社区
      </div>
      <el-menu
        :default-active="activeIndex"
        active-text-color="#409EFF"
        background-color="#304156"
        text-color="#bfcbd9"
        @select="handleMenuSelect"
      >
        <el-menu-item index="1">
          <el-icon><Menu /></el-icon>
          <span>零基础建模中心</span>
        </el-menu-item>
        <el-menu-item index="2">
          <el-icon><Edit /></el-icon>
          <span>AI 开发者协同</span>
        </el-menu-item>
        <el-menu-item index="3">
          <el-icon><Setting /></el-icon>
          <span>管理员控制台</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header style="border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: flex-end; background-color: white;">
        <el-avatar size="small" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
        <span style="margin-left: 10px; font-size: 14px;">管理员账号</span>
      </el-header>
      <el-main style="background-color: #f0f2f5;">
        
        <TaskCenter v-if="activeIndex === '1'" />
        
        <DeveloperCollab v-if="activeIndex === '2'" />

        <AdminConsole v-if="activeIndex === '3'" />

      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import TaskCenter from './components/TaskCenter.vue'
import AdminConsole from './components/AdminConsole.vue'
// 新增引入开发者组件
import DeveloperCollab from './components/DeveloperCollab.vue' 

const activeIndex = ref('1')

const handleMenuSelect = (index) => {
  activeIndex.value = index
}
</script>

<style>
body { margin: 0; padding: 0; }
</style>