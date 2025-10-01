"use client"

import { useState, useEffect } from "react"
import { signIn, getSession } from "next-auth/react"
import { User, Lock, Globe, BarChart3, Wrench, Calendar, FileText, QrCode, Settings, Shield, Zap, Heart } from "lucide-react"
import { Logo } from "@/components/icons"
import { useLanguage } from "@/contexts/language-context"

export default function LoginPage() {
  const { currentLanguage, setLanguage, t } = useLanguage()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Safe Base64 encode for Unicode characters
  const safeBase64Encode = (str: string): string => {
    try {
      return btoa(unescape(encodeURIComponent(str)))
    } catch (error) {
      return btoa(str)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })
      if (!result || result.error) {
        setError(t("login.error") || "Tên đăng nhập hoặc mật khẩu không đúng")
        setIsLoading(false)
        return
      }
      // Success: NextAuth session established; no legacy bridge writes
      // Redirect to dashboard
      window.location.href = "/dashboard"
    } catch (err) {
      setError(t("login.error") || "Tên đăng nhập hoặc mật khẩu không đúng")
      setIsLoading(false)
    }
  }

  const toggleLanguage = () => {
    const newLang = currentLanguage.code === 'en'
      ? { code: 'vi' as const, name: 'Tiếng Việt' }
      : { code: 'en' as const, name: 'English' }
    setLanguage(newLang)
  }

  // Core features for the infographic
  const features = [
    {
      icon: BarChart3,
      title: "Dashboard Tổng quan",
      description: "Theo dõi tình trạng thiết bị, xem biểu đồ báo cáo thống kê và cảnh báo quan trọng",
      gradient: "from-blue-500 to-cyan-400"
    },
    {
      icon: Settings,
      title: "Quản lý thiết bị",
      description: "Danh mục chi tiết, tìm kiếm thông minh và quản lý toàn bộ vòng đời thiết bị",
      gradient: "from-purple-500 to-pink-400"
    },
    {
      icon: Wrench,
      title: "Yêu cầu sửa chữa",
      description: "Tạo, theo dõi và quản lý các yêu cầu sửa chữa thiết bị một cách hiệu quả",
      gradient: "from-orange-500 to-red-400"
    },
    {
      icon: Calendar,
      title: "Kế hoạch bảo trì",
      description: "Lập lịch và giám sát công việc bảo trì, hiệu chuẩn, kiểm định thiết bị định kỳ",
      gradient: "from-green-500 to-emerald-400"
    },
    {
      icon: FileText,
      title: "Báo cáo & Thống kê",
      description: "Tạo báo cáo chi tiết và biểu đồ trực quan để hỗ trợ ra quyết định",
      gradient: "from-indigo-500 to-blue-400"
    },
    {
      icon: QrCode,
      title: "Công nghệ mã QR",
      description: "Truy xuất tức thì thông tin và lịch sử thiết bị chỉ với một lần quét",
      gradient: "from-teal-500 to-cyan-400"
    }
  ]

  const stats = [
    { icon: Shield, value: "99.9%", label: "Uptime", color: "text-green-400" },
    { icon: Zap, value: "2.5s", label: "Response Time", color: "text-yellow-400" },
    { icon: Heart, value: "24/7", label: "Support", color: "text-red-400" }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJoc2wodmFyKC0tcHJpbWFyeSkpIiBzdHJva2Utb3BhY2l0eT0iMC4wMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>

      <div className="relative z-10 min-h-screen">
        {/* Mobile: Login Form First */}
        <div className="lg:hidden">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className={`w-full max-w-md ${mounted ? 'animate-in slide-in-from-top duration-700' : 'opacity-0'}`}>
              <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
                {/* Header with Logo */}
                <div className="bg-gradient-to-r from-primary to-accent px-8 py-8 text-center">
                  <div className="flex justify-center mb-4">
                    <Logo className="w-16 h-16" size={64} />
                  </div>
                  <h2 className="text-2xl font-bold text-primary-foreground mb-2">CVMEMS</h2>
                  <p className="text-primary-foreground/90 text-sm">{t("login.subtitle") || "Đăng nhập vào hệ thống"}</p>
                </div>

                {/* Form */}
                <div className="p-8 space-y-6">
                  <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                      <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl p-4 animate-in slide-in-from-top duration-300">
                        <p className="text-red-600 text-sm font-medium">{error}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-foreground">
                        <User className="h-4 w-4 inline mr-2 text-primary" />
                        {t("login.username") || "Tên đăng nhập"}
                      </label>
                      <div className="relative group">
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full px-4 py-4 bg-background border border-input rounded-xl focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-300 placeholder-muted-foreground"
                          placeholder={t("login.usernamePlaceholder") || "Nhập tên đăng nhập"}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-foreground">
                        <Lock className="h-4 w-4 inline mr-2 text-primary" />
                        {t("login.password") || "Mật khẩu"}
                      </label>
                      <div className="relative group">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-4 bg-background border border-input rounded-xl focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-300 placeholder-muted-foreground"
                          placeholder={t("login.passwordPlaceholder") || "Nhập mật khẩu"}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold hover:bg-primary/90 focus:ring-4 focus:ring-ring transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            {t("login.signingIn") || "Đang xác thực..."}
                          </>
                        ) : (
                          <>
                            <User className="h-5 w-5" />
                            {t("login.signIn") || "Đăng nhập"}
                          </>
                        )}
                      </span>
                    </button>
                  </form>

                  {/* Language Toggle */}
                  <div className="text-center pt-4 border-t border-border">
                    <button
                      onClick={toggleLanguage}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-background border border-border rounded-lg px-3 py-2 hover:bg-accent"
                    >
                      <Globe className="h-4 w-4" />
                      {currentLanguage.code === 'en' ? 'Tiếng Việt' : 'English'}
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-xs text-muted-foreground pt-2">
                    <p>Copyright © CVMEMS</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Hero Content Below */}
          <div className={`px-4 pb-8 ${mounted ? 'animate-in slide-in-from-bottom duration-700' : 'opacity-0'}`} style={{ animationDelay: '300ms' }}>
            <div className="max-w-2xl mx-auto space-y-8">
              {/* Hero Section */}
              <div className="text-center space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 text-sm font-medium text-primary">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Hệ thống hoạt động ổn định
                  </div>

                  <h1 className="text-3xl font-bold text-primary leading-tight">
                    Quản Lý Thiết Bị Y Tế Thông Minh
                  </h1>

                  <p className="text-lg text-slate-600">
                    Nền tảng thông minh giúp tối ưu hóa hiệu suất, đảm bảo an toàn và kéo dài tuổi thọ cho các thiết bị y tế quan trọng.
                  </p>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap justify-center gap-4">
                  {stats.map((stat, index) => (
                    <div key={index} className="bg-card border border-border rounded-2xl p-4 min-w-[100px] group hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-2 mb-1">
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        <span className="text-xl font-bold text-slate-800">{stat.value}</span>
                      </div>
                      <p className="text-xs text-slate-600">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 gap-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={`bg-card border border-border rounded-2xl p-4 group hover:border-primary/30 transition-all duration-300 hover:shadow-lg ${mounted ? `animate-in slide-in-from-bottom duration-700` : 'opacity-0'}`}
                    style={{ animationDelay: `${(index + 2) * 100}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`bg-gradient-to-r ${feature.gradient} p-2 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <feature.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                          {feature.title}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Call to Action Info */}
              <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-accent p-2 rounded-lg shrink-0">
                    <Heart className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-accent mb-1 text-sm">
                      🏥 Hệ thống quản lý thiết bị y tế CVMEMS
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Được thiết kế đặc biệt để đáp ứng nhu cầu quản lý thiết bị y tế chuyên nghiệp,
                      đảm bảo tuân thủ các quy định và tiêu chuẩn y tế.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Side-by-side Layout */}
        <div className="hidden lg:flex min-h-screen items-center justify-center p-8">
          <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-16 items-center">

            {/* Left Side - Hero & Features */}
            <div className={`space-y-8 ${mounted ? 'animate-in slide-in-from-left duration-700' : 'opacity-0'}`}>
              {/* Hero Section */}
              <div className="text-left space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 text-sm font-medium text-primary">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    Hệ thống hoạt động ổn định
                  </div>

                  <h1 className="text-5xl font-bold text-primary leading-tight">
                    Quản Lý Thiết Bị Y Tế
                    <span className="block">Thông Minh</span>
                  </h1>

                  <p className="text-xl text-slate-600 max-w-xl">
                    Nền tảng thông minh giúp tối ưu hóa hiệu suất, đảm bảo an toàn và kéo dài tuổi thọ cho các thiết bị y tế quan trọng.
                  </p>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-6">
                  {stats.map((stat, index) => (
                    <div key={index} className="bg-card border border-border rounded-2xl p-4 min-w-[120px] group hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center gap-2 mb-1">
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        <span className="text-2xl font-bold text-slate-800">{stat.value}</span>
                      </div>
                      <p className="text-sm text-slate-600">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={`bg-card border border-border rounded-2xl p-6 group hover:border-primary/30 hover:scale-105 transition-all duration-300 hover:shadow-lg ${mounted ? `animate-in slide-in-from-bottom duration-700` : 'opacity-0'}`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className={`bg-gradient-to-r ${feature.gradient} p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                          <feature.icon className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Call to Action Info */}
              <div className="bg-accent/10 border border-accent/20 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-accent p-2 rounded-lg shrink-0">
                    <Heart className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-accent mb-2">
                      🏥 Hệ thống quản lý thiết bị y tế CVMEMS
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Được thiết kế đặc biệt để đáp ứng nhu cầu quản lý thiết bị y tế chuyên nghiệp,
                      đảm bảo tuân thủ các quy định và tiêu chuẩn y tế.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className={`flex justify-center ${mounted ? 'animate-in slide-in-from-right duration-700' : 'opacity-0'}`}>
              <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">

                  {/* Header with Logo */}
                  <div className="bg-gradient-to-r from-primary to-accent px-8 py-8 text-center">
                    <div className="flex justify-center mb-4">
                      <Logo className="w-16 h-16" size={64} />
                    </div>
                    <h2 className="text-2xl font-bold text-primary-foreground mb-2">CVMEMS</h2>
                    <p className="text-primary-foreground/90 text-sm">{t("login.subtitle") || "Đăng nhập vào hệ thống"}</p>
                  </div>

                  {/* Form */}
                  <div className="p-8 space-y-6">
                    <form onSubmit={handleLogin} className="space-y-5">
                      {error && (
                        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded-xl p-4 animate-in slide-in-from-top duration-300">
                          <p className="text-red-600 text-sm font-medium">{error}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          <User className="h-4 w-4 inline mr-2 text-primary" />
                          {t("login.username") || "Tên đăng nhập"}
                        </label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-4 bg-background border border-input rounded-xl focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-300 placeholder-muted-foreground"
                            placeholder={t("login.usernamePlaceholder") || "Nhập tên đăng nhập"}
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          <Lock className="h-4 w-4 inline mr-2 text-primary" />
                          {t("login.password") || "Mật khẩu"}
                        </label>
                        <div className="relative group">
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-4 bg-background border border-input rounded-xl focus:ring-2 focus:ring-ring focus:border-ring transition-all duration-300 placeholder-muted-foreground"
                            placeholder={t("login.passwordPlaceholder") || "Nhập mật khẩu"}
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary text-primary-foreground py-4 px-6 rounded-xl font-semibold hover:bg-primary/90 focus:ring-4 focus:ring-ring transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
                      >
                        <span className="flex items-center justify-center gap-2">
                          {isLoading ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              {t("login.signingIn") || "Đang xác thực..."}
                            </>
                          ) : (
                            <>
                              <User className="h-5 w-5" />
                              {t("login.signIn") || "Đăng nhập"}
                            </>
                          )}
                        </span>
                      </button>
                    </form>

                    {/* Language Toggle */}
                    <div className="text-center pt-4 border-t border-border">
                      <button
                        onClick={toggleLanguage}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors bg-background border border-border rounded-lg px-3 py-2 hover:bg-accent"
                      >
                        <Globe className="h-4 w-4" />
                        {currentLanguage.code === 'en' ? 'Tiếng Việt' : 'English'}
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="text-center text-xs text-muted-foreground pt-2">
                      <p>Copyright © CVMEMS</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
