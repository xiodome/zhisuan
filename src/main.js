import { createApp } from 'vue'
import { createPinia } from 'pinia' // [新增引入 Pinia]
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)
const pinia = createPinia() // [新增实例化 Pinia]

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia) // [新增挂载 Pinia]
app.use(ElementPlus)
app.mount('#app')