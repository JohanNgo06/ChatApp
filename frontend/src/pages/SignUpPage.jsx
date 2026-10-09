import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, User, Mail, Lock, Eye, EyeOff, 
  ArrowRight, CheckCircle2, Loader2 
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore'; // Import store của bạn

const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });

  // Lấy hàm signup và trạng thái isSigningUp từ Zustand store
  const { signup, isSigningUp } = useAuthStore();

  // Kiểm tra xem 2 mật khẩu có giống nhau không
  const isPasswordMatch = formData.password && formData.password === formData.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Kiểm tra cơ bản trước khi gọi API
    if (!isPasswordMatch) {
      // Bạn có thể dùng toast notification ở đây (ví dụ: toast.error("Mật khẩu không khớp!"))
      alert("Mật khẩu xác nhận không khớp!");
      return;
    }

    // Gọi hàm đăng ký từ backend
    await signup({
      name: formData.name,
      email: formData.email,
      password: formData.password,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f4f8] p-4 font-sans relative overflow-hidden">
      
      {/* Background Gradient trang trí phía sau Card */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 z-0"></div>

      {/* Main Card */}
      <div className="w-full max-w-[520px] bg-white rounded-3xl shadow-2xl p-10 lg:p-12 z-10 relative">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#5c40e8] p-2 rounded-xl shadow-lg shadow-indigo-200">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold text-gray-900 tracking-tight">WhatSoup</span>
            <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">v2.4</span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Tạo tài khoản mới</h1>
          <p className="text-gray-500 text-sm">Tham gia cùng hàng trăm ngàn người kết nối & trò chuyện tức thì.</p>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gray-100 mb-8"></div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Input Họ và tên */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Họ và tên</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400 group-focus-within:text-[#5c40e8] transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-4 py-3.5 bg-[#f8f9fa] border border-transparent rounded-2xl text-gray-900 placeholder-gray-400 focus:border-[#5c40e8] focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                placeholder="Nguyễn Văn A"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Input Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email công việc hoặc cá nhân</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-[#5c40e8] transition-colors" />
              </div>
              <input
                type="email"
                className="block w-full pl-12 pr-4 py-3.5 bg-[#f8f9fa] border border-transparent rounded-2xl text-gray-900 placeholder-gray-400 focus:border-[#5c40e8] focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                placeholder="name@company.com hoặc name@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Input Mật khẩu */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#5c40e8] transition-colors" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className="block w-full pl-12 pr-12 py-3.5 bg-[#f8f9fa] border border-transparent rounded-2xl text-gray-900 placeholder-gray-400 focus:border-[#5c40e8] focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                placeholder="P@sswOrd2024!"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Input Xác nhận mật khẩu */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Xác nhận mật khẩu</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#5c40e8] transition-colors" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                className={`block w-full pl-12 pr-12 py-3.5 bg-[#f8f9fa] border rounded-2xl text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none ${
                  formData.confirmPassword && !isPasswordMatch 
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-50' 
                    : 'border-transparent focus:border-[#5c40e8]'
                }`}
                placeholder="P@sswOrd2024!"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
              {/* Hiển thị Icon Check Xanh nếu mật khẩu khớp */}
              {isPasswordMatch && (
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              )}
            </div>
          </div>

          {/* Nút Submit */}
          <button
            type="submit"
            disabled={isSigningUp}
            className="w-full bg-[#5c40e8] hover:bg-[#4a32c3] disabled:bg-[#a696eb] disabled:cursor-not-allowed active:scale-[0.98] text-white font-semibold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-indigo-200"
          >
            {isSigningUp ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Đang tạo tài khoản...
              </>
            ) : (
              <>
                Tạo tài khoản miễn phí
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          Đã có tài khoản?{' '}
          <Link to="/signin" className="text-[#5c40e8] font-bold hover:underline ml-1">
            Đăng nhập ngay
          </Link>
        </div>

      </div>
    </div>
  );
};

export default SignUpPage;