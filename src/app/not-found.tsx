import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">404 - Không tìm thấy trang</CardTitle>
          <CardDescription>
            Trang bạn đang tìm kiếm không tồn tại hoặc đã được chuyển đến vị trí khác.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link href="/">
              Quay về trang chủ
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 