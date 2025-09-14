"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { User, Lock, Globe, BarChart3, Wrench, Calendar, FileText, QrCode, Settings } from "lucide-react"
import { Logo } from "@/components/icons"
// Temporarily keep AuthContext for other parts but use NextAuth for login
import { useLanguage } from "@/contexts/language-context"

export default function LoginPage() {
  const { currentLanguage, setLanguage, t } = useLanguage()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

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
      description: "Theo dõi tình trạng thiết bị, xem biểu đồ báo cáo thống kê và cảnh báo quan trọng"
    },
    {
      icon: Settings,
      title: "Quản lý thiết bị",
      description: "Danh mục chi tiết, tìm kiếm thông minh và quản lý toàn bộ vòng đời thiết bị"
    },
    {
      icon: Wrench,
      title: "Yêu cầu sửa chữa",
      description: "Tạo, theo dõi và quản lý các yêu cầu sửa chữa thiết bị một cách hiệu quả"
    },
    {
      icon: Calendar,
      title: "Kế hoạch bảo trì",
      description: "Lập lịch và giám sát công việc bảo trì, hiệu chuẩn, kiểm định thiết bị định kỳ"
    },
    {
      icon: FileText,
      title: "Báo cáo & Thống kê",
      description: "Tạo báo cáo chi tiết và biểu đồ trực quan để hỗ trợ ra quyết định"
    },
    {
      icon: QrCode,
      title: "Công nghệ mã QR",
      description: "Truy xuất tức thì thông tin và lịch sử thiết bị chỉ với một lần quét"
    }
  ]

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col lg:flex-row lg:gap-8 lg:items-start">
        {/* Mobile: Login Form First */}
        <div className="lg:hidden w-full flex items-center justify-center order-1">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-accent px-8 py-6 text-center">
              <div className="flex justify-center mb-4">
  <div className="inline-flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 p-2">
    <Logo className="w-16 h-16" />
  </div>
</div>
              <h1 className="text-2xl font-bold text-primary-foreground">QUẢN LÝ THIẾT BỊ Y TẾ</h1>
              <p className="text-primary-foreground/80 mt-2">{t("login.subtitle") || "Đăng nhập vào hệ thống"}</p>
            </div>

            {/* Form */}
            <div className="p-6">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <User className="h-4 w-4 inline mr-1" />
                    {t("login.username") || "Tên đăng nhập"}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                    placeholder={t("login.usernamePlaceholder") || "Nhập tên đăng nhập"}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    <Lock className="h-4 w-4 inline mr-1" />
                    {t("login.password") || "Mật khẩu"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                    placeholder={t("login.passwordPlaceholder") || "Nhập mật khẩu"}
                    required
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                >
                  {isLoading ? (t("login.signingIn") || "Đang xác thực...") : (t("login.signIn") || "Đăng nhập")}
                </button>
              </form>

              {/* Language Toggle */}
              <div className="mt-6 text-center">
                <button
                  onClick={toggleLanguage}
                  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Globe className="h-4 w-4 mr-1" />
                  {currentLanguage.code === 'en' ? 'Tiếng Việt' : 'English'}
                </button>
              </div>

              {/* Footer Content */}
              <div className="mt-6 text-center text-xs text-muted-foreground space-y-1">
                <p>{t("footer.developedBy") || "Phát triển bởi Nguyễn Thiện Chí"}</p>
                <p>{t("footer.contact") || "Mọi chi tiết xin liên hệ: thienchi2109@gmail.com"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Left Column - Infographic Section (Desktop) / Features Section (Mobile) */}
        <div className="w-full lg:w-3/5 p-6 lg:p-8 flex flex-col order-2 lg:order-1">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center lg:text-left mb-6 lg:mb-8">
              <h1 className="text-2xl lg:text-4xl font-bold text-primary mb-3 lg:mb-4">
                HỆ THỐNG QUẢN LÝ THIẾT BỊ Y TẾ
              </h1>
              <p className="text-base lg:text-lg text-muted-foreground">
                Nền tảng thông minh giúp tối ưu hóa hiệu suất, đảm bảo an toàn và kéo dài tuổi thọ cho các thiết bị y tế quan trọng.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-card p-4 lg:p-6 rounded-lg border border-border hover:border-primary/30 transition-colors shadow-sm"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center mb-3">
                      <div className="bg-primary/10 p-2 rounded-lg mr-3">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-primary text-sm lg:text-base">
                        {feature.title}
                      </h3>
                    </div>
                    <p className="text-xs lg:text-sm text-muted-foreground flex-grow">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Info */}
            <div className="mt-6 lg:mt-12 text-center lg:text-left">
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 lg:p-6">
                <h4 className="font-semibold text-accent mb-2">
                  🏥 Tài khoản này thuộc Hệ thống quản lý thiết bị y tế Nam Phong Technical Hi-Tech
                </h4>
                <p className="text-sm text-muted-foreground">
                  Được thiết kế đặc biệt để đáp ứng nhu cầu quản lý thiết bị y tế chuyên nghiệp,
                  đảm bảo tuân thủ các quy định và tiêu chuẩn y tế.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Login Form (Desktop Only) */}
        <div className="hidden lg:flex w-full lg:w-2/5 items-start justify-center order-1 lg:order-2">
          <div className="w-full max-w-md" style={{ marginTop: 'calc(2.5rem + 1.5rem + 2rem)' }}>
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary to-accent px-8 py-6 text-center">
                <div className="flex justify-center mb-4">
  <div className="inline-flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm shadow-sm ring-1 ring-black/5 p-2">
    <Logo className="w-16 h-16" />
  </div>
</div>
                <h1 className="text-2xl font-bold text-primary-foreground">QUẢN LÝ THIẾT BỊ Y TẾ</h1>
                <p className="text-primary-foreground/80 mt-2">{t("login.subtitle") || "Đăng nhập vào hệ thống"}</p>
              </div>

              {/* Form */}
              <div className="p-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <p className="text-destructive text-sm">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      <User className="h-4 w-4 inline mr-1" />
                      {t("login.username") || "Tên đăng nhập"}
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                      placeholder={t("login.usernamePlaceholder") || "Nhập tên đăng nhập"}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      <Lock className="h-4 w-4 inline mr-1" />
                      {t("login.password") || "Mật khẩu"}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                      placeholder={t("login.passwordPlaceholder") || "Nhập mật khẩu"}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-target"
                  >
                    {isLoading ? (t("login.signingIn") || "Đang xác thực...") : (t("login.signIn") || "Đăng nhập")}
                  </button>
                </form>

                {/* Language Toggle */}
                <div className="mt-6 text-center">
                  <button
                    onClick={toggleLanguage}
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Globe className="h-4 w-4 mr-1" />
                    {currentLanguage.code === 'en' ? 'Tiếng Việt' : 'English'}
                  </button>
                </div>

                {/* Footer Content */}
                <div className="mt-6 text-center text-xs text-muted-foreground space-y-1">
                  <p>{t("footer.developedBy") || "Phát triển bởi Nguyễn Thiện Chí"}</p>
                  <p>{t("footer.contact") || "Mọi chi tiết xin liên hệ: thienchi2109@gmail.com"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
