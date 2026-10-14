import React, { useState, useEffect } from 'react';
import { CalendarDays, Cloud, Newspaper, Loader2, ExternalLink, MapPin, Wind } from 'lucide-react';
import axios from 'axios';

const DashboardWidgets = () => {
  const [weather, setWeather] = useState(null);
  const [news, setNews] = useState([]);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  // Lấy thời gian hiện tại
  const today = new Date();
  const dateString = today.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  useEffect(() => {
    // 1. Gọi API Thời tiết 
    const fetchWeather = async () => {
      try {
        const res = await axios.get(
          `https://api.weatherapi.com/v1/current.json?key=9812de474a054730af2102514261410&q=Hanoi&lang=vi`
        );
        setWeather(res.data);
      } catch (error) {
        console.error("Lỗi lấy thời tiết:", error);
      } finally {
        setLoadingWeather(false);
      }
    };

    // 2. Gọi API Tin tức AI 
    const fetchNews = async () => {
      try {
        const res = await axios.get(
          `https://gnews.io/api/v4/search?q="Artificial Intelligence" OR "AI"&lang=vi&max=2&token=9451de34d4b049519116dcf1ab83626a`
        );
        setNews(res.data.articles);
      } catch (error) {
        console.error("Lỗi lấy tin tức:", error);
      } finally {
        setLoadingNews(false);
      }
    };

    fetchWeather();
    fetchNews();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      
      {/* 1. WIDGET LỊCH & THỜI GIAN */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3 text-[#5c40e8]">
          <CalendarDays className="w-5 h-5" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Hôm nay</h3>
        </div>
        <div>
          <p className="text-3xl font-black text-gray-900 mb-1">
            {today.getHours().toString().padStart(2, '0')}:{today.getMinutes().toString().padStart(2, '0')}
          </p>
          <p className="text-sm font-medium text-gray-500 capitalize">{dateString}</p>
        </div>
      </div>

      {/* 2. WIDGET THỜI TIẾT */}
      <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl p-5 text-white shadow-sm flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10 flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 opacity-90">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-semibold">{weather?.location?.name || 'Hà Nội'}</span>
          </div>
          <Cloud className="w-6 h-6 opacity-80" />
        </div>
        
        <div className="relative z-10">
          {loadingWeather ? (
            <Loader2 className="w-5 h-5 animate-spin opacity-70" />
          ) : weather ? (
            <div className="flex items-end justify-between">
              <div>
                <h4 className="text-3xl font-black">{weather.current.temp_c}°C</h4>
                <p className="text-sm font-medium opacity-90">{weather.current.condition.text}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium opacity-80 pb-1">
                <Wind className="w-3.5 h-3.5" />
                <span>{weather.current.wind_kph} km/h</span>
              </div>
            </div>
          ) : (
            <p className="text-sm opacity-70">Không thể tải dữ liệu</p>
          )}
        </div>
      </div>

      {/* 3. WIDGET TIN TỨC AI */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3 text-emerald-600">
          <Newspaper className="w-5 h-5" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Tin tức AI</h3>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {loadingNews ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : news.length > 0 ? (
            <div className="space-y-3">
              {news.map((item, idx) => (
                <a 
                  key={idx} 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2 group-hover:text-[#5c40e8] transition-colors">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    {item.source.name} <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Chưa có bản tin mới.</p>
          )}
        </div>
      </div>

    </div>
  );
};

export default DashboardWidgets;