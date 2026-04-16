// 模拟假数据

const mockUsers = [
  {
    id: 1,
    username: '平台超级管理员',
    role: 'admin',
    status: 'enabled',
    email: 'admin@zhisuan.ai',
    lastLogin: '2026-04-16 10:12',
    createdAt: '2025-01-10'
  },
  {
    id: 2,
    username: '算法大神_韩梅梅',
    role: 'AIdeveloper',
    status: 'enabled',
    email: 'hanmeimei@zhisuan.ai',
    lastLogin: '2026-04-16 09:03',
    createdAt: '2025-03-18'
  },
  {
    id: 3,
    username: '农学学生_李雷',
    role: 'user',
    status: 'disabled',
    email: 'lilei@zhisuan.ai',
    lastLogin: '2026-04-12 19:21',
    createdAt: '2025-07-21'
  },
  {
    id: 4,
    username: '医学院_张伟',
    role: 'user',
    status: 'enabled',
    email: 'zhangwei@example.com',
    lastLogin: '2026-04-15 23:58',
    createdAt: '2025-10-02'
  },
  {
    id: 5,
    username: '小学生_孙颖',
    role: 'user',
    status: 'disabled',
    email: 'sunying@example.com',
    lastLogin: '2026-04-08 11:42',
    createdAt: '2025-11-12'
  },
  {
    id: 6,
    username: '中学生_王芳',
    role: 'AIdeveloper',
    status: 'enabled',
    email: 'wangfang@zhisuan.ai',
    lastLogin: '2026-04-16 08:11',
    createdAt: '2025-06-06'
  },
  {
    id: 7,
    username: '大学生_刘杰',
    role: 'AIdeveloper',
    status: 'enabled',
    email: 'liujie@zhisuan.ai',
    lastLogin: '2026-04-14 14:29',
    createdAt: '2025-09-05'
  }
]

const sleep = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms))
const deepCopy = (data) => JSON.parse(JSON.stringify(data))

export async function fetchUserList(params = {}) {
  await sleep()

  // TODO[后端接口插入点]
  // 接入后端时建议替换为：
  // return request.get('/admin/users', { params })
  // 并保持返回结构：{ list: User[], total: number }

  const keyword = (params.username || '').trim().toLowerCase()
  const role = params.role || ''
  const status = params.status || ''

  const filtered = mockUsers.filter((user) => {
    const matchKeyword =
      !keyword ||
      user.username.toLowerCase().includes(keyword)
    const matchRole = !role || user.role === role
    const matchStatus = !status || user.status === status

    return matchKeyword && matchRole && matchStatus
  })

  return {
    list: deepCopy(filtered),
    total: filtered.length
  }
}

export async function updateUserRole(payload) {
  await sleep()

  // TODO[后端接口插入点]
  // 接入后端时建议替换为：
  // return request.put(`/admin/users/${payload.userId}/role`, { role: payload.role })

  const target = mockUsers.find((item) => item.id === payload.userId)
  if (!target) {
    throw new Error('用户不存在')
  }
  target.role = payload.role

  return { success: true }
}

export async function updateUserStatus(payload) {
  await sleep()

  // TODO[后端接口插入点]
  // 接入后端时建议替换为：
  // return request.patch(`/admin/users/${payload.userId}/status`, { status: payload.status })

  const target = mockUsers.find((item) => item.id === payload.userId)
  if (!target) {
    throw new Error('用户不存在')
  }
  target.status = payload.status

  return { success: true }
}
