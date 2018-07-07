package com.tech.tanyu.handle;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.annotation.RequestMapping;
import com.tech.tanyu.base.BaseHandler;

import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.http.HttpServerResponse;
import io.vertx.ext.web.RoutingContext;

@RequestMapping(value = "/test")
public class TestHandler extends BaseHandler{
	private Logger logger = LoggerFactory.getLogger(TestHandler.class);

	@RequestMapping(value = "/route")
    public void testRouteMapping(RoutingContext context) throws Exception { 
		HttpServerResponse response = context.response();
		response.putHeader("Content-type",  "text/html;charset=UTF-8").end("--------欢迎，这是一个测试地址！--------");
    }

	@RequestMapping(value = "/:name/test/route")
    public void emptyKKTest (RoutingContext context) {
        HttpServerRequest request = context.request();
        HttpServerResponse response = context.response();
        String name = request.getParam("name");

        logger.info(" >>> Test********************");
        logger.info(" >>> name->" + name);
        response.end(name);
    }


}
