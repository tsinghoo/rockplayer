window.mhgl_file_list =
  window.mhgl_file_list ||
  (function () {
    var share = window.mhgl_share;
    var self = {
      clickedFile: null,
      files: window.files,
      tags: window.tags,
      initialize: function () {
        share.log__("mhgl_file_list.init");
        //$("body").html();
        $("#tags").html(self.tags.keys.join(" "));
        self.bindEvents();
      },
      toDelete: function () {
        if (confirm('确定要删除该文件吗？')) {
          deleteFile(self.clickedFile);
        }
      },
      moreAction: function (fn) {
        self.clickedFile = fn;
        var buttons = [];
        buttons.push({
          text: '删除',
          onTap: self.toDelete
        });
        buttons.push({
          text: '标签',
          onTap: self.toTag
        });

        share.showActionSheet__('请选择', buttons);
      },
      toTag: function () {
        share.closeDialog__();
        share.selectTag__(self.tags, function(tags){
          share.toastInfo__(tags.join(","));
        });
      },
      bindEvents: function () {

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

function toDelete(fileName) {
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

