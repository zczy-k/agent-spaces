"use client"

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightLeftIcon,
  CalendarClockIcon,
  CalendarX2Icon,
  ChartNoAxesCombinedIcon,
  ChartPieIcon,
  ChartSplineIcon,
  ClipboardListIcon,
  Clock9Icon,
  CrownIcon,
  FacebookIcon,
  FolderOpen,
  HashIcon,
  InstagramIcon,
  LanguagesIcon,
  LinkedinIcon,
  Plus,
  SettingsIcon,
  SquareActivityIcon,
  TriangleAlertIcon,
  TruckIcon,
  TwitterIcon,
  Undo2Icon,
  UsersIcon
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar'

import LanguageDropdown from '@/components/shadcn-studio/blocks/dropdown-language'
import ProfileDropdown from '@/components/shadcn-studio/blocks/dropdown-profile'
import { WorkspaceDialog } from '@/components/workspace/workspace-dialog'
import type { Workspace } from '@agent-spaces/shared'

// Statistics card data
const StatisticsCardData = [
  {
    icon: <TruckIcon className='size-4' />,
    value: '42',
    title: 'Shipped Orders',
    changePercentage: '+18.2%'
  },
  {
    icon: <TriangleAlertIcon className='size-4' />,
    value: '8',
    title: 'Damaged Returns',
    changePercentage: '-8.7%'
  },
  {
    icon: <CalendarX2Icon className='size-4' />,
    value: '27',
    title: 'Missed Delivery Slots',
    changePercentage: '+4.3%'
  }
]

// Earning data for Total Earning card
const earningData = [
  {
    img: 'https://cdn.shadcnstudio.com/ss-assets/blocks/dashboard-application/widgets/zipcar.png',
    platform: 'Zipcar',
    technologies: 'Vuejs & HTML',
    earnings: '-$23,569.26',
    progressPercentage: 75
  },
  {
    img: 'https://cdn.shadcnstudio.com/ss-assets/blocks/dashboard-application/widgets/bitbank.png',
    platform: 'Bitbank',
    technologies: 'Figma & React',
    earnings: '-$12,650.31',
    progressPercentage: 25
  }
]

