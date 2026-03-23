import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

def camera_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('127.0.0.1', 9001))
    server.listen(5)
    print("Camera server listening on 9001")
    while True:
        client, addr = server.accept()
        print("Camera server connected by", addr)
        time.sleep(0.5)
        # Return 8 bytes of data to satisfy > 6 condition
        # 0x0A, 0x14, 0x1E, 0x28, 0x32, 0x3C, 0x46, 0x50 -> Dec: 10, 20, 30, 40, 50, 60, 70, 80
        client.send(bytes([10, 20, 30, 40, 50, 60, 70, 80]))
        client.close()

def device_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('127.0.0.1', 9002))
    server.listen(5)
    print("Device server listening on 9002")
    while True:
        client, addr = server.accept()
        print("Device server connected by", addr)
        data = client.recv(1024)
        print("Device server received:", data)
        # Return prefix "PREFIX:" + hex of '{"data":[100,200,300]}' -> "PREFIX:7B2264617461223A5B3130302C3230302C3330305D7D"
        payload = '{"data":[100, 200, 300]}'
        hex_body = payload.encode("utf-8").hex().upper()
        line = ("PREFIX:" + hex_body).encode("utf-8")
        client.send(line)
        client.close()

class HttpMockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        print("HTTP server received GET:", parsed_path.path, "Query:", parsed_path.query)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")

def http_server():
    server = HTTPServer(('127.0.0.1', 8890), HttpMockHandler)
    print("HTTP server listening on 8890")
    server.serve_forever()

def trigger_broadcast_listener():
    while True:
        try:
            client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client.connect(('127.0.0.1', 9100))
            print("Broadcast listener connected to TCP_SERVER on 9100")
            # Wait for broadcast
            data = client.recv(1024)
            print("Broadcast listener received data:", data)
            # Send specific command
            time.sleep(0.5)
            client.sendall(b"CMD_PROCEED\n")
            print("Broadcast listener sent CMD_PROCEED")
            client.close()
            time.sleep(2) # Wait before next attempt
        except Exception as e:
            # If server not up yet, retry later
            time.sleep(1)

if __name__ == '__main__':
    threading.Thread(target=camera_server, daemon=True).start()
    threading.Thread(target=device_server, daemon=True).start()
    threading.Thread(target=http_server, daemon=True).start()
    threading.Thread(target=trigger_broadcast_listener, daemon=True).start()

    while True:
        time.sleep(1)
