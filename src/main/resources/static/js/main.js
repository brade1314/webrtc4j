var config = {
    baseUrl: '../js',
    urlArgs: 'ver=20180614',
    waitSeconds: 0,
    paths: {
        // jquery: ['//cdn.bootcss.com/jquery/3.2.1/jquery.min', 'jquery.min'],
        jquery: ['jquery.min'],
        adapter: ['adapter-6.2.1'],
        util: ['util']
    },
    shim: {
        // vertxclient: {
        //     deps:['sockjs'],
        //     exports : 'vertxclient'
        // },
        util: {
            exports : 'util'
        }
    }
};

require.config(config);