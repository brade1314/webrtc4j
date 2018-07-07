package com.tech.tanyu;


import java.util.Objects;

import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.vertx.core.DeploymentOptions;
import io.vertx.core.VertxOptions;
import io.vertx.core.json.JsonObject;

public class WebRTCLauncher extends io.vertx.core.Launcher {

	private static Logger logger = LoggerFactory.getLogger(WebRTCLauncher.class);
	
	public static void main(String[] args) {
		new WebRTCLauncher().dispatch(args);
	}

	@Override
	public void beforeStartingVertx(VertxOptions options) {
		logger.info(" >>> is clustered --> {} ",options.isClustered());
	}

	@Override
	public void beforeDeployingVerticle(DeploymentOptions deploymentOptions) {
		try {
			if (Objects.isNull(deploymentOptions.getConfig())) {
				deploymentOptions.setConfig(new JsonObject());
			}
			deploymentOptions.getConfig().mergeIn(getConfiguration());
		} catch (Exception e) {
			logger.error(" >>> before deploying verticl error ... " , e);
		}
	}

	private JsonObject getConfiguration() {
		JsonObject conf = new JsonObject();
		try {
			String config = IOUtils.toString(this.getClass().getResource("/config/config.json"), "UTF-8");
			logger.info(" >>> config content:  " + config);
			conf = new JsonObject(config);
		} catch (Exception e) {
			logger.error(" >>> config file decode error ... " , e);
		}
		return conf;
	}

}
