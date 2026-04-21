<template>
  <div>
    <el-card shadow="hover">
      <template #header>
        <div style="font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
          <span>工作流干预与代码修改 (人机协同模式)</span>
          <el-button type="success" size="small">分享至社区</el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="demo-tabs">
        
        <el-tab-pane label="需求解析验证" name="req">
          <el-form label-width="120px" style="max-width: 600px; margin-top: 20px;">
            <el-form-item label="智能体识别任务">
              <el-radio-group v-model="taskType">
                <el-radio label="classification">分类任务 (Classification)</el-radio>
                <el-radio label="regression">回归任务 (Regression)</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="目标预测列">
              <el-input v-model="targetColumn" />
            </el-form-item>
            <el-button type="primary" style="margin-left: 120px;">保存修改并重新规划</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="特征工程验证" name="feature">
          <el-form label-width="120px" style="max-width: 600px; margin-top: 20px;">
            <el-form-item label="缺失值填充策略">
              <el-select v-model="fillStrategy" placeholder="请选择">
                <el-option label="均值填充 (Mean)" value="mean" />
                <el-option label="中位数填充 (Median)" value="median" />
                <el-option label="常数填充 (Constant)" value="constant" />
              </el-select>
            </el-form-item>
            <el-form-item label="类别特征编码">
              <el-select v-model="encodeStrategy" placeholder="请选择">
                <el-option label="独热编码 (One-Hot)" value="onehot" />
                <el-option label="标签编码 (Label)" value="label" />
              </el-select>
            </el-form-item>
            <el-button type="primary" style="margin-left: 120px;">应用特征工程策略</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="Python 源码审查" name="code">
          <div style="margin-bottom: 15px; color: #666; font-size: 14px;">
            Operation Agent 已生成以下代码，您可以直接修改或下载至本地运行。
          </div>
          <el-input
            v-model="pythonCode"
            type="textarea"
            :rows="15"
            style="font-family: monospace;"
            class="mock-editor"
          />
          <div style="margin-top: 15px;">
            <el-button type="primary">执行当前代码</el-button>
            <el-button>下载 .py 文件</el-button>
          </div>
        </el-tab-pane>

      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeTab = ref('code') // 默认打开源码审查页

// 表单绑定的模拟数据
const taskType = ref('classification')
const targetColumn = ref('target_price')
const fillStrategy = ref('mean')
const encodeStrategy = ref('onehot')

// 模拟自动生成的 Python 代码
const pythonCode = ref(`import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

# 1. Agent 自动加载数据
print("Loading data...")
df = pd.read_csv('user_uploaded_data.csv')

# 2. Agent 自动特征工程 (基于用户协同干预)
df.fillna(df.mean(), inplace=True)
df = pd.get_dummies(df)

# 3. 准备训练集
X = df.drop('target', axis=1)
y = df['target']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# 4. Agent 训练模型
print("Training Multi-Agent optimized model...")
model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

# 5. 输出评估报告
predictions = model.predict(X_test)
print(f"Model Accuracy: {accuracy_score(y_test, predictions)}")
`)
</script>

<style scoped>
/* 给假代码编辑器加点深色主题显得专业 */
:deep(.mock-editor .el-textarea__inner) {
  background-color: #1e1e1e;
  color: #d4d4d4;
  font-size: 14px;
  line-height: 1.5;
  border-radius: 4px;
}
</style>