import Link from 'next/link'

const Page = () => (
  <div className='*:rounded-2xl *:px-4 *:py-2 *:hover:bg-muted'>
    <Link href='/crud/static'>static</Link>
    <Link href='/crud/dynamic'>dynamic</Link>
    <Link href='/crud/pagination'>pagination</Link>
  </div>
)

export default Page