// Transaction table data
const transactionData = [
  {
    id: '1',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png',
    avatarFallback: 'JA',
    name: 'Jack Alfredo',
    amount: 316.0,
    status: 'paid' as const,
    email: 'jack@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '2',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-2.png',
    avatarFallback: 'MG',
    name: 'Maria Gonzalez',
    amount: 253.4,
    status: 'pending' as const,
    email: 'maria.g@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '3',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png',
    avatarFallback: 'JD',
    name: 'John Doe',
    amount: 852.0,
    status: 'paid' as const,
    email: 'john.doe@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '4',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-4.png',
    avatarFallback: 'EC',
    name: 'Emily Carter',
    amount: 889.0,
    status: 'pending' as const,
    email: 'emily.carter@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '5',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png',
    avatarFallback: 'DL',
    name: 'David Lee',
    amount: 723.16,
    status: 'paid' as const,
    email: 'david.lee@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '6',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-6.png',
    avatarFallback: 'SP',
    name: 'Sophia Patel',
    amount: 612.0,
    status: 'failed' as const,
    email: 'sophia.patel@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '7',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-7.png',
    avatarFallback: 'RW',
    name: 'Robert Wilson',
    amount: 445.25,
    status: 'paid' as const,
    email: 'robert.wilson@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '8',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-8.png',
    avatarFallback: 'LM',
    name: 'Lisa Martinez',
    amount: 297.8,
    status: 'processing' as const,
    email: 'lisa.martinez@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '9',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-9.png',
    avatarFallback: 'MT',
    name: 'Michael Thompson',
    amount: 756.9,
    status: 'paid' as const,
    email: 'michael.thompson@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '10',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-10.png',
    avatarFallback: 'AJ',
    name: 'Amanda Johnson',
    amount: 189.5,
    status: 'pending' as const,
    email: 'amanda.johnson@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '11',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-11.png',
    avatarFallback: 'KB',
    name: 'Kevin Brown',
    amount: 1024.75,
    status: 'paid' as const,
    email: 'kevin.brown@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '12',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-12.png',
    avatarFallback: 'SD',
    name: 'Sarah Davis',
    amount: 367.2,
    status: 'failed' as const,
    email: 'sarah.davis@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '13',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-13.png',
    avatarFallback: 'CG',
    name: 'Christopher Garcia',
    amount: 598.45,
    status: 'processing' as const,
    email: 'christopher.garcia@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '14',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-14.png',
    avatarFallback: 'JR',
    name: 'Jennifer Rodriguez',
    amount: 821.3,
    status: 'paid' as const,
    email: 'jennifer.rodriguez@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '15',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-15.png',
    avatarFallback: 'DM',
    name: 'Daniel Miller',
    amount: 156.75,
    status: 'pending' as const,
    email: 'daniel.miller@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '16',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-16.png',
    avatarFallback: 'NW',
    name: 'Nicole White',
    amount: 934.1,
    status: 'paid' as const,
    email: 'nicole.white@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '17',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-17.png',
    avatarFallback: 'AL',
    name: 'Anthony Lopez',
    amount: 412.85,
    status: 'failed' as const,
    email: 'anthony.lopez@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '18',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-18.png',
    avatarFallback: 'MH',
    name: 'Michelle Harris',
    amount: 675.5,
    status: 'processing' as const,
    email: 'michelle.harris@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '19',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-19.png',
    avatarFallback: 'JC',
    name: 'James Clark',
    amount: 289.95,
    status: 'paid' as const,
    email: 'james.clark@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '20',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-20.png',
    avatarFallback: 'RL',
    name: 'Rachel Lewis',
    amount: 1156.25,
    status: 'pending' as const,
    email: 'rachel.lewis@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '21',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-21.png',
    avatarFallback: 'TY',
    name: 'Thomas Young',
    amount: 543.6,
    status: 'paid' as const,
    email: 'thomas.young@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '22',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-22.png',
    avatarFallback: 'SB',
    name: 'Stephanie Brown',
    amount: 789.3,
    status: 'processing' as const,
    email: 'stephanie.brown@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '23',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-23.png',
    avatarFallback: 'BM',
    name: 'Brandon Moore',
    amount: 425.75,
    status: 'failed' as const,
    email: 'brandon.moore@shadcnstudio.com',
    paidBy: 'visa' as const
  },
  {
    id: '24',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-24.png',
    avatarFallback: 'KT',
    name: 'Kelly Taylor',
    amount: 1203.5,
    status: 'paid' as const,
    email: 'kelly.taylor@shadcnstudio.com',
    paidBy: 'mastercard' as const
  },
  {
    id: '25',
    avatar: 'https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-25.png',
    avatarFallback: 'MA',
    name: 'Mark Anderson',
    amount: 356.2,
    status: 'pending' as const,
    email: 'mark.anderson@shadcnstudio.com',
    paidBy: 'visa' as const
  }
]

