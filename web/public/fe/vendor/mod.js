/**
 * @file: mod.js
 * @author fis ver: 1.0.13 update: 2016/01/27 https://github.com/fex-team/mod
 */
var require;

/* eslint-disable no-unused-vars */
var define;

(function(global) {

	// 避免重复加载而导致已定义模块丢失
	if (require) {
		return;
	}

	var head = document.getElementsByTagName('head')[0];
	var loadingMap = {};
	var factoryMap = {};
	var modulesMap = {};
	var scriptsMap = {};
	var resMap = {};
	var pkgMap = {};

	var createScripts = function(queues, onerror, onScriptLoaded) {

		var docFrag = document.createDocumentFragment();
		var loaded = 0;
		for (var i = 0, len = queues.length; i < len; i++) {
			var id = queues[i].id;
			var url = queues[i].url;
			if (url in scriptsMap) {
				log("skipping created " + url);
				var script = scriptsMap[url];
				if ('onload' in script) {
					var old = script.onload;
					script.onload = function() {
						log(this.src + " onloaded");
						loaded++;
						if (loaded >= len) {
							onScriptLoaded();
						}
						old && old();
					};
				} else {
					var old = script.onreadystatechange;
					script.onreadystatechange = function() {
						log(script.src + " " + this.readyState);
						if (this.readyState === 'loaded' || this.readyState === 'complete') {
							old && old();

							loaded++;
							if (loaded >= len) {
								onScriptLoaded();
							}
						}
					};
				}
				continue;
			}
			log("creating " + url);
			var script = document.createElement('script');
			scriptsMap[url] = script;

			if (onerror || onScriptLoaded) {
				(function(script, id) {
					var tid = setTimeout(function() {
						onerror(id);
					}, require.timeout);

					script.onerror = function() {
						clearTimeout(tid);
						onerror(id);
					};

					var onload = function() {
						clearTimeout(tid);
						loaded++;
						if (loaded >= len) {
							onScriptLoaded && onScriptLoaded();
						}
					};

					if ('onload' in script) {
						script.onload = function() {
							log(script.src + " onloaded");
							onload && onload();
						};
					} else {
						script.onreadystatechange = function() {
							log(script.src + " " + this.readyState);
							if (this.readyState === 'loaded' || this.readyState === 'complete') {
								log(script.src + " " + this.readyState);
								onload();
							}
						};
					}
				})(script, id);
			}
			script.type = 'text/javascript';
			script.src = url;

			docFrag.appendChild(script);
		}

		head.appendChild(docFrag);
	};

	var loadScripts = function(ids, callback, onerror) {
		var queues = [];
		for (var i = 0, len = ids.length; i < len; i++) {
			var id = ids[i];
			var res = resMap[id] || resMap[id + '.js'] || {};
			var pkg = res.pkg;
			var url;
			if (!res.type) {
				var queue = loadingMap[id] || (loadingMap[id] = []);
				queue.push(callback);
			}
			//
			// resource map query
			//

			if (pkg) {
				url = pkgMap[pkg].url || pkgMap[pkg].uri;
			} else {
				url = res.url || res.uri || id;
			}

			queues.push({
				id : id,
				url : url
			});
		}

		createScripts(queues, onerror, callback);
	};

	define = function(id, factory) {
		id = id.replace(/\.js$/i, '');
		factoryMap[id] = factory;

		var queue = loadingMap[id];
		if (queue) {
			for (var i = 0, n = queue.length; i < n; i++) {
				queue[i]();
			}
			delete loadingMap[id];
		}
	};

	require = function(id) {

		// compatible with require([dep, dep2...]) syntax.
		if (id && id.splice) {
			return require.async.apply(this, arguments);
		}

		id = require.alias(id);

		var mod = modulesMap[id];
		if (mod) {
			return mod.exports;
		}

		//
		// init module
		//
		var factory = factoryMap[id];
		if (!factory) {
			throw '[ModJS] Cannot find module `' + id + '`';
		}

		mod = modulesMap[id] = {
			exports : {}
		};

		//
		// factory: function OR value
		//
		var ret = (typeof factory === 'function') ? factory.apply(mod, [ require, mod.exports, mod ]) : factory;

		if (ret) {
			mod.exports = ret;
		}

		return mod.exports;
	};

	var log = function(msg) {
		console.log(msg);
	}

	require.async = function(names, onload, onerror) {
		if (typeof names === 'string') {
			log("asyncing " + names);
			var dep = require.alias(names);
			var child = resMap[dep] || resMap[dep + '.js'];
			var depsLoaded = function() {
				log("loading "+ names);
				loadScripts([ names ], onload, onerror);
			}

			if (child && 'deps' in child) {
				require.async(child.deps, depsLoaded, onerror);
			}

			return;
		}

		var total = names.length;
		var loaded = 0;
		var onitemloaded = function() {
			loaded++;
			if (loaded == total) {
				onload && onload();
			}
		};

		for (var i = 0; i < names.length; ++i) {
			require.async(names[i], onitemloaded, onerror);
		}

		if (names.length == 0) {
			onload && onload();
		}

	};

	require.ensure = function(names, callback) {
		require.async(names, function() {
			callback && callback.call(this, require);
		});
	};

	require.resourceMap = function(obj) {
		var k;
		var col;

		// merge `res` & `pkg` fields
		col = obj.res;
		for (k in col) {
			if (col.hasOwnProperty(k)) {
				resMap[k] = col[k];
			}
		}

		col = obj.pkg;
		for (k in col) {
			if (col.hasOwnProperty(k)) {
				pkgMap[k] = col[k];
			}
		}
	};

	require.loadJs = function(url) {
		if (url in scriptsMap) {
			return;
		}

		var script = document.createElement('script');
		scriptsMap[url] = script;
		script.type = 'text/javascript';
		script.src = url;
		head.appendChild(script);
	};

	require.loadCss = function(cfg) {
		if (cfg.content) {
			var sty = document.createElement('style');
			sty.type = 'text/css';

			if (sty.styleSheet) { // IE
				sty.styleSheet.cssText = cfg.content;
			} else {
				sty.innerHTML = cfg.content;
			}
			head.appendChild(sty);
		} else if (cfg.url) {
			var link = document.createElement('link');
			link.href = cfg.url;
			link.rel = 'stylesheet';
			link.type = 'text/css';
			head.appendChild(link);
		}
	};

	require.alias = function(id) {
		return id.replace(/\.js$/i, '');
	};

	require.timeout = 10000;

})(this);
