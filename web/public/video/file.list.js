window.mhgl_file_list =
  window.mhgl_file_list ||
  (function () {
    var share = window.mhgl_share;
    var self = {
      clickedFile: null,
      files: window.files,
      tags: window.tags,
      i: 0,

      initialize: function () {
        share.log__("mhgl_file_list.init");
        //$("body").html();
        self.showTags();
        self.bindEvents();
        self.files = window.files.sort((a, b) => {
          self.i++;
          let an = self.getFileName(a);
          let bn = self.getFileName(b);
          let res = an > bn ? 1 : -1;
          console.log(self.i + ":" + res);
          console.log(an);
          console.log(bn);
          return res;
        });
        var scrollPosition = sessionStorage.getItem('scrollPosition');
        if (scrollPosition) {
          scrollPosition = JSON.parse(scrollPosition);
          window.scrollTo(scrollPosition.x, scrollPosition.y);
          sessionStorage.removeItem('scrollPosition');
        }
      },

      getFileName: function (file) {
        var s = file.name.split(".");
        var id = s[0];
        var name = file.name;
        if (s.length > 2 && id.length == 11) {
          name = file.name.substring(id.length + 1);
        }
        return name;
      },
      showTags: function () {
        var temp = $("#templateTag").html();
        $("#tags").html(Object.keys(self.tags).map(function (item, index) {
          var html = temp.replace(/#tag#/g, item);
          return html;
        }).join(""));


        $(".itemTag").on("click", self.tagClicked);
      },
      tagClicked: function (e) {
        var tag = $(e.currentTarget).html();

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
        share.selectTag__(Object.keys(self.tags), function (tags) {
          self.tagFile(tags);
        });
      },
      tagFile: function (tags) {
        var url = "./tag";
        var files = [self.clickedFile];
        var params = {
          tags: JSON.stringify(tags),
          files: JSON.stringify(files)
        };

        var success = function (res) {
          self.tags = res.data;
          self.showTags();
        };

        var fail = function (e) {
          share.toastError__(e);
        };


        share.httpGet__(
          url,
          params,
          success,
          fail
        );
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

