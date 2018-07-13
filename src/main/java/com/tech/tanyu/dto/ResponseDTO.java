package com.tech.tanyu.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import io.netty.handler.codec.http.HttpStatusClass;
import io.vertx.core.json.Json;
import io.vertx.core.json.JsonObject;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResponseDTO {

	private HttpStatusClass status;

	private Object msg;

	private String error;

	public ResponseDTO() {
		this.status = HttpStatusClass.SUCCESS;
	}
	
	public ResponseDTO(HttpStatusClass status) {
		this.status = status;
	}
	
	public ResponseDTO(HttpStatusClass status, Object msg) {
		super();
		this.status = status;
		this.msg = msg;
	}

	public ResponseDTO(HttpStatusClass status, Object msg, String error) {
		super();
		this.status = status;
		this.msg = msg;
		this.error = error;
	}

	public HttpStatusClass getStatus() {
		return status;
	}

	public ResponseDTO setStatus(HttpStatusClass status) {
		this.status = status;
		return this;
	}

	public Object getMsg() {
		return msg;
	}

	public ResponseDTO setMsg(Object msg) {
		this.msg = msg;
		return this;
	}

	public String getError() {
		return error;
	}

	public ResponseDTO setError(String error) {
		this.error = error;
		return this;
	}

	public static JsonObject ok(Object msg) {
		return new JsonObject(Json.encodeToBuffer(new ResponseDTO(HttpStatusClass.SUCCESS,msg)));
	}

	public static JsonObject fail(String error) {
		return new JsonObject(Json.encodeToBuffer(new ResponseDTO(HttpStatusClass.SERVER_ERROR,error)));
	}
	
	public static JsonObject clientError(String error) {
		return new JsonObject(Json.encodeToBuffer(new ResponseDTO(HttpStatusClass.CLIENT_ERROR,error)));
	}

	public static JsonObject ok() {
		return new JsonObject(Json.encodeToBuffer(new ResponseDTO()));
	}

	public static JsonObject fail() {
		return new JsonObject(Json.encodeToBuffer( new ResponseDTO(HttpStatusClass.SERVER_ERROR)));
	}
	
	public static JsonObject clientError() {
		return new JsonObject(Json.encodeToBuffer( new ResponseDTO(HttpStatusClass.CLIENT_ERROR)));
	}


}
