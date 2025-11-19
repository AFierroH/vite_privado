export const auth = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  setSession(user, token){
    this.user = user; this.token = token;
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('token', token)
  },
  clear(){ this.user=null; this.token=null; localStorage.removeItem('user'); localStorage.removeItem('token') }
}
