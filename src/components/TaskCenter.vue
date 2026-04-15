<template>
  <div>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="hover" style="height: 600px;">
          <template #header>
            <div style="font-weight: bold;">创建自然语言建模任务</div>
          </template>
          
          <el-form label-position="top">
            <el-form-item label="任务描述 (例如: 请帮我用这份数据建立预测模型)">
              <el-input 
                v-model="taskDesc" 
                type="textarea" 
                :rows="4" 
                placeholder="请输入您的建模需求..." 
              />
            </el-form-item>
            
            <el-form-item label="上传数据集 (仅支持 CSV)">
              <el-upload
                drag
                action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
                multiple
                style="width: 100%;"
              >
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text">
                  将文件拖到此处，或 <em>点击上传</em>
                </div>
              </el-upload>
            </el-form-item>
            
            <el-button type="primary" style="width: 100%; margin-top: 20px;" @click="startTask" :loading="isWorking">
              提交任务给智能体团队
            </el-button>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover" style="height: 600px;">
          <template #header>
            <div style="font-weight: bold;">智能体团队工作进度</div>
          </template>
          
          <div v-if="!isWorking && activeStep === 0" style="color: #999; text-align: center; margin-top: 100px;">
            等待任务提交...
          </div>

          <el-steps :active="activeStep" direction="vertical" style="height: 400px; margin-left: 20px;" v-else>
            <el-step title="Agent Manager" description="正在进行自然语言解析与任务拆解..." />
            <el-step title="Data Agent" description="正在进行数据质量分析和缺失值填补..." />
            <el-step title="Model Agent" description="正在挑选最适合的模型架构 (如 XGBoost)..." />
            <el-step title="Operation Agent" description="正在生成推理接口和可访问的 Web Demo..." />
            <el-step title="任务完成" description="模型分析报告已生成！" />
          </el-steps>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const taskDesc = ref('')
const isWorking = ref(false)
const activeStep = ref(0)

// 模拟假交互：让进度条动起来
const startTask = () => {
  if (!taskDesc.value) {
    alert('请先输入任务描述！')
    return
  }
  isWorking.value = true
  activeStep.value = 0
  
  // 每隔 1.5 秒走一步
  const timer = setInterval(() => {
    activeStep.value++
    if (activeStep.value >= 5) {
      clearInterval(timer)
      isWorking.value = false
    }
  }, 1500)
}
</script>