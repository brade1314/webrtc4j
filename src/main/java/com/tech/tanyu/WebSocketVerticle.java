package com.tech.tanyu;


import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.dto.Room;

import io.vertx.core.AbstractVerticle;
import io.vertx.core.Future;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.HttpServer;
import io.vertx.core.http.ServerWebSocket;
import io.vertx.core.json.Json;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.handler.CookieHandler;
import io.vertx.ext.web.handler.CorsHandler;
import io.vertx.ext.web.handler.SessionHandler;
import io.vertx.ext.web.handler.StaticHandler;
import io.vertx.ext.web.handler.TimeoutHandler;
import io.vertx.ext.web.sstore.LocalSessionStore;

public class WebSocketVerticle extends AbstractVerticle {
	private Logger logger = LoggerFactory.getLogger(WebSocketVerticle.class);
	
	private Map<String, Room> clientsMap = new ConcurrentHashMap<>(16); 
	private Map<String, ServerWebSocket> sockJSSocketMap = new ConcurrentHashMap<>(16); 
	

	public void start(Future<Void> f) throws Exception {
		HttpServer server = vertx.createHttpServer();
		// 系统请求路由
		Router router = Router.router(vertx);
		router.route()
		.handler(StaticHandler.create("static"))
		.handler(CookieHandler.create())
		.handler(TimeoutHandler.create(5000))
		.handler(SessionHandler.create(LocalSessionStore.create(vertx))
						.setCookieHttpOnlyFlag(true)
						.setCookieSecureFlag(true))
		.handler(CorsHandler.create("*").allowedMethod(HttpMethod.POST).allowedMethod(HttpMethod.GET));//允许跨域

		router.route("/").handler(r->{r.reroute("/html");}); 
		// 直接进入房间
		router.get("/r/:roomId").handler(r->{r.reroute("/");});
		
		router.post("/config").handler(this::getWebRTCConfig);
		
		// socket 请求
		server.websocketHandler(this::websocketHandler);
		
		// 创建http服务
		server.requestHandler(router::accept).listen(config().getInteger("http.port", 8080), res -> {
			if (res.succeeded()) {
				f.complete();
				logger.info(" >>>>> Http服务创建完成  <<<<< ");
			} else {
				f.fail(res.cause());
				logger.info(" >>>>> Http服务创建失败 <<<<< ");
			}
		});

	}
	
	private void websocketHandler(ServerWebSocket webSocket) {
		webSocket.frameHandler(handler -> {
			JsonObject json = new JsonObject(handler.binaryData());
			if ("create".equals(json.getString("action"))) {
				this.createRoom(webSocket, json);
			} else if ("message".equals(json.getString("action"))) {
				this.messageHandler(webSocket, json);
			} else if ("leave".equals(json.getString("action"))) {
				this.leaveRoom(webSocket, json);
			} else {
				webSocket.reject(404);
			}
		});
	};
	
	
	private void getWebRTCConfig(RoutingContext r){
		JsonObject config = config().getJsonObject("webrtc.config");
		r.response().end(config.toBuffer());
		logger.info("初始化webrtc参数： {}",config.toString());
	}
	
	private void createRoom(ServerWebSocket webSocket,JsonObject json){
		logger.info("创建房间请求参数： {}",json);
		String roomId = json.getString("roomId");
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
		sockJSSocketMap.put(clientId, webSocket);
		String joinRoomUrl = config().getJsonObject("webrtc.config").getString("roomServer") + "?r=" + roomId;
		json = new JsonObject(Json.encodePrettily(room)).put("action", "create").put("joinRoomUrl", joinRoomUrl); 
		webSocket.writeTextMessage(json.toString());
		logger.info("创建房间返回参数： {}",json);
	}
	
	private void messageHandler(ServerWebSocket webSocket,JsonObject json){
		logger.info("发送消息到房间请求参数： {}",json);
		String msg = json.getString("message");
		String roomId = json.getString("roomId");
		String clientId = json.getString("clientId");
		Room room  = clientsMap.get(roomId);
		List<String> clients = room.getClientIds();
		logger.info("发送消息客户端有： {}",clients);
		clients.forEach(c->{
			if(!c.equals(clientId)){
				String result = new JsonObject().put("initiator", room.isInitiator()).put("message", msg).toString();
				ServerWebSocket socket = sockJSSocketMap.get(c);
				socket.writeTextMessage(result);
				logger.info("--发送消息响应参数-->： {}",result);
			}
		});
		
	}
	
	private void leaveRoom(ServerWebSocket webSocket,JsonObject json){
		logger.info("离开房间请求参数： {}",json);
		String roomId = json.getString("roomId");
		String clientId = json.getString("clientId");
		List<String> clients = new ArrayList<>();
		if(null == roomId || null == clientId){
			webSocket.writeTextMessage(json.toString());
			return ;
		}
		if(!clientsMap.containsKey(roomId)){
			webSocket.writeTextMessage(json.toString());
			return;
		}
		clients = clientsMap.get(roomId).getClientIds();
		if (clients.size() == 1 && clients.contains(clientId)) {
			clientsMap.remove(roomId);
		} else {
			clients.remove(clientId);
			clientsMap.put(roomId, new Room(roomId,null, clients, false));
		}
		if(null != clientId && sockJSSocketMap.containsKey(clientId)){
			sockJSSocketMap.remove(clientId);
		}
		clients.forEach(c->{
			ServerWebSocket socket = sockJSSocketMap.get(c);
			if(null == socket){
				return;
			}
			socket.writeTextMessage(json.toString());
		});
		logger.info("离开房间返回参数： {}",json);
	}
	

}
