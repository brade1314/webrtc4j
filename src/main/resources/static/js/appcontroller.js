define(function (require, exports, module) {

    var $ = require('jquery');
    var adapter = require('adapter');
    var util = require('util');

    var pc;
    var main; // 视频的DIV
    var errorNotice; // 错误提示DIV
    var socket; // websocket
    var localVideo; // 本地视频
    var miniVideo; // 本地小窗口
    var remoteVideo; // 远程视频
    var localStream; // 本地视频流
    var remoteStream; // 远程视频流
    var initiator = false; // 是否已经有人在等待
    var roomSelection;
    var roomIdInput;
    var randomButton;
    var joinButton;
    var videos;
    var roomLinkHref;
    var sharing;

    var started = false; // 是否开始
    var channelReady = false; // 是否打开websocket通道

    var startTime;
    var endTime;

    var PeerConnection = window.RTCPeerConnection;

    var roomId = null;
    var clientId = null;
    var params_ = null;

    // 初始化
    function initialize() {
        util.log.info("---init---");
        startTime = window.performance.now();
        main = document.getElementById("main");
        errorNotice = document.getElementById("errorNotice");
        localVideo = document.getElementById("local-video");
        miniVideo = document.getElementById("mini-video");
        remoteVideo = document.getElementById("remote-video");
        roomSelection = document.getElementById("room-selection");
        roomIdInput = document.getElementById("room-id-input");
        randomButton = document.getElementById("random-button");
        joinButton = document.getElementById("join-button");
        videos = document.getElementById("videos");
        roomLinkHref = document.getElementById("room-link-href");
        sharing = document.getElementById("sharing-div");

        var r = util.getUrlQueryParam('r');
        if (r && util.matchRandomRoomPattern(r)) {
            roomIdInput.value = r;
            randomButton.classList.add('hidden');
        } else {
            roomIdInput.value = util.randomString(9);
        }
        roomId = roomIdInput.value;
        roomSelection.classList.remove('hidden');
        initWebRTCParams().then(function () {
            openChannel();
            getIceServer();
        }).catch(function (error) {
            util.log.error("init websocket or get ice server error ...", error.message);
        });
        bindListener();
        noticeMsg();
    }

    function initWebRTCParams() {
        return util.ajax('POST', "/config", false).then(function (result) {
            params_ = JSON.parse(result);
            util.log.info("init params success ...");
        }).catch(function (error) {
            util.log.error("init params error ...", error.message);
        });
    }

    function bindListener() {
        util.setUpFullScreen();

        joinButton.addEventListener('click', joinRoom, false);

        randomButton.addEventListener('click', function () {
            roomIdInput.value = util.randomString(9);
            roomId = roomIdInput.value;
        }, false);

        document.body.addEventListener('dblclick', fullScreen, false);

        document.addEventListener('keyup', onRoomIdKeyPress, false);

    }

    function fullScreen() {
        if (util.isFullScreen()) {
            util.log.info('Exiting fullscreen.');
            document.cancelFullScreen();
        } else {
            util.log.info('Entering fullscreen.');
            document.body.requestFullScreen();
        }
    }

   function onRoomIdKeyPress(event) {
        if (event.which !== 13 || $('#join-button').disabled) {
            return;
        }
       joinRoom();
    };

    // 创建/加入房间
    function joinRoom() {
        roomId = roomIdInput.value;
        socket.send(JSON.stringify({"action": "create", "roomId": roomId}));
        roomSelection.classList.add('hidden');
        getUserMedia();
    }

    // 获取用户的媒体
    function getUserMedia() {
        var constraints = params_.constraints;
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
            onUserMediaSuccess(stream);
            return navigator.mediaDevices.enumerateDevices();
        });
    }

    // 获取用户媒体成功
    function onUserMediaSuccess(stream) {
        util.log.info('attach local stream ... ', stream);
        videos.classList.add('active');

        localVideo.srcObject = stream;
        localStream = stream;
        localVideo.classList.add('active');

        maybeStart();
    }

    // 开始连接
    function maybeStart() {
        if (!started && localStream && channelReady) {
            setNotice(params_.joinRoomUrl);
            createPeerConnection().then(function () {
                if (localStream) {
                    pc.addStream(localStream);
                }
                started = true;
                if (initiator) {
                    doCall();
                }
            }).catch(function (error) {
                util.log.error('createOffer error :',error.message);
            });

        }
    }

    // 开始通话
    function doCall() {
        setNotice("连接中...");
        util.log.info("create offer ...");
        pc.createOffer(createOfferAndAnswerSuccess, createOfferAndAnswerFailure);
    }

    // 发送信息
    function sendMessage(message) {
        var msgJson = JSON.stringify(message);
        socket.send(JSON.stringify({"action": "message", "roomId": roomId, "clientId": clientId, "message": msgJson}));

        util.log.info("send message start : ", msgJson);
    }

    // 打开websocket
    function openChannel() {
        util.log.info("open websocket");

        socket = new WebSocket(params_.wssUrl);
        socket.onopen = onChannelOpened;
        socket.onmessage = onChannelMessage;
        socket.onclose = onChannelClosed;
        socket.onerror = onChannelError;
    }

    // 设置状态
    function noticeMsg() {
        if (!initiator) {
            setNotice("请创建房间 ...");
        } else {
            setNotice("初始化 ...");
        }
    }

    function getIceServer() {
        return util.ajax('POST', params_.iceServerUrl, true).then(function (result) {
            var response = JSON.parse(result);
            util.log.info('ICE server request success :', response);
            var servers = params_.peerConnectionConfig;
            servers.iceServers = servers.iceServers.concat(response.iceServers);
        }).catch(function (error) {
            util.log.error('ICE server request error: ', error.message);
        });
    }

    function createPcClient() {
        pc = new PeerConnection(params_.peerConnectionConfig, params_.peerConnectionConstraints);
        pc.onicecandidate = onIceCandidate;
        pc.onconnecting = onSessionConnecting;
        pc.onopen = onSessionOpened;
        pc.onaddstream = onRemoteStreamAdded;
        pc.onremovestream = onRemoteStreamRemoved;

    }

    // 打开连接
    function createPeerConnection() {
        return new Promise(function(resolve, reject) {
            if (pc) {
                resolve();
                return;
            }

            if (typeof RTCPeerConnection.generateCertificate === 'function') {
                RTCPeerConnection.generateCertificate(params_.certParams).then(function (cert) {
                    util.log.info('ECDSA certificate generated successfully. ', cert);
                    params_.peerConnectionConfig.certificates = [cert];
                    createPcClient();
                    resolve();
                }).catch(function (error) {
                    reject(error);
                    util.log.error('ECDSA certificate generation failed.', error.message);
                });
            } else {
                createPcClient();
                resolve();
            }
        });

    }

    // 设置状态
    function setNotice(msg) {
        sharing.classList.add('active');
        roomLinkHref.text = msg;
        roomLinkHref.href = msg;
    }

    // 响应
    function doAnswer() {
        setNotice("连接中...");
        pc.createAnswer(createOfferAndAnswerSuccess, createOfferAndAnswerFailure);
    }


    function createOfferAndAnswerFailure(sessionDescription) {
        util.log.info("createOfferAndAnswerFailure -> :", JSON.stringify(sessionDescription));
    }

    function createOfferAndAnswerSuccess(sessionDescription) {
        util.log.info("createOfferAndAnswerSuccess -> :", JSON.stringify(sessionDescription));
        pc.setLocalDescription(sessionDescription);
        sendMessage(sessionDescription);
    }

    // websocket打开
    function onChannelOpened() {
        util.log.info("websocket has opened ... ");
        channelReady = true;
    }

    // websocket收到消息
    function onChannelMessage(message) {
        util.log.info("---websocket recevied message--- : " + message.data);
        var data = JSON.parse(message.data);
        if (data.action == 'create') {
            roomId = data.roomId;
            clientId = data.clientId;
            initiator = data.initiator;
            params_.joinRoomUrl = data.joinRoomUrl;
        }
        // if (initiator && data.message) {
        if (data.message) {
            processSignalingMessage(data.message);// 建立视频连接
        }
    }

    // 处理消息
    function processSignalingMessage(message) {
        var msg = JSON.parse(message);

        if (msg.type === "offer") {
            pc.setRemoteDescription(new RTCSessionDescription(msg));
            doAnswer();
        } else if (msg.type === "answer" && started) {
            pc.setRemoteDescription(new RTCSessionDescription(msg));
        } else if (msg.type === "candidate" && started) {
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: msg.label,
                candidate: msg.candidate
            });
            pc.addIceCandidate(candidate);
        } else if (msg.type === "bye" && started) {
            onRemoteClose();
        }
    }

    // websocket异常
    function onChannelError(event) {
        util.log.info("websocket异常 : ", event);
    }

    // websocket关闭
    function onChannelClosed() {
        util.log.info("websocket closed ...");

        // 断开重连
        if (socket.readyState == 3) {
            socket = new WebSocket(params_.wssUrl);
            util.log.info("websocket reconnect  ...");
        }
    }

    // 邀请聊天：这个不是很清楚，应该是对方进入聊天室响应函数
    function onIceCandidate(event) {
        if (event.candidate) {
            util.log.info('start send canditate ...');
            sendMessage({
                type: "candidate",
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        } else {
            endTime = window.performance.now();
            util.log.info("End of candidates , condidates take time ", (endTime - startTime).toFixed(0) + 'ms.');
        }
    }

    // 开始连接
    function onSessionConnecting(message) {
        util.log.info("start peer connction ...", message);
    }

    // 连接打开
    function onSessionOpened(message) {
        util.log.info("opened peer connction ...", message);
    }

    // 远程视频添加
    function onRemoteStreamAdded(event) {
        util.log.info("remote stream add : ", event.stream);

        remoteStream = event.stream;
        remoteVideo.srcObject = event.stream;
        remoteVideo.classList.add('active');
        waitForRemoteVideo();
    }

    // 远程视频移除
    function onRemoteStreamRemoved(event) {
        util.log.info("remote stream removed : ", event);
    }

    // 远程视频关闭
    function onRemoteClose() {
        started = false;
        initiator = false;

        miniVideo.srcObject = null;
        miniVideo.classList.remove('active');
        remoteVideo.srcObject = null;
        remoteVideo.classList.remove('active');

        setNotice("远程客户端已断开！");

        pc.close();
    }

    // 等待远程视频
    function waitForRemoteVideo() {
        //可用下面2种方法判断
        //1
        if (remoteVideo.readyState >= 2) { // 判断远程视频长度
            util.log.info('Remote video started; currentTime:  ',remoteVideo.currentTime);
            transitionToActive();
        } else {
            remoteVideo.oncanplay = waitForRemoteVideo;
        }
        //2
        // if (remoteVideo.currentTime > 0) { // 判断远程视频长度
        //     util.log.info('Remote video started; currentTime: ',remoteVideo.currentTime);
        //     transitionToActive();
        // } else {
        //     setTimeout(waitForRemoteVideo, 100);
        // }
    }

    // 接通远程视频
    function transitionToActive() {
        miniVideo.srcObject = localVideo.srcObject;
        miniVideo.classList.add('active');
        localVideo.srcObject = null;
        localVideo.classList.remove('active');

        setNotice("连接成功！当前房间号是： " + roomId);
    }


    function leaveRoom() {
        socket.send(JSON.stringify({
            "action": "leave",
            "roomId": roomId,
            "clientId": clientId,
            "message": JSON.stringify({"type": "bye"})
        }));
        // pc.close();
        socket.close();
    }

    // 关闭窗口退出
    window.onbeforeunload = function () {
        leaveRoom();
    }

    // 设置浏览器支持提示信息
    function errorNotice(msg) {
        errorNotice.style.display = "block";
        errorNotice.innerHTML = msg;
    }


    module.exports = {
        init: function () {
            if (!WebSocket) {
                errorNotice("你的浏览器不支持WebSocket！建议使用<a href=\"https://www.google.com/intl/zh-CN/chrome/browser/\" target=\"_blank\">google chrome浏览器！</a>");
            } else if (!PeerConnection) {
                errorNotice("你的浏览器不支持RTCPeerConnection！建议使用<a href=\"https://www.google.com/intl/zh-CN/chrome/browser/\" target=\"_blank\">google chrome浏览器！</a>");
            } else {
                initialize();
            }
        }
    }
});