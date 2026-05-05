import emitter from '@utils/events.utils';

const parseUrl = (url, params) => {
    if (!params) {
        return url;
    }

    const queryString = Object.keys(params)
        .map(key => `${key}=${params[key]}`)
        .join('&');

    return `${url}?${queryString}`;
};

const request = (options) => {
    const url = options.method === 'GET' && options.params
        ? parseUrl(options.url, options.params)
        : options.url;

    options.successCallback = options.successCallback || (() => {});
    options.finallyCallback = options.finallyCallback || (() => {});
    options.errorCallback = options.errorCallback || ((err) => emitter.emit('showSnackbar', 'error', err.toString()));
    options.failedCallback = options.failedCallback || ((res) => {
        if (res.authError) {
            emitter.emit('login');
            emitter.emit('setLoginState', false);
        }
        emitter.emit('showSnackbar', 'error', res.errMsg);
    });

    fetch(url, {
        method: options.method,
        body: options.method === 'POST' ? JSON.stringify(options.params) : undefined,
        credentials: options.credentials || 'include'
    })
        .then(req => req.json())
        .then(res => Object.prototype.hasOwnProperty.call(res, 'success') && !res.success
            ? options.failedCallback(res)
            : options.successCallback(res))
        .finally(options.finallyCallback)
        .catch(options.errorCallback);
};

export default request;
