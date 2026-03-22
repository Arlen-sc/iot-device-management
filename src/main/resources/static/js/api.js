const API = {
    baseUrl: '/api',

    async request(method, url, data) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (data) options.body = JSON.stringify(data);
        const response = await fetch(this.baseUrl + url, options);
        const result = await response.json();
        if (result.code !== 200) throw new Error(result.message || 'Request failed');
        return result.data;
    },

    get(url) { return this.request('GET', url); },
    post(url, data) { return this.request('POST', url, data); },
    put(url, data) { return this.request('PUT', url, data); },
    del(url) { return this.request('DELETE', url); }
};
