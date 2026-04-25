<template>
  <div class="admin-console">
    <el-alert
      v-if="isUsingMockData"
      type="warning"
      :closable="false"
      show-icon
      class="mock-alert"
      title="当前为假数据模式，后端接口完成后要接上真实接口。"
    />

    <el-tabs v-model="activeTab">
      <el-tab-pane label="API 额度管理" name="quota">
        <el-row :gutter="16" class="summary-row">
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">管理用户数</div>
              <div class="summary-value text-primary">{{ quotaOverview.totalUsers }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">累计消耗 Token</div>
              <div class="summary-value text-success">{{ formatNumber(quotaOverview.totalConsumedTokens) }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">预警用户数</div>
              <div class="summary-value text-warning">{{ quotaOverview.warningUsers }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">额度不足用户</div>
              <div class="summary-value text-danger">{{ quotaOverview.insufficientUsers }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="hover" class="section-card">
          <template #header>
            <div class="header-row">
              <span class="section-title">用户额度配置与使用情况</span>
              <el-button size="small" @click="refreshQuotaSection">刷新</el-button>
            </div>
          </template>

          <el-form :inline="true" :model="quotaFilters" class="filter-form">
            <el-form-item label="用户名">
              <el-input
                v-model="quotaFilters.username"
                clearable
                placeholder="输入用户名"
                style="width: 200px;"
                @keyup.enter="handleQuotaSearch"
              />
            </el-form-item>
            <el-form-item label="角色">
              <el-select v-model="quotaFilters.role" placeholder="全部角色" style="width: 180px;">
                <el-option label="全部角色" value="" />
                <el-option
                  v-for="role in roleOptions"
                  :key="role.value"
                  :label="role.label"
                  :value="role.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="账号状态">
              <el-select v-model="quotaFilters.status" placeholder="全部状态" style="width: 160px;">
                <el-option label="全部状态" value="" />
                <el-option label="启用" value="enabled" />
                <el-option label="禁用" value="disabled" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="quotaLoading" @click="handleQuotaSearch">筛选</el-button>
              <el-button @click="resetQuotaFilters">重置</el-button>
            </el-form-item>
          </el-form>

          <el-alert
            v-if="insufficientQuotaUsers.length"
            type="error"
            :closable="false"
            show-icon
            class="insufficient-alert"
          >
            <template #title>
              检测到 {{ insufficientQuotaUsers.length }} 位用户额度不足，当前已标记为调用限制状态
            </template>
            <div class="alert-detail">{{ insufficientUserNames }}</div>
          </el-alert>

          <el-table
            :data="pagedQuotaUsers"
            border
            style="width: 100%"
            v-loading="quotaLoading"
            :row-class-name="resolveQuotaRowClass"
          >
            <el-table-column prop="username" label="用户名" min-width="150" />
            <el-table-column label="角色" width="140">
              <template #default="scope">
                <el-tag :type="resolveRoleTag(scope.row.role)" effect="light">
                  {{ resolveRoleLabel(scope.row.role) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="Token 额度" width="130">
              <template #default="scope">{{ formatNumber(scope.row.tokenQuota) }}</template>
            </el-table-column>
            <el-table-column label="已用 Token" width="130">
              <template #default="scope">{{ formatNumber(scope.row.tokenUsed) }}</template>
            </el-table-column>
            <el-table-column label="使用上限" width="130">
              <template #default="scope">{{ formatNumber(scope.row.usageLimit) }}</template>
            </el-table-column>
            <el-table-column label="预警阈值" width="110">
              <template #default="scope">{{ formatPercent(scope.row.warningThreshold) }}</template>
            </el-table-column>
            <el-table-column label="使用占比" min-width="200">
              <template #default="scope">
                <div class="progress-cell">
                  <el-progress
                    :percentage="Math.round(getQuotaUsageRate(scope.row) * 100)"
                    :color="resolveQuotaProgressColor(scope.row)"
                    :stroke-width="10"
                  />
                </div>
              </template>
            </el-table-column>
            <el-table-column label="额度状态" width="140">
              <template #default="scope">
                <el-tag :type="resolveQuotaStatusTag(scope.row)" effect="dark">
                  {{ resolveQuotaStatusLabel(scope.row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="updatedAt" label="最近调整" width="170" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="scope">
                <el-button type="primary" link @click="openQuotaDialog(scope.row)">调整额度</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrapper" v-if="quotaTotal > quotaPageSize">
            <el-pagination
              background
              layout="prev, pager, next, total"
              :total="quotaTotal"
              :page-size="quotaPageSize"
              :current-page="quotaPage"
              @current-change="(page) => (quotaPage = page)"
            />
          </div>
        </el-card>

        <el-card shadow="hover" class="section-card">
          <template #header>
            <div class="header-row">
              <span class="section-title">调用消耗记录</span>
              <el-button size="small" @click="loadConsumptionRecords">刷新</el-button>
            </div>
          </template>

          <el-form :inline="true" :model="consumptionFilters" class="filter-form">
            <el-form-item label="用户名">
              <el-input
                v-model="consumptionFilters.username"
                clearable
                placeholder="输入用户名"
                style="width: 220px;"
                @keyup.enter="loadConsumptionRecords"
              />
            </el-form-item>
            <el-form-item label="接口">
              <el-select v-model="consumptionFilters.endpoint" placeholder="全部接口" style="width: 220px;">
                <el-option label="全部接口" value="" />
                <el-option
                  v-for="item in endpointOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="consumptionLoading" @click="loadConsumptionRecords">
                筛选
              </el-button>
              <el-button @click="resetConsumptionFilters">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table :data="pagedConsumptionRecords" border style="width: 100%" v-loading="consumptionLoading">
            <el-table-column prop="createdAt" label="调用时间" width="170" />
            <el-table-column prop="username" label="用户" width="150" />
            <el-table-column prop="endpoint" label="调用接口" min-width="220" />
            <el-table-column prop="modelName" label="模型" width="190" />
            <el-table-column label="消耗 Token" width="130">
              <template #default="scope">{{ formatNumber(scope.row.tokenConsumed) }}</template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrapper" v-if="consumptionTotal > consumptionPageSize">
            <el-pagination
              background
              layout="prev, pager, next, total"
              :total="consumptionTotal"
              :page-size="consumptionPageSize"
              :current-page="consumptionPage"
              @current-change="(page) => (consumptionPage = page)"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="数据中心审核管理" name="dataset">
        <el-row :gutter="16" class="summary-row">
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">数据集总数</div>
              <div class="summary-value text-primary">{{ datasetSummary.total }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">待审核</div>
              <div class="summary-value text-warning">{{ datasetSummary.pending }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">已通过</div>
              <div class="summary-value text-success">{{ datasetSummary.approved }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">公开中</div>
              <div class="summary-value text-success">{{ datasetSummary.publicCount }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="hover" class="section-card">
          <template #header>
            <div class="header-row">
              <span class="section-title">用户分享数据集管理</span>
              <el-button size="small" @click="loadDatasets">刷新</el-button>
            </div>
          </template>

          <el-form :inline="true" :model="datasetFilters" class="filter-form">
            <el-form-item label="关键词">
              <el-input
                v-model="datasetFilters.keyword"
                clearable
                placeholder="数据集名称 / 提交者"
                style="width: 240px;"
                @keyup.enter="loadDatasets"
              />
            </el-form-item>
            <el-form-item label="审核状态">
              <el-select v-model="datasetFilters.reviewStatus" placeholder="全部状态" style="width: 160px;">
                <el-option label="全部状态" value="" />
                <el-option
                  v-for="item in reviewStatusOptions"
                  :key="item.key"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="公开状态">
              <el-select v-model="datasetFilters.publishStatus" placeholder="全部状态" style="width: 160px;">
                <el-option label="全部状态" value="" />
                <el-option
                  v-for="item in publishStatusOptions"
                  :key="item.key"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="datasetFilters.category" placeholder="全部分类" style="width: 170px;">
                <el-option label="全部分类" value="" />
                <el-option
                  v-for="item in datasetCategoryOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="datasetLoading" @click="loadDatasets">筛选</el-button>
              <el-button @click="resetDatasetFilters">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table :data="pagedDatasets" border style="width: 100%" v-loading="datasetLoading">
            <el-table-column prop="name" label="数据集名称" min-width="220" />
            <el-table-column prop="owner" label="提交者" width="150" />
            <el-table-column prop="samples" label="样本量" width="110">
              <template #default="scope">{{ formatNumber(scope.row.samples) }}</template>
            </el-table-column>
            <el-table-column label="审核状态" width="120">
              <template #default="scope">
                <el-tag :type="resolveReviewStatusTag(scope.row.reviewStatus)">
                  {{ resolveReviewStatusLabel(scope.row.reviewStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="公开状态" width="120">
              <template #default="scope">
                <el-tag :type="resolvePublishStatusTag(scope.row.publishStatus)">
                  {{ resolvePublishStatusLabel(scope.row.publishStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="category" label="分类" width="120" />
            <el-table-column label="标签" min-width="180">
              <template #default="scope">
                <el-tag
                  v-for="tag in scope.row.tags"
                  :key="`${scope.row.id}-${tag}`"
                  class="table-tag"
                  effect="plain"
                >
                  {{ tag }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="submittedAt" label="提交时间" width="170" />
            <el-table-column label="操作" width="270" fixed="right">
              <template #default="scope">
                <el-button
                  size="small"
                  type="success"
                  link
                  :disabled="scope.row.reviewStatus === 'APPROVED'"
                  @click="handleDatasetApprove(scope.row)"
                >
                  通过
                </el-button>
                <el-button size="small" type="danger" link @click="handleDatasetReject(scope.row)">
                  驳回
                </el-button>
                <el-button size="small" type="primary" link @click="toggleDatasetPublish(scope.row)">
                  {{ scope.row.publishStatus === 'PUBLIC' ? '下架' : '公开' }}
                </el-button>
                <el-button size="small" type="info" link @click="openDatasetMetaDialog(scope.row)">
                  分类/标签
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrapper" v-if="datasetTotal > datasetPageSize">
            <el-pagination
              background
              layout="prev, pager, next, total"
              :total="datasetTotal"
              :page-size="datasetPageSize"
              :current-page="datasetPage"
              @current-change="(page) => (datasetPage = page)"
            />
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="模型广场审核管理" name="model">
        <el-row :gutter="16" class="summary-row">
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">模型总数</div>
              <div class="summary-value text-primary">{{ modelSummary.total }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">待审核</div>
              <div class="summary-value text-warning">{{ modelSummary.pending }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">已通过</div>
              <div class="summary-value text-success">{{ modelSummary.approved }}</div>
            </el-card>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-card shadow="hover">
              <div class="summary-label">公开中</div>
              <div class="summary-value text-success">{{ modelSummary.publicCount }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="hover" class="section-card">
          <template #header>
            <div class="header-row">
              <span class="section-title">用户发布模型管理</span>
              <el-button size="small" @click="loadModels">刷新</el-button>
            </div>
          </template>

          <el-form :inline="true" :model="modelFilters" class="filter-form">
            <el-form-item label="关键词">
              <el-input
                v-model="modelFilters.keyword"
                clearable
                placeholder="模型名称 / 发布者"
                style="width: 240px;"
                @keyup.enter="loadModels"
              />
            </el-form-item>
            <el-form-item label="审核状态">
              <el-select v-model="modelFilters.reviewStatus" placeholder="全部状态" style="width: 160px;">
                <el-option label="全部状态" value="" />
                <el-option
                  v-for="item in reviewStatusOptions"
                  :key="item.key"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="公开状态">
              <el-select v-model="modelFilters.publishStatus" placeholder="全部状态" style="width: 160px;">
                <el-option label="全部状态" value="" />
                <el-option
                  v-for="item in publishStatusOptions"
                  :key="item.key"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="分类">
              <el-select v-model="modelFilters.category" placeholder="全部分类" style="width: 170px;">
                <el-option label="全部分类" value="" />
                <el-option
                  v-for="item in modelCategoryOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="modelLoading" @click="loadModels">筛选</el-button>
              <el-button @click="resetModelFilters">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table :data="pagedModels" border style="width: 100%" v-loading="modelLoading">
            <el-table-column prop="name" label="模型名称" min-width="210" />
            <el-table-column prop="owner" label="发布者" width="140" />
            <el-table-column prop="version" label="版本" width="100" />
            <el-table-column prop="framework" label="框架" width="130" />
            <el-table-column label="审核状态" width="120">
              <template #default="scope">
                <el-tag :type="resolveReviewStatusTag(scope.row.reviewStatus)">
                  {{ resolveReviewStatusLabel(scope.row.reviewStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="公开状态" width="120">
              <template #default="scope">
                <el-tag :type="resolvePublishStatusTag(scope.row.publishStatus)">
                  {{ resolvePublishStatusLabel(scope.row.publishStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="category" label="分类" width="130" />
            <el-table-column label="标签" min-width="180">
              <template #default="scope">
                <el-tag
                  v-for="tag in scope.row.tags"
                  :key="`${scope.row.id}-${tag}`"
                  class="table-tag"
                  effect="plain"
                >
                  {{ tag }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="发布时间" width="170" />
            <el-table-column label="操作" width="270" fixed="right">
              <template #default="scope">
                <el-button
                  size="small"
                  type="success"
                  link
                  :disabled="scope.row.reviewStatus === 'APPROVED'"
                  @click="handleModelApprove(scope.row)"
                >
                  通过
                </el-button>
                <el-button size="small" type="danger" link @click="handleModelReject(scope.row)">
                  驳回
                </el-button>
                <el-button size="small" type="primary" link @click="toggleDatasetPublish(scope.row)">
                  {{ scope.row.publishStatus === 'PUBLIC' ? '下架' : '公开' }}
                </el-button>
                <el-button size="small" type="info" link @click="openModelMetaDialog(scope.row)">
                  分类/标签
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-wrapper" v-if="modelTotal > modelPageSize">
            <el-pagination
              background
              layout="prev, pager, next, total"
              :total="modelTotal"
              :page-size="modelPageSize"
              :current-page="modelPage"
              @current-change="(page) => (modelPage = page)"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>


    <el-dialog v-model="quotaDialogVisible" title="调整用户额度" width="520px" destroy-on-close>
      <el-form ref="quotaFormRef" :model="quotaForm" :rules="quotaRules" label-width="110px">
        <el-form-item label="用户名">
          <el-text>{{ editingQuotaUser?.username || '-' }}</el-text>
        </el-form-item>
        <el-form-item label="Token 额度" prop="tokenQuota">
          <el-input-number v-model="quotaForm.tokenQuota" :min="1" :step="1000" controls-position="right" />
        </el-form-item>
        <el-form-item label="使用上限" prop="usageLimit">
          <el-input-number v-model="quotaForm.usageLimit" :min="1" :step="1000" controls-position="right" />
        </el-form-item>
        <el-form-item label="预警阈值(%)" prop="warningThreshold">
          <el-input-number
            v-model="quotaForm.warningThreshold"
            :min="1"
            :max="100"
            :step="1"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="调整说明">
          <el-input
            v-model="quotaForm.reason"
            type="textarea"
            :rows="3"
            placeholder="可选：填写本次额度调整说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="quotaDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="quotaSubmitting" @click="submitQuotaAdjustment">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="datasetMetaDialogVisible" title="设置数据集分类与标签" width="520px" destroy-on-close>
      <el-form :model="datasetMetaForm" label-width="100px">
        <el-form-item label="数据集">
          <el-text>{{ editingDataset?.name || '-' }}</el-text>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="datasetMetaForm.category" placeholder="请选择分类" style="width: 100%;">
            <el-option
              v-for="item in datasetCategoryOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="datasetMetaForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入或选择标签"
            style="width: 100%;"
          >
            <el-option
              v-for="item in datasetTagOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="datasetMetaDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="datasetMetaSubmitting" @click="submitDatasetMeta">保存</el-button>
      </template>
    </el-dialog>


    <el-dialog v-model="modelMetaDialogVisible" title="设置模型分类与标签" width="520px" destroy-on-close>
      <el-form :model="modelMetaForm" label-width="100px">
        <el-form-item label="模型">
          <el-text>{{ editingModel?.name || '-' }}</el-text>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="modelMetaForm.category" placeholder="请选择分类" style="width: 100%;">
            <el-option
              v-for="item in modelCategoryOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="modelMetaForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入或选择标签"
            style="width: 100%;"
          >
            <el-option
              v-for="item in modelTagOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="modelMetaDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="modelMetaSubmitting" @click="submitModelMeta">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>



<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  isUsingMockData,  // 当前是否为假数据模式
  adjustUserQuota,
  fetchDatasetList,
  fetchModelList,
  fetchQuotaConsumptionRecords,
  fetchQuotaOverview,
  fetchQuotaUserList,
  updateDatasetMeta,
  updateDatasetPublishStatus,
  updateDatasetReviewStatus,
  updateModelMeta,
  updateModelPublishStatus,
  updateModelReviewStatus
} from '../api/AdminConsoleManagement'

const activeTab = ref('quota')

const roleOptions = [
  { label: '管理员', value: 'ADMIN' },
  { label: 'AI 开发者', value: 'DEVELOPER' },
  { label: '零基础用户', value: 'ZERO_BASIS' }
]

const roleTagMap = {
  ADMIN: 'danger',
  DEVELOPER: 'success',
  ZERO_BASIS: 'info'
}

// 筛选标签种类(后面可以改)
// 调用接口类型(真的有这个字段吗)
const endpointOptions = ['/api/chat/completions', '/api/embeddings', '/api/images/generations']
// 数据集分类
const datasetCategoryOptions = ['农业', '医疗', '交通', '遥感', '教育']
// 数据集标签
const datasetTagOptions = ['图像', '文本', '时序', '病虫害', '诊断', '公开数据', '标注']
// 模型分类
const modelCategoryOptions = ['分类', '回归']
// 模型标签
const modelTagOptions = ['分类', '回归']


// 审核状态
const reviewStatusOptions = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' }
]

const reviewStatusMap = {
  PENDING: { label: '待审核', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' }
}

// 公开状态(不知道是否真的有两个状态字段)
const publishStatusOptions = [
  { label: '公开中', value: 'PUBLIC' },
  { label: '未公开', value: 'PRIVATE' },
  { label: '已下架', value: 'OFFLINE' }
]

const publishStatusMap = {
  PRIVATE: { label: '未公开', type: 'info' },
  PUBLIC: { label: '公开中', type: 'success' },
  OFFLINE: { label: '已下架', type: 'warning' }
}

const formatNumber = (value) => Number(value || 0).toLocaleString()
const formatPercent = (value) => `${Math.round(Number(value || 0) * 100)}%`
const normalizeTags = (tags) => (Array.isArray(tags) ? tags.filter((item) => !!item) : [])

const resolveRoleLabel = (value) => {
  const target = roleOptions.find((item) => item.value === value)
  return target ? target.label : value
}
const resolveRoleTag = (value) => roleTagMap[value] || 'info'

const resolveReviewStatusLabel = (value) => reviewStatusMap[value]?.label || value
const resolveReviewStatusTag = (value) => reviewStatusMap[value]?.type || 'info'
const resolvePublishStatusLabel = (value) => publishStatusMap[value]?.label || value
const resolvePublishStatusTag = (value) => publishStatusMap[value]?.type || 'info'

const getQuotaUsageRate = (user) => {
  if (!user || !user.tokenQuota) {
    return 0
  }
  return Number(user.tokenUsed || 0) / Number(user.tokenQuota || 1)
}

// 超过阈值预警
const isQuotaWarning = (user) => getQuotaUsageRate(user) >= Number(user.warningThreshold || 0)

// 超过额度或上限提示额度不足
const isQuotaInsufficient = (user) =>
  Number(user.tokenUsed || 0) >= Number(user.tokenQuota || 0) ||
  Number(user.tokenUsed || 0) >= Number(user.usageLimit || 0)

const resolveQuotaStatusLabel = (user) => {
  if (isQuotaInsufficient(user)) return '额度不足'
  if (isQuotaWarning(user)) return '预警'
  return '正常'
}

const resolveQuotaStatusTag = (user) => {
  if (isQuotaInsufficient(user)) return 'danger'
  if (isQuotaWarning(user)) return 'warning'
  return 'success'
}

const resolveQuotaProgressColor = (user) => {
  if (isQuotaInsufficient(user)) return '#F56C6C'
  if (isQuotaWarning(user)) return '#E6A23C'
  return '#67C23A'
}

const resolveQuotaRowClass = ({ row }) => (isQuotaInsufficient(row) ? 'quota-insufficient-row' : '')


const quotaOverview = ref({
  totalUsers: 0,
  totalConsumedTokens: 0,
  warningUsers: 0,
  insufficientUsers: 0
})
const quotaUsers = ref([])
const quotaLoading = ref(false)
const quotaFilters = reactive({
  username: '',
  role: '',
  status: ''
})
const quotaPage = ref(1)
const quotaPageSize = 6
const quotaTotal = computed(() => quotaUsers.value.length)
const pagedQuotaUsers = computed(() => {
  const start = (quotaPage.value - 1) * quotaPageSize
  const end = start + quotaPageSize
  return quotaUsers.value.slice(start, end)
})
const insufficientQuotaUsers = computed(() => quotaUsers.value.filter((item) => isQuotaInsufficient(item)))
const insufficientUserNames = computed(() => insufficientQuotaUsers.value.map((item) => item.username).join('、'))

const consumptionFilters = reactive({
  username: '',
  endpoint: ''
})
const consumptionRecords = ref([])
const consumptionLoading = ref(false)
const consumptionPage = ref(1)
const consumptionPageSize = 6
const consumptionTotal = computed(() => consumptionRecords.value.length)
const pagedConsumptionRecords = computed(() => {
  const start = (consumptionPage.value - 1) * consumptionPageSize
  const end = start + consumptionPageSize
  return consumptionRecords.value.slice(start, end)
})

const quotaDialogVisible = ref(false)
const quotaSubmitting = ref(false)
const editingQuotaUser = ref(null)
const quotaFormRef = ref()
const quotaForm = reactive({
  tokenQuota: 0,
  usageLimit: 0,
  warningThreshold: 80,
  reason: ''
})
const quotaRules = {
  tokenQuota: [{ required: true, message: '请输入 Token 额度', trigger: 'blur' }],
  usageLimit: [{ required: true, message: '请输入使用上限', trigger: 'blur' }],
  warningThreshold: [{ required: true, message: '请输入预警阈值', trigger: 'blur' }]
}



const datasetLoading = ref(false)
const datasetFilters = reactive({
  keyword: '',
  reviewStatus: '',
  publishStatus: '',
  category: ''
})
const datasets = ref([])
const datasetPage = ref(1)
const datasetPageSize = 6
const datasetTotal = computed(() => datasets.value.length)
const pagedDatasets = computed(() => {
  const start = (datasetPage.value - 1) * datasetPageSize
  const end = start + datasetPageSize
  return datasets.value.slice(start, end)
})
const datasetSummary = computed(() => ({
  total: datasets.value.length,
  pending: datasets.value.filter((item) => item.reviewStatus === 'PENDING').length,
  approved: datasets.value.filter((item) => item.reviewStatus === 'APPROVED').length,
  publicCount: datasets.value.filter((item) => item.publishStatus === 'PUBLIC').length
}))

const datasetMetaDialogVisible = ref(false)
const datasetMetaSubmitting = ref(false)
const editingDataset = ref(null)
const datasetMetaForm = reactive({
  category: '',
  tags: []
})



const modelLoading = ref(false)
const modelFilters = reactive({
  keyword: '',
  reviewStatus: '',
  publishStatus: '',
  category: ''
})
const models = ref([])
const modelPage = ref(1)
const modelPageSize = 6
const modelTotal = computed(() => models.value.length)
const pagedModels = computed(() => {
  const start = (modelPage.value - 1) * modelPageSize
  const end = start + modelPageSize
  return models.value.slice(start, end)
})
const modelSummary = computed(() => ({
  total: models.value.length,
  pending: models.value.filter((item) => item.reviewStatus === 'PENDING').length,
  approved: models.value.filter((item) => item.reviewStatus === 'APPROVED').length,
  publicCount: models.value.filter((item) => item.publishStatus === 'PUBLIC').length
}))

const modelMetaDialogVisible = ref(false)
const modelMetaSubmitting = ref(false)
const editingModel = ref(null)
const modelMetaForm = reactive({
  category: '',
  tags: []
})



/*================================================API额度管理================================================*/
const loadQuotaOverview = async () => {
  const result = await fetchQuotaOverview()
  quotaOverview.value = {
    totalUsers: Number(result.totalUsers || 0),
    totalConsumedTokens: Number(result.totalConsumedTokens || 0),
    warningUsers: Number(result.warningUsers || 0),
    insufficientUsers: Number(result.insufficientUsers || 0)
  }
}

const loadQuotaUsers = async () => {
  const result = await fetchQuotaUserList({
    username: quotaFilters.username.trim(),
    role: quotaFilters.role,
    status: quotaFilters.status
  })
  quotaUsers.value = Array.isArray(result.list) ? result.list : []
  quotaPage.value = 1
}

const refreshQuotaSection = async () => {
  quotaLoading.value = true
  try {
    await Promise.all([loadQuotaOverview(), loadQuotaUsers(), loadConsumptionRecords()])
  } catch (error) {
    ElMessage.error(error.message || '额度管理数据加载失败')
  } finally {
    quotaLoading.value = false
  }
}

const handleQuotaSearch = async () => {
  quotaLoading.value = true
  try {
    await loadQuotaUsers()
    await loadQuotaOverview()
  } catch (error) {
    ElMessage.error(error.message || '额度筛选失败')
  } finally {
    quotaLoading.value = false
  }
}

const resetQuotaFilters = async () => {
  quotaFilters.username = ''
  quotaFilters.role = ''
  quotaFilters.status = ''
  await handleQuotaSearch()
}

const loadConsumptionRecords = async () => {
  consumptionLoading.value = true
  try {
    const result = await fetchQuotaConsumptionRecords({
      username: consumptionFilters.username.trim(),
      endpoint: consumptionFilters.endpoint
    })
    consumptionRecords.value = Array.isArray(result.list) ? result.list : []
    consumptionPage.value = 1
  } catch (error) {
    ElMessage.error(error.message || '调用消耗记录加载失败')
  } finally {
    consumptionLoading.value = false
  }
}

const resetConsumptionFilters = async () => {
  consumptionFilters.username = ''
  consumptionFilters.endpoint = ''  
  await loadConsumptionRecords()
}

const openQuotaDialog = (user) => {
  editingQuotaUser.value = user
  quotaForm.tokenQuota = Number(user.tokenQuota || 0)
  quotaForm.usageLimit = Number(user.usageLimit || 0)
  quotaForm.warningThreshold = Math.round(Number(user.warningThreshold || 0) * 100)
  quotaForm.reason = ''
  quotaDialogVisible.value = true
}

const submitQuotaAdjustment = async () => {
  if (!editingQuotaUser.value) {
    return
  }

  await quotaFormRef.value?.validate()
  if (quotaForm.usageLimit > quotaForm.tokenQuota) {
    ElMessage.warning('使用上限不能大于 Token 额度')
    return
  }

  quotaSubmitting.value = true
  try {
    await adjustUserQuota({
      userId: editingQuotaUser.value.id,
      tokenQuota: Number(quotaForm.tokenQuota),
      usageLimit: Number(quotaForm.usageLimit),
      warningThreshold: Number(quotaForm.warningThreshold) / 100,
      reason: quotaForm.reason.trim()
    })
    ElMessage.success('额度调整成功')
    quotaDialogVisible.value = false
    await refreshQuotaSection()
  } catch (error) {
    ElMessage.error(error.message || '额度调整失败')
  } finally {
    quotaSubmitting.value = false
  }
}


/*================================================数据中心审核与管理================================================*/
const loadDatasets = async () => {
  datasetLoading.value = true
  try {
    const result = await fetchDatasetList({
      keyword: datasetFilters.keyword.trim(),
      reviewStatus: datasetFilters.reviewStatus,
      publishStatus: datasetFilters.publishStatus,
      category: datasetFilters.category
    })
    datasets.value = Array.isArray(result.list) ? result.list : []
    datasetPage.value = 1
  } catch (error) {
    ElMessage.error(error.message || '数据集列表加载失败')
  } finally {
    datasetLoading.value = false
  }
}

const resetDatasetFilters = async () => {
  datasetFilters.keyword = ''
  datasetFilters.reviewStatus = ''
  datasetFilters.publishStatus = ''
  datasetFilters.category = ''
  await loadDatasets()
}

const handleDatasetApprove = async (dataset) => {
  try {
    await ElMessageBox.confirm(`确认通过数据集「${dataset.name}」吗？`, '数据集审核', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
    await updateDatasetReviewStatus({
      datasetId: dataset.id,
      reviewStatus: 'APPROVED',
      reviewComment: ''
    })
    ElMessage.success('数据集已通过审核')
    await loadDatasets()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '数据集审核失败')
    }
  }
}

const handleDatasetReject = async (dataset) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因（可选）', `驳回数据集：${dataset.name}`, {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：样本标注不完整'
    })
    await updateDatasetReviewStatus({
      datasetId: dataset.id,
      reviewStatus: 'REJECTED',
      reviewComment: (value || '').trim()
    })
    ElMessage.success('数据集已驳回')
    await loadDatasets()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '驳回操作失败')
    }
  }
}

const toggleDatasetPublish = async (dataset) => {
  const nextStatus = dataset.publishStatus === 'PUBLIC' ? 'OFFLINE' : 'PUBLIC'
  const actionText = nextStatus === 'PUBLIC' ? '公开' : '下架'
  try {
    await ElMessageBox.confirm(`确认${actionText}数据集「${dataset.name}」吗？`, `${actionText}数据集`, {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
    await updateDatasetPublishStatus({
      datasetId: dataset.id,
      publishStatus: nextStatus
    })
    ElMessage.success(`数据集已${actionText}`)
    await loadDatasets()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || `${actionText}失败`)
    }
  }
}

const openDatasetMetaDialog = (dataset) => {
  editingDataset.value = dataset
  datasetMetaForm.category = dataset.category || ''
  datasetMetaForm.tags = normalizeTags(dataset.tags)
  datasetMetaDialogVisible.value = true
}

const submitDatasetMeta = async () => {
  if (!editingDataset.value) {
    return
  }
  if (!datasetMetaForm.category) {
    ElMessage.warning('请选择分类')
    return
  }
  datasetMetaSubmitting.value = true
  try {
    await updateDatasetMeta({
      datasetId: editingDataset.value.id,
      category: datasetMetaForm.category,
      tags: normalizeTags(datasetMetaForm.tags)
    })
    ElMessage.success('数据集分类与标签更新成功')
    datasetMetaDialogVisible.value = false
    await loadDatasets()
  } catch (error) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    datasetMetaSubmitting.value = false
  }
}


/*================================================模型广场审核与管理================================================*/
const loadModels = async () => {
  modelLoading.value = true
  try {
    const result = await fetchModelList({
      keyword: modelFilters.keyword.trim(),
      reviewStatus: modelFilters.reviewStatus,
      publishStatus: modelFilters.publishStatus,
      category: modelFilters.category
    })
    models.value = Array.isArray(result.list) ? result.list : []
    modelPage.value = 1
  } catch (error) {
    ElMessage.error(error.message || '模型列表加载失败')
  } finally {
    modelLoading.value = false
  }
}

const resetModelFilters = async () => {
  modelFilters.keyword = ''
  modelFilters.reviewStatus = ''
  modelFilters.publishStatus = ''
  modelFilters.category = ''
  await loadModels()
}

const handleModelApprove = async (model) => {
  try {
    await ElMessageBox.confirm(`确认通过模型「${model.name}」吗？`, '模型审核', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
    await updateModelReviewStatus({
      modelId: model.id,
      reviewStatus: 'APPROVED',
      reviewComment: ''
    })
    ElMessage.success('模型已通过审核')
    await loadModels()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '模型审核失败')
    }
  }
}

const handleModelReject = async (model) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因（可选）', `驳回模型：${model.name}`, {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：模型说明文档不完整'
    })
    await updateModelReviewStatus({
      modelId: model.id,
      reviewStatus: 'REJECTED',
      reviewComment: (value || '').trim()
    })
    ElMessage.success('模型已驳回')
    await loadModels()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '驳回操作失败')
    }
  }
}

const toggleModelPublish = async (model) => {
  const nextStatus = model.publishStatus === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
  const actionText = nextStatus === 'PUBLIC' ? '设为公开' : '取消公开'
  try {
    await ElMessageBox.confirm(`确认${actionText}模型「${model.name}」吗？`, '模型公开状态', {
      type: 'warning',
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    })
    await updateModelPublishStatus({
      modelId: model.id,
      publishStatus: nextStatus
    })
    ElMessage.success(`模型已${actionText}`)
    await loadModels()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || `${actionText}失败`)
    }
  }
}

const openModelMetaDialog = (model) => {
  editingModel.value = model
  modelMetaForm.category = model.category || ''
  modelMetaForm.tags = normalizeTags(model.tags)
  modelMetaDialogVisible.value = true
}

const submitModelMeta = async () => {
  if (!editingModel.value) {
    return
  }
  if (!modelMetaForm.category) {
    ElMessage.warning('请选择分类')
    return
  }
  modelMetaSubmitting.value = true
  try {
    await updateModelMeta({
      modelId: editingModel.value.id,
      category: modelMetaForm.category,
      tags: normalizeTags(modelMetaForm.tags)
    })
    ElMessage.success('模型分类与标签更新成功')
    modelMetaDialogVisible.value = false
    await loadModels()
  } catch (error) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    modelMetaSubmitting.value = false
  }
}



// 首次进入就把三块数据都拉齐
onMounted(async () => {
  await Promise.all([refreshQuotaSection(), loadDatasets(), loadModels()])
})

</script>

<style scoped>
.admin-console {
  width: 100%;
}

.mock-alert {
  margin-bottom: 16px;
}

.summary-row {
  margin-bottom: 16px;
}

.summary-label {
  color: var(--zs-muted);
  font-size: 13px;
}

.summary-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
}

.text-primary {
  color: var(--zs-text);
}

.text-success {
  color: var(--zs-success);
}

.text-warning {
  color: var(--zs-warning);
}

.text-danger {
  color: var(--zs-danger);
}

.section-card {
  margin-bottom: 16px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-weight: 600;
  color: var(--zs-text);
}

.filter-form {
  margin-bottom: 14px;
}

.insufficient-alert {
  margin-bottom: 12px;
}

.alert-detail {
  margin-top: 6px;
  color: var(--zs-danger);
  font-size: 13px;
}

.progress-cell {
  padding-right: 8px;
}

.table-tag {
  margin: 2px 6px 2px 0;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

:deep(.quota-insufficient-row) {
  --el-table-tr-bg-color: rgba(185, 28, 28, 0.05);
}

:deep(.el-tabs__header) {
  margin-bottom: 18px;
}

:deep(.el-card__body) {
  color: var(--zs-text);
}
</style>
