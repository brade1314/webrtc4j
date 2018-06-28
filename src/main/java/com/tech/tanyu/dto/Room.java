package com.tech.tanyu.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

public class Room {
	String roomId;
	
	String clientId;
	
	@JsonIgnore
	List<String> clientIds;
	
	@JsonIgnore
	List<String> message;
	
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
	
}
