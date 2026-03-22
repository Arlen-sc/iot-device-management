import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    const res = response.data;
    if (res.code === 200) {
      return res.data;
    }
    return Promise.reject(new Error(res.message || 'Error'));
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
