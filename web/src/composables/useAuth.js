import { ref } from 'vue'
import { auth } from '../store/auth'

const currentUser = ref(auth.user)
const token = ref(auth.token)

function setUser(user, t) {
  auth.setSession(user, t)
  currentUser.value = auth.user
  token.value = auth.token
}
function logout() {
  auth.clear()
  currentUser.value = null
  token.value = null
}

export function useAuth() {
  return { currentUser, token, setUser, logout }
}