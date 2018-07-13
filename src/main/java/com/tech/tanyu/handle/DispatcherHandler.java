package com.tech.tanyu.handle;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.tech.tanyu.annotation.RequestMapping;
import com.tech.tanyu.dto.HandlerMapping;
import com.tech.tanyu.util.PackageScanner;

import io.netty.util.internal.StringUtil;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Route;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;

public class DispatcherHandler {
	private Logger logger = LoggerFactory.getLogger(DispatcherHandler.class);
	
	private Router router;
	private JsonObject config;
	private Map<String, HandlerMapping> reqMethods;

	public DispatcherHandler(JsonObject conf, Router router) {
		this.router = router;
		this.config = conf;
		this.reqMethods = new HashMap<>();
	}
	
	public void doDispatch() throws Exception {
		for (Class<?> clazz : this.getRequestMappingClass()) {
//			this.registerClass(clazz, filterClassConstructor(clazz), this.router);
			this.registerClass(clazz, clazz.newInstance(), this.router);
		}
	}
	
	private List<Class<?>> getRequestMappingClass() throws Exception {
		return new PackageScanner() {
			@Override
			public boolean checkAdd(Class<?> clzz) {
				return clzz.isAnnotationPresent(RequestMapping.class);
			}
		}.scan(this.config.getString("scan.package","com.tech.tanyu.handle"));
	}
	
	private void registerClass(Class<?> clazz, Object instance, Router router) {
		try {
			RequestMapping classAnnotation = clazz.getAnnotation(RequestMapping.class);
			String classPath = StringUtil.isNullOrEmpty(classAnnotation.value()) ? classAnnotation.path() : classAnnotation.value();
			this.setBaseHandlerConfig(clazz, instance);
			for (Method method : clazz.getDeclaredMethods()) {
				RequestMapping methodAnnotation = method.getAnnotation(RequestMapping.class);
				if (Objects.isNull(methodAnnotation)) {
					continue;
				}
				String methodPath = StringUtil.isNullOrEmpty(methodAnnotation.value()) ? methodAnnotation.path() : methodAnnotation.value();
				String requestPath = classPath + methodPath;

				Route route = router.route(requestPath);
				this.setMethodMap(Arrays.asList(methodAnnotation.method()), method, this.getHandlerMapping(requestPath, instance), route);
				route.handler(this::requestHandler);
			}

		} catch (Exception e) {
			logger.error(" >>> register class error ", e);
		}
	}
    
	private HandlerMapping getHandlerMapping(String requestPath, Object instance) {
		return reqMethods.computeIfAbsent(requestPath,v -> new HandlerMapping(requestPath, instance, new EnumMap<HttpMethod, Method>(HttpMethod.class)));
	}
    
	private void setMethodMap(List<HttpMethod> httpMethods, Method method, HandlerMapping mapping, Route route) {
		if (httpMethods.isEmpty()) {
			route.method(HttpMethod.GET).method(HttpMethod.POST);
			mapping.setMethodMap(HttpMethod.GET, method).setMethodMap(HttpMethod.POST, method);
			return;
		}
		httpMethods.forEach(m -> {
			route.method(m);
			mapping.setMethodMap(m, method);
		});
	}
    
	private void setBaseHandlerConfig(Class<?> clazz, Object instance) {
		try {
			Field field = clazz.getSuperclass().getDeclaredField(this.config.getString("base.config","config"));
			if (Objects.isNull(field)) {
				return ;
			}
			field.setAccessible(true);
			field.set(instance, this.config);
		} catch (Exception e) {
			logger.error(" >>> set baseHandler config error: {}", e);
		}
	}
    
    @SuppressWarnings("rawtypes")
	public Object filterClassConstructor(Class<?> clazz) {
		Constructor[] constructors = clazz.getConstructors();
		try {
			for (Constructor cons : constructors) {
				if (cons.getParameterCount() != 1) {
					return null;
				}
				Class<?> typeClass = cons.getParameterTypes()[0];
				if (!"io.vertx.core.json.JsonObject".equals(typeClass.getName())) {
					return null;
				}
				Parameter parameter = cons.getParameters()[0];
				Type type = parameter.getParameterizedType();
				if (!"io.vertx.core.json.JsonObject".equals(type.getTypeName())) {
					return null;
				}
				return cons.newInstance(this.config);
			}
		} catch (Exception e) {
			logger.error(" >>> get constructor error >>> ", e);
		}
		return null;
	}
    
    public void requestHandler(RoutingContext context) {
        HttpServerRequest request = context.request();
        HandlerMapping mapping = this.getReqMappedHandler(request.path());
        Method m = mapping.getHandlerMethod(request.method());
        
		logger.info(" >>> requestPath: {} -> method: {} -> matchedPath: {}", request.path(), request.method(),mapping.getKeyPath());
        try {
            m.invoke(mapping.getHandler(), context);
        } catch (Exception e) {
			logger.error(" >>> dispatcher handler error :", e);
        }
    }
    
	private HandlerMapping getReqMappedHandler(String requestPath) {
		String[] requestPathSplit = requestPath.split("/");
		for (String key : reqMethods.keySet()) {
			String[] keyPathSplit = key.split("/");
			if (requestPathSplit.length == keyPathSplit.length) {
				boolean isNotFound = false;
				for (int i = 0; i < requestPathSplit.length; i++) {
					if (requestPathSplit[i].equals(keyPathSplit[i])) {
						continue;
					} else {
						if (keyPathSplit[i].startsWith(":")) {
							continue;
						} else {
							isNotFound = true;
							break;
						}
					}
				}
				if (isNotFound) {
					continue;
				} else {
					return reqMethods.get(key);
				}
			} else {
				continue;
			}
		}
		return null;
	}
	
}
