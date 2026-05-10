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