export function HomePage({ initialWorkspaces }: { initialWorkspaces: Workspace[] }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleWsSubmit = async (data: { name: string; boundDirs: string[] }) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const ws = await res.json()
    setWorkspaces((prev) => [...prev, ws])
  }

  return (
    <div className='flex min-h-dvh w-full'>
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><ChartNoAxesCombinedIcon /><span>Dashboard</span></SidebarMenuButton>
                    <SidebarMenuBadge className='bg-primary/10 rounded-full'>5</SidebarMenuBadge>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Pages</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><ChartSplineIcon /><span>Content Performance</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><UsersIcon /><span>Audience Insight</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><ChartPieIcon /><span>Engagement Metrics</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><HashIcon /><span>Hashtag Performance</span></SidebarMenuButton>
                    <SidebarMenuBadge className='bg-primary/10 rounded-full'>3</SidebarMenuBadge>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><ArrowRightLeftIcon /><span>Competitor Analysis</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><Clock9Icon /><span>Campaign Tracking</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><ClipboardListIcon /><span>Sentiment Tracking</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><CrownIcon /><span>Influencer</span></SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Supporting Features</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><SquareActivityIcon /><span>Real Time Monitoring</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><CalendarClockIcon /><span>Schedule Post & Calendar</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><Undo2Icon /><span>Report & Export</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><SettingsIcon /><span>Settings & Integrations</span></SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href='#' />}><UsersIcon /><span>User Management</span></SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className='flex flex-1 flex-col'>
          <header className='bg-card sticky top-0 z-50 border-b'>
            <div className='mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 sm:px-6'>
              <div className='flex items-center gap-4'>
                <SidebarTrigger className='[&_svg]:!size-5' />
                <Separator orientation='vertical' className='hidden !h-4 sm:block' />
                <Breadcrumb className='hidden sm:block'>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href='/'>Home</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>Workspaces</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className='flex items-center gap-1.5'>
                <LanguageDropdown
                  trigger={
                    <div className='inline-flex items-center justify-center rounded-md size-9 hover:bg-accent hover:text-accent-foreground cursor-pointer'>
                      <LanguagesIcon className='size-4' />
                    </div>
                  }
                />
                <ProfileDropdown
                  trigger={
                    <div className='inline-flex items-center justify-center rounded-md size-9.5 hover:bg-accent hover:text-accent-foreground cursor-pointer'>
                      <Avatar className='size-9.5 rounded-md'>
                        <AvatarImage src='https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png' />
                        <AvatarFallback>JD</AvatarFallback>
                      </Avatar>
                    </div>
                  }
                />
              </div>
            </div>
          </header>
          <main className='mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6'>
            <div className='mb-6 flex items-center justify-between'>
              <h1 className='text-2xl font-semibold'>Workspaces</h1>
              <Button onClick={() => setDialogOpen(true)} size='sm' className='rounded-full px-4'>
                <Plus className='size-3.5' />
                New Workspace
              </Button>
            </div>
            {workspaces.length === 0 ? (
              <div className='rounded-2xl border border-dashed border-border p-16 text-center'>
                <FolderOpen className='size-10 mx-auto text-muted-foreground/40 mb-4' />
                <p className='text-muted-foreground text-sm'>
                  No workspaces yet. Create one to get started.
                </p>
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {workspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={`/workspace/${ws.id}`}
                    className='group rounded-2xl border border-border bg-card p-5 hover:shadow-card-hover transition-all duration-200 block'
                  >
                    <div className='flex items-start justify-between'>
                      <div className='w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center'>
                        <FolderOpen className='size-5 text-primary' />
                      </div>
                    </div>
                    <h3 className='font-heading text-lg font-semibold mt-3'>{ws.name}</h3>
                    <p className='text-sm text-muted-foreground mt-1 truncate'>
                      {ws.boundDirs.join(', ')}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </main>
          <footer>
            <div className='text-muted-foreground mx-auto flex size-full max-w-7xl items-center justify-between gap-3 px-4 py-3 max-sm:flex-col sm:gap-6 sm:px-6'>
              <p className='text-sm text-balance max-sm:text-center'>
                {`©${new Date().getFullYear()}`}{' '}
                <a href='#' className='text-primary'>
                  Agent Spaces
                </a>
              </p>
              <div className='flex items-center gap-5'>
                <a href='#'>
                  <FacebookIcon className='size-4' />
                </a>
                <a href='#'>
                  <InstagramIcon className='size-4' />
                </a>
                <a href='#'>
                  <LinkedinIcon className='size-4' />
                </a>
                <a href='#'>
                  <TwitterIcon className='size-4' />
                </a>
              </div>
            </div>
          </footer>
        </div>
      </SidebarProvider>

      <WorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleWsSubmit}
      />
    </div>
  )
}
