import { createApp } from 'vue'
import { createPinia } from 'pinia' // [鏂板寮曞叆 Pinia]
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia() // 初始化 Pinia 实例

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia) // [鏂板鎸傝浇 Pinia]
app.use(ElementPlus)
app.use(router)
app.mount('#app')
