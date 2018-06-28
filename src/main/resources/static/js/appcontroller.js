define(function (require, exports, module) {

    var $ = require('jquery');
    var adapter = require('adapter');
    var util = require('util');

    var AppController = function () {

        this.main = document.getElementById("main"); // 视频的DIV
        this.errorNoticeDiv = document.getElementById("errorNotice"); //错误提示DIV
        this.localVideo = document.getElementById("local-video"); //本地视频
        this.miniVideo = document.getElementById("mini-video"); // 本地小窗口
        this.remoteVideo = document.getElementById("remote-video"); // 远程视频
        this.roomSelection = document.getElementById("room-selection");
        this.roomIdInput = document.getElementById("room-id-input");
        this.randomButton = document.getElementById("random-button");
        this.joinButton = document.getElementById("join-button");
        this.videos = document.getElementById("videos");
        this.roomLinkHref = document.getElementById("room-link-href");
        this.sharing = document.getElementById("sharing-div");

        this.initiator = false; // 是否已经有人在等待
        this.started = false; // 是否开始
        this.channelReady = false; // 是否打开websocket通道
        this.startTime = window.performance.now();
        this.endTime = null;
        this.pc = null;
        this.socket = null; // websocket
        this.localStream = null; // 本地视频流
        this.remoteStream = null; // 远程视频流

        this.roomId = null;
        this.clientId = null;
        this.params_ = null;
    };


    // 初始化
    AppController.prototype.initialize = function () {
        util.log.info("---init---");

        var r = util.getUrlQueryParam('r');
        if (r && util.matchRandomRoomPattern(r)) {
            this.roomIdInput.value = r;
            this.randomButton.classList.add('hidden');
        } else {
            this.roomIdInput.value = util.randomString(9);
        }
        this.roomId = this.roomIdInput.value;
        this.roomSelection.classList.remove('hidden');
        this.initWebRTCParams().then(function () {
            this.openChannel();
            this.getIceServer();
        }).catch(function (error) {
            util.log.error("init websocket or get ice server error ...", error.message);
        });
        this.bindListener();
        this.noticeMsg();
    }

    AppController.prototype.initWebRTCParams = function () {
        return util.ajax('POST', "/config", false).then(function (result) {
            this.params_ = JSON.parse(result);
            util.log.info("init params success ...");
        }).catch(function (error) {
            util.log.error("init params error ...", error.message);
        });
    }

    AppController.prototype.bindListener = function () {
        util.setUpFullScreen();

        this.joinButton.addEventListener('click', this.joinRoom, false);
        var _this = this;
        this.randomButton.addEventListener('click', function () {
            _this.roomIdInput.value = util.randomString(9);
            _this.roomId = this.roomIdInput.value;
        }, false);
        //双击全屏
        document.body.addEventListener('dblclick', this.fullScreen, false);
        //按键事件
        document.addEventListener('keyup', this.onRoomIdKeyPress, false);
        // 关闭窗口退出
        window.onbeforeunload = this.leaveRoom;

    }

    AppController.prototype.fullScreen = function () {
        if (util.isFullScreen()) {
            util.log.info('Exiting fullscreen.');
            document.cancelFullScreen();
        } else {
            util.log.info('Entering fullscreen.');
            document.body.requestFullScreen();
        }
    }

    AppController.prototype.onRoomIdKeyPress = function (event) {
        if (event.which !== 13 || $('#join-button').disabled) {
            return;
        }
        this.joinRoom();
    };

    // 创建/加入房间
    AppController.prototype.joinRoom = function () {
        this.roomId = this.roomIdInput.value;
        this.socket.send(JSON.stringify({"action": "create", "roomId": this.roomId}));
        this.roomSelection.classList.add('hidden');
        this.getUserMedia();
    }

    // 获取用户的媒体
    AppController.prototype.getUserMedia = function () {
        var constraints = this.params_.constraints;
        util.log.info("the get user media comstraints : ", constraints);
        navigator.mediaDevices.getUserMedia(constraints).catch(function (error) {
            return navigator.mediaDevices.enumerateDevices().then(function (devices) {
                var cam = devices.find(function (device) {
                    return device.kind === 'videoinput';
                });
                var mic = devices.find(function (device) {
                    return device.kind === 'audioinput';
                });
                var _constraints = {
                    video: cam && constraints.video,
                    audio: mic && constraints.audio
                };
                util.log.info("getUserMedia error: ", error.message);
                return navigator.mediaDevices.getUserMedia(_constraints);
            });
        }).then(function (stream) {
            this.onUserMediaSuccess(stream);
            return navigator.mediaDevices.enumerateDevices();
        });
    }

    // 获取用户媒体成功
    AppController.prototype.onUserMediaSuccess = function (stream) {
        util.log.info('attach local stream ... ', stream);
        this.videos.classList.add('active');

        this.localVideo.srcObject = stream;
        this.localStream = stream;
        this.localVideo.classList.add('active');

        this.maybeStart();
    }

    // 开始连接
    AppController.prototype.maybeStart = function () {
        if (!this.started && this.localStream && this.channelReady) {
            this.setNotice(this.params_.joinRoomUrl);
            this.createPeerConnection().then(function () {
                if (this.localStream) {
                    this.pc.addStream(localStream);
                }
                this.started = true;
                if (this.initiator) {
                    this.doCall();
                }
            }).catch(function (error) {
                util.log.error('createOffer error :', error.message);
            });

        }
    }

    // 开始通话
    AppController.prototype.doCall = function () {
        this.setNotice("连接中...");
        util.log.info("create offer ...");
        this.pc.createOffer(this.createOfferAndAnswerSuccess, this.createOfferAndAnswerFailure);
    }

    // 发送信息
    AppController.prototype.sendMessage = function (message) {
        var msgJson = JSON.stringify(message);
        this.socket.send(JSON.stringify({
            "action": "message",
            "roomId": this.roomId,
            "clientId": this.clientId,
            "message": msgJson
        }));

        util.log.info("send message start : ", msgJson);
    }

    // 打开websocket
    AppController.prototype.openChannel = function () {
        util.log.info("open websocket");

        this.socket = new WebSocket(this.params_.wssUrl);
        this.socket.onopen = this.onChannelOpened;
        this.socket.onmessage = this.onChannelMessage;
        this.socket.onclose = this.onChannelClosed;
        this.socket.onerror = this.onChannelError;
    }

    // 设置状态
    AppController.prototype.noticeMsg = function () {
        if (!this.initiator) {
            this.setNotice("请创建房间 ...");
        } else {
            this.setNotice("初始化 ...");
        }
    }

    AppController.prototype.getIceServer = function () {
        return util.ajax('POST', this.params_.iceServerUrl, true).then(function (result) {
            var response = JSON.parse(result);
            util.log.info('ICE server request success :', response);
            var servers = this.params_.peerConnectionConfig;
            servers.iceServers = servers.iceServers.concat(response.iceServers);
        }).catch(function (error) {
            util.log.error('ICE server request error: ', error.message);
        });
    }

    AppController.prototype.createPcClient = function () {
        this.pc = new PeerConnection(this.params_.peerConnectionConfig, this.params_.peerConnectionConstraints);
        this.pc.onicecandidate = this.onIceCandidate;
        this.pc.onconnecting = this.onSessionConnecting;
        this.pc.onopen = this.onSessionOpened;
        this.pc.onaddstream = this.onRemoteStreamAdded;
        this.pc.onremovestream = this.onRemoteStreamRemoved;

    }

    // 打开连接
    AppController.prototype.createPeerConnection = function () {
        return new Promise(function (resolve, reject) {
            if (this.pc) {
                resolve();
                return;
            }

            if (typeof RTCPeerConnection.generateCertificate === 'function') {
                RTCPeerConnection.generateCertificate(this.params_.certParams).then(function (cert) {
                    util.log.info('ECDSA certificate generated successfully. ', cert);
                    this.params_.peerConnectionConfig.certificates = [cert];
                    this.createPcClient();
                    resolve();
                }).catch(function (error) {
                    reject(error);
                    util.log.error('ECDSA certificate generation failed.', error.message);
                });
            } else {
                this.createPcClient();
                resolve();
            }
        });

    }

    // 设置状态
    AppController.prototype.setNotice = function (msg) {
        this.sharing.classList.add('active');
        this.roomLinkHref.text = msg;
        this.roomLinkHref.href = msg;
    }

    // 响应
    AppController.prototype.doAnswer = function () {
        this.setNotice("连接中...");
        this.pc.createAnswer(this.createOfferAndAnswerSuccess, this.createOfferAndAnswerFailure);
    }


    AppController.prototype.createOfferAndAnswerFailure = function (sessionDescription) {
        util.log.info("createOfferAndAnswerFailure -> :", JSON.stringify(sessionDescription));
    }

    AppController.prototype.createOfferAndAnswerSuccess = function (sessionDescription) {
        util.log.info("createOfferAndAnswerSuccess -> :", JSON.stringify(sessionDescription));
        this.pc.setLocalDescription(sessionDescription);
        this.sendMessage(sessionDescription);
    }

    // websocket打开
    AppController.prototype.onChannelOpened = function () {
        util.log.info("websocket has opened ... ");
        this.channelReady = true;
    }

    // websocket收到消息
    AppController.prototype.onChannelMessage = function (message) {
        util.log.info("---websocket recevied message--- : " + message.data);
        var data = JSON.parse(message.data);
        if (data.action == 'create') {
            this.roomId = data.roomId;
            this.clientId = data.clientId;
            this.initiator = data.initiator;
            this.params_.joinRoomUrl = data.joinRoomUrl;
        }
        // if (initiator && data.message) {
        if (data.message) {
            this.processSignalingMessage(data.message);// 建立视频连接
        }
    }

    // 处理消息
    AppController.prototype.processSignalingMessage = function (message) {
        var msg = JSON.parse(message);

        if (msg.type === "offer") {
            this.pc.setRemoteDescription(new RTCSessionDescription(msg));
            this.doAnswer();
        } else if (msg.type === "answer" && this.started) {
            this.pc.setRemoteDescription(new RTCSessionDescription(msg));
        } else if (msg.type === "candidate" && this.started) {
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: msg.label,
                candidate: msg.candidate
            });
            this.pc.addIceCandidate(candidate);
        } else if (msg.type === "bye" && this.started) {
            this.onRemoteClose();
        }
    }

    // websocket异常
    AppController.prototype.onChannelError = function (event) {
        util.log.info("websocket异常 : ", event);
    }

    // websocket关闭
    AppController.prototype.onChannelClosed = function () {
        util.log.info("websocket closed ...");

        // 断开重连
        if (this.socket.readyState == 3) {
            this.socket = new WebSocket(this.params_.wssUrl);
            util.log.info("websocket reconnect  ...");
        }
    }

    // 邀请聊天：对方进入聊天室响应函数
    AppController.prototype.onIceCandidate = function (event) {
        if (event.candidate) {
            util.log.info('start send canditate ...');
            this.sendMessage({
                type: "candidate",
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
            this.endTime = window.performance.now();
            util.log.info("End of candidates , condidates take time ", (this.endTime - this.startTime).toFixed(0) + 'ms.');
        }
    }

    // 开始连接
    AppController.prototype.onSessionConnecting = function (message) {
        util.log.info("start peer connction ...", message);
    }

    // 连接打开
    AppController.prototype.onSessionOpened = function (message) {
        util.log.info("opened peer connction ...", message);
    }

    // 远程视频添加
    AppController.prototype.onRemoteStreamAdded = function (event) {
        util.log.info("remote stream add : ", event.stream);

        this.remoteStream = event.stream;
        this.remoteVideo.srcObject = event.stream;
        this.remoteVideo.classList.add('active');
        this.waitForRemoteVideo();
    }

    // 远程视频移除
    AppController.prototype.onRemoteStreamRemoved = function (event) {
        util.log.info("remote stream removed : ", event);
    }

    // 远程视频关闭
    AppController.prototype.onRemoteClose = function () {
        this.started = false;
        this.initiator = false;

        this.miniVideo.srcObject = null;
        this.miniVideo.classList.remove('active');
        this.remoteVideo.srcObject = null;
        this.remoteVideo.classList.remove('active');

        this.setNotice("远程客户端已断开！");

        this.pc.close();
    }

    // 等待远程视频
    AppController.prototype.waitForRemoteVideo = function () {
        //可用下面2种方法判断
        //1
        if (this.remoteVideo.readyState >= 2) { // 判断远程视频长度
            util.log.info('Remote video started; currentTime:  ', this.remoteVideo.currentTime);
            this.transitionToActive();
        } else {
            this.remoteVideo.oncanplay = this.waitForRemoteVideo;
        }
        //2
        // if (this.remoteVideo.currentTime > 0) { // 判断远程视频长度
        //     util.log.info('Remote video started; currentTime: ',this.remoteVideo.currentTime);
        //     this.transitionToActive();
        // } else {
        //     setTimeout(this.waitForRemoteVideo, 100);
        // }
    }

    // 接通远程视频
    AppController.prototype.transitionToActive = function () {
        this.miniVideo.srcObject = this.localVideo.srcObject;
        this.miniVideo.classList.add('active');
        this.localVideo.srcObject = null;
        this.localVideo.classList.remove('active');

        this.setNotice("连接成功！当前房间号是： " + this.roomId);
    }


    AppController.prototype.leaveRoom = function () {
        this.socket.send(JSON.stringify({
            "action": "leave",
            "roomId": this.roomId,
            "clientId": this.clientId,
            "message": JSON.stringify({"type": "bye"})
        }));
        // pc.close();
        this.socket.close();
    }

    // 设置浏览器支持提示信息
    AppController.prototype.errorNotice = function (msg) {
        this.errorNoticeDiv.style.display = "block";
        this.errorNoticeDiv.innerHTML = msg;
    }


    module.exports = {
        init: function () {
            var app = new AppController();
            if (!WebSocket) {
                app.errorNotice("你的浏览器不支持WebSocket！建议使用<a href=\"https://www.google.com/intl/zh-CN/chrome/browser/\" target=\"_blank\">google chrome浏览器！</a>");
            } else if (!window.RTCPeerConnection) {
                app.errorNotice("你的浏览器不支持RTCPeerConnection！建议使用<a href=\"https://www.google.com/intl/zh-CN/chrome/browser/\" target=\"_blank\">google chrome浏览器！</a>");
            } else {
                app.initialize();
            }
        }
    }
});