package com.iot.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;

@Component
public class StartupUrlPrinter implements ApplicationListener<ApplicationReadyEvent> {

    private static final Logger log = LoggerFactory.getLogger(StartupUrlPrinter.class);

    @Override
    public void onApplicationEvent(@NonNull ApplicationReadyEvent event) {
        Environment env = event.getApplicationContext().getEnvironment();
        String port = env.getProperty("local.server.port", env.getProperty("server.port", "8080"));
        boolean ssl = Boolean.parseBoolean(env.getProperty("server.ssl.enabled", "false"));
        String scheme = ssl ? "https" : "http";
        String urlSuffix = buildUrlSuffix(env.getProperty("server.servlet.context-path", ""));

        log.info("----------");
        log.info("访问地址 ({}):", scheme.toUpperCase());
        log.info("  {}://127.0.0.1:{}{}", scheme, port, urlSuffix);
        for (String ip : listLocalIPv4Addresses()) {
            log.info("  {}://{}:{}{}", scheme, ip, port, urlSuffix);
        }
        log.info("----------");
    }

    private static String buildUrlSuffix(String contextPath) {
        if (contextPath == null || contextPath.isEmpty() || "/".equals(contextPath)) {
            return "/";
        }
        if (!contextPath.startsWith("/")) {
            contextPath = "/" + contextPath;
        }
        return contextPath.endsWith("/") ? contextPath : contextPath + "/";
    }

    private static List<String> listLocalIPv4Addresses() {
        List<String> ips = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> nis = NetworkInterface.getNetworkInterfaces();
            while (nis.hasMoreElements()) {
                NetworkInterface ni = nis.nextElement();
                if (!ni.isUp() || ni.isLoopback() || ni.isVirtual()) {
                    continue;
                }
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (addr.isLoopbackAddress() || !(addr instanceof Inet4Address)) {
                        continue;
                    }
                    ips.add(addr.getHostAddress());
                }
            }
        } catch (SocketException e) {
            log.warn("无法枚举本机网卡地址: {}", e.getMessage());
        }
        return ips;
    }
}
