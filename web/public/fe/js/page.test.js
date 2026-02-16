window.mhgl_page_test =
  window.mhgl_page_test ||
  (function () {
    var share = window.mhgl_share;
    var mhgl_page = window.mhgl_page;
    var storage = window.localStorage;
    var key = "toRemind";
    var timerSet = 0;
    var item;
    var lastMessageDialog;

    var vibrateConfig = [500, 200, 500, 200, 1000];
    var self = {
      items: null,
      interval: 10,
      lastSuccessTime__: 0,
      vibrateTimes: [],
      lastEnterTime__: Number.MAX_VALUE,
      initialize: function () {
        share.debug__("mhgl_page_test.init");
        this.bindEvents();
        if (share.user__ == null) {
          share.toLogin__();
          return;
        }

        self.load__();
      },

      load__: function () {
        $("#timer").val(share.user__.timer);
      },

      startRecord: function () {
        this.media = new Media(this.filePath, () => {
          alert('录音完毕！');
        }, (err) => {
          alert('录音失败：' + JSON.stringify(err));
        });
        //开始录音
        this.media.startRecord();
      },

      // 暂停录音按钮点击
      pauseRecord: function () {
        this.media.pauseRecord();
      },

      startCompass: function () {
        var options = {
          frequency: 5000
        };
        parent.navigator.compass.watchHeading(self.compassChanged, self.compassError, options);
      },

      compassChanged: function (heading) {
        $("#compass").html(JSON.stringify(heading, "", 2));
      },

      startGyroscope: function () {
        var options = {
          frequency: 5000
        };
        parent.navigator.gyroscope.watch(self.gyroscopeChanged, self.gyroscopeError, options);
      },

      gyroscopeChanged: function (heading) {
        $("#gyroscope").html(JSON.stringify(heading, " ", 2));
      },

      startOrientation: function () {
        window.addEventListener('deviceorientation', self.deviceOrientationChanged, false);
      },

      stopOrientation: function () {
        window.removeEventListener('deviceorientation', self.deviceOrientationChanged, false);
        self.vibrateTimes.push(new Date().getTime());
        let html = "";
        for (var i = 0; i < self.vibrateTimes.length; ++i) {
          let sep = "";
          if (i > 0) {
            sep = (self.vibrateTimes[i] - self.vibrateTimes[i - 1]) / 1000;
            if (sep > (self.interval + 2)) {
              html += share.timeFormat__(self.vibrateTimes[i], "MM-dd hh:mm:ss");
              sep = share.getDurationText__(sep);
              html += " " + sep + "<br>";
            }
          }
        }

        $("#times").html(html);
      },

      generateSVG: function (diameter, characters) {
        const radius = diameter / 2;
        const circumference = Math.PI * diameter;
        const charSpacing = circumference / characters.length;

        let charElements = '';
        for (let i = 0; i < characters.length; i++) {
          const charAngle = i * charSpacing;
          const x = radius + (Math.sin(charAngle) * radius);
          const y = radius - (Math.cos(charAngle) * radius);
          const charElem = `<text x="${x}" y="${y}">${characters[i]}</text>`;
          charElements += charElem;
        }

        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}">
            <circle cx="${radius}" cy="${radius}" r="${radius}" stroke="black" fill="none" />
            ${charElements}
          </svg>
        `;

        return svg;
      },

      deviceOrientationChanged: function (e) {
        $("#orientation").html(JSON.stringify(e, ["alpha", "beta", "gamma"], 2).split("\n").join("<br>"));

        if ((e.beta > -30 && e.beta <= 30) && (e.gamma > -30 && e.gamma <= 30)) {
          if (self.lastEnterTime__ == Number.MAX_VALUE) {
            self.lastEnterTime__ = new Date().getTime();
          }
        } else {
          self.lastEnterTime__ = Number.MAX_VALUE;
        }

        let now = new Date().getTime();
        if (now - self.lastEnterTime__ > self.interval * 1000) {
          parent.mhgl_share.vibrate__(500);
          self.vibrateTimes.push(new Date().getTime());
          self.lastEnterTime__ = Number.MAX_VALUE;
        }
      },

      // 继续录音按钮点击
      resumeRecord: function () {
        this.media.resumeRecord();
      },

      // 结束录音按钮点击
      stopRecord: function () {
        this.media.stopRecord();
      },

      // 开始播放按钮点击
      startPlay: function () {
        this.media = new Media(this.filePath, () => {
          alert('播放完毕！');
        }, (err) => {
          alert('播放失败：' + JSON.stringify(err));
        });
        //开始录音
        this.media.play();
      },

      // 暂停播放按钮点击
      pausePlay: function () {
        this.media.pause();
      },

      // 继续播放按钮点击
      resumePlay: function () {
        this.media.play();
      },

      // 结束播放按钮点击
      stopPlay: function () {
        this.media.stop();
      },

      toReply__: function () {
        var rec;
        /**调用open打开录音请求好录音权限**/
        var recOpen = function (success) {//一般在显示出录音按钮或相关的录音界面时进行此方法调用，后面用户点击开始录音时就能畅通无阻了
          rec = Recorder({ //本配置参数请参考下面的文档，有详细介绍
            type: "mp3", sampleRate: 16000, bitRate: 16 //mp3格式，指定采样率hz、比特率kbps，其他参数使用默认配置；注意：是数字的参数必须提供数字，不要用字符串；需要使用的type类型，需提前把格式支持文件加载进来，比如使用wav格式需要提前加载wav.js编码引擎
            , onProcess: function (buffers, powerLevel, bufferDuration, bufferSampleRate, newBufferIdx, asyncEnd) {
              //录音实时回调，大约1秒调用12次本回调
              //可实时绘制波形（extensions目录内的waveview.js、wavesurfer.view.js、frequency.histogram.view.js扩展功能）
              //可利用extensions/sonic.js扩展实时变速变调，此扩展计算量巨大，onProcess需要返回true开启异步模式
              //可实时上传（发送）数据，配合Recorder.SampleData方法，将buffers中的新数据连续的转换成pcm上传，或使用mock方法将新数据连续的转码成其他格式上传，可以参考文档里面的：Demo片段列表 -> 实时转码并上传-通用版；基于本功能可以做到：实时转发数据、实时保存数据、实时语音识别（ASR）等
            }
          });

          //var dialog=createDelayDialog(); 我们可以选择性的弹一个对话框：为了防止移动端浏览器存在第三种情况：用户忽略，并且（或者国产系统UC系）浏览器没有任何回调，此处demo省略了弹窗的代码
          rec.open(function () {//打开麦克风授权获得相关资源
            //dialog&&dialog.Cancel(); 如果开启了弹框，此处需要取消
            //rec.start() 此处可以立即开始录音，但不建议这样编写，因为open是一个延迟漫长的操作，通过两次用户操作来分别调用open和start是推荐的最佳流程

            success && success();
          }, function (msg, isUserNotAllow) {//用户拒绝未授权或不支持
            //dialog&&dialog.Cancel(); 如果开启了弹框，此处需要取消
            share.error__((isUserNotAllow ? "UserNotAllow，" : "") + "无法录音:" + msg);
          });
        };

        /**开始录音**/
        function recStart() {//打开了录音后才能进行start、stop调用
          rec.start();
        };

        /**结束录音**/
        function recStop() {
          rec.stop(function (blob, duration) {
            share.debug__(blob, (window.URL || webkitURL).createObjectURL(blob), "时长:" + duration + "ms");
            rec.close();//释放录音资源，当然可以不释放，后面可以连续调用start；但不释放时系统或浏览器会一直提示在录音，最佳操作是录完就close掉
            rec = null;

            //已经拿到blob文件对象想干嘛就干嘛：立即播放、上传

            /*** 【立即播放例子】 ***/
            var audio = document.createElement("audio");
            audio.controls = true;
            document.body.appendChild(audio);
            //简单利用URL生成播放地址，注意不用了时需要revokeObjectURL，否则霸占内存
            audio.src = (window.URL || webkitURL).createObjectURL(blob);
            audio.play();
          }, function (msg) {
            share.error__("录音失败:" + msg);
            rec.close();//可以通过stop方法的第3个参数来自动调用close
            rec = null;
          });
        };


        //我们可以选择性的弹一个对话框：为了防止移动端浏览器存在第三种情况：用户忽略，并且（或者国产系统UC系）浏览器没有任何回调
        /*伪代码：
        function createDelayDialog(){
            if(Is Mobile){//只针对移动端
                return new Alert Dialog Component
                    .Message("录音功能需要麦克风权限，请允许；如果未看到任何请求，请点击忽略~")
                    .Button("忽略")
                    .OnClick(function(){//明确是用户点击的按钮，此时代表浏览器没有发起任何权限请求
                        //此处执行fail逻辑
                        share.debug__("无法录音：权限请求被忽略");
                    })
                    .OnCancel(NOOP)//自动取消的对话框不需要任何处理
                    .Delay(8000); //延迟8秒显示，这么久还没有操作基本可以判定浏览器有毛病
            };
        };
        */


        //这里假设立即运行，只录3秒，录完后立即播放，本段代码copy到控制台内可直接运行
        recOpen(function () {
          recStart();
          setTimeout(recStop, 3000);
        });
      },
      toMailSend__: function (action, to) {
        self.item.action = action;
        if (to) {
          self.item.mailTo = to;
        }
        share.setCache__("mail.send", self.item);
        share.open__("./mail.send.htm");
      },

      toChat__: function (email) {
        share.todo__();
      },

      toDownload__: function (index) {
        var params = self.item;
        params.indexClicked = index;
        share.confirm__(share.getString__("confirmToDownloadAndOpen","该附件尚未下载，确定要下载并打开吗?"), function (confirmed) {
          if (confirmed) {
            var fail = function (err) {
              share.toastError__(err);
            };

            var succ = function (att) {
              if (att.filePath) {
                if (parent.electron) {
                  var shell = parent.electron.shell;
                  if (shell.openItem != null) {
                    shell.openItem(att.filePath);
                  } else {
                    shell.openPath(att.filePath);
                  }
                }
              } else {
                share.callNodejs__({
                  func: "downloadAttachment",
                  params: params
                }, succ, fail);
              }
            };

            share.callNodejs__({
              func: "downloadAttachment",
              params: params
            }, succ, fail);
          }
        });
      },
      // Bind Event Listeners
      //
      // Bind any events self are required on startup. Common events are:
      // 'load', 'deviceready', 'offline', and 'online'.
      bindEvents: function () {
        share.onClick__($("#updateTimer"), self.updateTimerClicked__);
      },

      updateTimerClicked__: function (e) {
        share.user__.timer = $("#timer").val();
        share.saveAccount__(share.user__);
        parent.mhgl_share.loadTimer__();
      }
    };

    $(function () {
      if (share.needInit__(/page.test\.htm/g)) self.initialize();
    });

    return self;
  })();
