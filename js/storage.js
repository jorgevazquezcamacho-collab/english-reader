const Storage = (() => {
  const KEY_API = 'er_api_key';

  function getApiKey() {
    return localStorage.getItem(KEY_API) || '';
  }

  function saveApiKey(key) {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(KEY_API, trimmed);
    } else {
      localStorage.removeItem(KEY_API);
    }
  }

  return { getApiKey, saveApiKey };
})();
