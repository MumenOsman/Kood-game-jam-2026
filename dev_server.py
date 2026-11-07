import http.server
import socketserver
import os
import sys

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    # Never return 304, always 200 with latest content
    def send_response_only(self, code, message=None):
        super().send_response_only(code, message)

PORT = 3000
socketserver.TCPServer.allow_reuse_address = True

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"[DevServer] Running at http://localhost:{PORT}/ (no-cache headers active)", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

