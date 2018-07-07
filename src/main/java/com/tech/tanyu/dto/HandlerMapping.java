package com.tech.tanyu.dto;

import java.lang.reflect.Method;
import java.util.EnumMap;
import java.util.Objects;

import io.vertx.core.http.HttpMethod;

public class HandlerMapping {

	private Object handler;

    private String keyPath;

    private EnumMap<HttpMethod, Method> methodMap;

    public HandlerMapping() {

    }

    public HandlerMapping(String keyPath, Object baseHandler, EnumMap<HttpMethod, Method> methodMap) {
        this.keyPath = keyPath;
        this.handler = baseHandler;
        this.methodMap = methodMap;
    }

	public Method getHandlerMethod(HttpMethod method) {
		if (Objects.isNull(methodMap)) {
			return null;
		}
		return methodMap.get(method);
	}

    public Object getHandler() {
        return handler;
    }

    public HandlerMapping setHandler(Object handler) {
        this.handler = handler;
        return this;
    }

    public String getKeyPath() {
        return keyPath;
    }

    public HandlerMapping setKeyPath(String keyPath) {
        this.keyPath = keyPath;
        return this;
    }

    public EnumMap<HttpMethod, Method> getMethodMap() {
        return methodMap;
    }

    public HandlerMapping setMethodMap(HttpMethod httpMethod, Method method) {
        this.methodMap.put(httpMethod, method);
        return this;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        HandlerMapping that = (HandlerMapping) o;

        if (handler != null ? !handler.equals(that.handler) : that.handler != null) return false;
        return methodMap != null ? methodMap.equals(that.methodMap) : that.methodMap == null;
    }

    @Override
    public int hashCode() {
        int result = handler != null ? handler.hashCode() : 0;
        result = 31 * result + (methodMap != null ? methodMap.hashCode() : 0);
        return result;
    }

}
