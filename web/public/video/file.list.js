window.mhgl_file_list =
  window.mhgl_file_list ||
  (function () {
    var share = window.mhgl_share;
    var self = {
      clickedFile: null,
      files: window.files,
      allFiles: window.files,
      tags: window.tags,
      remove: window.remove,
      selectedTag: "",
      i: 0,

      initialize: function () {
        share.log__("mhgl_file_list.init");
        //$("body").html();
        self.showTags();
        self.bindEvents();
        self.showFiles();
        var scrollPosition = sessionStorage.getItem('scrollPosition');
        if (scrollPosition) {
          scrollPosition = JSON.parse(scrollPosition);
          window.scrollTo(scrollPosition.x, scrollPosition.y);
          sessionStorage.removeItem('scrollPosition');
        }
      },
      sortFileName: (a, b) => {
        self.i++;
        let an = self.getFileName(a);
        let bn = self.getFileName(b);
        let res = an > bn ? 1 : -1;
        console.log(self.i + ":" + res);
        console.log(an);
        console.log(bn);
        return res;
      },
      showFiles: function () {
        self.files = self.allFiles;
        if (self.selectedTag != "") {
          self.files = Object.keys(self.tags[self.selectedTag]).map(function (item, index) {
            return {
              name: item,
              script: true
            };
          });
        }

        self.files.map(function (item, index) {
          item.name = item.name.replace(/'/g, "\\'");
          return item;
        });

        self.files = self.files.sort(self.sortFileName);
        var temp = $("#templateFile").html();
        $("#files").html(self.files.map(function (item, index) {
          var html = temp.replace(/#id#/g, index);
          html = html.replace(/#fileName#/g, self.getFileName(item));
          html = html.replace(/#scriptHide#/g, (item.script || self.remove == null) ? "hide" : "");
          html = html.replace(/#actionHide#/g, (self.remove == null) ? "hide" : "");
          html = html.replace(/#orig#/g, "原链");
          return html;
        }).join(""));

        $(".itemFileName").on("click", self.itemFileNameClicked);
        $(".itemOrigUrl").on("click", self.itemOrigUrlClicked);
        $(".script").on("click", self.scriptClicked);
        $(".fileAction").on("click", self.fileActionClicked);
      },
      itemFileNameClicked: function (e) {
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        var fileName = self.files[id].name;
        toPlayer(fileName);
      },
      scriptClicked: function (e) {
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        var fileName = self.files[id].name;
        toStt(fileName);
      },
      itemOrigUrlClicked: function (e) {
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        var fileName = self.files[id].name;
        var s = fileName.split(".");
        var id = s[0];
        toYoutube(id);
      },
      fileActionClicked: function (e) {
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        var fileName = self.files[id].name;
        self.moreAction(fileName);
      },
      tagClicked: function (e) {
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        self.selectedTag = id;
        self.showFiles();
      },
      getFileName: function (file) {
        var fileName = file.name;
        if (fileName == null) {
          fileName = file;
        }
        var s = fileName.split(".");
        var id = s[0];
        var name = fileName;
        if (s.length > 2 && id.length == 11) {
          name = fileName.substring(id.length + 1);
        }
        return name;
      },
      showTags: function () {
        var temp = $("#templateTag").html();
        $("#tags").html(Object.keys(self.tags).map(function (item, index) {
          var html = temp.replace(/#tag#/g, item);
          html = html.replace(/#id#/g, item);
          return html;
        }).join(""));

        $(".itemTag").on("click", self.tagClicked);
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

