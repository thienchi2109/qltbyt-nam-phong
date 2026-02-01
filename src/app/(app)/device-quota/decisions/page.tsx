"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2, FileText, Calendar, Building2, CheckCircle2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function DeviceQuotaDecisionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated" || !session?.user) {
    return null
  }

  // Placeholder data for example decisions
  const exampleDecisions = [
    {
      id: 1,
      code: "7396/QĐ-BYT",
      title: "Quy định định mức trang thiết bị y tế cơ bản tuyến tỉnh",
      issueDate: "27/09/2013",
      facility: "Bệnh viện đa khoa tỉnh",
      status: "Đang áp dụng",
    },
    {
      id: 2,
      code: "2348/QĐ-BYT",
      title: "Quy định định mức trang thiết bị y tế cơ bản tuyến huyện",
      issueDate: "15/06/2015",
      facility: "Bệnh viện đa khoa huyện",
      status: "Đang áp dụng",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Định mức - Quyết định</h1>
        <p className="text-muted-foreground">
          Quản lý quyết định định mức trang thiết bị y tế của Bộ Y tế
        </p>
      </div>

      {/* Feature Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quyết định hiện hành</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Đang được áp dụng
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loại cơ sở</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Tuyến tỉnh, huyện, xã
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cập nhật mới nhất</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Ngày ban hành
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Decisions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Danh sách quyết định định mức</CardTitle>
              <CardDescription>
                Các quyết định của Bộ Y tế về định mức trang thiết bị y tế
              </CardDescription>
            </div>
            <Badge variant="outline">Mẫu dữ liệu</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Số quyết định</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Ngày ban hành</TableHead>
                  <TableHead>Loại cơ sở</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exampleDecisions.map((decision) => (
                  <TableRow key={decision.id}>
                    <TableCell className="font-medium">{decision.code}</TableCell>
                    <TableCell className="max-w-md">{decision.title}</TableCell>
                    <TableCell>{decision.issueDate}</TableCell>
                    <TableCell>{decision.facility}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {decision.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-muted-foreground/40" />
                      <span className="text-sm">
                        Dữ liệu thực tế sẽ được tải từ database
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin về quyết định định mức</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Các quyết định định mức trang thiết bị y tế do Bộ Y tế ban hành quy định số lượng và loại thiết bị
              tối thiểu cần có tại các cơ sở y tế theo từng tuyến (tỉnh, huyện, xã) và loại hình (đa khoa, chuyên khoa).
            </p>
            <div className="grid gap-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Quyết định 7396/QĐ-BYT: Định mức cơ bản cho bệnh viện đa khoa tuyến tỉnh</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Quyết định 2348/QĐ-BYT: Định mức cơ bản cho bệnh viện đa khoa tuyến huyện</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <span>Các quyết định khác cho từng loại hình và tuyến cụ thể</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
