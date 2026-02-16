g = window;

// 动态加载依赖的脚本
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
    // console.log(`script for ${url} created`);
  });
}


g.loadScripts = function (urls, callback) {
  // document.write(`<script src="${url}"></script>`);
  let isDOMReady = false;
  let ol = document.addEventListener;
  const domContentLoadedListeners = [];
  document.addEventListener = function (type, listener, options) {
    if (type === 'DOMContentLoaded') {
      domContentLoadedListeners.push([listener, options]);
      // console.log('Detected DOMContentLoaded listener:', listener);
    } else {
      return ol.call(this, type, listener, options);
    }
  };

  ol("DOMContentLoaded", function () {

    if (isDOMReady) {
      // console.log('not loaded');
    } else {
      for (let i = 0; i < domContentLoadedListeners.length; ++i) {
        let lis = domContentLoadedListeners[i];
        ol.call(this, "DOMContentLoaded", lis.listener, lis.options);
      }
    }
  })


  let ps = [];

  for (let i = 0; i < urls.length; i++) {
    ps.push(loadScript(`js/${urls[i]}`));
  }

  Promise.all(ps).then(() => {
    // console.log(`all script loaded`);
    isDOMReady = true;
    const event = new Event('DOMContentLoaded');
    document.dispatchEvent(event);
  });
}


g.AllinEmail = g.AllinEmail || {
  string: {
    lang: "en"
  },
  languages: []
};

g.getKeyValuePair = function (arr) {
  let kv = {};
  for (let i = 0; i < arr.length; i = i + 2) {
    if (kv[arr[i]] == null) {
      kv[arr[i]] = arr[i + 1];
    } else {
      console.log(`${arr[i]} exists`);
    }
  }
  return kv;
}

g.DownloadUrl = `http://www.labadida.com/download/AllinEmail`;

g.loadScripts([
  `string.en.js`
]);