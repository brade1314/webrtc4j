package com.tech.tanyu.handle;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.dto.ResponseDTO;
import com.tech.tanyu.dto.Room;

import io.vertx.core.Handler;
import io.vertx.core.http.ServerWebSocket;
import io.vertx.core.json.JsonObject;

public class WebSocketHandler implements Handler<ServerWebSocket> {

	private Logger logger = LoggerFactory.getLogger(WebSocketHandler.class);

	protected Map<String, Room> clientsMap = new ConcurrentHashMap<>();

	protected JsonObject config;

	private JsonObject requestJson;

	public WebSocketHandler(JsonObject config) {
		super();
		this.config = config;
	}

	private void createRoom(ServerWebSocket webSocket) {
		logger.info(" >>> create room request： {}", this.requestJson);
		String roomId = this.requestJson.getString("roomId");
		String clientId = this.requestJson.getString("clientId");
		if (clientsMap.containsKey(roomId)) {
			//房间存在 
			clientsMap.get(roomId).getSockets().put(clientId, webSocket);
		} else {
			clientsMap.put(roomId, new Room().setSocket(clientId,webSocket).setRoomId(roomId)); 
		}
		this.requestJson = ResponseDTO.ok();
		webSocket.writeTextMessage(this.requestJson.toString());
		logger.info(" >>> create room response： {}", this.requestJson);
	}

	private void messageHandler(ServerWebSocket webSocket) {
		logger.info(" >>> message room request： {}", this.requestJson);
		String msg = this.requestJson.getString("message");
		String roomId = this.requestJson.getString("roomId");
		String clientId = this.requestJson.getString("clientId");
		Room room = clientsMap.get(roomId);
		Map<String, ServerWebSocket> socketMap = room.getSockets();
		logger.info(" >>> has clients： {}", socketMap.keySet());
		this.requestJson = ResponseDTO.ok(msg); 
		socketMap.forEach((c,s)->{
			if (!c.equals(clientId)) {
				s.writeTextMessage(this.requestJson.toString());
			}
		});
		logger.info(" >>> message room response： {}", this.requestJson);

	}

	private void leaveRoom(ServerWebSocket webSocket) {
		logger.info(" >>> leave room request： {}", this.requestJson);
		String roomId = this.requestJson.getString("roomId");
		String clientId = this.requestJson.getString("clientId");
		if (null == roomId || null == clientId) {
			webSocket.close();
			return;
		}
		if (!clientsMap.containsKey(roomId)) {
			webSocket.close();
//			webSocket.writeTextMessage(this.requestJson.toString());
			return;
		}
		Map<String, ServerWebSocket> sockets = clientsMap.get(roomId).getSockets();
		
		boolean isInitiator = false; 
		if (sockets.size() == 1 && sockets.containsKey(clientId)) {
			clientsMap.remove(roomId);
		} else {
			isInitiator = true;
			clientsMap.get(roomId).getSockets().remove(clientId);
			logger.info(" >>> current has clients： {}", clientsMap.get(roomId).getSockets().keySet());
		}
		this.requestJson =  ResponseDTO.ok(this.requestJson.put("initiator", isInitiator).toString());  
		sockets.forEach((c,s) -> {
			if (null == s) {
				return;
			}
			s.writeTextMessage(this.requestJson.toString());
		});
		logger.info(" >>> leave room response： {}", this.requestJson);
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
