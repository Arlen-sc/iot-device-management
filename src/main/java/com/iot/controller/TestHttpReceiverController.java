package com.iot.controller;

import com.iot.util.R;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Mock HTTP endpoint that receives data from the flow's HTTP_REQUEST node.
 * Acts as the "step 8" receiver - logs all incoming data.
 */
@Slf4j
@RestController
@RequestMapping("/api/test/http-receiver")
public class TestHttpReceiverController {

    private final List<Map<String, Object>> receivedData = new CopyOnWriteArrayList<>();

    /**
     * Receives GET requests from the flow (step 8).
     * All query parameters are logged.
     */
    @GetMapping("/data")
    public R<?> receiveData(@RequestParam Map<String, String> params) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("timestamp", LocalDateTime.now().toString());
        entry.put("method", "GET");
        entry.put("params", params);
        receivedData.add(entry);

        log.info("[HTTP Receiver] GET data received: {}", params);
        return R.ok(Map.of("received", true, "params", params));
    }

    /**
     * Receives POST requests from the flow.
     */
    @PostMapping("/data")
    public R<?> receivePostData(@RequestBody(required = false) Object body,
                                 @RequestParam Map<String, String> params) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("timestamp", LocalDateTime.now().toString());
        entry.put("method", "POST");
        entry.put("params", params);
        entry.put("body", body);
        receivedData.add(entry);

        log.info("[HTTP Receiver] POST data received: params={}, body={}", params, body);
        return R.ok(Map.of("received", true, "params", params, "body", body));
    }

    /**
     * View all received data.
     */
    @GetMapping("/history")
    public R<?> getHistory() {
        return R.ok(receivedData);
    }

    /**
     * Clear received data history.
     */
    @DeleteMapping("/history")
    public R<?> clearHistory() {
        receivedData.clear();
        return R.ok("History cleared");
    }
}
