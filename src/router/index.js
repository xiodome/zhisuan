import { createRouter, createWebHistory } from 'vue-router'
import TaskCenter from '../components/TaskCenter.vue'
import UserCenter from '../components/UserCenter.vue'
import AdminConsole from '../components/AdminConsole.vue'
import AdminUserManagement from '../components/AdminUserManagement.vue'
import Community from '../components/Community.vue'
import CommunityDetail from '../components/CommunityDetail.vue'
import DatasetCreate from '../components/DatasetCreate.vue'
import ModelCreate from '../components/ModelCreate.vue'

const publisherRoles = ['DEVELOPER', 'ADMIN']

const routes = [
  { path: '/', redirect: '/task-center' },
  { path: '/task-center', name: 'task-center', component: TaskCenter },
  { path: '/user-center', name: 'user-center', component: UserCenter },
  { path: '/community', redirect: '/community/datasets' },
  { path: '/community/datasets', name: 'community-datasets', component: Community },
  { path: '/community/models', name: 'community-models', component: Community },
  { path: '/community/workflows', name: 'community-workflows', component: Community },
  {
    path: '/community/datasets/create',
    name: 'community-dataset-create',
    component: DatasetCreate,
    meta: { requiresPublisher: true }
  },
  {
    path: '/community/models/create',
    name: 'community-model-create',
    component: ModelCreate,
    meta: { requiresPublisher: true }
  },
  {
    path: '/community/:type/:id',
    name: 'community-detail',
    component: CommunityDetail,
    props: true
  },
  {
    path: '/admin/console',
    name: 'admin-console',
    component: AdminConsole,
    meta: { requiresAdmin: true }
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: AdminUserManagement,
    meta: { requiresAdmin: true }
  },
  { path: '/:pathMatch(.*)*', redirect: '/task-center' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  const role = String(localStorage.getItem('role') || '').toUpperCase()

  if (to.meta?.requiresAdmin && role !== 'ADMIN') {
    return '/task-center'
  }

  if (to.meta?.requiresPublisher && !publisherRoles.includes(role)) {
    return '/community'
  }

  return true
})

export default router
