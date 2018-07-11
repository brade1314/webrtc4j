package com.tech.tanyu.handle;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Random;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.annotation.RequestMapping;
import com.tech.tanyu.base.BaseHandler;
import com.tech.tanyu.dto.ResponseDTO;
import com.tech.tanyu.dto.Room;

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
	
	@RequestMapping(value = "/create/:roomId/")
	public void createRoom(RoutingContext r){
		String roomId = r.pathParam("roomId");
		Room room = null;
		List<String> clients = new ArrayList<>();
		boolean isInitiator = false;
		JsonObject res = null;
		if (Objects.isNull(roomId)) {
			res= ResponseDTO.clientError("roomId is not null");
			r.response().end(res.toBuffer());
			logger.info(" >>> create room response： {}", res);
			return;
		} 
		if(!clientsMap.containsKey(roomId)){
			room = new Room();
		} else{
			room = clientsMap.get(roomId);
			clients = room.getClientIds();
		}
		if (null != clients && clients.size() > 0) {
			isInitiator = true;
		}
		String clientId = String.valueOf(new Random().nextInt(1000000000));
		clients.add(clientId);
		room.setRoomId(roomId).setClientId(clientId).setClientIds(clients).setInitiator(isInitiator); 
		res = ResponseDTO.ok(room); 
		r.response().end(res.toBuffer());
		if (Objects.nonNull(room.getMessage())) {
			room.getMessage().clear();
		}
		clientsMap.put(roomId, room); 
		logger.info(" >>> create room response： {}", res);
	}
	
	@RequestMapping(value = "/message/:roomId/:clientId/")
	public void messageRoom(RoutingContext r) {
		String msg = r.getBodyAsString();
		String roomId = r.pathParam("roomId");
		String clientId = r.pathParam("clientId");
		logger.info(" >>> message room request: {} ", msg);
		if (!clientsMap.containsKey(roomId)) {
			logger.info(" >>> room {} is not exist... ", roomId);
			r.fail(500);
			return;
		}
		Room room = clientsMap.get(roomId);
		if (!room.getClientIds().contains(clientId)) {
			logger.info(" >>> room {} is not exist client {} ...", roomId, clientId);
			r.fail(500);
			return;
		}
		clientsMap.put(roomId, room.addOnetMessage(msg));
		JsonObject res = ResponseDTO.ok();
		r.response().end(res.toBuffer());
		logger.info(" >>> message room response： {}", res);
	}

}
