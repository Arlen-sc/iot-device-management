import api from './api';

/**
 * 获取软件授权状态。
 */
export async function fetchLicenseStatus() {
  return api.get('/license/status');
}

/**
 * 激活授权码。
 */
export async function activateLicense(licenseCode) {
  return api.post('/license/activate', { licenseCode });
}
