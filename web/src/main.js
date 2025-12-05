import { createApp } from 'vue'
import App from './App.vue'   
import router from './router'
import './style.css'
import qz from 'qz-tray';
window.qz = qz;
const app = createApp(App)
app.use(router)
app.mount('#app')

const theme = localStorage.getItem('theme') || 'dark'
if (theme === 'dark')
  document.documentElement.classList.add('dark')
else
  document.documentElement.classList.remove('dark')
