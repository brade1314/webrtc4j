var config = {
    baseUrl: '../js',
    urlArgs: 'ver=20180713',
    waitSeconds: 0,
    paths: {
        // jquery: ['//cdn.bootcss.com/jquery/3.2.1/jquery.min', 'jquery.min'],
        jquery: ['jquery.min'],
        adapter: ['adapter-6.2.1'],
        sdputils: ['sdputils'],
        util: ['util']
    },
    shim: {
        sdputils: {
        //     deps:['sockjs'],
            exports : 'sdputils'
        },
        util: {
            exports : 'util'
        }
    }
};

require.config(config);