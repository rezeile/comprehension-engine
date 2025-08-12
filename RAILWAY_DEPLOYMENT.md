# 🚂 Railway Backend Deployment Guide

## 📋 **Prerequisites**
- GitHub repository with your code
- Railway account (free at [railway.app](https://railway.app))

## 🚀 **Step-by-Step Deployment**

### **1. Create Railway Account**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Authorize Railway to access your repositories

### **2. Deploy from GitHub**
1. **Click "New Project"**
2. **Choose "Deploy from GitHub repo"**
3. **Select your repository:** `rezeile/comprehension-engine`
4. **Set Root Directory:** `backend`
5. **Click "Deploy"**

### **3. Configure Environment Variables**
In Railway dashboard, add:
```
ANTHROPIC_API_KEY=your-actual-api-key-here
```

### **4. Get Your Backend URL**
- Railway will provide a URL like: `https://your-app-name.railway.app`
- Copy this URL for the next step

### **5. Update Frontend Backend URL**
In Vercel dashboard, update:
```
REACT_APP_BACKEND_URL=https://your-app-name.railway.app
```

## 🔧 **What Railway Does Automatically**
- ✅ **Detects Python/FastAPI** from requirements.txt
- ✅ **Installs dependencies** automatically
- ✅ **Runs uvicorn** with correct host/port
- ✅ **Provides HTTPS** and custom domains
- ✅ **Auto-deploys** on GitHub pushes

## 📊 **Monitor Your Deployment**
- **Logs:** View real-time logs in Railway dashboard
- **Metrics:** CPU, memory, and request stats
- **Deployments:** Track deployment history

## 🌐 **Custom Domain (Optional)**
1. Go to Railway project settings
2. Click "Domains"
3. Add your custom domain
4. Configure DNS records

## 🔄 **Continuous Deployment**
- Push to `main` branch → Automatic deployment
- Preview deployments for pull requests
- Easy rollback to previous versions

## 🚨 **Troubleshooting**
- **Build fails:** Check requirements.txt and Python version
- **App won't start:** Check logs for uvicorn errors
- **Environment variables:** Ensure they're set correctly

## 📞 **Support**
- [Railway Documentation](https://docs.railway.app/)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [Railway Discord](https://discord.gg/railway) 