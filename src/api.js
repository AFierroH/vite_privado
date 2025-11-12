import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://147.182.245.46:3000/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
})

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

export async function login(creds) { return api.post('/auth/login', creds) }

export async function fetchTopProducts() { return api.get('/estadisticas/productos-mas-vendidos') }
export async function fetchSalesRange(inicio, fin) {
  return api.get(`/estadisticas/ingresos-por-fecha`, { params: { inicio, fin } })
}

// Productos
export async function addProduct(data) { return api.post('/productos', data) }
export async function updateProduct(id, data) { return api.put(`/productos/${id}`, data) }
export async function deleteProduct(id) { return api.delete(`/productos/${id}`) }
export async function agregarStockApi(id, cantidad) { return api.post(`/productos/${id}/agregar-stock`, { cantidad }) }
export async function quitarStockApi(id, cantidad) { return api.post(`/productos/${id}/quitar-stock`, { cantidad }) }
export async function fetchProducts(q = '') {
  return api.get(`/productos`, { params: { search: q } })
}

// Usuarios
export async function fetchUsers() { return api.get('/usuarios') }
export async function createUser(data) { return api.post('/usuarios', data) }
export async function updateUser(id, data) { return api.put(`/usuarios/${id}`, data) }
export async function deleteUser(id) { return api.delete(`/usuarios/${id}`) }

// Ventas / DTE
export async function emitirDte(payload) { return api.post('/dte/emitir', payload) }
export async function emitirVenta(payload) {
  const resp = await api.post('/ventas/emitir', payload)
  return resp.data
}
export async function fetchVoucher(numero) {
  try {
    const r = await api.get('/vouchers/', { params: { numero } })
    return r.data
  } catch (err) {
    console.error('Error fetchVoucher', err)
    return null
  }
}

export const uploadSql = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/import/upload-sql', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getParsed = (uploadId) => api.get(`/import/parsed/${uploadId}`)
export const getDestSchema = () => api.get('/import/dest-schema')
export const previewMapping = (body) => api.post('/import/preview', body)
export const processImport = (body) => api.post('/import/apply', body)

export { api}  