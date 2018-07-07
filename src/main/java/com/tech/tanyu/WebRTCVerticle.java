package com.tech.tanyu;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.base.BaseVerticle;
import com.tech.tanyu.handle.DispatcherHandler;
import com.tech.tanyu.handle.WebSocketHandler;

import io.vertx.core.AsyncResult;
import io.vertx.core.Vertx;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.HttpServer;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.BodyHandler;
import io.vertx.ext.web.handler.CookieHandler;
import io.vertx.ext.web.handler.CorsHandler;
import io.vertx.ext.web.handler.SessionHandler;
import io.vertx.ext.web.handler.StaticHandler;
import io.vertx.ext.web.handler.TimeoutHandler;
import io.vertx.ext.web.sstore.LocalSessionStore;

public class WebRTCVerticle extends BaseVerticle {
	private Logger logger = LoggerFactory.getLogger(WebRTCVerticle.class);
	
	public void start() throws Exception {
		// 系统请求路由
		Router router = Router.router(this.vertx);
		
		this.handlerConfig(this.vertx, router); 
		
		// 创建http服务
		vertx.createHttpServer()
		.requestHandler(router::accept)
		.websocketHandler(new WebSocketHandler(config()))
		.listen(config().getInteger("http.port", 8080), this::listenHandler);
		
		new DispatcherHandler(config(), router).doDispatch();
	}
	
	private void listenHandler(AsyncResult<HttpServer> res){
		if (res.succeeded()) {
			this.logger.info(" >>> Http created success ...");
		} else {
			this.logger.info(" >>> Http created fail ... {}",res.cause());
		}
	}
	
	private void handlerConfig(Vertx vertx,Router router){
		router.route()
		.handler(BodyHandler.create()) // 此handler不能放最后，否则会造成reqest has read 异常
		.handler(StaticHandler.create("static"))
		.handler(CookieHandler.create())
		.handler(TimeoutHandler.create(5000))
		.handler(SessionHandler.create(LocalSessionStore.create(vertx))
						.setCookieHttpOnlyFlag(true)
						.setCookieSecureFlag(true))
		.handler(CorsHandler.create("*").allowedMethod(HttpMethod.POST).allowedMethod(HttpMethod.GET));//允许跨域
		router.route("/").handler(r->{r.reroute("/html");}); 
	}
}
