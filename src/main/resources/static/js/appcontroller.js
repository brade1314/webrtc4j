define(function (require, exports, module) {

    var $ = require('jquery');
    var adapter = require('adapter');
    var util = require('util');

    var AppController = function () {

        this.main = document.getElementById("main"); // 视频的DIV
        this.errorNoticeDiv = document.getElementById("errorNotice"); // 错误提示DIV
        this.localVideo = document.getElementById("local-video"); // 本地视频
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
        this.startTime = null;
        this.endTime = null;
        this.pc = null;
        this.socket = null; // websocket
        this.localStream = null; // 本地视频流
        this.remoteStream = null; // 远程视频流

        this.roomId = null;
        this.clientId = null;
        this.params_ = null;
        this.message = null;
        this.messageQueue_ = [];

        this.getMediaPromise_ = null;
        this.getIceServersPromise_ = null;
    };


    // 初始化
    AppController.prototype.initialize = function () {
        util.log.info("---init---");

        this.roomIdInput.value = util.randomString(9);
        this.roomId = this.roomIdInput.value;
        this.roomSelection.classList.remove('hidden');
        this.initWebRTCParams();
        this.bindListener();
        this.noticeMsg();
    }

    AppController.prototype.initWebRTCParams = function () {
    	var _this = this;
        return util.ajax('POST', "/config", false).then(function (result) {
        	_this.params_ = JSON.parse(result);
            util.log.info("init params success ...");
        }).catch(function (error) {
            util.log.error("init params error ...", error.message);
        });
    }

    AppController.prototype.bindListener = function () {
        util.setUpFullScreen();

        this.joinButton.addEventListener('click', this.connectToRoom_.bind(this), false);
        var _this = this;
        this.randomButton.addEventListener('click', function () {
            _this.roomIdInput.value = util.randomString(9);
            _this.roomId = _this.roomIdInput.value;
        }, false);
        // 双击全屏
        document.body.addEventListener('dblclick', this.fullScreen.bind(this), false);
        // 按键事件
        document.addEventListener('keyup', this.onRoomIdKeyPress.bind(this), false);
        // 关闭窗口退出
        window.onbeforeunload = this.leaveRoom.bind(this);

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
        this.connectToRoom_();
    };

    AppController.prototype.requestMediaAndIceServers_ = function() {
        this.getMediaPromise_ = this.getUserMedia();
        this.getIceServersPromise_ = this.getIceServer();
    };

    // 创建/加入房间
    AppController.prototype.connectToRoom_ = function () {
        this.roomId = this.roomIdInput.value;
        this.roomSelection.classList.add('hidden');
        this.requestMediaAndIceServers_();
        var _this = this;
        var channelPromise = this.openChannel().catch(function(error) {
            util.log.error('webSocket open error: ', error.message);
            return Promise.reject(error);
        });
        var joinPromise = this.joinRoom_().catch(function (error){
            util.log.error('join room error: ', error.message);
            return Promise.reject(error);
        });
        Promise.all([channelPromise, joinPromise]).then(function() {
            _this.socket.send(JSON.stringify({"action": "create", "roomId": _this.roomId,"clientId":_this.clientId}));
            Promise.all([this.getIceServersPromise_, this.getMediaPromise_]).then(function() {
                _this.startSignaling_();
            }).catch(function(error) {
                util.log.error('start signaling error : ',error.message);
            });
        }).catch(function (error) {
            util.log.error('channel or join room error: ', error.message);
        });

    }

    // 获取用户的媒体
    AppController.prototype.getUserMedia = function () {
    	var _this = this;
        var constraints = _this.params_.constraints;
        util.log.info("the get user media comstraints : ", constraints);
        return navigator.mediaDevices.getUserMedia(constraints).catch(function (error) {
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
                util.log.info("get user media error: ", error.message);
                return navigator.mediaDevices.getUserMedia(_constraints);
            });
        }).then(function (stream) {
        	_this.onUserMediaSuccess(stream);
            return navigator.mediaDevices.enumerateDevices();
        });
    }

    // 获取用户媒体成功
    AppController.prototype.onUserMediaSuccess = function (stream) {
        util.log.info('attach local stream : ', stream);
        this.videos.classList.add('active');

        this.localVideo.srcObject = stream;
        this.localStream = stream;
        this.localVideo.classList.add('active');
    }

    // 开始连接
    AppController.prototype.startSignaling_ = function () {
        var _this = this;
        this.createPeerConnection().then(function () {
            if (_this.localStream) {
                _this.pc.addStream(_this.localStream);
            }
            _this.initiator ?  _this.doAnswer() : _this.doCall();
        }).catch(function (error) {
            util.log.error('createOffer error :', error.message);
        });

    }

    // 开始通话
    AppController.prototype.doCall = function () {
        this.setNotice("连接中...房间号是：" + this.roomId);
        util.log.info("create offer ...");
        this.startTime = window.performance.now();
        this.pc.createOffer(this.params_.offerOptions).then(this.setLocalSdpAndNotify_.bind(this)).catch(this.createOfferAndAnswerFailure.bind(this));
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
    }

    // 打开websocket
    AppController.prototype.openChannel = function () {
        var _this = this;
        if (_this.socket) {
            util.log.info("websocket has already opened.");
            return;
        }
        return new Promise(function (resolve, reject) {
            util.log.info("open websocket");

            _this.socket = new WebSocket(_this.params_.wssUrl);
            _this.socket.onopen = function () {
                resolve();
            }.bind(_this);
            _this.socket.onmessage = _this.onChannelMessage.bind(_this);
            _this.socket.onclose = _this.onChannelClosed.bind(_this);
            _this.socket.onerror = function () {
                reject(Error('websocket error.'));
            }.bind(_this);
        });
    }

    AppController.prototype.joinRoom_ = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (!_this.roomId) {
                reject(Error('missing room id.'));
            }
            var url = "/create/" + _this.roomId + "/";
            util.ajax('POST', url, true).then(function (result) {
                var response = JSON.parse(result).msg;
                _this.roomId = response.roomId;
                _this.clientId = response.clientId;
                _this.initiator = response.initiator;
                _this.message = response.message;
                resolve(response);
            }).catch(function (error) {
                reject(Error('Failed to join the room: ' + error.message));
            });
        });
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
    	var _this = this;
        return util.ajax('POST', _this.params_.iceServerUrl, true).then(function (result) {
            var response = JSON.parse(result);
            util.log.info('ICE server request success :', response);
            var servers = _this.params_.peerConnectionConfig;
            servers.iceServers = servers.iceServers.concat(response.iceServers);
        }).catch(function (error) {
            util.log.error('ICE server request error: ', error.message);
        });
    }

    AppController.prototype.createPcClient_ = function () {
        this.pc = new RTCPeerConnection(this.params_.peerConnectionConfig, this.params_.peerConnectionConstraints);
        this.pc.onicecandidate = this.onIceCandidate.bind(this);
        this.pc.onaddstream = this.onRemoteStreamAdded.bind(this);
        this.pc.onremovestream = this.onRemoteStreamRemoved.bind(this);

    }

    // 打开连接
    AppController.prototype.createPeerConnection = function () {
    	var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.pc) {
                resolve();
                return;
            }
            if (typeof RTCPeerConnection.generateCertificate === 'function') {
                RTCPeerConnection.generateCertificate(_this.params_.certParams).then(function (cert) {
                    util.log.info('ECDSA certificate generated successfully. ', cert);
                    _this.params_.peerConnectionConfig.certificates = [cert];
                    _this.createPcClient_();
                    resolve();
                }).catch(function (error) {
                	util.log.error('ECDSA certificate generation failed.', error.message);
                    reject(error);
                });
            } else {
            	_this.createPcClient_();
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
        this.setNotice("连接中...房间号是：" + this.roomId);
        util.log.info("create answer ...");

        if (this.message && this.message.length > 0) {
            for (var i = 0, len = this.message.length; i < len; i++) {
                this.receiveSignalingMessage(this.message[i]);
            }
        }
        if (this.messageQueue_.length > 0) {
            this.drainMessageQueue_();
        }
    }

    AppController.prototype.receiveSignalingMessage = function (message) {
        var msg = JSON.parse(message);
        util.log.info("receive signaling message :",msg);
        if (!msg) {
            return;
        }
        if ((msg.type === 'answer') || (msg.type === 'offer')) {
            this.messageQueue_.unshift(msg);
        } else if (msg.type === 'candidate') {
            this.messageQueue_.push(msg);
        } else if (msg.type === 'bye') {
            this.onRemoteClose(msg);
        }
        this.drainMessageQueue_();
    };

    AppController.prototype.drainMessageQueue_ = function() {
        for (var i = 0, len = this.messageQueue_.length; i < len; i++) {
            this.processSignalingMessage_(this.messageQueue_[i]);
        }
        this.messageQueue_ = [];
    }

    AppController.prototype.processSignalingMessage_ = function(message) {
        if (message.type === 'offer'){
        	this.setRemoteSdp_(message);
            this.pc.createAnswer().then(this.setLocalSdpAndNotify_.bind(this)).catch(this.createOfferAndAnswerFailure.bind(this));
        } else if(message.type === 'answer'){
            this.setRemoteSdp_(message);
        } else if(message.type === 'candidate') {
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: message.label,
                candidate: message.candidate
            });
            this.pc.addIceCandidate(candidate);
        } else{
            util.log.info("WARNING: unexpected message: ",message);
        }
    }
    
    AppController.prototype.setRemoteSdp_ = function(message) {
    	this.pc.setRemoteDescription(new RTCSessionDescription(message))
        .then(this.onSetRemoteDescriptionSuccess_.bind(this))
        .catch(function(error){
        	util.log.error("set remote description error :",error.message);
        });
    }
    
    AppController.prototype.onSetRemoteDescriptionSuccess_ = function() {
    	  util.log.info('set remote session description success.');
    	  var remoteStreams = this.pc.getRemoteStreams();
    	  this.onRemoteSdpSet_(remoteStreams.length > 0 && remoteStreams[0].getVideoTracks().length > 0);
    };

    AppController.prototype.sendSignalingMessage_ = function(message) {
    	if (this.initiator) {
            this.sendMessage(message);
        } else {
            this.sendAjaxMessage(message);
        }
    }
    
    AppController.prototype.onRemoteSdpSet_ = function(hasRemoteVideo) {
    	if (hasRemoteVideo) {
    	    util.log.info('waiting for remote video.');
    	    this.waitForRemoteVideo();
    	} else {
    		util.log.info('no remote video stream; not waiting for media to arrive.');
    	    this.transitionToActive();
    	}
    };

    AppController.prototype.setLocalSdpAndNotify_ = function (sessionDescription) {
        util.log.info("create offer or answer success :", sessionDescription);
        this.pc.setLocalDescription(sessionDescription).then(function(){
        	util.log.info('set session description success.')
        }).catch(function(){
        	util.log.error('set session description error.')
        });
        this.sendSignalingMessage_(sessionDescription);
    }

    AppController.prototype.createOfferAndAnswerFailure = function (sessionDescription) {
        util.log.info("create offer or answer failure :", JSON.stringify(sessionDescription));
    }

    AppController.prototype.sendAjaxMessage = function(msg){
        var msg = JSON.stringify(msg);
        var _this = this;
        var url = "/message/" + _this.roomId + "/" + this.clientId + "/";
        util.ajax("POST", url, true, msg).then(function (result) {
            var data = JSON.parse(result);
            if (data.error) {
                util.log.info("message room error ...",data.error);
            }
        }).catch(function (error) {
            util.log.error("message room error ...", error.message);
        });
    }

    // websocket收到消息
    AppController.prototype.onChannelMessage = function (message) {
        var data = JSON.parse(message.data);
        // util.log.info(" websocket recevied message : ", message);
        if (data.status == 'SUCCESS' && data.msg) {
            this.receiveSignalingMessage(data.msg);
        }
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
            var message = {
                type: "candidate",
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            };
            util.log.info('start send canditate ...',message);
            this.sendSignalingMessage_(message);
        } else {
            this.endTime = window.performance.now();
            util.log.info("end of candidates , condidates take time ", (this.endTime - this.startTime).toFixed(0) + 'ms.');
        }
    }

    // 远程视频添加
    AppController.prototype.onRemoteStreamAdded = function (event) {
        util.log.info("remote stream add : ", event.stream);
        this.remoteStream = event.stream;
        this.remoteVideo.srcObject = event.stream;
        this.remoteVideo.classList.add('active');
    }

    // 远程视频移除
    AppController.prototype.onRemoteStreamRemoved = function (event) {
        util.log.info("remote stream removed : ", event);
    }

    // 远程视频关闭
    AppController.prototype.onRemoteClose = function (msg) {

        this.initiator = false;

        this.miniVideo.srcObject = null;
        this.miniVideo.classList.remove('active');
        this.remoteVideo.srcObject = null;

        this.remoteVideo.classList.remove('active');
        this.setNotice("房间 [" + this.roomId + " ]远程客户端 [ " + msg.clientId + " ]已断开！");
        this.pc ? (this.pc.close(),this.pc = null) : void 0;
        util.log.info('the client [ '+msg.clientId+' ] leave room [ '+this.roomId+' ] ...');
        this.startSignaling_();

    }

    // 等待远程视频
    AppController.prototype.waitForRemoteVideo = function () {
        // 可用下面2种方法判断
        // 1
        if (this.remoteVideo.readyState >= 2) { // 判断远程视频长度
            util.log.info('remote video started; currentTime:  ', this.remoteVideo.currentTime);
            this.transitionToActive();
        } else {
            this.remoteVideo.oncanplay = this.waitForRemoteVideo.bind(this);
        }
        // 2
        // if (this.remoteVideo.currentTime > 0) { // 判断远程视频长度
        // util.log.info('Remote video started; currentTime:
		// ',this.remoteVideo.currentTime);
        // this.transitionToActive();
        // } else {
        // setTimeout(this.waitForRemoteVideo, 100);
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
            "type": "bye",
            "roomId": this.roomId,
            "clientId": this.clientId,
            "initiator": this.initiator
        }));
        if (this.localStream) {
            if (typeof this.localStream.getTracks === 'undefined') {
                this.localStream.stop();
            } else {
                this.localStream.getTracks().forEach(function (track) {
                    track.stop();
                });
            }
            this.localStream = null;
        }
        this.pc.close();
        this.socket.close();
        this.pc = null;
        this.socket = null;
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