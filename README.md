# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).



### 2026.4.16
新增用户管理页面组件：/src/components/AdminUserManagement.vue
新增用户管理 API 占位层（后端对接点）/src/api/userManagement.js


### 2026.4.21
用户管理以及登陆注册前端部分完成


### 2026.4.22
新增管理员控制台 API 占位层(目前使用假数据) /src/api/AdminConsole.js
新增管理员控制台页面组件 /src/components/AdminConsole.vue
包括三个部分：API额度管理、数据中心审核管理、模型广场审核管理


### 2026.5.4
在原有的TaskCenter.vue基础上进行修改，主要修改了任务创建页面，包括自然语言描述需求，解析需求并确认；数据上传功能，支持拖拽或点击上传，上传成功后预览数据。并将模式选择以及审核选择移到任务创建处，创建成功即开始运行任务。新增了取消任务功能，支持中间取消任务。保证任务只有完成时才显示预测接口以及任务产物。新增任务状态进度显示，定时轮询任务状态。调整了原有主题，支持暗色主题以及明亮主题，默认为暗色主题。


### 2026.5.10
调整了任务中心大部分内容的展示形式；修改了部分由于主题导致的显示bug，修改了部分bug。


### 2026.5.18
新增个人中心界面，支持零基础用户申请成为AI开发者，同时增加管理员对于申请的审核。
修改了创建任务时无法预览数据的bug
新增社区模块，支持数据集、模型、工作流三种内容。修改了之前管理员控制台部分的关于三种内容的审核。

### 2026.5.26
修改了个人中心部分无法正常显示API额度的bug

### 2026.6.1
修复了bug：
人机协同创建任务进入 Agent Manager 审核后，点击“保存修改”会清空当前配置；随后“确认继续”提示“当前没有待审核节点”；
人机协同在 Operation Agent 审核阶段，点击“保存修改”或“确认继续”提示“当前没有待审核节点”，任务无法继续

### 2026.6.6
修复了bug：
人机协同到模型出现 Agent 任务恢复失败；
社区模型点击查看详情弹出 Example Domain(直接删除了按钮)
admin 调用消耗记录无内容

### 2026.6.8
修复了bug：
上传的csv文件不是UTF-8编码时预览数据会出错，任务无法运行