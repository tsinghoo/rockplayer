window.mhgl_file_list =
  window.mhgl_file_list ||
  (function () {
    var share = window.mhgl_share;
    var self = {
      clickedFile: null,
      files: null,
      allFiles: {},
      tags: window.tags,
      remove: window.remove,
      selectedTag: "未标",
      i: 0,
      checkedFiles: {},
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
        return res;
      },
      showRecentFiles: function () {
        var url = "./metadata";
        var params = {
          fileName: ""
        };

        var success = function (res) {
          share.closeDialog__();
          self.metadata = res.data;
          self.files = [];
          Object.keys(self.metadata).map((fn, i) => {
            var file = self.allFiles[fn];
            if (file != null) {
              if (self.metadata[fn] != null) {
                file.lastUpdateTime = self.metadata[fn].lastUpdateTime;
              }

              self.files.push(file);
            }
            return file ? file : self.metadata[fn];
          });

          self.doShowFiles(function (a, b) {
            if (a == null || b == null) {
              return -1;
            }
            let res = a.lastUpdateTime < b.lastUpdateTime ? 1 : -1;
            return res;
          });
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
      showFiles: function () {
        self.files = [];
        if (self.selectedTag == "最近") {

          self.showRecentFiles();
          return;
        } else if (self.selectedTag == "未标") {
          var k = Object.keys(self.allFiles);
          for (var i = 0; i < k.length; ++i) {
            if (Object.keys(self.allFiles[k[i]].tags).length == 0) {
              self.files.push(self.allFiles[k[i]]);
            }
          }
        } else if (self.selectedTag == "所有") {
          var k = Object.keys(self.allFiles);
          for (var i = 0; i < k.length; ++i) {
            self.files.push(self.allFiles[k[i]]);
          }
        } else {
          self.files = Object.keys(self.tags[self.selectedTag]).map(function (e, i) {
            return self.allFiles[e];
          });
        }

        self.doShowFiles();
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
      checkFileClicked: function (e) {
        var id = e.currentTarget.id;
        var index = id.split("_")[1];
        var fileName = self.files[index].name;
        if ($('#' + id).prop('checked')) {
          self.checkedFiles[fileName] = 1;
        } else {
          delete self.checkedFiles[fileName];
        }
      },
      tagClicked: function (e) {
        var id = e.currentTarget.id;
        id = id.split("_")[1];
        self.selectedTag = id;
        self.showTags();
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
        name = share.shrinkString__(name, 40);
        return name;
      },
      showTags: function () {
        window.files.map(function (e, i) {
          self.allFiles[e.name] = e;
          e.tags = {};
        });

        Object.keys(self.tags).map(function (tag) {
          Object.keys(self.tags[tag]).map(function (fn) {
            var f = self.allFiles[fn];
            if (f == null) {
              delete self.tags[tag][fn];
            } else {
              f.tags[tag] = 1;
            }
          });
        });

        var temp = $("#templateTag").html();
        var tags = Object.keys(self.tags);
        tags.unshift("未标");
        tags.unshift("所有");
        tags.unshift("最近");
        $("#tags").html(tags.map(function (tag, index) {
          var html = temp.replace(/#tag#/g, tag);
          html = html.replace(/#id#/g, tag);
          if (tag == self.selectedTag) {
            html = html.replace(/#selected#/g, "selected");
          } else {
            html = html.replace(/#selected#/g, "");
          }
          return html;
        }).join(""));

        $(".itemTag").on("click", self.tagClicked);
      },
      toDelete: function () {
        if (confirm('确定要删除该文件吗？')) {
          self.deleteFile(self.clickedFile);
        }
      },
      toSplit: function () {
        if (confirm('确定要切分该文件吗？')) {
          splitFile(self.clickedFile);
        }
      },
      moreAction: function (fn) {
        self.clickedFile = fn;
        if (Object.keys(self.checkedFiles).length > 0) {
          if (self.checkedFiles[self.clickedFile]) {
          } else {
            return;
          }
        }
        var buttons = [];
        buttons.push({
          text: '删除',
          onTap: self.toDelete
        });
        buttons.push({
          text: '切分',
          onTap: self.toSplit
        });
        buttons.push({
          text: '标签',
          onTap: self.toTag
        });

        Object.keys(self.tags).forEach((tag, i) => {
          buttons.push({
            text: tag,
            onTap: function (e) {
              self.tagFile([tag]);
            }
          })
        });

        share.showActionSheet__('请选择', buttons);
      },
      doShowFiles: function (sf) {
        self.files.map(function (item, index) {
          item.name = item.name.replace(/'/g, "\\'");
          return item;
        });

        if (sf == null) {
          sf = self.sortFileName;
        }

        self.files = self.files.sort(sf);
        var temp = $("#templateFile").html();
        $("#files").html(self.files.map(function (item, index) {
          if (Object.keys(item.tags).length > 0 && self.selectedTag == "") {
            return "";
          } else {
            var html = temp.replace(/#id#/g, index);
            html = html.replace(/#fileName#/g, self.getFileName(item));
            html = html.replace(/#scriptHide#/g, (item.script || self.remove == null) ? "hide" : "");
            html = html.replace(/#actionHide#/g, (self.remove == null) ? "hide" : "");
            html = html.replace(/#orig#/g, "原链");
            return html;
          }
        }).join(""));

        $(".itemFileName").on("click", self.itemFileNameClicked);
        $(".itemOrigUrl").on("click", self.itemOrigUrlClicked);
        $(".script").on("click", self.scriptClicked);
        $(".fileAction").on("click", self.fileActionClicked);
        $(".checkFile").on("click", self.checkFileClicked);
        self.checkedFiles = {};
      },
      deleteFile: function (fileName) {
        var files = self.checkedFiles;

        var url = "./delete";
        var params = {
          files: JSON.stringify(Object.keys(files)),
          remove: window.remove
        };
        share.httpPost__(
          url,
          params,
          function (response) {
            if (response.ok) {
              refresh();
            } else {
              alert('删除文件出错！');
            }
          },
          share.toastError__
        );
      },
      toTag: function () {
        share.closeDialog__();

        var otags = Object.keys(self.allFiles[self.clickedFile].tags);


        share.selectTag__(Object.keys(self.tags), otags, function (tags) {
          self.tagFile(tags);
        });
      },
      tagFile: function (tags) {
        var url = "./tag";
        var files = [self.clickedFile];
        if (Object.keys(self.checkedFiles).length > 0) {
          files = Object.keys(self.checkedFiles);
        }
        var params = {
          tags: JSON.stringify(tags),
          files: JSON.stringify(files)
        };

        var success = function (res) {
          share.closeDialog__();
          self.tags = res.data;
          self.showTags();
          self.showFiles();
        };

        var fail = function (e) {
          share.toastError__(e);
        };


        share.httpPost__(
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

function toStt(fileName) {
  fetch('./toStt?file=' + encodeURIComponent(fileName), { method: 'POST' }).then(response => {
    if (response.ok) {
      //refresh();
    } else {
      alert('加入字幕出错！');
    }
  }).catch(error => {
    alert('加入字幕出错！');
  });
}
function splitFile(fileName) {
  fetch('./toSplit?file=' + encodeURIComponent(fileName), { method: 'POST' }).then(response => {
    if (response.ok) {
      mhgl_share.closeDialog__();
    } else {
      alert('加入分割队列出错！');
    }
  }).catch(error => {
    alert('加入分割队列出错！');
  });
}

