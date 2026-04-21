<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="8">
        <el-card shadow="hover">
          <div style="color: #999; font-size: 14px;">总计运行任务数</div>
          <div style="font-size: 28px; font-weight: bold; color: #409EFF; margin-top: 10px;">1,284</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div style="color: #999; font-size: 14px;">社区公开模型数</div>
          <div style="font-size: 28px; font-weight: bold; color: #67C23A; margin-top: 10px;">342</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div style="color: #999; font-size: 14px;">平台 API 消耗警告数</div>
          <div style="font-size: 28px; font-weight: bold; color: #F56C6C; margin-top: 10px;">3</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header>
        <div style="font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
          <span>用户 API 额度与角色管理</span>
          <el-button type="primary" size="small">新增用户</el-button>
        </div>
      </template>
      
      <el-table :data="tableData" style="width: 100%" border>
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="role" label="角色" width="150">
          <template #default="scope">
            <el-tag :type="scope.row.role === 'AI开发者' ? 'success' : 'info'">
              {{ scope.row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="apiUsed" label="API Token 消耗" />
        <el-table-column label="账号状态" width="120">
          <template #default="scope">
            <el-switch v-model="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default>
            <el-button size="small" type="primary" link>调整额度</el-button>
            <el-button size="small" type="danger" link>禁用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 模拟假数据
const tableData = ref([
  { username: '农学学生_李雷', role: '零基础用户', apiUsed: '45,000 / 100,000', status: true },
  { username: '算法大神_韩梅梅', role: 'AI开发者', apiUsed: '98,000 / 100,000 (警告)', status: true },
  { username: '医学院_张伟', role: '零基础用户', apiUsed: '12,000 / 100,000', status: false },
])
</script>