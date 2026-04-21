// src/api/auth.js
const sleep = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms))

// 登录接口
export async function loginApi(username, password) {
  await sleep() 
  const roles = {
    'admin': { token: 'admin-token', role: 'admin', name: '平台超级管理员' },
    'dev': { token: 'dev-token', role: 'AIdeveloper', name: '算法大神' },
    'user': { token: 'user-token', role: 'user', name: '零基础农学用户' }
  }

  if (roles[username] && password === '123456') {
    return roles[username]
  }
  throw new Error('账号或密码错误')
}

// [新增] 注册接口
export async function registerApi(regData) {
  await sleep()
  // 这里先模拟逻辑，后续对接后端只需在此处发起 axios.post 请求
  console.log('向后端发送注册请求:', regData)
  
  if (regData.username === 'admin') {
    throw new Error('该用户名已被占用')
  }
  return { message: '注册成功' }
}