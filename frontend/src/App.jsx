import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ChatPage from './pages/ChatPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import SignInPage from './pages/SignInPage.jsx';
import { useAuthStore } from './store/useAuthStore.js';
import PageLoader from './components/PageLoader.jsx'; 

function App() {
  return (
    <div> 
      <Routes>
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        {/* Các route khác... */}
      </Routes>
    </div>
  );
}

export default App;