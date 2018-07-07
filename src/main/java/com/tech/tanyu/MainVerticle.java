package com.tech.tanyu;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.vertx.core.AbstractVerticle;
import io.vertx.core.DeploymentOptions;

public class MainVerticle extends AbstractVerticle {
	private static Logger logger = LoggerFactory.getLogger(MainVerticle.class);

	@Override
	public void start() throws Exception {
		// verticle配置信息
		logger.info("http.port: "+config().getInteger("http.port")); 
		vertx.deployVerticle(new WebSocketVerticle(), new DeploymentOptions().setConfig(config()));
		logger.info("MainVerticle部署完成");
	}

}
