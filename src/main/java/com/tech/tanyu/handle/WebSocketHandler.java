package com.tech.tanyu.handle;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.base.BaseHandler;
import com.tech.tanyu.dto.Room;

import io.vertx.core.Handler;
import io.vertx.core.http.ServerWebSocket;
import io.vertx.core.json.Json;
import io.vertx.core.json.JsonObject;

public class WebSocketHandler extends BaseHandler implements Handler<ServerWebSocket>{
	
	private Logger logger = LoggerFactory.getLogger(WebSocketHandler.class);
	
	private JsonObject requestJson;
	
	public WebSocketHandler(JsonObject config) {
		super();
		this.config = config;
	}

	private void createRoom(ServerWebSocket webSocket){
		logger.info(" >>> create room request： {}",this.requestJson);
		String roomId = this.requestJson.getString("roomId");
		Room room = null;
		List<String> clients = new ArrayList<>();
		boolean isInitiator = false;
		if (null != roomId && clientsMap.containsKey(roomId)) {
			room = clientsMap.get(roomId);
			clients = room.getClientIds();
		}
		if (null != clients && clients.size() > 0) {
			isInitiator = true;
		}
		String clientId = String.valueOf(new Random().nextInt(1000000000));
		clients.add(clientId);
		room = new Room(roomId, clientId, clients, isInitiator);
		clientsMap.put(roomId, room); 
		socketMap.put(clientId, webSocket);
//		String joinRoomUrl = this.config.getJsonObject("webrtc.config").getString("roomServer") + "?r=" + roomId;
//		this.requestJson = new JsonObject(Json.encodePrettily(room)).put("action", "create").put("joinRoomUrl", joinRoomUrl); 
		this.requestJson = new JsonObject(Json.encodePrettily(room)).put("action", "create"); 
		webSocket.writeTextMessage(this.requestJson.toString());
		logger.info(" >>> create room response： {}",this.requestJson);
	}
	
	private void messageHandler(ServerWebSocket webSocket){
		logger.info(" >>> message room request： {}",this.requestJson);
		String msg = this.requestJson.getString("message");
		String roomId = this.requestJson.getString("roomId");
		String clientId = this.requestJson.getString("clientId");
		Room room  = clientsMap.get(roomId);
		List<String> clients = room.getClientIds();
		logger.info(" >>> has clients： {}",clients);
		clients.forEach(c->{
			if(!c.equals(clientId)){
				String result = new JsonObject().put("initiator", room.isInitiator()).put("message", msg).toString();
				ServerWebSocket socket = socketMap.get(c);
				socket.writeTextMessage(result);
				logger.info(" >>> message room response： {}",result);
			}
		});
		
	}
	
	private void leaveRoom(ServerWebSocket webSocket){
		logger.info(" >>> leave room request： {}",this.requestJson);
		String roomId = this.requestJson.getString("roomId");
		String clientId = this.requestJson.getString("clientId");
		List<String> clients = new ArrayList<>();
		if(null == roomId || null == clientId){
			webSocket.writeTextMessage(this.requestJson.toString());
			return ;
		}
		if(!clientsMap.containsKey(roomId)){
			webSocket.writeTextMessage(this.requestJson.toString());
			return;
		}
		clients = clientsMap.get(roomId).getClientIds();
		if (clients.size() == 1 && clients.contains(clientId)) {
			clientsMap.remove(roomId);
		} else {
			clients.remove(clientId);
			clientsMap.put(roomId, new Room(roomId,null, clients, false));
		}
		if(null != clientId && socketMap.containsKey(clientId)){
			socketMap.remove(clientId);
		}
		clients.forEach(c->{
			ServerWebSocket socket = socketMap.get(c);
			if(null == socket){
				return;
			}
			socket.writeTextMessage(this.requestJson.toString());
		});
		logger.info(" >>> leave room response： {}",this.requestJson);
	}

	@Override
	public void handle(ServerWebSocket webSocket) {
		webSocket.frameHandler(handler -> {
			this.requestJson = new JsonObject(handler.binaryData());
			String action = this.requestJson.getString("action");
			switch (action) {
			case "create":
				this.createRoom(webSocket);
				break;
			case "message":
				this.messageHandler(webSocket);
				break;
			case "leave":
				this.leaveRoom(webSocket);
				break;
			default:
				webSocket.reject(404);
				break;
			}
		});
	}
	
}
