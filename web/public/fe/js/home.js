window.mhgl_home = window.mhgl_home || (function () {
  var share = window.mhgl_share;
  var navbar = window.mhgl_navbar;
  var storage = window.localStorage;
  var timerSet = 0;
  var lastMessageDialog;
  var vibrateConfig = [500, 200, 500, 200, 1000];
  var self = {
    items: null,
    lastSuccessTime__: 0,
    initialize: function () {
      share.debug__("mhgl_home.init");
      this.bindEvents();  
      if (parent.mhgl_container){    
        parent.mhgl_container.historyCount = -1;
      }
      
      
    },
    bindEvents: function () {
      
    }
  };

  $(function () {
    if (share.needInit__(/home\.htm/g))
      self.initialize();
  });

  return self;
})();
