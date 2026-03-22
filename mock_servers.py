import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

def camera_server():
    """与 flow_definition.json 中 TCP_CLIENT 端口一致（默认 9001，RAW 模式返回原始字节）。"""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('127.0.0.1', 9001))
    server.listen(5)
    print("Camera server listening on 9001")
    while True:
        client, addr = server.accept()
        print("Camera server connected by", addr)
        # return hex array: 1,2,3,4,5,6,7 -> length 7 > 6
        # wait a bit for client to be ready
        time.sleep(0.5)
        # raw bytes, will be read as HEX by TCP_CLIENT readMode RAW
        client.send(bytes([1, 2, 3, 4, 5, 6, 7]))
        client.close()

def device_server():
    """与主流程 TCP_CLIENT「步骤6b」端口一致（默认 9002）；返回 OK: + UTF-8 JSON 的十六进制 + 换行。"""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('127.0.0.1', 9002))
    server.listen(5)
    print("Device server listening on 9002")
    while True:
        client, addr = server.accept()
        print("Device server connected by", addr)
        data = client.recv(1024)
        print("Device server received:", data)
        # return prefix "AA55" + hex of '{"status":"ok"}'
        # '{"status":"ok"}' -> 7B22737461747573223A226F6B227D
        # We will send it as hex string because TCP_CLIENT expects raw bytes to convert to hex?
        # If TCP_CLIENT readMode is RAW, it converts bytes to hex string.
        # So we should send raw bytes: 0xAA, 0x55, then ascii bytes of '{"status":"ok"}'
        payload = '{"status":"ok","n":1}'
        hex_body = payload.encode("utf-8").hex().upper()
        line = ("OK:" + hex_body + "\n").encode("utf-8")
        client.send(line)
        client.close()

class HttpMockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        print("HTTP server received GET:", self.path)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")

def http_server():
    """独立跑 Spring 时用 application.yml 端口；此处仅作纯 Python 联调。"""
    server = HTTPServer(('127.0.0.1', 8890), HttpMockHandler)
    print("HTTP server listening on 8890")
    server.serve_forever()

def trigger_broadcast_listener():
    """连接 flow_definition 中 TCP_SERVER 端口 9100：先收广播行，再发 ACK_READY（与 CONDITION 分支一致）。"""
    time.sleep(2)
    try:
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(('127.0.0.1', 9100))
        print("Broadcast listener connected to TCP_SERVER on 9100")
        reader = client.makefile("r", encoding="utf-8", newline="\n")
        line = reader.readline()
        print("Broadcast listener received line:", line)
        client.sendall(b"ACK_READY\n")
        print("Broadcast listener sent ACK_READY")
        reader.close()
        client.close()
    except Exception as e:
        print("Broadcast listener failed:", e)

if __name__ == '__main__':
    threading.Thread(target=camera_server, daemon=True).start()
    threading.Thread(target=device_server, daemon=True).start()
    threading.Thread(target=http_server, daemon=True).start()
    threading.Thread(target=trigger_broadcast_listener, daemon=True).start()
    
    while True:
        time.sleep(1)
