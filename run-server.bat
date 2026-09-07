@echo off
echo Starting Python HTTP Server...
echo.
echo Open your browser to: http://localhost:8000/index.html
echo.
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8000
