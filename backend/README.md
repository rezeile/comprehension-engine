# Comprehension Engine Backend

FastAPI backend for the Comprehension Engine AI tutoring system, integrated with Anthropic Claude Sonnet 4.

## Features

- **FastAPI REST API**: Modern, fast Python web framework
- **Claude Sonnet 4 Integration**: AI-powered tutoring responses
- **Conversation History**: Maintains context across chat sessions
- **CORS Support**: Frontend integration ready
- **Error Handling**: Robust error handling and validation

## Setup

### Prerequisites

- Python 3.8+
- pip or poetry

### Installation

1. **Activate the virtual environment:**
```bash
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate     # On Windows
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Configure environment variables:**
```bash
cp env.example .env
# Edit .env and add your actual Anthropic API key
```

4. **Get your Anthropic API key:**
   - Visit [Anthropic Console](https://console.anthropic.com/)
   - Create an account and generate an API key
   - Add it to your `.env` file

## Running the Backend

### Development Mode (Foreground)
```bash
python main.py
```

### Production Mode
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🚀 **Starting the Backend in Background**

### **Option 1: Using `nohup` (Recommended for Production)**

```bash
cd backend
source venv/bin/activate

# Start server in background with logging
nohup python main.py > server.log 2>&1 &

# Check if it's running
ps aux | grep "python main.py"

# View server logs
tail -f server.log

# Test the API
curl http://localhost:8000/health
```

**To stop the background server:**
```bash
# Find the process ID
ps aux | grep "python main.py"

# Kill the process
kill <process_id>
# or more forcefully
kill -9 <process_id>
```

### **Option 2: Using the Startup Script in Background**

```bash
cd backend
nohup ./start.sh > server.log 2>&1 &

# Check status
ps aux | grep "start.sh"
```

### **Option 3: Using `screen` (Great for Development)**

```bash
# Install screen if you don't have it
brew install screen  # macOS
# sudo apt-get install screen  # Ubuntu/Debian

# Start a new screen session
screen -S comprehension-engine

# Inside the screen session:
cd backend
source venv/bin/activate
python main.py

# Detach from screen: Press Ctrl+A, then D
# Reattach later: screen -r comprehension-engine
# List all sessions: screen -ls
# Kill a session: screen -X -S comprehension-engine quit
```

### **Option 4: Using `tmux` (Alternative to screen)**

```bash
# Install tmux if you don't have it
brew install tmux  # macOS
# sudo apt-get install tmux  # Ubuntu/Debian

# Start a new tmux session
tmux new-session -d -s comprehension-engine

# Send commands to the session
tmux send-keys -t comprehension-engine "cd backend && source venv/bin/activate && python main.py" Enter

# Attach to the session
tmux attach-session -t comprehension-engine

# Detach: Press Ctrl+B, then D
# List sessions: tmux list-sessions
# Kill session: tmux kill-session -t comprehension-engine
```

### **Option 5: Using Systemd (Linux Production)**

Create a service file `/etc/systemd/system/comprehension-engine.service`:
```ini
[Unit]
Description=Comprehension Engine Backend
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/comprehension-engine/backend
Environment=PATH=/path/to/your/comprehension-engine/backend/venv/bin
ExecStart=/path/to/your/comprehension-engine/backend/venv/bin/python main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

**Enable and start the service:**
```bash
sudo systemctl enable comprehension-engine
sudo systemctl start comprehension-engine
sudo systemctl status comprehension-engine
```

## **Monitoring and Management**

### **Check Server Status**
```bash
# Check if port 8000 is in use
lsof -i :8000

# Check process status
ps aux | grep "python main.py"

# Check server logs
tail -f backend/server.log

# Test API health
curl http://localhost:8000/health
```

### **View Real-time Logs**
```bash
# Follow logs in real-time
tail -f server.log

# Search logs for errors
grep "ERROR" server.log
grep "Exception" server.log
```

### **Restart the Server**
```bash
# Stop the current server
pkill -f "python main.py"

# Start it again
nohup python main.py > server.log 2>&1 &
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check
- `GET /health` - Service health status

### Chat
- `POST /api/chat` - Send a message and get AI response

#### Chat Request Format:
```json
{
  "message": "What is photosynthesis?",
  "conversation_history": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant", 
      "content": "Hi! How can I help you learn today?"
    }
  ]
}
```

#### Chat Response Format:
```json
{
  "response": "Photosynthesis is the process by which plants...",
  "conversation_id": "msg_123456"
}
```

## Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)
- `BACKEND_HOST`: Server host (default: 0.0.0.0)
- `BACKEND_PORT`: Server port (default: 8000)

## Development

### API Documentation
Once running, visit `http://localhost:8000/docs` for interactive API documentation.

### Testing
```bash
# Test the health endpoint
curl http://localhost:8000/health

# Test the chat endpoint
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how are you?"}'
```

## Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   lsof -i :8000
   kill -9 <process_id>
   ```

2. **Environment variables not loading:**
   ```bash
   # Check if .env file exists
   ls -la .env
   
   # Verify API key is loaded
   python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('API Key:', os.getenv('ANTHROPIC_API_KEY', 'NOT_FOUND')[:20] + '...')"
   ```

3. **Virtual environment not activated:**
   ```bash
   source venv/bin/activate
   which python  # Should show path to venv
   ```

4. **Dependencies not installed:**
   ```bash
   pip install -r requirements.txt
   ```

## Next Steps

- [ ] Add authentication
- [ ] Implement conversation persistence
- [ ] Add rate limiting
- [ ] Implement streaming responses
- [ ] Add logging and monitoring 