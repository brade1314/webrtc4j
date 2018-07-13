package com.tech.tanyu.util;

import java.io.File;
import java.io.FileFilter;
import java.net.JarURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Objects;
import java.util.jar.JarEntry;
import java.util.jar.JarFile;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.netty.util.internal.StringUtil;

public abstract class PackageScanner {
	
	private static final Logger logger = LoggerFactory.getLogger(PackageScanner.class);
	
	private static final String FILE_PROTOCL = "file";
	private static final String JAR_PROTOCL = "jar";
	private static final String CLASS_SUFFIX = ".class";

	public List<Class<?>> scan(String packagename) throws Exception {
		logger.info(" >>> scan handler class start.... ");
		if (!StringUtil.isNullOrEmpty(packagename)) {
			// 获取资源
			Enumeration<URL> urls = Thread.currentThread().getContextClassLoader().getResources(packagename.replaceAll("\\.", "/"));
			// 保存扫描所有的类
			List<Class<?>> classList = new ArrayList<Class<?>>();
			while (urls.hasMoreElements()) {
				URL url = urls.nextElement();
				
				String protocl = url.getProtocol();
				logger.info(" >>> scan handler url protocl: " + protocl);
				if (FILE_PROTOCL.equals(protocl)) {
					String packagePath = url.getPath().replaceAll("%20", " ");
					this.addClass(classList, packagePath, packagename);
				} else if (JAR_PROTOCL.equals(protocl)) {
					JarURLConnection jarURLConnection = (JarURLConnection) url.openConnection();
					classList = this.getClassInJarPackage(jarURLConnection.getJarFile(), packagename);
				}
			}
			logger.info(" >>> scan handler class end....");
			return classList;
		}
		return null;
	}

	private void addClass(List<Class<?>> classList, String packagePath, String packageName) throws ClassNotFoundException {
		File[] files = new File(packagePath).listFiles(new FileFilter() {
			public boolean accept(File file) {
				return (file.isFile() && file.getName().endsWith(CLASS_SUFFIX)) || file.isDirectory();
			}
		});
		// 遍历文件操作
		for (File file : files) {
			String fileName = file.getName();
			if (file.isFile()) {
				// 获取对应的类名
				String className = fileName.substring(0, fileName.lastIndexOf("."));
				if (!StringUtil.isNullOrEmpty(packageName)) {
					className = packageName + "." + className;
				}
				Class<?> cls = Class.forName(className, true, Thread.currentThread().getContextClassLoader());
				// 判断类是否需要加载
				if (checkAdd(cls)) {
					classList.add(cls);
				}
			} else {
				// 进行递归调用,为目录
				String currentPackagePath = fileName;
				if (!StringUtil.isNullOrEmpty(packagePath)) {
					currentPackagePath = packagePath + "/" + currentPackagePath;
				}

				String currentPackageName = fileName;
				if (!StringUtil.isNullOrEmpty(packageName)) {
					currentPackageName = packageName + "." + currentPackageName;
				}
				this.addClass(classList, currentPackagePath, currentPackageName);
			}
		}
	}

    private List<Class<?>> getClassInJarPackage(JarFile jarFile, String packageName) throws ClassNotFoundException  { 
        StringBuilder packageNameSb = new StringBuilder(packageName.replaceAll("\\.", "/")).append("/");
        Objects.requireNonNull(jarFile);
        List<Class<?>> clazzList = new ArrayList<>();
        Enumeration<JarEntry> innerFiles =  jarFile.entries();
        JarEntry entry;
        while(innerFiles.hasMoreElements()) {
            entry = innerFiles.nextElement();
            if (entry.getName().endsWith(CLASS_SUFFIX)) {
                String entryName = entry.getName();
                if (!StringUtil.isNullOrEmpty(entryName) && entryName.startsWith(packageNameSb.toString()) && !entryName.contains("$")) {
					logger.info(" >>> find mapping class {}", entryName);
                    String clazzName = entryName.replaceAll("/", ".").replaceAll(".class", "");
                    Class<?> clazz = Class.forName(clazzName);
					// 判断类是否需要加载
					if (this.checkAdd(clazz)) {
						clazzList.add(clazz);
					}

                }
            }
        }
        return clazzList;
    }
    
	public abstract boolean checkAdd(Class<?> clzz);

}
