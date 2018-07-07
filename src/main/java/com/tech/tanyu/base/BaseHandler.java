package com.tech.tanyu.base;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import com.tech.tanyu.dto.Room;

import io.vertx.core.http.ServerWebSocket;
import io.vertx.core.json.JsonObject;

public class BaseHandler {

    protected Map<String, Room> clientsMap = new ConcurrentHashMap<>();
    
    protected Map<String, ServerWebSocket> socketMap = new ConcurrentHashMap<>();
    
    protected JsonObject config;
}
