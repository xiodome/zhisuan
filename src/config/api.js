// 后端接口基础地址，前后端本地联调时默认指向 backend/base 的 FastAPI 服务。
export const API_BASE_URL = 'http://127.0.0.1:8000'

// Agent 数据集上传接口，供 Element Plus 上传组件直接使用。
export const AGENT_DATASET_UPLOAD_URL = `${API_BASE_URL}/api/agent/datasets/upload`
