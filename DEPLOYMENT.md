# 🚀 Deployment Guide

This guide covers deploying your Comprehension Engine to production.

## 📱 **Frontend Deployment (Vercel)**

### **Prerequisites**
- GitHub repository with your code
- Vercel account (free at [vercel.com](https://vercel.com))

### **Method 1: Vercel CLI (Recommended)**

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Follow prompts:**
   - Link to existing project or create new
   - Set project name: `comprehension-engine-frontend`
   - Confirm build settings

### **Method 2: Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your GitHub repository
5. Configure settings:
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`
   - **Install Command:** `npm install`

### **Environment Variables**
In Vercel dashboard, add:
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
REACT_APP_ENVIRONMENT=production
```

## 🔧 **Backend Deployment Options**

### **Option 1: Railway (Recommended)**
1. Go to [railway.app](https://railway.app)
2. Connect GitHub repository
3. Set root directory to `backend`
4. Add environment variables:
   ```
   ANTHROPIC_API_KEY=your-actual-api-key
   ```
5. Deploy

### **Option 2: Render**
1. Go to [render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repository
4. Set root directory to `backend`
5. Build command: `pip install -r requirements.txt`
6. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### **Option 3: Heroku**
1. Install Heroku CLI
2. Create app: `heroku create your-app-name`
3. Set buildpacks: `heroku buildpacks:set heroku/python`
4. Deploy: `git push heroku main`

## 🌐 **Domain & SSL**

- **Vercel:** Automatically provides SSL and custom domains
- **Backend:** Most services provide SSL automatically
- **Custom Domain:** Configure in Vercel dashboard

## 🔄 **Continuous Deployment**

Both Vercel and backend services support automatic deployments:
- Push to `main` branch → Automatic deployment
- Preview deployments for pull requests
- Rollback to previous versions

## 📊 **Monitoring & Analytics**

- **Vercel Analytics:** Built-in performance monitoring
- **Backend Logs:** Available in service dashboards
- **Error Tracking:** Consider Sentry for production

## 🧪 **Testing Before Production**

1. **Local Testing:**
   ```bash
   # Frontend
   cd frontend && npm start
   
   # Backend
   cd backend && python main.py
   ```

2. **Build Testing:**
   ```bash
   cd frontend && npm run build
   ```

3. **Environment Variables:**
   - Test with production backend URL
   - Verify API key loading

## 🚨 **Common Issues & Solutions**

### **Build Failures**
- Check Node.js version (use 16+)
- Clear `node_modules` and reinstall
- Verify all dependencies in `package.json`

### **API Connection Issues**
- Verify backend URL in environment variables
- Check CORS settings in backend
- Ensure backend is accessible from Vercel

### **Environment Variables**
- Must start with `REACT_APP_` for Create React App
- Restart build after adding variables
- Check variable names match exactly

## 📈 **Performance Optimization**

- **Vercel Edge Functions:** For API routes
- **Image Optimization:** Automatic with Vercel
- **Caching:** Configure in `vercel.json`
- **Bundle Analysis:** Use `npm run build --analyze`

## 🔒 **Security Considerations**

- **API Keys:** Never commit to repository
- **Environment Variables:** Use Vercel's secure storage
- **CORS:** Configure backend for production domain
- **HTTPS:** Automatic with Vercel

## 📞 **Support Resources**

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Render Documentation](https://render.com/docs)
- [Create React App Deployment](https://create-react-app.dev/docs/deployment/) 