@echo off
start "" /b cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:8000"
python -m http.server 8000