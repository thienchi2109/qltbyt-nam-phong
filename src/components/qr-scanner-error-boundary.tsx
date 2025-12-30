"use client"

import * as React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface Props {
  children: React.ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class QRScannerErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging (could send to error reporting service)
    if (process.env.NODE_ENV === 'development') {
      console.error('QR Scanner Error:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Lỗi Camera
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Đã xảy ra lỗi khi khởi động camera. Vui lòng thử lại.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={this.handleReset} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Thử lại
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.history.back()}
                    className="w-full"
                  >
                    Quay lại
                  </Button>
                </div>
                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-4 text-left">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      Chi tiết lỗi (dev only)
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
