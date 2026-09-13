import { redirect } from 'next/navigation'

export default function AdminChallengesPage() {
  redirect('/admin/operations?tab=challenges')
}
