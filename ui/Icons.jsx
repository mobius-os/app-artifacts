import React from 'react'

function Svg({ children, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function ArtifactIcon(props) {
  return <Svg {...props}><path d="M7 3.75h7.5L19 8.25v12H7z" /><path d="M14.5 3.75v4.5H19" /><path d="m10 14 1.5 1.5L16 11" /></Svg>
}

export function ArrowLeftIcon(props) {
  return <Svg {...props}><path d="m15 18-6-6 6-6" /></Svg>
}

export function ArrowUpRightIcon(props) {
  return <Svg {...props}><path d="M7 17 17 7" /><path d="M8 7h9v9" /></Svg>
}

export function ChatIcon(props) {
  return <Svg {...props}><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3z" /></Svg>
}

export function ChevronDownIcon(props) {
  return <Svg {...props}><path d="m7 10 5 5 5-5" /></Svg>
}

export function ChevronRightIcon(props) {
  return <Svg {...props}><path d="m9 18 6-6-6-6" /></Svg>
}

export function CopyIcon(props) {
  return <Svg {...props}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>
}

export function DownloadIcon(props) {
  return <Svg {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Svg>
}

export function ExpandIcon(props) {
  return <Svg {...props}><path d="M8 3H3v5" /><path d="m3 3 6 6" /><path d="M16 21h5v-5" /><path d="m21 21-6-6" /></Svg>
}

export function MoreIcon(props) {
  return <Svg {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></Svg>
}

export function ReloadIcon(props) {
  return <Svg {...props}><path d="M20 7v5h-5" /><path d="M18.5 16a8 8 0 1 1 .5-8.5L20 12" /></Svg>
}

export function ShareIcon(props) {
  return <Svg {...props}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5" /><path d="m8.2 13.2 7.6 4.5" /></Svg>
}

export function TrashIcon(props) {
  return <Svg {...props}><path d="M4 7h16" /><path d="m9 7 .7-3h4.6l.7 3" /><path d="m6.5 7 .8 13h9.4l.8-13" /><path d="M10 11v5" /><path d="M14 11v5" /></Svg>
}

export function CheckIcon(props) {
  return <Svg {...props}><path d="m5 12 4 4L19 6" /></Svg>
}
