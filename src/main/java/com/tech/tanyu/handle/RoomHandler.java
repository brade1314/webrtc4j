package com.tech.tanyu.handle;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.annotation.RequestMapping;
import com.tech.tanyu.base.BaseHandler;

import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

@RequestMapping
public class RoomHandler extends BaseHandler {
	private Logger logger = LoggerFactory.getLogger(RoomHandler.class);

	@RequestMapping(value = "/config")
	public void getWebRTCConfig(RoutingContext r){
		JsonObject config = this.config.getJsonObject("webrtc.config");
		r.response().end(config.toBuffer());
		logger.info(" >>> init webrtc config: {}",config.toString());
	}
//	
//	@RequestMapping(value = "/:roomId/")
//	public void goRoom(RoutingContext r){
//		String roomId = r.pathParam("roomId");
//		logger.info(" >>> {}", roomId);
//		r.reroute("/"); 
//	}

}
