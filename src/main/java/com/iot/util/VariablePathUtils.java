package com.iot.util;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class VariablePathUtils {

    private static final Pattern SEGMENT_PATTERN = Pattern.compile("([^.\\[]+)|\\[(\\d+)]");

    private VariablePathUtils() {
    }

    /**
     * Get a value from a nested map/list structure using dot notation with array indexing.
     * Example paths: "a.b.c", "a.b[0].c", "items[2].name"
     */
    public static Object getValue(Map<String, Object> context, String path) {
        if (context == null || path == null || path.isEmpty()) {
            return null;
        }

        List<Object> segments = parseSegments(path);
        Object current = context;

        for (Object segment : segments) {
            if (current == null) {
                return null;
            }
            if (segment instanceof String key) {
                if (current instanceof Map<?, ?> map) {
                    current = map.get(key);
                } else {
                    return null;
                }
            } else if (segment instanceof Integer index) {
                if (current instanceof List<?> list) {
                    if (index < 0 || index >= list.size()) {
                        return null;
                    }
                    current = list.get(index);
                } else {
                    return null;
                }
            }
        }
        return current;
    }

    /**
     * Set a value in a nested map/list structure using dot notation with array indexing.
     * Creates intermediate maps and lists as needed.
     * Example paths: "a.b.c", "a.b[0].c", "items[2].name"
     */
    @SuppressWarnings("unchecked")
    public static void setValue(Map<String, Object> context, String path, Object value) {
        if (context == null || path == null || path.isEmpty()) {
            return;
        }

        List<Object> segments = parseSegments(path);
        if (segments.isEmpty()) {
            return;
        }

        Object current = context;

        for (int i = 0; i < segments.size() - 1; i++) {
            Object segment = segments.get(i);
            Object nextSegment = segments.get(i + 1);

            if (segment instanceof String key) {
                Map<String, Object> map = (Map<String, Object>) current;
                Object child = map.get(key);
                if (child == null) {
                    if (nextSegment instanceof Integer) {
                        child = new ArrayList<>();
                    } else {
                        child = new HashMap<String, Object>();
                    }
                    map.put(key, child);
                }
                current = child;
            } else if (segment instanceof Integer index) {
                List<Object> list = (List<Object>) current;
                ensureListSize(list, index + 1);
                Object child = list.get(index);
                if (child == null) {
                    if (nextSegment instanceof Integer) {
                        child = new ArrayList<>();
                    } else {
                        child = new HashMap<String, Object>();
                    }
                    list.set(index, child);
                }
                current = child;
            }
        }

        // Set the final value
        Object lastSegment = segments.get(segments.size() - 1);
        if (lastSegment instanceof String key) {
            ((Map<String, Object>) current).put(key, value);
        } else if (lastSegment instanceof Integer index) {
            List<Object> list = (List<Object>) current;
            ensureListSize(list, index + 1);
            list.set(index, value);
        }
    }

    private static List<Object> parseSegments(String path) {
        List<Object> segments = new ArrayList<>();
        String[] dotParts = path.split("\\.");

        for (String dotPart : dotParts) {
            Matcher matcher = SEGMENT_PATTERN.matcher(dotPart);
            while (matcher.find()) {
                if (matcher.group(1) != null) {
                    segments.add(matcher.group(1));
                } else if (matcher.group(2) != null) {
                    segments.add(Integer.parseInt(matcher.group(2)));
                }
            }
        }
        return segments;
    }

    private static void ensureListSize(List<Object> list, int size) {
        while (list.size() < size) {
            list.add(null);
        }
    }
}
