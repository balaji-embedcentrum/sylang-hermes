import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: function redirectToProjects() {
    throw redirect({
      to: '/projects' as string,
      replace: true,
    })
  },
  component: function IndexRoute() {
    return null
  },
})
