import axios from 'axios'

// 1. 创建 Axios 实例，配置后端服务器的真实基础地址
const api = axios.create({
  baseURL: 'http://114.116.220.203:8000',
  timeout: 5000 // 请求超时时间设为 5 秒
})

// 2. 真实登录接口
export async function loginApi(username, password) {
  try {
    const response = await api.post('/api/auth/login', {
      username: username,
      password: password
    })
    
    // 【关键修改】：因为后端外面包了一层 {"success": true, "data": {...}}
    // 所以这里我们需要 response.data.data 才能拿到真正的核心数据
    const coreData = response.data.data 
    
    return {
      token: coreData.access_token,      // 拿到真实的 Token
      role: coreData.user.role,          // 拿到真实角色：ZERO_BASIS
      name: coreData.user.username       // 拿到真实用户名
    }
  } catch (error) {
    handleApiError(error, '登录失败，请检查账号密码')
  }
}

// 3. 真实注册接口
export async function registerApi(regData) {
  try {
    // 推测注册接口路径为 /api/auth/register (如有不同请找后端同学确认)
    const response = await api.post('/api/auth/register', {
      username: regData.username,
      password: regData.password,
      role: 'ZERO_BASIS' // 默认给新注册用户分配“零基础”角色
    })
    return response.data
  } catch (error) {
    handleApiError(error, '注册失败，该用户名可能已被占用或格式错误')
  }
}

// ================= 辅助函数：专门解析后端 FastAPI 的错误格式 =================
function handleApiError(error, defaultMsg) {
  if (error.response && error.response.data) {
    const errorData = error.response.data
    // 如果是 422 字段校验错误（比如密码太短）
    if (Array.isArray(errorData.detail)) {
      throw new Error(errorData.detail[0].msg)
    }
    // 如果是普通的业务错误（比如密码错误，返回了 {"detail": "Incorrect password"}）
    if (errorData.detail && typeof errorData.detail === 'string') {
      throw new Error(errorData.detail)
    }
  }
  // 如果服务器没响应或网断了
  throw new Error(defaultMsg)
}