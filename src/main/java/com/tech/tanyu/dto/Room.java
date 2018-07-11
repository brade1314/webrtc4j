package com.tech.tanyu.dto;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonIgnore;

import io.vertx.core.http.ServerWebSocket;

public class Room {
	String roomId;
	
	String clientId;
	
	@JsonIgnore
	List<String> clientIds;
	
	List<String> message;
	
	@JsonIgnore
	Map<String, ServerWebSocket> sockets;
	
	boolean isInitiator;
	
	public Room() {
		super();
	}
	
	public Room(String roomId, String clientId, List<String> clientIds, boolean isInitiator) {
		super();
		this.roomId = roomId;
		this.clientId = clientId;
		this.clientIds = clientIds;
		this.isInitiator = isInitiator;
	}
	
	public Room(String roomId, String clientId, List<String> clientIds, List<String> message, boolean isInitiator,int occupancy) {
		super();
		this.roomId = roomId;
		this.clientId = clientId;
		this.clientIds = clientIds;
		this.message = message;
		this.isInitiator = isInitiator;
	}

	public String getClientId() {
		return clientId;
	}

	public Room setClientId(String clientId) {
		this.clientId = clientId;
		return this;
	}

	public List<String> getMessage() {
		return message;
	}

	public Room setMessage(List<String> message) {
		this.message = message;
		return this;
	}
	
	public Room addOnetMessage(String msg) {
		if (Objects.isNull(message)) {
			this.message = new ArrayList<>();
			this.message.add(msg);
		} else {
			this.message.add(msg);
		}
		return this;
	}

	public List<String> getClientIds() {
		return clientIds;
	}

	public Room setClientIds(List<String> clientIds) {
		this.clientIds = clientIds;
		return this;
	}

	public boolean isInitiator() {
		return isInitiator;
	}

	public Room setInitiator(boolean isInitiator) {
		this.isInitiator = isInitiator;
		return this;
	}

	public String getRoomId() {
		return roomId;
	}

	public Room setRoomId(String roomId) {
		this.roomId = roomId;
		return this;
	}

	public Map<String, ServerWebSocket> getSockets() {
		return sockets;
	}

	public Room setSocket(String clientId, ServerWebSocket socket) {
		if (Objects.isNull(this.sockets)) {
			this.sockets = new HashMap<>();
		}
		this.sockets.put(clientId, socket);
		return this;
	}
	
	public Room setSockets(Map<String, ServerWebSocket> sockets) {
		this.sockets = sockets;
		return this;
	}
	
	
	
}
