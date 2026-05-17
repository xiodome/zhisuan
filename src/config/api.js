// 后端接口基础地址：
// - 本地开发时直连 backend/base 的 FastAPI 服务。
// - 生产部署时走同源 /api，由 Nginx 反向代理到后端，避免暴露后端端口和 CORS 问题。
// export const API_BASE_URL = import.meta.env.DEV ? 'http://127.0.0.1:8000' : 'http://114.116.220.203:8000'
export const API_BASE_URL = 'http://114.116.220.203:8000'
// Agent 数据集上传接口，供 Element Plus 上传组件直接使用。
export const AGENT_DATASET_UPLOAD_URL = `${API_BASE_URL}/api/agent/datasets/upload`
