// src/store/user.js
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const role = ref(localStorage.getItem('role') || '')
  const name = ref(localStorage.getItem('name') || '')

  const setInfo = (data) => {
    token.value = data.token
    role.value = data.role
    name.value = data.name
    localStorage.setItem('token', data.token)
    localStorage.setItem('role', data.role)
    localStorage.setItem('name', data.name)
  }

  const logout = () => {
    token.value = ''
    role.value = ''
    name.value = ''
    localStorage.clear()
  }

  return { token, role, name, setInfo, logout }
})