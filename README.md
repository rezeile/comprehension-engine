# Graspy

An AI-powered tutoring system with a modern chat interface, built with React frontend and FastAPI backend, integrated with Anthropic Claude Sonnet 4.

## 🚀 Features

- **Modern Chat Interface**: Clean, mobile-friendly design similar to ChatGPT/Claude
- **AI-Powered Responses**: Integrated with Claude Sonnet 4 for intelligent tutoring
- **Real-time Chat**: Instant messaging with conversation history
- **Mobile Responsive**: Optimized for all device sizes
- **Professional UI**: Beautiful gradients, animations, and modern design

## 🏗️ Architecture

- **Frontend**: React + TypeScript with modern CSS
- **Backend**: FastAPI + Python with Anthropic integration
- **AI Model**: Claude 3.5 Sonnet for intelligent responses
- **Communication**: RESTful API with CORS support

## 📁 Project Structure

```
comprehension-engine/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Chat interface components
│   │   ├── App.tsx         # Main application
│   │   └── ...
│   ├── package.json
│   └── README.md
├── backend/                  # FastAPI backend application
│   ├── main.py             # Main API server
│   ├── requirements.txt    # Python dependencies
│   ├── start.sh           # Startup script
│   └── README.md
└── README.md               # This file
```

## 🛠️ Setup Instructions

### Prerequisites

- **Node.js** (v14+) and **npm** for frontend
- **Python** (v3.8+) for backend
- **Anthropic API Key** from [console.anthropic.com](https://console.anthropic.com/)

### 1. Backend Setup

```bash
cd backend

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Configure API key
cp env.example .env
# Edit .env and add your actual Anthropic API key

# Start the backend server
./start.sh
# or manually: python main.py
```

The backend will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm start
```

The frontend will be available at `http://localhost:3000`

## 🚀 Running the Application

### Development Mode

1. **Start Backend** (Terminal 1):
```bash
cd backend
./start.sh
```

2. **Start Frontend** (Terminal 2):
```bash
cd frontend
npm start
```

3. **Open Browser**: Navigate to `http://localhost:3000`

### **🔄 Background Mode (Recommended for Production)**

#### **Option 1: Using `nohup` (Simplest)**

```bash
# Terminal 1: Start Backend in Background
cd backend
source venv/bin/activate
nohup python main.py > server.log 2>&1 &

# Terminal 2: Start Frontend in Background
cd frontend
nohup npm start > frontend.log 2>&1 &

# Check if both are running
ps aux | grep -E "(python main.py|npm start)"

# View logs
tail -f backend/server.log
tail -f frontend/frontend.log
```

#### **Option 2: Using `screen` (Great for Development)**

```bash
# Install screen if needed
brew install screen  # macOS
# sudo apt-get install screen  # Ubuntu/Debian

# Start backend screen session
screen -S backend
cd backend
source venv/bin/activate
python main.py
# Detach: Ctrl+A, then D

# Start frontend screen session
screen -S frontend
cd frontend
npm start
# Detach: Ctrl+A, then D

# List sessions
screen -ls

# Reattach to backend: screen -r backend
# Reattach to frontend: screen -r frontend
```

#### **Option 3: Using `tmux` (Alternative to screen)**

```bash
# Install tmux if needed
brew install tmux  # macOS
# sudo apt-get install tmux  # Ubuntu/Debian

# Create backend session
tmux new-session -d -s backend
tmux send-keys -t backend "cd backend && source venv/bin/activate && python main.py" Enter

# Create frontend session
tmux new-session -d -s frontend
tmux send-keys -t frontend "cd frontend && npm start" Enter

# Attach to sessions
tmux attach-session -t backend
tmux attach-session -t frontend
# Detach: Ctrl+B, then D
```

### Production Mode

```bash
# Backend
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# How to find Mac's IP Address (needed for Info.plist for ios)
ipconfig getifaddr $(route -n get default | awk '/interface:/{print $2}') | cat

# Frontend
cd frontend
npm run build
# Serve the build folder with a static server
```

### Temporary HTTPS Tunnel for iOS Device Testing

If a physical iOS device cannot reach `http://<your-mac-ip>:8000` due to firewall/network rules, expose your local backend over HTTPS using a temporary tunnel.

Cloudflare Tunnel (no account required):
```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
```
This prints a URL like `https://<random>.trycloudflare.com`. Use it as `BACKEND_BASE_URL` in `ComprehensionEngine/Info.plist`.

Test:
```bash
curl -s https://<random>.trycloudflare.com/health
```

Stop the tunnel:
```bash
pkill -f 'cloudflared tunnel --url http://localhost:8000'
```

Optional (run in background and capture the URL):
```bash
cloudflared tunnel --url http://localhost:8000 --logfile /tmp/cloudflared.log --loglevel info &
sleep 2; grep -Eo 'https://[-a-z0-9]+\.trycloudflare\.com' /tmp/cloudflared.log | tail -n 1
```

Oneliner to restart and print new url 
```bash 
pkill -f 'cloudflared tunnel --url http://localhost:8000' || true
cloudflared tunnel --url http://localhost:8000 --logfile /tmp/cloudflared.log --loglevel info &
sleep 2; grep -Eo 'https://[-a-z0-9]+\\.trycloudflare\\.com' /tmp/cloudflared.log | tail -n 1
```

keep mac awake while tunneling: 

```bash 
caffeinate -dimsu cloudflared tunnel --url http://localhost:8000
```

Alternative (ngrok):
```bash
brew install ngrok
ngrok http 8000
```
Use the printed `https://<id>.ngrok.io` as `BACKEND_BASE_URL`.

## 🔧 **Managing Background Services**

### **Check Service Status**
```bash
# Check if services are running
ps aux | grep -E "(python main.py|npm start)"

# Check if ports are in use
lsof -i :8000  # Backend
lsof -i :3000  # Frontend

# Test API health
curl http://localhost:8000/health
```

### **View Logs**
```bash
# Backend logs
tail -f backend/server.log

# Frontend logs
tail -f frontend/frontend.log

# Search for errors
grep "ERROR" backend/server.log
grep "Exception" backend/server.log
```

### **Stop Services**
```bash
# Stop backend
pkill -f "python main.py"

# Stop frontend
pkill -f "npm start"

# Stop all related processes
pkill -f "comprehension-engine"
```

### **Restart Services**
```bash
# Restart backend
pkill -f "python main.py"
cd backend
nohup python main.py > server.log 2>&1 &

# Restart frontend
pkill -f "npm start"
cd frontend
nohup npm start > frontend.log 2>&1 &
```

## 📱 Usage

1. **Open the chat interface** in your browser
2. **Type your question** in the input field
3. **Press Enter or click Send** to get an AI response
4. **Continue the conversation** - the AI remembers context
5. **Ask educational questions** - the AI is designed as a tutor

## 🔧 API Endpoints

- `GET /health` - Health check
- `POST /api/chat` - Send message and get AI response

### Chat API Example

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is photosynthesis?",
    "conversation_history": []
  }'
