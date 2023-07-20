window.mhgl_file_list =
  window.mhgl_file_list ||
  (function () {
    var share = window.mhgl_share;
    var self = {
      initialize: function () {
        share.log__("mhgl_file_list.init");
        this.bindEvents();
      },
      toDelete:function(fn){
        if (confirm('确定要删除该文件吗？')) {
          deleteFile(fn);
        }
      }
    };

    $(function () {
      self.initialize();
    });

    return self;
  })();


// 在页面加载前，将滚动位置保存到会话存储中
function refresh() {
  sessionStorage.setItem('scrollPosition', JSON.stringify({
    x: window.scrollX || window.pageXOffset,
    y: window.scrollY || window.pageYOffset
  }));

  window.location.reload(); // 删除成功后刷新页面
}

// 在页面加载后，如果会话存储中存在滚动位置，则将页面滚动到该位置
window.addEventListener('load', function () {
  var scrollPosition = sessionStorage.getItem('scrollPosition');
  if (scrollPosition) {
    scrollPosition = JSON.parse(scrollPosition);
    window.scrollTo(scrollPosition.x, scrollPosition.y);
    sessionStorage.removeItem('scrollPosition');
  }
});

function confirmDelete(fileName) {
  if (confirm('确定要删除该文件吗？')) {
    deleteFile(fileName);
  }
}

function toPlayer(fileName) {
  window.open("/video/index.html?f=" + encodeURIComponent(fileName), fileName);
}

function toYoutube(id) {
  window.open("https://www.youtube.com/watch?v=" + id, id);
}

function deleteFile(fileName) {
  fetch('./delete?file=' + encodeURIComponent(fileName), { method: 'POST' }).then(response => {
    if (response.ok) {
      refresh();
    } else {
      alert('删除文件出错！');
    }
  }).catch(error => {
    console.error('删除文件出错:', error);
    alert('删除文件出错！');
  });
}

function toStt(fileName) {
  fetch('./toStt?file=' + encodeURIComponent(fileName), { method: 'POST' }).then(response => {
    if (response.ok) {
      refresh();
    } else {
      alert('加入字幕出错！');
    }
  }).catch(error => {
    alert('加入字幕出错！');
  });
}

