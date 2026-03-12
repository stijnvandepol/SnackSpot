import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params

  return {
    alternates: {
      canonical: `/review/${encodeURIComponent(id)}`,
    },
  }
}

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children
}
