import { createApp } from 'vue'
import { bindCaptureListener } from 'dom-inspector-hook'
import App from './App.vue'

bindCaptureListener({ url: 'http://localhost:3999', copy: true })

createApp(App).mount('#app')
