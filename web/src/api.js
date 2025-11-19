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

/* ----------------------- AUTH ----------------------- */
export async function login(creds) {
  const r = await api.post('/auth/login', creds)
  return r.data
}

/* -------------------- ESTADÍSTICAS ------------------- */
export async function fetchTopProducts() {
  const r = await api.get('/estadisticas/productos-mas-vendidos')
  return r.data
}

export async function fetchSalesRange(inicio, fin) {
  const r = await api.get('/estadisticas/ingresos-por-fecha', {
    params: { inicio, fin }
  })
  return r.data
}

/* ---------------------- PRODUCTOS -------------------- */
export async function addProduct(data) {
  const r = await api.post('/productos', data)
  return r.data
}

export async function updateProduct(id, data) {
  const r = await api.put(`/productos/${id}`, data)
  return r.data
}

export async function deleteProduct(id) {
  const r = await api.delete(`/productos/${id}`)
  return r.data
}

export async function agregarStockApi(id, cantidad) {
  const r = await api.post(`/productos/${id}/agregar-stock`, { cantidad })
  return r.data
}

export async function quitarStockApi(id, cantidad) {
  const r = await api.post(`/productos/${id}/quitar-stock`, { cantidad })
  return r.data
}

export async function fetchProducts(q = '') {
  const r = await api.get('/productos', { params: { search: q } })
  return r.data
}

/* ----------------------- USUARIOS --------------------- */
export async function fetchUsers() {
  const r = await api.get('/usuarios')
  return r.data
}

export async function createUser(data) {
  const r = await api.post('/usuarios', data)
  return r.data
}

export async function updateUser(id, data) {
  const r = await api.put(`/usuarios/${id}`, data)
  return r.data
}

export async function deleteUser(id) {
  const r = await api.delete(`/usuarios/${id}`)
  return r.data
}

/* ------------------------ VENTAS ---------------------- */
export async function emitirDte(payload) {
  const r = await api.post('/dte/emitir', payload)
  return r.data
}

export async function emitirVenta(payload) {
  const r = await api.post('/ventas/emitir', payload)
  return r.data
}

export async function fetchVoucher(numero) {
  const r = await api.get('/vouchers/', { params: { numero } })
  return r.data // <= siempre consistente
}

/* ----------------------- IMPORT ----------------------- */
export const uploadSql = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/import/upload-sql', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data)
}

export const getParsed = (uploadId) =>
  api.get(`/import/parsed/${uploadId}`).then(r => r.data)

export const getDestSchema = () =>
  api.get('/import/dest-schema').then(r => r.data)

export const previewMapping = (body) =>
  api.post('/import/preview', body).then(r => r.data)

export const processImport = (body) =>
  api.post('/import/apply', body).then(r => r.data)

export { api }