```

## 🧪 Testing

### Backend Testing

```bash
# Health check
curl http://localhost:8000/health

# Chat endpoint
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "conversation_history": []}'
```

### Frontend Testing

```bash
cd frontend
npm test
```

## 📚 API Documentation

Once the backend is running, visit:
- **Interactive API Docs**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🐛 Troubleshooting

### Common Issues

1. **Backend won't start**: Check if port 8000 is available
2. **API key errors**: Verify your `.env` file has the correct API key
3. **CORS errors**: Ensure backend is running on port 8000
4. **Frontend build errors**: Check Node.js version and dependencies
5. **Background services not working**: Check logs and process status

### Debug Mode

```bash
# Backend with debug logging
cd backend
uvicorn main:app --reload --log-level debug

# Frontend with detailed errors
cd frontend
npm start
```

### **Environment Variable Issues**
```bash
# Check if .env file exists
ls -la backend/.env

# Verify API key is loaded
cd backend
source venv/bin/activate
python -c "import os; from dotenv import load_dotenv; load_dotenv(); print('API Key loaded:', os.getenv('ANTHROPIC_API_KEY', 'NOT_FOUND')[:20] + '...')"
```

## 🚀 Next Steps

- [ ] User authentication and sessions
- [ ] Conversation persistence and history
- [ ] File upload support
- [ ] Voice input/output
- [ ] Advanced tutoring features
- [ ] Analytics and progress tracking
- [ ] Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check console logs for errors
4. Verify environment configuration
5. Check background service status

---

**Happy Learning! 🎓✨** 