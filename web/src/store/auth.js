import { reactive, readonly } from 'vue'

const state = reactive({
  user: null,
  empresa: null, // Agregamos empresa aquí
  token: null
})

// Recuperar estado inicial
try {
  const savedSession = JSON.parse(localStorage.getItem('session') || '{}')
  if (savedSession.user) state.user = savedSession.user
  if (savedSession.token) state.token = savedSession.token
  if (savedSession.empresa) state.empresa = savedSession.empresa
} catch(e) {}

function setSession(user, token, empresa) {
  state.user = user
  state.token = token
  state.empresa = empresa // Guardar empresa
  
  // Persistir todo junto
  const sessionData = { user, token, empresa, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
  localStorage.setItem('session', JSON.stringify(sessionData))
  localStorage.setItem('token', token)
}

function logout() {
  state.user = null
  state.token = null
  state.empresa = null
  localStorage.removeItem('session')
  localStorage.removeItem('token')
  window.location.reload()
}

function updateEmpresa(newData) {
    state.empresa = { ...state.empresa, ...newData }
    const session = JSON.parse(localStorage.getItem('session') || '{}')
    session.empresa = state.empresa
    localStorage.setItem('session', JSON.stringify(session))
}

export const auth = {
  state: readonly(state),
  setSession,
  logout,
  updateEmpresa
}