// src/api/auth.js
const sleep = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

export async function loginApi(username, password) {
  await sleep() // 模拟网络延迟
  
  if (password !== '123456') {
    throw new Error('密码错误，测试密码请使用 123456')
  }

  // 根据账号模拟返回不同的角色和 Token
  const roles = {
    'admin': { token: 'admin-token', role: 'admin', name: '平台超级管理员' },
    'dev': { token: 'dev-token', role: 'AIdeveloper', name: '算法大神' },
    'user': { token: 'user-token', role: 'user', name: '零基础农学用户' }
  }

  if (roles[username]) {
    return roles[username]
  }
  throw new Error('用户不存在，请使用 admin, dev 或 user')
}