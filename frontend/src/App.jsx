import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ChatPage from './pages/ChatPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import HomePage from './pages/HomePage.jsx';
import { useAuthStore } from './store/useAuthStore.js';
import { Toaster } from "react-hot-toast";

function App() {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Routes>
  <Route path="/" element={<Navigate to={authUser ? "/home" : "/signin"} />} />
  <Route path="/signin" element={!authUser ? <SignInPage /> : <Navigate to="/home" />} />
  <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/home" />} />
  <Route path="/home" element={authUser ? <HomePage /> : <Navigate to="/signin" />} />
  <Route path="/chatpage" element={authUser ? <ChatPage /> : <Navigate to="/signin" />} />
  
</Routes>
<Toaster position="top-center" reverseOrder={false} />
    </div>
    
  );
}

export default App;