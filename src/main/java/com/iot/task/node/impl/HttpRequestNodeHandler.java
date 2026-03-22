package com.iot.task.node.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iot.task.engine.FlowExecutionContext;
import com.iot.task.model.FlowNode;
import com.iot.task.node.NodeHandler;
import com.iot.task.node.NodeResult;
import com.iot.util.VariablePathUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * HTTP_REQUEST node - makes an HTTP request and stores the response.
 *
 * Config fields:
 *   url            - request URL (supports ${variable} placeholders)
 *   method         - GET | POST | PUT | DELETE  (default POST)
 *   contentType    - Content-Type header (default application/json)
 *   headers        - additional headers as Map<String,String>
 *   body           - request body template (supports ${variable} placeholders)
 *   timeout        - request timeout in ms (default 10000)
 *   outputVariable - variable to store response (default "httpResponse")
 */
@Slf4j
@Component
public class HttpRequestNodeHandler implements NodeHandler {

    private final ObjectMapper objectMapper;

    public HttpRequestNodeHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getType() {
        return "HTTP_REQUEST";
    }

    @Override
    public NodeResult execute(FlowNode node, FlowExecutionContext context) {
        try {
            Map<String, Object> config = node.getConfig();
            if (config == null) {
                return NodeResult.error("HTTP_REQUEST node has no config");
            }

            // Resolve URL template - URL-encode variable values
            String url = resolveVariablesForUrl((String) config.get("url"), context);
            String method = ((String) config.getOrDefault("method", "POST")).toUpperCase();
            String contentType = (String) config.getOrDefault("contentType", "application/json");
            String bodyTemplate = (String) config.get("body");
            int timeout = toInt(config.get("timeout"), 10000);
            String outputVar = (String) config.getOrDefault("outputVariable", "httpResponse");

            if (url == null || url.isBlank()) {
                return NodeResult.error("HTTP_REQUEST: url is required");
            }

            // Resolve body template
            String body = bodyTemplate != null ? resolveVariables(bodyTemplate, context) : null;

            log.info("HTTP_REQUEST node '{}': {} {}", node.getName(), method, url);
            context.addLog("HTTP " + method + " " + url);

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofMillis(timeout))
                    .build();

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofMillis(timeout))
                    .header("Content-Type", contentType);

            // Add custom headers
            @SuppressWarnings("unchecked")
            Map<String, String> headers = (Map<String, String>) config.get("headers");
            if (headers != null) {
                headers.forEach(reqBuilder::header);
            }

            // Set method and body
            switch (method) {
                case "GET"    -> reqBuilder.GET();
                case "DELETE" -> reqBuilder.DELETE();
                case "PUT"    -> reqBuilder.PUT(body != null
                        ? HttpRequest.BodyPublishers.ofString(body)
                        : HttpRequest.BodyPublishers.noBody());
                default       -> reqBuilder.POST(body != null
                        ? HttpRequest.BodyPublishers.ofString(body)
                        : HttpRequest.BodyPublishers.noBody());
            }

            HttpResponse<String> response = client.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

            int statusCode = response.statusCode();
            String responseBody = response.body();

            log.info("HTTP_REQUEST node '{}': status={}, body length={}", node.getName(), statusCode, responseBody != null ? responseBody.length() : 0);
            context.addLog("HTTP response status: " + statusCode);

            // Try to parse response as JSON, fallback to raw string
            Object parsedResponse;
            try {
                parsedResponse = objectMapper.readValue(responseBody, Object.class);
            } catch (Exception e) {
                parsedResponse = responseBody;
            }

            // Store full result with status and body
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("statusCode", statusCode);
            result.put("body", parsedResponse);

            // If parsed response is a Map, also flatten its keys into the result for easy access
            if (parsedResponse instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> bodyMap = (Map<String, Object>) parsedResponse;
                result.putAll(bodyMap);
            }

            context.setVariable(outputVar, result);
            context.addLog("HTTP response stored in: " + outputVar);

            return NodeResult.ok(result);
        } catch (Exception e) {
            log.error("HTTP_REQUEST node '{}' failed: {}", node.getName(), e.getMessage(), e);
            context.addLog("HTTP_REQUEST error: " + e.getMessage());
            return NodeResult.error("HTTP_REQUEST failed: " + e.getMessage());
        }
    }

    private String resolveVariables(String template, FlowExecutionContext context) {
        return resolveVars(template, context, false);
    }

    private String resolveVariablesForUrl(String template, FlowExecutionContext context) {
        return resolveVars(template, context, true);
    }

    private String resolveVars(String template, FlowExecutionContext context, boolean urlEncode) {
        if (template == null) return null;
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < template.length()) {
            if (i + 1 < template.length() && template.charAt(i) == '$' && template.charAt(i + 1) == '{') {
                int end = template.indexOf('}', i + 2);
                if (end > 0) {
                    String varPath = template.substring(i + 2, end);
                    Object val = VariablePathUtils.getValue(context.getVariables(), varPath);
                    String strVal = val != null ? val.toString() : "";
                    if (urlEncode) {
                        try {
                            strVal = java.net.URLEncoder.encode(strVal, "UTF-8");
                        } catch (Exception ignored) {}
                    }
                    sb.append(strVal);
                    i = end + 1;
                    continue;
                }
            }
            sb.append(template.charAt(i));
            i++;
        }
        return sb.toString();
    }

    private static int toInt(Object obj, int def) {
        if (obj instanceof Number n) return n.intValue();
        if (obj instanceof String s) {
            try { return Integer.parseInt(s); } catch (Exception ignored) {}
        }
        return def;
    }
}
