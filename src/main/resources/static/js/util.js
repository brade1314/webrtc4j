define(function (require, exports, module) {

    module.exports = {

        /**
         * random string , if length is null ,user default 8
         * @param strLength
         * @returns {string}
         */
        randomString: function (strLength) {
            var result = [];
            strLength = strLength || 8;
            var charSet = '0123456789';
            while (strLength--) {
                result.push(charSet.charAt(Math.floor(Math.random() * charSet.length)));
            }
            return result.join('');
        },

        /**
         * get current url query param
         * @param name
         * @returns {*}
         */
        getUrlQueryParam: function (name) {
            return this.queryStringToDictionary()[name];
        },

        queryStringToDictionary: function () {
            var queryString = window.location.search;
            var pairs = queryString.slice(1).split('&');

            var result = {};
            pairs.forEach(function (pair) {
                if (pair) {
                    pair = pair.split('=');
                    if (pair[0]) {
                        result[pair[0]] = decodeURIComponent(pair[1] || '');
                    }
                }
            });
            return result;
        },

        /**
         *
         */
        log: {
            info: function (msg,data) {
                if(typeof data == 'undefined'){
                    data ='';
                }
                if (msg[msg.length - 1] === '\n') {
                    msg = msg.substring(0, msg.length - 1);
                }
                if (window.performance) {
                    var now = (window.performance.now() / 1000).toFixed(3);
                    console.log(now + ': ' + msg,data);
                } else {
                    console.log(msg,data);
                }
            },
            error: function (msg,data) {
                if(typeof data == 'undefined'){
                    data ='';
                }
                if (msg[msg.length - 1] === '\n') {
                    msg = msg.substring(0, msg.length - 1);
                }
                if (window.performance) {
                    var now = (window.performance.now() / 1000).toFixed(3);
                    console.error(now + ': ' + msg,data);
                } else {
                    console.error(msg,data);
                }
            }
        },

        ajax: function (method, url, async, body) {
            return new Promise(function (resolve, reject) {
                var xhr;
                var reportResults = function () {
                    if (xhr.status !== 200) {
                        reject(Error('Status=' + xhr.status + ', response=' + xhr.responseText));
                        return;
                    }
                    resolve(xhr.responseText);
                };

                xhr = new XMLHttpRequest();
                if (async) {
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState !== 4) {
                            return;
                        }
                        reportResults();
                    };
                }
                xhr.open(method, url, async);
                xhr.send(body);

                if (!async) {
                    reportResults();
                }
            });
        },

        /**
         *  fullscreen
         */
        setUpFullScreen: function () {
            document.cancelFullScreen = document.webkitCancelFullScreen || document.mozCancelFullScreen || document.cancelFullScreen;

            document.body.requestFullScreen = document.body.webkitRequestFullScreen || document.body.mozRequestFullScreen || document.body.requestFullScreen;

            document.onfullscreenchange = document.onfullscreenchange || document.onwebkitfullscreenchange || document.onmozfullscreenchange;
        },
        isFullScreen: function () {
            return !!(document.webkitIsFullScreen || document.mozFullScreen || document.isFullScreen); // if any defined and true
        },
        fullScreenElement: function () {
            return document.webkitFullScreenElement ||
                document.webkitCurrentFullScreenElement ||
                document.mozFullScreenElement ||
                document.fullScreenElement;
        },

        matchRandomRoomPattern:function (input) {
            return input.match(/^\d{9}$/) !== null;
        }

    }


});