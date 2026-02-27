"use client"

import * as React from "react"
import { FormBrandingHeader } from "@/components/form-branding-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, User, Lock } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend as RechartsLegend } from 'recharts'

export function LoginTemplate() {
  const chartData = [
    { name: 'Hoạt động', value: 120, color: '#0079FF' },
    { name: 'Chờ sửa chữa', value: 15, color: '#FFC107' },
    { name: 'Đang bảo trì', value: 8, color: '#FD7E14' },
    { name: 'Đã thanh lý', value: 5, color: '#6C757D' }
  ]

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Đây là template demo. Để đăng nhập thực tế, vui lòng sử dụng trang chính của ứng dụng.')
  }

  return (
    <div className="min-h-screen bg-sky-50">
      <div className="flex flex-col md:flex-row min-h-screen">
        
        {/* Left Column: Infographic/Overview */}
        <div className="w-full md:w-1/2 lg:w-3/5 bg-white p-8 lg:p-12 flex flex-col justify-center">
          <div className="max-w-2xl mx-auto">
            <FormBrandingHeader 
              align="left" 
              size="lg" 
              className="mb-6" 
            />
            
            <h1 className="text-3xl md:text-4xl font-black text-[#004AAD] mb-4">
              Hệ Thống Quản Lý Thiết Bị Y Tế Toàn Diện
            </h1>
            <p className="text-gray-600 mb-8">
              Nền tảng thông minh giúp tối ưu hóa hiệu suất, đảm bảo an toàn và kéo dài tuổi thọ cho các tài sản y tế quan trọng.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[
                {
                  icon: "📊",
                  title: "Tổng quan Dashboard",
                  description: "Số liệu, biểu đồ và các cảnh báo quan trọng được tổng hợp tại một nơi."
                },
                {
                  icon: "🔬",
                  title: "Quản lý Thiết bị",
                  description: "Danh mục chi tiết, tìm kiếm và lọc thông minh, quản lý toàn bộ vòng đời thiết bị."
                },
                {
                  icon: "🔧",
                  title: "Quản lý Sửa chữa",
                  description: "Tạo, theo dõi và quản lý các yêu cầu sửa chữa một cách hiệu quả."
                },
                {
                  icon: "📅",
                  title: "Kế hoạch Bảo trì",
                  description: "Chủ động lập lịch và giám sát công việc bảo trì, hiệu chuẩn, kiểm định."
                },
                {
                  icon: "📈",
                  title: "Báo cáo Trực quan",
                  description: "Cung cấp biểu đồ và số liệu chi tiết giúp ra quyết định nhanh chóng."
                },
                {
                  icon: "📱",
                  title: "Quét mã QR",
                  description: "Truy xuất tức thì thông tin và lịch sử thiết bị chỉ với một lần quét."
                }
              ].map((feature, index) => (
                <Card key={feature.title} className="bg-blue-50 border-blue-100">
                  <CardContent className="p-4">
                    <div className="text-2xl mb-2">{feature.icon}</div>
                    <h3 className="font-bold text-sm text-[#004AAD] mb-2">{feature.title}</h3>
                    <p className="text-xs text-gray-500">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="w-full max-w-md mx-auto">
              <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsLegend 
                      verticalAlign="bottom" 
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Login Form */}
        <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <Card className="shadow-2xl overflow-hidden">
              <CardHeader className="bg-[#4a7c82] text-center text-white">
                <div className="mb-4">
                  <FormBrandingHeader 
                    align="center" 
                    size="md" 
                    className="text-white [&_*]:text-white" 
                  />
                </div>
                <CardTitle className="text-2xl font-bold">QUẢN LÝ THIẾT BỊ Y TẾ</CardTitle>
                <CardDescription className="text-white/80">
                  Đăng nhập vào hệ thống
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-8">
                <Alert className="mb-6 border-yellow-200 bg-yellow-50">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Chú ý:</strong> Đây là template demo. Để đăng nhập thực tế, vui lòng sử dụng trang chính của ứng dụng.
                  </AlertDescription>
                </Alert>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <Label htmlFor="username" className="text-sm font-medium text-gray-600">
                      Tên đăng nhập
                    </Label>
                    <div className="relative mt-2">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        id="username"
                        name="username"
                        className="pl-10 py-3"
                        placeholder="Nhập tên đăng nhập"
                        disabled
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium text-gray-600">
                      Mật khẩu
                    </Label>
                    <div className="relative mt-2">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="password"
                        id="password"
                        name="password"
                        className="pl-10 py-3"
                        placeholder="Nhập mật khẩu"
                        disabled
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-[#5d9a9f] hover:bg-[#4a7c82] py-3 font-bold transition-colors duration-300"
                  >
                    Đăng nhập (Demo)
                  </Button>
                </form>
                
                <div className="text-center mt-6">
                  <a href="#" className="text-sm text-gray-500 hover:text-gray-700">English</a>
                </div>
              </CardContent>
            </Card>
            
            <div className="text-center mt-6">
              <p className="text-sm text-gray-500">
                Cần hỗ trợ? <a href="#" className="font-medium text-[#0079FF] hover:underline">Liên hệ quản trị viên</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
