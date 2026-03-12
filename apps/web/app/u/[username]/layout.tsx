import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params

  return {
    alternates: {
      canonical: `/u/${encodeURIComponent(username)}`,
    },
  }
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
