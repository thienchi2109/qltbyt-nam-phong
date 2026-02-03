import { DeviceQuotaChiTietPageClient } from './_components/DeviceQuotaChiTietPageClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DeviceQuotaDecisionDetailPage({ params }: PageProps) {
  const { id } = await params
  return <DeviceQuotaChiTietPageClient quyetDinhId={parseInt(id, 10)} />
}
